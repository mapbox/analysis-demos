'use strict';

/* global mapboxgl */
/* eslint-disable no-loop-func */
mapboxgl.accessToken = process.env.MapboxAccessToken;

var fs = require('fs');
var path = require('path');

var template = require('lodash.template');
var groupBy = require('lodash.groupby');
var _ = require('lodash');
var distance = require('turf-distance');
var point = require('turf-point');
var extend = require('xtend');
var hashable = require('hashable').hash();
var Circle = require('./circle');

var params = {
  center: [-99.14396166801453, 19.4357369232938],
  radius: 100,
  exclude: [],
  zoom: 15
};

hashable.change(function(e) {
  var hash = e.data;

  // Format
  if (hash.center) hash.center = hash.center.split(',').map(function(d) {
    return parseFloat(d);
  });
  if (hash.exclude) hash.exclude = hash.exclude.split(',').map(function(d) {
    return parseInt(d, 10);
  });

  if (hash.zoom) hash.zoom = parseFloat(hash.zoom, 10);
  if (hash.radius) hash.radius = parseInt(hash.radius, 10);

  setHash(hash);
}).read();

// Set bounds to Mexico City
var bounds = [
  [-99.4, 19.1],  // Southwest coordinates
  [-98.9, 19.6]   // Northeast coordinates
];

// Templates
var listingTemplate = template(fs.readFileSync(path.join(__dirname, '/templates/listing.html'), 'utf8'));
var popupTemplate = template(fs.readFileSync(path.join(__dirname, '/templates/popup.html'), 'utf8'));

var map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/dark-v8',
  center: params.center,
  zoom: params.zoom,
  maxBounds: bounds,
  minZoom: 13,
  maxZoom: 19
});

if (window.location.search.indexOf('embed') !== -1) {
  map.addControl(new mapboxgl.Navigation({
    position: 'bottom-right'
  }));

  map.scrollZoom.disable();
  document.body.classList.add('embed');
}

var $radius = document.getElementById('radius');
var $radiusValue = document.getElementById('radius-value');
var $filterGroup = document.getElementById('filter-group');
var $listings = document.getElementById('listings');
var $listingsHeader = document.getElementById('listings-header');

var innerRadius = 30;
var position = map.project(params.center);
var error;

