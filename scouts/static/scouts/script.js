var is_authenticated = false;
var user_id = undefined;
var user_unit_id = undefined;
var is_commander = false;

var auto_fit_bounds = true;

var user_location_marker = undefined;
var dest_popup = undefined;

var map = undefined;

const unitInfo = {};

const scoutsCoord = {};
const markersCoord = {};

const scoutsLayers = {};

var scout_id_to_set_dest = undefined;
var scout_id_to_send_message = undefined;

// markers by unit only
var markersFeatures = [];
var markers = undefined;

// Dictionary to store popups with message IDs
var messages_popups = {};

document.addEventListener('DOMContentLoaded', function () {

  //simulator logic 
  simulatorStartBtn = document.querySelector('#start-simulator');
  simulatorStopBtn = document.querySelector('#stop-simulator');

  if (!!simulatorStartBtn) {
    simulatorStartBtn.addEventListener('click', () => {

      //to see simulated relative movement start from any other user position (ideally two users)
      let startLatLng = scoutsCoord[user_id];

      for (const key of Object.keys(scoutsCoord)) {
        if (key != user_id) {
          startLatLng = scoutsCoord[key];
          break;
        }
      };

      start_simulator(startLatLng.lat, startLatLng.lng);

      //need to cal again as it's been listening to default geo position
      map.locate({ watch: true, setView: false, maxZoom: 20, maximumAge: 1000, enableHighAccuracy: true });
      simulatorStartBtn.style.display = 'none';
      simulatorStopBtn.style.display = 'block';

    });
  }

  //auto zoom to all button and switch
  document.getElementById('zoom-to-all').addEventListener('click', ()=> setBounds(true));
  document.getElementById('autoFitBoundsSwitch').addEventListener('change', function () {
    auto_fit_bounds = this.checked;
    setBounds();
  });


  //Leaflet's map init
  map = L.map('map', { closePopupOnClick: false }).setView([0, 0], 0);

  var CartoDB_VoyagerNoLabels = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 20
  }).addTo(map);

  is_authenticated = document.querySelector('#user-span').dataset.is_authenticated === 'True';

  if (is_authenticated)
    user_id = parseInt(document.querySelector('#user-span').dataset.user_id);

  init();

  map.on('click', onMapClick);

  if (is_authenticated) {
    map.locate({ watch: true, setView: false, maxZoom: 20, maximumAge: 1000, enableHighAccuracy: true });

    map.on('locationfound', onLocationFound);

    map.on('locationerror', (e) => {
      const accuracy = document.querySelector('#accuracy');
      accuracy.classList.remove('alert-success');
      accuracy.classList.add('alert-danger');
      accuracy.innerHTML = `Your app might not work correclty. Try to enable/re-enable geolocation: ${e.message}`;
    });
  }

});


function markMessageAsRead(message_id) {
  fetch('/mark-message-read', {
    method: 'PUT',
    body: JSON.stringify({
      message_id,
    })
  })
    .then(response => response.json())
    .then(result => {
      if (!!result.error) {
        console.warn(result.error);
      } else {
        map.closePopup(messages_popups[message_id]);
        var messageElement = document.getElementById(`message-text-${message_id}`);
        messageElement.classList.remove('message-unread');
        messageElement.classList.add('message-read');
        document.querySelector(`[data-message_id="${message_id}"]`).remove();
      }
    })
    .catch(error => console.warn(error))
    ;
}

function updateScoutFeature(unit_id, scout_id, scout_name, scout_latlng) {

  const latlng = L.latLng(scout_latlng);
    
  const layer = scoutsLayers[unit_id];

  let featureExists = false;

  layer.eachLayer(function(featureLayer) {
    if (featureLayer.feature.id === scout_id) {
      // Update the feature's geometry
      featureLayer.feature.geometry.coordinates = [latlng.lng, latlng.lat];
      featureLayer.setLatLng(latlng);
      featureExists = true;
      return;
    }
  });

  // create new
  if (!featureExists) {
    var popupContent = `<b>${scout_name}</b> <div class="mx-2"> team: <b> ${unitInfo[unit_id].title} </b> commander: <b> ${unitInfo[unit_id].commander_name} </b> </div>`;

    // send message and commander allocate destination inside unit only
    if (unit_id === user_unit_id) {

      //only commander can set destination 
      if (is_commander)
        popupContent += `<button class="btn btn-sm btn-primary m-1" onclick="chooseDestination(${scout_id})"> Set Destination </button>`;

      if (is_authenticated)
        popupContent += `<button class="btn btn-sm btn-primary m-1" onclick="sendMessage(${scout_id})"> Message </button>`;
    }

    const feature = {
      type: 'Feature',
      id: scout_id,
      name: scout_name,
      properties: {
        tooltipContent: `<b>${scout_name}</b>`,
        popupContent: popupContent,
      },
      geometry: {
        type: 'Point',
        coordinates: [latlng.lng, latlng.lat],
      },
    };
    
    layer.addData(feature);
  } 

  scoutsCoord[scout_id] = latlng;
};

