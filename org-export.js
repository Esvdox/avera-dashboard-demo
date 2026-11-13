/* Exports run entirely in the browser and use the current view snapshot. */
(() => {
  const scriptPromises = new Map();
  function loadScript(file) {
    if (!scriptPromises.has(file)) {
      scriptPromises.set(file, new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = new URL(file, document.currentScript?.src || location.href).href;
        script.onload = resolve;
        script.onerror = () => {
          scriptPromises.delete(file);
          script.remove();
          reject(new Error('Не удалось загрузить выгрузку. Проверьте соединение и повторите.'));
        };
        document.head.append(script);
      }));
    }
    return scriptPromises.get(file);
  }

  function download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  async function excel(snapshot) {
    await loadScript('org-assets/exceljs.min.js');
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Лабораттория';
    workbook.created = new Date();
    const sheet = workbook.addWorksheet('Штатная структура', {
      views: [{state: 'frozen', xSplit: 2, ySplit: 1}]
    });
    sheet.columns = [
      {header: 'Код', key: 'code', width: 16},
      {header: 'Подразделение / должность', key: 'title', width: 58},
      {header: 'Подчинение', key: 'parent', width: 50},
      {header: 'Шт. ед.', key: 'units', width: 12},
      {header: 'Сотрудники', key: 'employees', width: 42},
      {header: 'Статус', key: 'status', width: 26},
      {header: 'ФОТ, ₽/мес.', key: 'budget', width: 24}
    ];
    for (const item of snapshot.rows) {
      const row = sheet.addRow(item);
      row.outlineLevel = Math.min(item.depth, 7);
      row.getCell(2).alignment = {indent: Math.min(item.depth, 6), wrapText: true, vertical: 'top'};
      row.height = Math.max(36, 15 * Math.max(
        Math.ceil(item.title.length / 36),
        Math.ceil(item.parent.length / 32),
        ...item.employees.split('\n').map(line => Math.ceil(line.length / 27)),
        item.employees.split('\n').length
      ));
      if (item.group) {
        row.eachCell(cell => {
          cell.fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: 'FFE4E9F0'}};
        });
      }
    }
    sheet.properties.outlineProperties = {summaryBelow: false, summaryRight: false};
    sheet.autoFilter = {from: 'A1', to: 'G' + sheet.rowCount};
    sheet.getColumn(7).numFmt = '#,##0.00';
    const summary = workbook.addWorksheet('Итоги', {views: [{state: 'frozen', ySplit: 1}]});
    summary.columns = [{header: 'Показатель', width: 52}, {header: 'Значение', width: 80}];
    summary.addRows([
      ['Вкладка', snapshot.title], ['Дата выгрузки', snapshot.date],
      ['ФОТ', 'Суммы блоков включают вложенные подразделения. Повторно складывать их не следует.'],
      ...snapshot.totals
    ]);
    for (const tab of workbook.worksheets) {
      tab.eachRow(row => row.eachCell(cell => {
        cell.font = {name: 'Arial', size: 11};
        cell.alignment = {...cell.alignment, wrapText: true, vertical: 'top'};
      }));
      tab.getRow(1).eachCell(cell => {
        cell.fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: 'FF30465C'}};
        cell.font = {name: 'Arial', size: 11, color: {argb: 'FFFFFFFF'}, bold: true};
      });
      tab.getRow(1).height = 30;
    }
    summary.getRow(4).height = 40;
    download(new Blob([await workbook.xlsx.writeBuffer()], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    }), snapshot.filename + '.xlsx');
  }

  async function pdf(snapshot) {
    await loadScript('org-assets/pdfmake.min.js');
    await loadScript('org-assets/vfs_fonts.js');
    const headings = ['Код', 'Подразделение / должность', 'Подчинение', 'Шт. ед.', 'Сотрудники', 'Статус', 'ФОТ, ₽/мес.'];
    const body = [headings.map(text => ({text, bold: true, color: '#ffffff', fillColor: '#30465c'}))];
    for (const item of snapshot.rows) {
      const values = [item.code, item.title, item.parent.replaceAll(' → ', ' / '), item.units ?? '', item.employees, item.status, item.budget===null?'':item.budget.toLocaleString('ru-RU')];
      body.push(values.map((text, index) => ({
        text: String(text), fillColor: item.group ? '#e4e9f0' : null,
        bold: item.group && index === 1,
        margin: [index === 1 ? Math.min(item.depth, 5) * 3 : 0, 2, 0, 2]
      })));
    }
    const definition = {
      pageSize: 'A4', pageOrientation: 'landscape', pageMargins: [24, 28, 24, 30],
      defaultStyle: {font: 'Roboto', fontSize: 8, color: '#30465c'},
      content: [
        {text: 'Лабораттория — ' + snapshot.title, fontSize: 15, bold: true, margin: [0, 0, 0, 6]},
        {text: snapshot.date, margin: [0, 0, 0, 8]},
        {text: 'ФОТ блоков включает вложенные подразделения. Суммы повторно не складываются.', margin: [0, 0, 0, 6]},
        ...snapshot.totals.map(([label, value]) => ({text: label + ' — ' + value, margin: [0, 0, 0, 3]})),
        {table: {headerRows: 1, widths: [42, 170, 145, 32, 155, 90, '*'], body},
          layout: 'lightHorizontalLines', margin: [0, 12, 0, 0]}
      ],
      footer: (page, pages) => ({
        text: page + ' / ' + pages, alignment: 'right', margin: [0, 8, 24, 0], fontSize: 8
      })
    };
    await new Promise((resolve, reject) => {
      try {
        pdfMake.createPdf(definition).getBlob(blob => {
          download(blob, snapshot.filename + '.pdf');
          resolve();
        });
      } catch (error) { reject(error); }
    });
  }

  window.staffingExport = async (format, snapshot) => {
    if (format === 'xlsx') await excel(snapshot);
    else await pdf(snapshot);
  };
})();
