const allowedExtensions = ["xlsx", "xls", "csv"];
const fileInput = document.getElementById("file-input");
const rowsInput = document.getElementById("rows-input");
const processButton = document.getElementById("process-button");
const statusMessages = document.getElementById("status-messages");
const downloadsList = document.getElementById("downloads-list");
const downloadCount = document.getElementById("download-count");
const downloadAllButton = document.getElementById("download-all-button");
const clientCsvInput = document.getElementById("client-csv-input");
const mergeClientsButton = document.getElementById("merge-clients-button");
const downloadClientsButton = document.getElementById("download-clients-button");
const clientsSummary = document.getElementById("clients-summary");
const masterClientsInput = document.getElementById("master-clients-input");
const masterFileInput = document.getElementById("master-file-input");
const masterColumnGroup = document.getElementById("master-column-group");
const masterColumnSelect = document.getElementById("master-column-select");
const filterMasterButton = document.getElementById("filter-master-button");
const downloadFilteredButton = document.getElementById("download-filtered-button");
const masterSummary = document.getElementById("master-summary");
const useMergedButton = document.getElementById("use-merged-button");
const clientSourceInputs = document.querySelectorAll('input[name="client-source"]');
const mergedSourcePanel = document.getElementById("merged-source-panel");
const uploadedSourcePanel = document.getElementById("uploaded-source-panel");
const mergedSourceStatus = document.getElementById("merged-source-status");
const prepareMergeLink = document.getElementById("prepare-merge-link");

let generatedUrls = [];
let generatedDownloadItems = [];
let generatedArchiveName = "archivos_csv.zip";
let clientesDepurados = null;
let clientesDepuradosBlob = null;
let masterClientList = null;
let masterFileData = null;
let filteredMasterBlob = null;
let filteredMasterFileName = null;

fileInput.addEventListener("change", handleFileSelection);
processButton.addEventListener("click", processSelectedFile);
downloadAllButton.addEventListener("click", downloadAllFiles);
clientCsvInput.addEventListener("change", handleClientCsvSelection);
mergeClientsButton.addEventListener("click", handleMergeClients);
downloadClientsButton.addEventListener("click", handleDownloadClients);
masterClientsInput.addEventListener("change", handleMasterClientsSelection);
masterFileInput.addEventListener("change", handleMasterFileSelection);
filterMasterButton.addEventListener("click", handleFilterMasterFile);
downloadFilteredButton.addEventListener("click", handleDownloadFilteredMaster);
clientSourceInputs.forEach((input) => input.addEventListener("change", handleClientSourceChange));
useMergedButton.addEventListener("click", () => {
  document.querySelector('input[name="client-source"][value="merged"]').checked = true;
  handleClientSourceChange();
  navigateToModule("maestro");
});
initializeFilePickers();
initializeNavigation();
updateMergedSource(false);

function initializeNavigation() {
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    const moduleId = link.getAttribute("href").slice(1);
    if (!["dividir", "unir", "maestro"].includes(moduleId)) return;
    link.addEventListener("click", (event) => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      navigateToModule(moduleId);
    });
  });
  window.addEventListener("hashchange", focusModuleFromLocation);
  window.addEventListener("popstate", focusModuleFromLocation);
}

function navigateToModule(moduleId) {
  if (window.location.hash !== `#${moduleId}`) {
    window.history.pushState(null, "", `#${moduleId}`);
  }
  focusModuleFromLocation();
}

function focusModuleFromLocation() {
  const requested = window.location.hash.slice(1);
  if (!["dividir", "unir", "maestro"].includes(requested)) return;
  const heading = document.querySelector(`#${requested} h2`);
  heading.focus({ preventScroll: true });
  const position = heading.getBoundingClientRect();
  if (position.top < 0 || position.bottom > window.innerHeight) {
    heading.scrollIntoView({ block: "start", behavior: "instant" });
  }
}

function usingMergedClients() {
  return document.querySelector('input[name="client-source"]:checked').value === "merged";
}

function getActiveMasterClientList() {
  if (!usingMergedClients()) return masterClientList;
  return clientesDepurados ? { ...clientesDepurados, fileName: "Lista unida (módulo 2)" } : null;
}

