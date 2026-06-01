# Divisor y depurador de archivos XLSX/CSV

Pagina web estatica para procesar archivos `.xlsx`, `.xls` y `.csv` directamente en el navegador.

La herramienta permite cortar archivos por numero de filas, unir CSV de clientes, quitar duplicados y eliminar esos clientes de un archivo maestro. No usa backend: los archivos se procesan localmente en el navegador y no se suben a ningun servidor.

## Funcionalidades

- Cortar archivos `.xlsx`, `.xls` o `.csv` en varios CSV por cantidad de filas.
- Descargar cada parte generada o descargar todas las partes en un ZIP.
- Unir varios CSV de clientes de una sola columna.
- Quitar clientes duplicados y descargar la lista depurada.
- Cargar un archivo maestro `.csv`, `.xlsx` o `.xls`.
- Seleccionar la columna de comparacion cuando el archivo maestro tiene varias columnas.
- Eliminar del maestro los clientes encontrados en la lista depurada.
- Descargar el archivo maestro filtrado.

## Archivos principales

- `index.html`: estructura de la interfaz y carga de dependencias CDN.
- `styles.css`: estilos visuales, layout responsive, tarjetas, botones y dropzones.
- `script.js`: logica de validacion, lectura, procesamiento y descarga de archivos.
- `.github/workflows/pages.yml`: workflow de despliegue a GitHub Pages.
- `.nojekyll`: evita procesamiento de Jekyll en GitHub Pages.

## Dependencias CDN

La app carga estas librerias desde CDN:

- SheetJS/xlsx: lectura de archivos Excel y CSV.
- JSZip: generacion de ZIP para descargar todos los CSV.
- Google Fonts: fuente Inter para la interfaz.

## Probar localmente

Puedes abrir `index.html` directamente en el navegador.

Tambien puedes levantar un servidor local simple:

```bash
python -m http.server 8000
```

Luego abre:

```text
http://localhost:8000
```

## Despliegue en GitHub Pages

El repositorio incluye un workflow de GitHub Actions para desplegar la pagina estatica.

1. Haz commit y push a la rama `main` o `master`.
2. En GitHub, entra a `Settings > Pages`.
3. En `Build and deployment`, selecciona `GitHub Actions`.
4. Espera a que termine el workflow `Deploy static site to GitHub Pages`.
5. Abre la URL publicada por GitHub Pages.

El workflow verifica que existan `index.html`, `styles.css` y `script.js` antes de publicar.

## Si GitHub Pages aparece sin estilos

Si la pagina se ve como HTML sin formato, normalmente el navegador no esta cargando `styles.css`.

Revisa lo siguiente:

- En `Settings > Pages`, la fuente debe ser `GitHub Actions`.
- El workflow debe terminar correctamente.
- Abre directamente `https://TU_USUARIO.github.io/TU_REPO/styles.css?v=20260601`.
- Si esa URL da 404, Pages esta publicando desde otra fuente o no se desplego el artefacto correcto.
- Si el CSS abre bien, fuerza recarga con `Ctrl + F5`.

El proyecto usa `./styles.css?v=20260601` en `index.html` para evitar cache vieja de GitHub Pages.

## Funcionamiento

La primera fila del archivo se trata como encabezado y se conserva en cada CSV generado.

Si el archivo Excel tiene varias hojas, solo se procesa la primera hoja y se muestra un aviso.

Los CSV se generan en UTF-8 con BOM para facilitar la apertura en Excel. Los valores con comas, comillas o saltos de linea se escapan correctamente.

## Recomendaciones

- Procesa archivos grandes en un equipo con suficiente memoria disponible.
- Usa bloques de filas razonables para no generar demasiados archivos.
- Prueba primero con una muestra pequena si el archivo maestro es muy grande.
- Verifica la columna de comparacion antes de filtrar clientes del archivo maestro.
