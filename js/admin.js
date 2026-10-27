const plotCropsStorageKey = 'gardenTrackerPlotCrops';
const adminNotificationsStorageKey = 'gardenTrackerNotifications';
const adminCropOptions = ['Tomato', 'Radish', 'Carrot'];
const adminSampleCropByPlot = { 'A-01': 'Tomato', 'A-02': 'Carrot' };

function notifyStudentAccounts(studentNames, title, message) {
  try {
    const accounts = JSON.parse(localStorage.getItem('gardenTrackerAccounts') || '[]');
    if (!Array.isArray(accounts) || accounts.some((account) => (
      !account
      || typeof account.username !== 'string'
      || typeof account.fullName !== 'string'
      || typeof account.role !== 'string'
    ))) {
      throw new Error('Saved accounts have an invalid format.');
    }
    const usernames = new Set(studentNames.map((name) => name.trim().toLowerCase()));
    const recipients = accounts.filter((account) => (
      account.role === 'Student'
      && usernames.has(account.fullName.trim().toLowerCase())
    ));
    if (!recipients.length) return true;

    const stored = localStorage.getItem(adminNotificationsStorageKey);
    const notifications = stored === null ? [] : JSON.parse(stored);
    if (!Array.isArray(notifications) || notifications.some((notification) => (
      !notification
      || typeof notification.id !== 'string'
      || typeof notification.username !== 'string'
      || typeof notification.title !== 'string'
      || typeof notification.message !== 'string'
      || typeof notification.createdAt !== 'string'
      || typeof notification.read !== 'boolean'
    ))) {
      throw new Error('Saved notifications have an invalid format.');
    }
    const createdAt = new Date().toISOString();
    recipients.forEach((account) => notifications.unshift({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      username: account.username,
      title,
      message,
      createdAt,
      read: false,
    }));
    localStorage.setItem(adminNotificationsStorageKey, JSON.stringify(notifications));
    return true;
  } catch (error) {
    console.error('Could not send student notifications.', error);
    return false;
  }
}

function readAssignedPlotCrops() {
  const stored = localStorage.getItem(plotCropsStorageKey);
  if (stored === null) return {};

  const crops = JSON.parse(stored);
  if (
    !crops
    || Array.isArray(crops)
    || typeof crops !== 'object'
    || Object.values(crops).some((crop) => typeof crop !== 'string')
  ) {
    throw new Error('Saved plot crops have an invalid format.');
  }
  return crops;
}

function populateAssignPlotOptions() {
  const studentSelect = document.getElementById('student');
  const plotSelect = document.getElementById('plot');
  if (!studentSelect || !plotSelect) return;

  const originalPlotCandidates = ['A-13', 'A-14', 'B-06', 'B-07'];
  const students = readAdminRowsForAssignment(
    'gardenTrackerAdminRows:students',
    typeof demoStudentBaseRows !== 'undefined' ? demoStudentBaseRows : [],
    5
  );
  const plots = readAdminRowsForAssignment(
    'gardenTrackerAdminRows:plots',
    typeof demoPlotBaseRows !== 'undefined' ? demoPlotBaseRows : [],
    4
  );

  // ---- Students: any registered student not currently tied to an assigned plot
  const assignedPlotNames = new Set(
    plots
      .filter((row) => row[3].toLowerCase() === 'assigned' && row[2] !== '—')
      .map((row) => row[2].trim().toLowerCase())
  );
  const availableStudents = students
    .filter((row) => row[1] && row[1].trim() && row[1] !== '—')
    .filter((row) => !assignedPlotNames.has(row[1].trim().toLowerCase()))
    .sort((a, b) => a[1].localeCompare(b[1]));

  studentSelect.replaceChildren();
  const studentPlaceholder = document.createElement('option');
  studentPlaceholder.value = '';
  studentPlaceholder.disabled = true;
  studentPlaceholder.selected = true;
  studentPlaceholder.textContent = availableStudents.length
    ? 'Select Student'
    : 'No unassigned students';
  studentSelect.append(studentPlaceholder);

  availableStudents.forEach((row) => {
    const option = document.createElement('option');
    option.value = row[1];
    option.textContent = row[1];
    studentSelect.append(option);
  });
  studentSelect.disabled = availableStudents.length === 0;

  // ---- Plots: available plots from records + legacy new-plot candidates
  const recordPlotIds = new Set(plots.map((row) => row[0]));
  const availableFromRecords = plots
    .filter((row) => row[3].toLowerCase() !== 'assigned')
    .map((row) => row[0]);
  const newCandidates = originalPlotCandidates.filter(
    (plotId) => !recordPlotIds.has(plotId)
  );
  const availablePlots = Array.from(
    new Set([...availableFromRecords, ...newCandidates])
  ).sort((a, b) => a.localeCompare(b));

  plotSelect.replaceChildren();
  const plotPlaceholder = document.createElement('option');
  plotPlaceholder.value = '';
  plotPlaceholder.disabled = true;
  plotPlaceholder.selected = true;
  plotPlaceholder.textContent = availablePlots.length
    ? 'Select Available Plot'
    : 'No available plots';
  plotSelect.append(plotPlaceholder);

  availablePlots.forEach((plotId) => {
    const option = document.createElement('option');
    option.value = plotId;
    option.textContent = plotId;
    plotSelect.append(option);
  });
  plotSelect.disabled = availablePlots.length === 0;
}

function readAdminRowsForAssignment(storageKey, fallbackRows, recordLength) {
  try {
    const stored = localStorage.getItem(storageKey);
    if (stored !== null) {
      const rows = JSON.parse(stored);
      if (
        !Array.isArray(rows)
        || rows.some((row) =>
          !Array.isArray(row)
          || row.length !== recordLength
          || row.some((value) => typeof value !== 'string')
        )
      ) {
        throw new Error(`Saved ${storageKey} data has an invalid format.`);
      }
      return rows;
    }
  } catch (error) {
    console.error(`Could not read ${storageKey} for plot assignment.`, error);
  }
  return Array.isArray(fallbackRows)
    ? fallbackRows.map((row) => [...row])
    : [];
}

function setupPlotAssignment() {
  const modal = document.querySelector('[data-assign-plot-modal]');
  const form = document.querySelector('[data-assign-plot-form]');

  // Initial population so the modal is never empty
  populateAssignPlotOptions();

  const open = () => {
    if (!modal) return;
    populateAssignPlotOptions(); // refresh every time it opens
    modal.hidden = false;
    document.body.classList.add('modal-open');
    document.getElementById('student')?.focus();
  };
  const close = () => {
    if (!modal) return;
    modal.hidden = true;
    if (!document.querySelector('.modal-overlay:not([hidden])')) {
      document.body.classList.remove('modal-open');
    }
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
    const student = document.getElementById('student')?.value.trim();
    const plot = document.getElementById('plot')?.value.trim();
    const crop = document.getElementById('crop')?.value.trim();
    const feedback = form.querySelector('[data-assign-plot-status]');

    if (!student || !plot || !crop) {
      if (feedback) feedback.textContent = 'Select a student, available plot, and crop.';
      return;
    }

    document.dispatchEvent(new CustomEvent('admin:assign-plot', {
      detail: { student, plot, crop },
    }));
    if (feedback) feedback.textContent = '';
    form.reset();
    close();
  });
}

function setupAdminDashboard() {
  const studentCount = document.querySelector('[data-stat="students"]');
  const plotCount = document.querySelector('[data-stat="plots"]');
  const observationCount = document.querySelector('[data-stat="observations"]');
  const activityList = document.querySelector('[data-admin-recent-activity]');
  const activityEmpty = document.querySelector('[data-admin-activity-empty]');
  const status = document.querySelector('[data-admin-dashboard-status]');
  if (!studentCount || !plotCount || !observationCount || !activityList || !activityEmpty) return;

  const readArray = (key, isValidRecord) => {
    const stored = localStorage.getItem(key);
    if (stored === null) return null;
    const records = JSON.parse(stored);
    if (!Array.isArray(records) || records.some((record) => !isValidRecord(record))) {
      throw new Error(`Saved ${key} data has an invalid format.`);
    }
    return records;
  };

  try {
    const isStringRecord = (length) => (record) => (
      Array.isArray(record)
      && record.length === length
      && record.every((value) => typeof value === 'string')
    );
    const students = readArray('gardenTrackerAdminRows:students', isStringRecord(5))
      || (typeof demoStudentBaseRows !== 'undefined' ? demoStudentBaseRows : []);
    const plots = readArray('gardenTrackerAdminRows:plots', isStringRecord(4))
      || (typeof demoPlotBaseRows !== 'undefined' ? demoPlotBaseRows : []);
    const adminObservations = readArray('gardenTrackerAdminRows:observations', isStringRecord(5));
    const growthObservations = readArray(
      'gardenTrackerGrowthObservations',
      (observation) => (
        Boolean(observation)
        && typeof observation.id === 'string'
        && typeof observation.plot === 'string'
        && typeof observation.student === 'string'
        && typeof observation.date === 'string'
        && (observation.height === null || (
          typeof observation.height === 'number'
          && Number.isFinite(observation.height)
          && observation.height >= 0
        ))
        && typeof observation.weather === 'string'
        && typeof observation.soil === 'string'
        && typeof observation.condition === 'string'
        && typeof observation.notes === 'string'
        && typeof observation.submittedAt === 'string'
        && !Number.isNaN(new Date(observation.submittedAt).getTime())
      )
    );
    const history = readAdminArchive().map(normalizeAdminHistoryEntry);

    studentCount.textContent = String(students.length);
    plotCount.textContent = String(
      plots.filter((plot) => plot[3].toLowerCase() === 'assigned').length
    );
    observationCount.textContent = String(
      (growthObservations || adminObservations || []).length
    );

    const activities = [
      ...history.map((entry) => ({
        date: entry.createdAt || entry.deletedAt,
        category: entry.action === 'assign' ? 'Assignment' : 'Admin action',
        title: `${entry.action} ${entry.entity}`,
        detail: entry.action === 'assign'
          ? 'A plot assignment was changed.'
          : `An admin ${entry.entity} record was ${entry.action}d.`,
      })),
      ...(growthObservations || []).map((observation) => ({
        date: observation.submittedAt,
        category: 'Observation',
        title: `${observation.student} submitted an observation for Plot ${observation.plot}`,
        detail: observation.notes || `Plant condition: ${observation.condition}`,
      })),
    ].filter((activity) => (
      typeof activity.date === 'string'
      && !Number.isNaN(new Date(activity.date).getTime())
    )).sort((first, second) => new Date(second.date) - new Date(first.date)).slice(0, 5);

    activityList.replaceChildren();
    activities.forEach((activity) => {
      const item = document.createElement('article');
      item.className = 'observation-item';
      const meta = document.createElement('div');
      meta.className = 'observation-meta';
      const date = document.createElement('time');
      date.dateTime = activity.date;
      date.textContent = new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(activity.date));
      const category = document.createElement('span');
      category.className = 'badge badge-info';
      category.textContent = activity.category;
      meta.append(date, category);

      const title = document.createElement('h3');
      title.textContent = activity.title;
      const detail = document.createElement('p');
      detail.textContent = activity.detail;
      item.append(meta, title, detail);
      activityList.append(item);
    });
    activityEmpty.hidden = activities.length > 0;
    if (status) status.textContent = '';
  } catch (error) {
    console.error('Could not load admin dashboard data.', error);
    if (status) status.textContent = 'Some dashboard data could not be loaded.';
  }
}

const adminArchiveStorageKey = 'gardenTrackerAdminArchive';
const adminArchiveRecordConfigs = {
  students: {
    entity: 'student',
    storageKey: 'gardenTrackerAdminRows:students',
    recordLength: 5,
    identityField: 0,
  },
  plots: {
    entity: 'plot',
    storageKey: 'gardenTrackerAdminRows:plots',
    recordLength: 4,
    identityField: 0,
  },
  observations: {
    entity: 'observation',
    storageKey: 'gardenTrackerAdminRows:observations',
    recordLength: 5,
    identityField: null,
  },
};

