'use strict';

/* global mapboxgl */
/* eslint-disable new-cap */
mapboxgl.accessToken = process.env.MapboxAccessToken;

// Node modules that browserify supports
var fs = require('fs');
var path = require('path');

var turfSimplify = require('turf-simplify');
var turfWithin = require('turf-within');
var groupBy = require('lodash.groupby');
var rainbow = require('rainbow');
var Pencil = require('pencil');

// Data
var trees = JSON.parse(fs.readFileSync(path.join(__dirname, '/data/trees.geojson'), 'utf8'));
var codes = JSON.parse(fs.readFileSync(path.join(__dirname, '/data/species.json'), 'utf8'));

// Set bounds to New York, New York
var bounds = [
  [-74.15990042526758, 40.691133514333956], // Southwest coordinates
  [-73.78111395202126, 40.845586933304276]  // Northeast coordinates
];

var map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/light-v8',
  center: [-73.9903, 40.7262],
  zoom: 12.75,
  minZoom: 12,
  maxBounds: bounds
});

var popup = new mapboxgl.Popup({
  closeButton: false
});

var legend = document.getElementById('legend');
var aggregateContainer = document.getElementById('aggregates');
var defaultText = document.createElement('strong');
  defaultText.textContent = trees.features.length.toLocaleString() + ' total trees';

aggregateContainer.appendChild(defaultText);

var drawControls = document.getElementById('draw-controls');
var drawCanvas = document.getElementById('canvas');
var draw, clearSelection;

var pencil = new Pencil(drawCanvas);

// Colorized circles to represent trees
// [<cooresponding diameter>, <color>]
var layers = [
  [60, '#10525A', 6],
  [50, '#096869', 5.5],
  [40, '#0D8074', 5],
  [30, '#23977C', 4.5],
  [20, '#40AF7F', 4],
  [10, '#62C67F', 3.5],
  [5, '#88DC7C', 3],
  [0, '#B2F277', 2.5]
];

function initialize() {
  document.body.classList.remove('loading');

  map.addSource('trees', {
    type: 'geojson',
    data: {
      type: 'FeatureCollection',
      features: []
    }
  });

  map.addSource('geojson', {
    type: 'geojson',
    data: {
      type: 'FeatureCollection',
      features: []
    }
  });

  // Polygon style
  map.addLayer({
    id: 'polygon-query-fill',
    type: 'fill',
    source: 'geojson',
    paint: {
      'fill-color': '#027dbd',
      'fill-opacity': 0.05
    }
  }, 'place_label_neighborhood');

  map.addLayer({
    id: 'polygon-query-line',
    type: 'line',
    source: 'geojson',
    paint: {
      'line-color': '#027dbd',
      'line-join': 'round',
      'line-width': 2
    }
  }, 'place_label_neighborhood');

  // Tree markers
  layers.forEach(function(layer, i) {
    map.addLayer({
      id: 'tree-markers-' + i,
      type: 'circle',
      source: 'trees',
      interactive: true,
      paint: {
        'circle-color': layer[1],
        'circle-radius': layer[2],
        'circle-opacity': 0.75
      },
      filter: i == 0 ?
        ['>=', 'diameter', layer[0]] :
        ['all',
            ['>=', 'diameter', layer[0]],
            ['<', 'diameter', layers[i - 1][0]]]
    }, 'place_label_neighborhood');
  });

  // Set the draw canvas to the same width+height as the map.
  drawCanvas.setAttribute('width', map.getCanvas().offsetWidth);
  drawCanvas.setAttribute('height', map.getCanvas().offsetHeight);

  // Add the draw control to the map
  draw = document.createElement('button');
  draw.id = 'draw';
  draw.className = 'icon pencil button round-right draw-ctrl';
  draw.title = 'Draw';

  draw.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();

    if (draw.classList.contains('active')) {
      disableDraw();
    } else {
      draw.classList.add('active');
      drawCanvas.classList.remove('hidden');
      drawCanvas.style.cursor = 'crosshair';
      pencil.enable();
    }
  });

  drawControls.appendChild(draw);

  pencil.on('result', function(e) {
    var feature = {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [[]]
      }
    };

    e.result.forEach(function(res) {
      var coords = map.unproject(res);
      feature.geometry.coordinates[0].push([coords.lng, coords.lat]);
    });

    // Push the first entry to complete the shape
    feature.geometry.coordinates[0].push(feature.geometry.coordinates[0][0]);

    // Simplify the feature.
    feature = turfSimplify(feature, 0.0001, true);
    redraw(feature);

    // Clear the draw canvas
    disableDraw();
  });

  buildLegend();
}

