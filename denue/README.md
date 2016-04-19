Exploring half a million businesses in Mexico City

![explore-denue](https://raw.githubusercontent.com/mapbox/analysis-demos/denue/denue/denue.gif)

## DENUE?

[DENUE](http://busca.datos.gob.mx/#!/conjuntos/directorio-estadistico-nacional-de-unidades-economicas-denue-por-entidad-federativa/) is a national economic census conducted by [INEGI](https://en.wikipedia.org/wiki/INEGI). The census holds more than 5M records about any kind of business; from Mom & Pop shops to big 'maquilas'.

### Inside the box

By running `ogrinfo` we get an overview of the coverage of the database and some other technical details such as the projection and key names.

```bash
✗ ogrinfo -so data/DENUE_INEGI_09_.shp -sql "SELECT * FROM DENUE_INEGI_09_"
INFO: Open of `data/DENUE_INEGI_09_.shp'
      using driver `ESRI Shapefile' successful.

Layer name: DENUE_INEGI_09_
Geometry: Point
Feature Count: 452347
Extent: (-99.353300, 19.105389) - (-98.902086, 19.579282)
Layer SRS WKT:
GEOGCS["WGS84(DD)",
    DATUM["WGS84",
        SPHEROID["WGS84",6378137.0,298.257223563]],
    PRIMEM["Greenwich",0.0],
    UNIT["degree",0.017453292519943295],
    AXIS["Geodetic longitude",EAST],
    AXIS["Geodetic latitude",NORTH]]
Geometry Column = _ogr_geometry_
id: Integer (9.0)
nom_estab: String (200.0)
raz_social: String (200.0)
codigo_act: String (50.0)
nombre_act: String (254.0)
```

For the Mexico City area (Number 09) we can find 452,347 features, each of one tagged as one of 42,605 types of economic activities defined by [SCIAN](http://www3.inegi.org.mx/sistemas/SCIAN/scian.aspx) classification system.

We would like to understand which type of activities have the more frequency so we can group points by broader concepts.

Using the [csvkit](http://csvkit.readthedocs.org/en/0.9.1/) we can figure this out with a few commands.

```bash
✗ in2csv --format geojson data/denue_09_25022015.json > data/denue_09_25022015.csv
✗ csvcut -c 3 data/denue_09_25022015.csv | csvstat
  1. codigo_act
	<type 'int'>
	Nulls: False
	Min: 112512
	Max: 932110
	Sum: 251697203164
	Mean: 556425.052369
	Median: 466312
	Standard Deviation: 153225.095031
	Unique values: 908
	5 most frequent values:
		461110:	40997
		812110:	16979
		465311:	13317
		461130:	12931
		463211:	11851

Row count: 452347
```

We definitely find Mom & Pop shops ('Comercio al por menor en tiendas de abarrotes, ultramarinos y misceláneas (code: 461110, frequency: 40997).

## Setup

The following script downloads data from INEGI, unzips, filter out, and transform to vector tilesets. All files are placed in a `./data/` directory.

```bash
./data.sh
```

A few utilities are needed on your system to run this: [GDAL](https://wiki.ubuntu.com/UbuntuGIS), [Protobuf](https://github.com/google/protobuf/blob/master/src/README.md) and [tippecanoe](https://github.com/mapbox/tippecanoe).