function readAdminArchive() {
  const stored = localStorage.getItem(adminArchiveStorageKey);
  if (stored === null) return [];

  const archive = JSON.parse(stored);
  if (
    !Array.isArray(archive)
    || archive.some((entry) => {
      if (
        !entry
        || typeof entry.id !== 'string'
        || !Object.prototype.hasOwnProperty.call(adminArchiveRecordConfigs, entry.key)
        || entry.entity !== adminArchiveRecordConfigs[entry.key].entity
        || !Number.isInteger(entry.index)
        || entry.index < 0
      ) return true;

      const validRecord = (record) => (
        record === null
        || (
          Array.isArray(record)
          && record.length === adminArchiveRecordConfigs[entry.key].recordLength
          && record.every((value) => typeof value === 'string')
        )
      );

      if (entry.action === undefined) {
        return !Array.isArray(entry.record)
          || !validRecord(entry.record)
          || typeof entry.deletedAt !== 'string';
      }

      return !['create', 'update', 'delete', 'assign', 'teacher-note'].includes(entry.action)
        || !validRecord(entry.beforeRecord)
        || !validRecord(entry.afterRecord)
        || (entry.action === 'create' && (entry.beforeRecord !== null || entry.afterRecord === null))
        || (entry.action === 'delete' && (entry.beforeRecord === null || entry.afterRecord !== null))
        || (entry.action === 'update'
          && (entry.beforeRecord === null || entry.afterRecord === null))
        || (entry.action === 'assign'
          && (entry.beforeRecord === null || entry.afterRecord === null))
        || typeof entry.createdAt !== 'string'
        || (
          entry.beforeTeacherNotes !== undefined
          && !(
            entry.beforeTeacherNotes === null
            || (
              Array.isArray(entry.beforeTeacherNotes)
              && entry.beforeTeacherNotes.every((note) => (
                note
                && typeof note.plotId === 'string'
                && typeof note.student === 'string'
                && typeof note.text === 'string'
                && typeof note.author === 'string'
                && typeof note.updatedAt === 'string'
              ))
            )
          )
        )
        || (
          entry.afterTeacherNotes !== undefined
          && !(
            entry.afterTeacherNotes === null
            || (
              Array.isArray(entry.afterTeacherNotes)
              && entry.afterTeacherNotes.every((note) => (
                note
                && typeof note.plotId === 'string'
                && typeof note.student === 'string'
                && typeof note.text === 'string'
                && typeof note.author === 'string'
                && typeof note.updatedAt === 'string'
              ))
            )
          )
        )
        || (
          entry.cropAssignment !== undefined
          && (
            !entry.cropAssignment
            || typeof entry.cropAssignment.plotId !== 'string'
            || !(entry.cropAssignment.beforeCrop === null
              || typeof entry.cropAssignment.beforeCrop === 'string')
            || !(entry.cropAssignment.afterCrop === null
              || typeof entry.cropAssignment.afterCrop === 'string')
          )
        );
    })
  ) {
    throw new Error('Saved admin action history has an invalid format.');
  }
  return archive;
}

function normalizeAdminHistoryEntry(entry) {
  if (entry.action) return entry;
  return {
    id: entry.id,
    key: entry.key,
    entity: entry.entity,
    action: 'delete',
    beforeRecord: entry.record,
    afterRecord: null,
    index: entry.index,
    createdAt: entry.deletedAt,
  };
}

function describeAdminHistoryAction(entry) {
  const before = entry.beforeRecord || [];
  const after = entry.afterRecord || [];
  const entityName = entry.entity[0].toUpperCase() + entry.entity.slice(1);
  const recordFields = {
    student: ['ID', 'name', 'grade and section', 'garden plot', 'status'],
    plot: ['plot', 'location', 'assigned student', 'status'],
    observation: ['date', 'student', 'plot', 'condition', 'observation'],
  }[entry.entity];
  const subject = (record) => {
    if (entry.entity === 'student') return `${record[1]} (${record[0]})`;
    if (entry.entity === 'plot') return `Plot ${record[0]}`;
    if (entry.entity === 'observation') return `the observation by ${record[1]} for Plot ${record[2]}`;
    return `the ${entry.entity}`;
  };

  if (entry.action === 'create') {
    const createdSubject = entry.entity === 'student'
      ? `student ${subject(after)}`
      : subject(after);
    return `Added ${createdSubject}.`;
  }
  if (entry.action === 'delete') {
    const removedSubject = entry.entity === 'student'
      ? `student ${subject(before)}`
      : subject(before);
    return `Removed ${removedSubject}.`;
  }
  if (entry.action === 'assign') {
    const previousStudent = before[2];
    const nextStudent = after[2];
    return previousStudent && previousStudent !== '—' && previousStudent !== nextStudent
      ? `Reassigned Plot ${after[0]} from ${previousStudent} to ${nextStudent}.`
      : `Assigned Plot ${after[0]} to ${nextStudent}.`;
  }
  if (entry.action === 'teacher-note') {
    const previousNotes = entry.beforeTeacherNotes || [];
    const nextNotes = entry.afterTeacherNotes || [];
    const previousNote = previousNotes.find((note) => note.plotId === after[0]);
    const nextNote = nextNotes.find((note) => note.plotId === after[0]);
    const change = !previousNote && nextNote
      ? 'added'
      : previousNote && !nextNote
        ? 'removed'
        : 'updated';
    return `${change[0].toUpperCase()}${change.slice(1)} a teacher note for Plot ${after[0]}.`;
  }
  if (entry.action === 'update') {
    const changes = after.reduce((items, value, index) => {
      if (before[index] !== value && recordFields[index] !== 'ID') {
        items.push(`${recordFields[index]}: ${before[index] || '—'} → ${value || '—'}`);
      }
      return items;
    }, []);
    if (entry.cropAssignment && entry.cropAssignment.beforeCrop !== entry.cropAssignment.afterCrop) {
      changes.push(
        `crop: ${entry.cropAssignment.beforeCrop || 'none'} → ${entry.cropAssignment.afterCrop || 'none'}`
      );
    }
    return changes.length
      ? `Updated ${subject(after)} — ${changes.join('; ')}.`
      : `Updated ${entityName.toLowerCase()} ${subject(after)}.`;
  }
  return `${entityName} action recorded.`;
}

function appendAdminHistory(entry) {
  try {
    const history = readAdminArchive();
    history.push(entry);
    localStorage.setItem(adminArchiveStorageKey, JSON.stringify(history));
    return true;
  } catch (error) {
    console.error('Could not save the admin action history.', error);
    return false;
  }
}

function removeAdminHistoryEntry(id) {
  const history = readAdminArchive();
  localStorage.setItem(
    adminArchiveStorageKey,
    JSON.stringify(history.filter((entry) => entry.id !== id))
  );
}

function showAdminConfirmation({
  title,
  message,
  confirmLabel,
  confirmClass = 'btn btn-danger',
  trigger,
  onConfirm,
}) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <section class="modal-card admin-confirmation-modal" role="dialog" aria-modal="true" aria-labelledby="admin-confirmation-title" aria-describedby="admin-confirmation-message">
      <div class="modal-header">
        <h2 id="admin-confirmation-title"></h2>
      </div>
      <p id="admin-confirmation-message"></p>
      <div class="admin-confirmation-actions">
        <button class="btn btn-secondary" type="button" data-cancel-confirmation>Cancel</button>
        <button class="btn btn-danger" type="button" data-accept-confirmation></button>
      </div>
    </section>
  `;
  overlay.querySelector('#admin-confirmation-title').textContent = title;
  overlay.querySelector('#admin-confirmation-message').textContent = message;
  const cancelButton = overlay.querySelector('[data-cancel-confirmation]');
  const confirmButton = overlay.querySelector('[data-accept-confirmation]');
  confirmButton.className = confirmClass;
  confirmButton.textContent = confirmLabel;
  document.body.append(overlay);
  document.body.classList.add('modal-open');

  const close = () => {
    overlay.remove();
    if (!document.querySelector('.modal-overlay:not([hidden])')) {
      document.body.classList.remove('modal-open');
    }
    document.removeEventListener('keydown', onKeyDown);
    trigger?.focus();
  };
  const onKeyDown = (event) => {
    if (event.key === 'Escape') {
      close();
    } else if (event.key === 'Tab') {
      const focusables = [cancelButton, confirmButton];
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  };
  cancelButton.addEventListener('click', close);
  confirmButton.addEventListener('click', () => {
    close();
    onConfirm();
  });
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) close();
  });
  document.addEventListener('keydown', onKeyDown);
  cancelButton.focus();
}

function showAdminSuccess({ message, trigger }) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <section class="modal-card admin-confirmation-modal" role="dialog" aria-modal="true" aria-labelledby="admin-success-title" aria-describedby="admin-success-message">
      <div class="modal-header">
        <h2 id="admin-success-title">Changes applied successfully</h2>
      </div>
      <p id="admin-success-message"></p>
      <div class="admin-confirmation-actions">
        <button class="btn btn-primary" type="button" data-close-success>Done</button>
      </div>
    </section>
  `;
  overlay.querySelector('#admin-success-message').textContent = message;
  const doneButton = overlay.querySelector('[data-close-success]');
  document.body.append(overlay);
  document.body.classList.add('modal-open');

  const close = () => {
    overlay.remove();
    if (!document.querySelector('.modal-overlay:not([hidden])')) {
      document.body.classList.remove('modal-open');
    }
    document.removeEventListener('keydown', onKeyDown);
    if (trigger?.isConnected) trigger.focus();
  };
  const onKeyDown = (event) => {
    if (event.key === 'Escape') close();
    if (event.key === 'Tab') {
      event.preventDefault();
      doneButton.focus();
    }
  };
  doneButton.addEventListener('click', close);
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) close();
  });
  document.addEventListener('keydown', onKeyDown);
  doneButton.focus();
}

