
const $ = id => document.getElementById(id);

const USERS_KEY = 'taskmate_users_v1';
const SESSION_KEY = 'taskmate_session_v1';
const TASKS_KEY = 'taskmate_tasks_v1';

let isSignup = false;
let currentFilter = 'all';
let editingTaskId = null;
let toastTimer;

function readJSON(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function getUsers() {
  return readJSON(USERS_KEY, []);
}

function getTasks() {
  return readJSON(TASKS_KEY, []);
}

function saveTasks(tasks) {
  localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
}

function currentUser() {
  return readJSON(SESSION_KEY, null);
}

function userTasks() {
  const user = currentUser();
  return getTasks().filter(t => t.userId === user?.id);
}

function saveUserTasks(tasks) {
  const user = currentUser();
  const others = getTasks().filter(t => t.userId !== user?.id);
  saveTasks([...others, ...tasks]);
}

function escapeHTML(value = '') {
  return String(value).replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));
}

function showToast(message) {
  const el = $('toast');
  el.textContent = message;
  el.classList.add('show');

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.classList.remove('show');
  }, 2500);
}

/* SIGNUP AND LOGIN */

function setAuthMode(signup) {
  isSignup = signup;

  $('authHeading').textContent =
    signup ? 'Create your account' : 'Welcome back';

  $('authSubtitle').textContent =
    signup
      ? 'Sign up to start organizing your work.'
      : 'Sign in to manage your study tasks.';

  $('nameField').classList.toggle('hidden', !signup);
  $('authName').required = signup;

  $('authPassword').autocomplete =
    signup ? 'new-password' : 'current-password';

  $('authSubmit').textContent =
    signup ? 'Create account' : 'Sign in';

  $('switchText').textContent =
    signup ? 'Already have an account?' : "Don't have an account?";

  $('switchAuth').textContent =
    signup ? 'Sign in' : 'Create account';
}

$('switchAuth').addEventListener('click', () => {
  setAuthMode(!isSignup);
});

$('authForm').addEventListener('submit', e => {
  e.preventDefault();

  const email = $('authEmail').value.trim().toLowerCase();
  const password = $('authPassword').value;
  const users = getUsers();

  if (isSignup) {
    const name = $('authName').value.trim();

    if (!name) {
      showToast('Please enter your name.');
      return;
    }

    if (users.some(u => u.email === email)) {
      showToast('An account with this email already exists.');
      return;
    }

    const user = {
      id: crypto.randomUUID
        ? crypto.randomUUID()
        : String(Date.now()),
      name,
      email,
      password
    };

    localStorage.setItem(
      USERS_KEY,
      JSON.stringify([...users, user])
    );

    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        id: user.id,
        name: user.name,
        email: user.email
      })
    );

    $('authForm').reset();
    openApp();

  } else {
    const user = users.find(
      u => u.email === email && u.password === password
    );

    if (!user) {
      showToast('Incorrect email or password.');
      return;
    }

    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        id: user.id,
        name: user.name,
        email: user.email
      })
    );

    $('authForm').reset();
    openApp();
  }
});

/* OPEN DASHBOARD */

function openApp() {
  const user = currentUser();

  if (!user) {
    $('authScreen').classList.remove('hidden');
    $('appScreen').classList.add('hidden');
    return;
  }

  $('authScreen').classList.add('hidden');
  $('appScreen').classList.remove('hidden');

  const first = user.name.split(' ')[0];

  $('greeting').textContent = `Hello, ${first}!`;
  $('sidebarName').textContent = user.name;
  $('userAvatar').textContent = first.charAt(0).toUpperCase();
  $('topAvatar').textContent = first.charAt(0).toUpperCase();

  $('dateText').textContent =
    new Intl.DateTimeFormat(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    }).format(new Date());

  renderTasks();
}

/* LOGOUT */

$('logoutBtn').addEventListener('click', () => {
  localStorage.removeItem(SESSION_KEY);

  $('appScreen').classList.add('hidden');
  $('authScreen').classList.remove('hidden');

  setAuthMode(false);
});

/* TASK MODAL */

function openModal(task = null) {
  editingTaskId = task?.id ?? null;

  $('taskForm').reset();

  $('modalTitle').textContent =
    task ? 'Edit task' : 'Add a new task';

  $('saveTaskBtn').textContent =
    task ? 'Save changes' : 'Save task';

  if (task) {
    $('taskTitle').value = task.title;
    $('taskDescription').value = task.description || '';
    $('taskCategory').value = task.category;
    $('taskPriority').value = task.priority;
    $('taskDue').value = task.due || '';
  }

  $('taskModal').classList.remove('hidden');
  $('taskTitle').focus();
}

function closeModal() {
  $('taskModal').classList.add('hidden');
  editingTaskId = null;
}

$('openAdd').addEventListener('click', () => openModal());
$('emptyAdd').addEventListener('click', () => openModal());

$('closeModal').addEventListener('click', closeModal);
$('cancelModal').addEventListener('click', closeModal);

$('taskModal').addEventListener('click', e => {
  if (e.target === $('taskModal')) {
    closeModal();
  }
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
});

/* ADD AND EDIT TASK */