function handleClientSourceChange() {
  const useMerged = usingMergedClients();
  mergedSourcePanel.hidden = !useMerged;
  uploadedSourcePanel.hidden = useMerged;
  resetFilteredMasterResults();
  renderMasterSetupSummary();
}

function updateMergedSource(refreshMaster = true) {
  const count = clientesDepurados?.values.length || 0;
  useMergedButton.disabled = !count;
  mergedSourceStatus.textContent = count
    ? `${count.toLocaleString("es-CO")} clientes únicos listos para excluir.`
    : "Une tus CSV para reutilizar la lista.";
  prepareMergeLink.hidden = count > 0;
  if (refreshMaster && usingMergedClients()) {
    resetFilteredMasterResults();
    renderMasterSetupSummary();
  }
}

function initializeFilePickers() {
  const inputs = document.querySelectorAll("[data-file-summary]");

  inputs.forEach((input) => {
    input.addEventListener("change", () => updateFileSummary(input));
    input.addEventListener("dragenter", () => setFilePickerDragState(input, true));
    input.addEventListener("dragover", () => setFilePickerDragState(input, true));
    input.addEventListener("dragleave", () => setFilePickerDragState(input, false));
    input.addEventListener("drop", () => {
      setFilePickerDragState(input, false);
      window.setTimeout(() => updateFileSummary(input), 0);
    });

    updateFileSummary(input);
  });
}

function updateFileSummary(input) {
  const summary = document.getElementById(input.dataset.fileSummary);

  if (!summary) {
    return;
  }

  const files = Array.from(input.files || []);
  summary.classList.toggle("has-file", files.length > 0);

  if (!files.length) {
    summary.textContent = "Ningún archivo seleccionado.";
    return;
  }

  if (files.length === 1) {
    summary.textContent = files[0].name;
    return;
  }

  summary.textContent = `${files.length} archivos seleccionados`;
}

function setFilePickerDragState(input, isDragging) {
  const picker = input.closest(".file-picker");

  if (picker) {
    picker.classList.toggle("is-dragging", isDragging);
  }
}

function handleFileSelection() {
  clearDownloads();

  if (!fileInput.files.length) {
    showMessages([{ text: "No se ha cargado ningún archivo.", type: "error" }]);
    return;
  }

  const file = fileInput.files[0];
  const extension = getFileExtension(file.name);

  if (!allowedExtensions.includes(extension)) {
    showMessages([{ text: "El archivo debe ser .xlsx, .xls o .csv.", type: "error" }]);
    return;
  }

  showMessages([{ text: `Archivo cargado: ${file.name}`, type: "success" }]);
}

async function processSelectedFile() {
  clearDownloads();
  const validation = validateInputs();

  if (!validation.isValid) {
    showMessages([{ text: validation.message, type: "error" }]);
    return;
  }

  setProcessingState(true);
  showMessages([{ text: "Procesando archivo...", type: "info" }]);

  try {
    ensureSheetJsIsAvailable();

    const file = fileInput.files[0];
    const rowsPerFile = Number.parseInt(rowsInput.value, 10);
    const workbook = await readWorkbook(file);
    const worksheet = getFirstWorksheet(workbook);
    const allRows = getRowsFromWorksheet(worksheet);
    const normalizedRows = normalizeRows(allRows);
    const { header, dataRows } = separarEncabezadoYDatos(normalizedRows);

    validateWorkbookData(dataRows);

    const parts = splitRows(dataRows, rowsPerFile);
    const fileBaseName = sanitizeFileBaseName(removeFileExtension(file.name));
    const downloadItems = createCsvDownloads(fileBaseName, header, parts);
    const messages = buildSuccessMessages(file, workbook, dataRows.length, downloadItems.length);

    generatedArchiveName = `${fileBaseName}_partes_csv.zip`;
    renderDownloads(downloadItems);
    showMessages(messages);
  } catch (error) {
    showMessages([{ text: error.message || "No fue posible procesar el archivo.", type: "error" }]);
  } finally {
    setProcessingState(false);
  }
}

