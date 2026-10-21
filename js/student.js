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

  const isValidNotification = (notification) => (
    Boolean(notification)
    && typeof notification.id === 'string'
    && typeof notification.username === 'string'
    && typeof notification.title === 'string'
    && typeof notification.message === 'string'
    && typeof notification.createdAt === 'string'
    && !Number.isNaN(new Date(notification.createdAt).getTime())
    && typeof notification.read === 'boolean'
  );

  const loadNotifications = () => {
    const stored = JSON.parse(localStorage.getItem(notificationsStorageKey) || '[]');
    if (!Array.isArray(stored) || stored.some((notification) => !isValidNotification(notification))) {
      throw new Error('Stored notifications are not in a valid format.');
    }
    notifications = username
      ? stored.filter((notification) => notification.username === username)
      : [];
    status.textContent = '';
    render();
  };

  const updateStoredNotifications = (update) => {
    try {
      const stored = JSON.parse(localStorage.getItem(notificationsStorageKey) || '[]');
      if (!Array.isArray(stored) || stored.some((notification) => !isValidNotification(notification))) {
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
    loadNotifications();
  } catch (error) {
    console.error('Could not load student notifications.', error);
    status.textContent = 'Notifications could not be loaded.';
  }

  window.addEventListener('storage', (event) => {
    if (event.key !== notificationsStorageKey) return;
    try {
      loadNotifications();
    } catch (error) {
      console.error('Could not refresh student notifications.', error);
      status.textContent = 'Notifications could not be refreshed.';
    }
  });

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
        .filter((observation) => normalizeStudentName(observation.student) === normalizeStudentName(account.fullName))
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

    const cropIcon = document.querySelector('[data-dashboard-crop-icon]');
    if (cropIcon && assignedPlot) {
      try {
        const crops = JSON.parse(localStorage.getItem('gardenTrackerPlotCrops') || '{}');
        if (
          !crops
          || Array.isArray(crops)
          || typeof crops !== 'object'
          || Object.values(crops).some((crop) => typeof crop !== 'string')
        ) {
          throw new Error('Saved plot crops have an invalid format.');
        }
        const icons = {
          Tomato: '../images/tomato.svg',
          Radish: '../images/radish.svg',
          Carrot: '../images/carrot.svg',
        };
        cropIcon.src = icons[crops[assignedPlot]] || '../images/garden-plot.svg';
      } catch (error) {
        console.error('Could not load the crop icon for the student dashboard.', error);
      }
    }
  } catch (error) {
    console.error('Could not load dashboard observations.', error);
    if (status) status.textContent = 'Your observation summary could not be loaded.';
  }
}