$('taskForm').addEventListener('submit', e => {
  e.preventDefault();

  const tasks = userTasks();

  const data = {
    title: $('taskTitle').value.trim(),
    description: $('taskDescription').value.trim(),
    category: $('taskCategory').value,
    priority: $('taskPriority').value,
    due: $('taskDue').value
  };

  if (!data.title) return;

  if (editingTaskId) {
    const updated = tasks.map(t =>
      t.id === editingTaskId
        ? { ...t, ...data }
        : t
    );

    saveUserTasks(updated);
    showToast('Task updated successfully.');

  } else {
    tasks.unshift({
      id: crypto.randomUUID
        ? crypto.randomUUID()
        : String(Date.now()),
      ...data,
      completed: false,
      createdAt: Date.now(),
      userId: currentUser().id
    });

    saveUserTasks(tasks);
    showToast('New task added.');
  }

  closeModal();
  renderTasks();
});

/* DISPLAY TASKS AND STATISTICS */

function renderTasks() {
  const tasks = userTasks();

  const completed = tasks.filter(t => t.completed).length;
  const pending = tasks.length - completed;

  const percent = tasks.length
    ? Math.round(completed / tasks.length * 100)
    : 0;

  $('totalCount').textContent = tasks.length;
  $('pendingCount').textContent = pending;
  $('completedCount').textContent = completed;

  $('progressPercent').textContent = percent + '%';
  $('progressBar').style.width = percent + '%';

  const search = $('searchInput').value.trim().toLowerCase();

  let visible = tasks.filter(t => {
    const filterMatch =
      currentFilter === 'all' ||
      (currentFilter === 'completed'
        ? t.completed
        : !t.completed);

    const searchMatch = [
      t.title,
      t.description,
      t.category
    ].join(' ').toLowerCase().includes(search);

    return filterMatch && searchMatch;
  });

  const sort = $('sortSelect').value;

  if (sort === 'due') {
    visible.sort((a, b) =>
      (a.due || '9999').localeCompare(b.due || '9999')
    );

  } else if (sort === 'priority') {
    const rank = { high: 0, medium: 1, low: 2 };

    visible.sort((a, b) =>
      rank[a.priority] - rank[b.priority]
    );

  } else {
    visible.sort((a, b) => b.createdAt - a.createdAt);
  }

  $('taskList').innerHTML = visible.map(task => `
    <article class="task-item ${task.completed ? 'completed-task' : ''}">

      <input
        class="check-task"
        type="checkbox"
        aria-label="Mark task complete"
        data-action="toggle"
        data-id="${task.id}"
        ${task.completed ? 'checked' : ''}
      >

      <div class="task-info">

        <div class="task-title">
          ${escapeHTML(task.title)}
        </div>

        ${
          task.description
            ? `<div class="task-description">
                ${escapeHTML(task.description)}
              </div>`
            : ''
        }

        <div class="task-meta">

          <span class="tag">
            ${escapeHTML(task.category)}
          </span>

          <span class="tag priority-${task.priority}">
            ${task.priority.charAt(0).toUpperCase() +
              task.priority.slice(1)} priority
          </span>

          ${
            task.due
              ? `<span class="due-label">
                  Due ${formatDate(task.due)}
                </span>`
              : ''
          }

        </div>
      </div>

      <div class="task-actions">

        <button
          class="icon-btn"
          data-action="edit"
          data-id="${task.id}"
          aria-label="Edit task"
        >✎</button>

        <button
          class="icon-btn delete-btn"
          data-action="delete"
          data-id="${task.id}"
          aria-label="Delete task"
        >⌫</button>

      </div>
    </article>
  `).join('');

  $('emptyState').classList.toggle(
    'hidden',
    visible.length > 0
  );

  $('taskList').classList.toggle(
    'hidden',
    visible.length === 0
  );

  document.querySelectorAll('[data-filter]').forEach(btn => {
    btn.classList.toggle(
      'selected',
      btn.dataset.filter === currentFilter
    );

    btn.classList.toggle(
      'active',
      btn.dataset.filter === currentFilter
    );
  });
}

/* DATE FORMAT */

function formatDate(date) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric'
  }).format(new Date(date + 'T00:00:00'));
}

/* EDIT AND DELETE TASK */

$('taskList').addEventListener('click', e => {
  const btn = e.target.closest('button[data-action]');

  if (!btn) return;

  const id = btn.dataset.id;
  const tasks = userTasks();
  const task = tasks.find(t => t.id === id);

  if (!task) return;

  if (btn.dataset.action === 'edit') {
    openModal(task);
  }

  if (btn.dataset.action === 'delete') {
    if (!confirm(`Delete "${task.title}"?`)) return;

    saveUserTasks(tasks.filter(t => t.id !== id));

    renderTasks();
    showToast('Task deleted.');
  }
});

/* MARK COMPLETE OR PENDING */

$('taskList').addEventListener('change', e => {
  if (e.target.matches('input[data-action="toggle"]')) {

    const tasks = userTasks();

    const updated = tasks.map(t =>
      t.id === e.target.dataset.id
        ? { ...t, completed: e.target.checked }
        : t
    );

    saveUserTasks(updated);
    renderTasks();

    showToast(
      e.target.checked
        ? 'Task completed!'
        : 'Task marked as pending.'
    );
  }
});

/* FILTERS */

document.querySelectorAll('[data-filter]').forEach(btn => {
  btn.addEventListener('click', () => {
    currentFilter = btn.dataset.filter;
    renderTasks();
  });
});

/* SEARCH AND SORT */

$('searchInput').addEventListener('input', renderTasks);
$('sortSelect').addEventListener('change', renderTasks);

/* START APPLICATION */

if (currentUser()) {
  openApp();
} else {
  setAuthMode(false);
}