function updateMarkerFeature(marker_id, marker_title, marker_latlng, need_confirmation) {

  //note: only destination marker implementated so far

  const latlng = L.latLng(marker_latlng);

  const feature = {
    type: 'Feature',
    id: marker_id,
    name: marker_title,
    properties: {  
      popupContent: `<b>${marker_title}</b> Destination`,
      tooltipContent: `<b class="destination-tooltip">${marker_title}</b>`,
    },
    geometry: {
      type: 'Point',
      coordinates: [latlng.lng, latlng.lat],
    },
  };

  //note: full replace , - it's different than scouts update where perfomance more critical 
  markers.clearLayers();

  replaceFeatureById(markersFeatures, marker_id, feature);

  markers.addData(markersFeatures);

  markersCoord[marker_id] = latlng;

  // need confirmation eg. Destination marker 
  if(need_confirmation){
    //close previous popup
    if(dest_popup){
      map.closePopup(dest_popup); 
    }    

    const content = `New Destination Appointed <button class="btn btn-sm btn-primary" onclick="confirmDestination(${marker_id})">Confirm</button>`;
    const popup = L.popup(latlng, {content: content,  autoClose: false, closeButton: false, keepInView: true }).openOn(map);
    dest_popup = popup;
  }
};

function confirmDestination(marker_id) {
  fetch('/confirm-destination', {
    method: 'PUT',
    body: JSON.stringify({
      marker_id,
    })
  })
    .then(response => response.json())
    .then(result => {
      if (!!result.error) {
        console.warn(result.error);
      } else {
        console.log(result);
        map.closePopup(dest_popup);
        dest_popup = null;
        setBounds();
      }
    })
    .catch(error => console.warn(error))
    ;
}

function sendMessage(scout_id) {
  const edit = document.querySelector('#message-new');
  const input = document.querySelector('#message-input');
  edit.classList.remove('d-none');
  input.focus();
  scout_id_to_send_message = scout_id;

  scoutsLayers[user_unit_id].eachLayer(function (layer) {
    if (layer.closePopup) {
      layer.closePopup();
    }
  });
}

function handleEnterKey(event) {
  if (event.keyCode === 13) {
    saveMessage();
  }
}

function saveMessage() {
  //save message to server
  if (scout_id_to_send_message) {

    const edit = document.querySelector('#message-new');
    const input = document.querySelector('#message-input');

    fetch('/save-message', {
      method: 'POST',
      //stringify for POST
      body: JSON.stringify({
        sender: user_id,
        receiver: scout_id_to_send_message,
        message: input.value,
        latlng: scoutsCoord[user_id] || null, 
      })
    })
      .then(response => response.json())
      .then(result => {
        if (!!result.error) {
          console.error(result.error);
        } else {
          insertMessage(result.id, `me -> ${result.receiver}`, Date.now(), input.value);
        }
      })
      .catch(error => console.error(error))
      // final action
      .then(() => {
        // Code to be executed regardless of success or failure (cleanup, UI updates)
        scout_id_to_send_message = null;
        input.value = null;
        edit.classList.add('d-none');
      });
  }
}

function insertMessage(message_id, sender, datetime, text) {
  const time = utcToLocaleTime(datetime);
  const container = document.querySelector('#messages');
  const element = document.createElement('div');
  element.style.backgroundColor = 'aliceblue';
  
  let markAsReadElement = '';

  if(!sender.includes('me -> ')){ //if not mine new message, adding 'Mark as read' 
    markAsReadElement= `<a class="flex-grow-1 text-end" href="#" data-message_id="${message_id}" onclick="markMessageAsRead(${message_id})">Mark as read</a>`;                     
  }

  //note: adds closing </div> by default
  element.innerHTML = `<div style="font-size: small; color: grey;" class="d-flex gap-3">
    <span>${time} ${sender} </span> ${markAsReadElement} </div>`;

  element.innerHTML += `<p id="message-text-${message_id}">${text}</p>`;

  container.insertBefore(element, container.firstChild);
}