function setupObservationLog() {
  const modal   = document.querySelector('[data-log-modal]');
  if (!modal) return;
  const logList = document.querySelector('[data-student-observation-logs]');
  const logEmpty = document.querySelector('[data-observation-logs-empty]');
  const logStatus = document.querySelector('[data-observation-logs-status]');

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

  if (logList && logEmpty) {
    try {
      const username = localStorage.getItem(currentUserStorageKey);
      const account = getAccounts().find(
        (item) => item.username === username && item.role === 'Student'
      );
      const stored = JSON.parse(localStorage.getItem(growthObservationsStorageKey) || '[]');
      if (!Array.isArray(stored) || stored.some((observation) => (
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
      ))) {
        throw new Error('Saved growth observations have an invalid format.');
      }

      const crops = JSON.parse(localStorage.getItem('gardenTrackerPlotCrops') || '{}');
      if (
        !crops
        || Array.isArray(crops)
        || typeof crops !== 'object'
        || Object.values(crops).some((crop) => typeof crop !== 'string')
      ) {
        throw new Error('Saved plot crops have an invalid format.');
      }
      const formatLabel = (value) => value
        .replace(/-/g, ' ')
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
      const conditionLabels = {
        healthy: 'Healthy',
        'needs-attention': 'Needs Attention',
        damaged: 'Damaged',
        diseased: 'Diseased',
      };
      const conditionClasses = {
        healthy: 'badge-success',
        'needs-attention': 'badge-warning',
        damaged: 'badge-danger',
        diseased: 'badge-danger',
      };
      const observations = account
        ? stored
          .filter((observation) => (
            normalizeStudentName(observation.student) === normalizeStudentName(account.fullName)
          ))
          .sort((first, second) => second.date.localeCompare(first.date)
            || second.submittedAt.localeCompare(first.submittedAt))
        : [];

      logList.replaceChildren();
      observations.forEach((observation) => {
        const crop = crops[observation.plot] || 'Garden plant';
        const condition = conditionLabels[observation.condition] || observation.condition;
        const article = document.createElement('article');
        article.className = 'log-entry';

        const header = document.createElement('div');
        header.className = 'log-entry-header';
        const titleGroup = document.createElement('div');
        const date = document.createElement('div');
        date.className = 'log-date';
        date.textContent = new Intl.DateTimeFormat(undefined, {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }).format(new Date(`${observation.date}T00:00:00`));
        const title = document.createElement('h3');
        title.textContent = `${condition} ${crop.toLowerCase()} growth`;
        const badge = document.createElement('span');
        badge.className = `badge ${conditionClasses[observation.condition] || 'badge-info'}`;
        badge.textContent = condition;
        titleGroup.append(date, title);
        header.append(titleGroup, badge);

        const meta = document.createElement('ul');
        meta.className = 'log-meta';
        const metaItems = [
          ['Plot', observation.plot],
          ['Height', observation.height === null ? 'Not recorded' : `${observation.height} cm`],
          ['Weather', formatLabel(observation.weather)],
          ['Soil', formatLabel(observation.soil)],
        ];
        metaItems.forEach(([labelText, valueText]) => {
          const item = document.createElement('li');
          const label = document.createElement('span');
          label.className = 'log-meta-label';
          label.textContent = labelText;
          item.append(label, ` ${valueText}`);
          meta.append(item);
        });

        const footer = document.createElement('div');
        footer.className = 'log-entry-footer';
        const summary = document.createElement('p');
        summary.className = 'log-summary';
        summary.textContent = observation.notes || 'No notes were added.';
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'btn btn-secondary log-view-button';
        button.dataset.logOpen = '';
        button.dataset.date = date.textContent;
        button.dataset.title = title.textContent;
        button.dataset.plot = observation.plot;
        button.dataset.plant = crop;
        button.dataset.height = observation.height === null
          ? 'Not recorded'
          : `${observation.height} cm`;
        button.dataset.weather = formatLabel(observation.weather);
        button.dataset.soil = formatLabel(observation.soil);
        button.dataset.condition = condition;
        button.dataset.notes = observation.notes || 'No notes were added.';
        button.textContent = 'View details';
        footer.append(summary, button);
        article.append(header, meta, footer);
        logList.append(article);
      });

      logEmpty.hidden = observations.length > 0;
      if (logStatus) logStatus.textContent = '';
    } catch (error) {
      console.error('Could not load student observation logs.', error);
      logList.replaceChildren();
      logEmpty.hidden = false;
      if (logStatus) logStatus.textContent = 'Observation logs could not be loaded.';
    }
  }

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

function normalizeStudentName(value) {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
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
    const student = students.find((record) => normalizeStudentName(record[1]) === normalizeStudentName(account.fullName));
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
      normalizeStudentName(record[2]) === normalizeStudentName(account.fullName)
      && record[3].toLowerCase() === 'assigned'
    );
    if (plot) assignedPlot = plot[0];
  }
  return assignedPlot;
}

