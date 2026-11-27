# Fase 9.7 · Archivo histórico de vuelos observados

## Meses incorporados

El catálogo pasó de 5 a 14 meses. Los 9 agregados nuevos ocupan 65.7 MB de JSON en disco. Los archivos originales verificados se guardan localmente.

| Mes UTC | Vuelos | Países de salida / llegada | Aeropuertos | Rutas | Días | Original | MD5 de Zenodo |
| --- | ---: | ---: | ---: | ---: | ---: | --- | --- |
| 2019-04 | 827 256 | 94 / 100 | 2 613 | 56 353 | 30 | `flightlist_20190401_20190430.csv.gz` | `ff94e9dfb097d3fd4bfc9fbbcc1c1afd` |
| 2019-05 | 921 638 | 92 / 97 | 2 508 | 59 519 | 31 | `flightlist_20190501_20190531.csv.gz` | `b313479fec64ebf41b0fe565a6259b26` |
| 2019-06 | 939 235 | 93 / 99 | 2 636 | 63 676 | 30 | `flightlist_20190601_20190630.csv.gz` | `779fa26d2486650de4de16886c689ae4` |
| 2019-07 | 1 010 001 | 93 / 99 | 2 683 | 65 150 | 31 | `flightlist_20190701_20190731.csv.gz` | `925cec191fd85b531963c6e8e5fc6699` |
| 2019-08 | 1 085 170 | 94 / 101 | 2 750 | 68 991 | 31 | `flightlist_20190801_20190831.csv.gz` | `3b90fa2c8fb8021878e8e7f061d0b7df` |
| 2019-09 | 1 025 492 | 96 / 99 | 2 795 | 68 512 | 30 | `flightlist_20190901_20190930.csv.gz` | `3d60ffbbf746551eb7fb2b336e5c6fb4` |
| 2019-10 | 1 147 698 | 101 / 105 | 2 748 | 68 638 | 31 | `flightlist_20191001_20191031.csv.gz` | `51fa395d700d57e823d23c97a4fadd95` |
| 2019-11 | 1 055 636 | 96 / 102 | 2 660 | 61 032 | 30 | `flightlist_20191101_20191130.csv.gz` | `0278dbab70c75f3418c350835722e025` |
| 2019-12 | 1 079 538 | 97 / 107 | 2 686 | 61 592 | 30 | `flightlist_20191201_20191231.csv.gz` | `9493dc8fa6b46fc7bde7615542dc597f` |

- 2019 · 12 meses disponibles.
- 2020 · Pendientes: 2020-01, 2020-02, 2020-03, 2020-05, 2020-06, 2020-07, 2020-08, 2020-09, 2020-10, 2020-11, 2020-12.
- 2021 · Pendientes: 2021-01, 2021-03, 2021-04, 2021-05, 2021-06, 2021-07, 2021-08, 2021-09, 2021-10, 2021-11, 2021-12.
- 2022 a septiembre de 2026 · OPDI, 57 meses publicados en la fuente, sin periodos habilitados en el sitio.

## Fuentes, alcance y reproducción

El archivo original de diciembre de 2019 contiene cero filas con primera observación el 14 de diciembre; el calendario deshabilita ese día. Los doce meses de 2019 suman 11 428 841 vuelos observados en 364 de 365 días.

