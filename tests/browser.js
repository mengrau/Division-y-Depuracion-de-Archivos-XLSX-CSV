// Run with a local HTTP server and open /tests/browser.html. No test dependencies.
(async () => {
  const frame = document.getElementById("app");
  const results = document.getElementById("results");
  let passed = 0;
  let failed = 0;
  const waitFor = async (condition) => {
    const start = Date.now();
    while (!condition()) {
      if (Date.now() - start > 10000) throw new Error("Tiempo de espera agotado");
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  };
  const test = async (name, run) => {
    const row = document.createElement("li");
    try { await run(); passed++; row.className = "pass"; row.textContent = "OK: " + name; }
    catch (error) { failed++; row.className = "fail"; row.textContent = "ERROR: " + name + " — " + error.message; }
    results.appendChild(row);
  };
  const assert = (condition, message = "Resultado inesperado") => { if (!condition) throw new Error(message); };
  await waitFor(() => frame.contentWindow && typeof frame.contentWindow.handleFilterMasterFile === "function");
  const app = frame.contentWindow;
  const doc = app.document;
  const byId = (id) => doc.getElementById(id);
  const click = (id) => byId(id).click();
  const navigate = (id) => app.navigateToModule(id);
  const selectSource = (value) => doc.querySelector('input[name="client-source"][value="' + value + '"]').click();
  const csv = (name, text) => new app.File([text], name, { type: "text/csv" });
  const upload = async (id, files) => {
    const transfer = new app.DataTransfer();
    files.forEach((file) => transfer.items.add(file));
    byId(id).files = transfer.files;
    byId(id).dispatchEvent(new app.Event("change", { bubbles: true }));
    await waitFor(() => !byId(id).disabled);
  };
  let downloaded = null;
  app.triggerDownload = (blob, name) => { downloaded = { blob, name }; };
  const content = async () => (await downloaded.blob.text()).replace(/^\uFEFF/, "");
  const masterText = "Codigo,Nombre\n1001,Ana\n1002,Bea\n1003,Cam\n1004,Dan\n";

  await test("Dependencias de Excel y ZIP disponibles", () => {
    assert(app.XLSX && app.JSZip, "No se cargaron las dependencias CDN");
  });
  await test("Tres cards visibles sin sidebar y acceso directo por teclado", () => {
    navigate("unir");
    assert(doc.querySelectorAll(".module-card:not([hidden])").length === 3);
    assert(doc.activeElement.id === "merge-title");
    assert(!doc.querySelector(".sidebar"));
  });
  await test("No permite reutilizar una lista inexistente", () => {
    navigate("maestro");
    click("filter-master-button");
    assert(byId("master-summary").textContent.includes("Une tus CSV"));
    assert(byId("download-filtered-button").disabled);
    assert(byId("use-merged-button").disabled);
  });
  await test("Ir a Unir CSV aparece solo en móvil y sin lista preparada", async () => {
    frame.style.maxWidth = "none";
    for (const [width, visible] of [[1280, false], [390, true]]) {
      frame.style.width = width + "px";
      await new Promise((resolve) => app.requestAnimationFrame(resolve));
      assert((app.getComputedStyle(byId("prepare-merge-link")).display !== "none") === visible);
    }
    frame.style.width = "1280px";
  });
  await test("Une CSV con y sin encabezado y elimina duplicados", async () => {
    navigate("unir");
    await upload("client-csv-input", [csv("a.csv", "Codigo\n1001\n1002\n1002"), csv("b.csv", "1002\n1003")]);
    click("merge-clients-button");
    await waitFor(() => !byId("merge-clients-button").disabled);
    assert(!byId("use-merged-button").disabled);
    click("download-clients-button");
    assert(downloaded.name === "clientes_unificados_sin_duplicados.csv");
    assert(await content() === "Codigo\r\n1001\r\n1002\r\n1003", await content());
  });
  await test("Reutiliza la lista sin descargarla ni volver a subirla", async () => {
    click("use-merged-button");
    assert(!byId("maestro").hidden);
    assert(byId("master-clients-input").files.length === 0);
    assert(byId("merged-source-status").textContent.includes("3 clientes"));
    await upload("master-file-input", [csv("clientes.noviembre.csv", masterText)]);
    click("filter-master-button");
    assert(!byId("download-filtered-button").disabled);
    click("download-filtered-button");
    assert(downloaded.name === "clientes.noviembre_excluidos.csv", downloaded.name);
    assert(await content() === "Codigo,Nombre\r\n1004,Dan", await content());
  });
  await test("Admite lista independiente y cambia de fuente sin perder las listas", async () => {
    selectSource("upload");
    assert(byId("download-filtered-button").disabled);
    assert(!byId("uploaded-source-panel").hidden && byId("merged-source-panel").hidden);
    await upload("master-clients-input", [csv("externa.csv", "Codigo\n1004")]);
    click("filter-master-button");
    click("download-filtered-button");
    assert(await content() === "Codigo,Nombre\r\n1001,Ana\r\n1002,Bea\r\n1003,Cam");
    selectSource("merged");
    assert(byId("download-filtered-button").disabled);
    click("filter-master-button");
    click("download-filtered-button");
    assert(await content() === "Codigo,Nombre\r\n1004,Dan");
  });
  await test("Cambiar CSV invalida la lista reutilizada y su descarga anterior", async () => {
    navigate("unir");
    await upload("client-csv-input", [csv("nueva.csv", "Codigo\n1002")]);
    assert(byId("use-merged-button").disabled);
    assert(byId("download-filtered-button").disabled);
    navigate("maestro");
    click("filter-master-button");
    assert(byId("master-summary").textContent.includes("Une tus CSV"));
    navigate("unir");
    click("merge-clients-button");
    await waitFor(() => !byId("merge-clients-button").disabled);
    navigate("maestro");
    click("filter-master-button");
    click("download-filtered-button");
    assert(await content() === "Codigo,Nombre\r\n1001,Ana\r\n1003,Cam\r\n1004,Dan");
  });
  await test("Cambiar CSV no invalida el resultado de una lista independiente", async () => {
    selectSource("upload");
    click("filter-master-button");
    navigate("unir");
    await upload("client-csv-input", [csv("otra.csv", "Codigo\n1003")]);
    assert(!byId("download-filtered-button").disabled);
  });
  await test("Maestro Excel conserva nombre base, encabezado y columnas", async () => {
    const wb = app.XLSX.utils.book_new();
    app.XLSX.utils.book_append_sheet(wb, app.XLSX.utils.aoa_to_sheet([["Codigo", "Nombre"], ["1001", "Ana"], ["1004", "Dan"]]), "Clientes");
    const data = app.XLSX.write(wb, { bookType: "xlsx", type: "array" });
    navigate("maestro");
    await upload("master-file-input", [new app.File([data], "Maestro Bogotá.xlsx")]);
    assert(byId("download-filtered-button").disabled);
    click("filter-master-button");
    click("download-filtered-button");
    assert(downloaded.name === "Maestro Bogotá_excluidos.csv", downloaded.name);
    assert(await content() === "Codigo,Nombre\r\n1001,Ana", await content());
  });
  await test("Filtra maestro sin encabezado y conserva la primera fila", async () => {
    await upload("master-file-input", [csv("sin_encabezado.csv", "1001,Ana\n1004,Dan")]);
    click("filter-master-button");
    click("download-filtered-button");
    assert(await content() === "1001,Ana");
  });
  await test("Todas las filas excluidas produce CSV con encabezado", async () => {
    await upload("master-file-input", [csv("completo.csv", "Codigo,Nombre\n1004,Dan")]);
    click("filter-master-button");
    click("download-filtered-button");
    assert(await content() === "Codigo,Nombre");
  });
  await test("Lista inválida bloquea filtrado y descarga", async () => {
    await upload("master-clients-input", [csv("vacia.csv", "Codigo")]);
    click("filter-master-button");
    assert(byId("download-filtered-button").disabled);
  });
  await test("División conserva encabezados y genera ZIP", async () => {
    navigate("dividir");
    await upload("file-input", [csv("origen.csv", masterText)]);
    byId("rows-input").value = "2";
    click("process-button");
    await waitFor(() => !byId("process-button").disabled);
    assert(byId("download-count").textContent === "2 archivos");
    const links = byId("downloads-list").querySelectorAll("a");
    assert(links.length === 2);
    const firstPart = await (await app.fetch(links[0].href)).text();
    assert(firstPart.replace(/^\uFEFF/, "") === "Codigo,Nombre\r\n1001,Ana\r\n1002,Bea");
    click("download-all-button");
    await waitFor(() => byId("download-all-button").dataset.loading === "false");
    assert(downloaded.name === "origen_partes_csv.zip");
    const zip = await app.JSZip.loadAsync(await downloaded.blob.arrayBuffer());
    assert(Object.keys(zip.files).length === 2);
  });
  await test("Favicon local disponible", async () => {
    const icon = doc.querySelector('link[rel="icon"]');
    const response = await fetch(icon.href);
    assert(response.ok && (await response.text()).includes("<svg"));
  });
  await test("Cards del mismo tamaño y acciones alineadas con ambas fuentes", async () => {
    frame.style.maxWidth = "none";
    for (const width of [1024, 1280, 1440]) {
      frame.style.width = width + "px";
      await new Promise((resolve) => app.requestAnimationFrame(resolve));
      for (const source of ["merged", "upload"]) {
        selectSource(source);
        const cards = [...doc.querySelectorAll(".module-card")];
        const same = (values) => values.every((value) => Math.abs(value - values[0]) < 1);
        assert(same(cards.map((card) => card.getBoundingClientRect().height)), "Alturas distintas a " + width + " con " + source);
        assert(same(cards.map((card) => card.getBoundingClientRect().width)), "Anchos distintos a " + width);
        assert(same(cards.map((card) => card.querySelector(".primary-button").getBoundingClientRect().top)), "Acciones desalineadas a " + width);
        assert(same(cards.map((card) => card.querySelector(".output-panel").getBoundingClientRect().top)), "Resultados desalineados a " + width);
        cards.forEach((card) => {
          const panel = card.querySelector(".output-panel");
          const action = panel.querySelector("button");
          assert(action.getBoundingClientRect().bottom <= panel.getBoundingClientRect().bottom, "Descarga fuera de la card");
        });
      }
    }
  });
  await test("Diseño responsive sin desbordamiento a 320, 390, 768 y 1280 px", async () => {
    for (const width of [320, 390, 768, 1280]) {
      frame.style.width = width + "px";
      frame.style.maxWidth = "none";
      await new Promise((resolve) => app.requestAnimationFrame(() => app.requestAnimationFrame(resolve)));
      assert(doc.documentElement.scrollWidth <= doc.documentElement.clientWidth, "Desbordamiento a " + width);
      assert(doc.querySelectorAll(".module-card:not([hidden])").length === 3);
      if (width === 1280) {
        const tops = [...doc.querySelectorAll(".module-card")].map((card) => card.getBoundingClientRect().top);
        assert(tops.every((top) => Math.abs(top - tops[0]) < 1), "Las tres cards deben compartir fila en escritorio");
      }
      if (width === 768) {
        const sizes = [...doc.querySelectorAll(".module-card")].map((card) => card.getBoundingClientRect());
        assert(sizes.every((size) => Math.abs(size.width - sizes[0].width) < 1 && Math.abs(size.height - sizes[0].height) < 1), "El maestro debe conservar el tamaño de las otras cards en tablet");
      }
    }
  });
  await test("Scroll nativo y superficies sin desenfoques", () => {
    for (const element of doc.querySelectorAll("*")) {
      assert(app.getComputedStyle(element).backdropFilter === "none", element.className + " usa blur");
    }
    assert(!doc.body.onwheel && !doc.body.onscroll);
  });
  document.getElementById("status").textContent = passed + " pruebas correctas; " + failed + " fallidas.";
  document.title = failed ? "ERROR: pruebas de Archivo" : "OK: pruebas de Archivo";
})().catch((error) => { document.getElementById("status").textContent = "Error de pruebas: " + error.message; });
