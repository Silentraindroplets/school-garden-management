const growthObservationsStorageKey = 'gardenTrackerGrowthObservations';

function setupStudentNotifications() {
  const panel = document.querySelector('[data-student-notifications]');
  const list = panel?.querySelector('[data-notification-list]');
  const count = panel?.querySelector('[data-notification-count]');
  const empty = panel?.querySelector('[data-notification-empty]');
  const status = panel?.querySelector('[data-notification-status]');
  const markAllButton = panel?.querySelector('[data-notification-mark-all]');
  if (!panel || !list || !count || !empty || !status || !markAllButton) return;

  const account = getAccounts().find(
    (item) => item.username === localStorage.getItem(currentUserStorageKey)
  );
  const username = account?.role === 'Student' ? account.username : null;
  let notifications = [];

  const render = () => {
    const unreadCount = notifications.filter((notification) => !notification.read).length;
    count.textContent = unreadCount > 0 ? String(unreadCount) : '';
    count.hidden = unreadCount === 0;
    count.setAttribute('aria-label', `${unreadCount} unread notifications`);
    markAllButton.disabled = unreadCount === 0;
    empty.hidden = notifications.length > 0;
    list.replaceChildren();

    notifications.forEach((notification) => {
      const item = document.createElement('li');
      item.className = notification.read
        ? 'student-notification'
        : 'student-notification is-unread';

      const button = document.createElement('button');
      button.className = 'student-notification-content';
      button.type = 'button';
      button.dataset.notificationId = notification.id;
      button.setAttribute(
        'aria-label',
        `${notification.read ? '' : 'Unread: '}${notification.title}. ${notification.message}`
      );

      const title = document.createElement('strong');
      title.textContent = notification.title;
      const message = document.createElement('span');
      message.textContent = notification.message;
      const date = document.createElement('time');
      const createdAt = new Date(notification.createdAt);
      if (!Number.isNaN(createdAt.getTime())) {
        date.dateTime = createdAt.toISOString();
        date.textContent = new Intl.DateTimeFormat(undefined, {
          dateStyle: 'medium',
          timeStyle: 'short',
        }).format(createdAt);
      }

      button.append(title, message, date);
      item.append(button);
      list.append(item);
    });
  };

  const updateStoredNotifications = (update) => {
    try {
      const stored = JSON.parse(localStorage.getItem(notificationsStorageKey) || '[]');
      if (!Array.isArray(stored)) {
        throw new Error('Stored notifications are not in a valid format.');
      }

      const updated = update(stored);
      localStorage.setItem(notificationsStorageKey, JSON.stringify(updated));
      notifications = username
        ? updated.filter((notification) => notification.username === username)
        : [];
      status.textContent = '';
      render();
    } catch (error) {
      console.error('Could not update student notifications.', error);
      status.textContent = 'Notifications could not be updated. Please try again.';
    }
  };

  try {
    const stored = JSON.parse(localStorage.getItem(notificationsStorageKey) || '[]');
    if (!Array.isArray(stored)) {
      throw new Error('Stored notifications are not in a valid format.');
    }
    notifications = username
      ? stored.filter((notification) => notification.username === username)
      : [];
    render();
  } catch (error) {
    console.error('Could not load student notifications.', error);
    status.textContent = 'Notifications could not be loaded.';
  }

  panel.addEventListener('click', (event) => {
    if (!username) return;
    const target = event.target;
    if (!(target instanceof Element)) return;

    const notificationButton = target.closest('[data-notification-id]');
    if (notificationButton) {
      const notificationId = notificationButton.dataset.notificationId;
      updateStoredNotifications((stored) => stored.map((notification) => (
        notification.username === username && notification.id === notificationId
          ? { ...notification, read: true }
          : notification
      )));
      return;
    }

    if (target.closest('[data-notification-mark-all]')) {
      updateStoredNotifications((stored) => stored.map((notification) => (
        notification.username === username
          ? { ...notification, read: true }
          : notification
      )));
    }
  });
}

