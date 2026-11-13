# PRUEBAS MANUALES

## Suite de integracion en navegador

Inicia `python -m http.server 8000` y abre `http://localhost:8000/tests/browser.html`.
La suite ejecuta 18 escenarios con archivos sinteticos y dependencias reales de XLSX y ZIP:

- Unir CSV con y sin encabezado y quitar duplicados.
- Reutilizar la lista en el maestro sin subirla nuevamente.
- Cargar una lista independiente y alternar entre ambas fuentes.
- Invalidar resultados cuando cambia la fuente o el archivo maestro.
- Cambiar los CSV unidos sin afectar un resultado basado en una lista independiente.
- Filtrar maestros CSV/Excel, sin encabezado y con todas las filas excluidas.
- Mantener nombre base, espacios y acentos al agregar `_excluidos.csv`.
- Bloquear listas vacias, dividir archivos y crear ZIP.
- Verificar favicon, navegacion, ausencia de blur y layout a 320, 390, 768 y 1280 px.
- Mostrar Ir a Unir CSV solo en movil, mientras no haya una lista preparada.
- Comprobar las mismas dimensiones, botones y resultados alineados en escritorio con ambas fuentes de clientes; en tablet, el maestro conserva el tamano de las otras cards.

Los archivos de prueba se crean en memoria. Las descargas se capturan en la suite para inspeccionar sus nombres y contenido.

## Revision visual y teclado

- Revisar las tres cards simultaneas en escritorio, sin sidebar, y su distribucion en tablet y movil.
- Navegar con Tab, activar botones con Enter y cambiar la fuente con las flechas del teclado.
- Verificar que Usar en maestro e Ir a Unir CSV enfoquen la card correcta sin ocultar las otras.
- En el modulo 3, comprobar ambas opciones de fuente y el nombre de salida mostrado.
- Desplazarse por la pagina y por una lista larga de descargas; no debe haber fondos con blur ni animaciones de entrada.

Estas pruebas validan la regla de encabezado aplicada a Excel y CSV:
si el primer valor de la primera columna empieza por `1`, se procesa desde
la primera fila; si no empieza por `1`, se omite la primera fila como
encabezado. Todas las comparaciones de clientes usan solo la primera columna.

## 1. Excel sin encabezado

- Primera fila: `123456789`
- Resultado esperado: procesa desde la primera fila.

## 2. Excel con encabezado

- Primera fila: `Codigo Cliente`
- Segunda fila: `123456789`
- Resultado esperado: ignora la primera fila y procesa desde la segunda.

## 3. CSV sin encabezado

- Primera fila: `123456789,Cliente 1,Medellin`
- Resultado esperado: procesa desde la primera fila.

## 4. CSV con encabezado

- Primera fila: `Codigo Cliente,Nombre,Ciudad`
- Segunda fila: `123456789,Cliente 1,Medellin`
- Resultado esperado: ignora la primera fila.

## 5. Archivo con varias columnas

- Validar que el sistema solo use la primera columna para identificar y
  comparar clientes.

## 6. Modulo de cortar

- Validar que no incluya encabezado como cliente.
- Validar que no se pierda el primer cliente cuando no hay encabezado.

## 7. Modulo de unir

- Validar que no duplique encabezados.
- Validar que una correctamente archivos con y sin encabezado.

## 8. Modulo de quitar duplicados

- Validar que compare duplicados usando solo la primera columna.

## 9. Modulo de eliminar clientes contra maestro

- Validar que compare unicamente por codigo de cliente en la primera columna.
- Validar que no elimine clientes por coincidencias en otras columnas.

## Prueba rapida desde consola

1. Abrir la pagina en el navegador.
2. Abrir DevTools.
3. Ejecutar:

```js
probarValidacionEncabezado()
```

La consola debe mostrar `OK ... correcto` para todos los escenarios.