var circle = new Circle(map.getContainer(), {
  innerRadius: innerRadius,
  radius: parseInt(params.radius, 10),
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
  [460000, '#27b691', 'Retail trade'],
  [520000, '#ed5299', 'Financial and insurance'],
  [610000, '#484896', 'Educational services'],
  [620000, '#ec3649', 'Healthcare and social assistance'],
  [710000, '#f06f42', 'Cultural and sporting'],
  [720000, '#276ff0', 'Hotels, restaurants, and bars'],
  [430000, '#f6d845', 'Wholesale trade']
];

/**
 * Returns parent category for a full SCIAN category id,
 * by applying a floor-style formula to the 6-digit integer
 * This is use to group businesses types in broader categories
 *
 * @param {number} category: current 6-digit category, e.g. 461110
 * @returns {number} 6-digit category, e.g. 460000
 */
function parentCategory(category) {
  return Math.trunc(category / 10000) * 10000;
}

function parentCategoryInFeature(c) {
  return { properties: { category: parentCategory(c) } };
}

function featuresWithBroaderCategories(features) {
  return _.map(features, (f) => {
    return _.merge(f, parentCategoryInFeature(f.properties.category));
  });
}

function categoryName(categoryId) {
  var layer = _.find(layers, (l) => {
    return l[0] == categoryId;
  });
  return layer ? layer[2] : 'Other category';
}

function logStats(features) {
  var categories = _.map(features, (f) => { return f.properties.category / 10000 });
  var stats = _.countBy(categories, Math.floor);
  console.log(stats);
}

function featuresIn(map, box, callback) {
  map.featuresIn(box, {
    includeGeometry: true,
    layer: 'denue'
  }, function(err, features) {
    // logStats(features);
    callback(err, featuresWithBroaderCategories(features));
  });
}

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

  // Prepend data attribution
  var credit = document.createElement('a');
  credit.href = 'http://busca.datos.gob.mx/#!/conjuntos/directorio-estadistico-nacional-de-unidades-economicas-denue-por-entidad-federativa/';
  credit.className = 'fill-darken2 pad0x inline fr color-white';
  credit.target = '_target';
  credit.textContent = 'Data provided by INEGI at datos.gob.mx';
  map.getContainer().querySelector('.mapboxgl-ctrl-bottom-right').appendChild(credit);

  map.addSource('denue', {
    type: 'vector',
    url: 'mapbox://rodowi.2wgwdqjj'
  });

  map.addLayer({
    id: 'denue',
    type: 'circle',
    source: 'denue',
    interactive: true,
    'source-layer': 'denue_09_25022015',
    paint: {
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
      layout: {
        'visibility': params.exclude.indexOf(i) >= 0 ? 'none' : 'visible'
      },
      paint: {
        'circle-color': layer[1],
        'circle-radius': {
          base: 1,
          stops: [[13, 2], [15, 2.5], [17, 4]]
        }
      },
      filter: [
        "all",
        [">=", 'category', layer[0]],
        ["<=", 'category', layer[0] + 9999]
      ]

    }, 'road-label-sm');

    var input = document.createElement('input');
    input.type = 'checkbox';
    input.id = layerID;

    input.checked = params.exclude.indexOf(i) >= 0 ? false : true;
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
      if (e.target.checked && params.exclude.indexOf(i) >= 0) {
        params.exclude.splice(params.exclude.indexOf(i), 1);
      } else {
        params.exclude.push(i);
      }

      setHash({exclude: params.exclude});
      map.setLayoutProperty(layerID, 'visibility', e.target.checked ? 'visible' : 'none');
      buildListings(geojson.features);
    });
  });

  $radius.querySelector('input').value = params.radius;
  updateRadiusLabel(params.radius);
}

map.on('source.load', function(e) {
  if (e.source.id === 'denue') {
    position = {
      x: position.x + innerRadius / 2,
      y: position.y + innerRadius / 2
    };
    window.setTimeout(redraw, 2000);
  }
});

map.on('moveend', redraw);

function setHash(obj) {
  params = extend({}, params, obj);
  hashable.set(params);
}

