# PRUEBAS MANUALES

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