function setupDashboard() {
  const lastObservation = document.querySelector('[data-stat="last-observation"]');
  const observationCount = document.querySelector('[data-stat="submitted-observations"]');
  const status = document.querySelector('[data-student-dashboard-status]');
  const plotLabel = document.querySelector('[data-dashboard-plot]');
  const plotSummary = document.querySelector('[data-dashboard-plot-summary]');
  if (!lastObservation || !observationCount) return;
  if (status) status.textContent = '';

  try {
    const stored = localStorage.getItem(growthObservationsStorageKey);
    const observations = stored === null ? [] : JSON.parse(stored);
    if (!Array.isArray(observations) || observations.some((observation) => (
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
      || Number.isNaN(new Date(`${observation.date}T00:00:00`).getTime())
      || Number.isNaN(new Date(observation.submittedAt).getTime())
    ))) {
      throw new Error('Saved growth observations have an invalid format.');
    }

    const username = localStorage.getItem(currentUserStorageKey);
    const account = getAccounts().find(
      (item) => item.username === username && item.role === 'Student'
    );
    const studentObservations = account
      ? observations
        .filter((observation) => observation.student === account.fullName)
        .sort((first, second) => first.date.localeCompare(second.date)
          || first.submittedAt.localeCompare(second.submittedAt))
      : [];

    observationCount.textContent = String(studentObservations.length);
    const latestObservation = studentObservations[studentObservations.length - 1];
    if (latestObservation) {
      const date = new Date(`${latestObservation.date}T00:00:00`);
      lastObservation.textContent = Number.isNaN(date.getTime())
        ? '—'
        : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
    } else {
      lastObservation.textContent = '—';
    }

    let assignedPlot = '';
    if (account) {
      try {
        assignedPlot = getAssignedPlotForStudent(account, '');
      } catch (error) {
        console.error('Could not load the student dashboard plot assignment.', error);
        if (status) status.textContent = 'Your plot assignment could not be loaded.';
      }
    }

    if (plotLabel) plotLabel.textContent = assignedPlot
      ? `Garden Plot ${assignedPlot}`
      : 'No plot assigned';
    if (plotSummary) plotSummary.textContent = assignedPlot || 'No plot assigned';
  } catch (error) {
    console.error('Could not load dashboard observations.', error);
    if (status) status.textContent = 'Your observation summary could not be loaded.';
  }
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

function optimizeObservationPhoto(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const maxDimension = 1600;
      const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext('2d');

      if (!context) {
        reject(new Error('Could not prepare the selected photo.'));
        return;
      }

      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('The selected photo could not be read.'));
    };
    image.src = objectUrl;
  });
}

function getAssignedPlotForStudent(account, fallbackPlot) {
  let assignedPlot = fallbackPlot;
  const savedStudents = localStorage.getItem('gardenTrackerAdminRows:students');
  if (savedStudents !== null) {
    const students = JSON.parse(savedStudents);
    if (
      !Array.isArray(students)
      || students.some((student) => (
        !Array.isArray(student)
        || student.length !== 5
        || student.some((value) => typeof value !== 'string')
      ))
    ) {
      throw new Error('Saved student records have an invalid format.');
    }
    const student = students.find((record) => record[1] === account.fullName);
    assignedPlot = student
      ? (student[3] !== '—' ? student[3] : '')
      : fallbackPlot;
  }

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
    const plot = plots.find((record) =>
      record[2] === account.fullName && record[3].toLowerCase() === 'assigned'
    );
    if (plot) assignedPlot = plot[0];
  }
  return assignedPlot;
}