La serie pública utiliza la [edición v21.12 de Zenodo](https://zenodo.org/records/5815448), DOI `10.5281/zenodo.5815448`, de Xavier Olive, Martin Strohmeier y Jannis Lübbe, The OpenSky Network, distribuida con [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Los datos se filtraron, deduplicaron y agregaron. El catálogo geográfico complementario procede de [OurAirports](https://ourairports.com/data/), que publica sus datos en el dominio público. SHA-256 de la copia usada: `b6ae8329691c9fc7b89d840e386fe65a9986e125c808cf885ae73e1ecb18aea8`.

Un vuelo observado en el telar es una trayectoria ADS-B reconstruida, con origen y destino distintos y códigos ICAO utilizables. Los extremos son estimaciones de la fuente. El proceso deduplica por `aircraft_uid` y primera observación UTC, y suma por día, origen y destino direccional. Conserva el criterio anterior de atribuir cada registro a `firstseen` dentro del mes nominal del archivo. Zenodo define el campo original `day` por última observación, por lo que se excluyen las trayectorias que empezaron antes del mes nominal y aparecen en el archivo siguiente. Los totales representan observaciones incluidas, nunca un censo mundial.

### Herramienta local

Requiere Python 3.9 o posterior, Node.js, curl y la copia del catálogo CSV que usa el histórico. Guarda el catálogo y los originales fuera de la carpeta pública. Desde la raíz del repositorio:

```sh
ARCHIVO="$HOME/Documents/Codex/2026-11-26/ho/work"
PYTHONDONTWRITEBYTECODE=1 python3 tools/expand_opensky.py --cache "$ARCHIVO" --airports "$ARCHIVO/ourairports.csv"
PYTHONDONTWRITEBYTECODE=1 python3 tools/expand_opensky.py --cache "$ARCHIVO" --airports "$ARCHIVO/ourairports.csv" --download YYYY-MM YYYY-MM YYYY-MM
node --test *.test.cjs
```

Sin meses, la herramienta muestra los integrados y los pendientes. Sustituye los marcadores por hasta tres meses diferentes. En cada lote comprueba tamaño y MD5 publicado, reutiliza originales válidos, procesa un agregado a la vez, rechaza conflictos en coordenadas y actualiza el índice tras validar con el mismo importador que usa el sitio. Los meses integrados se omiten. El registro local `opensky-imports.jsonl` guarda conteos, exclusiones, tamaño, original y huellas de los archivos. Los originales, las copias en proceso y el registro local permanecen fuera del repositorio. Ejecuta un lote a la vez.

El índice contiene los recuentos diarios y el navegador solicita solo los meses que intersectan el intervalo elegido. La caché de orígenes mensuales conserva tres entradas. Los filtros de país, ciudad y aeropuerto consultan los extremos presentes en el periodo; el presupuesto de fibras puede omitir rutas del dibujo, pero el contador sigue sumando todas las rutas válidas. Los días ausentes no se rellenan y los periodos parciales muestran su cobertura. La cifra mundial independiente sigue sin datos.

## OPDI · resultados de auditoría local

| Archivo v0.0.2 del portal | Filas | Vuelos válidos únicos | Países y territorios en ambos extremos | Aeropuertos | Rutas |
| --- | ---: | ---: | ---: | ---: | ---: |
| `flight_list_202201.parquet` | 814 040 | 239 803 | 45 | 628 | 18 808 |
| `flight_list_202404.parquet` | 1 295 575 | 438 476 | 55 | 713 | 26 617 |
| `flight_list_202609.parquet` | 1 639 154 | 587 851 | 56 | 786 | 38 278 |

[OPDI Flight List v0.0.2](https://www.opdi.aero/flight-list-data.html) ofrece los Parquet para enero de 2022 a septiembre de 2026. [La metodología](https://www.opdi.aero/methodology) agrupa estados por ICAO24 y distintivo, segmenta trayectorias y estima ADEP y ADES mediante celdas H3 en la segunda iteración. [El diccionario conceptual](https://www.opdi.aero/concepts) define DOF por la primera observación. El adaptador local exige que DOF coincida con el día UTC de `first_seen`, deduplica por identificador OPDI y requiere dos extremos catalogables. Enero de 2022 y abril de 2024 contienen la etiqueta interna `v2.0.0`; septiembre de 2026 contiene `v0.0.2`. Los países de la tabla corresponden a la muestra utilizable del adaptador, con mayor presencia europea.

[El portal](https://www.opdi.aero/about.html) describe un objetivo de uso no comercial y atribución. La revisión de la ficha de descarga y de las [condiciones generales de EUROCONTROL](https://www.eurocontrol.int/info/privacy-and-website-terms-use) no localizó una licencia específica inequívoca para publicar en GitHub Pages los agregados derivados de esos Parquet, con datos de terceros. Los archivos y resultados de procesamiento se mantienen en local. Para incorporar OPDI se requiere confirmar por escrito el permiso de redistribución pública de agregados por día y ruta y el texto de atribución aplicable. Con esa confirmación, indexar los tres meses piloto como serie separada y validar el selector y la comparación antes de procesar el resto por lotes. Cuando los proveedores sean distintos, mostrar ambos recuentos con su procedencia y omitir diferencias porcentuales directas: cobertura, detección y reglas de inclusión difieren incluso cuando ambos parten de ADS-B.

## Verificación en Safari

Abre [el sitio](https://vaaneesaar.github.io/un-mundo-entre-hilos/#telar), abre Fecha y elige año, mes disponible y un día con registros. Selecciona Mes para ver el agregado del mes o Día para ver el recuento del punto de la gráfica. En Comparar elige dos fechas independientes. Los porcentajes requieren igual duración y cobertura completa dentro de la misma serie. Al recargar se recupera el último periodo en esa pestaña. Inicio → Comenzar a tejer abre el primer día real disponible.
