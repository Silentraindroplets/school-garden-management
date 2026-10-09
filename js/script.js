const accountsStorageKey = 'gardenTrackerAccounts';
const currentUserStorageKey = 'gardenTrackerCurrentUser';
const notificationsStorageKey = 'gardenTrackerNotifications';
const plotPhotoStoragePrefix = 'gardenTrackerPlotPhoto:';
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
    (account) => (
      !usernames.has(account.username.toLowerCase())
      && !accounts.some(
        (existingAccount) =>
          existingAccount.role === account.role
          && existingAccount.redirect === account.redirect
      )
    )
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

function addStudentNotification(username, title, message) {
  const notifications = JSON.parse(localStorage.getItem(notificationsStorageKey) || '[]');
  if (!Array.isArray(notifications)) {
    throw new Error('Stored notifications are not in a valid format.');
  }

  notifications.unshift({
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    username,
    title,
    message,
    createdAt: new Date().toISOString(),
    read: false,
  });
  localStorage.setItem(notificationsStorageKey, JSON.stringify(notifications));
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

function setText(selector, value) {
  const element = document.querySelector(selector);
  if (element) element.textContent = value;
}

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

  const emptyState = document.querySelector(emptyStateSelector);
  const card       = cardSelector ? document.querySelector(cardSelector) : null;
  const table      = card?.querySelector('table') ?? null;

  input.addEventListener('input', () => {
    const term = input.value.trim().toLowerCase();
    let visible = 0;

    document.querySelectorAll(rowSelector).forEach((row) => {
      const match = row.textContent.toLowerCase().includes(term);
      row.hidden = !match;
      if (match) visible++;
    });

    if (emptyState) emptyState.hidden = visible > 0;
    if (table)      table.hidden      = visible === 0;
  });
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

  const account = {
    username: username.trim(),
    fullName: fullName.trim(),
    password,
    role,
    redirect,
  };

  if (!saveAccount(account)) {
    setMessage(messageElement, 'That username is already taken.');
    return;
  }

  if (role === 'Student') {
    try {
      addStudentNotification(
        account.username,
        'Welcome to GardenTrack',
        'Your student account is ready. Visit My Plot to review your garden details.'
      );
    } catch (error) {
      console.error('Could not create the student welcome notification.', error);
    }
  }

  setMessage(messageElement, `${role} account created successfully. Redirecting to login...`, true);
  setTimeout(() => {
    window.location.href = '../index.html';
  }, 600);
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

function setupLogoutConfirmation() {
  const logoutLinks = Array.from(document.querySelectorAll('a'))
    .filter((link) => link.textContent.trim().toLowerCase() === 'logout');
  if (!logoutLinks.length) return;

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.hidden = true;
  modal.innerHTML = `
    <section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="logout-modal-title" aria-describedby="logout-modal-description">
      <div class="modal-header">
        <h2 id="logout-modal-title">Log out?</h2>
      </div>
      <p id="logout-modal-description">Are you sure you want to log out?</p>
      <div class="logout-modal-actions">
        <button class="btn btn-secondary" type="button" data-cancel-logout>Stay signed in</button>
        <a class="btn btn-danger" href="#" data-confirm-logout>Log out</a>
      </div>
    </section>
  `;
  document.body.append(modal);

  const cancelButton = modal.querySelector('[data-cancel-logout]');
  const confirmLink = modal.querySelector('[data-confirm-logout]');
  let activeLogoutLink = null;

  const closeModal = () => {
    modal.hidden = true;
    document.body.classList.remove('modal-open');
    activeLogoutLink?.focus();
    activeLogoutLink = null;
  };

  logoutLinks.forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      activeLogoutLink = link;
      confirmLink.href = link.href;
      modal.hidden = false;
      document.body.classList.add('modal-open');
      cancelButton.focus();
    });
  });

  cancelButton.addEventListener('click', closeModal);
  modal.addEventListener('click', (event) => {
    if (event.target === modal) closeModal();
  });
  modal.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeModal();
      return;
    }
    if (event.key !== 'Tab') return;

    const focusable = [cancelButton, confirmLink];
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
}

