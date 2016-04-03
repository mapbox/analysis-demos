#!/bin/bash

set -e -u

echo "Downloading DENUE dataset for Distrito Federal (State code: 09)"
mkdir -p data
cd data
wget -O - http://www3.inegi.org.mx/sistemas/descarga/descargaarchivo.aspx?file=DENUE%2fEntidad_federativa%2f09_Distrito_Federal%2fdenue_09_25022015_shp.zip > denue_09_25022015.zip
unzip denue_09_25022015.zip
echo "Transforming data to vector tilesets"
ogr2ogr -f GeoJSON denue_09_25022015.json DENUE_INEGI_09_.shp -select nom_estab,codigo_act,latitud,longitud -progress
tippecanoe -o denue_09_25022015.mbtiles denue_09_25022015.json
cd ..
