const accountsStorageKey = 'gardenTrackerAccounts';
const currentUserStorageKey = 'gardenTrackerCurrentUser';
const demoAccounts = [
  {
    username: 'student',
    fullName: 'Student User',
    password: 'student123',
    role: 'Student',
    redirect: 'student/student_dashboard.html',
  },
  {
    username: 'admin',
    fullName: 'Administrator',
    password: 'admin123',
    role: 'Admin',
    redirect: 'admin/admin_dashboard.html',
  },
];

function setMessage(element, message, isSuccess = false) {
  if (!element) return;
  element.textContent = message;
  element.classList.toggle('success', isSuccess);
  element.classList.toggle('error', !isSuccess && Boolean(message));
}

function getAccounts() {
  try {
    const storedAccounts = JSON.parse(localStorage.getItem(accountsStorageKey));
    return Array.isArray(storedAccounts) ? storedAccounts : [];
  } catch (error) {
    return [];
  }
}

function ensureDemoAccounts() {
  const accounts = getAccounts();
  const usernames = new Set(accounts.map((account) => account.username.toLowerCase()));
  const missingAccounts = demoAccounts.filter(
    (account) => !usernames.has(account.username.toLowerCase())
  );

  if (missingAccounts.length) {
    localStorage.setItem(accountsStorageKey, JSON.stringify([...accounts, ...missingAccounts]));
  }
}

function saveAccount(account) {
  const accounts = getAccounts();
  const usernameExists = accounts.some(
    (existingAccount) => existingAccount.username.toLowerCase() === account.username.toLowerCase()
  );

  if (usernameExists) return false;

  accounts.push(account);
  localStorage.setItem(accountsStorageKey, JSON.stringify(accounts));
  return true;
}

function validateCredentials(username, password) {
  const normalizedUser = username.trim();
  const normalizedPass = password.trim();

  if (!normalizedUser || !normalizedPass) {
    return { valid: false, message: 'Please enter both username and password.' };
  }

  const selectedAccount = getAccounts().find(
    (account) =>
      account.username.toLowerCase() === normalizedUser.toLowerCase() &&
      account.password === normalizedPass
  );

  if (!selectedAccount) {
    return { valid: false, message: 'Invalid username or password.' };
  }

  return { valid: true, redirect: selectedAccount.redirect, username: selectedAccount.username };
}

function registerAccount({ username, fullName, password, confirmPassword, role, redirect, messageElement }) {
  if (!username || !fullName || !password || !confirmPassword) {
    setMessage(messageElement, 'Please complete all registration fields.');
    return;
  }

  if (password.length < 6) {
    setMessage(messageElement, 'Password must be at least 6 characters long.');
    return;
  }

  if (password !== confirmPassword) {
    setMessage(messageElement, 'Passwords do not match.');
    return;
  }

  if (!saveAccount({ username, fullName, password, role, redirect })) {
    setMessage(messageElement, 'That username is already taken.');
    return;
  }

  setMessage(messageElement, `${role} account created successfully. Redirecting to login...`, true);
  setTimeout(() => {
    window.location.href = '../index.html';
  }, 600);
}

function updateUserDisplay() {
  const username = localStorage.getItem(currentUserStorageKey);
  const account = getAccounts().find((item) => item.username === username);
  const displayName = account?.fullName || username;

  if (!username) return;

  document.querySelectorAll('[data-username]').forEach((element) => {
    element.textContent = displayName;
  });

  document.querySelectorAll('[data-username-initial]').forEach((element) => {
    element.textContent = username.charAt(0).toUpperCase();
  });
}

function setupAuthentication() {
  const loginForm = document.getElementById('loginForm');
  const signupForm = document.getElementById('signupForm');
  const adminSignupForm = document.getElementById('adminSignupForm');

  loginForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    const result = validateCredentials(
      document.getElementById('username')?.value ?? '',
      document.getElementById('password')?.value ?? ''
    );
    const message = document.getElementById('loginMessage');

    if (!result.valid) {
      setMessage(message, result.message);
      return;
    }

    setMessage(message, 'Login successful. Redirecting...', true);
    localStorage.setItem(currentUserStorageKey, result.username);
    window.location.href = result.redirect;
  });

  const registrationForms = [
    {
      form: signupForm,
      role: 'Student',
      redirect: 'student/student_dashboard.html',
      messageId: 'signupMessage',
      fields: ['username', 'fullname', 'password', 'confirm-password'],
    },
    {
      form: adminSignupForm,
      role: 'Admin',
      redirect: 'admin/admin_dashboard.html',
      messageId: 'adminSignupMessage',
      fields: ['username', 'admin-name', 'admin-password', 'admin-confirm-password'],
    },
  ];

  registrationForms.forEach(({ form, role, redirect, messageId, fields }) => {
    form?.addEventListener('submit', (event) => {
      event.preventDefault();
      const values = fields.map((id) => document.getElementById(id)?.value?.trim() ?? '');

      registerAccount({
        username: values[0],
        fullName: values[1],
        password: values[2],
        confirmPassword: values[3],
        role,
        redirect,
        messageElement: document.getElementById(messageId),
      });
    });
  });
}