function setupStudentAccountOverlays() {
  const profileLink = document.querySelector('[data-open-student-profile]');
  const settingsLink = document.querySelector('[data-open-student-settings]');
  if (!profileLink || !settingsLink) return;
  const accountMenuTrigger = profileLink.closest('.user-menu')?.querySelector('.user-avatar');
  if (!accountMenuTrigger) return;

  const profileOverlay = document.createElement('div');
  profileOverlay.className = 'modal-overlay student-account-overlay';
  profileOverlay.hidden = true;
  profileOverlay.innerHTML = `
    <section class="modal-card student-account-modal" role="dialog" aria-modal="true" aria-labelledby="student-profile-title">
      <div class="modal-header">
        <h2 id="student-profile-title">Student Profile</h2>
        <button class="modal-close" type="button" aria-label="Close profile" data-close-student-profile>&times;</button>
      </div>
      <dl class="student-profile-details">
        <div><dt>Full name</dt><dd data-profile-name></dd></div>
        <div><dt>Username</dt><dd data-profile-username></dd></div>
        <div><dt>Account type</dt><dd>Student</dd></div>
      </dl>
    </section>
  `;

  const settingsOverlay = document.createElement('div');
  settingsOverlay.className = 'modal-overlay student-account-overlay';
  settingsOverlay.hidden = true;
  settingsOverlay.innerHTML = `
    <section class="modal-card student-account-modal" role="dialog" aria-modal="true" aria-labelledby="student-settings-title">
      <div class="modal-header">
        <h2 id="student-settings-title">Account Settings</h2>
        <button class="modal-close" type="button" aria-label="Close account settings" data-close-student-settings>&times;</button>
      </div>
      <p class="student-settings-intro">Change your account password.</p>
      <form data-student-password-form>
        <div class="form-group">
          <label for="student-current-password">Current password</label>
          <input id="student-current-password" name="current-password" type="password" autocomplete="current-password" required />
        </div>
        <div class="form-group">
          <label for="student-new-password">New password</label>
          <input id="student-new-password" name="new-password" type="password" autocomplete="new-password" minlength="6" required />
        </div>
        <div class="form-group">
          <label for="student-confirm-password">Confirm new password</label>
          <input id="student-confirm-password" name="confirm-password" type="password" autocomplete="new-password" minlength="6" required />
        </div>
        <p class="form-message student-password-message" data-student-password-message role="status" aria-live="polite"></p>
        <button class="btn btn-primary" type="submit">Update Password</button>
      </form>
    </section>
  `;

  document.body.append(profileOverlay, settingsOverlay);

  const closeOverlay = (overlay, returnFocus) => {
    overlay.hidden = true;
    document.body.classList.remove('modal-open');
    returnFocus.focus();
  };

  const openOverlay = (overlay, focusTarget) => {
    const accountMenu = profileLink.closest('.user-dropdown');
    accountMenu?.closest('details')?.removeAttribute('open');
    overlay.hidden = false;
    document.body.classList.add('modal-open');
    focusTarget.focus();
  };

  profileLink.addEventListener('click', (event) => {
    event.preventDefault();
    const username = localStorage.getItem(currentUserStorageKey);
    const account = getAccounts().find(
      (item) => item.username === username && item.role === 'Student'
    );
    const displayName = account?.fullName
      || document.querySelector('[data-username]')?.textContent.trim()
      || 'Student';
    profileOverlay.querySelector('[data-profile-name]').textContent = displayName;
    profileOverlay.querySelector('[data-profile-username]').textContent =
      account?.username || username || 'Not signed in';
    openOverlay(profileOverlay, profileOverlay.querySelector('[data-close-student-profile]'));
  });

  settingsLink.addEventListener('click', (event) => {
    event.preventDefault();
    const form = settingsOverlay.querySelector('[data-student-password-form]');
    form.reset();
    setMessage(settingsOverlay.querySelector('[data-student-password-message]'), '');
    openOverlay(settingsOverlay, settingsOverlay.querySelector('#student-current-password'));
  });

  profileOverlay.querySelector('[data-close-student-profile]').addEventListener('click', () => {
    closeOverlay(profileOverlay, accountMenuTrigger);
  });
  settingsOverlay.querySelector('[data-close-student-settings]').addEventListener('click', () => {
    closeOverlay(settingsOverlay, accountMenuTrigger);
  });

  [profileOverlay, settingsOverlay].forEach((overlay) => {
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) {
        closeOverlay(overlay, accountMenuTrigger);
      }
    });
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (!profileOverlay.hidden) closeOverlay(profileOverlay, accountMenuTrigger);
    if (!settingsOverlay.hidden) closeOverlay(settingsOverlay, accountMenuTrigger);
  });

  settingsOverlay.querySelector('[data-student-password-form]').addEventListener('submit', (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const message = settingsOverlay.querySelector('[data-student-password-message]');
    const currentPassword = form.elements['current-password'].value.trim();
    const newPassword = form.elements['new-password'].value.trim();
    const confirmPassword = form.elements['confirm-password'].value.trim();
    const username = localStorage.getItem(currentUserStorageKey);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setMessage(message, 'Complete all password fields.');
      return;
    }
    if (newPassword.length < 6) {
      setMessage(message, 'Your new password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage(message, 'The new password and confirmation do not match.');
      return;
    }
    if (newPassword === currentPassword) {
      setMessage(message, 'Choose a new password that is different from your current password.');
      return;
    }

    try {
      const accounts = JSON.parse(localStorage.getItem(accountsStorageKey) || '[]');
      if (!Array.isArray(accounts)) {
        throw new Error('Stored accounts are not in a valid format.');
      }
      const account = accounts.find(
        (item) => item.username === username && item.role === 'Student'
      );
      if (!account || account.password !== currentPassword) {
        setMessage(message, 'Your current password is incorrect.');
        return;
      }

      account.password = newPassword;
      localStorage.setItem(accountsStorageKey, JSON.stringify(accounts));
      form.reset();
      setMessage(message, 'Password updated successfully.', true);
    } catch (error) {
      console.error('Could not update the student password.', error);
      setMessage(message, 'Unable to save the new password. Please try again.');
    }
  });
}