function setupStudentGrowthPreview() {
  const section = document.querySelector('[data-student-growth]');
  const previewChart = section?.querySelector('[data-student-growth-preview]');
  const previewEmpty = section?.querySelector('[data-student-growth-preview-empty]');
  const summary = section?.querySelector('[data-student-growth-summary]');
  const openButton = section?.querySelector('[data-growth-open]');
  const modal = document.querySelector('[data-growth-modal]');
  const closeButton = modal?.querySelector('[data-growth-close]');
  const modalChart = modal?.querySelector('[data-student-growth-chart]');
  const modalEmpty = modal?.querySelector('[data-student-growth-empty]');
  const modalSummary = modal?.querySelector('[data-growth-modal-summary]');
  const modalPlot = modal?.querySelector('[data-growth-modal-plot]');
  if (
    !section
    || !previewChart
    || !previewEmpty
    || !summary
    || !openButton
    || !modal
    || !closeButton
    || !modalChart
    || !modalEmpty
    || !modalSummary
    || !modalPlot
  ) return;

  const renderChart = (chart, measurements, height = 320) => {
    chart.replaceChildren();
    if (!measurements.length) {
      chart.setAttribute('hidden', '');
      return;
    }

    const namespace = 'http://www.w3.org/2000/svg';
    const createElement = (name, attributes = {}) => {
      const element = document.createElementNS(namespace, name);
      Object.entries(attributes).forEach(([key, value]) => {
        element.setAttribute(key, String(value));
      });
      return element;
    };
    const width = 760;
    const left = 58;
    const right = 24;
    const top = 22;
    const bottom = 52;
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
      `Plant height for plot ${measurements[0].plot} across ${measurements.length} measurements.`
    );
    for (let tick = 0; tick <= 4; tick += 1) {
      const value = (maxValue * tick) / 4;
      const y = pointY(value);
      chart.append(createElement('line', {
        x1: left,
        y1: y,
        x2: width - right,
        y2: y,
        class: 'student-growth-gridline',
      }));
      const label = createElement('text', {
        x: left - 10,
        y: y + 4,
        'text-anchor': 'end',
        class: 'student-growth-label',
      });
      label.textContent = Number.isInteger(value) ? String(value) : value.toFixed(1);
      chart.append(label);
    }

    const axisTitle = createElement('text', {
      x: 16,
      y: top + chartHeight / 2,
      transform: `rotate(-90 16 ${top + chartHeight / 2})`,
      'text-anchor': 'middle',
      class: 'student-growth-axis-title',
    });
    axisTitle.textContent = 'Height (cm)';
    chart.append(axisTitle);
    chart.append(createElement('line', {
      x1: left,
      y1: top + chartHeight,
      x2: width - right,
      y2: top + chartHeight,
      class: 'student-growth-axis',
    }));
    chart.append(createElement('path', {
      d: measurements
        .map((item, index) => `${index === 0 ? 'M' : 'L'} ${pointX(index)} ${pointY(item.height)}`)
        .join(' '),
      class: 'student-growth-line',
    }));

    measurements.forEach((item, index) => {
      const point = createElement('circle', {
        cx: pointX(index),
        cy: pointY(item.height),
        r: 6,
        class: 'student-growth-point',
      });
      const tooltip = createElement('title');
      tooltip.textContent = `${new Intl.DateTimeFormat(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }).format(new Date(`${item.date}T00:00:00`))}: ${item.height} cm`;
      point.append(tooltip);
      chart.append(point);

      const labelInterval = Math.max(1, Math.ceil((measurements.length - 1) / 5));
      if (index % labelInterval !== 0 && index !== measurements.length - 1) return;
      const dateLabel = createElement('text', {
        x: pointX(index),
        y: height - 20,
        'text-anchor': 'middle',
        class: 'student-growth-label',
      });
      dateLabel.textContent = new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
      }).format(new Date(`${item.date}T00:00:00`));
      chart.append(dateLabel);
    });
    chart.removeAttribute('hidden');
  };

  let measurements = [];
  let emptyMessage = 'Add plant-height measurements to your observations to start tracking growth.';
  try {
    const username = localStorage.getItem(currentUserStorageKey);
    const account = getAccounts().find(
      (item) => item.username === username && item.role === 'Student'
    );
    const assignedPlot = account
      ? getAssignedPlotForStudent(account, section.dataset.plotId || '')
      : '';
    if (!account) {
      throw new Error('A signed-in student account is required to load plot growth.');
    }
    modalPlot.textContent = assignedPlot ? `Plot ${assignedPlot}` : 'No plot assigned';
    if (!assignedPlot) {
      summary.textContent = 'No plot is assigned to your account yet.';
      modalSummary.textContent = summary.textContent;
      emptyMessage = summary.textContent;
    } else {
      const stored = localStorage.getItem(growthObservationsStorageKey);
      const observations = stored === null ? [] : JSON.parse(stored);
      if (!Array.isArray(observations) || observations.some((observation) => (
        !observation
        || typeof observation.plot !== 'string'
        || typeof observation.student !== 'string'
        || typeof observation.date !== 'string'
        || !(observation.height === null || (
          typeof observation.height === 'number'
          && Number.isFinite(observation.height)
          && observation.height >= 0
        ))
        || typeof observation.submittedAt !== 'string'
        || Number.isNaN(new Date(`${observation.date}T00:00:00`).getTime())
        || Number.isNaN(new Date(observation.submittedAt).getTime())
      ))) {
        throw new Error('Saved growth observations have an invalid format.');
      }

      measurements = observations
        .filter((observation) => observation.plot === assignedPlot
          && normalizeStudentName(observation.student) === normalizeStudentName(account.fullName)
          && observation.height !== null)
        .sort((first, second) => first.date.localeCompare(second.date)
          || first.submittedAt.localeCompare(second.submittedAt));
      if (measurements.length) {
        const latest = measurements[measurements.length - 1];
        summary.textContent = `${measurements.length} measurement${measurements.length === 1 ? '' : 's'} · Latest: ${latest.height} cm`;
      } else {
        summary.textContent = 'No plant-height measurements recorded for this plot yet.';
      }
      modalSummary.textContent = summary.textContent;
    }
  } catch (error) {
    console.error('Could not load student plot growth.', error);
    summary.textContent = 'Plot growth could not be loaded.';
    modalSummary.textContent = summary.textContent;
    emptyMessage = 'The growth chart is unavailable. Please try again later.';
  }

  previewEmpty.textContent = emptyMessage;
  modalEmpty.textContent = emptyMessage;
  const hasMeasurements = measurements.length > 0;
  previewEmpty.hidden = hasMeasurements;
  modalEmpty.hidden = hasMeasurements;
  renderChart(previewChart, measurements, 200);
  renderChart(modalChart, measurements);

  let previouslyFocusedElement;
  const close = () => {
    modal.hidden = true;
    document.body.classList.remove('modal-open');
    previouslyFocusedElement?.focus();
  };
  openButton.addEventListener('click', () => {
    previouslyFocusedElement = document.activeElement;
    modal.hidden = false;
    document.body.classList.add('modal-open');
    closeButton.focus();
  });
  closeButton.addEventListener('click', close);
  modal.addEventListener('click', (event) => {
    if (event.target === modal) close();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !modal.hidden) close();
  });
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

  const confirmationOverlay = document.createElement('div');
  confirmationOverlay.className = 'modal-overlay';
  confirmationOverlay.hidden = true;

  const confirmationDialog = document.createElement('section');
  confirmationDialog.className = 'modal-card observation-confirmation-modal';
  confirmationDialog.setAttribute('role', 'dialog');
  confirmationDialog.setAttribute('aria-modal', 'true');
  confirmationDialog.setAttribute('aria-labelledby', 'observation-confirmation-title');
  confirmationDialog.setAttribute('aria-describedby', 'observation-confirmation-message');

  const confirmationHeader = document.createElement('div');
  confirmationHeader.className = 'modal-header';
  const confirmationTitle = document.createElement('h2');
  confirmationTitle.id = 'observation-confirmation-title';
  confirmationHeader.append(confirmationTitle);

  const confirmationMessage = document.createElement('p');
  confirmationMessage.id = 'observation-confirmation-message';

  const confirmationActions = document.createElement('div');
  confirmationActions.className = 'observation-confirmation-actions';
  const cancelButton = document.createElement('button');
  cancelButton.className = 'btn btn-secondary';
  cancelButton.type = 'button';
  cancelButton.textContent = 'Cancel';
  const confirmButton = document.createElement('button');
  confirmButton.className = 'btn btn-primary';
  confirmButton.type = 'button';
  confirmationActions.append(cancelButton, confirmButton);
  confirmationDialog.append(confirmationHeader, confirmationMessage, confirmationActions);
  confirmationOverlay.append(confirmationDialog);
  document.body.append(confirmationOverlay);

  let finishConfirmation = null;
  const closeConfirmation = (confirmed) => {
    if (!finishConfirmation) return;
    const finish = finishConfirmation;
    finishConfirmation = null;
    confirmationOverlay.hidden = true;
    document.body.classList.remove('modal-open');
    submitButton.focus();
    finish(confirmed);
  };
  const showObservationModal = ({ title, text, confirmLabel, cancelLabel }) => new Promise((resolve) => {
    confirmationTitle.textContent = title;
    confirmationMessage.textContent = text;
    confirmButton.textContent = confirmLabel;
    cancelButton.hidden = !cancelLabel;
    if (cancelLabel) cancelButton.textContent = cancelLabel;
    finishConfirmation = resolve;
    confirmationOverlay.hidden = false;
    document.body.classList.add('modal-open');
    (cancelLabel ? cancelButton : confirmButton).focus();
  });

  cancelButton.addEventListener('click', () => closeConfirmation(false));
  confirmButton.addEventListener('click', () => closeConfirmation(true));
  confirmationOverlay.addEventListener('click', (event) => {
    if (event.target === confirmationOverlay) closeConfirmation(false);
  });
  confirmationDialog.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeConfirmation(false);
      return;
    }
    if (event.key !== 'Tab') return;

    const focusableButtons = cancelButton.hidden
      ? [confirmButton]
      : [cancelButton, confirmButton];
    const first = focusableButtons[0];
    const last = focusableButtons[focusableButtons.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  let previewUrl = null;
  let isSubmitting = false;
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
    if (isSubmitting) return;
    isSubmitting = true;

    try {
      const confirmed = await showObservationModal({
        title: 'Submit observation?',
        text: 'Are you sure you want to submit this observation?',
        confirmLabel: 'Submit observation',
        cancelLabel: 'Cancel',
      });
      if (!confirmed) return;
      submitButton.disabled = true;

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

      setMessage(message, 'Submitting observation...');
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

      setMessage(message, '');
      await showObservationModal({
        title: 'Observation submitted',
        text: file
          ? 'Your observation was added successfully, and your plot photo has been updated.'
          : 'Your observation was added successfully.',
        confirmLabel: 'Done',
        cancelLabel: '',
      });
    } catch (error) {
      console.error('Could not submit the student observation.', error);
      setMessage(message, 'Unable to submit the observation. Please try again.');
    } finally {
      isSubmitting = false;
      submitButton.disabled = false;
      submitButton.focus();
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
    const username = localStorage.getItem('gardenTrackerCurrentUser');
    const account = getAccounts().find((entry) => entry.username === username);
    if (!account || account.role !== 'Student') {
      section.dataset.plotId = '';
      [
        '[data-student-plot-id]',
        '[data-student-assigned-name]',
        '[data-student-plot-location]',
        '[data-student-plot-crop]',
        '[data-student-plant-condition]',
        '[data-student-soil-condition]',
        '[data-student-plot-status]',
      ].forEach((selector) => {
        const element = document.querySelector(selector);
        if (element) element.textContent = 'None';
      });
      textElement.textContent = 'No plot is assigned to your account yet.';
      authorElement.textContent = '—';
      dateElement.textContent = '—';
      dateElement.removeAttribute('datetime');
      return;
    }

    const plotId = getAssignedPlotForStudent(account, '');
    section.dataset.plotId = plotId;
    const readRecords = (key, recordLength) => {
      const stored = localStorage.getItem(key);
      if (stored === null) return [];
      const records = JSON.parse(stored);
      if (!Array.isArray(records) || records.some((record) => (
        !Array.isArray(record)
        || record.length !== recordLength
        || record.some((value) => typeof value !== 'string')
      ))) {
        throw new Error(`Saved ${key} records have an invalid format.`);
      }
      return records;
    };
    const students = readRecords('gardenTrackerAdminRows:students', 5);
    const plots = readRecords('gardenTrackerAdminRows:plots', 4);
    const student = students.find((record) =>
      normalizeStudentName(record[1]) === normalizeStudentName(account.fullName)
    );
    const assignedPlot = plotId
      ? plots.find((record) => record[0] === plotId
        && normalizeStudentName(record[2]) === normalizeStudentName(account.fullName)
        && record[3].toLowerCase() === 'assigned')
      : null;
    const setDetail = (selector, value) => {
      const element = document.querySelector(selector);
      if (element) element.textContent = value;
    };
    setDetail('[data-student-plot-id]', plotId || 'None');
    setDetail('[data-student-assigned-name]', plotId ? account.fullName : 'None');
    setDetail('[data-student-plot-location]', plotId ? assignedPlot?.[1] || 'None' : 'None');
    setDetail('[data-student-plant-condition]', plotId ? 'Healthy' : 'None');
    setDetail('[data-student-soil-condition]', plotId ? 'Moist' : 'None');
    setDetail('[data-student-plot-status]', plotId ? student?.[4] || 'Active' : 'None');

    const cropElement = document.querySelector('[data-student-plot-crop]');
    if (cropElement) {
      try {
        const savedCrops = JSON.parse(localStorage.getItem('gardenTrackerPlotCrops') || '{}');
        if (
          !savedCrops
          || Array.isArray(savedCrops)
          || typeof savedCrops !== 'object'
          || Object.values(savedCrops).some((crop) => typeof crop !== 'string')
        ) {
          throw new Error('Saved plot crops have an invalid format.');
        }
        const validCrops = ['Tomato', 'Radish', 'Carrot'];
        const assignedCrop = plotId ? savedCrops[plotId] : null;
        if (!plotId) {
          cropElement.textContent = 'None';
        } else if (assignedCrop) {
          cropElement.textContent = validCrops.includes(assignedCrop)
            ? assignedCrop
            : 'No crop assigned';
        } else if (plotId === 'A-01') {
          cropElement.textContent = 'Tomato';
        } else if (plotId === 'A-02') {
          cropElement.textContent = 'Carrot';
        } else {
          cropElement.textContent = 'No crop assigned';
        }
      } catch (error) {
        console.error('Could not load the assigned crop for the student plot.', error);
        cropElement.textContent = 'Unable to load';
      }
    }

    const notes = JSON.parse(localStorage.getItem('gardenTrackerTeacherNotes') || '[]');
    if (!Array.isArray(notes)) {
      throw new Error('Stored teacher notes are not in a valid format.');
    }

    const note = plotId ? notes.find((entry) => entry.plotId === plotId) : null;
    if (!note) {
      textElement.textContent = plotId
        ? 'No teacher notes have been added for this plot yet.'
        : 'No plot is assigned to your account yet.';
      authorElement.textContent = '—';
      dateElement.textContent = '—';
      dateElement.removeAttribute('datetime');
      return;
    }
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
