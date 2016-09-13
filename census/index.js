'use strict';

/* global mapboxgl */
window.mapboxgl = require('mapbox-gl');
mapboxgl.accessToken = 'pk.eyJ1IjoidHJpc3RlbiIsImEiOiJjaXQxbm95M3YwcjN0MnpwZ2x2YWd1dDhhIn0.Li4zw6oFRX-ohGQISnrmJA';

require('mapbox-gl-geocoder');

var MapboxClient = require('mapbox/lib/services/surface');
var polyline = require('polyline');
var template = require('lodash.template');
var median = require('median');

var turfPoint = require('turf-point');
var turfBbox = require('turf-bbox');
var turfHexGrid = require('turf-hex-grid');
var turfCentroid = require('turf-centroid');

// Box draw interaction
var Box = require('./box');
var bbox = [];

// Templates
var popupTemplate = template(document.getElementById('popup-template').innerHTML);
var resultTemplate = template(document.getElementById('result-template').innerHTML);

var mapbox = new MapboxClient(mapboxgl.accessToken);

var map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/light-v9',
  center: [-98, 38.88],
  minZoom: 3,
  maxZoom: 8,
  zoom: 3.75
});

if (window.location.search.indexOf('embed') !== -1) map.scrollZoom.disable();

var popup = new mapboxgl.Popup({
  closeButton: false
});

var geocoder = new mapboxgl.Geocoder({
  container: 'geocoder',
  country: 'us',
  types: 'region,postcode,place'
});

map.addControl(geocoder);

var box, error;
var $results = document.getElementById('results');

var hex = 80;
var $hexSize = document.getElementById('hex-size');
var $hexValue = document.getElementById('hex-value');

var drawControls = document.getElementById('draw-controls'), draw;
var box = new Box(map.getContainer(), {
  fill: 'rgba(56, 135, 190, 0.05)',
  stroke: '#3887be',
  strokeWidth: 2
});

function emitError(msg) {
  window.clearTimeout(error);
  var $error = document.getElementById('error');

  $error.classList.add('pad1', 'active');
  $error.textContent = msg;

  // Emit error for 3 seconds.
  error = window.setTimeout(function() {
    $error.classList.remove('pad1', 'active');
    $error.textContent = '';
  }, 3000);
}

function loading(state) {
  document.getElementById('sidebar').classList.toggle('loading', state);
}

function initialize() {
  document.body.classList.remove('loading');

  map.addSource('boxdraw', {
    "type": 'geojson',
    "data": {
      "type": "FeatureCollection",
      "features": []
    }
  });

  map.addLayer({
    id: 'hex',
    type: 'fill',
    source: 'boxdraw',
    paint: {
      'fill-color': {
        property: 'median-income',
        stops: [
          [0, '#F2F12D'],
          [25000, '#E6B71E'],
          [50000, '#B86B25'],
          [100000, '#8B4225'],
          [200000, '#723122']
        ]
      },
      'fill-outline-color': 'rgba(0,0,0,0.10)',
      'fill-opacity': 0.75
    },
    filter: [
      'all',
      ['has', 'median-income'],
      ['!=', 'median-income', 'null']
    ]
  }, 'place_label_city_small_s');

  // Add the draw control to the map
  draw = document.createElement('button');
  draw.id = 'draw';
  draw.className = 'icon polygon button round-right draw-ctrl';
  draw.title = 'Draw';

  draw.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();

    if (draw.classList.contains('active')) {
      disableDraw();
    } else {
      draw.classList.add('active');
      map.boxZoom.disable();
      map.dragPan.disable();
      map.getCanvas().style.cursor = 'crosshair';
      box.enable();
    }
  });

  drawControls.appendChild(draw);

  box.on('result', function(e) {
    // Clear the draw canvas
    disableDraw();

    // Clear the geocoder box if there's a result in it
    clearGeocoder();

    var start = map.unproject(e.start);
    var end = map.unproject(e.end);
    bbox = turfBbox({
      type: 'FeatureCollection',
      features: [
        turfPoint([start.lng, start.lat]),
        turfPoint([end.lng, end.lat])
      ]
    });

    drawHexGrid(bbox);
  });
}

function disableDraw() {
  draw.classList.remove('active');
  map.boxZoom.enable();
  map.dragPan.enable();
  map.getCanvas().style.cursor = '';
  box.disable().clear();
}

function clearGeocoder() {
  var clickEvent = document.createEvent('HTMLEvents');
  clickEvent.initEvent('click', true, false);
  var clear = document.getElementById('geocoder').querySelector('.geocoder-icon-close');
  if (clear.classList.contains('active')) clear.dispatchEvent(clickEvent);
}

function drawHexGrid(bbox) {
  loading(true);

  var grid = turfHexGrid(bbox, hex, 'miles');
  var centers = [];

  // Grab the center of each hex for surface request
  grid.features.forEach(function(feature) {
    feature = turfCentroid(feature);
    centers.push(feature.geometry.coordinates.reverse());
  });

  mapbox.surface('mapbox.82pkq93d', 'original', [
    'COUNTY', 'median-income', 'population'
  ], polyline.encode(centers), {
    geojson: true
  }, function(err, data) {
    if (err) {
      loading(false);
      return emitError(err.message);
    }

    // Collect these values to derive a total median average
    var population = [];
    var income = [];

    data.results.features.forEach(function(d) {
      // Map properties from surface request to each hex
      var properties = d.properties;
      properties.point = d.geometry.coordinates;
      grid.features[properties.id].properties = properties;

      if (properties.population) population.push(properties.population);
      if (properties['median-income']) income.push(properties['median-income']);
    });

    renderSummary(population, income);
    map.getSource('boxdraw').setData(grid);
    loading(false);
  });
}

function renderSummary(population, income) {
  $results.parentNode.classList.remove('hidden');
  $results.innerHTML = resultTemplate({
    medianPop: median(population).toLocaleString(),
    medianIncome: median(income).toLocaleString()
  });

  $hexSize.classList.remove('hidden');
  $hexSize.querySelector('input').value = hex;
  $hexValue.textContent = hex;
}

$hexSize.querySelector('input').addEventListener('input', function(e) {
  $hexValue.textContent = e.target.value;
});

$hexSize.querySelector('input').addEventListener('change', function(e) {
  hex = e.target.value;
  drawHexGrid(bbox);
});

map.on('mousemove', function(e) {
  if (draw.classList.contains('active')) return;

  var features = map.queryRenderedFeatures(e.point, {
    layers: ['hex']
  });

  map.getCanvas().style.cursor = (features.length) ? 'pointer' : '';

  if (!features.length) {
    popup.remove();
    return;
  }

  var feature = features[0];

  popup.setLngLat(e.lngLat)
    .setHTML(popupTemplate({
      county: feature.properties.COUNTY,
      population: feature.properties.population.toLocaleString(),
      medianIncome: feature.properties['median-income'].toLocaleString()
    }))
    .addTo(map);
});

geocoder.on('result', function(e) {
  bbox = e.result.bbox;
  drawHexGrid(bbox);
});

map.on('load', initialize);
