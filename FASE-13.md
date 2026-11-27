# Fase 13 · Ampliación con OPDI

El índice público contiene los 36 meses de OpenSky v21.12 entre 2019 y 2021, con 1,090 días de rutas observadas. El histórico usa la primera observación UTC, deduplica por aeronave y primera observación y suma por día y ruta direccional. OurAirports complementa el catálogo de aeropuertos. El navegador solicita agregados de los meses que intersectan el intervalo y obtiene los periodos semanales, mensuales y anuales sumando sus días disponibles. [Inventario OpenSky](FASE-9.7.md) · [OurAirports](https://ourairports.com/data/)

## Estado por mes

OPDI ofrece 57 Parquet mensuales de enero de 2022 a septiembre de 2026. Los 57 enlaces directos respondieron HTTP 200 a una solicitud HEAD el 27 de noviembre de 2026. En el Telar público hay **0 meses OPDI habilitados**. Octubre a diciembre de 2026 están fuera del intervalo de la versión consultada. Una eventual serie de 2026 deberá indicar cobertura anual parcial. [Descarga oficial](https://www.opdi.aero/flight-list-data)

| Año | Meses publicados por OPDI | Auditoría local confirmada |
| --- | --- | --- |
| 2022 | Enero–diciembre | Enero–abril |
| 2023 | Enero–diciembre | Pendiente |
| 2024 | Enero–diciembre | Abril |
| 2025 | Enero–diciembre | Pendiente |
| 2026 | Enero–septiembre | Septiembre |

La auditoría registra por mes la huella SHA-256, filas originales, versiones internas, días con rutas válidas, aeropuertos y rutas únicas y exclusiones por motivo. Las seis auditorías se cotejaron con las huellas y el número de filas de los originales locales. Cada total de filas se reconcilió con la suma de válidos y exclusiones. Enero–abril de 2022 y abril de 2024 tienen la etiqueta interna `v2.0.0`. Septiembre de 2026 tiene `v0.0.2`. La versión del portal y la etiqueta interna son campos de procedencia distintos.

## Criterio de inclusión y comparabilidad

OPDI agrupa estados ADS-B por ICAO24 y distintivo, segmenta trayectorias a partir de discontinuidades y estima los aeródromos de salida y llegada. Su campo DOF describe el día de primera observación. El adaptador del proyecto lee `id`, `dof`, `first_seen`, `adep`, `ades` y `version`. Conserva un registro por ID mensual, exige consistencia de la fecha UTC dentro del mes y excluye extremos ausentes, idénticos o fuera del catálogo. El agregado validable contiene pares direccionales y recuentos por día. [Conceptos OPDI](https://www.opdi.aero/concepts) · [Metodología OPDI](https://www.opdi.aero/methodology)

Las series tienen diferencias de reconstrucción, resolución de aeropuertos y cobertura. En el piloto OPDI predominan aeropuertos europeos. Una comparación entre fuentes debe identificar la serie y cobertura de ambos periodos y omitir la variación directa mientras no se valide un universo geográfico común y una definición compatible.

## Reutilización y publicación

OPDI describe reutilización con atribución y un enfoque no comercial. Las páginas revisadas no aclaran específicamente las condiciones de redistribución pública de agregados diarios por ruta de estos Parquet. Los originales y los informes detallados permanecen en la caché local mientras se aclara el permiso y el texto de atribución aplicable. El adaptador de auditoría existente es `tools/opdi_parquet.py`. [OPDI](https://www.opdi.aero/about.html) · [Condiciones de EUROCONTROL](https://www.eurocontrol.int/info/privacy-and-website-terms-use)

### Reproducir un lote local

Guarda los originales y `ourairports.csv` en una caché fuera del repositorio. Ejecuta el adaptador existente con Python y PyArrow instalados. El modo de auditoría lee solo las columnas necesarias y guarda el informe sin exportar registros individuales. Comprueba que el total de filas del Parquet se reconcilie con la suma de válidos y exclusiones, y conserva el informe y la huella para reutilizarlos en el siguiente lote.

```sh
cache=/ruta/a/la/cache
mes=202202
PYTHONDONTWRITEBYTECODE=1 python3 tools/opdi_parquet.py \
  "$cache/flight_list_$mes.parquet" "$cache/ourairports.csv" \
  > "$cache/audit-opdi-$mes.json"
```
