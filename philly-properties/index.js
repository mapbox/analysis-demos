'use strict';

/* global mapboxgl */
/* eslint-disable no-loop-func */
mapboxgl.accessToken = process.env.MapboxAccessToken;

var fs = require('fs');
var path = require('path');

var template = require('lodash.template');
var groupBy = require('lodash.groupby');
var Circle = require('./circle');

// Set bounds to Philadelphia
var center = [-75.1759, 39.9361];
var bounds = [
  [-75.63195500381617, 39.76055866429846], // Southwest coordinates
  [-74.6075343956525, 40.122534817620846] // Northeast coordinates
];

// Templates
var listingTemplate = template(fs.readFileSync(path.join(__dirname, '/templates/listing.html'), 'utf8'));

var map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/dark-v8',
  center: center,
  maxBounds: bounds,
  minZoom: 13,
  maxZoom: 19,
  zoom: 15
});

var $radius = document.getElementById('radius');
var $radiusValue = document.getElementById('radius-value');
var $filterGroup = document.getElementById('filter-group');
var $listings = document.getElementById('listings');
var $listingsHeader = document.getElementById('listings-header');

var radius = 100;
var position = map.project(center);
var error;
var categories = [];

var circle = new Circle(map.getContainer(), {
  radius: radius,
  position: position,
  fill: '#3887be',
  fillRadius: 'rgba(82, 161, 216, 0.25)'
});

circle.draw().enable();

var popup = new mapboxgl.Popup({
  closeButton: false
});

var geojson = {
  type: 'FeatureCollection',
  features: []
};

var layers = [
  [0, '#27b691', 'Residential'],
  [1, '#ed5299', 'Commecial'],
  [2, '#484896', 'Hotels & Apartments'],
  [3, '#ec3649', 'Store with dwelling'],
  [4, '#f06f42', 'Vacant land'],
  [5, '#f6d845', 'Industrial']
];

function loading(state) {
  document.getElementById('sidebar').classList.toggle('loading', state);
}

