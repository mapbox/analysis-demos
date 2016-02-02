'use strict';

var fs = require('fs');
var neatCsv = require('neat-csv');

// Data available at:
// https://www.opendataphilly.org/dataset/opa-property-assessments
var csv = fs.readFileSync('./Properties.csv');

var geojson = {
  type: 'FeatureCollection',
  features: []
};

// Parse the CSV
neatCsv(csv, function(err, res) {
  if (err) return console.log(err);
  var half = res.splice(0, Math.ceil(res.length / 2));
  half.forEach(formatAndPush);

  console.log(JSON.stringify(geojson));
});

function formatAndPush(d) {
  if (!d.Coordinates) return;

  // Parse coordinates to return a lng/lat array
  var coords = d.Coordinates
    .replace(/[(]/g, '')
    .replace(/[)]/g, '')
    .trim()
    .split(',');

  coords = [parseFloat(coords[1]), parseFloat(coords[0])];

  var price = d['Sale Price'] ?
    '$' + parseFloat(d['Sale Price'].replace('$', '')).toLocaleString() :
    'N/A';

  var layers = [
    'RESIDENTIAL',
    'COMMERCIAL',
    'HOTELS AND APARTMENTS',
    'STORE WITH DWELLING',
    'VACANT LAND',
    'INDUSTRIAL'
  ];

  var properties = {
    category: layers.indexOf(d['Category Code Description']),
    address: d.Location,
    price: price
  };

  if (d['Category Code Description'] !== 'VACANT LAND') {
    properties.stories = d['Number Stories'] ? parseFloat(d['Number Stories']) : 'N/A';
    properties.rooms = d['Number of Rooms'] ? parseFloat(d['Number of Rooms']) : 'N/A';
  }

  if (d['Category Code Description'] === 'RESIDENTIAL') {
    properties.bedrooms = d['Number of Bedrooms'] ? parseFloat(d['Number of Bedrooms']) : 'N/A';
    properties.bathrooms = d['Number of Bathrooms'] ? parseFloat(d['Number of Bathrooms']) : 'N/A';
  }

  geojson.features.push({
    type: 'Feature',
    properties: properties,
    geometry: {
      type: 'Point',
      coordinates: coords
    }
  });
}
