# Fase 6 · Bordado de Orlando

En **Telar**, busca **Orlando** o **MCO**. Selecciona el lugar y cambia **Visualización** a **Figura bordada**. En pantallas estrechas, **Visualización** está en **Más filtros**. El calendario, los escenarios y el sentido de los vuelos se aplican a ambas vistas. Elige **Conexiones** para regresar a las rutas con los mismos filtros.

## Símbolo y material

`embroidery.js` registra un castillo de fantasía original para los IDs `city:ORL` y `airport:KMCO`. El contorno define tres torres, cubiertas, almenas y un arco central. Las fibras de soporte trazan bordes, ventanas y remates con varias hebras ligeramente desplazadas en profundidad. Las puntadas con datos usan curvas de ida y vuelta dentro de paneles poligonales. Cada tramo de una puntada se construye con las secciones horizontales del panel. El hilo añade ondulación, torsión aparente y relieve. El renderer utiliza la misma geometría tubular y el mismo sombreado textil del telar.

## Correspondencia y transición

Se parte de la asignación de fibras de rutas que ya existe y se transforman las correspondientes al destino. Cada una conserva su ID, origen, destino, fecha, fuente y recuento asignado. Los vuelos del destino determinan cuántas hebras se tejen y la profundidad del relleno. El volumen de cada ruta también ajusta el relieve de sus puntadas. El contorno conserva su silueta en cada escenario y los hilos de soporte carecen de datos de vuelos. Un filtro sin registros muestra el estado vacío.

`loom.js` interpola los centros de las curvas por ID en aproximadamente un segundo. Los anclajes se conservan en el catálogo. La urdimbre y las rutas de contexto se atenúan en el modo figurativo según la capa; se dibujan detrás del bordado para no ocultar sus cruces. Volver a Conexiones interpola hacia los centros originales. Al reducir movimiento, la vista muestra el estado final.

La aguja utiliza los mismos IDs de selección y el mismo shader que dibuja las fibras. Arrastrar una puntada curva localmente esa hebra. Al soltarla se conserva el desplazamiento por ID en un búfer independiente. **Restablecer hilos** recupera el recorrido del modo activo. Cambiar el destino, la fecha, el escenario, el sentido, la capa o la visualización limpia las intervenciones. El contorno decorativo se puede consultar y se identifica como soporte. **Solo el destino** oculta las conexiones ajenas.

## Ampliación

Para un nuevo símbolo, define el ID del símbolo, los IDs de destino, la nota cultural, los materiales, el contorno, los recorridos de soporte y los paneles de relleno. Incorpóralo al registro de `embroidery.js`. La calidad móvil reduce pasadas y pliegues de soporte. Los búferes se reconstruyen al cambiar datos, figura o calidad; la interacción y el morphing por fotograma usan parámetros del shader. Queda pendiente el refinamiento artístico de materiales, como trenzas más complejas y relieves escultóricos.

Ejecuta `node --test *.test.cjs` para verificar trazabilidad, recuentos, silueta, estado vacío y morphing.