function setupAdminTableActions() {
  const table = document.querySelector('main .table-container table');
  const tbody = table?.tBodies[0];
  if (!table || !tbody) return;

  const page = location.pathname.split('/').pop();
  const configs = {
    'manage_students.html': {
      rowClass: 'student-row',
      entity: 'student',
      key: 'students',
      searchId: 'student-search',
      labelIndex: 1,
    },
    'manage_plots.html': {
      rowClass: 'plot-row',
      entity: 'plot',
      key: 'plots',
      searchId: 'plot-search',
      labelIndex: 0,
    },
    'student_observations.html': {
      rowClass: 'observation-row',
      entity: 'observation',
      key: 'observations',
      searchId: 'observation-search',
      labelIndex: 1,
    },
  };
  const config = configs[page];
  if (!config) return;
  const pluralEntity = config.entity === 'observation'
    ? 'observations'
    : `${config.entity}s`;

  table.classList.add('selectable-table');
  let selectAllCheckbox = table.querySelector('[data-select-all-rows]');
  if (!selectAllCheckbox) {
    const selectionHeader = document.createElement('th');
    selectionHeader.className = 'row-select-cell';
    selectAllCheckbox = document.createElement('input');
    selectAllCheckbox.type = 'checkbox';
    selectAllCheckbox.setAttribute('aria-label', `Select all ${pluralEntity} on this page`);
    selectAllCheckbox.dataset.selectAllRows = '';
    selectionHeader.append(selectAllCheckbox);
    table.tHead.rows[0].prepend(selectionHeader);
  }
  Array.from(tbody.querySelectorAll(`tr.${config.rowClass}`)).forEach((row) => {
    if (row.querySelector('[data-row-selection]')) return;
    const selectionCell = document.createElement('td');
    selectionCell.className = 'row-select-cell';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    const label = row.cells[config.labelIndex + 1]?.textContent.trim();
    checkbox.setAttribute('aria-label', `Select ${config.entity} ${label}`);
    checkbox.dataset.rowSelection = '';
    selectionCell.append(checkbox);
    row.prepend(selectionCell);
  });

  const dataCellOffset = 1;
  const headings = Array.from(table.tHead.rows[0].cells)
    .slice(dataCellOffset)
    .slice(0, config.key === 'observations' ? -2 : -1)
    .map((cell) => cell.textContent.trim());
  const storageKey = `gardenTrackerAdminRows:${config.key}`;
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.className = 'admin-action-status';
  table.parentElement.insertBefore(status, table);

  const showStatus = (message) => {
    status.textContent = message;
  };
  const observationPhotos = new Map();
  let photoLoadError = false;
  if (config.key === 'observations') {
    try {
      const storedAccounts = localStorage.getItem('gardenTrackerAccounts');
      const accounts = storedAccounts === null ? [] : JSON.parse(storedAccounts);
      if (!Array.isArray(accounts) || accounts.some((account) => (
        !account
        || typeof account.username !== 'string'
        || typeof account.fullName !== 'string'
        || typeof account.role !== 'string'
      ))) {
        throw new Error('Saved student accounts have an invalid format.');
      }

      accounts.filter((account) => account.role === 'Student').forEach((account) => {
        try {
          const savedPhoto = localStorage.getItem(`gardenTrackerPlotPhoto:${account.username}`);
          if (savedPhoto === null) return;

          const photoData = JSON.parse(savedPhoto);
          if (
            typeof photoData.photo !== 'string'
            || !photoData.photo.startsWith('data:image/')
            || typeof photoData.observationDate !== 'string'
            || Number.isNaN(new Date(`${photoData.observationDate}T00:00:00`).getTime())
          ) {
            throw new Error(`Saved plot photo for ${account.fullName} has an invalid format.`);
          }
          observationPhotos.set(account.fullName.trim().toLowerCase(), photoData.photo);
        } catch (error) {
          console.error(`Could not load the plot photo for ${account.fullName}.`, error);
          photoLoadError = true;
        }
      });
    } catch (error) {
      console.error('Could not load student plot photos for admin observations.', error);
      photoLoadError = true;
    }
  }
  const initialRows = Array.from(tbody.querySelectorAll(`tr.${config.rowClass}`));
  let records = initialRows.map((row) =>
    Array.from(row.cells)
      .slice(dataCellOffset, config.key === 'observations' ? -2 : -1)
      .map((cell) => cell.textContent.trim())
  );

  try {
    const saved = localStorage.getItem(storageKey);
    if (saved !== null) {
      const parsed = JSON.parse(saved);
      if (
        !Array.isArray(parsed)
        || parsed.some((record) =>
          !Array.isArray(record)
          || record.length !== headings.length
          || record.some((value) => typeof value !== 'string')
        )
      ) {
        throw new Error(`Saved ${config.entity} records have an invalid format.`);
      }
      records = parsed;
    }
  } catch (error) {
    console.error(`Could not load saved ${config.entity} records.`, error);
    showStatus(`Could not load saved ${config.entity} records. Existing page data is shown.`);
  }

  const saveRecords = (updatedRecords) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(updatedRecords));
      records = updatedRecords;
      return true;
    } catch (error) {
      console.error(`Could not save ${config.entity} records.`, error);
      showStatus(`Unable to save ${config.entity} changes. Please try again.`);
      return false;
    }
  };

  const selectedIndices = new Set();
  let selectionBar;
  let selectionCount;
  let bulkDeleteButton;
  selectionBar = document.createElement('div');
  selectionBar.className = 'bulk-selection-bar';
  selectionBar.hidden = true;
  selectionBar.setAttribute('aria-live', 'polite');
  selectionCount = document.createElement('span');
  bulkDeleteButton = document.createElement('button');
  bulkDeleteButton.type = 'button';
  bulkDeleteButton.className = 'btn btn-danger';
  bulkDeleteButton.textContent = 'Delete';
  bulkDeleteButton.dataset.bulkDeleteRows = '';
  const cancelSelectionButton = document.createElement('button');
  cancelSelectionButton.type = 'button';
  cancelSelectionButton.className = 'btn btn-secondary';
  cancelSelectionButton.textContent = 'Cancel';
  cancelSelectionButton.dataset.cancelRowSelection = '';
  selectionBar.append(selectionCount, bulkDeleteButton, cancelSelectionButton);
  table.parentElement.insertBefore(selectionBar, table);

  const updateSelectionControls = () => {
    const selectedCount = selectedIndices.size;
    selectionBar.hidden = selectedCount < 2;
    selectionCount.textContent = `${selectedCount} ${selectedCount === 1 ? config.entity : pluralEntity} selected`;

    const visibleRows = Array.from(tbody.querySelectorAll(`tr.${config.rowClass}`))
      .filter((row) => !row.hidden);
    const visibleSelectedCount = visibleRows.filter((row) =>
      selectedIndices.has(Number(row.dataset.recordIndex))
    ).length;
    selectAllCheckbox.checked = visibleRows.length > 0
      && visibleSelectedCount === visibleRows.length;
    selectAllCheckbox.indeterminate = visibleSelectedCount > 0
      && visibleSelectedCount < visibleRows.length;
  };

  const makeActionButton = (action, label, icon, record, danger = false) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = danger ? 'icon-action icon-action-danger' : 'icon-action';
    button.dataset.rowAction = action;
    button.setAttribute(
      'aria-label',
      `${label} ${config.entity}: ${record[config.labelIndex]}`
    );
    button.title = label;

    const image = document.createElement('img');
    image.src = `../images/${icon}.svg`;
    image.alt = '';
    button.append(image);
    return button;
  };

  const render = () => {
    tbody.replaceChildren();
    records.forEach((record, index) => {
      const row = document.createElement('tr');
      row.className = config.rowClass;
      row.dataset.recordIndex = String(index);
      const selectionCell = document.createElement('td');
      selectionCell.className = 'row-select-cell';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = selectedIndices.has(index);
      checkbox.setAttribute('aria-label', `Select ${config.entity} ${record[config.labelIndex]}`);
      checkbox.dataset.rowSelection = '';
      selectionCell.append(checkbox);
      row.append(selectionCell);
      record.forEach((value) => {
        const cell = document.createElement('td');
        cell.textContent = value;
        row.append(cell);
      });

      if (config.key === 'observations') {
        const photoCell = document.createElement('td');
        photoCell.className = 'observation-photo-cell';
        const photo = observationPhotos.get(record[1].trim().toLowerCase());
        if (photo) {
          const image = document.createElement('img');
          image.src = photo;
          image.alt = `Plot photo of ${record[1]}`;
          image.loading = 'lazy';
          photoCell.append(image);
        } else {
          photoCell.textContent = 'No photo';
        }
        row.append(photoCell);
      }

      const actionsCell = document.createElement('td');
      const actions = document.createElement('div');
      actions.className = 'table-actions';
      actions.append(
        makeActionButton('view', 'View', 'view', record),
        makeActionButton('edit', 'Edit', 'edit', record),
        makeActionButton('delete', 'Delete', 'delete', record, true)
      );
      actionsCell.append(actions);
      row.append(actionsCell);
      tbody.append(row);
    });
    const emptyState = document.querySelector(
      `[data-${config.key === 'observations' ? 'observation' : config.key.slice(0, -1)}-empty]`
    );
    if (emptyState) emptyState.hidden = records.length > 0;
    const search = document.getElementById(config.searchId);
    if (search) search.dispatchEvent(new Event('input', { bubbles: true }));
    tbody.dispatchEvent(new Event('tabledatachange'));
    updateSelectionControls();
  };

  const openRecordDialog = (action, index, trigger) => {
    const record = records[index];
    if (!record) return;

    if (action === 'delete') {
      showAdminConfirmation({
        title: `Delete ${config.entity}?`,
        message: `This ${config.entity} will be moved to the archive, where you can undo this action.`,
        confirmLabel: 'Move to archive',
        trigger,
        onConfirm: () => {
          const historyEntry = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            key: config.key,
            entity: config.entity,
            action: 'delete',
            beforeRecord: [...record],
            afterRecord: null,
            index,
            createdAt: new Date().toISOString(),
          };
          if (!appendAdminHistory(historyEntry)) {
            showStatus('Could not save the delete action to history. No changes were made.');
            return;
          }

          const updated = records.filter((_, recordIndex) => recordIndex !== index);
          if (saveRecords(updated)) {
            selectedIndices.clear();
            render();
            const studentName = config.key === 'plots' ? record[2] : record[1];
            const notificationSent = config.key === 'plots' || config.key === 'students'
              ? notifyStudentAccounts(
                [studentName],
                config.key === 'plots' ? `Plot ${record[0]} updated` : 'Your student record was updated',
                config.key === 'plots'
                  ? `Your teacher moved Plot ${record[0]} to the archive.`
                  : 'Your teacher moved your student record to the archive.'
              )
              : true;
            showStatus(notificationSent
              ? `${config.entity[0].toUpperCase()}${config.entity.slice(1)} moved to the archive.`
              : `${config.entity[0].toUpperCase()}${config.entity.slice(1)} moved to the archive, but the student notification could not be sent.`);
            showAdminSuccess({ message: status.textContent });
            return;
          }

          try {
            removeAdminHistoryEntry(historyEntry.id);
          } catch (error) {
            console.error(`Could not roll back the ${config.entity} delete action.`, error);
            showStatus(`Could not remove the failed ${config.entity} delete from history.`);
          }
        },
      });
      return;
    }

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    const dialog = document.createElement('section');
    dialog.className = config.key === 'plots' && action === 'edit'
      ? 'modal-card admin-record-dialog'
      : 'modal-card';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'admin-record-dialog-title');

    const header = document.createElement('div');
    header.className = 'modal-header';
    const title = document.createElement('h2');
    title.id = 'admin-record-dialog-title';
    title.textContent = `${action === 'view' ? 'View' : 'Edit'} ${config.entity}`;
    const closeButton = document.createElement('button');
    closeButton.className = 'modal-close';
    closeButton.type = 'button';
    closeButton.setAttribute('aria-label', 'Close dialog');
    closeButton.textContent = '×';
    header.append(title, closeButton);
    dialog.append(header);

    let onKeyDown;
    const close = () => {
      overlay.remove();
      document.body.classList.remove('modal-open');
      if (onKeyDown) document.removeEventListener('keydown', onKeyDown);
      trigger.focus();
    };
    closeButton.addEventListener('click', close);
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) close();
    });
    onKeyDown = (event) => {
      if (event.key === 'Escape' && overlay.isConnected) {
        close();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    overlay.append(dialog);

    if (action === 'view') {
      const details = document.createElement('dl');
      details.className = 'admin-profile-details';
      headings.forEach((heading, fieldIndex) => {
        const entry = document.createElement('div');
        const label = document.createElement('dt');
        label.textContent = heading;
        const value = document.createElement('dd');
        value.textContent = record[fieldIndex];
        entry.append(label, value);
        details.append(entry);
      });
      if (config.key === 'observations') {
        const photoEntry = document.createElement('div');
        const photoLabel = document.createElement('dt');
        photoLabel.textContent = 'Plot photo';
        const photoValue = document.createElement('dd');
        const photo = observationPhotos.get(record[1].trim().toLowerCase());
        if (photo) {
          const image = document.createElement('img');
          image.className = 'admin-observation-photo';
          image.src = photo;
          image.alt = `Plot photo of ${record[1]}`;
          photoValue.append(image);
        } else {
          photoValue.textContent = 'No plot photo available.';
        }
        photoEntry.append(photoLabel, photoValue);
        details.append(photoEntry);
      }
      if (config.key === 'plots' || config.key === 'students') {
        const cropEntry = document.createElement('div');
        const cropLabel = document.createElement('dt');
        cropLabel.textContent = 'Primary crop';
        const cropValue = document.createElement('dd');
        try {
          let plotId = config.key === 'plots' ? record[0] : null;
          if (config.key === 'students') {
            const storedPlots = localStorage.getItem('gardenTrackerAdminRows:plots');
            const savedPlots = storedPlots === null ? null : JSON.parse(storedPlots);
            if (
              savedPlots !== null
              && (
                !Array.isArray(savedPlots)
                || savedPlots.some((entry) => (
                  !Array.isArray(entry)
                  || entry.length !== 4
                  || entry.some((value) => typeof value !== 'string')
                ))
              )
            ) {
              throw new Error('Saved plot records have an invalid format.');
            }
            const plot = savedPlots?.find((entry) => (
              entry[3].toLowerCase() === 'assigned'
              && entry[2].trim().toLowerCase() === record[1].trim().toLowerCase()
            ));
            plotId = plot?.[0] || (
              !savedPlots?.length && record[3] !== '—' ? record[3] : null
            );
          }
          const crops = readAssignedPlotCrops();
          const crop = plotId
            ? crops[plotId] || adminSampleCropByPlot[plotId]
            : null;
          cropValue.textContent = adminCropOptions.includes(crop)
            ? crop
            : 'No crop assigned';
        } catch (error) {
          console.error('Could not load the crop for this admin record.', error);
          cropValue.textContent = 'Crop unavailable';
        }
        cropEntry.append(cropLabel, cropValue);
        details.append(cropEntry);
      }
      dialog.append(details);
    } else {
      const form = document.createElement('form');
      form.className = 'admin-record-form';
      const plotStudentOptions = config.key === 'plots'
        ? (() => {
            const fallbackNames = ['Felix Cagampang', 'Maria Santos', 'Ana Reyes', 'Pedro Garcia'];
            try {
              const savedStudents = JSON.parse(localStorage.getItem('gardenTrackerAdminRows:students') || '[]');
              if (Array.isArray(savedStudents) && savedStudents.length > 0) {
                return Array.from(new Set(savedStudents
                  .map((student) => (Array.isArray(student) ? student[1] : ''))
                  .filter((student) => typeof student === 'string' && student.trim())));
              }
            } catch (error) {
              console.warn('Could not load saved student names for plot assignment.', error);
            }
            return fallbackNames;
          })()
        : [];
      let cropPlotField = null;

      headings.forEach((heading, fieldIndex) => {
        const group = document.createElement('div');
        group.className = 'form-group';
        const id = `admin-record-field-${fieldIndex}`;
        const label = document.createElement('label');
        label.htmlFor = id;
        label.textContent = heading;

        let field;
        const headingText = heading.toLowerCase();
        const isAssignedStudentField = config.key === 'plots' && headingText === 'assigned student';
        const isStatusField = (config.key === 'plots' && headingText === 'status')
          || (config.key === 'students' && headingText === 'status');
        const isGardenPlotField = config.key === 'students' && headingText === 'garden plot';

        if (isAssignedStudentField) {
          field = document.createElement('select');
          field.id = id;
          field.name = `field-${fieldIndex}`;
          field.required = true;

          const emptyOption = document.createElement('option');
          emptyOption.value = '—';
          emptyOption.textContent = '—';
          emptyOption.selected = record[fieldIndex] === '—';
          field.append(emptyOption);

          plotStudentOptions.forEach((studentName) => {
            const option = document.createElement('option');
            option.value = studentName;
            option.textContent = studentName;
            option.selected = record[fieldIndex] === studentName;
            field.append(option);
          });

          if (record[fieldIndex] && record[fieldIndex] !== '—' && !plotStudentOptions.includes(record[fieldIndex])) {
            const currentOption = document.createElement('option');
            currentOption.value = record[fieldIndex];
            currentOption.textContent = record[fieldIndex];
            currentOption.selected = true;
            field.append(currentOption);
          }
        } else if (isGardenPlotField) {
          const plotOptions = (() => {
            try {
              const savedPlots = JSON.parse(localStorage.getItem('gardenTrackerAdminRows:plots') || '[]');
              if (Array.isArray(savedPlots) && savedPlots.length > 0) {
                return Array.from(new Set(savedPlots
                  .map((plot) => (Array.isArray(plot) ? plot[0] : ''))
                  .filter((plotId) => typeof plotId === 'string' && plotId.trim())));
              }
            } catch (error) {
              console.warn('Could not load plot IDs for student assignment.', error);
            }
            return ['A-01', 'A-02', 'A-03', 'A-04', 'A-05'];
          })();

          field = document.createElement('select');
          field.id = id;
          field.name = `field-${fieldIndex}`;
          field.required = true;
          cropPlotField = field;

          const emptyOption = document.createElement('option');
          emptyOption.value = '—';
          emptyOption.textContent = '—';
          emptyOption.selected = record[fieldIndex] === '—';
          field.append(emptyOption);

          plotOptions.forEach((plotId) => {
            const option = document.createElement('option');
            option.value = plotId;
            option.textContent = plotId;
            option.selected = record[fieldIndex] === plotId;
            field.append(option);
          });

          if (record[fieldIndex] && record[fieldIndex] !== '—' && !plotOptions.includes(record[fieldIndex])) {
            const currentOption = document.createElement('option');
            currentOption.value = record[fieldIndex];
            currentOption.textContent = record[fieldIndex];
            currentOption.selected = true;
            field.append(currentOption);
          }
        } else if (isStatusField) {
          field = document.createElement('select');
          field.id = id;
          field.name = `field-${fieldIndex}`;
          field.required = true;

          const statusValues = config.key === 'students' ? ['Active', 'Unassigned'] : ['Available', 'Assigned'];
          statusValues.forEach((statusValue) => {
            const option = document.createElement('option');
            option.value = statusValue;
            option.textContent = statusValue;
            option.selected = record[fieldIndex] === statusValue;
            field.append(option);
          });
        } else {
          field = document.createElement(
            config.entity === 'observation' && headingText === 'observation'
              ? 'textarea'
              : 'input'
          );
          field.id = id;
          field.name = `field-${fieldIndex}`;
          field.value = record[fieldIndex];
          field.required = true;
        }

        group.append(label, field);
        form.append(group);
      });

      const dialogStatus = document.createElement('p');
      dialogStatus.className = 'admin-action-status';
      dialogStatus.setAttribute('role', 'status');
      dialogStatus.setAttribute('aria-live', 'polite');
      let cropField = null;
      if (config.key === 'plots' || config.key === 'students') {
        const cropGroup = document.createElement('div');
        cropGroup.className = 'form-group';
        const cropLabel = document.createElement('label');
        cropLabel.htmlFor = 'admin-record-crop';
        cropLabel.textContent = 'Crop';
        cropField = document.createElement('select');
        cropField.id = 'admin-record-crop';
        cropField.name = 'crop';
        const noCropOption = document.createElement('option');
        noCropOption.value = '';
        noCropOption.textContent = 'Select crop';
        cropField.append(noCropOption);
        adminCropOptions.forEach((crop) => {
          const option = document.createElement('option');
          option.value = crop;
          option.textContent = crop;
          cropField.append(option);
        });
        cropGroup.append(cropLabel, cropField);
        form.append(cropGroup);

        const updateCropField = () => {
          const plotId = config.key === 'plots'
            ? record[0]
            : cropPlotField?.value;
          cropField.disabled = !plotId || plotId === '—';
          cropField.value = '';
          if (cropField.disabled) return;
          try {
            const assignedCrops = readAssignedPlotCrops();
            const crop = assignedCrops[plotId] || adminSampleCropByPlot[plotId];
            if (adminCropOptions.includes(crop)) {
              cropField.value = crop;
            }
          } catch (error) {
            console.error('Could not load crop assignments for record editing.', error);
            dialogStatus.textContent = 'Could not load crop assignments. Crop changes are unavailable.';
            cropField.disabled = true;
          }
        };
        updateCropField();
        cropPlotField?.addEventListener('change', updateCropField);
      }

      const teacherNoteInput = config.key === 'plots'
        ? document.createElement('textarea')
        : null;
      if (teacherNoteInput) {
        teacherNoteInput.id = 'admin-record-teacher-note';
        teacherNoteInput.name = 'teacher-note';
        teacherNoteInput.maxLength = 1000;
        const noteField = document.createElement('div');
        noteField.className = 'form-group teacher-note-field';
        const noteLabel = document.createElement('label');
        noteLabel.htmlFor = teacherNoteInput.id;
        noteLabel.textContent = 'Teacher note for the assigned student';
        noteField.append(noteLabel, teacherNoteInput);
        form.append(noteField);

        try {
          const savedNotes = JSON.parse(localStorage.getItem('gardenTrackerTeacherNotes') || '[]');
          if (
            !Array.isArray(savedNotes)
            || savedNotes.some((note) => (
              !note
              || typeof note.plotId !== 'string'
              || typeof note.student !== 'string'
              || typeof note.text !== 'string'
              || typeof note.author !== 'string'
              || typeof note.updatedAt !== 'string'
            ))
          ) {
            throw new Error('Stored teacher notes are not in a valid format.');
          }
          teacherNoteInput.value = savedNotes.find((note) => note.plotId === record[0])?.text || '';
        } catch (error) {
          console.error('Could not load the teacher note for this plot.', error);
          dialogStatus.textContent = 'Teacher note could not be loaded. Check the saved note data before saving.';
        }
      }
      form.append(dialogStatus);

      const saveButton = document.createElement('button');
      saveButton.type = 'submit';
      saveButton.className = 'btn btn-primary';
      saveButton.textContent = 'Save changes';
      form.append(saveButton);
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        showAdminConfirmation({
          title: `Save ${config.entity} changes?`,
          message: `Do you want to save these edits to this ${config.entity}?`,
          confirmLabel: 'Save changes',
          confirmClass: 'btn btn-primary',
          trigger: saveButton,
          onConfirm: () => {
            const updatedRecord = headings.map((_, fieldIndex) =>
              String(new FormData(form).get(`field-${fieldIndex}`) || '').trim()
            );
            const updated = records.map((item, recordIndex) =>
              recordIndex === index ? updatedRecord : item
            );
            let previousCropStorage = null;
            let updatedCrops = null;
            let cropAssignment = null;
            if (cropField) {
              const plotId = config.key === 'plots' ? updatedRecord[0] : updatedRecord[3];
              if (plotId && plotId !== '—') {
                previousCropStorage = localStorage.getItem(plotCropsStorageKey);
                try {
                  const previousCrops = readAssignedPlotCrops();
                  const beforeCrop = previousCrops[plotId]
                    ?? adminSampleCropByPlot[plotId]
                    ?? null;
                  const afterCrop = cropField.value || beforeCrop;
                  if (beforeCrop !== afterCrop) {
                    updatedCrops = { ...previousCrops };
                    if (afterCrop) updatedCrops[plotId] = afterCrop;
                    else delete updatedCrops[plotId];
                    cropAssignment = { plotId, beforeCrop, afterCrop };
                  }
                } catch (error) {
                  console.error('Could not prepare the crop assignment change.', error);
                  dialogStatus.textContent = 'Crop assignments could not be loaded. No changes were made.';
                  return;
                }
              }
            }

            let previousNotes = null;
            let previousTeacherNotes = null;
            let updatedTeacherNotes = null;
            let initialTeacherNote = '';
            if (teacherNoteInput) {
              const teacherNotesKey = 'gardenTrackerTeacherNotes';
              previousNotes = localStorage.getItem(teacherNotesKey);
              try {
                const savedNotes = JSON.parse(previousNotes || '[]');
                if (
                  !Array.isArray(savedNotes)
                  || savedNotes.some((note) => (
                    !note
                    || typeof note.plotId !== 'string'
                    || typeof note.student !== 'string'
                    || typeof note.text !== 'string'
                    || typeof note.author !== 'string'
                    || typeof note.updatedAt !== 'string'
                  ))
                ) {
                  throw new Error('Stored teacher notes are not in a valid format.');
                }

                const noteText = teacherNoteInput.value.trim();
                const plotId = updatedRecord[0];
                const student = updatedRecord[2];
                if (noteText && (!plotId || !student || student === '—')) {
                  dialogStatus.textContent = 'Assign this plot to a student before adding a teacher note.';
                  return;
                }
                previousTeacherNotes = previousNotes === null ? null : savedNotes;
                initialTeacherNote = savedNotes.find((note) => note.plotId === record[0])?.text || '';
                const nextNotes = savedNotes.filter(
                  (note) => note.plotId !== record[0] && note.plotId !== plotId
                );
                if (noteText) {
                  nextNotes.push({
                    plotId,
                    student,
                    text: noteText,
                    author: document.querySelector('[data-username]')?.textContent.trim() || 'Teacher',
                    updatedAt: new Date().toISOString(),
                  });
                }
                updatedTeacherNotes = nextNotes;
              } catch (error) {
                console.error('Could not prepare the teacher note for this plot.', error);
                dialogStatus.textContent = 'Teacher note could not be prepared. Please try again.';
                return;
              }
            }

            const recordChanged = headings.some((_, fieldIndex) => updatedRecord[fieldIndex] !== record[fieldIndex]);
            const teacherNoteChanged = teacherNoteInput ? teacherNoteInput.value.trim() !== initialTeacherNote : false;
            const historyEntry = {
              id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
              key: config.key,
              entity: config.entity,
              action: teacherNoteChanged && !recordChanged && !cropAssignment ? 'teacher-note' : 'update',
              beforeRecord: [...record],
              afterRecord: updatedRecord,
              index,
              createdAt: new Date().toISOString(),
            };
            if (cropAssignment) historyEntry.cropAssignment = cropAssignment;
            if (teacherNoteInput) {
              historyEntry.beforeTeacherNotes = previousTeacherNotes;
              historyEntry.afterTeacherNotes = updatedTeacherNotes;
            }
            if (!appendAdminHistory(historyEntry)) {
              dialogStatus.textContent = 'Could not save the edit to action history. No changes were made.';
              return;
            }

            try {
              if (teacherNoteInput) {
                localStorage.setItem('gardenTrackerTeacherNotes', JSON.stringify(updatedTeacherNotes));
              }
              if (updatedCrops) {
                localStorage.setItem(plotCropsStorageKey, JSON.stringify(updatedCrops));
              }
            } catch (error) {
              console.error(`Could not save the ${config.entity} edit.`, error);
              try {
                removeAdminHistoryEntry(historyEntry.id);
              } catch (rollbackError) {
                console.error('Could not remove the failed edit from action history.', rollbackError);
              }
              if (teacherNoteInput) {
                try {
                  if (previousNotes === null) localStorage.removeItem('gardenTrackerTeacherNotes');
                  else localStorage.setItem('gardenTrackerTeacherNotes', previousNotes);
                } catch (rollbackError) {
                  console.error('Could not roll back the teacher note after edit failed.', rollbackError);
                }
              }
              if (cropAssignment) {
                try {
                  if (previousCropStorage === null) localStorage.removeItem(plotCropsStorageKey);
                  else localStorage.setItem(plotCropsStorageKey, previousCropStorage);
                } catch (rollbackError) {
                  console.error('Could not roll back the crop assignment after edit failed.', rollbackError);
                }
              }
              dialogStatus.textContent = 'Changes could not be saved. No changes were made.';
              return;
            }

            if (saveRecords(updated)) {
              render();
              let notificationSent = true;
              if (config.key === 'plots' && (recordChanged || teacherNoteChanged || cropAssignment)) {
                const changes = [];
                headings.forEach((heading, fieldIndex) => {
                  if (record[fieldIndex] !== updatedRecord[fieldIndex]) {
                    changes.push(`${heading}: ${record[fieldIndex]} → ${updatedRecord[fieldIndex]}`);
                  }
                });
                if (cropAssignment) {
                  changes.push(`Crop: ${cropAssignment.beforeCrop || 'none'} → ${cropAssignment.afterCrop || 'none'}`);
                }
                if (teacherNoteChanged) {
                  const noteText = teacherNoteInput.value.trim();
                  changes.push(noteText
                    ? `Teacher note: ${noteText}`
                    : 'Your teacher removed the plot note.');
                }
                const assignedStudent = updatedRecord[2];
                if (assignedStudent && assignedStudent !== '—') {
                  notificationSent = notifyStudentAccounts(
                    [assignedStudent],
                    `Teacher update for Plot ${updatedRecord[0]}`,
                    `Your teacher updated Plot ${updatedRecord[0]}. ${changes.join('. ')}`
                  );
                }
                const previousStudent = record[2];
                if (
                  previousStudent
                  && previousStudent !== '—'
                  && previousStudent !== assignedStudent
                ) {
                  notificationSent = notifyStudentAccounts(
                    [previousStudent],
                    `Plot ${updatedRecord[0]} assignment changed`,
                    `Plot ${updatedRecord[0]} is no longer assigned to you. It is now assigned to ${assignedStudent && assignedStudent !== '—' ? assignedStudent : 'no student'}.`
                  ) && notificationSent;
                }
              } else if ((config.key === 'students' || config.key === 'observations') && recordChanged) {
                const changedFields = headings.reduce((changes, heading, fieldIndex) => {
                  if (record[fieldIndex] !== updatedRecord[fieldIndex]) {
                    changes.push(`${heading}: ${record[fieldIndex]} → ${updatedRecord[fieldIndex]}`);
                  }
                  return changes;
                }, []);
                const isStudentRecord = config.key === 'students';
                notificationSent = notifyStudentAccounts(
                  isStudentRecord ? [record[1], updatedRecord[1]] : [updatedRecord[1]],
                  isStudentRecord ? 'Your student record was updated' : 'Your observation was updated',
                  isStudentRecord
                    ? `Your teacher updated your student record. ${changedFields.join('. ')}`
                    : `Your teacher updated your observation for Plot ${updatedRecord[2]}. ${changedFields.join('. ')}`
                );
              }
              showStatus(notificationSent
                ? `${config.entity[0].toUpperCase()}${config.entity.slice(1)} updated.`
                : `${config.entity[0].toUpperCase()}${config.entity.slice(1)} updated, but the student notification could not be sent.`);
              close();
              showAdminSuccess({ message: status.textContent });
              return;
            }

            dialogStatus.textContent = status.textContent;
            try {
              removeAdminHistoryEntry(historyEntry.id);
            } catch (error) {
              console.error('Could not remove the failed edit from action history.', error);
            }
            if (teacherNoteInput) {
              try {
                if (previousNotes === null) {
                  localStorage.removeItem('gardenTrackerTeacherNotes');
                } else {
                  localStorage.setItem('gardenTrackerTeacherNotes', previousNotes);
                }
              } catch (error) {
                console.error('Could not roll back the teacher note after plot save failed.', error);
              }
            }
            if (cropAssignment) {
              try {
                if (previousCropStorage === null) localStorage.removeItem(plotCropsStorageKey);
                else localStorage.setItem(plotCropsStorageKey, previousCropStorage);
              } catch (error) {
                console.error('Could not roll back the crop assignment after record save failed.', error);
              }
            }
          },
        });
      });
      dialog.append(form);
    }

    document.body.append(overlay);
    document.body.classList.add('modal-open');
    (action === 'view' ? closeButton : overlay.querySelector('input, textarea'))?.focus();
  };

  tbody.addEventListener('click', (event) => {
    const button = event.target.closest('[data-row-action]');
    const row = button?.closest(`tr.${config.rowClass}`);
    if (!button || !row) return;
    openRecordDialog(button.dataset.rowAction, Number(row.dataset.recordIndex), button);
  });

  tbody.addEventListener('change', (event) => {
    const checkbox = event.target.closest('[data-row-selection]');
    const row = checkbox?.closest(`tr.${config.rowClass}`);
    if (!checkbox || !row) return;
    const index = Number(row.dataset.recordIndex);
    if (checkbox.checked) selectedIndices.add(index);
    else selectedIndices.delete(index);
    updateSelectionControls();
  });

  selectAllCheckbox.addEventListener('change', () => {
    const visibleRows = Array.from(tbody.querySelectorAll(`tr.${config.rowClass}`))
      .filter((row) => !row.hidden);
    visibleRows.forEach((row) => {
      const index = Number(row.dataset.recordIndex);
      if (selectAllCheckbox.checked) selectedIndices.add(index);
      else selectedIndices.delete(index);
      const checkbox = row.querySelector('[data-row-selection]');
      if (checkbox) checkbox.checked = selectAllCheckbox.checked;
    });
    updateSelectionControls();
  });

  const selectionObserver = new MutationObserver(updateSelectionControls);
  selectionObserver.observe(tbody, {
    attributes: true,
    attributeFilter: ['hidden'],
    childList: true,
    subtree: true,
  });

  table.parentElement.addEventListener('click', (event) => {
    if (event.target.closest('[data-cancel-row-selection]')) {
      selectedIndices.clear();
      tbody.querySelectorAll('[data-row-selection]').forEach((checkbox) => {
        checkbox.checked = false;
      });
      updateSelectionControls();
      return;
    }

    if (!event.target.closest('[data-bulk-delete-rows]')) return;
    const selectedRecords = [...selectedIndices]
      .filter((index) => records[index])
      .sort((first, second) => first - second)
      .map((index) => ({ index, record: [...records[index]] }));
    if (selectedRecords.length < 2) return;

    showAdminConfirmation({
      title: `Delete ${selectedRecords.length} ${pluralEntity}?`,
      message: `These ${pluralEntity} will be moved to the archive, where you can undo this action.`,
      confirmLabel: 'Move to archive',
      trigger: bulkDeleteButton,
      onConfirm: () => {
        const historyEntries = selectedRecords.map(({ index, record }) => ({
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          key: config.key,
          entity: config.entity,
          action: 'delete',
          beforeRecord: record,
          afterRecord: null,
          index,
          createdAt: new Date().toISOString(),
        }));
        const appendedEntries = [];
        for (const entry of historyEntries) {
          if (!appendAdminHistory(entry)) {
            let rollbackFailed = false;
            appendedEntries.forEach(({ id }) => {
              try {
                removeAdminHistoryEntry(id);
              } catch (error) {
                rollbackFailed = true;
                console.error(`Could not roll back a failed bulk ${config.entity} delete.`, error);
              }
            });
            showStatus(rollbackFailed
              ? `Could not save the bulk delete to history, and some ${config.entity} history entries could not be rolled back.`
              : `Could not save the bulk delete to history. No ${pluralEntity} were deleted.`);
            return;
          }
          appendedEntries.push(entry);
        }

        const deletedIndices = new Set(selectedRecords.map(({ index }) => index));
        const updated = records.filter((_, index) => !deletedIndices.has(index));
        if (!saveRecords(updated)) {
          let rollbackFailed = false;
          appendedEntries.forEach(({ id }) => {
            try {
              removeAdminHistoryEntry(id);
            } catch (error) {
              rollbackFailed = true;
              console.error(`Could not roll back the failed bulk ${config.entity} delete.`, error);
            }
          });
          if (rollbackFailed) {
            showStatus(`${config.entity[0].toUpperCase()}${config.entity.slice(1)} records were not deleted, but some history entries could not be rolled back.`);
          }
          return;
        }

        selectedIndices.clear();
        render();
        const notificationSent = selectedRecords.reduce((sent, { record }) => {
          if (config.key === 'students') {
            return notifyStudentAccounts(
              [record[config.labelIndex]],
              'Your student record was updated',
              'Your teacher moved your student record to the archive.'
            ) && sent;
          }
          if (config.key === 'plots') {
            return notifyStudentAccounts(
              [record[2]],
              `Plot ${record[0]} updated`,
              `Your teacher moved Plot ${record[0]} to the archive.`
            ) && sent;
          }
          return notifyStudentAccounts(
            [record[1]],
            'Your observation was updated',
            `Your teacher moved your observation for Plot ${record[2]} to the archive.`
          ) && sent;
        }, true);
        showStatus(notificationSent
          ? `${selectedRecords.length} ${pluralEntity} moved to the archive.`
          : `${selectedRecords.length} ${pluralEntity} moved to the archive, but student notifications could not be sent.`);
        showAdminSuccess({ message: status.textContent, trigger: bulkDeleteButton });
      },
    });
  });

  document.addEventListener('admin:assign-plot', (event) => {
    if (config.key !== 'plots') return;
    const { student, plot, crop } = event.detail;
    const plotIndex = records.findIndex((record) => record[0] === plot);
    const previousRecord = plotIndex === -1 ? null : [...records[plotIndex]];
    let previousCrops;
    try {
      previousCrops = readAssignedPlotCrops();
    } catch (error) {
      console.error('Could not load saved plot crops.', error);
      showStatus('Could not load crop assignments. No changes were made.');
      return;
    }
    const updated = records.map((record, index) => {
      if (index !== plotIndex) return record;
      const next = [...record];
      next[2] = student;
      next[3] = 'Assigned';
      return next;
    });
    if (plotIndex === -1) updated.push([plot, 'School Garden', student, 'Assigned']);
    const nextIndex = plotIndex === -1 ? updated.length - 1 : plotIndex;
    const historyEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      key: config.key,
      entity: config.entity,
      action: plotIndex === -1 ? 'create' : 'assign',
      beforeRecord: previousRecord,
      afterRecord: [...updated[nextIndex]],
      index: nextIndex,
      createdAt: new Date().toISOString(),
    };
    if (!appendAdminHistory(historyEntry)) {
      showStatus('Could not save the plot assignment to action history. No changes were made.');
      return;
    }
    try {
      localStorage.setItem(plotCropsStorageKey, JSON.stringify({
        ...previousCrops,
        [plot]: crop,
      }));
    } catch (error) {
      console.error('Could not save the crop assignment.', error);
      try {
        removeAdminHistoryEntry(historyEntry.id);
      } catch (rollbackError) {
        console.error('Could not remove the failed crop assignment from history.', rollbackError);
      }
      showStatus('Unable to save the crop assignment. Please try again.');
      return;
    }
    if (saveRecords(updated)) {
      render();
      const notificationSent = notifyStudentAccounts(
        [student],
        `Plot ${plot} assigned`,
        `Your teacher assigned Plot ${plot} to you for ${crop}.`
      );
      showStatus(notificationSent
        ? `Plot ${plot} assigned to ${student} for ${crop}.`
        : `Plot ${plot} assigned to ${student}, but the student notification could not be sent.`);
      showAdminSuccess({ message: status.textContent });
    } else {
      try {
        if (Object.keys(previousCrops).length) {
          localStorage.setItem(plotCropsStorageKey, JSON.stringify(previousCrops));
        } else {
          localStorage.removeItem(plotCropsStorageKey);
        }
      } catch (error) {
        console.error('Could not roll back the failed crop assignment.', error);
      }
      try {
        removeAdminHistoryEntry(historyEntry.id);
      } catch (error) {
        console.error('Could not remove the failed plot assignment from action history.', error);
      }
    }
  });

  render();
  if (photoLoadError) {
    showStatus('Student plot photos could not be loaded. Check the saved account and photo data.');
  }
}

