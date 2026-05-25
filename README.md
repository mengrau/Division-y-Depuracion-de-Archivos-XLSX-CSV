# Cortador de archivos por filas

Página web estática para dividir archivos `.xlsx`, `.xls` o `.csv` en varios archivos `.csv` según el número de filas indicado por el usuario.

Todo el procesamiento ocurre en el navegador. La herramienta no sube archivos a ningún servidor y no almacena información del usuario.

## Archivos del proyecto

- `index.html`: estructura de la interfaz y carga de SheetJS/xlsx y JSZip desde CDN.
- `styles.css`: estilos responsive de la página.
- `script.js`: validación, lectura del archivo, división por filas y generación de CSV.
- `README.md`: instrucciones de uso y despliegue.

## Cómo probar localmente

1. Descarga o clona este repositorio.
2. Abre `index.html` directamente en tu navegador.
3. Selecciona un archivo `.xlsx`, `.xls` o `.csv`.
4. Indica cuántas filas debe tener cada CSV resultante.
5. Pulsa **Procesar archivo** y descarga cada CSV o usa **Descargar todo** para obtener un ZIP con todos los archivos.

También puedes usar un servidor local simple:

```bash
python -m http.server 8000
```

Luego abre:

```text
http://localhost:8000
```

## Cómo desplegar en GitHub Pages

1. Sube estos archivos a un repositorio de GitHub.
2. En GitHub, entra a **Settings** > **Pages**.
3. En **Build and deployment**, selecciona **Deploy from a branch**.
4. Elige la rama `main` o `master` y la carpeta raíz `/`.
5. Guarda la configuración.
6. GitHub mostrará la URL pública de la página cuando finalice el despliegue.

## Funcionamiento

La app usa SheetJS/xlsx para leer el archivo desde el navegador y JSZip para empaquetar todas las partes en una sola descarga. La primera fila se trata como encabezado y se incluye de nuevo en cada CSV generado. Si el archivo tiene varias hojas, solo se procesa la primera y se muestra un aviso.

Los CSV se generan con separador coma, codificación UTF-8 y BOM para facilitar la apertura en Excel con tildes, ñ y caracteres especiales. Los valores con comas, comillas o saltos de línea se escapan correctamente.

## Recomendaciones para archivos grandes

- Procesa archivos grandes en un equipo con suficiente memoria disponible.
- Usa bloques de filas razonables para evitar generar demasiados enlaces de descarga.
- Cierra otras pestañas o aplicaciones si el navegador se vuelve lento.
- Si el archivo tiene cientos de miles de filas, prueba primero con una copia reducida para validar encabezados, caracteres especiales y formato de salida.
