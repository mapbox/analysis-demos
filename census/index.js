'use strict';

/* global mapboxgl */
var fs = require('fs');
var path = require('path');

var MapboxClient = require('mapbox/lib/services/surface');
var hexGrid = require('turf-hex-grid');
var centroid = require('turf-centroid');
var polyline = require('polyline');
var template = require('lodash.template');
var median = require('median');
var popupTemplate = template(fs.readFileSync(path.join(__dirname, '/templates/popup.html'), 'utf8'));
var resultTemplate = template(fs.readFileSync(path.join(__dirname, '/templates/result.html'), 'utf8'));

// Box draw interaction
var Box = require('./box');
var bbox = [];

mapboxgl.accessToken = process.env.MapboxAccessToken;
var mapbox = new MapboxClient(mapboxgl.accessToken);

var surfaceData = 'mapbox.82pkq93d';
var surfaceLayer = 'original';
var surfaceFields = ['COUNTY', 'median-income', 'population'];

var map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/light-v8',
  center: [-98, 38.88],
  minZoom: 3,
  maxZoom: 8,
  zoom: 3.75
});

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

var layers = [
  [1000000, '#723122', 'dark'],
  [500000, '#8B4225', 'dark'],
  [100000, '#A25626', 'dark'],
  [50000, '#B86B25', 'dark'],
  [10000, '#CA8323', ''],
  [5000, '#DA9C20', ''],
  [1000, '#E6B71E', ''],
  [100, '#EED322', ''],
  [0, '#F2F12D', '']
];

function fillLayer(v) {
  var index;
  layers.forEach(function(d, i) {
    if (i === 0) {
      if (v >= d[0]) index = i;
    } else {
      if (v >= d[0] && v < layers[i - 1][0]) index = i;
    }
  });
  return layers[index];
}

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
    "type": "geojson",
    "data": {
      "type": "FeatureCollection",
      "features": []
    }
  });

  layers.forEach(function (layer, i) {
    map.addLayer({
      "id": "hex-" + i,
      "interactive": true,
      "type": "fill",
      "source": "boxdraw",
      "paint": {
        "fill-color": layer[1],
        "fill-outline-color": layer[1],
        "fill-opacity": 0.75
      },
      "filter": i == 0 ?
        [">=", "population", layer[0]] :
        ["all",
          [">=", "population", layer[0]],
          ["<", "population", layers[i - 1][0]]]
    }, 'place_label_city_small_s');
  });

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

    var bounds = new mapboxgl.LngLatBounds(map.unproject(e.start), map.unproject(e.end)).toArray();
    bbox = [
      bounds[0][0],
      bounds[0][1],
      bounds[1][0],
      bounds[1][1]
    ];

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
  var grid = hexGrid(bbox, hex, 'miles');
  var centers = [];

  // Grab the center of each hex for surface request
  grid.features.forEach(function(feature) {
    feature = centroid(feature);
    centers.push(feature.geometry.coordinates.reverse());
  });

  mapbox.surface(surfaceData, surfaceLayer, surfaceFields, polyline.encode(centers), {
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

  map.featuresAt(e.point, {
    includeGeometry: true,
    layer: layers.reduce(function(memo, layer, i) {
      memo.push('hex-' + i);
      return memo;
    }, [])
  }, function(err, features) {
    map.getCanvas().style.cursor = (!err && features.length) ? 'pointer' : '';

    popup.remove();
    if (err || !features.length) return;

    var feature = features[0];
    var color = fillLayer(feature.properties.population);

    popup = new mapboxgl.Popup({
      closeOnClick: false,
      closeButton: false
    })
      .setLngLat(feature.properties.point)
      .setHTML(popupTemplate({
        county: feature.properties.COUNTY,
        fill: color[1],
        klass: color[2],
        population: feature.properties.population.toLocaleString(),
        medianIncome: feature.properties['median-income'].toLocaleString()
      }))
      .addTo(map);
  });
});

geocoder.on('geocoder.input', function(e) {
  bbox = e.result.bbox;
  drawHexGrid(bbox);
});

map.on('style.load', initialize);
