Population & median income by county
---

Draw a box on a map or geocode search to query features inside it. __Note:__
This requires your account to have access to Surface API. learn more & request
access here: https://www.mapbox.com/blog/introducing-the-surface-api/

![demo](http://i.imgur.com/pqBgJWI.gif)

__Demo:__ https://www.mapbox.com/analysis-demos/census/

### Building

    MapboxAccessToken=<YOUR TOKEN> npm run build

Compiles a minified `bundle.js` for production

### About the data

Polygon data was derived from https://github.com/mbostock/us-atlas

#### 2014 Median household income
State: http://censusreporter.org/data/table/?table=B19013&geo_ids=040|01000US
County: http://censusreporter.org/data/table/?table=B19013&geo_ids=050|01000US

#### 2014 Total population
State: http://censusreporter.org/data/table/?table=B01003&geo_ids=040|01000US
County: http://censusreporter.org/data/table/?table=B01003&geo_ids=050|01000US

### Running

    npm install
    npm start && open http://localhost:9966/