function setupAdminAccountOverlays() {
  const profileLink = document.querySelector('[data-open-admin-profile]');
  const settingsLink = document.querySelector('[data-open-admin-settings]');
  if (!profileLink || !settingsLink) return;

  const accountMenuTrigger = profileLink.closest('.user-menu')?.querySelector('.user-avatar');
  if (!accountMenuTrigger) return;

  const profileOverlay = document.createElement('div');
  profileOverlay.className = 'modal-overlay admin-account-overlay';
  profileOverlay.hidden = true;
  profileOverlay.innerHTML = `
    <section class="modal-card admin-account-modal" role="dialog" aria-modal="true" aria-labelledby="admin-profile-title">
      <div class="modal-header">
        <h2 id="admin-profile-title">Admin Profile</h2>
        <button class="modal-close" type="button" aria-label="Close profile" data-close-admin-profile>&times;</button>
      </div>
      <dl class="admin-profile-details">
        <div><dt>Name</dt><dd data-admin-profile-name></dd></div>
        <div><dt>Username</dt><dd data-admin-profile-username></dd></div>
        <div><dt>Account type</dt><dd>Admin</dd></div>
      </dl>
    </section>
  `;

  const settingsOverlay = document.createElement('div');
  settingsOverlay.className = 'modal-overlay admin-account-overlay';
  settingsOverlay.hidden = true;
  settingsOverlay.innerHTML = `
    <section class="modal-card admin-account-modal" role="dialog" aria-modal="true" aria-labelledby="admin-settings-title">
      <div class="modal-header">
        <h2 id="admin-settings-title">Account Settings</h2>
        <button class="modal-close" type="button" aria-label="Close account settings" data-close-admin-settings>&times;</button>
      </div>
      <p class="admin-settings-intro">Update your username, password, or both.</p>
      <form data-admin-settings-form>
        <div class="form-group">
          <label for="admin-new-username">Username</label>
          <input id="admin-new-username" name="username" type="text" autocomplete="username" required />
        </div>
        <div class="form-group">
          <label for="admin-current-password">Current password</label>
          <input id="admin-current-password" name="current-password" type="password" autocomplete="current-password" required />
        </div>
        <div class="form-group">
          <label for="admin-new-password">New password <span>(leave blank to keep current)</span></label>
          <input id="admin-new-password" name="new-password" type="password" autocomplete="new-password" minlength="6" />
        </div>
        <div class="form-group">
          <label for="admin-confirm-password">Confirm new password</label>
          <input id="admin-confirm-password" name="confirm-password" type="password" autocomplete="new-password" minlength="6" />
        </div>
        <p class="form-message admin-settings-message" data-admin-settings-message role="status" aria-live="polite"></p>
        <button class="btn btn-primary" type="submit">Save Changes</button>
      </form>
    </section>
  `;

  document.body.append(profileOverlay, settingsOverlay);

  const openOverlay = (overlay, focusTarget) => {
    profileLink.closest('.user-dropdown')?.closest('details')?.removeAttribute('open');
    overlay.hidden = false;
    document.body.classList.add('modal-open');
    focusTarget.focus();
  };
  const closeOverlay = (overlay) => {
    overlay.hidden = true;
    document.body.classList.remove('modal-open');
    accountMenuTrigger.focus();
  };
  const populateProfile = (account) => {
    profileOverlay.querySelector('[data-admin-profile-name]').textContent =
      account?.fullName || account?.username || 'Administrator';
    profileOverlay.querySelector('[data-admin-profile-username]').textContent =
      account?.username || localStorage.getItem(currentUserStorageKey) || 'Not signed in';
  };

  profileLink.addEventListener('click', (event) => {
    event.preventDefault();
    const username = localStorage.getItem(currentUserStorageKey);
    const account = getAccounts().find(
      (item) => item.username === username && item.role === 'Admin'
    );
    populateProfile(account);
    openOverlay(profileOverlay, profileOverlay.querySelector('[data-close-admin-profile]'));
  });

  settingsLink.addEventListener('click', (event) => {
    event.preventDefault();
    const form = settingsOverlay.querySelector('[data-admin-settings-form]');
    const username = localStorage.getItem(currentUserStorageKey);
    const account = getAccounts().find(
      (item) => item.username === username && item.role === 'Admin'
    );
    form.reset();
    form.elements.username.value = account?.username || '';
    setMessage(settingsOverlay.querySelector('[data-admin-settings-message]'), '');
    openOverlay(settingsOverlay, form.elements.username);
  });

  profileOverlay.querySelector('[data-close-admin-profile]').addEventListener('click', () => {
    closeOverlay(profileOverlay);
  });
  settingsOverlay.querySelector('[data-close-admin-settings]').addEventListener('click', () => {
    closeOverlay(settingsOverlay);
  });
  [profileOverlay, settingsOverlay].forEach((overlay) => {
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) closeOverlay(overlay);
    });
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (!profileOverlay.hidden) closeOverlay(profileOverlay);
    if (!settingsOverlay.hidden) closeOverlay(settingsOverlay);
  });

  settingsOverlay.querySelector('[data-admin-settings-form]').addEventListener('submit', (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const message = settingsOverlay.querySelector('[data-admin-settings-message]');
    const newUsername = form.elements.username.value.trim();
    const currentPassword = form.elements['current-password'].value.trim();
    const newPassword = form.elements['new-password'].value.trim();
    const confirmPassword = form.elements['confirm-password'].value.trim();
    const currentUsername = localStorage.getItem(currentUserStorageKey);

    if (!newUsername || !currentPassword) {
      setMessage(message, 'Enter a username and your current password.');
      return;
    }
    if (newPassword && newPassword.length < 6) {
      setMessage(message, 'Your new password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage(message, 'The new password and confirmation do not match.');
      return;
    }
    if (newPassword && newPassword === currentPassword) {
      setMessage(message, 'Choose a new password that is different from your current password.');
      return;
    }

    try {
      const accounts = JSON.parse(localStorage.getItem(accountsStorageKey) || '[]');
      if (!Array.isArray(accounts)) {
        throw new Error('Stored accounts are not in a valid format.');
      }

      const account = accounts.find(
        (item) => item.username === currentUsername && item.role === 'Admin'
      );
      if (!account || account.password !== currentPassword) {
        setMessage(message, 'Your current password is incorrect.');
        return;
      }
      const usernameTaken = accounts.some(
        (item) => item !== account && item.username.toLowerCase() === newUsername.toLowerCase()
      );
      if (usernameTaken) {
        setMessage(message, 'That username is already taken.');
        return;
      }

      account.username = newUsername;
      if (newPassword) account.password = newPassword;
      localStorage.setItem(accountsStorageKey, JSON.stringify(accounts));
      localStorage.setItem(currentUserStorageKey, newUsername);
      updateUserDisplay();
      populateProfile(account);
      form.reset();
      form.elements.username.value = newUsername;
      setMessage(
        message,
        newPassword ? 'Username and password updated successfully.' : 'Username updated successfully.',
        true
      );
    } catch (error) {
      console.error('Could not update the admin account.', error);
      setMessage(message, 'Unable to save your account changes. Please try again.');
    }
  });
}

