'use strict';

/* global mapboxgl */
mapboxgl.accessToken = process.env.MapboxAccessToken;

var fs = require('fs');
var path = require('path');
var template = require('lodash.template');
var Raphael = require('raphael');

var wheel = require('./wheel');

// Templates
var listingTemplate = template(fs.readFileSync(path.join(__dirname, '/templates/listing.html'), 'utf8'));
var $svg, lastValue = 0;

// Data
var data = [];
dataBuilder(JSON.parse(fs.readFileSync(path.join(__dirname, '/data/categories/art_galleries.geojson'), 'utf8')), 'art');
dataBuilder(JSON.parse(fs.readFileSync(path.join(__dirname, '/data/categories/classical_music.geojson'), 'utf8')), 'music');
dataBuilder(JSON.parse(fs.readFileSync(path.join(__dirname, '/data/categories/museums.geojson'), 'utf8')), 'museum');
dataBuilder(JSON.parse(fs.readFileSync(path.join(__dirname, '/data/categories/theatres.geojson'), 'utf8')), 'theatre');

// Layer style
var dataStyle = JSON.parse(fs.readFileSync(path.join(__dirname, '/data/style.json'), 'utf8'));

var pois = ['poi-art', 'poi-music', 'poi-theatre', 'poi-museum'];

function phoneFormatted(phone) {
  return phone
    .toLowerCase()
    .replace(/[abc]/g, 2)
    .replace(/[def]/g, 3)
    .replace(/[ghi]/g, 4)
    .replace(/[jkl]/g, 5)
    .replace(/[mno]/g, 6)
    .replace(/[pqrs]/g, 7)
    .replace(/[tuv]/g, 8)
    .replace(/[wxyz]/g, 9)
    .replace(/\D/g, '');
}

function dataBuilder(gj, type) {
  gj.features.forEach(function(feature) {
    feature.properties.type = type;
    if (feature.properties.TEL) {
      feature.properties.phoneformatted = phoneFormatted(feature.properties.TEL);
    }
    data.push(feature);
  });
}

// Set bounds to New York, New York
var bounds = [
  [-74.44747924804688, 40.54198241319326], // Southwest coordinates
  [-73.46282958984375, 40.93011520598305]  // Northeast coordinates
];

var map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/cika7lsg6003p9fm1y5eet742',
  hash: true,
  center: [-74.0015, 40.7268],
  zoom: 14,
  maxBounds: bounds
});

// Create a popup, but don't add it to the map yet.
var popup = new mapboxgl.Popup({
  closeButton: false
});

map.scrollZoom.disable();
map.addControl(new mapboxgl.Navigation({
  position: 'top-right'
}));

function addData() {
  map.addSource('geojson', {
    'type': 'geojson',
    'data': {
      'type': 'FeatureCollection',
      'features': data
    }
  });

  dataStyle.forEach(function(style) {
    map.addLayer(style);
  });
}

function buildListings(features) {
  var $listing = document.getElementById('listing');
  $listing.innerHTML = '';
  if (features.length) {
    features.forEach(function(feature) {
      var item = document.createElement('button');
      item.innerHTML = listingTemplate({ data: feature.properties });
      $listing.appendChild(item);

      item.addEventListener('click', function() {
        showPopup(feature);
      });
      item.addEventListener('mouseover', function() {
        showPopup(feature);
      });
      item.addEventListener('mouseout', function() {
        popup.remove();
      });
    });
  } else {
    var emptyState = document.createElement('div');
    emptyState.className = 'pad1 prose';
    emptyState.textContent = document.getElementById('legend').textContent;
    $listing.appendChild(emptyState);
  }
}

function showPopup(feature) {
  popup.setLngLat(feature.geometry.coordinates)
    .setHTML(feature.properties.NAME)
    .addTo(map);
}

function getFeatures() {
  var bbox = $svg.getBoundingClientRect();
  var center = {
     x: bbox.left + bbox.width / 2,
     y: bbox.top + bbox.height / 2
  };

  var radius = $svg.getAttribute('width') / 2;
  map.featuresAt({x: center.x, y: center.y}, {
    radius: radius,
    includeGeometry: true,
    layer: pois
  }, function(err, features) {
   if (err || !features.length) {
      popup.remove();
      return;
    }

    buildListings(features);
  });
}

function initialize() {
  var width = map.getContainer().clientWidth;
  var paper = new Raphael(width / 2, 100, 200, 200);
  $svg = paper.canvas;

  var circleStyle = {
    fill: '#027dbd',
    stroke: '#027dbd'
  };

  circleStyle['stroke-width'] = 3;
  circleStyle['fill-opacity'] = 0.1;

  var c = paper.circle(100, 100, 93).attr(circleStyle);

  // Canvas movement shaping
  function start() {
    // Store original coordinates
    this.parentOx = parseInt($svg.style.left, 10);
    this.parentOy = parseInt($svg.style.top, 10);
  }

  function move(dx, dy) {
    var x = this.parentOx + dx;
    var y = this.parentOy + dy;

    $svg.style.left = x;
    $svg.style.top = y;

    getFeatures();
  }

  c.hover(function() {
    document.body.style.cursor = 'move';
  }, function() {
    document.body.style.cursor = 'default';
  });

  c.drag(move, start);

  function zoomStart(e) {
    e.preventDefault();
    var delta = wheel(e, lastValue);
    lastValue = delta;

    var x = parseInt($svg.style.left, 10);
    var y = parseInt($svg.style.top, 10);
    var r = parseInt($svg.getAttribute('width'), 10);
    var radius = r + delta;
    if (radius <= 100) return;

    var left = x + -delta / 2;
    var top = y + -delta / 2;

    $svg.style.left = left;
    $svg.style.top = top;
    $svg.setAttribute('width', radius);
    $svg.setAttribute('height', radius);

    c.attr({
      r: ((radius / 2) - 3),
      cx: (radius / 2),
      cy: (radius / 2)
    });

    // Fetch map data
    getFeatures();
  }

  $svg.addEventListener('wheel', zoomStart, false);
  $svg.addEventListener('mousewheel', zoomStart, false);
}

map.once('source.change', function(ev) {
  if (ev.source.id !== 'geojson') return;

  window.setTimeout(getFeatures, 500);

  document.getElementById('filter-categories').addEventListener('change', function(e) {
    var id = 'poi-' + e.target.id;
    var display = (e.target.checked) ? 'visible' : 'none';
    map.setLayoutProperty(id, 'visibility', display);
    window.setTimeout(getFeatures, 500);
  });

  document.body.classList.remove('loading');
});

map.on('style.load', addData);
map.on('moveend', getFeatures);

map.on('click', function(e) {
  map.featuresAt(e.point, {
    radius: 7.5,
    includeGeometry: true,
    layer: pois
  }, function(err, features) {
    if (err || !features.length) {
      popup.remove();
      return;
    }

    showPopup(features[0]);
  });
});

map.on('mousemove', function(e) {
  map.featuresAt(e.point, {
    radius: 7.5,
    includeGeometry: true,
    layer: pois
  }, function(err, features) {
    map.getCanvas().style.cursor = (!err && features.length) ? 'pointer' : '';

    if (err || !features.length) {
      popup.remove();
      return;
    }

    showPopup(features[0]);
  });
});

(initialize)();
