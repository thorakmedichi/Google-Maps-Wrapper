;
/**
 * @file Custom Google Maps methods
 * @author Ryan Stephens <ryan@sketchpad-media.com>
 * @version 0.5
 */

var initGoogleMapsObject = function(){
    var googleMaps = {}; // Custom namespace to hold all things google maps related

    var loadedEvent = new CustomEvent("googleMapsLoaded"); 

    var selectedMarker;
    var markerMenu = document.getElementById('markerMenu');

    
    googleMaps.polygons = [];
    googleMaps.markers = [];


    /**
     * Create geographic boundary objects
     */
    googleMaps.markerBounds = new google.maps.LatLngBounds();
    googleMaps.polyBounds = new google.maps.LatLngBounds();

    /**
     * Create an info window object to be used for all the markers
     */
    googleMaps.infoWindow = new google.maps.InfoWindow();

    /**
     * Create Direction Services and Display settings needed to determine routes, distance and duration
     */
    googleMaps.directionsDisplay = new google.maps.DirectionsRenderer({ suppressMarkers: true, preserveViewport: true });
    googleMaps.directionsService = new google.maps.DirectionsService();

    /**
     * Setup a Geocoder for converting an address like "566 Simcoe Street, Victoria, BC" into geo coords 
     * and get Google Place Id if it exists
     */
    googleMaps.geocoder = new google.maps.Geocoder();

    /**
     * ///  MARKERS
     * ///////////////////////////////////////////////////////
     */

    // Clear all markers from the map and the marker array
    googleMaps.clearMarkers = function (){
        googleMaps.markers.forEach(function(marker) {
            marker.marker.setMap(null);
        });
        googleMaps.markers = [];
    }

    // Place a single marker on the map and add it to the marker array
    googleMaps.placeMarker = function (map, location, icon, draggable, callback){
        if (typeof icon == 'undefined' || icon == null){
            var icon = googleMaps.genericMarkerIcon;
        }

        if (typeof draggable == 'undefined' || draggable == null){
            var draggable = false;;
        }

        // Create the marker
        var marker = new google.maps.Marker({
            map: map,
            position: location,
            icon: icon,
            draggable: draggable
        })

        // Add the maker to the map and key it to the geo location
        googleMaps.markers.push({location: location, marker: marker});

        // Define event listeners
        if (draggable && typeof callback === 'function'){
            marker.addListener('dragend', callback);
        }

        googleMaps.markerBounds.extend(location);

        return marker; // Give the marker object back so we can modify it by adding infoWindows or whatever
    }

    // Place a single marker on the map and make it movable and recordable
    googleMaps.placeMoveableMarker = function (map, location, icon, callback){
        return googleMaps.placeMarker(map, location, icon, true, callback);
    }

    // Turn a markers visibility on or off
    googleMaps.toggleMarkerVisibility = function (expression){
        let x;
        for (x in googleMaps.markers){
            var marker = googleMaps.markers[x].marker;
            if (expression(marker)){
                if (marker.visible){
                    marker.setVisible(false);
                } else {
                    marker.setVisible(true);
                }
            }
        }
    }

    /**
     * ///  INFO WINDOWS
     * ///////////////////////////////////////////////////////
     */
    
    // Set what the content of the infoWindow will be. 
    // This is what is displayed when a user clicks a marker
    googleMaps.infoWindowContent = function (contentString){
        googleMaps.infoWindow.setContent(contentString);
        googleMaps.infoWindow.setZIndex(1000);
    }

    // Create an infoWindow event object to handle what happens 
    // when a user clicks on a marker
    googleMaps.markerHoverInfoWindow = function(map, marker, content){
        marker.addListener('mouseover', function() {
            googleMaps.infoWindowContent(content);
            googleMaps.infoWindow.open(map, marker);
        });

        marker.addListener('mouseout', function() {
            googleMaps.infoWindow.close(map, marker);
        });
    }

    // Create an infoWindow event object to handle what happens 
    // when a user hovers over a marker
    googleMaps.markerClickInfoWindow = function(map, marker, contentCallback){
        marker.addListener('click', function() {
            // Having a contentCallback instead of a simple string parameter allows us to have dynamic content get loaded
            // For example if I need direction information from another google API I can display that content after it has been acquired
            contentCallback().done(function(content){
                // Expose this so we can manipulate the marker if needed
                googleMaps.markerWithInfoWindowOpen = marker; 
                googleMaps.infoWindowContent(content);
                googleMaps.infoWindow.open(map, marker);
            });
        });
    }


    /**
     * ///  POLYGON LAYERS
     * ///////////////////////////////////////////////////////
     */
    
    // Clean up the data we receive from the API so we can ensure
    // only clean, understandable lat lng data is fed to the API
    googleMaps.sanitizePolygon = function(polygon){
        var coords = polygon;

        let x;
        for (x in coords){
            // If it is not a decimal number then it fails and we should remove it
            if (coords[x].lat % 1 == 0 || coords[x].lng % 1 == 0){
                //delete coords[x];
                coords.splice(x, 1);
            }
        }
        return coords;
    };
    
    // Add the polygon lat lng coordinates to the map so we have
    // a visual boundary for an area
    googleMaps.drawPolygonBoundary = function(map, polygon){
        var coords = polygon;
        //var coords = googleMaps.sanitizePolygon(coords);

        // Construct the polygon.
        var polyRegion = new google.maps.Polygon({
            paths: coords,
            strokeColor: '#FF0000',
            strokeOpacity: 0.8,
            strokeWeight: 1,
            fillColor: '#FF0000',
            fillOpacity: 0.35
        });
        polyRegion.setMap(map);

        // Add the polygon boundaries to the map of all polygons
        // This will help us set the zoom level to include all polygons
        googleMaps.polyBounds.union(polyRegion.getBounds());
        
        // Add the polygon to our array of all polygons
        googleMaps.polygons.push(polyRegion);

        return polyRegion;
    };

    // Reduce the array set of multiple poly regions to a single value
    // This means we are only dealing with one region / city / area at a time
    googleMaps.getPolygonFromArray = function(key, value){
        let x;
        for (x in googleMaps.polygons){
            if (googleMaps.polygons[x][key] == value){
                return googleMaps.polygons[x];
            }
        }
        return false;
    };

    // Launch an info windo if a user clicks on a polygon window
    // This will give us options to interact with the polygon region
    googleMaps.polygonClickInfoWindow = function(map, infoWindowLatLng, polyRegion, contentCallback){
        polyRegion.addListener('click', function() {
            // Having a contentCallback instead of a simple string parameter allows us to have dynamic content get loaded
            // For example if I need direction information from another google API I can display that content after it has been acquired
            contentCallback().done(function(content){

                googleMaps.infoWindowContent(content);
                googleMaps.infoWindow.open(map);
                googleMaps.infoWindow.setPosition(infoWindowLatLng);
            });
        });
    };

    // Get the outside boundary of a region / city / location.
    // This looks up the Open Street Map API for polygon boundaries based on location addresses
    // This data can be used by google to create polygon overlays for regions
    googleMaps.getPolygonBoundary = function(place){
        var location = place.formatted_address;

        return $.Deferred(function (dfrd) {
            // Query the API for a polygon result set
            var url = encodeURI('http://nominatim.openstreetmap.org/search?format=jsonv2&q='+ location +'&polygon_geojson=1&limit=3');
            $.get(url).done(function(result){

                // Define the LatLng coordinates for the polygon's path.
                var poly = result[0].geojson.coordinates[0];
                var polyRegion = [];

                // In some cases OpenStreetMap returns more than one result set.
                // This is typically less than 2 or 3 result sets.
                // In most cases this means the first set is the desired result.
                if (poly.length < 3){
                    var poly = poly[0];
                }
                
                // If there is no polygon boundary use the viewport instead                 
                if (poly.length == undefined){
                    let bounds = place.geometry.viewport;

                    var neLat = bounds.getNorthEast().lat();
                    var neLng = bounds.getNorthEast().lng();
                    var swLat = bounds.getSouthWest().lat();
                    var swLng = bounds.getSouthWest().lng();

                    polyRegion[0] = {lat: neLat, lng: neLng};
                    polyRegion[1] = {lat: swLat, lng: neLng};
                    polyRegion[2] = {lat: swLat, lng: swLng};
                    polyRegion[3] = {lat: neLat, lng: swLng};
                    
                    dfrd.resolve(polyRegion);
                    return;
                }
                
                // If we have a proper poly line lets build the object that will be needed to draw it later
                let x;
                for (x in poly) {
                    let lat = poly[x][1];
                    let lng = poly[x][0];
                    polyRegion.push({lat: parseFloat(lat), lng: parseFloat(lng)});
                }
                dfrd.resolve(polyRegion);
            });
        }).promise();
    };

    /**
     * ///  KML DATA
     * ///////////////////////////////////////////////////////
     */
    googleMaps.displayKml = function(map, url){
        var kmlOverlay = new google.maps.KmlLayer({
            url: url,
            map: map
        });
    }

    /**
     * ///  DISTANCE / DIRECTION
     * ///////////////////////////////////////////////////////
     */
     googleMaps.metersToKm = function(meters){
        var totalKms = meters / 1000;

        return {
            value: totalKms.toFixed(1),
            text: totalKms.toFixed(0) + ' km',
            totalMeters : meters
        };
     }

     googleMaps.secondsToHrsAndMinutes = function(seconds, hrsOnly){
        var totalMinutes = Math.round(seconds / 60); 

        if ((totalMinutes < 60) && (totalMinutes > -60)){
            return { 
                hrs: {
                    value: 0,
                    text: '0 hr'
                },
                mins: {
                    value: totalMinutes.toFixed(0), 
                    text: totalMinutes.toFixed(0) + ' min'
                },
                fullText: totalMinutes.toFixed(0) + ' min',
                totalSeconds: seconds
            };
        }

        var hrs = Math.floor(totalMinutes / 60);
        var remainder = (totalMinutes / 60) % 1;
        var mins = remainder * 60;

        hrs = hrs.toFixed(0);
        mins = mins.toFixed(0);

        return { 
            hrs: {
                value: hrs, 
                text: hrs + (hrs > 1 ? ' hrs' : ' hr')
            },
            mins: {
                value: mins, 
                text: mins + ' min'
            },
            fullText: (hrs ? hrs + ' hr ' : '') + mins + ' min',
            roundedToHrs: Math.round(totalMinutes / 60),
            totalSeconds: seconds
        };
     }


    // Get the total distance from one location to another
    googleMaps.computeTotalDistance = function (result) {
        var totalMeters = 0;
        var myroute = result.routes[0];

        for (var i = 0; i < myroute.legs.length; i++) {
            totalMeters += myroute.legs[i].distance.value;
        }

        var kms = googleMaps.metersToKm(totalMeters);

        return {value: totalMeters, 
                text: kms.text};
    }

    // Get the total duration from one location to another
    googleMaps.computeTotalDuration = function (result) {
        var totalSeconds = 0;
        var myroute = result.routes[0];

        for (var i = 0; i < myroute.legs.length; i++) {
            totalSeconds += myroute.legs[i].duration.value;
        }

        var hrsAndMinutes = googleMaps.secondsToHrsAndMinutes(totalSeconds);

        return {
            seconds: totalSeconds, 
            minutes: hrsAndMinutes.mins,
            hours: hrsAndMinutes.hrs,
            text: (hrsAndMinutes.hrs.value ? hrsAndMinutes.hrs.text + ' ' : '') + hrsAndMinutes.mins.text
        };
    }

    // Get the directions and waypoints from one location to another
    // This will also display the directions graphically on the map object
    googleMaps.getDirections = function (map, start, end, mode, departureTime){
        // Set a default mode incase the parameter is not supplied
        if (typeof mode == 'undefined') {
            var mode = 'DRIVING';
        }

        var request = {
            origin : start,
            destination : end,
            travelMode : google.maps.TravelMode[mode],
        };

        if (typeof departureTime !== 'undefined' && (mode == 'DRIVING' || mode == 'TRANSIT')){
            request[mode.toLowerCase() + 'Options'] = {
                departureTime : departureTime
            };
        }

        googleMaps.directionsDisplay.setMap(map); // map should be already initialized.

        return $.Deferred(function (dfrd) {
            googleMaps.directionsService.route(request, function(response, status) {
                if (status == google.maps.DirectionsStatus.OK) {
                    googleMaps.directionsDisplay.setDirections(response);
                    dfrd.resolve(response);
                } else {
                    dfrd.reject(new Error(status));
                }
            });
        }).promise();
    }

    /**
     * ///  ADDRESS / PLACES
     * ///////////////////////////////////////////////////////
     */
    
    // Get the GeoCoords and Google Place ID of an textual address
    googleMaps.getAddressGeoData = function (address) {
        return $.Deferred(function (dfrd) {
            googleMaps.geocoder.geocode({ 'address': address }, function (results, status) {
                if (status === 'OK') {
                    dfrd.resolve(results);
                } else {
                    console.log ('Geocode was not successful for the following reason: ' + status);
                    dfrd.reject(new Error(status));
                }
            });
        }).promise();
    };

     // Get the address component from the Google Map Place Object
     // These include, locality (city), Administrative Area (province), country etc
    googleMaps.getAddressComponent = function(place, key){
        var addressComponents = place.address_components;
        var x;
        for (x in addressComponents) {
            var arrayKey = addressComponents[x];
            var componentName = arrayKey.types[0];

            if (key == componentName){
                return {long_name: addressComponents[x].long_name, short_name: addressComponents[x].short_name}
            }
        }
        return false;
    };

    // Get the long / full name of the city from the Google Place Object
    googleMaps.getCityLongName = function(place){
        var result = googleMaps.getAddressComponent(place, 'locality');
        return result.long_name;
    }

    // Get the long / full name of the Province / state from the Google Place Object
    googleMaps.getAdministrativeAreaLongName = function(place){
        var result = googleMaps.getAddressComponent(place, 'administrative_area_level_1');
        return result.long_name;
    }

    // Get the long / full name of the country from the Google Place Object
    googleMaps.getCountryLongName = function(place){
        var result = googleMaps.getAddressComponent(place, 'country');
        return result.long_name;
    }

    // Get the short / abreviated name of the city from the Google Place Object
    googleMaps.getCityShortName = function(place){
        var result = googleMaps.getAddressComponent(place, 'locality');
        return result.short_name;
    }

    // Get the short / abreviated name of the province / state from the Google Place Object
    googleMaps.getAdministrativeAreaShortName = function(place){
        var result = googleMaps.getAddressComponent(place, 'administrative_area_level_1');
        return result.short_name;
    }

    // Get the short / abreviated name of the country from the Google Place Object
    googleMaps.getCountryShortName = function(place){
        var result = googleMaps.getAddressComponent(place, 'country');
        return result.short_name;
    }

    /**
     * ///  LAT/LNG
     * ///////////////////////////////////////////////////////
     */
    
    // Get the latitude and longitude from a place id
    googleMaps.getCoordinatesFromPlace = function (place){
        return place.geometry.location;
    }

    // Get the zoom level and viewport boundarys for a screen from the place id
    googleMaps.getViewportFromPlace = function (place){
        return place.geometry.viewport;
    }

    // Set the zoom level of the map to encompass only this location / place id
    googleMaps.zoomToCoordinates = function (map, location, zoom = 8){
        map.setCenter(location);
        map.setZoom(zoom);
    }

    // Set the bounds of the map and zoom into them
    googleMaps.zoomToBounds = function (map, bounds){
        map.fitBounds(bounds);
        var thisEvent = google.maps.event.addListener(map, 'idle', function(){
            var zoom = map.getZoom();
            var newZoom = parseInt(zoom + 1);
            map.setZoom(newZoom);
            
            google.maps.event.removeListener(thisEvent);
        });
    }

    // Draw the bounds on the map so they are visible
    googleMaps.drawBounds = function (map, bounds){
        var viewportBox;
        google.maps.event.addListener(map, 'idle', function(event) {
            var ne = new google.maps.LatLng(bounds.north, bounds.east);
            var sw = new google.maps.LatLng(bounds.south, bounds.west);

            var viewportPoints = [
                ne, new google.maps.LatLng(ne.lat(), sw.lng()),
                sw, new google.maps.LatLng(sw.lat(), ne.lng()), ne
            ];
            /*strokeOpacity = 0 , if don't want to show the border moving. */
            if (viewportBox) {
                viewportBox.setPath(viewportPoints);
            } else {
                viewportBox = new google.maps.Polyline({
                    path: viewportPoints,
                    strokeColor: '#FF0000',
                    strokeOpacity: 1.0,
                    strokeWeight: 4 
                });
                viewportBox.setMap(map);
            };
        });
    }

    /**
     * ///  AUTOCOMPLETE SEARCH
     * ///////////////////////////////////////////////////////
     */

    // When a user selects an auto complete option from the quick search input
    // add the marker to the map
    googleMaps.autoCompleteAddMarker = function(that, map) {
        var place = that.getPlace();
        var location = googleMaps.getCoordinatesFromPlace(place);
        var marker = googleMaps.placeMarker(map, location);

        googleMaps.zoomToCoordinates(map, location);
        googleMaps.clearMarkers();

        return marker;
    };

    // Add the search input text field into the map object
    googleMaps.createSearchInputOnMap = function (map, mapDivId){
        var mapDiv = document.getElementById( mapDivId );
        var input = document.createElement('input')
        input.id = 'autoCompleteSearch';
        input.type = 'text';
        input.className = 'auto-complete-search'; // set the CSS class
        input.placeholder = 'Type your location here ...';
        input.style.width = "50%";
        input.style.height = "30px";
        input.style.margin = "15px";
        input.style.padding = "0px 10px";
        document.body.appendChild(input); // put it into the DOM

        // Add input into the map viewport and position
        map.controls[google.maps.ControlPosition.TOP_LEFT].push(input);

        return input;
    }

    /**
     * Add an search input box onto the map and hook into the autocomplete library
     * NOTE: BE SURE TO HAVE THE REQUIRED PARAMS IN THE GOOGLE SCRIPT LOAD. libraries=places 
     * @param     object    map         The map object that was created
     * @param     string    mapDivId    The id of the map div
     * @param     string    inputId     The id of autocomplete input. If none is defined then we will make one
     * @return    void
     */
    googleMaps.autoCompleteSearch = function (map, mapDivId, callback, inputId) {
        // Create search input on the fly
        
        // If there is no inputId given for a custom autocomplete input then lets make a basic one
        if (typeof inputId == 'undefined'){            
            var input = googleMaps.createSearchInputOnMap(map, mapDivId);
        } else {
            var input = document.getElementById(inputId);
        }

        // Setup autocomplete for search and return results
        var autoComplete = new google.maps.places.Autocomplete(input);

        if (typeof callback !== 'undefined' && callback !== null){
            autoComplete.addListener('place_changed', callback);

        } else {
            //googleMaps.autoCompleteAddMarker.bind(this, map);
            autoComplete.addListener('place_changed', function(){
                return googleMaps.autoCompleteAddMarker(this, map);
            });
        }
    }

    /**
     * ///  MENUS
     * ///////////////////////////////////////////////////////
     */

    // Add the HTML DOM elements created to the Google Maps Object
    googleMaps.displayMarkerMenu = function (map){
        markerMenu.style.display = "block";
        markerMenu.style.margin = "10px";
        map.controls[google.maps.ControlPosition.RIGHT_TOP].push(markerMenu);
    }

    /**
     *
     * ///  GEOLOCATION
     * ///////////////////////////////////////////////////////
     */

    // Handle how errors are displayed to the user when the geolocation methods fail
    googleMaps.handleLocationError = function (browserHasGeolocation, pos) {
        $.niftyNoty({
            type: 'warning',
            container : "floating",
            title : 'The Geolocation service failed',
            message : 'Your browser doesn\'t support geolocation.',
            closeBtn : false,
            timer : 5000
        });
    }

    // Try and geolocate a user based on their browser data
    googleMaps.geoLocate = function (map) {
        // Try HTML5 geolocation.
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(function(position) {
                var pos = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };

                map.setCenter(pos);
            }, function() {
                googleMaps.handleLocationError(true, map.getCenter());
            });
        } else {
            // Browser doesn't support Geolocation
            googleMaps.handleLocationError(false, map.getCenter());
        }
    }

    /**
     * ///  INITIALIZATIONS
     * ///////////////////////////////////////////////////////
     */

    // Create the map on the screen with our options
    googleMaps.initMap = function (mapDivId, initOptions){
        // Declare our default view settings
        if (typeof initOptions == 'undefined'){

            var initOptions = {
                center: {lat: 43, lng: 12},
                zoom: 2,
                mapTypeId: 'satellite',
                scrollwheel: false
            };
        }

        googleMaps[mapDivId] = new google.maps.Map(document.getElementById( mapDivId ), initOptions);
        //googleMaps.geoLocate(googleMaps[mapDivId]);
        //googleMaps.autoCompleteSearch(googleMaps[mapDivId], mapDivId);

        googleMaps.displayMarkerMenu(googleMaps[mapDivId]);

        document.body.dispatchEvent(loadedEvent);
    };
    window.googleMaps = googleMaps;

    google.maps.Polygon.prototype.getBounds = function() {
        var bounds = new google.maps.LatLngBounds();
        var paths = this.getPaths();
        var path;        
        for (var i = 0; i < paths.getLength(); i++) {
            path = paths.getAt(i);
            for (var ii = 0; ii < path.getLength(); ii++) {
                bounds.extend(path.getAt(ii));
            }
        }
        return bounds;
    }
    
}