ensureDemoAccounts();

if (typeof setupAuthentication === 'function') setupAuthentication();
if (typeof setupLogoutConfirmation === 'function') setupLogoutConfirmation();
if (typeof setupStudentAccountOverlays === 'function') setupStudentAccountOverlays();
if (typeof setupAdminAccountOverlays === 'function') setupAdminAccountOverlays();
if (typeof setupCustomSelects === 'function') setupCustomSelects();
if (typeof setupDashboard === 'function') setupDashboard();
if (typeof setupAdminDashboard === 'function') setupAdminDashboard();
if (typeof setupPlotAssignment === 'function') setupPlotAssignment();
if (typeof setupStudentModal === 'function') setupStudentModal();
if (typeof setupAdminTableActions === 'function') setupAdminTableActions();
if (typeof setupAdminArchivePage === 'function') setupAdminArchivePage();
if (typeof setupAdminGrowthTracker === 'function') setupAdminGrowthTracker();
if (typeof setupObservationLog === 'function') setupObservationLog();
if (typeof setupStudentObservationForm === 'function') setupStudentObservationForm();
if (typeof setupPlotPhoto === 'function') setupPlotPhoto();
if (typeof setupReportExport === 'function') setupReportExport();
if (typeof setupStudentNotifications === 'function') setupStudentNotifications();
if (typeof markActiveSidebarLink === 'function') markActiveSidebarLink();
if (typeof setupTableSearch === 'function') {
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
  setupTableSearch({
    inputId: 'observation-search',
    rowSelector: '.observation-row',
    emptyStateSelector: '[data-observation-empty]',
    cardSelector: 'main .card',
  });
}
updateUserDisplay();
if (typeof setupTeacherNotesDisplay === 'function') setupTeacherNotesDisplay();