function buildListings(listings) {
  $listings.innerHTML = '';
  if (params.exclude.length) {
    listings = listings.filter(function(d) {
      return params.exclude.indexOf(d.properties.category) === -1;
    });
  }

  listings = groupBy(listings, function(d) {
    return d.properties.category;
  });

  for (var prop in listings) {

    var fill = '#ddd';
    var section = document.createElement('div');
    section.className = 'property-group';

    section.setAttribute('data-properties', listings[prop].length);
    layers.forEach(function(l) {
      if (l[0] === parseInt(prop, 10)) {
        fill = l[1];
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
      feature.fill = fill;
      var item = document.createElement('div');
      item.innerHTML = listingTemplate(feature);
      section.appendChild(item);

      item.querySelector('button').addEventListener('click', function(e) {
        var elements = $listings.querySelectorAll('button');

        Array.prototype.forEach.call(elements, function(el) {
          el.classList.remove('active');
        });

        e.target.classList.add('active');
        buildPopup(feature);
      });

      item.querySelector('button').addEventListener('mouseover', function() {
        buildPopup(feature);
      });
    });

    $listings.appendChild(section);
    loading(false);
  }
}

function fill(d) {
  var v;
  layers.forEach(function(layer) {
    if (layer[0] === d.properties.category) v = layer[1];
  });
  return v;
}

function buildPopup(d) {
  // Adding an extra property for displaying the category name
  d = _.merge(d, {
    properties: {
      categoryName: categoryName(d.properties.category)
    }
  });
  popup
    .remove()
    .setLngLat(d.geometry.coordinates)
    .setHTML(popupTemplate(d))
    .addTo(map);
}

function buildHeader(container, section) {
  var properties = section.getAttribute('data-properties');
  var category = section.getAttribute('data-category');
  var fill = section.getAttribute('data-fill');

  var title = document.createElement('strong');
  title.className = 'small quiet space-right0';
  title.textContent = category || 'Other category';

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
  popup.remove();
  loading(true);
  $listingsHeader.innerHTML = $listings.innerHTML = '';
  map.dragPan.enable();

  if (e && e.end) {
    position = {
      x: e.end.x + innerRadius / 2,
      y: e.end.y + innerRadius / 2
    };

    var c = map.unproject(position);
    setHash({center: [c.lng, c.lat]});
  }

  var r = parseInt(params.radius, 10);
  var ne = new mapboxgl.Point(position.x + r, position.y - r);
  var sw = new mapboxgl.Point(position.x - r, position.y + r);

  featuresIn(map, [ne, sw], function(err, features) {
    if (err) return emitError(err.message);
    if (!features.length) return emitError('No properties found');

    var center = map.unproject(position);
    var radius = resolution(parseInt(params.radius, 10), position).miles;

    // Filter results to the radius
    var listings = geojson.features = features.filter(function(d) {
      return distance(d, point([center.lng, center.lat]), 'miles') < radius;
    }).map(function(d, i) {
      d.properties.id = i;
      return d;
    });

    map.getSource('within').setData(geojson);
    buildListings(listings);
  });
}

circle.on('result', redraw);

// Radius changer
$radius.querySelector('input').addEventListener('input', function(e) {
  setHash({radius: e.target.value });
  updateRadiusLabel(params.radius);
  circle.setRadius(params.radius);
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
  var sections = $listings.querySelectorAll('.property-group');
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

map.on('click', function(e) {
  map.featuresAt(e.point, {
    radius: 5,
    includeGeometry: true,
    layer: layers.map(function(d, i) {
      return 'poi-' + i;
    })
  }, function(err, features) {
    if (err || !features.length) return;
    var feature = features[0];
    feature.fill = fill(feature);
    buildPopup(feature);

    // Jump to its entry in the sidebar listings
    var target = document.getElementById('property-' + feature.properties.id);
    if (target) {
      $listings.scrollTop = target.offsetTop - $listings.offsetTop;

      // Remove any previously active listings
      Array.prototype.forEach.call($listings.querySelectorAll('button'), function(el) {
        el.classList.toggle('active', el.id === target.id);
      });
    }
  });
});

map.on('mousemove', function(e) {
  map.featuresAt(e.point, {
    radius: 5,
    layer: layers.map(function(d, i) {
      return 'poi-' + i;
    })
  }, function(err, features) {
    map.getCanvas().style.cursor = (!err && features.length) ? 'pointer' : '';
  });
});

function updateRadiusLabel(r) {
  var res = resolution(r, position);
  $radiusValue.textContent = res.miles > 1 ?
    res.miles.toFixed(1) + ' mi.' :
    res.meters.toFixed() + ' m';
}

/*
 * Calculate ground resolution by a given radius
 * From https://msdn.microsoft.com/en-us/library/bb259689.aspx
 * cos(latitude * pi/180) * earth circumference / map width
 *
 * @param {number} r current radius in pixels
 * @param {object} pos { x: n, y: n } pixel coordinates of the circle
 * @returns {object} { meters: n, miles: n }
 */
function resolution(r, pos) {
  var z = map.getZoom();

  // pos.x = pos.x + 15;
  // pos.y = pos.y + 15;

  var lat = map.unproject(pos).lat;
  var earthCircumference = 2 * Math.PI * 6378137; // Earths radius in meters
  var gr = Math.cos((lat * Math.PI / 180)) *  earthCircumference / (512 * Math.pow(2, z));
  return {
    meters: gr * r,
    miles: (gr * r) / 1609.344 // meters in a mile
  };
}

map.on('moveend', function() {
  setHash({ zoom: map.getZoom().toFixed(2) });
  updateRadiusLabel(parseInt(params.radius, 10));
});

map.on('load', initialize);
