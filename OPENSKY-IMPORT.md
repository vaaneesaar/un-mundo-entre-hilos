# Importar vuelos históricos de OpenSky

Requisitos en Mac: Python 3.9 o posterior y Node.js. El conversor lee el catálogo existente mediante Node y procesa el CSV fila por fila, incluso comprimido. No instala paquetes ni modifica el telar.

Descarga `flightlist_20200401_20200430.csv.gz` desde la [edición CC BY 4.0 de Zenodo](https://zenodo.org/records/5815448). El MD5 publicado es `2c71d6b5c4aae5933ccb649939c67a55`. Compruébalo en Mac con `md5 -q ARCHIVO` antes de convertir. Guarda la fecha UTC de obtención del archivo.

```sh
cd ~/Desktop/TELAR_INTERACTIVO
python3 tools/opensky_to_json.py ~/Downloads/flightlist_20200401_20200430.csv.gz \
  --start 2020-04-01 --end 2020-04-07 \
  --airports KMCO MMMX --limit 500 --per-day 100 \
  --retrieved-at 'AAAA-MM-DDTHH:MM:SSZ' \
  --output ~/Desktop/TELAR_INTERACTIVO/opensky-abril.json
```

Sustituye el valor de `--retrieved-at` por la fecha real de descarga en UTC. Las fechas de filtro son inclusivas y se aplican a `firstseen`, la primera observación UTC. Por compatibilidad con la fase 9, ese instante se escribe literalmente en el campo `departureUtc`. La definición de la serie explica que es una observación y no un despegue confirmado. Los CSV se organizan por última observación, así que una descarga mensual puede omitir vuelos que empezaron al final del mes y terminaron en el siguiente.

`--airports` acepta un vuelo si cualquiera de sus extremos coincide. Al omitirlo se admiten todos los pares válidos del catálogo. Ambos extremos deben estar en el catálogo. El ID se deriva del identificador anonimizado de aeronave y de `firstseen`. Se ignoran duplicados y se rechazan extremos contradictorios para un mismo vuelo ya admitido. Los topes conservan las primeras coincidencias en el orden del CSV, sin inferir una muestra representativa. La salida contiene solo `routes`, con atribución, DOI y aviso de adaptación. La fecha de descarga documenta la procedencia y no garantiza una cobertura completa.

El informe de consola enumera las filas leídas y descartadas, vuelos por fecha, pares de aeropuertos y códigos fuera del catálogo. Puedes guardarlo redirigiendo stdout a un archivo. La salida se publica solo si cabe en 16 MiB. Para series largas, reduce el intervalo o el límite y convierte intervalos sin solapamiento en archivos distintos. Una nueva importación sustituye la anterior.

Para incorporar un aeropuerto faltante, busca una coincidencia exacta en [OurAirports](https://github.com/davidmegginson/ourairports-data). Verifica que el código ICAO y el aeropuerto correspondan a la época del registro, especialmente si hubo cierres o reasignaciones. Comprueba ciudad, país, IATA y las coordenadas `latitude_deg` y `longitude_deg` contra la ficha o la publicación aeronáutica oficial pertinente. Una futura actualización puede añadir la fila `[ICAO, IATA, ciudad, país ISO2, latitud, longitud]` en `airportRows` de `flights.js`, dejando constancia de la fuente. Las coordenadas de primera y última recepción ADS-B no son coordenadas de aeropuertos.

Abre **Telar → Más filtros → Fuentes → Importar archivo JSON autorizado**. Selecciona una fecha incluida en el informe. Busca Orlando o Ciudad de México y utiliza la aguja para cotejar los extremos y los recuentos con el informe. En **Comparar**, usa dos fechas del extracto para ver las diferencias de trama con la misma escala. La cifra mundial seguirá en **—** porque el archivo no contiene estadísticas de Flightradar24.

## Muestra incluida para la presentación

`data/opensky-abril-2020.json` es una adaptación CC BY 4.0 del archivo mensual indicado arriba (DOI 10.5281/zenodo.5815448). Se convirtió con el filtro de fechas del 1 al 30 de abril de 2020 inclusive, sin `--airports`, con `--limit 10000 --per-day 10000` y con la fecha de obtención indicada en el JSON. Se conservaron solo vuelos reconstruidos con dos extremos distintos del catálogo.

- 842,905 filas examinadas y 1,203 vuelos aceptados en 38 pares direccionales y 30 fechas UTC.
- 841,702 filas excluidas: 2,389 por fecha (primera observación fuera del mes) y 839,313 por extremos incompletos, iguales o fuera del catálogo. Cero duplicados y cero descartes por cupo.
- Aeropuertos: EGLL, KJFK, KLAX, KMCO, LEMD, LFPG, RJTT y SBGR. MMMX no aparece en la muestra.
- 174,074 bytes. La cobertura se limita a conexiones reconstruidas por OpenSky con extremos admitidos y primera observación en el intervalo. El origen y destino son estimados. Las fechas se asignan por primera observación, sin usar ese instante como despegue confirmado.

Al abrir o recargar el sitio por HTTP, la aplicación solicita el JSON local, pasa sus datos por el mismo importador y prepara las consultas por periodo en memoria. No consulta APIs externas. Un archivo importado manualmente tiene prioridad durante esa sesión. Al recargar se vuelve a la muestra incluida. Cuando el recurso falla, el modo real queda vacío y la demostración requiere una acción explícita.

En **Más filtros → Fuentes** se muestran la atribución, la licencia, el DOI, el periodo de cobertura y el momento de obtención. El 2 de abril Orlando aparece con 3 vuelos. Para comparar actividad de la muestra global, utiliza el 5 y el 30 de abril (65 frente a 29 vuelos de la muestra). El indicador mundial permanece en **—**.

### Países de destino en la muestra incluida

Los recuentos son llegadas del extracto histórico, del 1 al 30 de abril de 2020 UTC. Cada ruta se distingue por el par direccional de aeropuertos. El archivo y criterio de selección son los de la sección anterior.

| País | Ciudades y aeropuertos de llegada | Vuelos | Rutas |
| --- | --- | ---: | ---: |
| Brasil | São Paulo (SBGR, 23) | 23 | 5 |
| España | Madrid (LEMD, 100) | 100 | 4 |
| Estados Unidos | Nueva York (KJFK, 323), Los Ángeles (KLAX, 250), Orlando (KMCO, 4) | 577 | 15 |
| Francia | París (LFPG, 151) | 151 | 5 |
| Japón | Tokio (RJTT, 45) | 45 | 3 |
| Reino Unido | Londres (EGLL, 307) | 307 | 6 |

La lista de países sale de los aeropuertos de llegada del conjunto activo y se mantiene al cambiar la fecha. Los países sin llegadas en el periodo llevan una indicación. Elegir un país activa Llegadas. El buscador de ciudad o aeropuerto conserva la exploración de ambos sentidos al seleccionar directamente. Dentro del panel del país, Ciudad o aeropuerto conserva el sentido activo. México figura en el catálogo geográfico, pero no tiene llegadas en este extracto.

La muestra ya cubre seis países y 38 rutas direccionales, por lo que se conserva el extracto incluido. Para revisar códigos excluidos, vuelva a ejecutar el conversor y consulte `icao_fuera_del_catalogo` en el informe. Los más frecuentes y sus recuentos se pueden contrastar con los datos del archivo original.
