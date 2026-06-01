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
const masterFileInput = document.getElementById("master-file-input");
const masterColumnGroup = document.getElementById("master-column-group");
const masterColumnSelect = document.getElementById("master-column-select");
const filterMasterButton = document.getElementById("filter-master-button");
const downloadFilteredButton = document.getElementById("download-filtered-button");
const masterSummary = document.getElementById("master-summary");

let generatedUrls = [];
let generatedDownloadItems = [];
let generatedArchiveName = "archivos_csv.zip";
let clientesDepurados = null;
let clientesDepuradosBlob = null;
let masterFileData = null;
let filteredMasterBlob = null;

fileInput.addEventListener("change", handleFileSelection);
processButton.addEventListener("click", processSelectedFile);
downloadAllButton.addEventListener("click", downloadAllFiles);
clientCsvInput.addEventListener("change", handleClientCsvSelection);
mergeClientsButton.addEventListener("click", handleMergeClients);
downloadClientsButton.addEventListener("click", handleDownloadClients);
masterFileInput.addEventListener("change", handleMasterFileSelection);
filterMasterButton.addEventListener("click", handleFilterMasterFile);
downloadFilteredButton.addEventListener("click", handleDownloadFilteredMaster);

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
    const header = normalizedRows[0];
    const dataRows = normalizedRows.slice(1);

    validateWorkbookData(header, dataRows);

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

function validateWorkbookData(header, dataRows) {
  if (!header || !header.some((cell) => cell.trim() !== "")) {
    throw new Error("La primera fila debe contener encabezados.");
  }

  if (!dataRows.length || !dataRows.some(rowHasData)) {
    throw new Error("El archivo debe contener al menos una fila de datos además de los encabezados.");
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
    const csvContent = toCsv([header, ...partRows]);
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
  resetFilteredMasterResults();

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
  resetFilteredMasterResults();

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
      mostrarMensajeResumen(clientsSummary, "No se encontraron clientes válidos debajo del encabezado.", "error");
      return;
    }

    clientesDepuradosBlob = crearCsvBlob([
      [clientesDepurados.header],
      ...clientesDepurados.values.map((value) => [value])
    ]);
    downloadClientsButton.disabled = false;
    renderClientSummary(clientesDepurados);
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
    const header = rows[0];
    const dataRows = rows.slice(1).filter(rowHasData);

    validateWorkbookData(header, dataRows);

    masterFileData = {
      fileName: file.name,
      header,
      dataRows
    };

    renderMasterColumnOptions(header);
    mostrarResumen(masterSummary, [
      ["Archivo maestro", file.name],
      ["Columnas detectadas", header.length],
      ["Filas de datos", dataRows.length]
    ], [{ text: "Archivo maestro cargado correctamente.", type: "success" }]);
  } catch (error) {
    resetMasterFileData();
    mostrarMensajeResumen(masterSummary, error.message || "No fue posible leer el archivo maestro.", "error");
  } finally {
    setMasterProcessingState(false);
  }
}