function createMessagePopup(message_id, latlng, sender, time, text) {
  const content = `<div style="font-size: small; color: grey;">${sender} ${time}</div>
  <p>${text}</p>
  <button class="btn btn-sm btn-primary" onclick="markMessageAsRead(${message_id})"> Mark as read </button>
   `;

  const popup = L.popup(latlng, { content: content, autoClose: false, closeButton: true, keepInView: true }).openOn(map);
  messages_popups[message_id] = popup;
  setBounds();
}

// enters destination mode
function chooseDestination(scout_id) {
  scout_id_to_set_dest = scout_id;
  map.getContainer().style.cursor = "crosshair"; // Change cursor to crosshair

  scoutsLayers[user_unit_id].eachLayer(function (layer) {
    if (layer.closePopup) {
      layer.closePopup();
    }
  });
};

function onMapClick(e) {
  if (scout_id_to_set_dest) {
    //save destination to server
    fetch('/set-destination', {
      method: 'POST',
      //stringify for POST
      body: JSON.stringify({
        scout_id: scout_id_to_set_dest,
        latlng: e.latlng,
      })
    })
      .then(response => response.json())
      .then(result => {
        if (!!result.error) {
          console.error(result.error);
        } else {
          updateMarkerFeature(result.destination_id, result.destination_title, e.latlng, false);
          setBounds();
        }
      })
      .catch(error => console.error(error))
      // final action
      .then(() => {
        // Code to be executed regardless of success or failure (cleanup, UI updates)
        scout_id_to_set_dest = null;
        map.getContainer().style.cursor = null; // Change cursor to default
        //L.DomUtil.removeClass(map._container,'crosshair-cursor-enabled');
      });
  }
};


// Need to monitor window focus on mobile browser, when window is inactive UI won't be updated, will refresh if it becomes visible
document.addEventListener('visibilitychange', function () {
  if (document.visibilityState === 'visible' 
    && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
    // Browser has regained focus
    window.location.reload();
  }
});

//------------ server-sent event listeners -------------------------------