function setupAdminArchivePage() {
  const tbody = document.querySelector('[data-archive-records]');
  if (!tbody) return;

  const table = tbody.closest('table');
  const status = document.querySelector('[data-archive-status]');
  const emptyState = document.querySelector('[data-archive-empty]');
  const selectedHistoryIds = new Set();
  const selectionHeader = document.createElement('th');
  selectionHeader.className = 'row-select-cell';
  const selectAllCheckbox = document.createElement('input');
  selectAllCheckbox.type = 'checkbox';
  selectAllCheckbox.setAttribute('aria-label', 'Select all history entries on this page');
  selectAllCheckbox.dataset.selectAllArchive = '';
  selectionHeader.append(selectAllCheckbox);
  table.tHead.rows[0].prepend(selectionHeader);

  const selectionBar = document.createElement('div');
  selectionBar.className = 'bulk-selection-bar';
  selectionBar.hidden = true;
  selectionBar.setAttribute('aria-live', 'polite');
  const selectionCount = document.createElement('span');
  const bulkDeleteButton = document.createElement('button');
  bulkDeleteButton.type = 'button';
  bulkDeleteButton.className = 'btn btn-danger';
  bulkDeleteButton.textContent = 'Delete';
  bulkDeleteButton.dataset.bulkDeleteArchive = '';
  const cancelSelectionButton = document.createElement('button');
  cancelSelectionButton.type = 'button';
  cancelSelectionButton.className = 'btn btn-secondary';
  cancelSelectionButton.textContent = 'Cancel';
  cancelSelectionButton.dataset.cancelArchiveSelection = '';
  selectionBar.append(selectionCount, bulkDeleteButton, cancelSelectionButton);
  table.parentElement.insertBefore(selectionBar, table);

  const updateSelectionControls = () => {
    selectionBar.hidden = selectedHistoryIds.size < 2;
    selectionCount.textContent = `${selectedHistoryIds.size} history entries selected`;
    const visibleRows = Array.from(tbody.rows).filter((row) => !row.hidden);
    const visibleSelectedCount = visibleRows.filter((row) =>
      selectedHistoryIds.has(row.dataset.historyId)
    ).length;
    selectAllCheckbox.checked = visibleRows.length > 0
      && visibleSelectedCount === visibleRows.length;
    selectAllCheckbox.indeterminate = visibleSelectedCount > 0
      && visibleSelectedCount < visibleRows.length;
  };

  const recordFields = {
    student: ['ID', 'Name', 'Grade and section', 'Garden plot', 'Status'],
    plot: ['Plot', 'Location', 'Assigned student', 'Status'],
    observation: ['Date', 'Student', 'Plot', 'Condition', 'Observation'],
  };

  const showStatus = (message) => {
    status.textContent = message;
  };

  const showHistoryDetails = (entry, trigger) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    const dialog = document.createElement('section');
    dialog.className = 'modal-card archive-detail-dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'archive-detail-title');

    const header = document.createElement('div');
    header.className = 'modal-header';
    const title = document.createElement('h2');
    title.id = 'archive-detail-title';
    title.textContent = `${entry.entity[0].toUpperCase()}${entry.entity.slice(1)} action details`;
    const closeButton = document.createElement('button');
    closeButton.className = 'modal-close';
    closeButton.type = 'button';
    closeButton.setAttribute('aria-label', 'Close details');
    closeButton.textContent = '×';
    header.append(title, closeButton);
    dialog.append(header);

    const actionNames = {
      create: 'Added',
      update: 'Edited',
      delete: 'Deleted',
      assign: 'Plot assigned',
      'teacher-note': 'Teacher note',
    };
    const actionDate = new Date(entry.createdAt);
    const metadata = document.createElement('dl');
    metadata.className = 'archive-detail-metadata';
    [
      ['Action', actionNames[entry.action] || entry.action],
      ['When', Number.isNaN(actionDate.getTime())
        ? 'Unknown date'
        : actionDate.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })],
    ].forEach(([labelText, valueText]) => {
      const item = document.createElement('div');
      const label = document.createElement('dt');
      label.textContent = labelText;
      const value = document.createElement('dd');
      value.textContent = valueText;
      item.append(label, value);
      metadata.append(item);
    });
    dialog.append(metadata);

    const appendRecord = (headingText, record) => {
      if (!record) return;
      const section = document.createElement('section');
      section.className = 'archive-detail-section';
      const heading = document.createElement('h3');
      heading.textContent = headingText;
      const fields = document.createElement('dl');
      fields.className = 'archive-detail-fields';
      recordFields[entry.entity].forEach((fieldName, index) => {
        const item = document.createElement('div');
        const label = document.createElement('dt');
        label.textContent = fieldName;
        const value = document.createElement('dd');
        value.textContent = record[index] || '—';
        item.append(label, value);
        fields.append(item);
      });
      section.append(heading, fields);
      dialog.append(section);
    };

    appendRecord('Record before action', entry.beforeRecord);
    appendRecord('Record after action', entry.afterRecord);

    if (entry.beforeTeacherNotes !== undefined || entry.afterTeacherNotes !== undefined) {
      const appendNotes = (headingText, notes) => {
        const section = document.createElement('section');
        section.className = 'archive-detail-section';
        const heading = document.createElement('h3');
        heading.textContent = headingText;
        section.append(heading);
        if (!notes || notes.length === 0) {
          const empty = document.createElement('p');
          empty.textContent = 'No teacher notes.';
          section.append(empty);
        } else {
          notes.forEach((note) => {
            const fields = document.createElement('dl');
            fields.className = 'archive-detail-fields';
            [
              ['Plot', note.plotId],
              ['Student', note.student],
              ['Note', note.text],
              ['Author', note.author],
              ['Updated', note.updatedAt],
            ].forEach(([labelText, valueText]) => {
              const item = document.createElement('div');
              const label = document.createElement('dt');
              label.textContent = labelText;
              const value = document.createElement('dd');
              value.textContent = valueText || '—';
              item.append(label, value);
              fields.append(item);
            });
            section.append(fields);
          });
        }
        dialog.append(section);
      };

      appendNotes('Teacher notes before action', entry.beforeTeacherNotes);
      appendNotes('Teacher notes after action', entry.afterTeacherNotes);
    }
    if (entry.cropAssignment) {
      const section = document.createElement('section');
      section.className = 'archive-detail-section';
      const heading = document.createElement('h3');
      heading.textContent = 'Crop assignment';
      const fields = document.createElement('dl');
      fields.className = 'archive-detail-fields';
      [
        ['Plot', entry.cropAssignment.plotId],
        ['Before', entry.cropAssignment.beforeCrop || 'No crop assigned'],
        ['After', entry.cropAssignment.afterCrop || 'No crop assigned'],
      ].forEach(([labelText, valueText]) => {
        const item = document.createElement('div');
        const label = document.createElement('dt');
        label.textContent = labelText;
        const value = document.createElement('dd');
        value.textContent = valueText;
        item.append(label, value);
        fields.append(item);
      });
      section.append(heading, fields);
      dialog.append(section);
    }

    let onKeyDown;
    const close = () => {
      overlay.remove();
      document.body.classList.remove('modal-open');
      document.removeEventListener('keydown', onKeyDown);
      trigger.focus();
    };
    closeButton.addEventListener('click', close);
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) close();
    });
    onKeyDown = (event) => {
      if (event.key === 'Escape' && overlay.isConnected) close();
    };
    document.addEventListener('keydown', onKeyDown);
    overlay.append(dialog);
    document.body.append(overlay);
    document.body.classList.add('modal-open');
    closeButton.focus();
  };

  const render = () => {
    let history;
    try {
      history = readAdminArchive();
    } catch (error) {
      console.error('Could not load admin action history.', error);
      showStatus('Action history could not be loaded. Check the saved history data.');
      return;
    }

    tbody.replaceChildren();
    [...history].reverse().forEach((rawEntry) => {
      const entry = normalizeAdminHistoryEntry(rawEntry);
      const row = document.createElement('tr');
      row.dataset.historyId = entry.id;
      const selectionCell = document.createElement('td');
      selectionCell.className = 'row-select-cell';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = selectedHistoryIds.has(entry.id);
      checkbox.setAttribute('aria-label', 'Select history entry');
      checkbox.dataset.archiveSelection = '';
      selectionCell.append(checkbox);
      row.append(selectionCell);
      const entityCell = document.createElement('td');
      entityCell.textContent = `${entry.entity[0].toUpperCase()}${entry.entity.slice(1)}`;
      const recordCell = document.createElement('td');
      const details = document.createElement('span');
      details.className = 'archive-record-details';
      details.textContent = describeAdminHistoryAction(entry);
      recordCell.append(details);
      const actionCellType = document.createElement('td');
      const actionNames = {
        create: 'Added',
        update: 'Edited',
        delete: 'Deleted',
        assign: 'Plot assigned',
        'teacher-note': 'Teacher note',
      };
      actionCellType.textContent = actionNames[entry.action];
      const dateCell = document.createElement('td');
      const actionDate = new Date(entry.createdAt);
      dateCell.textContent = Number.isNaN(actionDate.getTime())
        ? 'Unknown date'
        : actionDate.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
      const actionCell = document.createElement('td');
      const viewButton = document.createElement('button');
      viewButton.type = 'button';
      viewButton.className = 'icon-action archive-action-button';
      viewButton.dataset.viewHistoryEntry = entry.id;
      viewButton.setAttribute('aria-label', 'View action details');
      viewButton.title = 'View';
      const viewIcon = document.createElement('img');
      viewIcon.src = '../images/view.svg';
      viewIcon.alt = '';
      viewButton.append(viewIcon);
      const undoButton = document.createElement('button');
      undoButton.type = 'button';
      undoButton.className = 'icon-action archive-action-button';
      undoButton.dataset.undoHistoryEntry = entry.id;
      undoButton.setAttribute('aria-label', 'Undo action');
      undoButton.title = 'Undo';
      const undoIcon = document.createElement('img');
      undoIcon.src = '../images/undo.svg';
      undoIcon.alt = '';
      undoButton.append(undoIcon);
      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.className = 'icon-action icon-action-danger archive-action-button';
      deleteButton.dataset.deleteHistoryEntry = entry.id;
      deleteButton.setAttribute('aria-label', 'Delete history entry');
      deleteButton.title = 'Delete';
      const deleteIcon = document.createElement('img');
      deleteIcon.src = '../images/delete.svg';
      deleteIcon.alt = '';
      deleteButton.append(deleteIcon);
      const actions = document.createElement('div');
      actions.className = 'archive-actions';
      actions.append(viewButton, undoButton, deleteButton);
      actionCell.append(actions);
      row.append(entityCell, actionCellType, recordCell, dateCell, actionCell);
      tbody.append(row);
    });

    emptyState.hidden = history.length > 0;
    const availableIds = new Set(history.map((entry) => entry.id));
    selectedHistoryIds.forEach((id) => {
      if (!availableIds.has(id)) selectedHistoryIds.delete(id);
    });
    showStatus('');
    tbody.dispatchEvent(new Event('tabledatachange'));
    updateSelectionControls();
  };

  tbody.addEventListener('change', (event) => {
    const checkbox = event.target.closest('[data-archive-selection]');
    const row = checkbox?.closest('tr');
    if (!checkbox || !row) return;
    if (checkbox.checked) selectedHistoryIds.add(row.dataset.historyId);
    else selectedHistoryIds.delete(row.dataset.historyId);
    updateSelectionControls();
  });

  selectAllCheckbox.addEventListener('change', () => {
    Array.from(tbody.rows).filter((row) => !row.hidden).forEach((row) => {
      const checkbox = row.querySelector('[data-archive-selection]');
      if (selectAllCheckbox.checked) selectedHistoryIds.add(row.dataset.historyId);
      else selectedHistoryIds.delete(row.dataset.historyId);
      if (checkbox) checkbox.checked = selectAllCheckbox.checked;
    });
    updateSelectionControls();
  });

  const archiveSelectionObserver = new MutationObserver(updateSelectionControls);
  archiveSelectionObserver.observe(tbody, {
    attributes: true,
    attributeFilter: ['hidden'],
    childList: true,
    subtree: true,
  });

  table.parentElement.addEventListener('click', (event) => {
    if (event.target.closest('[data-cancel-archive-selection]')) {
      selectedHistoryIds.clear();
      tbody.querySelectorAll('[data-archive-selection]').forEach((checkbox) => {
        checkbox.checked = false;
      });
      updateSelectionControls();
      return;
    }
    if (!event.target.closest('[data-bulk-delete-archive]')) return;
    const selectedIds = new Set(selectedHistoryIds);
    if (selectedIds.size < 2) return;

    showAdminConfirmation({
      title: `Delete ${selectedIds.size} history entries?`,
      message: 'These actions will be permanently removed. Deleted records may no longer be recoverable.',
      confirmLabel: 'Delete permanently',
      trigger: bulkDeleteButton,
      onConfirm: () => {
        let history;
        try {
          history = readAdminArchive();
          const remaining = history.filter((entry) => !selectedIds.has(entry.id));
          if (history.length - remaining.length !== selectedIds.size) {
            showStatus('Some selected history entries are no longer available. Refresh and try again.');
            render();
            return;
          }
          localStorage.setItem(adminArchiveStorageKey, JSON.stringify(remaining));
        } catch (error) {
          console.error('Could not permanently delete the selected history entries.', error);
          showStatus('Could not delete the selected history entries. Please try again.');
          return;
        }
        selectedHistoryIds.clear();
        render();
        showStatus(`${selectedIds.size} history entries permanently deleted.`);
        showAdminSuccess({ message: status.textContent, trigger: bulkDeleteButton });
      },
    });
  });

  tbody.addEventListener('click', (event) => {
    const viewButton = event.target.closest('[data-view-history-entry]');
    const undoButton = event.target.closest('[data-undo-history-entry]');
    const deleteButton = event.target.closest('[data-delete-history-entry]');
    if (!viewButton && !undoButton && !deleteButton) return;

    let history;
    try {
      history = readAdminArchive();
    } catch (error) {
      console.error('Could not read admin action history.', error);
      showStatus('Action history could not be read. No records were changed.');
      return;
    }

    const button = viewButton || undoButton || deleteButton;
    const historyIndex = history.findIndex((entry) => entry.id === button.dataset.viewHistoryEntry
      || entry.id === button.dataset.undoHistoryEntry
      || entry.id === button.dataset.deleteHistoryEntry);
    const rawEntry = history[historyIndex];
    if (!rawEntry) {
      showStatus('This history entry is no longer available. Refresh the page and try again.');
      render();
      return;
    }

    const entry = normalizeAdminHistoryEntry(rawEntry);
    if (viewButton) {
      showHistoryDetails(entry, viewButton);
      return;
    }
    if (deleteButton) {
      showAdminConfirmation({
        title: 'Delete history entry?',
        message: 'This action will be permanently removed. If it represents a deleted record, that record will no longer be recoverable.',
        confirmLabel: 'Delete permanently',
        trigger: deleteButton,
        onConfirm: () => {
          try {
            removeAdminHistoryEntry(entry.id);
          } catch (error) {
            console.error('Could not permanently delete the history entry.', error);
            showStatus('Could not delete this history entry. Please try again.');
            return;
          }
          render();
          showStatus('History entry permanently deleted.');
          showAdminSuccess({ message: status.textContent, trigger: deleteButton });
        },
      });
      return;
    }

    showAdminConfirmation({
      title: 'Undo this action?',
      message: `This will reverse the ${entry.action} action for this ${entry.entity}.`,
      confirmLabel: 'Undo action',
      confirmClass: 'btn btn-primary',
      trigger: undoButton,
      onConfirm: () => {
    const config = adminArchiveRecordConfigs[entry.key];
    const previousRecords = localStorage.getItem(config.storageKey);
    let records;
    try {
      records = JSON.parse(previousRecords);
      if (
        previousRecords === null
        || !Array.isArray(records)
        || records.some((record) =>
          !Array.isArray(record)
          || record.length !== config.recordLength
          || record.some((value) => typeof value !== 'string')
        )
      ) {
        throw new Error(`Saved ${entry.entity} records have an invalid format.`);
      }
    } catch (error) {
      console.error(`Could not load the active ${entry.entity} list for undo.`, error);
      showStatus(`Could not undo this action. The active ${entry.entity} list could not be loaded.`);
      return;
    }

    const expectedRecord = entry.action === 'delete' ? null : entry.afterRecord;
    let recordIndex = -1;
    if (entry.action !== 'delete') {
      if (
        records[entry.index]
        && JSON.stringify(records[entry.index]) === JSON.stringify(expectedRecord)
      ) {
        recordIndex = entry.index;
      } else {
        const matches = records.reduce((indices, record, index) => {
          if (JSON.stringify(record) === JSON.stringify(expectedRecord)) indices.push(index);
          return indices;
        }, []);
        if (matches.length === 1) recordIndex = matches[0];
      }
      if (recordIndex === -1) {
        showStatus(`This ${entry.entity} has changed since the action. Undo newer changes first.`);
        return;
      }
    } else {
      const identityField = config.identityField;
      const alreadyExists = records.some((record) => (
        identityField === null
          ? JSON.stringify(record) === JSON.stringify(entry.beforeRecord)
          : record[identityField] === entry.beforeRecord[identityField]
      ));
      if (alreadyExists) {
        showStatus(`A matching ${entry.entity} already exists. The history entry was kept.`);
        return;
      }
    }

    let previousNotes = null;
    let nextNotes = null;
    if (entry.beforeTeacherNotes !== undefined) {
      previousNotes = localStorage.getItem('gardenTrackerTeacherNotes');
      try {
        const currentNotes = previousNotes === null ? null : JSON.parse(previousNotes);
        if (JSON.stringify(currentNotes) !== JSON.stringify(entry.afterTeacherNotes)) {
          showStatus('The teacher note has changed since this edit. Undo newer note changes first.');
          return;
        }
        nextNotes = entry.beforeTeacherNotes;
      } catch (error) {
        console.error('Could not load teacher notes for undo.', error);
        showStatus('Could not undo this edit because the teacher notes could not be loaded.');
        return;
      }
    }

    let previousCropStorage = null;
    let nextCrops = null;
    if (entry.cropAssignment) {
      previousCropStorage = localStorage.getItem(plotCropsStorageKey);
      try {
        const currentCrops = readAssignedPlotCrops();
        const currentCrop = currentCrops[entry.cropAssignment.plotId] || null;
        if (currentCrop !== entry.cropAssignment.afterCrop) {
          showStatus('The crop assignment has changed since this edit. Undo newer changes first.');
          return;
        }
        nextCrops = { ...currentCrops };
        if (entry.cropAssignment.beforeCrop) {
          nextCrops[entry.cropAssignment.plotId] = entry.cropAssignment.beforeCrop;
        } else {
          delete nextCrops[entry.cropAssignment.plotId];
        }
      } catch (error) {
        console.error('Could not load crop assignments for undo.', error);
        showStatus('Could not undo this edit because crop assignments could not be loaded.');
        return;
      }
    }

    const updatedRecords = [...records];
    if (entry.action === 'delete') {
      updatedRecords.splice(Math.min(entry.index, updatedRecords.length), 0, entry.beforeRecord);
    } else if (entry.action === 'create') {
      updatedRecords.splice(recordIndex, 1);
    } else {
      updatedRecords[recordIndex] = entry.beforeRecord;
    }
    const updatedHistory = history.filter((_, index) => index !== historyIndex);
    const previousHistory = localStorage.getItem(adminArchiveStorageKey);
    try {
      localStorage.setItem(config.storageKey, JSON.stringify(updatedRecords));
      if (entry.beforeTeacherNotes !== undefined) {
        if (nextNotes === null) {
          localStorage.removeItem('gardenTrackerTeacherNotes');
        } else {
          localStorage.setItem('gardenTrackerTeacherNotes', JSON.stringify(nextNotes));
        }
      }
      if (entry.cropAssignment) {
        if (Object.keys(nextCrops).length) {
          localStorage.setItem(plotCropsStorageKey, JSON.stringify(nextCrops));
        } else {
          localStorage.removeItem(plotCropsStorageKey);
        }
      }
      localStorage.setItem(adminArchiveStorageKey, JSON.stringify(updatedHistory));
    } catch (error) {
      console.error(`Could not undo the ${entry.entity} action.`, error);
      try {
        if (previousRecords === null) localStorage.removeItem(config.storageKey);
        else localStorage.setItem(config.storageKey, previousRecords);
        if (entry.beforeTeacherNotes !== undefined) {
          if (previousNotes === null) localStorage.removeItem('gardenTrackerTeacherNotes');
          else localStorage.setItem('gardenTrackerTeacherNotes', previousNotes);
        }
        if (entry.cropAssignment) {
          if (previousCropStorage === null) localStorage.removeItem(plotCropsStorageKey);
          else localStorage.setItem(plotCropsStorageKey, previousCropStorage);
        }
        if (previousHistory === null) localStorage.removeItem(adminArchiveStorageKey);
        else localStorage.setItem(adminArchiveStorageKey, previousHistory);
      } catch (rollbackError) {
        console.error(`Could not roll back the ${entry.entity} action after undo failed.`, rollbackError);
      }
      showStatus('Could not undo this action. Please try again.');
      return;
    }

    render();
    const changedRecord = entry.action === 'create'
      ? entry.afterRecord
      : entry.beforeRecord || entry.afterRecord;
    const studentNames = entry.key === 'plots'
      ? [entry.beforeRecord?.[2], entry.afterRecord?.[2]]
      : entry.key === 'students'
        ? [entry.beforeRecord?.[1], entry.afterRecord?.[1]]
        : entry.key === 'observations'
          ? [entry.beforeRecord?.[1], entry.afterRecord?.[1]]
          : [];
    const notificationSent = studentNames.length
      ? notifyStudentAccounts(
        studentNames.filter((name) => name && name !== '—'),
        entry.key === 'plots'
          ? `Plot ${changedRecord?.[0] || ''} changed`
          : 'A teacher update was reversed',
        entry.key === 'plots'
          ? `Your teacher reversed a change to Plot ${changedRecord?.[0] || ''}.`
          : `Your teacher reversed a change to your ${entry.entity} record.`
      )
      : true;
    showStatus(notificationSent
      ? `${entry.entity[0].toUpperCase()}${entry.entity.slice(1)} action undone.`
      : `${entry.entity[0].toUpperCase()}${entry.entity.slice(1)} action undone, but the student notification could not be sent.`);
    showAdminSuccess({ message: status.textContent, trigger: undoButton });
      },
    });
  });

  render();
}

