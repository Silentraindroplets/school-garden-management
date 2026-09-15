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

function setupObservationLog() {
  document.querySelectorAll('.log-view-button').forEach((button) => {
    button.addEventListener('click', () => {
      const details = button.nextElementSibling;
      const isExpanded = button.getAttribute('aria-expanded') === 'true';

      details.hidden = isExpanded;
      button.setAttribute('aria-expanded', String(!isExpanded));
      button.textContent = isExpanded ? 'View' : 'Hide details';
    });
  });
}

function setupObservationSearch() {
  const searchInput = document.getElementById('observation-search');
  if (!searchInput) return;

  const rows = [...document.querySelectorAll('.observation-row')];
  searchInput.addEventListener('input', () => {
    const searchTerm = searchInput.value.trim().toLowerCase();

    rows.forEach((row) => {
      row.hidden = !row.textContent.toLowerCase().includes(searchTerm);
    });
  });
}

ensureDemoAccounts();
setupAuthentication();
setupDashboard();
setupPlotAssignment();
setupObservationLog();
setupObservationSearch();
updateUserDisplay();
