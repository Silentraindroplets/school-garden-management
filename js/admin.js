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

      return !['create', 'update', 'delete', 'assign'].includes(entry.action)
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
    if (!document.querySelector('.modal-overlay')) {
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
            render();
            showStatus(`${config.entity[0].toUpperCase()}${config.entity.slice(1)} moved to the archive.`);
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

            let previousNotes = null;
            let previousTeacherNotes = null;
            let updatedTeacherNotes = null;
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

            const historyEntry = {
              id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
              key: config.key,
              entity: config.entity,
              action: 'update',
              beforeRecord: [...record],
              afterRecord: updatedRecord,
              index,
              createdAt: new Date().toISOString(),
            };
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
            } catch (error) {
              console.error('Could not save the teacher note for this plot.', error);
              try {
                removeAdminHistoryEntry(historyEntry.id);
              } catch (rollbackError) {
                console.error('Could not remove the failed edit from action history.', rollbackError);
              }
              dialogStatus.textContent = 'Teacher note could not be saved. No changes were made.';
              return;
            }

            if (saveRecords(updated)) {
              render();
              showStatus(`${config.entity[0].toUpperCase()}${config.entity.slice(1)} updated.`);
              close();
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
    const studentRecord = updated[updated.length - 1];
    const historyEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      key: config.key,
      entity: config.entity,
      action: 'create',
      beforeRecord: null,
      afterRecord: studentRecord,
      index: records.length,
      createdAt: new Date().toISOString(),
    };
    if (!appendAdminHistory(historyEntry)) {
      showStatus('Could not save the student creation to action history. No changes were made.');
      return;
    }
    if (saveRecords(updated)) {
      render();
      showStatus('Student added.');
    } else {
      try {
        removeAdminHistoryEntry(historyEntry.id);
      } catch (error) {
        console.error('Could not remove the failed student creation from action history.', error);
      }
    }
  });

  document.addEventListener('admin:assign-plot', (event) => {
    if (config.key !== 'plots') return;
    const { student, plot } = event.detail;
    const plotIndex = records.findIndex((record) => record[0] === plot);
    const previousRecord = plotIndex === -1 ? null : [...records[plotIndex]];
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
    if (saveRecords(updated)) {
      render();
      showStatus(`Plot ${plot} assigned to ${student}.`);
    } else {
      try {
        removeAdminHistoryEntry(historyEntry.id);
      } catch (error) {
        console.error('Could not remove the failed plot assignment from action history.', error);
      }
    }
  });

  render();
}

function setupAdminArchivePage() {
  const tbody = document.querySelector('[data-archive-records]');
  if (!tbody) return;

  const status = document.querySelector('[data-archive-status]');
  const emptyState = document.querySelector('[data-archive-empty]');

  const showStatus = (message) => {
    status.textContent = message;
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
      const entityCell = document.createElement('td');
      entityCell.textContent = `${entry.entity[0].toUpperCase()}${entry.entity.slice(1)}`;
      const recordCell = document.createElement('td');
      const before = entry.beforeRecord?.join(' · ');
      const after = entry.afterRecord?.join(' · ');
      recordCell.textContent = before && after
        ? `${before} → ${after}`
        : before || after;
      const actionCellType = document.createElement('td');
      const actionNames = {
        create: 'Added',
        update: 'Edited',
        delete: 'Deleted',
        assign: 'Plot assigned',
      };
      actionCellType.textContent = actionNames[entry.action];
      const dateCell = document.createElement('td');
      const actionDate = new Date(entry.createdAt);
      dateCell.textContent = Number.isNaN(actionDate.getTime())
        ? 'Unknown date'
        : actionDate.toLocaleString();
      const actionCell = document.createElement('td');
      const undoButton = document.createElement('button');
      undoButton.type = 'button';
      undoButton.className = 'btn btn-primary';
      undoButton.dataset.undoHistoryEntry = entry.id;
      undoButton.textContent = 'Undo';
      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.className = 'btn btn-danger';
      deleteButton.dataset.deleteHistoryEntry = entry.id;
      deleteButton.textContent = 'Delete';
      const actions = document.createElement('div');
      actions.className = 'archive-actions';
      actions.append(undoButton, deleteButton);
      actionCell.append(actions);
      row.append(entityCell, actionCellType, recordCell, dateCell, actionCell);
      tbody.append(row);
    });

    emptyState.hidden = history.length > 0;
    showStatus(history.length ? `${history.length} action${history.length === 1 ? '' : 's'} in history.` : '');
  };

  tbody.addEventListener('click', (event) => {
    const undoButton = event.target.closest('[data-undo-history-entry]');
    const deleteButton = event.target.closest('[data-delete-history-entry]');
    if (!undoButton && !deleteButton) return;

    let history;
    try {
      history = readAdminArchive();
    } catch (error) {
      console.error('Could not read admin action history.', error);
      showStatus('Action history could not be read. No records were changed.');
      return;
    }

    const button = undoButton || deleteButton;
    const historyIndex = history.findIndex((entry) => entry.id === button.dataset.undoHistoryEntry
      || entry.id === button.dataset.deleteHistoryEntry);
    const rawEntry = history[historyIndex];
    if (!rawEntry) {
      showStatus('This history entry is no longer available. Refresh the page and try again.');
      render();
      return;
    }

    const entry = normalizeAdminHistoryEntry(rawEntry);
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
        if (previousHistory === null) localStorage.removeItem(adminArchiveStorageKey);
        else localStorage.setItem(adminArchiveStorageKey, previousHistory);
      } catch (rollbackError) {
        console.error(`Could not roll back the ${entry.entity} action after undo failed.`, rollbackError);
      }
      showStatus('Could not undo this action. Please try again.');
      return;
    }

    render();
    showStatus(`${entry.entity[0].toUpperCase()}${entry.entity.slice(1)} action undone.`);
      },
    });
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