function setText(selector, value) {
  const element = document.querySelector(selector);
  if (element) element.textContent = value;
}

function setupDashboard() {
  const students = ['Juan Dela Cruz', 'Maria Santos', 'Ana Reyes', 'Pedro Garcia'];
  const plots = ['A-12', 'A-14', 'B-02', 'B-06'];
  const observations = [
    { date: 'Aug. 28, 2026', plot: 'A-12', student: 'Juan Dela Cruz' },
    { date: 'Aug. 27, 2026', plot: 'A-14', student: 'Maria Santos' },
    { date: 'Aug. 26, 2026', plot: 'B-02', student: 'Ana Reyes' },
    { date: 'Aug. 25, 2026', plot: 'B-06', student: 'Pedro Garcia' },
  ];
  const studentLogs = [
    { date: 'August 28, 2026' },
    { date: 'August 24, 2026' },
    { date: 'August 20, 2026' },
  ];

  setText('[data-stat="students"]', students.length);
  setText('[data-stat="plots"]', plots.length);
  setText('[data-stat="observations"]', observations.length);
  setText('[data-stat="last-observation"]', studentLogs[0].date);
  setText('[data-stat="submitted-observations"]', studentLogs.length);
}

function setupPlotAssignment() {
  const modal = document.querySelector('[data-assign-plot-modal]');
  const form = document.querySelector('[data-assign-plot-form]');
  const open = () => {
    if (!modal) return;
    modal.hidden = false;
    document.body.classList.add('modal-open');
    document.getElementById('student')?.focus();
  };
  const close = () => {
    if (!modal) return;
    modal.hidden = true;
    document.body.classList.remove('modal-open');
  };

  document.querySelector('[data-open-assign-plot]')?.addEventListener('click', open);
  document.querySelector('[data-close-assign-plot]')?.addEventListener('click', close);
  modal?.addEventListener('click', (event) => {
    if (event.target === modal) close();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close();
  });
  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    close();
  });
}

function setupStudentModal() {
  const modal = document.querySelector('[data-student-modal]');
  const form = document.querySelector('[data-student-form]');
  const closeButton = modal?.querySelector('[data-close-student-modal]');
  const openButton = document.querySelector('[data-open-student-modal]');
  if (!modal || !form || !openButton || !closeButton) return;

  const close = () => {
    modal.hidden = true;
    document.body.classList.remove('modal-open');
    openButton.focus();
  };

  openButton.addEventListener('click', () => {
    modal.hidden = false;
    document.body.classList.add('modal-open');
    document.getElementById('new-student-name')?.focus();
  });
  closeButton.addEventListener('click', close);
  modal.addEventListener('click', (event) => {
    if (event.target === modal) close();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !modal.hidden) close();
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    close();
  });
}

function setupObservationLog() {
  const modal   = document.querySelector('[data-log-modal]');
  if (!modal) return;

  const closeBtn = modal.querySelector('[data-log-close]');
  const fields = {
    date:      modal.querySelector('[data-log-modal-date]'),
    title:     modal.querySelector('[data-log-modal-title]'),
    plot:      modal.querySelector('[data-log-modal-plot]'),
    plant:     modal.querySelector('[data-log-modal-plant]'),
    height:    modal.querySelector('[data-log-modal-height]'),
    weather:   modal.querySelector('[data-log-modal-weather]'),
    soil:      modal.querySelector('[data-log-modal-soil]'),
    condition: modal.querySelector('[data-log-modal-condition]'),
    notes:     modal.querySelector('[data-log-modal-notes]'),
  };

  const open = (data) => {
    fields.date.textContent      = data.date;
    fields.title.textContent     = data.title;
    fields.plot.textContent      = data.plot;
    fields.plant.textContent     = data.plant;
    fields.height.textContent    = data.height;
    fields.weather.textContent   = data.weather;
    fields.soil.textContent      = data.soil;
    fields.condition.textContent = data.condition;
    fields.notes.textContent     = data.notes;

    modal.hidden = false;
    document.body.classList.add('modal-open');
    closeBtn.focus();
  };

  const close = () => {
    modal.hidden = true;
    document.body.classList.remove('modal-open');
  };

  document.querySelectorAll('[data-log-open]').forEach((button) => {
    button.addEventListener('click', () => open(button.dataset));
  });

  closeBtn.addEventListener('click', close);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) close();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.hidden) close();
  });
}

