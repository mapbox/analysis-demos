'use strict';

/* global mapboxgl */
/* eslint-disable new-cap */
mapboxgl.accessToken = process.env.MapboxAccessToken;

// Set bounds to Philadelphia
var bounds = [
  [-75.63195500381617, 39.76055866429846], // Southwest coordinates
  [-74.6075343956525, 40.122534817620846] // Northeast coordinates
];

var map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/streets-v8',
  center: [-75.1759, 39.9361],
  maxBounds: bounds,
  minZoom: 13,
  maxZoom: 19,
  zoom: 13
});

var popup = new mapboxgl.Popup({
  closeButton: false
});

function initialize() {
  document.body.classList.remove('loading');

  map.addSource('philly', {
    type: 'vector',
    url: 'mapbox://tristen.2so304hr'
  });

  map.addLayer({
    id: 'poi',
    interactive: true,
    type: 'circle',
    source: 'philly',
    'source-layer': 'original',
    paint: {
      'circle-color': '#000',
      'circle-radius': 1,
      'circle-opacity': 0.75
    }
  }, 'place_label_city_small_s');
}

map.on('click', function(e) {
  console.log('coordinates: ', e.lngLat);
});

map.on('mousemove', function(e) {
  map.featuresAt(e.point, {
    radius: 2.5, // Half the marker size (5px).
    includeGeometry: true,
    layer: ['poi']
  }, function(err, features) {
    map.getCanvas().style.cursor = (!err && features.length) ? 'pointer' : '';

    if (err || !features.length) {
      popup.remove();
      return;
    }

    var feature = features[0];
    var p = feature.properties;
    var popupContainer = document.createElement('div');

    [
      ['Address', p.address],
      ['Category', p.category],
      ['Price', p.price],
      ['Stories', p.stories],
      ['Rooms', p.rooms],
      ['Bedrooms', p.bedrooms],
      ['Bathrooms', p.bathrooms]
    ].forEach(function(d) {
      var item = document.createElement('div');
      var label = document.createElement('strong');
      label.className = 'space-right0';
      label.textContent = d[0];

      var value = document.createElement('div');
      value.className = 'inline capitalize';
      value.textContent = d[1];

      item.appendChild(label);
      item.appendChild(value);
      popupContainer.appendChild(item);
    });

    // Initialize a popup and set its coordinates
    // based on the feature found.
    popup.setLngLat(feature.geometry.coordinates)
      .setHTML(popupContainer.innerHTML)
      .addTo(map);
  });
});

map.on('load', initialize);
