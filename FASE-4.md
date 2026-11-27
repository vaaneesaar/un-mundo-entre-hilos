# Fase 4 · Datos y anclajes

Abre `index.html` y entra en **Telar**. En **Controles del telar**, elige Actividad baja, media o alta y abre el calendario de demostración para seleccionar una de las dos fechas UTC. Con la aguja, selecciona una hebra de trama para consultar su conexión. La ficha de la urdimbre identifica un hilo estructural.

## Datos y cobertura

`flights.js` define vuelos individuales, conjuntos direccionales de rutas y totales diarios. `aggregateFlights` admite registros con fecha de referencia o marca temporal y obtiene un día UTC semiabierto. Excluye registros no disponibles o con extremos ajenos al catálogo. Suprime duplicados por fuente e ID y mantiene separadas las rutas inversas. Dos fuentes se mantienen separadas hasta que exista una regla de reconciliación; no se asume cobertura común.

Los datos de demostración se declaran como conjuntos agrupados para el 14 y el 21 de enero de 2026. Cada fecha tiene tres escenarios deterministas. El total mundial ficticio se declara aparte con su propia fuente, estado, cobertura y hora de actualización. Las rutas corresponden a otra fuente sintética y se identifican como muestra parcial.

El catálogo de aeropuertos utiliza referencias geográficas de [OurAirports](https://github.com/davidmegginson/ourairports-data) y guarda claves de ciudad, país y aeropuerto. El catálogo geográfico y las fuentes sintéticas desempeñan funciones distintas. No se consulta ningún servicio en tiempo de ejecución.

## Reglas del tejido

- `plotAnchor` comprime y ondula latitud y longitud, añade un desplazamiento sembrado por ID y guarda un anclaje XYZ por lugar. El catálogo se calcula una vez. La vista móvil aplica la misma transformación visual a todas las hebras y sus extremos.
- Cada curva comienza en el anclaje de origen y termina en el de destino. En el interior, la trama alterna profundidad con las columnas de urdimbre. La distancia geodésica estimada por Haversine modula la curvatura. El recorrido visible tiene una escala artística.
- Si la muestra tiene un total T y el nivel gráfico utiliza un factor L, el presupuesto es el menor entre el límite de calidad (180 × L, redondeado hacia abajo) y √T × 4.1 × L redondeado. La urdimbre responde al ancho del lienzo.
- Se reserva una fibra por ruta positiva cuando el presupuesto alcanza. Los lugares restantes se asignan proporcionalmente por restos mayores, con desempate por ID. Si hay más rutas que fibras disponibles, se muestran las de mayor volumen y el pie avisa cuántas quedaron fuera. Cada ruta con C vuelos y N hebras asigna a cada hebra ⌊C/N⌋ vuelos y reparte el resto de uno en uno. La suma recupera el recuento de la ruta.
- La intensidad C/(C+120) controla el grosor, la tensión, la separación y el relieve. La semilla estable de ruta diferencia la forma y el color de grupos con actividad similar.

## Calendario de fechas disponibles

`calendar.js` recibe las fechas disponibles como claves `YYYY-MM-DD` y notifica únicamente selecciones válidas. La fase 4 utiliza `FlightData.days`. Un proveedor posterior podrá actualizar las fechas habilitadas con `setAvailableDates` y conectar la selección al filtro temporal que corresponda.

## Identidad, transición y aguja

El ID de una hebra combina la clave direccional de ruta (fuente, origen y destino) con un ordinal. La ficha resuelve origen, destino, fecha, vuelos de la hebra y de la ruta, distancia y fuente desde el registro asociado a la fibra actual. La selección se cancela al cambiar de conjunto y el picking excluye las fibras salientes.

El renderer vuelve a construir los búferes al cambiar datos o calidad. Las hebras compartidas interpolan su recorrido, las nuevas se incorporan desde el origen y las asentadas que salen se desvanecen. Con movimiento reducido se presenta directamente el estado final. Se conserva el movimiento autónomo y la deformación de la aguja opera sobre la escena transformada.

Para una fuente futura, convierte sus registros o agregados al modelo de `flights.js` y pasa el resultado de `toLoomData` a `setData`. Mantén el recuento diario y la cobertura de rutas como entidades independientes.

## Pruebas

Ejecuta `node --test *.test.cjs` desde esta carpeta.
