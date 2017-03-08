;

/**
 * @file Custom Google Maps integrations for Close Commute specific UX
 * @author Ryan Stephens <ryan@sketchpad-media.com>
 * @version 0.5
 *
 * 
 * This will only load after the google-maps.js has completed its initilization 
 * as noted by the load event at the bottom of this file
 */
var placeIntegrations = function(){
    const daysPerYear = window.commuteConstants.workdaysPerYear.value;
    const modeSettings = window.commuteConstants.modeSettings;

    var homeMarker;
    var workMarker;

    /**
     * Display the home marker on the map and set its address in the infoWindow if they click the marker
     * @return    void    
     */
    var displayHomeMarker = function(){
        let homeData = window.homeData;
        let homeLocation = new google.maps.LatLng(homeData.lat, homeData.lng);
        let infoWindowContent = '<h4>Home</h4>'+ homeData.address +', '+ homeData.city +'<br/>';

        homeMarker = googleMaps.placeMarker(googleMaps.map, homeLocation, googleMaps.homeMarkerIcon);

        googleMaps.markerClickInfoWindow(googleMaps.map, homeMarker, function(){ 
            return $.Deferred(function (dfrd) {
                dfrd.resolve(infoWindowContent);
            }).promise();
        });
    };

    /**
     * Display the work marker on the map, set its address and give the user some data about
     * daily and yearly commute distances and times in the infoWindow if they click the marker
     * @return    void
     */
    var displayWorkMarker = function(){
        let workData = window.workData;
        let workLocation = new google.maps.LatLng(workData.lat, workData.lng);
        let infoWindowContent = ''+
            '<h4>Work</h4>'+ 
            '<strong>'+ employer +'</strong><br/>'+
            workData.address +', '+ workData.city +'<hr/>'+
            '<strong>Total Daily</strong><br/>'+
            commuteData.total.daily.distance.text +', '+ commuteData.total.daily.duration.text +'<br/><br/>'+
            '<strong>Total Yearly</strong><br/>'+
            commuteData.total.yearly.distance.text +', '+ commuteData.total.yearly.duration.text +' plus<br/>'+
            commuteData.total.yearly.vehicleOperatingCosts +', '+ commuteData.total.yearly.co2Emissions +' equiv.<br/>'+
            '<small>All values are approximate (see <a href="/assumptions" target="_blank"><i>assumptions</i></a>)</small>';

        workMarker = googleMaps.placeMarker(googleMaps.map, workLocation, googleMaps.workMarkerIcon);
        
        googleMaps.markerClickInfoWindow(googleMaps.map, workMarker, function(){ 
            return $.Deferred(function (dfrd) {
                dfrd.resolve(infoWindowContent);
            }).promise();
        });
    };

    /**
     * Display the homeMarker and workMarker along with the shortest commute path on the map
     * @return    void    
     */
    var displayCurrentCommute = function(){
        let commuteData = window.commuteData;
        displayHomeMarker();
        displayWorkMarker();

        googleMaps.getDirections(googleMaps.map, homeMarker.position, workMarker.position, commuteData.mode);
    };

    /**
     * Update the postData object so it contains all the  distance information from home to this location
     * @param     string    thisPlaceId     The google place id for this location
     * @param     object    distance        The distance object that stores info like km from home to this location
     * @param     object    duration        The duration object that stores infor like time in minutes or hours from home to this location
     * @return    void                    
     */
    var updatePostDataCommute = function(thisPlaceId, thisCommute){
        var currentCommute = commuteData.total;

        // We need to set the distance and duration seperate from the savings 
        // This is because we need these two options available and ready in 
        // the postData array when we call calculateSavings.
        postData[thisPlaceId].commute = {
            distance: thisCommute.distance, 
            duration: thisCommute.duration,
        };

        postData[thisPlaceId].commute.savings = calculateSavings(thisPlaceId);
    };

    /**
     * Get the distance and duration from the users home location to the selected work location
     * @param     object    map                   Google Maps map object
     * @param     object    homeMarkerPosition    Google Maps Lat Lng object
     * @param     object    workLocation          Google Maps Lat Lng object
     * @param     string    travelMode            Google Maps travel mode (DRIVING, TRANSIT, BICYCLE, WALKING)
     * @param     object    departureTime         Javascript Date object
     * @return    void                          
     */
    var getDistanceInformation = function (map, homeMarkerPosition, workLocation, travelMode, departureTime){
        if (typeof mode == 'undefined') {
            var mode = 'DRIVING';
        }

        return $.Deferred(function (dfrd) {
            googleMaps.getDirections(map, homeMarkerPosition, workLocation, travelMode, departureTime)
                .done(function(response){
                    let distance = googleMaps.computeTotalDistance(response);
                    let duration = googleMaps.computeTotalDuration(response);

                    dfrd.resolve({distance: distance, duration: duration, directions: response});
                });
        }).promise();
    };

    /**
     * Get the distance data from home to this location and back again
     * If this is the first time selecting this marker then query the google DistanceService API to get the data
     * If this is the first time save the data from the DistanceService API in the marker object
     * If this is a repeat occurance then just access the data from the marker object
     * @param     string    thisPlaceId     The google place id for this location
     * @return    bool                      Did we have to query the API or did it exist in the marker object
     */
    var getTotalDailyDistanceInformation = function(thisPlaceId){
        let marker = findMarkerByPlaceId(thisPlaceId);
        let workLocation = new google.maps.LatLng(postData[thisPlaceId].lat, postData[thisPlaceId].lng);

        return $.Deferred(function (dfrd) {
            // If we already polled the API during this page visit then use our temporary cached information
            if (typeof marker.directionComputed !== 'undefined'){
                updatePostDataCommute(thisPlaceId, marker.directionComputed.dailyCommute);

                // Update the visual route on the map
                googleMaps.directionsDisplay.setDirections(marker.directionService);

                dfrd.resolve(false);
                return;
            }

            // Create a departure time of next Friday at the users workEnd time
            // This gives us what is probably the busiest time for trafic
            var departureTime = getNextDayOfWeek(Date.now(), 5);
            changeTimeOfDateObject(departureTime, workTimes.workEnd);

            // If we havent already polled the API for this marker then lets send a request to the DirectionService API
            getDistanceInformation(googleMaps.map, homeMarker.position, workLocation, marker.travelMode)
                .done(function(toWorkDistanceData){
                    getDistanceInformation(googleMaps.map, homeMarker.position, workLocation, marker.travelMode, departureTime)
                        .done(function(toHomeDistanceData){
                            var dailyCommute = {
                                distance: googleMaps.metersToKm(toWorkDistanceData.distance.value + toHomeDistanceData.distance.value),
                                duration: googleMaps.secondsToHrsAndMinutes(toWorkDistanceData.duration.seconds + toHomeDistanceData.duration.seconds)
                            };

                            updatePostDataCommute(thisPlaceId, dailyCommute);

                            // Add this data to the actual marker as a form of short term cache
                            marker.directionComputed = {dailyCommute: dailyCommute};
                            marker.directionService = toWorkDistanceData.directions;

                            dfrd.resolve(true);
                        });
                });
        }).promise();
    };
    window.getTotalDailyDistanceInformation = getTotalDailyDistanceInformation;

    /**
     * Calculates the total daily savings of both time and distance between current commute 
     * and the commute that is involved with the marker the user clicked
     * @param     object    currentCommute    The object containing all the current commute data
     * @param     object    thisCommute       The object containing all the commute data related to the selected marker
     * @return    object                      A new object containing the daily savings
     */
    var getDailySavings = function(currentCommute, thisCommute){
        var distanceSavings = googleMaps.metersToKm(currentCommute.daily.distance.value - thisCommute.distance.totalMeters);
        var durationSavings = googleMaps.secondsToHrsAndMinutes(currentCommute.daily.duration.value - thisCommute.duration.totalSeconds);

        var dailySavings = {
            distance: {
                value: distanceSavings.value,
                text: distanceSavings.text
            },
            duration: {
                value: durationSavings.totalSeconds,
                text: durationSavings.fullText
            }
        };

        return dailySavings;
    };

    /**
     * Calculates the total yealy savings of both time and distance between current commute 
     * and the commute that is involved with the marker the user clicked
     * @param     object    currentCommute    The object containing all the current commute data
     * @param     object    thisCommute       The object containing all the commute data related to the selected marker
     * @return    object                      A new object containing the yearly savings
     */
    var getYearlySavings = function(currentCommute, thisCommute){
        var distanceSavings = googleMaps.metersToKm(currentCommute.yearly.distance.value - (thisCommute.distance.totalMeters * daysPerYear));
        var durationSavings = googleMaps.secondsToHrsAndMinutes(currentCommute.yearly.duration.value - (thisCommute.duration.totalSeconds * daysPerYear));
        var modeSettings = commuteConstants.modeSettings[commuteData.mode.toLowerCase()];

        var yearlySavings = {
            distance: {
                value: distanceSavings.value,
                text: distanceSavings.text
            },
            duration: {
                value: durationSavings.totalSeconds,
                text: durationSavings.fullText
            },
            co2: {
                value: distanceSavings.value * modeSettings.co2_multiplier,
                text: ((distanceSavings.value * modeSettings.co2_multiplier).toFixed(0)) + ' MT',
            },
            cost: {
                value: (distanceSavings.value * modeSettings.cost_per_km) + parseFloat(modeSettings.misc_costs),
                text: '$'+ ((((distanceSavings.value * modeSettings.cost_per_km) + parseFloat(modeSettings.misc_costs)).toFixed(0)).toLocaleString())
            }
        };

        return yearlySavings;
    };

    /**
     * Calculate the daily distance and duration as well as
     * the yearly distance, duration, co2 and costs
     * @param     string    thisPlaceId    The Google Place Id that is attached to the selected marker
     * @return    object                   A new object with all the daily and yearly values
     */
    var calculateSavings = function(thisPlaceId){
        var thisCommute = postData[thisPlaceId].commute;
        var currentCommute = commuteData.total;
        
        var savings = {
            daily: getDailySavings(currentCommute, thisCommute),
            yearly: getYearlySavings(currentCommute, thisCommute)
        };

        return savings;
    };

    /**
     * Attach a custom infoWindow to a marker specific to saving and deleting favorites
     * @param     object    map         The map object that the marker lives on
     * @param     object    marker      The marker object we are placing on the map
     * @param     object    location    The location object given to us from Laravel
     * @return    void                
     */
    var attachMarkerInfoWindow = function(map, marker, location){
        let infoWindowContent = '<h4>'+ location.name +'</h4><br/>'+ location.vicinity +'<br/><br/>'+
            (location.saved 
            ? 
            '<button class="btn btn-sm btn-success delete-employer-location" data-placeid="'+ location.place_id +'">Remove Favorite</button>'
            :
            '<button class="btn btn-sm btn-default save-employer-location" data-placeid="'+ location.place_id +'">Mark as Favorite</button>'
            );

        // thisPlaceId is bound to the function via the chained bind method at the end of this closure function         
        googleMaps.markerClickInfoWindow(map, marker, function(thisPlaceId){
            return $.Deferred(function (dfrd) {
                getTotalDailyDistanceInformation(thisPlaceId)
                    .done(function(firstTime){
                        var commuteText = postData[thisPlaceId].commute.distance.text +', '+ postData[thisPlaceId].commute.duration.fullText;
                        var savings = postData[thisPlaceId].commute.savings;

                        // If it was the first time the distance was calculated then add the distance string
                        // If it wasnt the first time the data is cached and the infoWindowContent is already set as we need it
                        if (firstTime){
                            infoWindowContent += '<hr/><strong>Daily commute:</strong> '+ commuteText +
                                                 '<br/><strong>Would save me:</strong> ' + savings.daily.distance.text + ', ' +  savings.daily.duration.text + ' every day' +
                                                 '<br/><strong>Would save</strong> ' + savings.yearly.distance.text + ', ' +  savings.yearly.duration.text + ' plus' +
                                                 '<br/>'+ savings.yearly.cost.text + ' and ' +  savings.yearly.co2.text + ' CO2 equiv annually';
                        }
                        dfrd.resolve(infoWindowContent);
                    });
                }).promise();
        }.bind(this, location.place_id));
    };
    // Attach this function to the global googleMaps object so we can access it in other scripts
    window.googleMaps.attachMarkerInfoWindow = attachMarkerInfoWindow;

    /**
     * If the Marker is a swap match lets update the look and visibility of it
     * @param     object    marker      The marker object that exists on the map
     * @param     object    location    The location given to us from Laravel
     * @return    void                
     */
    var updateSwapMatchMarkerSettings = function(marker, location){
        // If there is a swap match change out the icon
        if (location.swapMatch){
            marker.setIcon(googleMaps.matchMarkerIcon);
            marker.setZIndex(10000);
            marker.setVisible(true);
            marker.swapMatch = true;
        }
        return marker;
    };

    /**
     * If the Location has been saved lets update the look and visibility of the marker
     * @param     object    marker      The marker object that exists on the map
     * @param     object    location    The location given to us from Laravel
     * @return    void                
     */
    var updateSavedMarkerSettings = function(marker, location){
        // If this is a location the user saved change the icon
        if (location.saved){
            marker.setIcon(googleMaps.selectedMarkerIcon);
            marker.saved = true;

            if (location.swapMatch){
                marker.setIcon(googleMaps.selectedMatchMarkerIcon);
            }
        }

        return marker;
    };

    /**
     * Attach data specific to updating this marker / location in the database
     * This is needed to save as a favorite or delete from favorites
     * It is also needed for distance data colection
     * @param    object    location    The location object give by Laravel
     */
    var setLocationPostData = function(location){
        postData[location.place_id] = {
                google_place_id:  location.place_id,
                name:             location.name,
                vicinity:         location.vicinity,
                lat:              location.geometry.location.lat,
                lng:              location.geometry.location.lng
            };
    };

    /**
     * Place and set display settings for the Alternate Workplace Locations
     * @param     object    map           The map object we are interacting with
     * @param     object    mapMarkers    The list of locations given to us by Laravel
     * @return    object                  The Marker instance on the map
     */
    var displayAlternateLocations = function(map, mapMarkers){
        return $.Deferred(function (dfrd) {
            let locations = mapMarkers.alternateLocations;
            let x;
            for (x in locations){
                // Add all the locations to the map with pins
                let markerPosition = {
                    lat: locations[x].geometry.location.lat, 
                    lng: locations[x].geometry.location.lng
                };

                let marker = googleMaps.placeMarker(map, markerPosition, googleMaps.genericMarkerIcon);

                // Add custom data to the marker for future reference
                marker.sameEmployer = true;
                marker.placeId = locations[x].place_id;
                marker.travelMode = window.commuteData.mode;

                marker.setVisible(true);

                marker = updateSwapMatchMarkerSettings(marker, locations[x]);
                marker = updateSavedMarkerSettings(marker, locations[x]);

                attachMarkerInfoWindow(map, marker, locations[x]);
                setLocationPostData(locations[x]);
            }
            dfrd.resolve(true);
        }).promise();
    };

    /**
     * Place and set display settings for the Alternate Employer Locations
     * @param     object    map           The map object we are interacting with
     * @param     object    mapMarkers    The list of locations given to us by Laravel
     * @return    object                  The Marker instance on the map
     */
    var displayAlternateEmployers = function(map, mapMarkers){
        return $.Deferred(function (dfrd) {
            let locations = mapMarkers.alternateEmployers;
            let x;
            for (x in locations){
                // Add all the locations to the map with pins
                let markerPosition = {
                    lat: locations[x].geometry.location.lat, 
                    lng: locations[x].geometry.location.lng
                };

                let marker = googleMaps.placeMarker(map, markerPosition, googleMaps.alternateMarkerIcon);

                // Add custom data to the marker for future reference
                marker.sameEmployer = false;
                marker.placeId = locations[x].place_id;
                marker.travelMode = window.commuteData.mode;

                marker.setVisible(false);

                marker = updateSwapMatchMarkerSettings(marker, locations[x]);
                marker = updateSavedMarkerSettings(marker, locations[x]);

                attachMarkerInfoWindow(map, marker, locations[x]);
                setLocationPostData(locations[x]);
            }

            dfrd.resolve(true);
        }).promise();
    };

    /**
     * Place and set display settings for the Custom Favorite Locations
     * @param     object    map           The map object we are interacting with
     * @param     object    mapMarkers    The list of locations given to us by Laravel
     * @return    object                  The Marker instance on the map
     */
    var displayCustomEmployers = function(map, mapMarkers){
        return $.Deferred(function (dfrd) {
            let locations = mapMarkers.savedLocations;
            let x;
            for (x in locations){

                // Skip any of the saved ones that already appear in the AlternateLocations or AlternatEmployers
                if (typeof postData[locations[x].google_place_id] !== 'undefined'){
                    continue;
                }

                locations[x].saved = true;
                locations[x].place_id = locations[x].google_place_id;
                locations[x].geometry = {
                    location: {
                        lat: locations[x].lat,
                        lng: locations[x].lng
                    }
                };

                // Add all the locations to the map with pins
                let markerPosition = {
                    lat: locations[x].geometry.location.lat, 
                    lng: locations[x].geometry.location.lng
                };

                let marker = googleMaps.placeMarker(map, markerPosition, googleMaps.selectedMarkerIcon);

                // Add custom data to the marker for future reference
                marker.sameEmployer = false;
                marker.placeId = locations[x].place_id;
                marker.travelMode = window.commuteData.mode;

                marker.setVisible(true);

                marker = updateSavedMarkerSettings(marker, locations[x]);

                attachMarkerInfoWindow(map, marker, locations[x]);
                setLocationPostData(locations[x]);
            }

            dfrd.resolve(true);
        }).promise();
    };

    /**
     * Display all the alternate location markers
     * This includes alternate branches as well as alternate employers
     * Swap Matches will be seperated out as their own marker / pin regardless of employer
     * The infoWindow content will also be set to assign itself when the marker is clicked so it can get current distance data
     * @param     object    mapMarkers    The dataset of markers exposed in the window scope via PHP
     * @return    void                  
     */
    var displayAllLocations = function(mapMarkers){
        displayAlternateLocations(googleMaps.map, mapMarkers)
            .done(function(){
                displayAlternateEmployers(googleMaps.map, mapMarkers)
                    .done(function(){
                        displayCustomEmployers(googleMaps.map, mapMarkers);
                    });
            });
    };

    /**
     * Change the icons on the custom menu items that we added to the google map
     * The icons denote wether the markers are visible or not
     * @param     jQuery object    $this    The DOM element that was clicked
     * @return    void             
     */
    var toggleMapMarkMenuIcon = function($this){
        if ($this.hasClass('fa-eye')){
            $this.removeClass('fa-eye');
            $this.addClass('fa-ban');
        } else {
            $this.removeClass('fa-ban');
            $this.addClass('fa-eye');
        }
    };

    /**
     * Find a google maps marker based on the placeId passed to the function
     * @param     string    placeId    The google maps place id for a location
     * @return    object               The marker object that matches this place
     */
    var findMarkerByPlaceId = function(placeId){
        let x;
        for (x in googleMaps.markers){
            let marker = googleMaps.markers[x].marker; 
            let markerPlaceId = marker.placeId;

            if (placeId == markerPlaceId){
                return marker;
            }
        }
    };

    /**
     * Make the pin bounce on the map cause its cool
     * @param     string    placeId    The google maps place id for this location
     * @param     bool      $bounce    true / false should the pin bounce
     * @return    void               
     */
    var bouncePin = function (placeId, $bounce){
        let marker = findMarkerByPlaceId(placeId);
        if ($bounce){
            marker.setAnimation(google.maps.Animation.BOUNCE);
        } else {
            marker.setAnimation(null); 
        }
    };

    /**
     * Update the DOM to show a save or remove button depending on parameters
     * Also update the pin to show its saved status or not
     * @param     jQuery object    $this       The DOM element we need to update
     * @param     bool             saveable    true / false state the button is currently in
     * @return    void                
     */
    var toggleSaveDeleteButton = function($this, saveable){
        if (saveable){
            $this.addClass('btn-success');
            $this.removeClass('btn-default');
            $this.addClass('delete-employer-location');
            $this.removeClass('save-employer-location');
            $this.text('Remove Favorite');
            
            googleMaps.selectedMarker.setIcon(googleMaps.selectedMarkerIcon);
        } else {
            $this.addClass('btn-default');
            $this.removeClass('btn-success');
            $this.addClass('save-employer-location');
            $this.removeClass('delete-employer-location');
            $this.text('Mark as Favorite')

            googleMaps.selectedMarker.setIcon(googleMaps.genericMarkerIcon);
        }
    }


    /**
     * Update the infoWindows and list-view save and remove buttons
     * @param     jQuery objext    $this    The DOM element that initiated the event
     * @return    void             
     */
    var toggleSaveDelete = function($this){
        var saveable = $this.hasClass('save-employer-location');

        let thisPlaceId = $this.data('placeid');
        let marker = findMarkerByPlaceId(thisPlaceId);

        // Handle all the infoWindows, open or closed
        var infoWindowContent = googleMaps.infoWindow.getContent();

        infoWindowContent = $('<div />',{html:infoWindowContent}); // Convert string to jQuery object
        if (saveable){
            toggleSaveDeleteButton(infoWindowContent.find('button.save-employer-location'), saveable);
        } else {
            toggleSaveDeleteButton(infoWindowContent.find('button.delete-employer-location'), saveable);
        }
        infoWindowContent = infoWindowContent.prop('outerHTML'); // Convert jQuery object to string

        googleMaps.markerClickInfoWindow(googleMaps.map, marker, function(){ // This will handle all the closed windows
            return $.Deferred(function (dfrd) {
                dfrd.resolve(infoWindowContent);
            }).promise();
        });

        googleMaps.infoWindow.setContent(infoWindowContent); // This will handle the open windows
        googleMaps.infoWindow.open(googleMaps.map, marker); // This refreshes and moves the window to the selected marker

        // Handle all the list view items no matter what tab
        $('.list-view li').each(function(index){
            let aPlaceId = $(this).data('placeid');

            if (aPlaceId == thisPlaceId){
                toggleSaveDeleteButton($(this).find('button'), saveable);
            }
        });
    };

    var moveDomElementToTop = function(googlePlaceId){
        var listingElement = $('li[data-placeid="'+ googlePlaceId +'"]');
        var savedList = $('ul.saved-locations');
        var listing = listingElement.detach();
        var thisPostData = postData[googlePlaceId]
        var savingsHtml =   '<small>' +
                               'Would save: '+ thisPostData.commute.savings.yearly.distance.text +', '+ thisPostData.commute.savings.yearly.duration.text +' plus operating costs of '+ thisPostData.commute.savings.yearly.cost.text +' and '+ thisPostData.commute.savings.yearly.co2.text +' CO2 yearly' +
                            '</small>';

        var takeActionButton = $('a.take-action:first').clone();
        takeActionButton.removeClass('btn-sm');
        takeActionButton.addClass('btn-xs');
        takeActionButton.removeClass('take-action');
        takeActionButton.addClass('take-action-sm');
        takeActionButton.attr('style', '');

        listing.find('button').after(takeActionButton);
        listing.find('.would-save').html(savingsHtml);

        savedList.prepend(listing);
    };

    var moveDomElementToBottom = function(googlePlaceId){
        var listingElements = $('li[data-placeid="'+ googlePlaceId +'"]');
        var savedList = $('ul.saved-locations');
        var listingGroup = listingElements.data('group');

        listingElements.remove();
        
        $('#' + listingGroup + ' ul.saved-locations').next('ul').prepend(listingElements[0]);
    };

    /**
     * Save the location and everything we know about it to the users favorites in the database
     * If we currently dont have the distance data make sure we grab that first
     * EXPOSED TO THE GLOBAL SCOPE
     * @param     jQuery Object    $this    The DOM element that initiated this request
     * @return    void             
     */
    var saveEmployerLocation = function($this){
        $('.delete-employer-location').prop('disabled', true);
        $('.save-employer-location').prop('disabled', true);

        var googlePlaceId = $this.data('placeid');

        googleMaps.infoWindow.close();
        googleMaps.selectedMarker = findMarkerByPlaceId(googlePlaceId); // Used by toggleSaveDeleteButton()

        // We need to trigger the marker click event so that the callback function is called
        // This callback function is needed because it gets the distance and displays the contents of the infoWindow
        var marker = googleMaps.selectedMarker;
        new google.maps.event.trigger( marker, 'click' );

        // Only save the location when we have results from the google distance API
        // and the results have been saved to our marker object
        getTotalDailyDistanceInformation(googlePlaceId)
            .done(function(firstTime){
                let thisPostData = postData[googlePlaceId];
                $.post("/post/json/employer-location/store", thisPostData)
                    .always(function(){
                        $('.delete-employer-location').prop('disabled', false);
                        $('.save-employer-location').prop('disabled', false);
                    })
                    .done(function(result, textStatus, xhr){
                        switch(xhr.status){
                            case 201:
                                toggleSaveDelete($this);
                                moveDomElementToTop(googlePlaceId);
                                break;
                        }
                    })
                    .fail(function(xhr, textStatus, error){
                        return false;
                    });
            }).promise(); 
    };
    window.saveEmployerLocation = saveEmployerLocation;

    /**
     * Remove the location from the users list of favorites in the database
     * EXPOSED TO THE GLOBAL SCOPE
     * @param     jQuery Object    $this    The DOM element that initiated this request
     * @return    void             
     */
    var deleteEmployerLocation = function($this){
        $('.delete-employer-location').prop('disabled', true);
        $('.save-employer-location').prop('disabled', true);
        //googleMaps.infoWindow.close();

        var googlePlaceId = $this.data('placeid');

        var thisPostData = postData[$this.data('placeid')];
        googleMaps.selectedMarker = findMarkerByPlaceId(thisPostData.google_place_id);

        $.post("/post/json/employer-location/delete", thisPostData)
                .always(function(){
                    $('.delete-employer-location').prop('disabled', false);
                    $('.save-employer-location').prop('disabled', false);
                })
                .done(function(result, textStatus, xhr){
                    switch(xhr.status){
                        case 201:
                            toggleSaveDelete($this);  
                            moveDomElementToBottom(googlePlaceId);
                            $('li[data-placeid="' + googlePlaceId + '"] a.take-action-sm').remove();
                            $('li[data-placeid="' + googlePlaceId + '"] .would-save').html('');                   
                            break;
                    }
                })
                .fail(function(xhr, textStatus, error){
                    return false;
                });

    };
    window.deleteEmployerLocation = deleteEmployerLocation;

    /**
     * This is the init() function that will display all the markers on the map, once loaded
     * EXPOSED TO THE GLOBAL SCOPE
     * @param     Object    mapMarkers    The set of markers genereated by PHP for work locations
     * @return    void                  
     */
    var displayMapMarkers = function(mapMarkers){  
        displayAllLocations(mapMarkers);
        displayCurrentCommute();

        googleMaps.map.fitBounds(googleMaps.markerBounds);
    };
    window.displayMapMarkers = displayMapMarkers;


    /**
     * ------------------------------------------------------------------------
     * DOM LOADED JQUERY EVENT HANDLERS
     * ------------------------------------------------------------------------
     */
    $(function () {
        $(document).on('click', '#showEmployerLocations', function(){
            googleMaps.toggleMarkerVisibility(function(marker){ return marker.sameEmployer === true && !marker.swapMatch && !marker.saved; });
            toggleMapMarkMenuIcon($(this));
        });

        $(document).on('click', '#showWorkplaceTypeLocations', function(){
            googleMaps.toggleMarkerVisibility(function(marker){ return marker.sameEmployer === false && !marker.swapMatch && !marker.saved; });
            toggleMapMarkMenuIcon($(this));
        });

        $('.list-location').on('mouseenter', function(){
            let placeId = $(this).data('placeid');
            bouncePin(placeId, true)
        });

        $('.list-location').on('mouseleave', function(){
            let placeId = $(this).data('placeid');
            bouncePin(placeId, false)
        });


        $(document).on('click', '.save-employer-location', function(event){
            event.preventDefault();
            saveEmployerLocation($(this));
        });

        $(document).on('click', '.delete-employer-location', function(event){
            event.preventDefault();
            deleteEmployerLocation($(this));
        });

    });
}

document.body.addEventListener("googleMapsLoaded", placeIntegrations, false);