# Fase 9.5 · Muestra internacional

La aplicación carga automáticamente `data/opensky-febrero-2019.json` por HTTP. El agregado local ocupa 5,710,594 bytes. Abril ampliado se conserva como `data/opensky-abril-2020-ampliado.json` y se puede cargar manualmente. Ambos se derivan de la [edición CC BY 4.0 de OpenSky](https://zenodo.org/records/5815448), DOI 10.5281/zenodo.5815448. El catálogo amplía los anclajes con coordenadas de [OurAirports](https://github.com/davidmegginson/ourairports-data). Se conservan los anclajes de los nueve aeropuertos preexistentes. Se admitieron códigos ICAO explícitos, unívocos y con coordenadas válidas. Un directorio actual puede dejar fuera aeropuertos históricos o códigos locales, como EDDT en febrero.

| Muestra | Vuelos | Países de destino | Aeropuertos en las rutas | Pares direccionales |
| --- | ---: | ---: | ---: | ---: |
| Abril 2020 original | 1,203 | 6 | 8 | 38 |
| Abril 2020 con catálogo ampliado | 279,216 | 95 | 2,491 | 34,942 |
| Febrero 2019 con catálogo ampliado | 753,347 | 100 | 2,678 | 53,854 |

Contando los países de ambos extremos, febrero incluye 102 y abril ampliado, 97. México aporta 1,004 llegadas en febrero.

## Auditoría de las exclusiones de abril

Archivo original `flightlist_20200401_20200430.csv.gz`, MD5 `2c71d6b5c4aae5933ccb649939c67a55`. Las categorías son excluyentes. Primero se determina el mes UTC por primera observación, luego se validan los extremos, los códigos y la identidad de vuelo.

| Motivo | Catálogo original | Catálogo ampliado |
| --- | ---: | ---: |
| Códigos fuera del catálogo, con ambos extremos presentes y distintos | 455,195 | 177,140 |
| Solo origen desconocido | 152,697 | 152,697 |
| Solo destino desconocido | 88,806 | 88,806 |
| Ambos desconocidos | 38,999 | 38,999 |
| Fuera del mes de primera observación | 2,389 | 2,389 |
| Mismo aeropuerto en ambos extremos | 103,616 | 103,616 |
| Duplicados entre vuelos con extremos admitidos | 0 | 42 |
| Otros errores | 0 | 0 |

Se recuperaron 278,013 vuelos únicos de abril. Los códigos oportunamente admitidos por el catálogo pueden corresponder a vuelos comerciales, privados o de otras clases. La identidad de vuelo reconstruido combina el identificador anonimizado de aeronave y su primera observación UTC. El resultado es una muestra ADS-B con extremos estimados y cobertura territorial desigual. El CSV se empaqueta por última observación, de modo que los bordes mensuales por primera observación pueden ser incompletos.

Febrero se reproduce con `flightlist_20190201_20190228.csv.gz` (MD5 `336baa5ceee0184445666a54c61f5743`) y `tools/build_international_sample.py` más `airports.csv` de OurAirports (MD5 del catálogo utilizado `52b66125f9571b86e82ecd34e3b1f080`). Para reproducir el agregado, ejecutar:

```sh
python3 tools/build_international_sample.py flightlist_20190201_20190228.csv.gz airports.csv \
  --retrieved-at FECHA_REAL_UTC --output data/opensky-febrero-2019.json
```

Los agregados son tuplas por fecha UTC y par de aeropuertos con su recuento exacto. Sus dos extremos deben existir en el catálogo y los pares duplicados se rechazan. El JSON no incluye observaciones individuales ni total mundial. El modo Real sigue mostrando — para el total mundial.

## Lectura de datos y material textil

El indicador principal cuenta todos los vuelos válidos de la muestra en el periodo. Los países incluyen ambos extremos. El selector de país usa llegadas y el panel del destino muestra su subconjunto. Las barras son fechas realmente disponibles. La variación se muestra cuando los dos intervalos contiguos tienen la misma duración y todos sus días tienen observaciones. En comparación se mantiene la escala compartida de hebras.

El telar conserva su límite de geometría. En periodos densos selecciona rutas de gran volumen y reserva parte de ese cupo a enlaces de mayor alcance, ponderados por volumen. El destino activo recibe prioridad, dejando un fondo de conexiones. Las rutas elegidas se reparten hebras proporcionalmente por restos mayores. Cada hebra representa una fracción entera de vuelos de su ruta, y la ficha muestra el recuento de la hebra y el de la ruta. Las rutas fuera del cupo constan en el indicador WebGL y siguen en las cifras. El relieve y el grosor reutilizan el cálculo de concentración de vuelos. La muestra de vuelos visualizada y el total de la muestra representan niveles distintos de detalle.

## Evaluación de OPDI

[OPDI v0.0.2](https://www.opdi.aero/data) cubre enero de 2022 a septiembre de 2026. Publica listas mensuales en Parquet. El archivo de septiembre de 2026 anuncia 49,742,078 bytes. Su definición parte de trayectorias ADS-B reconstruidas, con aeródromos asignados y fecha de primera detección. La metodología y las vistas se centran en Europa y su entorno. Pueden aparecer aeropuertos externos, sin que eso implique cobertura mundial. Para incorporarlo habría que leer Parquet fuera del navegador, validar aeropuertos y deduplicar por ID, conservar su metodología y convertir a la estructura de agregados. El proyecto OPDI describe atribución y uso abierto no comercial, pero no encontré una licencia específica inequívoca para redistribuir la lista v0.0.2 dentro de la aplicación. Se conserva como candidato para un estudio europeo posterior. Fuentes: [visión de OPDI](https://www.opdi.aero/about.html), [conceptos](https://www.opdi.aero/concepts), [descarga](https://www.opdi.aero/flight-list-data.html).