function setupObservationSearch() {
  const searchInput = document.getElementById('observation-search');
  if (!searchInput) return;

  const rows      = [...document.querySelectorAll('.observation-row')];
  const emptyState = document.querySelector('[data-observation-empty]');
  const table      = searchInput.closest('.card')?.querySelector('table');

  searchInput.addEventListener('input', () => {
    const searchTerm = searchInput.value.trim().toLowerCase();
    let visibleCount = 0;

    rows.forEach((row) => {
      const matches = row.textContent.toLowerCase().includes(searchTerm);
      row.hidden = !matches;
      if (matches) visibleCount++;
    });

    // Show/hide the "no results" state
    if (emptyState) {
      emptyState.hidden = visibleCount > 0;
    }

    // Hide the table header row when no results are visible
    if (table) {
      table.hidden = visibleCount === 0;
    }
  });
}

function markActiveSidebarLink() {
  const current = location.pathname.split('/').pop();
  document.querySelectorAll('.admin-sidebar a').forEach((link) => {
    const href = link.getAttribute('href');
    if (href && href === current) link.classList.add('active');
  });
}
markActiveSidebarLink();

function setupCustomSelects() {
  document.querySelectorAll('[data-custom-select]').forEach((select) => {
    const trigger = select.querySelector('.custom-select-trigger');
    const label   = select.querySelector('.custom-select-label');
    const icon    = select.querySelector('.custom-select-icon');
    const hidden  = select.querySelector('input[type="hidden"]');
    const options = select.querySelectorAll('.custom-select-options li');

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = select.hasAttribute('data-open');

      // Close any other open custom selects first
      document
        .querySelectorAll('[data-custom-select][data-open]')
        .forEach((s) => {
          s.removeAttribute('data-open');
          s.querySelector('.custom-select-trigger')
            ?.setAttribute('aria-expanded', 'false');
        });

      if (!isOpen) {
        select.setAttribute('data-open', '');
        trigger.setAttribute('aria-expanded', 'true');
      }
    });

    options.forEach((opt) => {
      opt.addEventListener('click', () => {
        const value   = opt.dataset.value;
        const iconSrc = opt.querySelector('img')?.getAttribute('src') ?? '';

        label.textContent = opt.textContent.trim();
        icon.src = iconSrc;
        hidden.value = value;

        options.forEach((o) => o.classList.remove('is-selected'));
        opt.classList.add('is-selected');

        select.removeAttribute('data-open');
        trigger.setAttribute('aria-expanded', 'false');
        trigger.focus();
      });
    });

    select.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        select.removeAttribute('data-open');
        trigger.setAttribute('aria-expanded', 'false');
      }
    });
  });

  document.addEventListener('click', () => {
    document
      .querySelectorAll('[data-custom-select][data-open]')
      .forEach((s) => {
        s.removeAttribute('data-open');
        s.querySelector('.custom-select-trigger')
          ?.setAttribute('aria-expanded', 'false');
      });
  });
}

function setupTableSearch({ inputId, rowSelector, emptyStateSelector, cardSelector }) {
  const input = document.getElementById(inputId);
  if (!input) return;

  const rows       = [...document.querySelectorAll(rowSelector)];
  const emptyState = document.querySelector(emptyStateSelector);
  const card       = cardSelector ? document.querySelector(cardSelector) : null;
  const table      = card?.querySelector('table') ?? null;

  input.addEventListener('input', () => {
    const term = input.value.trim().toLowerCase();
    let visible = 0;

    rows.forEach((row) => {
      const match = row.textContent.toLowerCase().includes(term);
      row.hidden = !match;
      if (match) visible++;
    });

    if (emptyState) emptyState.hidden = visible > 0;
    if (table)      table.hidden      = visible === 0;
  });
}

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

setupTableSearch({
  inputId: 'student-search',
  rowSelector: '.student-row',
  emptyStateSelector: '[data-student-empty]',
  cardSelector: 'main .card',
});

setupTableSearch({
  inputId: 'plot-search',
  rowSelector: '.plot-row',
  emptyStateSelector: '[data-plot-empty]',
  cardSelector: 'main .card',
});

setupCustomSelects();

ensureDemoAccounts();
setupAuthentication();
setupDashboard();
setupPlotAssignment();
setupStudentModal();
setupObservationLog();
setupObservationSearch();
setupReportExport();
updateUserDisplay();
