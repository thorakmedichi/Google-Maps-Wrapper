'use strict';

;
/**
 * @file Custom Google Maps integrations for Sketchpad Travel specific UX
 * @author Ryan Stephens <ryan@sketchpad-media.com>
 * @version 0.5
 *
 * 
 * This will only load after the google-maps.js has completed its initilization 
 * as noted by the load event at the bottom of this file
 */
var googleMapsIntegration = function () {

    var imagePath = '/img/google-maps-icons/';

    /**
     * Define the marker objects to be used by the system 
     * @type    Marker Object
     */
    googleMaps.genericMarkerIcon = {
            url: imagePath + 'generic-marker.png',
            size: new google.maps.Size(40, 40),
            origin: new google.maps.Point(0, 0),
            anchor: new google.maps.Point(20, 40),
            optimized: false,
            zIndex: 100
        };

	googleMaps.selectedMarkerIcon = {
            url: imagePath + 'selected-marker.png',
            size: new google.maps.Size(40, 40),
            origin: new google.maps.Point(0, 0),
            anchor: new google.maps.Point(20, 40),
            optimized: false,
            zIndex: 1000
        };

    googleMaps.selectedMatchMarkerIcon = {
            url: imagePath + 'selected-swapmatch-marker.png',
            size: new google.maps.Size(40, 40),
            origin: new google.maps.Point(0, 0),
            anchor: new google.maps.Point(20, 40),
            optimized: false,
            zIndex: 1000
        };

    googleMaps.homeMarkerIcon = {
            url: imagePath + 'home-green.png',
            size: new google.maps.Size(32, 37),
            origin: new google.maps.Point(0, 0),
            anchor: new google.maps.Point(16, 37),
            optimized: false,
            zIndex: 10000
        };

    googleMaps.workMarkerIcon = {
            url: imagePath + 'briefcase-orange.png',
            size: new google.maps.Size(32, 37),
            origin: new google.maps.Point(0, 0),
            anchor: new google.maps.Point(16, 37),
            optimized: false,
            zIndex: 10000
        };

    googleMaps.matchMarkerIcon = {
            url: imagePath + 'match-marker.png',
            size: new google.maps.Size(40, 40),
            origin: new google.maps.Point(0, 0),
            anchor: new google.maps.Point(20, 40),
            optimized: false,
            zIndex: 10000
        };

    googleMaps.alternateMarkerIcon = {
            url: imagePath + 'alternate-marker.png',
            size: new google.maps.Size(40, 40),
            origin: new google.maps.Point(0, 0),
            anchor: new google.maps.Point(20, 40),
            optimized: false,
            zIndex: 10
        };

    /**
     * Google Map native event listeners
     */
    var mapViewportSettings = function (that){
        var bounds = that.getBounds();
        var center = that.getCenter();
        var zoom = that.getZoom();

        var swEl = document.getElementById( 'bounds' );
        if (swEl) swEl.value = JSON.stringify(bounds);

        var centerEl = document.getElementById( 'center' );
        if (centerEl) centerEl.value = JSON.stringify(center);

        var zoomEl = document.getElementById( 'zoom' );
        if (zoomEl) zoomEl.value = JSON.stringify(zoom);
    };

    if (googleMaps.map){
        google.maps.event.addListener(googleMaps.map, 'bounds_changed', function(){
            mapViewportSettings(this);
        });
    }
};

document.body.addEventListener("googleMapsLoaded", googleMapsIntegration, false);
