# Fase 6.5 · Materialidad del telar

El telar conserva el renderer WebGL y sus filtros. En la vista de conexiones, prueba actividad media y alta para distinguir los listones y los cruces elevados. Busca **Orlando**, elige **Figura bordada** y prueba el arrastre sobre una puntada. Puedes volver a agarrarla donde quedó. **Restablecer hilos** devuelve las fibras a su forma actual. Al cambiar fecha, destino o visualización, se limpian las intervenciones. Cambiar capas o sentido conserva las hebras todavía disponibles.

## Construcción

- El algodón usa radios irregulares y grano mate. La seda añade una luz satinada controlada.
- Un cordón trenzado utiliza tres perfiles helicoidales con fases separadas. La torsión y el volumen se concentran en un nudo según la intensidad de la ruta.
- Las mallas combinan hilos longitudinales separados con hebras de ligadura que cruzan en zigzag a distintas profundidades. Las bandas usan más hilos longitudinales y un perfil convexo.
- El relieve deposita un pliegue de mayor amplitud según la actividad de la ruta. El patrón de paso por encima y por debajo de la urdimbre y los extremos geográficos se mantienen.
- El sombreado combina ambiente azulado, luz principal suave, luz lateral cálida y oscurecimiento aproximado entre cabos. El castillo utiliza contornos trenzados, capas de soporte y relleno de puntadas y malla sin cambiar su silueta base.

## Interacción y coste

Cada componente material de una fibra comparte su ID, parámetro longitudinal, código de selección y desplazamiento. Los cabos se deforman juntos y reutilizan la ficha de la fibra original. Ni los componentes ni los soportes añadidos incrementan los vuelos. La geometría se agrupa en los mismos búferes WebGL. En celular hay menos hilos de ligadura y menos vueltas, y el renderer conserva el límite de densidad de píxeles. El punto de vista y el picking utilizan la misma proyección.

En Inicio y Cierre se añadieron fibras compañeras a los motivos existentes para darles algo más de profundidad. La comparación visual con las tres referencias queda pendiente porque las imágenes no llegaron con el encargo. La luz de contacto es una aproximación procedimental y el grano no modela cada pelo de la fibra.

Ejecuta `node --test *.test.cjs` para verificar materiales, agrupación por ID, geometría, datos y manipulación persistente.
