# Fase 13 · Ampliación con datos abiertos

## Fuentes

- **2019–2021.** El histórico OpenSky v21.12 conserva sus archivos y su licencia CC BY 4.0. Los 36 meses incluyen 1.090 días con rutas. El día UTC corresponde a la primera observación. Los aeropuertos son estimados por OpenSky. [Edición CC BY 4.0](https://zenodo.org/records/5815448).
- **2022.** Los doce CSV comprimidos de OpenSky v23.00 suman 2.405.101.270 bytes. Zenodo etiqueta la edición como `other-nc`. El archivo de términos limita los usos y restringe la redistribución. La edición CC BY 4.0 termina en diciembre de 2021. También se revisó BTS On-Time como alternativa. Cubre aerolíneas declarantes y vuelos domésticos de Estados Unidos con horas locales. El catálogo abierto de indicadores BTS no identifica con precisión la licencia del archivo de microdatos evaluado. 2022 queda fuera del catálogo mientras falte una fuente con licencia y granularidad UTC validadas. [Edición de 2022](https://zenodo.org/records/7923702) · [Términos incluidos](https://zenodo.org/records/7923702/files/LICENSE.txt?download=1) · [BTS On-Time](https://www.transtats.bts.gov/DL_SelectFields.aspx?QO_fu146_anzr=b0-gvzr&gnoyr_VQ=FGJ).
- **2023–2026.** El archivo de ADSB.lol separa las capturas diarias por instancia. Se usa únicamente `readsb-prod-0` para cada día incorporado, lo que evita contar la misma aeronave desde varias instancias. [Archivo histórico](https://www.adsb.lol/docs/open-data/historical).
- **OPDI.** El manifiesto público rechaza entradas OPDI. En el repositorio se conserva el adaptador de auditoría. No se incluyen Parquet ni agregados OPDI.

## Reconstrucción ADSB.lol

Cada captura contiene una traza por aeronave. El procesador usa tiempo UTC, coordenadas, altitud y la marca de tierra de readsb. Los vuelos se segmentan desde el último punto en tierra antes de la actividad aérea hasta el primer punto en tierra posterior. Un salto de cobertura superior a 10 minutos invalida el segmento pendiente. Se requieren cinco observaciones aéreas, cuatro minutos de vuelo y al menos una altitud de 1.500 pies. La primera observación aérea debe estar por debajo o a 3.500 pies para admitir el origen.

Los extremos se cotejan con el catálogo OurAirports ya integrado. Cada extremo debe tener exactamente un aeropuerto candidato a dos kilómetros o menos del punto observado en tierra. Se excluyen los extremos ambiguos, ausentes o coincidentes, los tramos incompletos y los que empiezan o terminan fuera del día UTC del archivo. El identificador de aeronave y la hora de inicio se usan durante el procesamiento para evitar duplicados. Solo se publican fechas, aeropuertos y recuentos por par direccional.

Este método exige observación continua y cercana a ambos aeropuertos. Favorece las zonas con buena recepción en tierra y excluye, entre otros, vuelos que cruzan la medianoche y rutas con pérdida de señal. Los recuentos describen los trayectos reconstruidos de la muestra. La diferencia con OpenSky incluye el alcance de los receptores, el método de estimación y las exclusiones. El Telar mantiene separadas las series y no calcula una variación directa entre fuentes.

## Licencia de los agregados

Los archivos `data/adsblol-*.json` contienen información de **ADSB.lol**, disponible bajo la [Open Database License 1.0](https://opendatacommons.org/licenses/odbl/1-0/). Los agregados se distribuyen bajo esa misma licencia con su atribución, en JSON descargable, sin restricciones de acceso. El aviso se incluye en los datos y en Fuentes, metodología y créditos. La licencia de la base derivada se aplica a los agregados ADSB.lol y no se extiende al código ni al diseño artístico. [ODbL, secciones 4.2–4.7](https://opendatacommons.org/licenses/odbl/1-0/#toc-4-0-conditions-of-use) · [Catálogo OurAirports, dominio público](https://ourairports.com/data/).

## Prueba de viabilidad

Una lectura parcial de 32 MiB del archivo `v2024.01.01-planes-readsb-prod-0.tar` identificó 66 trayectos y 58 pares direccionales en 1.197 trazas. Al tratarse de un prefijo truncado, esa muestra se usó exclusivamente para validar el procesamiento. No habilita una fecha.

Con los tamaños de los archivos de prueba (1,58–3,98 GB por día), un año puede requerir del orden de 0,58–1,45 TB en transferencias. El lote público se limita a días concretos. Los originales permanecen fuera del repositorio. Antes de procesar un archivo completo, se comprueba su tamaño y, si el editor publica SHA-256, se verifica cada parte.

Para reproducir un día, descarga las partes del mismo lanzamiento y de la misma instancia en orden `.aa`, `.ab`, etc. Une las partes sin extraer el tar y ejecuta:

```sh
python3 tools/adsb_routes.py /ruta/lote.tar AAAA-MM-DD --output /ruta/agregado.json > /ruta/auditoria.json
```

El manifiesto `data/history.json` solo habilita los días que tienen totales positivos y verificados en sus agregados. El lector comprueba proveedor, días y sumas antes de usar un agregado; los periodos de semana, mes y año se construyen a partir de esos días. La cobertura anual y mensual de ADSB.lol sigue siendo parcial.

## Lote validado y sus agregados

| Día UTC | Archivo de origen | GB de origen | Trazas | Trayectos | Rutas direccionales | Aeropuertos | Países |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 2023-12-30 | [v2023.12.30-planes-readsb-prod-0.tar](https://github.com/adsblol/globe_history_2023/releases/tag/v2023.12.30-planes-readsb-prod-0) | 1.58 | 42157 | 1817 | 728 | 161 | 18 |
| 2024-12-30 | [v2024.12.30-planes-readsb-prod-0.tar](https://github.com/adsblol/globe_history_2024/releases/tag/v2024.12.30-planes-readsb-prod-0) (partes aa y ab) | 2.07 | 50717 | 3765 | 1264 | 246 | 27 |
| 2025-12-30 | [v2025.12.30-planes-readsb-prod-0.tar](https://github.com/adsblol/globe_history_2025/releases/tag/v2025.12.30-planes-readsb-prod-0) (partes aa y ab) | 3.20 | 61220 | 8590 | 3391 | 454 | 39 |
| 2026-09-30 | [v2026.09.30-planes-readsb-prod-0.tar](https://github.com/adsblol/globe_history_2026/releases/tag/v2026.09.30-planes-readsb-prod-0) (partes aa y ab) | 3.98 | 79645 | 13631 | 5406 | 604 | 48 |

Los meses de diciembre de 2023, 2024 y 2025 y septiembre de 2026 tienen **un día habilitado cada uno**. Los demás días no se publican. El manifiesto enlaza cada lanzamiento y registra el SHA-256 del JSON servido.