function validateInputs() {
  if (!fileInput.files.length) {
    return { isValid: false, message: "Debes cargar un archivo antes de procesar." };
  }

  const file = fileInput.files[0];
  const extension = getFileExtension(file.name);

  if (!allowedExtensions.includes(extension)) {
    return { isValid: false, message: "El archivo debe tener extensión .xlsx, .xls o .csv." };
  }

  const rowsPerFile = Number.parseInt(rowsInput.value, 10);

  if (!Number.isInteger(rowsPerFile) || rowsPerFile <= 0) {
    return { isValid: false, message: "El número de filas por archivo debe ser mayor a 0." };
  }

  return { isValid: true };
}

function ensureSheetJsIsAvailable() {
  if (typeof XLSX === "undefined") {
    throw new Error("No se pudo cargar la librería SheetJS/xlsx. Revisa tu conexión a internet.");
  }
}

function ensureZipLibraryIsAvailable() {
  if (typeof JSZip === "undefined") {
    throw new Error("No se pudo cargar la librería JSZip. Revisa tu conexión a internet.");
  }
}

async function readWorkbook(file) {
  const data = await file.arrayBuffer();

  try {
    return XLSX.read(data, { type: "array", raw: false });
  } catch (error) {
    throw new Error("El archivo no es válido o no pudo leerse con SheetJS/xlsx.");
  }
}

function getFirstWorksheet(workbook) {
  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error("El archivo no contiene hojas para procesar.");
  }

  return workbook.Sheets[workbook.SheetNames[0]];
}

function getRowsFromWorksheet(worksheet) {
  const rows = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: "",
    blankrows: true,
    raw: false
  });

  if (!rows.length) {
    throw new Error("El archivo no tiene datos.");
  }

  return rows;
}

function normalizeRows(rows) {
  const maxColumns = rows.reduce((max, row) => Math.max(max, row.length), 0);

  return rows.map((row) => {
    const normalizedRow = Array.from({ length: maxColumns }, (_, index) => row[index] ?? "");
    return normalizedRow.map((value) => valueToText(value));
  });
}

function obtenerFilasValidas(filas) {
  if (!filas || filas.length === 0) {
    return [];
  }

  return archivoTieneEncabezado(filas) ? filas.slice(1) : filas;
}

function obtenerCodigoCliente(fila) {
  return limpiarCliente(fila?.[0]);
}

function archivoTieneEncabezado(filas) {
  const primerValorPrimeraColumna = obtenerCodigoCliente(filas?.[0]);
  return !primerValorPrimeraColumna.startsWith("1");
}

function separarEncabezadoYDatos(filas) {
  const tieneEncabezado = archivoTieneEncabezado(filas);

  return {
    tieneEncabezado,
    header: tieneEncabezado ? filas[0] : null,
    dataRows: obtenerFilasValidas(filas),
    columnCount: filas.reduce((max, row) => Math.max(max, row.length), 0)
  };
}

function validateWorkbookData(dataRows) {
  if (!dataRows.length || !dataRows.some(rowHasData)) {
    throw new Error("El archivo debe contener al menos una fila de datos valida.");
  }
}

function splitRows(rows, rowsPerFile) {
  const parts = [];

  for (let start = 0; start < rows.length; start += rowsPerFile) {
    parts.push(rows.slice(start, start + rowsPerFile));
  }

  return parts;
}