function handleFilterMasterFile() {
  resetFilteredMasterResults();

  if (!clientesDepurados || !clientesDepurados.keys.size) {
    mostrarMensajeResumen(masterSummary, "Primero genera la lista depurada de clientes únicos.", "warning");
    return;
  }

  if (!masterFileData) {
    mostrarMensajeResumen(masterSummary, "Debes cargar un archivo maestro antes de filtrar.", "error");
    return;
  }

  const selectedColumnIndex = getSelectedMasterColumnIndex();

  if (selectedColumnIndex < 0 || selectedColumnIndex >= masterFileData.header.length) {
    mostrarMensajeResumen(masterSummary, "Selecciona una columna válida para comparar.", "error");
    return;
  }

  setMasterProcessingState(true, "Filtrando...");

  try {
    const result = filtrarArchivoMaestro(masterFileData, clientesDepurados.keys, selectedColumnIndex);
    filteredMasterBlob = crearCsvBlob([masterFileData.header, ...result.remainingRows]);
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

  triggerDownload(filteredMasterBlob, "archivo_maestro_sin_clientes_excluidos.csv");
}

async function leerCSV(file) {
  if (getFileExtension(file.name) !== "csv") {
    throw new Error(`${file.name} no es un archivo CSV.`);
  }

  const workbook = await readWorkbook(file);
  const worksheet = getFirstWorksheet(workbook);
  return normalizeRows(getRowsFromWorksheet(worksheet));
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

    if (!rows.length || !rows[0] || !rows[0].some((cell) => limpiarCliente(cell) !== "")) {
      warnings.push(`${file.name}: no tiene encabezado o está vacío.`);
      continue;
    }

    const currentHeader = limpiarCliente(rows[0][0]);

    if (!currentHeader) {
      warnings.push(`${file.name}: no tiene encabezado en la primera columna.`);
      continue;
    }

    if (!header) {
      header = currentHeader;
    }

    rows.slice(1).forEach((row) => {
      const value = limpiarCliente(row[0]);

      if (!value) {
        return;
      }

      records.push(value);
      totalRecords += 1;
    });
  }

  if (!header) {
    throw new Error("Ningún CSV tiene un encabezado válido.");
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

function filtrarArchivoMaestro(masterData, excludedClientKeys, compareColumnIndex) {
  const foundClientKeys = new Set();
  const remainingRows = [];
  let removedRowsCount = 0;

  masterData.dataRows.forEach((row) => {
    const key = normalizarCliente(row[compareColumnIndex]);

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
    ["Clientes no encontrados", result.notFoundClientsCount]
  ], [{ text: "Archivo maestro filtrado correctamente.", type: "success" }]);
}

function mostrarResumen(container, items, messages = []) {
  container.innerHTML = "";

  if (items.length) {
    const list = document.createElement("ul");
    list.className = "summary-list";

    items.forEach(([label, value]) => {
      const item = document.createElement("li");
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

  header.forEach((columnName, index) => {
    const option = document.createElement("option");
    const label = limpiarCliente(columnName) || `Columna ${index + 1}`;

    option.value = String(index);
    option.textContent = label;
    masterColumnSelect.appendChild(option);
  });

  masterColumnGroup.classList.toggle("hidden", header.length <= 1);
  masterColumnSelect.value = "0";
}

function getSelectedMasterColumnIndex() {
  if (!masterFileData) {
    return -1;
  }

  if (masterFileData.header.length <= 1) {
    return 0;
  }

  return Number.parseInt(masterColumnSelect.value, 10);
}

function resetClientResults() {
  clientesDepurados = null;
  clientesDepuradosBlob = null;
  downloadClientsButton.disabled = true;
}

function resetMasterFileData() {
  masterFileData = null;
  masterColumnSelect.innerHTML = "";
  masterColumnGroup.classList.add("hidden");
}

function resetFilteredMasterResults() {
  filteredMasterBlob = null;
  downloadFilteredButton.disabled = true;
}

function setClientProcessingState(isProcessing) {
  mergeClientsButton.disabled = isProcessing;
  mergeClientsButton.textContent = isProcessing ? "Procesando..." : "Unir y quitar duplicados";
  downloadClientsButton.disabled = isProcessing || !clientesDepuradosBlob;
}

function setMasterProcessingState(isProcessing, processingText = "Procesando...") {
  filterMasterButton.disabled = isProcessing;
  filterMasterButton.textContent = isProcessing ? processingText : "Eliminar clientes encontrados";
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
  downloadsList.innerHTML = '<p class="empty-state">Los enlaces aparecerán aquí después del procesamiento.</p>';
  downloadCount.textContent = "0 archivos";
  updateDownloadAllButton();
}

function setProcessingState(isProcessing) {
  processButton.disabled = isProcessing;
  processButton.textContent = isProcessing ? "Procesando..." : "Procesar archivo";
  updateDownloadAllButton();
}

function setDownloadAllState(isDownloading) {
  downloadAllButton.dataset.loading = isDownloading ? "true" : "false";
  downloadAllButton.textContent = isDownloading ? "Preparando ZIP..." : "Descargar todo";
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