function setupStudentObservationForm() {
  const form = document.querySelector('.observation-form');
  const photoInput = document.getElementById('observation-photo');
  const photoPreview = form?.querySelector('[data-observation-photo-preview]');
  const photoSelectButton = form?.querySelector('[data-observation-photo-select]');
  const photoSelection = form?.querySelector('[data-observation-photo-selection]');
  const photoName = form?.querySelector('[data-observation-photo-name]');
  const photoSize = form?.querySelector('[data-observation-photo-size]');
  const photoStatus = form?.querySelector('[data-observation-photo-status]');
  const photoRemoveButton = form?.querySelector('[data-observation-photo-remove]');
  const message = form?.querySelector('[data-observation-submit-message]');
  const submitButton = form?.querySelector('[type="submit"]');
  const plotLabel = form?.closest('[data-observation-plot]')?.querySelector('[data-observation-plot-label]');
  if (
    !form
    || !photoInput
    || !photoPreview
    || !photoSelectButton
    || !photoSelection
    || !photoName
    || !photoSize
    || !photoStatus
    || !photoRemoveButton
    || !message
    || !submitButton
  ) return;

  let previewUrl = null;
  const clearPreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = null;
    photoPreview.hidden = true;
    photoPreview.removeAttribute('src');
    photoName.textContent = '';
    photoSize.textContent = '';
    photoSelection.hidden = true;
    photoSelectButton.textContent = 'Choose Photo';
  };

  photoSelectButton.addEventListener('click', () => photoInput.click());
  photoRemoveButton.addEventListener('click', () => {
    photoInput.value = '';
    clearPreview();
    photoStatus.textContent = '';
    photoSelectButton.focus();
  });
  photoInput.addEventListener('change', () => {
    const file = photoInput.files?.[0];
    setMessage(message, '');
    photoStatus.textContent = '';
    if (!file) {
      clearPreview();
      return;
    }

    if (!file.type.startsWith('image/')) {
      photoInput.value = '';
      clearPreview();
      photoStatus.textContent = 'Choose a valid image file.';
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      photoInput.value = '';
      clearPreview();
      photoStatus.textContent = 'This photo is larger than 10 MB. Choose a smaller image.';
      return;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = URL.createObjectURL(file);
    photoPreview.src = previewUrl;
    photoPreview.hidden = false;
    photoName.textContent = file.name;
    photoSize.textContent = `${(file.size / (1024 * 1024)).toFixed(2)} MB`;
    photoSelection.hidden = false;
    photoSelectButton.textContent = 'Change Photo';
  });

  const signedInAccount = getAccounts().find(
    (item) => item.username === localStorage.getItem(currentUserStorageKey)
      && item.role === 'Student'
  );
  if (plotLabel && signedInAccount) {
    try {
      const assignedPlot = getAssignedPlotForStudent(
        signedInAccount,
        form.closest('[data-observation-plot]')?.dataset.observationPlot || ''
      );
      plotLabel.textContent = assignedPlot
        ? `Submit your observation for Plot ${assignedPlot}.`
        : 'An assigned plot is required before submitting an observation.';
    } catch (error) {
      console.error('Could not display the assigned plot for this observation.', error);
      plotLabel.textContent = 'Your assigned plot could not be loaded.';
    }
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!window.confirm('Are you sure you want to submit this observation?')) return;

    const username = localStorage.getItem(currentUserStorageKey);
    const account = getAccounts().find(
      (item) => item.username === username && item.role === 'Student'
    );
    if (!account) {
      setMessage(message, 'Sign in to a student account before submitting an observation.');
      return;
    }

    const fallbackPlot = form.closest('[data-observation-plot]')?.dataset.observationPlot || '';
    let assignedPlot;
    try {
      assignedPlot = getAssignedPlotForStudent(account, fallbackPlot);
    } catch (error) {
      console.error('Could not resolve the assigned plot for this observation.', error);
      setMessage(message, 'Your assigned plot could not be loaded. Please contact your administrator.');
      return;
    }
    if (!assignedPlot) {
      setMessage(message, 'An assigned plot is required before submitting an observation.');
      return;
    }
    if (plotLabel) plotLabel.textContent = `Submitting an observation for Plot ${assignedPlot}.`;

    submitButton.disabled = true;
    setMessage(message, 'Submitting observation...');
    try {
      const file = photoInput.files?.[0];
      if (file) {
        const photo = await optimizeObservationPhoto(file);
        localStorage.setItem(
          `${plotPhotoStoragePrefix}${username}`,
          JSON.stringify({
            photo,
            observationDate: document.getElementById('observation-date').value,
            submittedAt: new Date().toISOString(),
          })
        );
      }

      const heightValue = document.getElementById('plant-height').value;
      const height = heightValue === '' ? null : Number(heightValue);
      if (height !== null && (!Number.isFinite(height) || height < 0)) {
        throw new Error('Plant height must be a non-negative number.');
      }
      const storedObservations = JSON.parse(
        localStorage.getItem(growthObservationsStorageKey) || '[]'
      );
      if (
        !Array.isArray(storedObservations)
        || storedObservations.some((observation) => (
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
      storedObservations.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        plot: assignedPlot,
        student: account.fullName,
        date: document.getElementById('observation-date').value,
        height,
        weather: document.getElementById('weather-condition').value,
        soil: document.getElementById('soil-condition').value,
        condition: document.getElementById('plant-condition').value,
        notes: document.getElementById('observation').value.trim(),
        submittedAt: new Date().toISOString(),
      });
      localStorage.setItem(growthObservationsStorageKey, JSON.stringify(storedObservations));

      setMessage(
        message,
        file
          ? 'Observation submitted. Your plot photo has been updated.'
          : 'Observation submitted successfully.',
        true
      );
    } catch (error) {
      console.error('Could not submit the student observation.', error);
      setMessage(message, 'Unable to submit the observation. Please try again.');
    } finally {
      submitButton.disabled = false;
    }
  });
}