function createCsvDownloads(fileBaseName, header, parts) {
  return parts.map((partRows, index) => {
    const fileName = `${fileBaseName}_parte_${index + 1}.csv`;
    const rowsToExport = header ? [header, ...partRows] : partRows;
    const csvContent = toCsv(rowsToExport);
    const blob = new Blob([`\ufeff${csvContent}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    generatedUrls.push(url);

    return {
      fileName,
      rowCount: partRows.length,
      blob,
      url
    };
  });
}

function toCsv(rows) {
  return rows.map((row) => row.map(escapeCsvValue).join(",")).join("\r\n");
}

function escapeCsvValue(value) {
  const text = valueToText(value);
  const mustQuote = /[",\r\n]/.test(text);
  const escaped = text.replace(/"/g, "\"\"");

  return mustQuote ? `"${escaped}"` : escaped;
}

function valueToText(value) {
  if (value === null || value === undefined) {
    return "";
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return String(value);
}

function buildSuccessMessages(file, workbook, totalDataRows, totalFiles) {
  const firstSheetName = workbook.SheetNames[0];
  const messages = [
    {
      text: `Archivos generados correctamente: ${totalFiles} CSV con ${totalDataRows} filas de datos en total.`,
      type: "success"
    },
    {
      text: `Hoja procesada: ${firstSheetName}.`,
      type: "info"
    }
  ];

  if (workbook.SheetNames.length > 1) {
    messages.push({
      text: `Aviso: ${file.name} tiene ${workbook.SheetNames.length} hojas; se procesó únicamente la primera hoja.`,
      type: "warning"
    });
  }

  return messages;
}

function renderDownloads(downloadItems) {
  downloadsList.innerHTML = "";
  generatedDownloadItems = downloadItems;
  downloadCount.textContent = `${downloadItems.length} ${downloadItems.length === 1 ? "archivo" : "archivos"}`;
  updateDownloadAllButton();

  downloadItems.forEach((item) => {
    const link = document.createElement("a");
    link.href = item.url;
    link.download = item.fileName;
    link.className = "download-link";

    const name = document.createElement("span");
    name.textContent = item.fileName;

    const rows = document.createElement("span");
    rows.className = "download-size";
    rows.textContent = `${item.rowCount} filas`;

    link.append(name, rows);
    downloadsList.appendChild(link);
  });
}

async function downloadAllFiles() {
  if (!generatedDownloadItems.length) {
    showMessages([{ text: "Primero procesa un archivo para generar descargas.", type: "warning" }]);
    return;
  }

  setDownloadAllState(true);

  try {
    ensureZipLibraryIsAvailable();

    const zip = new JSZip();
    generatedDownloadItems.forEach((item) => {
      zip.file(item.fileName, item.blob);
    });

    const zipBlob = await zip.generateAsync({ type: "blob" });
    triggerDownload(zipBlob, generatedArchiveName);
    showMessages([{ text: `Descarga iniciada: ${generatedArchiveName}`, type: "success" }]);
  } catch (error) {
    showMessages([{ text: error.message || "No fue posible descargar todos los archivos.", type: "error" }]);
  } finally {
    setDownloadAllState(false);
  }
}

function handleClientCsvSelection() {
  resetClientResults();

  if (!clientCsvInput.files.length) {
    mostrarMensajeResumen(clientsSummary, "No se han cargado archivos CSV de clientes.", "error");
    return;
  }

  const files = Array.from(clientCsvInput.files);
  const invalidFiles = files.filter((file) => getFileExtension(file.name) !== "csv");

  if (invalidFiles.length) {
    mostrarMensajeResumen(clientsSummary, "Todos los archivos de clientes deben tener extensión .csv.", "error");
    return;
  }

  mostrarMensajeResumen(clientsSummary, `${files.length} ${files.length === 1 ? "archivo listo" : "archivos listos"} para unir.`, "info");
}

async function handleMergeClients() {
  resetClientResults();

  if (!clientCsvInput.files.length) {
    mostrarMensajeResumen(clientsSummary, "Debes cargar al menos un CSV de clientes.", "error");
    return;
  }

  const files = Array.from(clientCsvInput.files);
  const invalidFiles = files.filter((file) => getFileExtension(file.name) !== "csv");

  if (invalidFiles.length) {
    mostrarMensajeResumen(clientsSummary, "Los archivos seleccionados para clientes deben ser .csv.", "error");
    return;
  }

  setClientProcessingState(true);
  mostrarMensajeResumen(clientsSummary, "Uniendo clientes y quitando duplicados...", "info");

  try {
    ensureSheetJsIsAvailable();

    clientesDepurados = await unirClientes(files);

    if (!clientesDepurados.values.length) {
      clientesDepurados = null;
      mostrarMensajeResumen(clientsSummary, "No se encontraron clientes validos en la primera columna.", "error");
      return;
    }

    clientesDepuradosBlob = crearCsvBlob([
      [clientesDepurados.header],
      ...clientesDepurados.values.map((value) => [value])
    ]);
    downloadClientsButton.disabled = false;
    renderClientSummary(clientesDepurados);
    updateMergedSource();
  } catch (error) {
    clientesDepurados = null;
    mostrarMensajeResumen(clientsSummary, error.message || "No fue posible unir los CSV de clientes.", "error");
  } finally {
    setClientProcessingState(false);
  }
}

function handleDownloadClients() {
  if (!clientesDepuradosBlob) {
    mostrarMensajeResumen(clientsSummary, "Primero genera la lista de clientes únicos.", "warning");
    return;
  }

  triggerDownload(clientesDepuradosBlob, "clientes_unificados_sin_duplicados.csv");
}

async function handleMasterClientsSelection() {
  resetMasterClientList();
  resetFilteredMasterResults();

  if (!masterClientsInput.files.length) {
    mostrarMensajeResumen(masterSummary, "No se ha cargado ninguna lista de clientes.", "error");
    return;
  }

  const file = masterClientsInput.files[0];
  const extension = getFileExtension(file.name);

  if (!allowedExtensions.includes(extension)) {
    mostrarMensajeResumen(masterSummary, "La lista de clientes debe ser .csv, .xlsx o .xls.", "error");
    return;
  }

  setMasterProcessingState(true, "Leyendo...");
  mostrarMensajeResumen(masterSummary, "Leyendo lista de clientes a eliminar...", "info");

  try {
    ensureSheetJsIsAvailable();

    masterClientList = await leerListaClientesParaEliminar(file);
    renderMasterSetupSummary([{ text: "Lista de clientes cargada correctamente.", type: "success" }]);
  } catch (error) {
    resetMasterClientList();
    mostrarMensajeResumen(masterSummary, error.message || "No fue posible leer la lista de clientes.", "error");
  } finally {
    setMasterProcessingState(false);
  }
}

async function handleMasterFileSelection() {
  resetMasterFileData();
  resetFilteredMasterResults();

  if (!masterFileInput.files.length) {
    mostrarMensajeResumen(masterSummary, "No se ha cargado ningún archivo maestro.", "error");
    return;
  }

  const file = masterFileInput.files[0];
  const extension = getFileExtension(file.name);

  if (!allowedExtensions.includes(extension)) {
    mostrarMensajeResumen(masterSummary, "El archivo maestro debe ser .csv, .xlsx o .xls.", "error");
    return;
  }

  setMasterProcessingState(true, "Leyendo...");
  mostrarMensajeResumen(masterSummary, "Leyendo archivo maestro...", "info");

  try {
    ensureSheetJsIsAvailable();

    const workbook = await readWorkbook(file);
    const worksheet = getFirstWorksheet(workbook);
    const rows = normalizeRows(getRowsFromWorksheet(worksheet));
    const { header, dataRows, columnCount } = separarEncabezadoYDatos(rows);
    const validDataRows = dataRows.filter(rowHasData);

    validateWorkbookData(validDataRows);

    masterFileData = {
      fileName: file.name,
      header,
      dataRows: validDataRows,
      columnCount
    };

    renderMasterColumnOptions(header);
    renderMasterSetupSummary([{ text: "Archivo maestro cargado correctamente.", type: "success" }]);
  } catch (error) {
    resetMasterFileData();
    mostrarMensajeResumen(masterSummary, error.message || "No fue posible leer el archivo maestro.", "error");
  } finally {
    setMasterProcessingState(false);
  }
}

function handleFilterMasterFile() {
  resetFilteredMasterResults();
  const activeClientList = getActiveMasterClientList();

  if (!activeClientList || !activeClientList.keys.size) {
    const message = usingMergedClients()
      ? "Une tus CSV en el módulo 2 o elige Subir archivo."
      : "Carga una lista de clientes para excluir.";
    mostrarMensajeResumen(masterSummary, message, "warning");
    return;
  }

  if (!masterFileData) {
    mostrarMensajeResumen(masterSummary, "Debes cargar un archivo maestro antes de filtrar.", "error");
    return;
  }

  setMasterProcessingState(true, "Filtrando...");

  try {
    const result = filtrarArchivoMaestro(masterFileData, activeClientList.keys);
    const rowsToDownload = masterFileData.header
      ? [masterFileData.header, ...result.remainingRows]
      : result.remainingRows;
    filteredMasterBlob = crearCsvBlob(rowsToDownload);
    filteredMasterFileName = `${sanitizeFileBaseName(removeFileExtension(masterFileData.fileName))}_excluidos.csv`;
    downloadFilteredButton.disabled = false;
    renderMasterSummary(result);
  } catch (error) {
    mostrarMensajeResumen(masterSummary, error.message || "No fue posible filtrar el archivo maestro.", "error");
  } finally {
    setMasterProcessingState(false);
  }
}

function handleDownloadFilteredMaster() {
  if (!filteredMasterBlob) {
    mostrarMensajeResumen(masterSummary, "Primero filtra el archivo maestro.", "warning");
    return;
  }

  triggerDownload(filteredMasterBlob, filteredMasterFileName);
}

async function leerCSV(file) {
  if (getFileExtension(file.name) !== "csv") {
    throw new Error(`${file.name} no es un archivo CSV.`);
  }

  const workbook = await readWorkbook(file);
  const worksheet = getFirstWorksheet(workbook);
  return normalizeRows(getRowsFromWorksheet(worksheet));
}

async function leerListaClientesParaEliminar(file) {
  const workbook = await readWorkbook(file);
  const worksheet = getFirstWorksheet(workbook);
  const rows = normalizeRows(getRowsFromWorksheet(worksheet));
  const validRows = obtenerFilasValidas(rows);

  if (!validRows.length || !validRows.some((row) => obtenerCodigoCliente(row) !== "")) {
    throw new Error("La lista de clientes esta vacia o no tiene clientes validos en la primera columna.");
  }

  const header = archivoTieneEncabezado(rows) ? obtenerCodigoCliente(rows[0]) || "Cliente" : "Cliente";
  const records = validRows
    .map(obtenerCodigoCliente)
    .filter(Boolean);

  if (!records.length) {
    throw new Error("No se encontraron clientes validos en la primera columna.");
  }

  const values = quitarDuplicados(records);

  return {
    fileName: file.name,
    header,
    totalRecords: records.length,
    duplicateCount: records.length - values.length,
    values,
    keys: new Set(values.map(normalizarCliente))
  };
}

function normalizarCliente(value) {
  return limpiarCliente(value).toLowerCase();
}

function limpiarCliente(value) {
  return valueToText(value).replace(/^\ufeff/, "").trim();
}

async function unirClientes(files) {
  let header = "";
  let totalRecords = 0;
  const records = [];
  const warnings = [];

  for (const file of files) {
    let rows = [];

    try {
      rows = await leerCSV(file);
    } catch (error) {
      warnings.push(`${file.name}: vacío o no legible.`);
      continue;
    }

    const validRows = obtenerFilasValidas(rows);

    if (!validRows.length || !validRows.some((row) => obtenerCodigoCliente(row) !== "")) {
      warnings.push(`${file.name}: vacio o sin clientes validos en la primera columna.`);
      continue;
    }

    const currentHeader = archivoTieneEncabezado(rows) ? obtenerCodigoCliente(rows[0]) || "Cliente" : "Cliente";

    if (!header) {
      header = currentHeader;
    }

    validRows.forEach((row) => {
      const value = obtenerCodigoCliente(row);

      if (!value) {
        return;
      }

      records.push(value);
      totalRecords += 1;
    });
  }

  if (!header) {
    throw new Error("Ningun CSV contiene clientes validos en la primera columna.");
  }

  const values = quitarDuplicados(records);

  return {
    fileCount: files.length,
    totalRecords,
    duplicateCount: totalRecords - values.length,
    header,
    values,
    keys: new Set(values.map(normalizarCliente)),
    warnings
  };
}

function quitarDuplicados(values) {
  const seen = new Set();
  const uniqueValues = [];

  values.forEach((value) => {
    const key = normalizarCliente(value);

    if (!key || seen.has(key)) {
      return;
    }

    seen.add(key);
    uniqueValues.push(value);
  });

  return uniqueValues;
}

function crearCsvBlob(rows) {
  return new Blob([`\ufeff${toCsv(rows)}`], { type: "text/csv;charset=utf-8;" });
}

function filtrarArchivoMaestro(masterData, excludedClientKeys) {
  const foundClientKeys = new Set();
  const remainingRows = [];
  let removedRowsCount = 0;

  masterData.dataRows.forEach((row) => {
    const key = normalizarCliente(obtenerCodigoCliente(row));

    if (key && excludedClientKeys.has(key)) {
      foundClientKeys.add(key);
      removedRowsCount += 1;
      return;
    }

    remainingRows.push(row);
  });

  return {
    totalRows: masterData.dataRows.length,
    foundClientsCount: foundClientKeys.size,
    removedRowsCount,
    remainingRows,
    notFoundClientsCount: excludedClientKeys.size - foundClientKeys.size
  };
}

function renderClientSummary(result) {
  const messages = [{ text: "Clientes unificados correctamente.", type: "success" }];

  result.warnings.forEach((warning) => {
    messages.push({ text: warning, type: "warning" });
  });

  mostrarResumen(clientsSummary, [
    ["Archivos cargados", result.fileCount],
    ["Registros leídos", result.totalRecords],
    ["Duplicados eliminados", result.duplicateCount],
    ["Clientes únicos", result.values.length]
  ], messages);
}

function renderMasterSummary(result) {
  mostrarResumen(masterSummary, [
    ["Filas del archivo maestro", result.totalRows],
    ["Clientes encontrados", result.foundClientsCount],
    ["Filas eliminadas", result.removedRowsCount],
    ["Filas restantes", result.remainingRows.length],
    ["Clientes no encontrados", result.notFoundClientsCount],
    ["Archivo de salida", filteredMasterFileName]
  ], [{ text: "Archivo maestro filtrado correctamente.", type: "success" }]);
}

function renderMasterSetupSummary(messages = []) {
  const items = [];
  const activeClientList = getActiveMasterClientList();

  if (activeClientList) {
    items.push(
      ["Lista de clientes", activeClientList.fileName],
      ["Clientes a excluir", activeClientList.values.length]
    );
  }

  if (masterFileData) {
    items.push(
      ["Archivo maestro", masterFileData.fileName],
      ["Columnas detectadas", masterFileData.columnCount],
      ["Filas de datos", masterFileData.dataRows.length]
    );
  }

  if (!items.length) {
    mostrarMensajeResumen(masterSummary, "Elige una lista de clientes y carga tu maestro.", "info");
    return;
  }

  mostrarResumen(masterSummary, items, messages);
}

function mostrarResumen(container, items, messages = []) {
  container.innerHTML = "";

  if (items.length) {
    const list = document.createElement("ul");
    list.className = "summary-list";

    items.forEach(([label, value]) => {
      const item = document.createElement("li");
      if (typeof value === "string") item.className = "summary-file";
      const labelSpan = document.createElement("span");
      const valueStrong = document.createElement("strong");

      labelSpan.textContent = label;
      valueStrong.textContent = value;
      item.append(labelSpan, valueStrong);
      list.appendChild(item);
    });

    container.appendChild(list);
  }

  messages.forEach((message) => {
    const paragraph = document.createElement("p");
    paragraph.className = `message ${message.type || "info"}`;
    paragraph.textContent = message.text;
    container.appendChild(paragraph);
  });
}

function mostrarMensajeResumen(container, text, type = "info") {
  mostrarResumen(container, [], [{ text, type }]);
}

function renderMasterColumnOptions(header) {
  masterColumnSelect.innerHTML = "";

  const option = document.createElement("option");
  const firstColumnName = header ? limpiarCliente(header[0]) : "";
  const label = firstColumnName || "Columna 1";

  option.value = "0";
  option.textContent = label;
  masterColumnSelect.appendChild(option);
  masterColumnGroup.classList.add("hidden");
  masterColumnSelect.value = "0";
}

function getSelectedMasterColumnIndex() {
  return 0;
}

function resetClientResults() {
  clientesDepurados = null;
  clientesDepuradosBlob = null;
  downloadClientsButton.disabled = true;
  updateMergedSource();
}

function resetMasterFileData() {
  masterFileData = null;
  masterColumnSelect.innerHTML = "";
  masterColumnGroup.classList.add("hidden");
}

function resetMasterClientList() {
  masterClientList = null;
}

function resetFilteredMasterResults() {
  filteredMasterBlob = null;
  filteredMasterFileName = null;
  downloadFilteredButton.disabled = true;
}

function setClientProcessingState(isProcessing) {
  mergeClientsButton.disabled = isProcessing;
  clientCsvInput.disabled = isProcessing;
  mergeClientsButton.textContent = isProcessing ? "Uniendo..." : "Unir y depurar";
  downloadClientsButton.disabled = isProcessing || !clientesDepuradosBlob;
}

function setMasterProcessingState(isProcessing, processingText = "Procesando...") {
  filterMasterButton.disabled = isProcessing;
  masterClientsInput.disabled = isProcessing;
  masterFileInput.disabled = isProcessing;
  clientSourceInputs.forEach((input) => { input.disabled = isProcessing; });
  filterMasterButton.textContent = isProcessing ? processingText : "Excluir clientes";
  downloadFilteredButton.disabled = isProcessing || !filteredMasterBlob;
}

function triggerDownload(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.style.display = "none";

  document.body.appendChild(link);
  link.click();
  link.remove();

  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function showMessages(messages) {
  statusMessages.innerHTML = "";

  messages.forEach((message) => {
    const paragraph = document.createElement("p");
    paragraph.className = `message ${message.type || "info"}`;
    paragraph.textContent = message.text;
    statusMessages.appendChild(paragraph);
  });
}

function clearDownloads() {
  generatedUrls.forEach((url) => URL.revokeObjectURL(url));
  generatedUrls = [];
  generatedDownloadItems = [];
  generatedArchiveName = "archivos_csv.zip";
  downloadsList.innerHTML = '<p class="empty-state">Tus partes aparecerán aquí al dividir el archivo.</p>';
  downloadCount.textContent = "0 archivos";
  updateDownloadAllButton();
}

function setProcessingState(isProcessing) {
  processButton.disabled = isProcessing;
  fileInput.disabled = isProcessing;
  rowsInput.disabled = isProcessing;
  processButton.textContent = isProcessing ? "Dividiendo..." : "Dividir archivo";
  updateDownloadAllButton();
}

function setDownloadAllState(isDownloading) {
  downloadAllButton.dataset.loading = isDownloading ? "true" : "false";
  downloadAllButton.textContent = isDownloading ? "Preparando ZIP..." : "Descargar ZIP";
  updateDownloadAllButton();
}

function updateDownloadAllButton() {
  const isDownloading = downloadAllButton.dataset.loading === "true";
  downloadAllButton.disabled = isDownloading || processButton.disabled || !generatedDownloadItems.length;
}

function getFileExtension(fileName) {
  return fileName.split(".").pop().toLowerCase();
}

function removeFileExtension(fileName) {
  return fileName.replace(/\.[^/.]+$/, "");
}

function sanitizeFileBaseName(fileName) {
  const cleanName = fileName.replace(/[\\/:*?"<>|]+/g, "_").trim();
  return cleanName || "archivo";
}

function rowHasData(row) {
  return row.some((cell) => cell.trim() !== "");
}

function probarValidacionEncabezado() {
  const pruebas = [
    {
      nombre: "Sin encabezado",
      filas: [
        ["123456789", "Cliente 1"],
        ["123456790", "Cliente 2"]
      ],
      esperado: 2
    },
    {
      nombre: "Con encabezado",
      filas: [
        ["Codigo Cliente", "Nombre"],
        ["123456789", "Cliente 1"],
        ["123456790", "Cliente 2"]
      ],
      esperado: 2
    },
    {
      nombre: "Varias columnas sin encabezado",
      filas: [
        ["123456789", "Cliente 1", "Medellin"],
        ["123456790", "Cliente 2", "Bogota"]
      ],
      esperado: 2
    },
    {
      nombre: "Varias columnas con encabezado",
      filas: [
        ["Codigo Cliente", "Nombre", "Ciudad"],
        ["123456789", "Cliente 1", "Medellin"],
        ["123456790", "Cliente 2", "Bogota"]
      ],
      esperado: 2
    }
  ];

  pruebas.forEach((prueba) => {
    const resultado = obtenerFilasValidas(prueba.filas);

    if (resultado.length === prueba.esperado) {
      console.log(`OK ${prueba.nombre}: correcto`);
    } else {
      console.error(`${prueba.nombre}: esperado ${prueba.esperado}, obtenido ${resultado.length}`);
    }
  });
}
