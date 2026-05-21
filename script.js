const allowedExtensions = ["xlsx", "xls", "csv"];
const fileInput = document.getElementById("file-input");
const rowsInput = document.getElementById("rows-input");
const processButton = document.getElementById("process-button");
const statusMessages = document.getElementById("status-messages");
const downloadsList = document.getElementById("downloads-list");
const downloadCount = document.getElementById("download-count");

let generatedUrls = [];

fileInput.addEventListener("change", handleFileSelection);
processButton.addEventListener("click", processSelectedFile);

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
  downloadCount.textContent = `${downloadItems.length} ${downloadItems.length === 1 ? "archivo" : "archivos"}`;

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
  downloadsList.innerHTML = '<p class="empty-state">Los enlaces aparecerán aquí después del procesamiento.</p>';
  downloadCount.textContent = "0 archivos";
}

function setProcessingState(isProcessing) {
  processButton.disabled = isProcessing;
  processButton.textContent = isProcessing ? "Procesando..." : "Procesar archivo";
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