function setupPlotPhoto() {
  const photoElement = document.querySelector('[data-plot-photo]');
  const dateElement = document.querySelector('[data-plot-photo-date]');
  const username = localStorage.getItem(currentUserStorageKey);
  if (!photoElement || !username) return;

  const savedPhoto = localStorage.getItem(`${plotPhotoStoragePrefix}${username}`);
  if (!savedPhoto) return;

  try {
    const photoData = JSON.parse(savedPhoto);
    if (typeof photoData.photo !== 'string' || !photoData.photo.startsWith('data:image/')) {
      throw new Error('Stored plot photo is not a valid image.');
    }
    photoElement.src = photoData.photo;
    if (dateElement && photoData.observationDate) {
      dateElement.textContent = new Date(`${photoData.observationDate}T00:00:00`)
        .toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    }
  } catch (error) {
    console.error('Could not load the saved plot photo.', error);
  }
}

function setupTeacherNotesDisplay() {
  const section = document.querySelector('[data-teacher-notes]');
  const textElement = section?.querySelector('[data-teacher-note-text]');
  const authorElement = section?.querySelector('[data-teacher-note-author]');
  const dateElement = section?.querySelector('[data-teacher-note-date]');
  if (!section || !textElement || !authorElement || !dateElement) return;

  try {
    let plotId = section.dataset.plotId;
    const username = localStorage.getItem('gardenTrackerCurrentUser');
    const account = getAccounts().find((entry) => entry.username === username);
    const studentName = account?.fullName;
    const savedStudents = localStorage.getItem('gardenTrackerAdminRows:students');
    if (studentName && savedStudents) {
      const students = JSON.parse(savedStudents);
      if (!Array.isArray(students)) {
        throw new Error('Stored student records are not in a valid format.');
      }
      const student = students.find((entry) => entry[1] === studentName);
      if (student && typeof student[3] === 'string' && student[3] !== '—') {
        plotId = student[3];
        section.dataset.plotId = plotId;
        const plotIdElement = document.querySelector('[data-student-plot-id]');
        if (plotIdElement) plotIdElement.textContent = plotId;
      }
    }

    const notes = JSON.parse(localStorage.getItem('gardenTrackerTeacherNotes') || '[]');
    if (!Array.isArray(notes)) {
      throw new Error('Stored teacher notes are not in a valid format.');
    }

    const note = notes.find((entry) => entry.plotId === plotId);
    if (!note) return;
    if (
      typeof note.text !== 'string'
      || typeof note.author !== 'string'
      || typeof note.updatedAt !== 'string'
    ) {
      throw new Error('Stored teacher note is not in a valid format.');
    }

    const updatedAt = new Date(note.updatedAt);
    if (Number.isNaN(updatedAt.getTime())) {
      throw new Error('Stored teacher note has an invalid update date.');
    }
    textElement.textContent = note.text;
    authorElement.textContent = note.author;
    dateElement.dateTime = updatedAt.toISOString();
    dateElement.textContent = new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(updatedAt);
  } catch (error) {
    console.error('Could not load the latest teacher note.', error);
  }
}
