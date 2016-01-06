/*
$(document).ready(function() {

});
*/

if (!String.prototype.encodeHTML) {
  String.prototype.encodeHTML = function () {
    return this.replace(/&/g, '&amp;')
               .replace(/</g, '&lt;')
               .replace(/>/g, '&gt;')
               .replace(/"/g, '&quot;')
               .replace(/'/g, '&apos;');
  };
}

(function() {
  var app = angular.module('ECSPics', ['ngAnimate', 'ngSanitize']);

  app.value('loadingService', {
    loadingCount: 0,
    isLoading: function() { return loadingCount > 0; },
    requested: function() { loadingCount += 1; },
    responded: function() { loadingCount -= 1; }
  });

  app.factory('loadingInterceptor', ['$q', 'loadingService', function($q, loadingService) {
    return {
      request: function(config) {
        loadingService.requested();
        return config;
      },
      response: function(response) {
        loadingService.responded();
        return response;
      },
      responseError: function(rejection) {
        loadingService.responded();
        return $q.reject(rejection);
      },
    }
  }]);

  app.config(["$httpProvider", function ($httpProvider) {
    $httpProvider.interceptors.push('loadingInterceptor');
  }]);

  app.controller('PicsController', ['$http', '$animate', '$scope', 'loadingService', 'picsService', function($http, $animate, $scope, loadingService, picsService) {
    $scope.pics = picsService;
    loadingCount = 0;
    $scope.loadingService = loadingService;
    $scope.pics.buckets = [];
    $scope.pics.hostname = "";
    $scope.pics.ecs = {};
    $http.get('/api/v1/buckets').success(function(data) {
      $scope.pics.buckets = data;
    }).
    error(function(data, status, headers, config) {
      $scope.pics.messagetitle = "Error";
      $scope.pics.messagebody = data;
      $('#message').modal('show');
    });
    $http.get('/api/v1/hostname').success(function(data) {
      $scope.pics.hostname = data;
    }).
    error(function(data, status, headers, config) {
      $scope.pics.messagetitle = "Error";
      $scope.pics.messagebody = data;
      $('#message').modal('show');
    });
    $http.get('/api/v1/ecs').success(function(data) {
      $scope.pics.ecs = data;
    }).
    error(function(data, status, headers, config) {
      $scope.pics.messagetitle = "Error";
      $scope.pics.messagebody = data;
      $('#message').modal('show');
    });
  }]);

  app.factory('picsService', function() {
    return {}
  });

  app.directive("picsUpload", function() {
    return {
      restrict: 'E',
      templateUrl: "app/html/pics-upload.html",
      controller: ['$http', '$scope', 'picsService', function($http, $scope, picsService) {
        $scope.pics = picsService;
        this.uploadPicture = function(pics) {
          $http.post('/api/v1/uploadpicture', {
            bucket: $("#bucket").val(),
            retention: $("#retention").val(),
            file_size: $("#file_size").val(),
            file_name: $("#file_name").val(),
            image_width: $("#image_width").val(),
            image_height: $("#image_height").val(),
            gps_latitude: $("#gps_latitude").val(),
            gps_longitude: $("#gps_longitude").val(),
            datetime: $("#datetime").val()
          }).
            success(function(data, status, headers, config) {
              $scope.pics.messagetitle = "Upload in progress";
              $scope.pics.messagebody = '<h3>JSON data received from the server to upload the file from the web browser (including the signature computed by the server):</h3><pre><code>' + JSON.stringify(data, undefined, 2) + '</code></pre>';
              $('#message').modal({show: true});
              $scope.uploadCtrl.executeUpload(data);
            }).
            error(function(data, status, headers, config) {
              $scope.pics.messagetitle = "Error";
              $scope.pics.messagebody = "Can't get javascript code from the server to upload the file";
              $('#message').modal({show: true});
            });
        };
        this.executeUpload = function(data) {
          headers = {};
          for (var header in data["headers"]) {
            headers[header] = data["headers"][header][0];
          }
          var files = $("#file")[0].files;
          var reader = new FileReader();
          reader.onload = function(event) {
            var content = event.target.result;
            //console.log(blob);
            //console.log(content);
            try {
              $.ajax({
                url: data["url"],
                data: content,
                cache: false,
                processData: false,
                type: 'PUT',
                beforeSend: function (request)
                {
                  for (var header in data["headers"]) {
                    request.setRequestHeader(header, data["headers"][header][0]);
                  }
                },
                success: function(data, textStatus, request){
                  $scope.$apply(function() {
                    $scope.pics.messagetitle = "Success";
                    $scope.pics.messagebody = "Picture uploaded";
                    $('#message').modal({show: true});
                  });
                },
                error: function(data, textStatus, request){
                  $scope.$apply(function() {
                    $scope.pics.messagetitle = "Error";
                    $scope.pics.messagebody = "Upload failed";
                    $('#message').modal({show: true});
                  });
                }
              });
            }
            catch (e) {
              $scope.pics.messagetitle = "Error";
              $scope.pics.messagebody = "Upload failed";
              $('#message').modal({show: true});
            }
          }
          reader.readAsArrayBuffer(files[0]);
          //reader.readAsDataURL(thumbnailData);
        };
      }],
      controllerAs: "uploadCtrl"
    };
  });

  app.directive("picsBucket", function() {
    return {
      restrict: 'E',
      templateUrl: "app/html/pics-bucket.html",
      controller: ['$http', '$scope', 'picsService', function($http, $scope, picsService) {
        $scope.pics = picsService;
        this.createBucket = function() {
          $http.post('/api/v1/createbucket', {bucket: this.bucket}).
            success(function(data, status, headers, config) {
              $scope.pics.buckets.push(data["bucket"]);
              $scope.pics.messagetitle = "Success";
              $scope.pics.messagebody = "Bucket created with the following CORS configuration:<br /><br /><pre class='prettyprint'><code class='language-xml'>" + data["cors_configuration"].encodeHTML() + "</pre></code>";
              $('#message').modal({show: true});
            }).
            error(function(data, status, headers, config) {
              $scope.pics.messagetitle = "Error";
              $scope.pics.messagebody = data;
              $('#message').modal({show: true});
            });
        };
      }],
      controllerAs: "bucketCtrl"
    };
  });

  app.directive("picsSearch", function() {
    return {
      restrict: 'E',
      templateUrl: "app/html/pics-search.html",
      controller: ['$http', '$scope', 'picsService', function($http, $scope, picsService) {
        $scope.pics = picsService;
        $scope.pics.pictures = {};
        $scope.pics.markers = [];
        this.searchPics = function(pics) {
          for (var i = 0; i < $scope.pics.markers.length; i++) {
            $scope.pics.markers[i].setMap(null);
          }
          $scope.pics.markers = [];
          var sw = $scope.pics.rectangle.getBounds().getSouthWest();
          var ne = $scope.pics.rectangle.getBounds().getNorthEast();
          if(sw.lng() > ne.lng()) {
            $scope.pics.pictures = [];
            $scope.pics.messagetitle = "Error";
            $scope.pics.messagebody = "Can't select an area that is crossing the globe";
            $('#message').modal({show: true});
          } else {
            $http.post('/api/v1/search', {
              search_bucket: $("#search_bucket").val(),
              search_width: this.search_width,
              search_height: this.search_height,
              search_area: this.search_area,
              search_sw_latitude: sw.lat().toString(),
              search_sw_longitude: sw.lng().toString(),
              search_ne_latitude: ne.lat().toString(),
              search_ne_longitude: ne.lng().toString()
            }).
              success(function(data, status, headers, config) {
                $scope.pics.pictures = data;
                for (var i=0; i < $scope.pics.pictures.length; i++) {
                  var index = i;
                  if (($scope.pics.pictures[i]["Metadatas"]["x-amz-meta-gps-latitude"] != "") && ($scope.pics.pictures[i]["Metadatas"]["x-amz-meta-gps-longitude"] != "")) {
                    var myLatLng = {lat: parseFloat($scope.pics.pictures[i]["Metadatas"]["x-amz-meta-gps-latitude"]), lng: parseFloat($scope.pics.pictures[i]["Metadatas"]["x-amz-meta-gps-longitude"])};
                    var marker = new google.maps.Marker({
                      position: myLatLng,
                      map: $scope.pics.bigmap,
                      title: index.toString()
                    });
                    $scope.pics.markers.push(marker);
                    marker.addListener('click', function() {
                      title = this.title;
                      $scope.$apply(function() {
                        $scope.showCtrl.displayPicture(parseInt(title));
                      });
                    });
                  }
                }
              }).
              error(function(data, status, headers, config) {
                $scope.pics.pictures = [];
                $scope.pics.messagetitle = "Error";
                $scope.pics.messagebody = data;
                $('#message').modal({show: true});
              });
          }
        };
      }],
      controllerAs: "searchCtrl"
    };
  });

  app.directive("picsShow", function() {
    return {
      restrict: 'E',
      templateUrl: "app/html/pics-show.html",
      controller: ['$http', '$scope', 'picsService', function($http, $scope, picsService) {
        $scope.pics = picsService;
        this.displayPicture = function(index) {
          $scope.pics.messagetitle = $scope.pics.pictures[index]["Key"];
          $scope.pics.messagebody = '<div class="picture"><img src="' + $scope.pics.pictures[index]["MediaUrl"] + '" /><br /><ul class="list-group"><li class="list-group-item">Url: <a href="' + $scope.pics.pictures[index]["MediaUrl"] + '">' + $scope.pics.pictures[index]["MediaUrl"] + '</a></li>';
          if(typeof $scope.pics.pictures[index]["Metadatas"]["x-amz-meta-gps-latitude"] != "undefined") {
            $scope.pics.messagebody += '<li class="list-group-item">Latitude: ' + $scope.pics.pictures[index]["Metadatas"]["x-amz-meta-gps-latitude"] + '</li>';
          }
          if(typeof $scope.pics.pictures[index]["Metadatas"]["x-amz-meta-gps-longitude"] != "undefined") {
            $scope.pics.messagebody += '<li class="list-group-item">Longitude: ' + $scope.pics.pictures[index]["Metadatas"]["x-amz-meta-gps-longitude"] + '</li>';
          }
          $scope.pics.messagebody += '</ul></div>';
          $('#message').modal({show: true});
        };
        this.deletePicture = function(index) {
          headers = {};
          for (var header in $scope.pics.pictures[index]["DeleteRequestHeaders"]) {
            headers[header] = $scope.pics.pictures[index]["DeleteRequestHeaders"][header][0];
          }
          $http({
            url: $scope.pics.pictures[index]["DeleteRequestUrl"],
            method: "DELETE",
            headers: headers
          }).
            success(function(data, status, headers, config) {
              $scope.pics.pictures.splice(index, 1);
              for (var i = 0; i < $scope.pics.markers.length; i++) {
                $scope.pics.markers[i].setMap(null);
              }
              $scope.pics.markers = [];
              $scope.pics.messagetitle = "Success";
              $scope.pics.messagebody = "Picture deleted";
              $('#message').modal({show: true});
            }).
            error(function(data, status, headers, config) {
              $scope.pics.messagetitle = "Error";
              $scope.pics.messagebody = "Picture can't be deleted"
              if(data != "") {
                $scope.pics.messagebody += "<br /><br /><pre class='prettyprint'><code class='language-xml'>" + data.encodeHTML() + "</pre></code>";
              }
              $('#message').modal({show: true});
            });
        };
      }],
      controllerAs: "showCtrl"
    };
  });

  app.directive("picsBigmap", function() {
    return {
      restrict: 'E',
      templateUrl: "app/html/pics-bigmap.html",
      controller: ['$http', '$scope', 'picsService', function($http, $scope, picsService) {
        $scope.pics = picsService;
        this.displayBigMap = function() {
          var bigmapOptions = {
            zoom: 2,
            center: new google.maps.LatLng(35, -100),
            mapTypeId: google.maps.MapTypeId.ROADMAP
          };
          $scope.pics.bigmap = new google.maps.Map(document.getElementById('bigmap'),
          bigmapOptions);
          var bounds = {
            north: 50,
            south: 20,
            east: -70,
            west: -130
          };
          $scope.pics.rectangle = new google.maps.Rectangle({
            bounds: bounds,
            editable: true,
            draggable: true
          });
          $scope.pics.rectangle.setMap($scope.pics.bigmap);
          $scope.pics.rectangle.addListener('bounds_changed', this.updateRectanglePosition);
        };
        this.updateRectanglePosition = function(event) {
          var ne = $scope.pics.rectangle.getBounds().getNorthEast();
          var sw = $scope.pics.rectangle.getBounds().getSouthWest();

          var contentString = '<b>Rectangle moved.</b><br>' +
              'New north-east corner: ' + ne.lat() + ', ' + ne.lng() + '<br>' +
              'New south-west corner: ' + sw.lat() + ', ' + sw.lng();

          console.log(contentString);
        }
      }],
      link: function(scope, elem, attrs) {
        scope.bigmapCtrl.displayBigMap();
      },
      controllerAs: "bigmapCtrl"
    };
  });

  app.directive("picsMessage", function() {
    return {
      restrict: 'E',
      templateUrl: "app/html/pics-message.html"
    };
  });

  app.directive("picsInfos", function() {
    return {
      restrict: 'E',
      templateUrl: "app/html/pics-infos.html"
    };
  });
})();