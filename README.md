# Divisor y depurador de archivos XLSX/CSV

Pagina web estatica para procesar archivos `.xlsx`, `.xls` y `.csv` directamente en el navegador.

La herramienta permite cortar archivos por numero de filas, unir CSV de clientes, quitar duplicados y eliminar esos clientes de un archivo maestro. No usa backend: los archivos se procesan localmente en el navegador y no se suben a ningun servidor.

## Funcionalidades

- Cortar archivos `.xlsx`, `.xls` o `.csv` en varios CSV por cantidad de filas.
- Descargar cada parte generada o descargar todas las partes en un ZIP.
- Unir varios CSV de clientes de una sola columna.
- Quitar clientes duplicados y descargar la lista depurada.
- Reutilizar la lista unida directamente en el tercer modulo, sin descargarla ni volver a subirla.
- Cargar una lista independiente de clientes a eliminar desde el modulo de archivo maestro.
- Cargar un archivo maestro `.csv`, `.xlsx` o `.xls`.
- Comparar clientes usando la primera columna y conservar las demas columnas del maestro.
- Eliminar del maestro los clientes encontrados en la lista cargada para ese modulo.
- Descargar el maestro filtrado con su nombre original y el sufijo `_excluidos.csv`.
- Trabajar con los tres modulos en cards visibles en una sola pagina, sin sidebar.

## Archivos principales

- `index.html`: estructura de la interfaz y carga de dependencias CDN.
- `styles.css`: estilos visuales, layout responsive, tarjetas, botones y dropzones.
- `script.js`: logica de validacion, lectura, procesamiento y descarga de archivos.
- `favicon.svg`: icono local de la aplicacion.
- `tests/browser.html`: pruebas de los flujos principales en un navegador real.
- `.github/workflows/pages.yml`: workflow de despliegue a GitHub Pages.
- `.nojekyll`: evita procesamiento de Jekyll en GitHub Pages.

## Dependencias CDN

La app carga estas librerias desde CDN:

- SheetJS/xlsx: lectura de archivos Excel y CSV.
- JSZip: generacion de ZIP para descargar todos los CSV.

La interfaz utiliza fuentes del sistema, sin solicitudes a Google Fonts.

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

Para ejecutar las pruebas de integracion, abre `http://localhost:8000/tests/browser.html`.
El navegador muestra el resultado de cada caso. Necesita poder cargar las dependencias CDN.

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
- Abre directamente `https://TU_USUARIO.github.io/TU_REPO/styles.css?v=20261112`.
- Si esa URL da 404, Pages esta publicando desde otra fuente o no se desplego el artefacto correcto.
- Si el CSS abre bien, fuerza recarga con `Ctrl + F5`.

El proyecto versiona las referencias a CSS y JavaScript en `index.html` para evitar cache vieja de GitHub Pages.

## Funcionamiento

Se conserva la regla de deteccion del proyecto: si el primer valor de la primera columna empieza por `1`, se procesa desde la primera fila; en caso contrario, se interpreta como encabezado. El encabezado, cuando existe, se conserva en cada CSV generado.

Si el archivo Excel tiene varias hojas, solo se procesa la primera hoja y se muestra un aviso.

En el modulo de archivo maestro puedes elegir **Usar lista unida** o **Subir archivo**. La primera opcion reutiliza en memoria el resultado del modulo 2; la segunda permite cargar una lista independiente en CSV o Excel. Cambiar de opcion conserva las listas y el maestro, pero invalida la descarga anterior para que vuelvas a filtrar con la fuente elegida.

Si cambias los CSV del modulo 2, debes unirlos nuevamente antes de reutilizar la lista. Los datos solo se conservan durante la sesion: recargar o cerrar la pagina los borra.

El resultado mantiene el nombre base del maestro: `Maestro noviembre.xlsx` produce `Maestro noviembre_excluidos.csv`.

Los CSV se generan en UTF-8 con BOM para facilitar la apertura en Excel. Los valores con comas, comillas o saltos de linea se escapan correctamente.

## Recomendaciones

- Procesa archivos grandes en un equipo con suficiente memoria disponible.
- Usa bloques de filas razonables para no generar demasiados archivos.
- Prueba primero con una muestra pequena si el archivo maestro es muy grande.
- En la lista de clientes a eliminar, deja los clientes en la primera columna y conserva un encabezado en la primera fila.
- Coloca el codigo de cliente en la primera columna antes de filtrar el maestro.

## Interfaz

El rediseno usa una interfaz oscura con tres cards visibles, acentos azules y botones con gradiente. Se consultaron [Frontend Design de Anthropic](https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md) y [UI/UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill). La [referencia de ImageGen y su prompt](docs/design/README.md) documentan la direccion visual.

Los tres modulos comparten fila, dimensiones y alineacion de acciones en escritorio. Los paneles de resultados tienen una altura uniforme y permiten desplazar su contenido. En tablet se distribuyen en dos columnas con el maestro centrado debajo y del mismo tamano; en movil se apilan con altura adaptable. Los enlaces entre cards conservan el estado, mueven el foco y desplazan la pagina solo si el destino queda fuera de pantalla.

Para reducir el trabajo de pintura durante el scroll se eliminaron los desenfoques de fondo, los fondos decorativos fijos y las animaciones de tarjetas. El scroll sigue siendo nativo; las descargas largas tienen un contenedor con altura limitada.