const positionEventSource = new EventSource('/position-stream/');
positionEventSource.onmessage = function (event) {
  //the whole nested latlng property value surround by quotes, also single quotes will not work with JSON.parse
  //"latlng" : "{'lat':42.34785733333333,'lng':-71.07324241666666}"
  //fixed to: "latlng": {"lat":42.34785733333333,"lng":-71.07324241666666}

  var fixedString = event.data.replace(/"latlng": "({.+})"/, '"latlng": $1');
  fixedString = fixedString.replace(/'/g, '"');
  var obj = JSON.parse(fixedString);

  updateScoutFeature(obj.scout_unit_id, obj.scout_id, obj.scout_name, obj.latlng);

  setBounds();
};

const markerEventSource = new EventSource('/marker-stream/');
markerEventSource.onmessage = function (event) {

  var fixedString = event.data.replace(/"latlng": "({.+})"/, '"latlng": $1');
  fixedString = fixedString.replace(/'/g, '"');
  var obj = JSON.parse(fixedString);

  //only for current unit
  if (user_unit_id !== obj.unit_id)
    return;

  //no need to update if commander set marker on current context( marker has same latlng and was set by using updateMarkerFeature)
  if (is_commander && markersCoord[obj.id] && markersCoord[obj.id].equals(L.latLng(obj.latlng)))
    return;

  updateMarkerFeature(obj.id, obj.title, obj.latlng, obj.need_confirmation);

  setBounds();
};

markerEventSource.addEventListener('close', function(event) {
  console.log('Markers SSE closed by server:', event.data);
  markerEventSource.close();
});


const messageEventSource = new EventSource('/message-stream/');
messageEventSource.onmessage = function (event) {

  var fixedString = event.data.replace(/"latlng": "({.+})"/, '"latlng": $1');
  fixedString = fixedString.replace(/'/g, '"');
  var obj = JSON.parse(fixedString);

  insertMessage(obj.id, obj.sender, obj.time, obj.text);

  let latLng = L.latLng(obj.latlng);

  //no latlng - try to get latest position
  if (!!!latLng)
    latLng = scoutsCoord[obj.sender_id];

  if (!!!latLng)
    latLng = map.getCenter();

  createMessagePopup(obj.id, latLng, obj.sender, utcToLocaleTime(obj.time), obj.text);
};

messageEventSource.addEventListener('close', function(event) {
  console.log('Messsages SSE closed by server:', event.data);
  messageEventSource.close();
});


const confirmMsgEventSource = new EventSource('/confirm-msg-stream/');
confirmMsgEventSource.onmessage = function (event) {
  const message_id = event.data;
  var messageElement = document.getElementById(`message-text-${message_id}`);
  
  //note: in case of destination-marker confirm, the msg did not come from current-user, 'response' was auto-generated on server (see: confirm-destination)
  if(messageElement){
    messageElement.classList.remove('message-unread');
    messageElement.classList.add('message-read');
  }
};

confirmMsgEventSource.addEventListener('close', function(event) {
  console.log('ConfirmMsg SSE closed by server:', event.data);
  confirmMsgEventSource.close();
});

//-------------------- sse end -----------------------


var lastPosition = undefined;

function onLocationFound(e) {
  const accuracy = document.querySelector('#accuracy');
  accuracy.innerHTML = `accuracy: ${formatNumber(e.accuracy)} m`;

  if (e.accuracy < 100) {
    accuracy.classList.remove('alert-danger');
    accuracy.classList.add('alert-success');

  } else {
    accuracy.classList.remove('alert-success');
    accuracy.classList.add('alert-danger');
  }

  //latlng to coordinates array to update bounds
  scoutsCoord[user_id] = e.latlng;

  if (!!!user_location_marker) {

    var myIcon = L.icon({
      iconUrl: "static/scouts/orange-circle-icon.svg",

      iconSize: [25, 25],
      iconAnchor: [10, 10], //location of marker.  0,0 - is left upper corner
      popupAnchor: [3, -10],
      className: "blinking",
    });

    user_location_marker = L.marker(e.latlng, {
      icon: myIcon,
      title: "my position",
      zIndexOffset: 1000,
    });

    user_location_marker.addTo(map);

  } else {
    user_location_marker.setLatLng(e.latlng);
  }

  user_location_marker.bindPopup(`my position: ${e.latlng}`);

  if (lastPosition === undefined) {
    lastPosition = e.latlng;
    setBounds();
    //very first position save and return
    save_location(e.latlng, e.timestamp);
    return;
  }

  // update position on server only if difference at least 5 meters
  if (e.latlng.distanceTo(lastPosition) > 5) {
    lastPosition = e.latlng;
    setBounds();
    save_location(e.latlng, e.timestamp);
  }
}

function init() {

  fetch('/init', {
    method: 'GET',
  })
    .then(response => response.json())
    .then(result => {
      if (!!result.error) {
        console.warn(result.error);
      } else {
        console.log(result);

        is_commander = result.some(unit => unit.commander_id === user_id);
        const userUnit = result.find(unit => unit.scouts.some(scout => scout.id === user_id));

        if (userUnit)
          user_unit_id = userUnit.id;

        console.log(`userid:${user_id} is commander: ${is_commander}`);

        result.forEach(unit => {

          unitInfo[unit.id] = {
            title: unit.title,
            commander_name: unit.commander_name,
            commander_id: unit.commander_id,
          };

          var iconUrl = undefined;
          switch (unit.color) {
            case 'red':
              iconUrl = `static/scouts/${unit.color}-icon.svg`;
              break;
            case 'green':
              iconUrl = `static/scouts/${unit.color}-icon.svg`;
              break;
            case 'blue':
              iconUrl = `static/scouts/${unit.color}-icon.svg`;
              break;
          }


          /*
          Important about leaflet offseting icons, tooltips and markers
          Add a positive x offset to move to the right, and a positive y offset to move it to the bottom. Negatives will move to the left and top.
          In pointToLayer function might need a check if feature overlaps any other in scoutsCoord to offset icon.
          */


          var myIcon = L.icon({
            iconUrl: iconUrl,
            iconSize: [50, 25],
            iconAnchor: [25, 12], //location of marker.  0,0 - is left upper corner
            popupAnchor: [-10, -12],

            tooltipAnchor: [-10, -12],
          });


          scoutsLayers[unit.id] = L.geoJSON([], {
            pointToLayer: function (feature, latlng) {
              return L.marker(latlng, { icon: myIcon });
            },
            onEachFeature: function onEachFeature(feature, layer) {
              layer.bindPopup(feature.properties.popupContent, { autoClose: false, closeButton: true, keepInView: true });
              layer.bindTooltip(feature.properties.tooltipContent, { "permanent": true, "direction": 'top', "opacity": 0.4 });
            }
          });

          map.addLayer(scoutsLayers[unit.id]);

          unit.scouts.forEach(scout => {
            //except current user position, which is a 'blinking' marker
            if (scout.id !== user_id) {
              var fixedString = scout.latlng.replace(/'/g, '"'); //single quotes will not work with JSON.parse
              var latLngStr = JSON.parse(fixedString);
              updateScoutFeature(scout.unit_id, scout.id, scout.name, latLngStr);
            }
          });

          markers = L.geoJSON([], {
            pointToLayer: function (feature, latlng) {
              return L.marker(latlng);
            },
            onEachFeature: function onEachFeature(feature, layer) {
              layer.bindPopup(feature.properties.popupContent);
              layer.bindTooltip(feature.properties.tooltipContent, { "permanent": true, "direction": 'top', "opacity": 0.4 });
            }
          });

          map.addLayer(markers);

          // set markers only for logged in user and his unit 
          if (is_authenticated && unit.id === user_unit_id){
            unit.markers.forEach(marker => {
              var fixedString = marker.latlng.replace(/'/g, '"'); //single quotes will not work with JSON.parse
              var latLngStr = JSON.parse(fixedString);
              updateMarkerFeature(marker.id, marker.title, latLngStr, marker.need_confirmation);
            });
          }

          setBounds();
        });

        //convert all template messages -> message.time -> utc to locale
        const timeElements = document.querySelectorAll('[id^="message-time"]');
        timeElements.forEach(timeElement => {
          const utcTime = timeElement.getAttribute('data-utc-time');
          timeElement.textContent = utcToLocaleTime(utcTime);
        });

        //add popups if message not read
        unreadMessageElements = document.querySelectorAll(`[data-read="False"][data-sender-id]:not([data-sender-id="${user_id}"])`);
        unreadMessageElements.forEach(el => {
          let latlng = el.getAttribute('data-latlng');
          let latLng = undefined;

          if (!!!latlng || latlng === 'None') {
            el.getAttribute('data-sender-id');
            let senderId = parseInt(el.getAttribute('data-sender-id'));
            latLng = scoutsCoord[senderId]; //set to latest position
            if (!!!latLng)
              latLng = map.getCenter();
          } else {
            latlng = latlng.replace(/'/g, '"');
            var latlngObj = JSON.parse(latlng);
            latLng = L.latLng(latlngObj);
          }

          const time = document.getElementById(`message-time-${el.id}`).innerHTML;
          const text = document.getElementById(`message-text-${el.id}`).innerHTML;
          const sender = el.getAttribute('data-sender');
          createMessagePopup(el.id, latLng, sender, time, text);
        });

      }

    })
    .catch(error => console.warn(error));
}

/**
 * sets maps bounds based on all scouts and markers coordinates 
 */
function setBounds(override_auto_fit = false) {

  if (!override_auto_fit && !auto_fit_bounds) return;

  try {
    map.fitBounds(L.latLngBounds([...Object.values(scoutsCoord), ...Object.values(markersCoord)]));
  } catch (ex) {
    console.warn(ex);
  }
}

/**
 * sends location of current authentificated user to server
 * @param {} latlng 
 * @param {*} timestamp 
 */
function save_location(latlng, timestamp) {

  fetch('/save-position', {
    method: 'POST',
    body: JSON.stringify({ //stringify for POST
      timestamp: timestamp,
      latlng: latlng
    })
  })
    .then(response => response.json())
    .then(result => {
      if (!!result.error) {
        console.warn(result.error);
      } else {
        //console.log(result);
      }

    })
    .catch(error => console.warn(error));
}

function utcToLocaleTime(utcDateTime) {
  let date = new Date(utcDateTime);

  // Check if the date is invalid, non-compatilbe browser? (Safari)
  if (isNaN(date.getTime())) {
    return utcDateTime;
  }

  return date.toLocaleString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

function formatNumber(number) {
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'decimal',
    minimumFractionDigits: 1, // Adjust for desired decimal places
    maximumFractionDigits: 2, // Adjust for desired decimal places
  });
  return formatter.format(number);
}

function replaceFeatureById(featureCollection, id, newFeature) {
  const index = featureCollection.findIndex((f) => f.id === id);
  if (index !== -1) {
    featureCollection.splice(index, 1, newFeature);
  } else {
    featureCollection.push(newFeature);
  }
}