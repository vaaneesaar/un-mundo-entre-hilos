# Explorador histórico

## OpenSky en el telar

| Mes UTC | Archivo original | Vuelos en la muestra | Países de llegada | Rutas direccionales |
| --- | --- | ---: | ---: | ---: |
| Enero de 2019 | flightlist_20190101_20190131.csv.gz | 777 959 | 98 | 52 500 |
| Febrero de 2019 | flightlist_20190201_20190228.csv.gz | 753 347 | 100 | 53 854 |
| Marzo de 2019 | flightlist_20190301_20190331.csv.gz | 805 871 | 101 | 54 954 |
| Abril de 2020 | flightlist_20200401_20200430.csv.gz | 279 216 | 95 | 34 942 |
| Febrero de 2021 | flightlist_20210201_20210228.csv.gz | 574 914 | 106 | 59 257 |

Los cinco originales se cotejaron con los MD5 publicados. Los agregados agrupan los vuelos reconstruidos por fecha UTC de primera observación, origen y destino. La primera observación no equivale a un despegue confirmado. Solo se cuentan registros utilizables con dos aeropuertos catalogados. Un mes con observaciones en cada día tiene cobertura temporal completa en el extracto y sigue siendo una muestra geográfica. Los demás meses de 2019–2021 están publicados y pendientes de procesamiento por lotes. [OpenSky Network, edición v21.12, CC BY 4.0](https://zenodo.org/records/5815448).

## OPDI auditado por separado

| Archivo Parquet | Filas originales | Vuelos únicos con extremos catalogados | Países y territorios en ambos extremos |
| --- | ---: | ---: | ---: |
| flight_list_202201.parquet | 814 040 | 239 803 | 45 |
| flight_list_202404.parquet | 1 295 575 | 438 476 | 55 |
| flight_list_202609.parquet | 1 639 154 | 587 851 | 56 |

El adaptador lee por lotes con PyArrow, deduplica por ID de OPDI, valida fecha UTC y acepta los extremos ADEP y ADES cuando ambos son utilizables. Los dos primeros archivos declaran v2.0.0 en sus filas y el tercero declara v0.0.2. La versión publicada en el portal para el producto es v0.0.2. Puede auditarse con `python3 tools/opdi_parquet.py --help`. OPDI segmenta trayectorias por identificador de aeronave y distintivo de llamada y tiene un foco europeo. OpenSky y OPDI tienen distintos criterios de reconstrucción, asignación aeroportuaria y cobertura. Se requiere confirmar permiso de redistribución para empaquetar OPDI con la aplicación. No se publica una serie combinada. [Archivos OPDI](https://www.opdi.aero/flight-list-data.html) · [Metodología](https://www.opdi.aero/methodology) · [Alcance](https://www.opdi.aero/about.html).

## Añadir un mes y verificarlo

1. Descarga el CSV.GZ de un mes desde Zenodo y toma el MD5 de la entrada del archivo.
2. Usa el procedimiento de agregación internacional de FASE-9.5.md para generar el JSON mensual en `data/`.
3. Ejecuta `node tools/index_history.cjs AAAA-MM data/opensky-AAAA-MM.json ORIGINAL.csv.gz MD5_PUBLICADO`. El comando verifica el original y actualiza el índice de forma atómica.
4. Ejecuta `node --test *.test.cjs`. Sirve la carpeta con `python3 -m http.server 8000 --bind 127.0.0.1` y abre http://127.0.0.1:8000 en Safari.
5. En Datos reales elige Año, Mes y Periodo. Usa la evolución diaria o el calendario para cambiar de día. Combina País de origen y País de destino, abre Comparar y recarga en la misma pestaña para comprobar la recuperación del periodo.

El índice conserva el total por día y la procedencia del original. El navegador solicita únicamente archivos mensuales que cruzan el intervalo y mantiene una caché acotada. La comparación utiliza la misma serie y exige igual duración y cobertura temporal observada para publicar una diferencia. Los filtros y el presupuesto visual no cambian el total real del agregado. Ante cobertura incompleta se muestran los días disponibles y el total mundial autorizado sigue separado.
