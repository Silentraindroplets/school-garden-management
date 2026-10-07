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
    const student = document.getElementById('student')?.value.trim();
    const plot = document.getElementById('plot')?.value.trim();
    const feedback = form.querySelector('[data-assign-plot-status]');

    if (!student || !plot || student === 'Select Student' || plot === 'Select Available Plot') {
      if (feedback) feedback.textContent = 'Select both a student and an available plot.';
      return;
    }

    document.dispatchEvent(new CustomEvent('admin:assign-plot', {
      detail: { student, plot },
    }));
    if (feedback) feedback.textContent = '';
    form.reset();
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
    const data = new FormData(form);
    document.dispatchEvent(new CustomEvent('admin:add-student', {
      detail: {
        name: String(data.get('name') || '').trim(),
        grade: String(data.get('grade') || '').trim(),
        plot: String(data.get('plot') || '').trim() || '—',
        status: String(data.get('status') || 'Active').trim(),
      },
    }));
    form.reset();
    close();
  });
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

  const headings = Array.from(table.tHead.rows[0].cells)
    .slice(0, -1)
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
  const initialRows = Array.from(tbody.querySelectorAll(`tr.${config.rowClass}`));
  let records = initialRows.map((row) =>
    Array.from(row.cells).slice(0, -1).map((cell) => cell.textContent.trim())
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
      record.forEach((value) => {
        const cell = document.createElement('td');
        cell.textContent = value;
        row.append(cell);
      });

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
  };

  const openRecordDialog = (action, index, trigger) => {
    const record = records[index];
    if (!record) return;

    if (action === 'delete') {
      if (!window.confirm(`Delete this ${config.entity}? This cannot be undone.`)) return;
      const updated = records.filter((_, recordIndex) => recordIndex !== index);
      if (saveRecords(updated)) {
        render();
        showStatus(`${config.entity[0].toUpperCase()}${config.entity.slice(1)} deleted.`);
      }
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
      dialog.append(details);
    } else {
      const form = document.createElement('form');
      form.className = 'admin-record-form';
      headings.forEach((heading, fieldIndex) => {
        const group = document.createElement('div');
        group.className = 'form-group';
        const id = `admin-record-field-${fieldIndex}`;
        const label = document.createElement('label');
        label.htmlFor = id;
        label.textContent = heading;
        const input = document.createElement(
          config.entity === 'observation' && heading.toLowerCase() === 'observation'
            ? 'textarea'
            : 'input'
        );
        input.id = id;
        input.name = `field-${fieldIndex}`;
        input.value = record[fieldIndex];
        input.required = true;
        group.append(label, input);
        form.append(group);
      });

      const teacherNoteInput = config.key === 'plots'
        ? document.createElement('textarea')
        : null;
      const dialogStatus = document.createElement('p');
      dialogStatus.className = 'admin-action-status';
      dialogStatus.setAttribute('role', 'status');
      dialogStatus.setAttribute('aria-live', 'polite');
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
        form.append(dialogStatus);
      }

      const saveButton = document.createElement('button');
      saveButton.type = 'submit';
      saveButton.className = 'btn btn-primary';
      saveButton.textContent = 'Save changes';
      form.append(saveButton);
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        const updatedRecord = headings.map((_, fieldIndex) =>
          String(new FormData(form).get(`field-${fieldIndex}`) || '').trim()
        );
        const updated = records.map((item, recordIndex) =>
          recordIndex === index ? updatedRecord : item
        );

        let previousNotes;
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
            localStorage.setItem(teacherNotesKey, JSON.stringify(nextNotes));
          } catch (error) {
            console.error('Could not save the teacher note for this plot.', error);
            dialogStatus.textContent = 'Teacher note could not be saved. Please try again.';
            return;
          }
        }

        if (saveRecords(updated)) {
          render();
          showStatus(`${config.entity[0].toUpperCase()}${config.entity.slice(1)} updated.`);
          close();
        } else if (teacherNoteInput) {
          dialogStatus.textContent = status.textContent;
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

  document.addEventListener('admin:add-student', (event) => {
    if (config.key !== 'students') return;
    const { name, grade, plot, status: studentStatus } = event.detail;
    const nextId = records.reduce((next, record) => {
      const match = record[0].match(/^STU-(\d+)$/);
      return match ? Math.max(next, Number(match[1]) + 1) : next;
    }, 1);
    const updated = [...records, [
      `STU-${String(nextId).padStart(3, '0')}`,
      name,
      grade,
      plot,
      studentStatus,
    ]];
    if (saveRecords(updated)) {
      render();
      showStatus('Student added.');
    }
  });

  document.addEventListener('admin:assign-plot', (event) => {
    if (config.key !== 'plots') return;
    const { student, plot } = event.detail;
    const plotIndex = records.findIndex((record) => record[0] === plot);
    const updated = records.map((record, index) => {
      if (index !== plotIndex) return record;
      const next = [...record];
      next[2] = student;
      next[3] = 'Assigned';
      return next;
    });
    if (plotIndex === -1) updated.push([plot, 'School Garden', student, 'Assigned']);
    if (saveRecords(updated)) {
      render();
      showStatus(`Plot ${plot} assigned to ${student}.`);
    }
  });

  render();
}

function markActiveSidebarLink() {
  const current = location.pathname.split('/').pop();
  document.querySelectorAll('.admin-sidebar a').forEach((link) => {
    const href = link.getAttribute('href');
    if (href && href === current) link.classList.add('active');
  });
}