function redraw(feature) {
  var geojson = {
    type: 'FeatureCollection',
    features: feature ? [feature] : []
  };

  // Grab all the features and draw them as polygons on the map
  map.getSource('geojson').setData(geojson);

  // Is there tree data within the drawn features?
  var within = feature ? turfWithin(trees, geojson) : geojson;

  // Add to map
  map.getSource('trees').setData(within);

  // Build aggregation
  aggregateContainer.innerHTML = '';
  if (within.features.length) {
    var count = document.createElement('strong');
    count.className = 'block space-bottom1';
    count.textContent = within.features.length.toLocaleString() + ' trees selected';
    aggregateContainer.appendChild(count);

    var aggregates = [{
      label: 'Tree diameter',
      range: ['#b2f277', '#10525a'],
      aggregate: groupBy(within.features, function(d) {
        var diameter = d.properties.diameter;
        if (!diameter) diameter = 'UNKNOWN';
        return diameter;
      })
    }, {
      label: 'Condition',
      aggregate: groupBy(within.features, function(d) {
        var condition = d.properties.condition;
        if (!condition) condition = 'UNKNOWN';
        return condition;
      })
    }, {
      label: 'Species',
      aggregate: groupBy(within.features, function(d) {
        var species = d.properties.species;
        if (!species || species === '0') {
          species = 'UNKNOWN';
        } else {
          codes.forEach(function(code) {
            species = species === code.code ? code.name : species;
          });
        }
        return species;
      })
    }];

    aggregates.forEach(function(d) {
      var label = document.createElement('strong');
      label.className = 'block space-bottom0 quiet small strong';
      label.textContent = d.label;
      aggregateContainer.appendChild(label);

      var barContainer = document.createElement('div');
      barContainer.className = 'clearfix col12 space-bottom1 dark contain';

      if (d.range) {
        var keys = Object.keys(d.aggregate).length;
        var range = rainbow.range(d.range[0], d.range[1], keys);
        var index = 0;
      }

      for (var prop in d.aggregate) {
        var bar = document.createElement('div');
        bar.className = 'fl bar fill-blue pad0y';

        var percentage = (d.aggregate[prop].length / within.features.length) * 100;
        percentage = percentage < 1 ? percentage.toFixed(1) : Math.floor(percentage);

        bar.style.width = percentage + '%';
        if (d.range) bar.style.backgroundColor = prop === 'UNKNOWN' ?
            '#666' : range[index];
        var tooltip = prop + ' (' + percentage + '%)';
        bar.setAttribute('data-tooltip', tooltip.toLowerCase());
        barContainer.appendChild(bar);
        index++;
      }

      aggregateContainer.appendChild(barContainer);
    });
  } else {
    aggregateContainer.appendChild(defaultText);
  }

  if (feature && !clearSelection) {
    // Add remove selection link
    clearSelection = document.createElement('button');
    clearSelection.className = 'dark button round-left pad2x draw-ctrl keyline-right';
    clearSelection.textContent = 'Clear selection';
    clearSelection.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      redraw();
    });
    drawControls.insertBefore(clearSelection, draw);
  }

  if (!feature && clearSelection) {
    drawControls.removeChild(clearSelection);
    clearSelection = null;
  }

  legend.classList.toggle('hidden', !feature);
}

function disableDraw() {
  if (!draw) return;
  draw.classList.remove('active');
  drawCanvas.classList.add('hidden');
  drawCanvas.style.cursor = '';
  pencil.disable().clear();
}

function buildLegend() {
  var title = document.createElement('h4');
  title.className = 'block space-bottom0';
  title.textContent = 'Tree diameter';
  var list = document.createElement('div');

  layers.reverse().forEach(function(layer, i) {
    var item = document.createElement('div');
    item.className = 'inline dot';
    if (i !== 0) item.classList.add('space-left0');
    item.style.backgroundColor = layer[1];
    item.style.width = layer[2] * 2 + 'px';
    item.style.height = layer[2] * 2 + 'px';
    list.appendChild(item);
  });

  var key = document.createElement('div');
  key.className = 'mobile-cols clearfix small strong quiet';

  var start = document.createElement('div');
  start.className = 'col6';
  start.textContent = layers[0][0];
  key.appendChild(start);

  var end = document.createElement('div');
  end.className = 'col6 text-right';
  end.textContent = layers[layers.length - 1][0];
  key.appendChild(end);

  legend.appendChild(title);
  legend.appendChild(list);
  legend.appendChild(key);
}

map.on('mousemove', function(e) {
  map.featuresAt(e.point, {
    radius: 2.5, // Half the marker size (5px).
    includeGeometry: true,
    layer: layers.map(function(layer, i) {
      return 'tree-markers-' + i;
    })
  }, function(err, features) {
    // Change the cursor style as a UI indicator.
    map.getCanvas().style.cursor = (!err && features.length) ? 'pointer' : '';

    if (err || !features.length) {
      popup.remove();
      return;
    }

    var feature = features[0];
    var p = feature.properties;
    var popupContainer = document.createElement('div');

    // Look up species code for proper name
    codes.forEach(function(code) {
      p.species = p.species === code.code ? code.name : p.species;
    });

    [
      ['Species', p.species.toLowerCase()],
      ['Condition', p.condition],
      ['Diameter', p.diameter]
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
