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

function setupStudentObservationForm() {
  const form = document.querySelector('.observation-form');
  const photoInput = document.getElementById('observation-photo');
  const photoPreview = form?.querySelector('[data-observation-photo-preview]');
  const photoLabel = form?.querySelector('[data-observation-photo-label]');
  const message = form?.querySelector('[data-observation-submit-message]');
  const submitButton = form?.querySelector('[type="submit"]');
  if (!form || !photoInput || !photoPreview || !photoLabel || !message || !submitButton) return;

  let previewUrl = null;
  const clearPreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = null;
    photoPreview.hidden = true;
    photoPreview.removeAttribute('src');
    photoLabel.textContent = 'Click to upload a photo of your plant';
  };

  photoInput.addEventListener('change', () => {
    const file = photoInput.files?.[0];
    setMessage(message, '');
    if (!file) {
      clearPreview();
      return;
    }

    if (!file.type.startsWith('image/')) {
      photoInput.value = '';
      clearPreview();
      setMessage(message, 'Choose a valid image file.');
      return;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = URL.createObjectURL(file);
    photoPreview.src = previewUrl;
    photoPreview.hidden = false;
    photoLabel.textContent = 'Selected photo (click to change)';
  });

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