function setupAdminGrowthTracker() {
  const plotSelect = document.querySelector('[data-growth-plot]');
  const plotSummary = document.querySelector('[data-growth-plot-summary]');
  const cropIcon = document.querySelector('[data-growth-crop-icon]');
  const cropName = document.querySelector('[data-growth-crop-name]');
  const plotStudent = document.querySelector('[data-growth-plot-student]');
  const sampleBadge = document.querySelector('[data-growth-sample-badge]');
  const chart = document.querySelector('[data-growth-chart]');
  const chartEmpty = document.querySelector('[data-growth-chart-empty]');
  const observationList = document.querySelector('[data-growth-observations]');
  const observationEmpty = document.querySelector('[data-growth-observations-empty]');
  const summary = document.querySelector('[data-growth-summary]');
  const status = document.querySelector('[data-growth-status]');
  if (
    !plotSelect
    || !plotSummary
    || !cropIcon
    || !cropName
    || !plotStudent
    || !sampleBadge
    || !chart
    || !chartEmpty
    || !observationList
    || !observationEmpty
    || !summary
    || !status
  ) return;

  const svgNamespace = 'http://www.w3.org/2000/svg';
  const createSvgElement = (name, attributes = {}) => {
    const element = document.createElementNS(svgNamespace, name);
    Object.entries(attributes).forEach(([key, value]) => {
      element.setAttribute(key, String(value));
    });
    return element;
  };
  const formatDate = (dateValue) => {
    const date = new Date(`${dateValue}T00:00:00`);
    return Number.isNaN(date.getTime())
      ? dateValue
      : new Intl.DateTimeFormat(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }).format(date);
  };
  const samplePlots = {
    'A-01': {
      crop: 'Tomato',
      icon: '../images/tomato.svg',
      student: 'Felix Cagampang',
      observations: [
        {
          id: 'sample-a01-1',
          plot: 'A-01',
          student: 'Felix Cagampang',
          date: '2026-08-20',
          height: 12.5,
          weather: 'sunny',
          soil: 'moist',
          condition: 'healthy',
          notes: 'Seedlings have emerged and the first true leaves are forming.',
          submittedAt: '2026-08-20T08:00:00.000Z',
          isSample: true,
        },
        {
          id: 'sample-a01-2',
          plot: 'A-01',
          student: 'Felix Cagampang',
          date: '2026-08-24',
          height: 18.2,
          weather: 'partly-cloudy',
          soil: 'moist',
          condition: 'healthy',
          notes: 'Plants are taller and have several new leaves. Stems look strong.',
          submittedAt: '2026-08-24T08:00:00.000Z',
          isSample: true,
        },
        {
          id: 'sample-a01-3',
          plot: 'A-01',
          student: 'Felix Cagampang',
          date: '2026-08-28',
          height: 25.6,
          weather: 'sunny',
          soil: 'moist',
          condition: 'healthy',
          notes: 'Tomato plants continue to grow well; small flower buds are visible.',
          submittedAt: '2026-08-28T08:00:00.000Z',
          isSample: true,
        },
      ],
    },
    'A-02': {
      crop: 'Carrot',
      icon: '../images/carrot.svg',
      student: 'Maria Santos',
      observations: [
        {
          id: 'sample-a02-1',
          plot: 'A-02',
          student: 'Maria Santos',
          date: '2026-08-20',
          height: 5.2,
          weather: 'sunny',
          soil: 'moist',
          condition: 'healthy',
          notes: 'Carrot seedlings have sprouted in neat rows.',
          submittedAt: '2026-08-20T08:15:00.000Z',
          isSample: true,
        },
        {
          id: 'sample-a02-2',
          plot: 'A-02',
          student: 'Maria Santos',
          date: '2026-08-24',
          height: 8.4,
          weather: 'partly-cloudy',
          soil: 'moist',
          condition: 'healthy',
          notes: 'Feathery leaves are growing taller; seedlings were thinned.',
          submittedAt: '2026-08-24T08:15:00.000Z',
          isSample: true,
        },
        {
          id: 'sample-a02-3',
          plot: 'A-02',
          student: 'Maria Santos',
          date: '2026-08-28',
          height: 12.1,
          weather: 'cloudy',
          soil: 'moist',
          condition: 'healthy',
          notes: 'Leaves have filled out and the plants look evenly spaced.',
          submittedAt: '2026-08-28T08:15:00.000Z',
          isSample: true,
        },
      ],
    },
  };
  const cropIcons = {
    Tomato: '../images/tomato.svg',
    Radish: '../images/radish.svg',
    Carrot: '../images/carrot.svg',
  };
  let observations = [];
  try {
    const stored = JSON.parse(localStorage.getItem('gardenTrackerGrowthObservations') || '[]');
    if (
      !Array.isArray(stored)
      || stored.some((observation) => (
        !observation
        || typeof observation.id !== 'string'
        || typeof observation.plot !== 'string'
        || typeof observation.student !== 'string'
        || typeof observation.date !== 'string'
        || !(observation.height === null || (
          typeof observation.height === 'number'
          && Number.isFinite(observation.height)
          && observation.height >= 0
        ))
        || typeof observation.weather !== 'string'
        || typeof observation.soil !== 'string'
        || typeof observation.condition !== 'string'
        || typeof observation.notes !== 'string'
        || typeof observation.submittedAt !== 'string'
      ))
    ) {
      throw new Error('Stored growth observations have an invalid format.');
    }
    observations = stored;
  } catch (error) {
    console.error('Could not load growth observations.', error);
    status.textContent = 'Growth observations could not be loaded. Check the saved observation data.';
    plotSelect.disabled = true;
    return;
  }

  const trackedPlots = new Set(observations.map((observation) => observation.plot));
  let assignedCrops;
  try {
    assignedCrops = readAssignedPlotCrops();
  } catch (error) {
    console.error('Could not load saved crop assignments for the growth tracker.', error);
    status.textContent = 'Crop assignments could not be loaded. Check the saved crop data.';
    plotSelect.disabled = true;
    return;
  }
  try {
    const savedPlots = localStorage.getItem('gardenTrackerAdminRows:plots');
    if (savedPlots !== null) {
      const plots = JSON.parse(savedPlots);
      if (
        !Array.isArray(plots)
        || plots.some((plot) => (
          !Array.isArray(plot)
          || plot.length !== 4
          || plot.some((value) => typeof value !== 'string')
        ))
      ) {
        throw new Error('Saved plot records have an invalid format.');
      }
      plots
        .filter((plot) => plot[2] !== '—' || plot[3].toLowerCase() === 'assigned')
        .forEach((plot) => trackedPlots.add(plot[0]));
    }
  } catch (error) {
    console.error('Could not load assigned plots for the growth tracker.', error);
    status.textContent = 'Assigned plots could not be loaded. Check the saved plot data.';
    plotSelect.disabled = true;
    return;
  }
  Object.keys(samplePlots).forEach((plotId) => trackedPlots.add(plotId));
  let savedPlots = [];
  try {
    const storedPlots = localStorage.getItem('gardenTrackerAdminRows:plots');
    if (storedPlots !== null) savedPlots = JSON.parse(storedPlots);
  } catch (error) {
    console.error('Could not load plot assignments for the growth tracker labels.', error);
  }

  const plots = [...trackedPlots].sort((first, second) => first.localeCompare(second));
  plots.forEach((plotId) => {
    const option = document.createElement('option');
    option.value = plotId;
    option.textContent = plotId;
    plotSelect.append(option);
  });

  const render = () => {
    const plotId = plotSelect.value;
    const realObservations = observations.filter((observation) => observation.plot === plotId);
    const usingSampleData = realObservations.length === 0 && Boolean(samplePlots[plotId]);
    const plotObservations = (usingSampleData ? samplePlots[plotId].observations : realObservations)
      .sort((first, second) => first.date.localeCompare(second.date)
        || first.submittedAt.localeCompare(second.submittedAt));
    const sample = samplePlots[plotId];
    const savedPlot = savedPlots.find((plot) => plot[0] === plotId);
    const assignedStudent = savedPlot && savedPlot[2] !== '—'
      ? savedPlot[2]
      : sample?.student || 'No student assigned';
    const savedCrop = assignedCrops[plotId];
    const assignedCrop = adminCropOptions.includes(savedCrop)
      ? savedCrop
      : sample?.crop || 'Garden plot';
    plotSummary.hidden = false;
    cropIcon.src = cropIcons[assignedCrop] || sample?.icon || '../images/garden-plot.svg';
    cropIcon.alt = `${assignedCrop} icon`;
    cropName.textContent = `${assignedCrop} · Plot ${plotId}`;
    plotStudent.textContent = `Assigned to ${assignedStudent}`;
    sampleBadge.hidden = !usingSampleData;
    sampleBadge.textContent = usingSampleData ? 'Sample data' : '';
    const measurements = plotObservations.filter((observation) => (
      observation.height !== null
      && !Number.isNaN(new Date(`${observation.date}T00:00:00`).getTime())
    ));

    chart.replaceChildren();
    chart.hidden = measurements.length === 0;
    chartEmpty.hidden = measurements.length > 0;
    if (measurements.length) {
      const width = 760;
      const height = 340;
      const left = 62;
      const right = 24;
      const top = 26;
      const bottom = 58;
      const chartWidth = width - left - right;
      const chartHeight = height - top - bottom;
      const maxValue = Math.max(5, Math.ceil(Math.max(...measurements.map((item) => item.height)) / 5) * 5);
      const pointX = (index) => measurements.length === 1
        ? left + chartWidth / 2
        : left + (chartWidth * index) / (measurements.length - 1);
      const pointY = (value) => top + chartHeight - (value / maxValue) * chartHeight;

      chart.setAttribute('viewBox', `0 0 ${width} ${height}`);
      chart.setAttribute(
        'aria-label',
        `Plant height for plot ${plotId} over ${measurements.length} measurements, from ${measurements[0].height} to ${measurements[measurements.length - 1].height} centimeters.`
      );

      for (let tick = 0; tick <= 4; tick += 1) {
        const value = (maxValue * tick) / 4;
        const y = pointY(value);
        chart.append(createSvgElement('line', {
          x1: left,
          y1: y,
          x2: width - right,
          y2: y,
          class: 'growth-chart-gridline',
        }));
        const label = createSvgElement('text', {
          x: left - 12,
          y: y + 4,
          'text-anchor': 'end',
          class: 'growth-chart-label',
        });
        label.textContent = Number.isInteger(value) ? String(value) : value.toFixed(1);
        chart.append(label);
      }

      const verticalLabel = createSvgElement('text', {
        x: 18,
        y: top + chartHeight / 2,
        transform: `rotate(-90 18 ${top + chartHeight / 2})`,
        'text-anchor': 'middle',
        class: 'growth-chart-axis-title',
      });
      verticalLabel.textContent = 'Plant height (cm)';
      chart.append(verticalLabel);

      chart.append(createSvgElement('line', {
        x1: left,
        y1: top + chartHeight,
        x2: width - right,
        y2: top + chartHeight,
        class: 'growth-chart-axis',
      }));

      const pathData = measurements
        .map((item, index) => `${index === 0 ? 'M' : 'L'} ${pointX(index)} ${pointY(item.height)}`)
        .join(' ');
      chart.append(createSvgElement('path', {
        d: pathData,
        class: 'growth-chart-line',
      }));

      measurements.forEach((item, index) => {
        const x = pointX(index);
        const y = pointY(item.height);
        const circle = createSvgElement('circle', {
          cx: x,
          cy: y,
          r: 6,
          class: 'growth-chart-point',
        });
        const tooltip = createSvgElement('title');
        tooltip.textContent = `${formatDate(item.date)}: ${item.height} cm`;
        circle.append(tooltip);
        chart.append(circle);

        const labelInterval = Math.max(1, Math.ceil((measurements.length - 1) / 5));
        if (index % labelInterval !== 0 && index !== measurements.length - 1) return;
        const dateLabel = createSvgElement('text', {
          x,
          y: height - 28,
          'text-anchor': 'middle',
          class: 'growth-chart-label',
        });
        dateLabel.textContent = new Intl.DateTimeFormat(undefined, {
          month: 'short',
          day: 'numeric',
        }).format(new Date(`${item.date}T00:00:00`));
        chart.append(dateLabel);
      });

      const firstHeight = measurements[0].height;
      const latestHeight = measurements[measurements.length - 1].height;
      const difference = latestHeight - firstHeight;
      summary.textContent = measurements.length > 1
        ? `Latest: ${latestHeight} cm · Change since first measurement: ${difference > 0 ? '+' : ''}${difference.toFixed(1)} cm`
        : `Latest recorded height: ${latestHeight} cm`;
    } else {
      chart.removeAttribute('aria-label');
      summary.textContent = '';
    }

    chartEmpty.textContent = plotObservations.length
      ? 'No plant-height measurements recorded for this plot yet. Height measurements will appear here as the chart fills in.'
      : 'Submit observations for this plot to start its growth chart.';
    observationList.replaceChildren();
    [...plotObservations].reverse().forEach((observation) => {
      const item = document.createElement('li');
      item.className = 'growth-observation';
      const header = document.createElement('div');
      header.className = 'growth-observation-header';
      const date = document.createElement('time');
      date.dateTime = observation.date;
      date.textContent = formatDate(observation.date);
      const condition = document.createElement('span');
      condition.className = `badge ${
        observation.condition === 'healthy'
          ? 'badge-success'
          : observation.condition === 'needs-attention'
            ? 'badge-warning'
            : 'badge-danger'
      }`;
      condition.textContent = observation.condition.replace(/-/g, ' ');
      header.append(date, condition);
      if (observation.isSample) {
        const sampleTag = document.createElement('span');
        sampleTag.className = 'growth-observation-sample';
        sampleTag.textContent = 'Example';
        header.append(sampleTag);
      }

      const details = document.createElement('p');
      const readings = [];
      if (observation.height !== null) readings.push(`${observation.height} cm tall`);
      if (observation.weather) readings.push(`Weather: ${observation.weather.replace(/-/g, ' ')}`);
      if (observation.soil) readings.push(`Soil: ${observation.soil}`);
      details.textContent = readings.join(' · ');

      const notes = document.createElement('p');
      notes.className = 'growth-observation-notes';
      notes.textContent = observation.notes || 'No notable changes noted.';
      const submittedBy = document.createElement('p');
      submittedBy.className = 'growth-observation-student';
      submittedBy.textContent = `Recorded by ${observation.student}`;
      item.append(header);
      if (details.textContent) item.append(details);
      item.append(notes, submittedBy);
      observationList.append(item);
    });
    observationEmpty.hidden = plotObservations.length > 0;
    if (plotObservations.length) {
      status.textContent = `${plotObservations.length} observation${plotObservations.length === 1 ? '' : 's'} for plot ${plotId}.`;
    } else {
      status.textContent = `No observations have been recorded for plot ${plotId} yet.`;
    }
  };

  if (plots.length) {
    plotSelect.value = plots[0];
    render();
  } else {
    plotSelect.disabled = true;
    chart.hidden = true;
    chartEmpty.hidden = false;
    chartEmpty.textContent = 'No assigned plots or observations are available yet.';
    observationEmpty.hidden = false;
    summary.textContent = '';
    status.textContent = '';
  }
  plotSelect.addEventListener('change', render);
}

function markActiveSidebarLink() {
  const current = location.pathname.split('/').pop();
  document.querySelectorAll('.admin-sidebar a').forEach((link) => {
    const href = link.getAttribute('href');
    if (href && href === current) link.classList.add('active');
  });
}
