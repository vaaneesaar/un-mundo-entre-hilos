# Exploración temporal y comparación

En Telar, el control Periodo usa la fecha del calendario como referencia UTC. Semanas de lunes a domingo. Los intervalos incluyen el inicio y excluyen el fin. El calendario distingue días con datos y permite consultar días vacíos.

- Día: total de la fuente mundial. Hora: total horario y referencia diaria separada, cuando ambos existen. Los registros horarios se verifican con un fixture de prueba. La demostración pública solo contiene totales diarios.
- Semana, mes y año: promedio de días observados, acumulado observado y cobertura. Un periodo vacío muestra «—». Un cero confirmado se conserva y cuenta como día observado.
- Los agregados eligen una sola granularidad, fuente y unidad por conjunto. El total mundial se deduplica por intervalo base y la muestra de rutas por intervalo base, origen y destino. Una actualización del mismo registro reemplaza la anterior. Los trayectos de distintos días se agrupan por identificador estable de ruta. Para vuelos individuales, el agregador existente asigna cada vuelo por su instante UTC y deduplica fuente e ID.
- Cada cambio temporal libera las intervenciones anteriores. El telar usa sus transiciones existentes para incorporar, transformar y retirar hebras sobre anclajes estables.

Comparar usa el mismo tipo temporal para A y B. Las duraciones distintas se comparan con el promedio de días disponibles. Cada resumen indica cobertura. La diferencia porcentual usa A como base y se omite si A es cero. Los telares representan acumulados de la muestra de rutas: el mayor acumulado define un divisor común que limita ambos a 100 hebras. Se distribuye el presupuesto por ruta con el reparto existente. El encuadre fijo por modo, el nivel geométrico, la escala, el destino, las capas y la emoción se comparten. Cada tejido guarda sus propias intervenciones y el botón general restaura ambos. En móvil solo se renderiza la vista elegida. La cifra mundial sigue siendo independiente.

El proveedor local implementa una lectura asíncrona por intervalo, capacidades de fechas y horas, y metadatos para conexión futura. La caché acotada reutiliza lecturas, descarta las antiguas y permite invalidación. El panel ignora respuestas obsoletas y distingue carga, ausencia y error. Una fuente futura puede completar las capacidades e invalidar la caché cuando cambien las observaciones. No hay registros en vivo.

Pruebas: ejecutar `node --test *.test.cjs` desde la carpeta del proyecto.