function emitError(msg) {
  loading(false);
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

function initialize() {
  document.body.classList.remove('loading');

  map.addSource('philly', {
    type: 'vector',
    url: 'mapbox://tristen.2so304hr'
  });

  map.addLayer({
    id: 'philly',
    type: 'circle',
    source: 'philly',
    interactive: true,
    'source-layer': 'original',
    paint: {
      'circle-color': 'rgba(0,0,0,0)',
      'circle-radius': 0
    }
  });

  map.addSource('within', {
    type: 'geojson',
    data: geojson
  });

  layers.forEach(function(layer, i) {
    var layerID = 'poi-' + i;
    map.addLayer({
      id: layerID,
      interactive: true,
      type: 'circle',
      source: 'within',
      paint: {
        'circle-color': layer[1],
        'circle-radius': {
          base: 1,
          stops: [[13, 1], [15, 1.5], [17, 3]]
        }
      },
      filter: ['==', 'category', layer[0]]

    }, 'place_label_city_small_s');

    var input = document.createElement('input');
    input.type = 'checkbox';
    input.id = layerID;
    input.checked = true;
    $filterGroup.appendChild(input);

    var label = document.createElement('label');
    label.className = 'button col12';
    label.setAttribute('for', layerID);
    label.textContent = layer[2];

    var labelKey = document.createElement('span');
    labelKey.style.backgroundColor = layer[1];

    label.appendChild(labelKey);
    $filterGroup.appendChild(label);

    // When the checkbox changes, update the visibility of the layer.
    input.addEventListener('change', function(e) {
      if (e.target.checked && categories.indexOf(i) >= 0) {
        categories.splice(categories.indexOf(i), 1);
      } else {
        categories.push(i);
      }

      map.setLayoutProperty(layerID, 'visibility', e.target.checked ? 'visible' : 'none');
      buildListings(geojson.features);
    });
  });

  $radius.querySelector('input').value = radius;
  $radiusValue.textContent = radius;
}

map.on('source.load', function(e) {
  if (e.source.id === 'philly') window.setTimeout(redraw, 1000);
});

function buildListings(listings) {
  $listings.innerHTML = '';

  if (categories.length) {
    listings = listings.filter(function(d) {
      return categories.indexOf(d.properties.category) === -1;
    });
  }

  listings = groupBy(listings, function(d) {
    return d.properties.category;
  });

  for (var prop in listings) {

    var section = document.createElement('div');
    section.className = 'listing-group';

    section.setAttribute('data-properties', listings[prop].length);
    layers.forEach(function(l) {
      if (l[0] === parseInt(prop, 10)) {
        section.setAttribute('data-fill', l[1]);
        section.setAttribute('data-category', l[2]);
      }
    });

    if (prop === Object.keys(listings)[0]) {
      buildHeader($listingsHeader, section);
    } else {
      var header = document.createElement('header');
      header.className = 'pad2x pad1y';
      buildHeader(header, section);
      section.appendChild(header);
    }

    listings[prop].forEach(function(feature) {
      layers.forEach(function(l) {
        if (l[0] === feature.properties.category) feature.fill = l[1];
      });

      var item = document.createElement('div');
      item.innerHTML = listingTemplate(feature);
      section.appendChild(item);

      item.querySelector('button').addEventListener('click', function(e) {
        var elements = $listings.querySelectorAll('button');

        Array.prototype.forEach.call(elements, function(el) {
          el.classList.remove('active');
        });

        e.target.classList.add('active');

        map.flyTo({
          center: feature.geometry.coordinates,
          zoom: 18
        });

        popup
          .remove()
          .setLngLat(feature.geometry.coordinates)
          .setHTML(feature.properties.address)
          .addTo(map);
      });

      item.querySelector('button').addEventListener('mouseover', function() {
        popup
          .remove()
          .setLngLat(feature.geometry.coordinates)
          .setHTML(feature.properties.address)
          .addTo(map);
      });

      item.querySelector('button').addEventListener('mouseout', function() {
        popup.remove()
      });
    });

    $listings.appendChild(section);
    loading(false);
  }
}

function buildHeader(container, section) {
  var properties = section.getAttribute('data-properties');
  var category = section.getAttribute('data-category');
  var fill = section.getAttribute('data-fill');

  var title = document.createElement('strong');
  title.className = 'small quiet space-right0';
  title.textContent = category;

  var n = parseInt(properties, 10);
  var sub = document.createElement('strong');
  sub.className = 'small dark';
  sub.textContent = n.toLocaleString() + ' properties';

  container.innerHTML = '';
  container.style.backgroundColor = fill;
  container.appendChild(title);
  container.appendChild(sub);
}

function redraw(e) {
  loading(true);
  $listings.innerHTML = '';
  map.dragPan.enable();
  if (e && e.end) position = e.end;
  map.featuresAt(position, {
    radius: radius,
    includeGeometry: true,
    layer: ['philly']
  }, function(err, features) {
    if (err) return emitError(err.message);
    if (!features.length) return emitError('No properties found');
    var listings = geojson.features = features;
    map.getSource('within').setData(geojson);
    buildListings(listings);
  });
}

circle.on('result', redraw);

// Radius changer
$radius.querySelector('input').addEventListener('input', function(e) {
  $radiusValue.textContent = e.target.value;
  radius = e.target.value;
  circle.setRadius(radius);
});

$radius.querySelector('input').addEventListener('change', redraw);

// Changing section header on scroll
// depending on section currently in view.
function offset(el) {
  var rect = el.getBoundingClientRect();
  return {
    top: rect.top + document.body.scrollTop,
    left: rect.left + document.body.scrollLeft
  };
}

var sectionHeadingPosition = offset($listingsHeader);
var currentCategory;

$listings.addEventListener('scroll', function() {
  var sections = $listings.querySelectorAll('.listing-group');
  Array.prototype.forEach.call(sections, function(el, i, d) {
    var next = d[i + 1];
    if (next) {
      if (sectionHeadingPosition.top >= offset(el).top &&
         sectionHeadingPosition.top <= offset(next).top) {
        var category = el.getAttribute('data-category');
        if (category !== currentCategory) {
          buildHeader($listingsHeader, el);
          currentCategory = category;
        }
        return;
      }
    }
  });
});

map.on('load', initialize);
