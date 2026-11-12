// Ledgerly dashboard client. Plain fetch against the JSON API.
/* global document, fetch */

const $ = (sel) => document.querySelector(sel);

const loginView = $('#login-view');
const dashView = $('#dash-view');
const logoutBtn = $('#logout');
const whoami = $('#whoami');

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

function showDashboard(user) {
  loginView.hidden = true;
  dashView.hidden = false;
  logoutBtn.hidden = false;
  whoami.textContent = `${user.displayName} (@${user.username})`;
  loadInvoices();
}

function showLogin() {
  loginView.hidden = false;
  dashView.hidden = true;
  logoutBtn.hidden = true;
  whoami.textContent = '';
}

async function loadInvoices() {
  const { ok, body } = await api('/api/invoices');
  if (!ok) return;
  const rows = body.invoices ?? [];
  const tbody = $('#invoice-rows');
  tbody.innerHTML = '';
  for (const inv of rows) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${inv.id}</td>
      <td>${inv.number}</td>
      <td>${inv.client}</td>
      <td class="num">${inv.amount} ${inv.currency}</td>
      <td>${inv.status}</td>`;
    tbody.appendChild(tr);
  }
}

// Login
$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const err = $('#login-error');
  err.hidden = true;
  const { ok, body } = await api('/api/login', {
    method: 'POST',
    body: JSON.stringify({
      username: form.username.value,
      password: form.password.value,
    }),
  });
  if (ok) {
    showDashboard(body.user);
  } else {
    err.textContent = body.error ?? 'Login failed';
    err.hidden = false;
  }
});

// Logout
logoutBtn.addEventListener('click', async () => {
  await api('/api/logout', { method: 'POST' });
  showLogin();
});

// Invoice viewer — opens an invoice by id. This is the client surface of the
// IDOR: the dashboard only lists your own invoices, but this box lets you ask
// for any id directly.
$('#view-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = $('#view-id').value;
  const out = $('#view-out');
  const { ok, body } = await api(`/api/invoices/${encodeURIComponent(id)}`);
  out.hidden = false;
  out.textContent = ok ? JSON.stringify(body.invoice, null, 2) : `Error ${body.error ?? ''}`;
});

// On load, check whether we already have a session.
(async () => {
  const { ok, body } = await api('/api/me');
  if (ok && body.user) showDashboard(body.user);
  else showLogin();
})();
