# Fase 5 · Exploración de destinos

Abre **Telar → Controles del telar**. Escribe **Orlando** para elegir la ciudad o **Orlando International Airport (MCO)**. Usa las flechas y Enter o toca una sugerencia. El resumen del destino distingue sus vuelos de demostración del total mundial independiente.

- **Sentido de los vuelos** permite ver llegadas, salidas o ambas. Se empieza con ambos sentidos porque el escenario medio contiene salidas de Orlando. En el escenario alto también hay llegadas.
- **Capas** alterna todas las conexiones, resalta el destino o aísla sus rutas. La urdimbre conserva una presencia tenue al aislar y la aguja solo puede seleccionar la trama de ese destino.
- **Restaurar vista mundial** o **Borrar búsqueda** limpia el destino. **Todas las conexiones** restaura la capa global y conserva el resumen del destino.
- Cambiar la fecha o el escenario actualiza las coincidencias. **Volver al telar** conserva los filtros durante la sesión. **Comenzar de nuevo** restaura el primer día, el escenario medio y la capa global.

## Catálogo y conexión con el motor

`destinations.js` construye países, ciudades y aeropuertos a partir del catálogo geográfico de `flights.js`. Los registros declaran claves estables y relaciones de aeropuerto. Las ciudades reúnen los aeropuertos asociados y emplean el primero del catálogo como coordenada representativa. Con nuevos destinos, amplía el catálogo de aeropuertos e indica su localidad y país. Si existen varios aeropuertos en la misma localidad, asígnales la misma clave de ciudad. Los nombres y códigos de aeropuertos sirven para buscar, y el ID estable sirve para mantener la selección.

El filtro trabaja por ID de conjunto de ruta y cuenta cada coincidencia una vez, incluso cuando ambos extremos pertenecen al destino. Las cifras y los anclajes permanecen en la fuente original. Los aeropuertos se distinguen por su presencia en el catálogo y por la disponibilidad de rutas en la fecha, escenario y sentido actuales.

`loom.js` aplica una textura de opacidades indexada por hebra. Al cambiar la capa se actualiza esa textura y se interpola el contraste. El búfer de vértices se conserva. El pase de selección utiliza la misma máscara y excluye las hebras ocultas. La ficha de la aguja se vincula con el ID de ruta de la hebra activa.

`script.js` coordina fecha, escenario, destino, sentido, capa y selección de fibra. La interacción puntual de la aguja se libera al salir del telar y los filtros se conservan. `calendar.js` expone un método de actualización de su selección para el reinicio de la sesión.

Ejecuta `node --test *.test.cjs` para comprobar búsqueda, cobertura, cantidades, anclajes y comportamiento de la aguja.
