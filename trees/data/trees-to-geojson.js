'use strict';

var fs = require('fs');
var neatCsv = require('neat-csv');

// Data available at:
// https://data.cityofnewyork.us/Environment/Street-Tree-Census-Manhattan-/e6n3-m3vc
var csv = fs.readFileSync('./ManhattanTree.csv');

// Parse the CSV
neatCsv(csv, function(err, res) {
  if (err) return console.log(err);

  var geojson = {
    type: 'FeatureCollection',
    features: []
  };

  // Format as GeoJSON
  res.forEach(function(d) {

    if (d.the_geom) {

      // Parse coordinates to return a lng/lat array
      var coords = d.the_geom
        .replace(/[POINT]/g, '')
        .replace(/[(]/g, '')
        .replace(/[)]/g, '')
        .trim()
        .split(' ');

      coords = [parseFloat(coords[0]), parseFloat(coords[1])];
      geojson.features.push({
        type: 'Feature',
        properties: {
          diameter: parseFloat(d.DIAMETER),
          species: d.SPECIES,
          parity: d.PARITY,
          condition: parseInt(d.TREECONDIT, 10)
        },
        geometry: {
          type: 'Point',
          coordinates: coords
        }
      });
    }
  });

  console.log(JSON.stringify(geojson, null, 2));
});
