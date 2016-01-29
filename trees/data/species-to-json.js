'use strict';

var fs = require('fs');
var neatCsv = require('neat-csv');

// Data from:
// https://raw.githubusercontent.com/blacki/leaves/e165c2c3cd29339e86bef6364719e01e547469b4/public/data/nyc-stc.csv
var csv = fs.readFileSync('./species.csv');

// Parse the CSV
neatCsv(csv, function(err, res) {
  if (err) return console.log(err);
  console.log(JSON.stringify(res, null, 2));
});
