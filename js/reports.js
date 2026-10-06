function xmlEscape(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function crc32(bytes) {
  let crc = 0xffffffff;

  bytes.forEach((byte) => {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  });

  return (crc ^ 0xffffffff) >>> 0;
}

function createStoredZip(files) {
  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  let localOffset = 0;

  files.forEach(({ name, content }) => {
    const nameBytes = encoder.encode(name);
    const contentBytes = encoder.encode(content);
    const checksum = crc32(contentBytes);
    const localHeader = new Uint8Array(30);
    const localView = new DataView(localHeader.buffer);

    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, 0, true);
    localView.setUint16(12, 0x21, true);
    localView.setUint32(14, checksum, true);
    localView.setUint32(18, contentBytes.length, true);
    localView.setUint32(22, contentBytes.length, true);
    localView.setUint16(26, nameBytes.length, true);
    localView.setUint16(28, 0, true);
    localParts.push(localHeader, nameBytes, contentBytes);

    const centralHeader = new Uint8Array(46);
    const centralView = new DataView(centralHeader.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, 0, true);
    centralView.setUint16(14, 0x21, true);
    centralView.setUint32(16, checksum, true);
    centralView.setUint32(20, contentBytes.length, true);
    centralView.setUint32(24, contentBytes.length, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint16(30, 0, true);
    centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true);
    centralView.setUint16(36, 0, true);
    centralView.setUint32(38, 0, true);
    centralView.setUint32(42, localOffset, true);
    centralParts.push(centralHeader, nameBytes);

    localOffset += localHeader.length + nameBytes.length + contentBytes.length;
  });

  const centralSize = centralParts.reduce((size, part) => size + part.length, 0);
  const endRecord = new Uint8Array(22);
  const endView = new DataView(endRecord.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(4, 0, true);
  endView.setUint16(6, 0, true);
  endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, localOffset, true);
  endView.setUint16(20, 0, true);

  const zipParts = [...localParts, ...centralParts, endRecord];
  const zipBytes = new Uint8Array(
    zipParts.reduce((size, part) => size + part.length, 0)
  );
  let offset = 0;
  zipParts.forEach((part) => {
    zipBytes.set(part, offset);
    offset += part.length;
  });

  return zipBytes;
}

function createObservationWorkbook(records) {
  const headers = ['Date', 'Student', 'Plot', 'Condition', 'Observation'];
  const rows = [headers, ...records.map((record) => record.values)];
  const columnName = (index) => {
    let name = '';
    let value = index + 1;
    while (value > 0) {
      value--;
      name = String.fromCharCode(65 + (value % 26)) + name;
      value = Math.floor(value / 26);
    }
    return name;
  };
  const worksheetRows = rows.map((row, rowIndex) => {
    const cells = row.map((value, columnIndex) => {
      const reference = `${columnName(columnIndex)}${rowIndex + 1}`;
      return `<c r="${reference}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`;
    }).join('');
    return `<row r="${rowIndex + 1}">${cells}</row>`;
  }).join('');

  return createStoredZip([
    {
      name: '[Content_Types].xml',
      content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
    },
    {
      name: '_rels/.rels',
      content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    },
    {
      name: 'xl/workbook.xml',
      content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Garden Observations" sheetId="1" r:id="rId1"/></sheets></workbook>',
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    },
    {
      name: 'xl/worksheets/sheet1.xml',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${worksheetRows}</sheetData></worksheet>`,
    },
  ]);
}

function setupReportExport() {
  const periodInput = document.getElementById('report-period');
  const dateInput = document.getElementById('report-date');
  const exportButton = document.querySelector('[data-export-report]');
  const table = document.querySelector('[data-report-table]');
  const emptyState = document.querySelector('[data-report-empty]');
  const summary = document.querySelector('[data-report-summary]');
  const countLabel = document.querySelector('[data-report-count]');
  const dateLabel = document.querySelector('[data-report-date-label]');
  if (!periodInput || !dateInput || !exportButton || !table || !summary || !countLabel) return;

  const rows = [...document.querySelectorAll('[data-report-row]')];
  let filteredRecords = [];
  let reportRange = null;

  const formatDate = (date) => new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
  const toIsoDate = (date) => date.toISOString().slice(0, 10);

  const getRange = (period, dateValue) => {
    const [year, month, day] = dateValue.split('-').map(Number);
    const selected = new Date(Date.UTC(year, month - 1, day));

    if (period === 'daily') {
      return { start: selected, end: selected, fileSuffix: dateValue };
    }

    if (period === 'weekly') {
      const start = new Date(selected);
      const daysSinceMonday = (selected.getUTCDay() + 6) % 7;
      start.setUTCDate(start.getUTCDate() - daysSinceMonday);
      const end = new Date(start);
      end.setUTCDate(end.getUTCDate() + 6);
      return { start, end, fileSuffix: `${toIsoDate(start)}-to-${toIsoDate(end)}` };
    }

    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 0));
    return {
      start,
      end,
      fileSuffix: `${year}-${String(month).padStart(2, '0')}`,
    };
  };

  const updateReport = () => {
    const period = periodInput.value;
    const dateValue = dateInput.value;
    const periodName = period[0].toUpperCase() + period.slice(1);
    if (dateLabel) {
      dateLabel.textContent = period === 'daily' ? 'Date' : 'Choose a date in the period';
    }

    if (!dateValue) {
      filteredRecords = [];
      reportRange = null;
      rows.forEach((row) => { row.hidden = true; });
      table.hidden = true;
      if (emptyState) emptyState.hidden = false;
      countLabel.textContent = '0 observations';
      summary.textContent = 'Choose a date to preview a report.';
      exportButton.disabled = true;
      return;
    }

    reportRange = getRange(period, dateValue);
    const startIso = toIsoDate(reportRange.start);
    const endIso = toIsoDate(reportRange.end);
    filteredRecords = rows.filter((row) => {
      const matches = row.dataset.date >= startIso && row.dataset.date <= endIso;
      row.hidden = !matches;
      return matches;
    }).map((row) => ({
      values: [...row.querySelectorAll('td')].map((cell) => cell.textContent.trim()),
    }));

    const rangeText = startIso === endIso
      ? formatDate(reportRange.start)
      : `${formatDate(reportRange.start)} – ${formatDate(reportRange.end)}`;
    countLabel.textContent = `${filteredRecords.length} ${filteredRecords.length === 1 ? 'observation' : 'observations'}`;
    summary.textContent = `${periodName} report: ${rangeText}`;
    table.hidden = filteredRecords.length === 0;
    if (emptyState) emptyState.hidden = filteredRecords.length > 0;
    exportButton.disabled = filteredRecords.length === 0;
  };

  periodInput.addEventListener('change', updateReport);
  dateInput.addEventListener('input', updateReport);
  exportButton.addEventListener('click', () => {
    if (!filteredRecords.length || !reportRange) return;

    try {
      const workbook = createObservationWorkbook(filteredRecords);
      const file = new Blob([workbook], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const downloadUrl = URL.createObjectURL(file);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `gardentrack-${periodInput.value}-report-${reportRange.fileSuffix}.xlsx`;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
    } catch (error) {
      summary.textContent = `Unable to export the report: ${error.message}`;
    }
  });

  updateReport();
}
