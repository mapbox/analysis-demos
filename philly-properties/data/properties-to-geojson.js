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

  var rooms = d['Number of Rooms'] ? parseFloat(d['Number of Rooms']) : 'N/A';
  var bedrooms = d['Number of Bedrooms'] ? parseFloat(d['Number of Bedrooms']) : 'N/A';
  var bathrooms = d['Number of Bathrooms'] ? parseFloat(d['Number of Bathrooms']) : 'N/A';
  var stories = d['Number Stories'] ? parseFloat(d['Number Stories']) : 'N/A';

  geojson.features.push({
    type: 'Feature',
    properties: {
      rooms: rooms,
      bedrooms: bedrooms,
      bathrooms: bathrooms,
      stories: stories,
      price: price,
      category: d['Category Code Description'],
      address: d.Location
    },
    geometry: {
      type: 'Point',
      coordinates: coords
    }
  });
}
