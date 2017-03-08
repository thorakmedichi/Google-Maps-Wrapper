;
function initMap(){
    $(function(){
        initGoogleMapsObject();
        
        // Declare our view settings
        // If left blank the defaults set in the googleMaps.initMap() will be used
        let initOptions = {
                center: {lat: 30, lng: 0},
                zoom: 2,
                mapTypeId: 'roadmap',
                scrollwheel: false,
                mapTypeControl: true,
                mapTypeControlOptions: {
                    style: google.maps.MapTypeControlStyle.HORIZONTAL_MENU,
                    position: google.maps.ControlPosition.LEFT_BOTTOM
                }
            };
        googleMaps.initMap('map', initOptions);
        googleMaps.autoCompleteSearch(googleMaps.map, 'map', function(){
            getRegion(this, googleMaps.map);
        }, 'searchInput');

        showAllRegions(googleMaps.map, polyLines);
    });
}

/**
 * @file Custom Google Maps integration with regions / polygons
 * @author Ryan Stephens <ryan@sketchpad-media.com>
 * @version 0.5
 */

(function(global, $){
    var showAllRegions = function(map, polyLines){
        let bounds = new google.maps.LatLngBounds();
        let x;
        for (x in polyLines) {
            var polyRegion = googleMaps.drawPolygonBoundary(googleMaps.map, polyLines[x].polyLine);
            let infoWindowLocation = polyLines[x].latLng;
            let infoWindowContent = '<h4>'+ polyLines[x].cityName +'</h4>'+
                '<button class="btn btn-xs btn-danger btn-labeled fa fa-times remove-region" data-placeid="'+ polyLines[x].googlePlaceId +'" data-cityid="'+ polyLines[x].cityId +'">Remove</button> '+
                (polyLines[x].active == 0 
                ?
                '<button class="btn btn-xs btn-info btn-labeled fa fa-check activate-region" data-placeid="'+ polyLines[x].googlePlaceId +'" data-cityid="'+ polyLines[x].cityId +'">Activate</button> '
                :
                '<button class="btn btn-xs btn-warning btn-labeled fa fa-times deactivate-region" data-placeid="'+ polyLines[x].googlePlaceId +'" data-cityid="'+ polyLines[x].cityId +'">Deactivate</button> '
                );

            // Add the google place id so we can find this polygon later
            polyRegion.place_id = polyLines[x].googlePlaceId;

            // Change the polygon color if it is inactive
            if (polyLines[x].active == 0){
                polyRegion.setOptions({
                            strokeColor: '#000000',
                            fillColor: '#000000',
                        })
            }

            googleMaps.polygonClickInfoWindow(map, infoWindowLocation, polyRegion, function(){
                return $.Deferred(function (dfrd) {
                    dfrd.resolve(infoWindowContent);
                }).promise();
            });
        }

         map.fitBounds(googleMaps.polyBounds);
    };
    global.showAllRegions = showAllRegions;

    var getRegion = function(that, map){
        var place = that.getPlace();
console.log (place);
        googleMaps.getPolygonBoundary(place)
            .done(function(polyRegion){
                googleMaps.drawPolygonBoundary(map, polyRegion);

                updateDomValues(map, place, polyRegion);
            });
    };
    global.getRegion = getRegion;

    var updateDomValues = function(map, place, polyRegion){
        var bounds = googleMaps.getViewportFromPlace(place);

        $('input[name="city"]')
            .val(googleMaps.getCityLongName(place));
        $('input[name="administrativeArea"]')
            .val(googleMaps.getAdministrativeAreaLongName(place));
        $('input[name="country"]')
            .val(googleMaps.getCountryLongName(place));

        $('input[name="administrativeAreaShortName"]')
            .val(googleMaps.getAdministrativeAreaShortName(place));
        $('input[name="countryShortName"]')
            .val(googleMaps.getCountryShortName(place));

        $('input[name="google_place_id"]')
            .val(place.place_id);
        $('input[name="lat_lng"]')
            .val(JSON.stringify(place.geometry.location));
        $('input[name="bounds"]')
            .val(JSON.stringify(place.geometry.viewport));
        $('input[name="poly_line"]')
            .val(JSON.stringify(polyRegion));

        map.fitBounds(bounds);
    }


    /**
     * ------------------------------------------------------------------------
     * DOM LOADED JQUERY EVENT HANDLERS
     * ------------------------------------------------------------------------
     */
    $(function () {
        $(document).on('click', '.remove-region', function(){
            var cityId = $(this).data('cityid');
            var placeId = $(this).data('placeid');
            var data = {id: cityId};

            $.ajax({
                url: '/administration/regions/delete',
                type: 'DELETE',
                data: data
            })
            .done(function(result){
                var polyRegion = googleMaps.getPolygonFromArray('place_id', placeId);
                
                googleMaps.infoWindow.close();
                polyRegion.setMap(null);
            });
        });

        $(document).on('click', '.deactivate-region', function(){
            var cityId = $(this).data('cityid');
            var placeId = $(this).data('placeid');
            var data = {id: cityId};

            $.post('/administration/regions/deactivate', data)
                .done(function(result){
                    var polyRegion = googleMaps.getPolygonFromArray('place_id', placeId);

                    polyRegion.setOptions({
                        strokeColor: '#000000',
                        fillColor: '#000000',
                    });

                    $('.deactivate-region').addClass('fa-check');
                    $('.deactivate-region').addClass('activate-region');
                    $('.deactivate-region').addClass('btn-info');
                    $('.deactivate-region').removeClass('fa-times');
                    $('.deactivate-region').removeClass('btn-warning');
                    $('.deactivate-region').text('Activate');

                    $('.deactivate-region').removeClass('deactivate-region');
                });
        });

        $(document).on('click', '.activate-region', function(){
            var cityId = $(this).data('cityid');
            var placeId = $(this).data('placeid');
            var data = {id: cityId};

            $.post('/administration/regions/activate', data)
                .done(function(result){
                    var polyRegion = googleMaps.getPolygonFromArray('place_id', placeId);

                    polyRegion.setOptions({
                        strokeColor: '#FF0000',
                        fillColor: '#FF0000',
                    });

                    $('.activate-region').addClass('fa-times');
                    $('.activate-region').addClass('deactivate-region');
                    $('.activate-region').addClass('btn-warning');
                    $('.activate-region').removeClass('fa-check');
                    $('.activate-region').removeClass('btn-info');
                    $('.activate-region').text('Deactivate');

                    $('.activate-region').removeClass('activate-region');
            });
        });
    });
})(window, jQuery);