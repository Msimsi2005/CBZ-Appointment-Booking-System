/* CBZ - Appointment Booking System (Local)
   - Seeds from /data/*.json
   - Persists appointments via localStorage
   - Export functionality for served appointments
*/

const DB_KEYS = {
  seeded: "boz_seeded_v1",
  services: "boz_services_v1",
  users: "boz_users_v1",
  appointments: "boz_appointments_v1",
  session: "boz_session_v1"
};

const FALLBACK_SERVICES = [
  { id: "SVC-001", name: "Account Opening" },
  { id: "SVC-002", name: "Loan Application" },
  { id: "SVC-003", name: "Card Replacement" },
  { id: "SVC-004", name: "Customer Support" },
  { id: "SVC-005", name: "Business Banking" }
];

const FALLBACK_USERS = [
  { username: "admin", password: "admin123", role: "admin", displayName: "Admin User" },
  { username: "staff", password: "staff123", role: "staff", displayName: "Staff User" }
];

function $(id) { return document.getElementById(id); }

function safeJSONParse(str, fallback) {
  try { return JSON.parse(str); } catch { return fallback; }
}

async function safeFetchJSON(path, fallback) {
  try {
    const res = await fetch(path + "?v=" + Date.now());
    if (!res.ok) throw new Error("Fetch failed");
    return await res.json();
  } catch {
    return fallback;
  }
}

function lsGet(key, fallback) {
  const v = localStorage.getItem(key);
  return v ? safeJSONParse(v, fallback) : fallback;
}
function lsSet(key, val) {
  localStorage.setItem(key, JSON.stringify(val));
}

function getSession() {
  return lsGet(DB_KEYS.session, null);
}
function setSession(sessionObj) {
  lsSet(DB_KEYS.session, sessionObj);
}
function clearSession() {
  localStorage.removeItem(DB_KEYS.session);
}

function nowISO() {
  return new Date().toISOString();
}

function toPrettyDate(isoDate) {
  // isoDate should be "YYYY-MM-DD"
  const d = new Date(isoDate + "T00:00:00");
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long", year: "numeric", month: "long", day: "numeric"
  }).format(d);
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function genTimeSlots() {
  // 9:00 AM to 5:00 PM, 15-minute interval (last slot 5:00 PM included)
  const slots = [];
  const start = new Date();
  start.setHours(9, 0, 0, 0);
  const end = new Date();
  end.setHours(17, 0, 0, 0);

  for (let t = new Date(start); t <= end; t.setMinutes(t.getMinutes() + 15)) {
    const label = new Intl.DateTimeFormat(undefined, {
      hour: "2-digit", minute: "2-digit"
    }).format(t);
    slots.push(label);
  }
  return slots;
}

function appointmentsForDate(appts, isoDate) {
  return appts.filter(a => a.date === isoDate);
}

function countByStatus(appts, status) {
  return appts.filter(a => a.status === status).length;
}

function formatStatusBadge(status) {
  const cls =
    status === "PENDING" ? "badge badge-pending" :
    status === "COMPLETED" ? "badge badge-completed" :
    status === "CANCELLED" ? "badge badge-cancelled" : "badge";
  return `<span class="${cls}">${status}</span>`;
}

function escapeHTML(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getQueryParam(name) {
  const url = new URL(window.location.href);
  return url.searchParams.get(name);
}

async function initDBOnce() {
  const seeded = localStorage.getItem(DB_KEYS.seeded);
  if (seeded === "1") return;

  const services = await safeFetchJSON("data/services.json", FALLBACK_SERVICES);
  const users = await safeFetchJSON("data/users.json", FALLBACK_USERS);

  lsSet(DB_KEYS.services, services);
  lsSet(DB_KEYS.users, users);
  localStorage.setItem(DB_KEYS.seeded, "1");
}

function getServices() {
  return lsGet(DB_KEYS.services, FALLBACK_SERVICES);
}
function getUsers() {
  return lsGet(DB_KEYS.users, FALLBACK_USERS);
}
function saveUsers(users) {
  lsSet(DB_KEYS.users, users);
}
function getAppointments() {
  return lsGet(DB_KEYS.appointments, []);
}
function saveAppointments(appts) {
  lsSet(DB_KEYS.appointments, appts);
}

function ensureRole(requiredRole) {
  const session = getSession();
  if (!session || session.role !== requiredRole) {
    window.location.href = "staff-login.html";
  }
}

function renderHeaderFooter() {
  const header = $("app-header");
  const footer = $("app-footer");
  if (header) header.innerHTML = buildHeaderHTML();
  if (footer) footer.innerHTML = buildFooterHTML();
}

function activeClass(pageFile) {
  const current = window.location.pathname.split("/").pop() || "index.html";
  return current === pageFile ? "nav-link active" : "nav-link";
}

function buildHeaderHTML() {
  const session = getSession();

  // Public nav
  const publicNav = `
    <a class="${activeClass("index.html")}" href="index.html">Home</a>
    <a class="${activeClass("book.html")}" href="book.html">Book Appointment</a>
    <a class="${activeClass("pending.html")}" href="pending.html">Pending</a>
    <a class="${activeClass("datetime.html")}" href="datetime.html">Date &amp; Time</a>
    <a class="${activeClass("staff-login.html")}" href="staff-login.html">Staff Login</a>
  `;

  // Staff/Admin extras
  let roleNav = "";
  if (session?.role === "admin") {
    roleNav = `
      <a class="${activeClass("admin-dashboard.html")}" href="admin-dashboard.html">Admin</a>
      <span class="nav-pill">Admin User (${escapeHTML(session.username)})</span>
      <button class="btn btn-small btn-ghost" id="btnLogout">Logout</button>
    `;
  } else if (session?.role === "staff") {
    roleNav = `
      <a class="${activeClass("staff-dashboard.html")}" href="staff-dashboard.html">Staff</a>
      <span class="nav-pill">Staff User (${escapeHTML(session.username)})</span>
      <button class="btn btn-small btn-ghost" id="btnLogout">Logout</button>
    `;
  }

  return `
  <header class="topbar">
    <div class="topbar-inner">
      <div class="brand">
        <div class="brand-text">
          <div class="brand-title">CBZ</div>
          <div class="brand-subtitle">Appointment Booking System</div>
        </div>
      </div>

      <nav class="nav">
        ${publicNav}
        ${roleNav}
      </nav>
    </div>
  </header>
  `;
}

function buildFooterHTML() {
  return `
    <footer class="footer">
      <div>© 2026 CBZ. All rights reserved.</div>
    </footer>
  `;
}

function wireLogoutIfPresent() {
  const btn = $("btnLogout");
  if (!btn) return;
  btn.addEventListener("click", () => {
    clearSession();
    window.location.href = "index.html";
  });
}

function seedTimeSelect(selectEl, dateISO = null) {
  const slots = genTimeSlots();
  let options = `<option value="">Select a time</option>`;

  if (dateISO) {
    const appts = getAppointments();
    options += slots.map(slot => {
      const isTaken = isSlotTaken(appts, dateISO, slot);
      const displayText = isTaken ? `${slot} (booked)` : slot;
      const disabled = isTaken ? 'disabled' : '';
      return `<option value="${slot}" ${disabled}>${displayText}</option>`;
    }).join("");
  } else {
    options += slots.map(s => `<option value="${s}">${s}</option>`).join("");
  }

  selectEl.innerHTML = options;
}

function nextAppointmentNumber(appts) {
  const year = new Date().getFullYear();
  const yearAppts = appts.filter(a => a.year === year);
  const next = yearAppts.length + 1;
  const padded = String(next).padStart(4, "0");
  return `APT-${year}-${padded}`;
}

function isSlotTaken(appts, dateISO, timeLabel) {
  // One booking per time slot, but allow reuse when completed or cancelled
  return appts.some(a => a.date === dateISO && a.time === timeLabel && a.status === "PENDING");
}

/* ---------------- PAGE: BOOK ---------------- */
function initBookPage() {
  const form = $("bookForm");
  const serviceSelect = $("serviceType");
  const timeSelect = $("timeSlot");
  const dateInput = $("apptDate");
  const msg = $("bookMsg");

  const services = getServices();
  serviceSelect.innerHTML = `<option value="">Select a service</option>` +
    services.map(s => `<option value="${s.id}">${escapeHTML(s.name)}</option>`).join("");

  seedTimeSelect(timeSelect);

  // Set min date to today
  const today = new Date();
  const iso = today.toISOString().slice(0, 10);
  dateInput.min = iso;

  // Update time slots when date changes
  dateInput.addEventListener("change", () => {
    seedTimeSelect(timeSelect, dateInput.value);
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    msg.innerHTML = "";

    const fullName = $("fullName").value.trim();
    const email = $("email").value.trim();
    const idNumber = $("idNumber").value.trim();
    const phoneNumber = $("phoneNumber").value.trim();
    const serviceId = serviceSelect.value;
    const date = dateInput.value;
    const time = timeSelect.value;

    if (fullName.length < 2) {
      msg.innerHTML = `<div class="alert alert-danger">Please enter your full name.</div>`;
      return;
    }
    if (!isValidEmail(email)) {
      msg.innerHTML = `<div class="alert alert-danger">Please enter a valid email address.</div>`;
      return;
    }
    if (idNumber.length < 5) {
      msg.innerHTML = `<div class="alert alert-danger">Please enter a valid ID or passport number.</div>`;
      return;
    }
    if (phoneNumber.length < 7) {
      msg.innerHTML = `<div class="alert alert-danger">Please enter a valid phone number.</div>`;
      return;
    }
    if (!serviceId) {
      msg.innerHTML = `<div class="alert alert-danger">Please select a service type.</div>`;
      return;
    }
    if (!date) {
      msg.innerHTML = `<div class="alert alert-danger">Please select a date.</div>`;
      return;
    }
    if (!time) {
      msg.innerHTML = `<div class="alert alert-danger">Please select a time slot.</div>`;
      return;
    }

    const appts = getAppointments();

    if (isSlotTaken(appts, date, time)) {
      msg.innerHTML = `<div class="alert alert-danger">That time slot is already booked. Please choose another time.</div>`;
      return;
    }

    const serviceName = services.find(s => s.id === serviceId)?.name || "Service";
    const number = nextAppointmentNumber(appts);
    const year = new Date().getFullYear();

    const newAppt = {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2),
      number,
      year,
      name: fullName,
      email,
      idNumber,
      phone: phoneNumber,
      serviceId,
      serviceName,
      date,
      time,
      status: "PENDING",
      createdAt: nowISO()
    };

    appts.push(newAppt);
    saveAppointments(appts);

    window.location.href = `success.html?apt=${encodeURIComponent(number)}`;
  });
}

/* ---------------- PAGE: SUCCESS ---------------- */
function initSuccessPage() {
  const apt = getQueryParam("apt");
  const box = $("successBox");
  const btnPrint = $("btnPrint");
  const btnAnother = $("btnAnother");

  const appts = getAppointments();
  const found = appts.find(a => a.number === apt);

  if (!found) {
    box.innerHTML = `<div class="alert alert-danger">Appointment not found.</div>`;
    return;
  }

  box.innerHTML = `
    <div class="success-card">
      <div class="success-title">Appointment Booked Successfully!</div>

      <div class="ticket">
        <div class="ticket-top">Your Appointment Number:</div>
        <div class="ticket-number">${escapeHTML(found.number)}</div>

        <div class="ticket-details">
          <div><strong>Name:</strong> ${escapeHTML(found.name)}</div>
          <div><strong>Email:</strong> ${escapeHTML(found.email)}</div>
          <div><strong>ID/Passport:</strong> ${escapeHTML(found.idNumber)}</div>
          <div><strong>Phone:</strong> ${escapeHTML(found.phone)}</div>
          <div><strong>Service:</strong> ${escapeHTML(found.serviceName)}</div>
          <div><strong>Date:</strong> ${escapeHTML(toPrettyDate(found.date))}</div>
          <div><strong>Time:</strong> ${escapeHTML(found.time)}</div>
        </div>
      </div>

      <div class="note-box">
        <strong>Important:</strong> Please save your appointment number and arrive 10 minutes before your scheduled time. Take a screenshot of this confirmation to show at the front desk.
      </div>
    </div>
  `;

  btnAnother.addEventListener("click", () => {
    window.location.href = "book.html";
  });
}

/* ---------------- PAGE: TICKET ---------------- */
function initTicketPage() {
  const apt = getQueryParam("apt");
  const area = $("printArea");
  const appts = getAppointments();
  const found = appts.find(a => a.number === apt);

  if (!found) {
    area.innerHTML = `<div class="alert alert-danger">Ticket not found.</div>`;
    return;
  }

  area.innerHTML = `
    <div class="print-ticket">
      <div class="print-header">
        <div class="print-brand">CBZ</div>
        <div class="print-sub">Appointment Ticket</div>
      </div>

      <div class="print-number">${escapeHTML(found.number)}</div>

      <div class="print-row"><span>Name</span><span>${escapeHTML(found.name)}</span></div>
      <div class="print-row"><span>Email</span><span>${escapeHTML(found.email)}</span></div>
      <div class="print-row"><span>ID/Passport</span><span>${escapeHTML(found.idNumber)}</span></div>
      <div class="print-row"><span>Phone</span><span>${escapeHTML(found.phone)}</span></div>
      <div class="print-row"><span>Service</span><span>${escapeHTML(found.serviceName)}</span></div>
      <div class="print-row"><span>Date</span><span>${escapeHTML(toPrettyDate(found.date))}</span></div>
      <div class="print-row"><span>Time</span><span>${escapeHTML(found.time)}</span></div>
      <div class="print-row"><span>Status</span><span>${escapeHTML(found.status)}</span></div>

      <div class="print-note">
        Please arrive 10 minutes before your scheduled appointment time. Keep this ticket for reference.
      </div>
    </div>
  `;

  // Auto print
  setTimeout(() => window.print(), 400);
}

/* ---------------- PAGE: PENDING (PUBLIC) ---------------- */
function initPendingPage() {
  const input = $("pendingSearch");
  const list = $("pendingList");

  function render(filterText = "") {
    const appts = getAppointments();
    const pending = appts.filter(a => a.status === "PENDING");

    const q = filterText.trim().toLowerCase();
    const filtered = q
      ? pending.filter(a =>
          a.number.toLowerCase().includes(q) ||
          a.name.toLowerCase().includes(q)
        )
      : pending;

    if (filtered.length === 0) {
      list.innerHTML = `
        <div class="empty">
          <div class="empty-icon">!</div>
          <div class="empty-text">No pending appointments</div>
        </div>
      `;
      return;
    }

    list.innerHTML = filtered
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
      .map(a => `
        <div class="pending-card">
          <div class="pending-top">
            <div class="pending-num"># <strong>${escapeHTML(a.number)}</strong></div>
            ${formatStatusBadge(a.status)}
          </div>
          <div class="pending-bottom">
            <div class="pending-meta">${escapeHTML(toPrettyDate(a.date))}</div>
            <div class="pending-meta">${escapeHTML(a.time)}</div>
          </div>
        </div>
      `).join("");
  }

  input.addEventListener("input", () => render(input.value));
  render("");
}

/* ---------------- PAGE: STAFF LOGIN ---------------- */
function initStaffLoginPage() {
  const form = $("loginForm");
  const msg = $("loginMsg");

  const session = getSession();
  if (session?.role === "admin") window.location.href = "admin-dashboard.html";
  if (session?.role === "staff") window.location.href = "staff-dashboard.html";

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    msg.innerHTML = "";

    const username = $("loginUsername").value.trim();
    const password = $("loginPassword").value;

    const users = getUsers();
    const found = users.find(u => u.username === username && u.password === password);

    if (!found) {
      msg.innerHTML = `<div class="alert alert-danger">Invalid username or password.</div>`;
      return;
    }

    setSession({
      username: found.username,
      role: found.role,
      displayName: found.displayName,
      loginAt: nowISO()
    });

    window.location.href = found.role === "admin" ? "admin-dashboard.html" : "staff-dashboard.html";
  });
}

/* ---------------- PAGE: STAFF DASHBOARD ---------------- */
function initStaffDashboardPage() {
  ensureRole("staff");

  const currentDateTime = $("currentDateTime");
  const searchInput = $("staffSearch");
  const todayISO = new Date().toISOString().slice(0, 10);

  const statPending = $("statPending");
  const statCompleted = $("statCompleted");
  const showing = $("staffShowing");
  const tableBody = $("staffTableBody");

  // Update current date/time display
  function updateDateTime() {
    const now = new Date();
    const dateStr = now.toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const timeStr = now.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    currentDateTime.textContent = `${dateStr} ${timeStr}`;
  }
  updateDateTime();
  setInterval(updateDateTime, 1000); // Update every second

  function render() {
    const appts = getAppointments();
    const search = searchInput.value.trim().toLowerCase();

    // Only show pending appointments
    let filtered = appts.filter(a => a.status === "PENDING");

    // Then apply search filter
    if (search) {
      filtered = filtered.filter(a =>
        a.name.toLowerCase().includes(search) ||
        a.email.toLowerCase().includes(search) ||
        a.idNumber?.toLowerCase().includes(search) ||
        a.phone?.toLowerCase().includes(search) ||
        a.number.toLowerCase().includes(search) ||
        a.serviceName.toLowerCase().includes(search)
      );
    }

    // Update stats
    const today = new Date().toISOString().slice(0, 10);
    const todaysAppointments = appointmentsForDate(appts, today);
    
    statPending.textContent = String(filtered.length);
    statCompleted.textContent = String(todaysAppointments.filter(a => a.status === "COMPLETED").length);

    const view = filtered
      .slice()
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

    showing.textContent = `Showing ${view.length} pending appointments${search ? ` matching "${search}"` : ''}`;

    if (view.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="8" class="empty">
            <div class="empty-text">No pending appointments found${search ? ` matching "${search}"` : ''}</div>
          </td>
        </tr>
      `;
      return;
    }

    tableBody.innerHTML = view.map(a => `
      <tr>
        <td>${escapeHTML(a.number)}</td>
        <td>${escapeHTML(a.name)}</td>
        <td>${escapeHTML(a.email)}</td>
        <td>${escapeHTML(a.idNumber || 'N/A')}</td>
        <td>${escapeHTML(a.phone || 'N/A')}</td>
        <td>${escapeHTML(a.serviceName)}</td>
        <td>${escapeHTML(a.time)}</td>
        <td>${formatStatusBadge(a.status)}</td>
        <td>
          ${a.status === "PENDING" ? `
            <button class="btn btn-small" data-action="complete" data-id="${escapeHTML(a.id)}">Complete</button>
            <button class="btn btn-small btn-danger" data-action="cancel" data-id="${escapeHTML(a.id)}">Cancel</button>
          ` : `<span class="muted">No actions</span>`}
        </td>
      </tr>
    `).join("");

    tableBody.querySelectorAll("button[data-action]").forEach(btn => {
      btn.addEventListener("click", () => {
        const action = btn.getAttribute("data-action");
        const id = btn.getAttribute("data-id");
        const all = getAppointments();
        const idx = all.findIndex(x => x.id === id);
        if (idx === -1) return;

        if (action === "complete") all[idx].status = "COMPLETED";
        if (action === "cancel") all[idx].status = "CANCELLED";
        all[idx].updatedAt = nowISO();

        saveAppointments(all);
        render();
      });
    });
  }

  searchInput.addEventListener("input", render);
  render();
}

/* ---------------- PAGE: ADMIN DASHBOARD ---------------- */
function initAdminDashboardPage() {
  ensureRole("admin");

  const statTotal = $("statTotal");
  const statPending = $("statPending");
  const statCompleted = $("statCompleted");
  const statCancelled = $("statCancelled");

  const filterSearch = $("adminSearch");
  const filterStatus = $("adminStatus");
  const filterDate = $("adminDate");

  const tableBody = $("adminTableBody");
  const showingText = $("adminShowing");
  const clearAllBtn = $("clearAllBtn");
  const exportServedBtn = $("exportServedBtn");
  const importBtn = $("importBtn");
  const importFile = $("importFile");

  // User management elements
  const addUserBtn = $("addUserBtn");
  const userTableBody = $("userTableBody");
  const addUserModal = $("addUserModal");
  const closeAddUserModal = $("closeAddUserModal");
  const cancelAddUser = $("cancelAddUser");
  const saveAddUser = $("saveAddUser");
  const newUsername = $("newUsername");
  const newPassword = $("newPassword");
  const newDisplayName = $("newDisplayName");
  const newRole = $("newRole");
  const userMessage = $("userMessage");

  function showUserMessage(message, type = "success") {
    userMessage.textContent = message;
    userMessage.className = type === "success" ? "alert alert-success" : "alert alert-danger";
    userMessage.style.display = "block";
    setTimeout(() => {
      userMessage.style.display = "none";
    }, 5000); // Hide after 5 seconds
  }

  function showAddUserModal() {
    newUsername.value = "";
    newPassword.value = "";
    newDisplayName.value = "";
    newRole.value = "";
    addUserModal.style.display = "flex";
  }

  function hideAddUserModal() {
    addUserModal.style.display = "none";
  }

  function renderUsers() {
    const users = getUsers();
    userTableBody.innerHTML = users.map(u => `
      <tr>
        <td>${escapeHTML(u.username)}</td>
        <td>${escapeHTML(u.displayName)}</td>
        <td>${escapeHTML(u.role)}</td>
        <td>
          <button class="btn btn-small btn-danger" data-action="delete-user" data-username="${escapeHTML(u.username)}">Delete</button>
        </td>
      </tr>
    `).join("");

    userTableBody.querySelectorAll("button[data-action='delete-user']").forEach(btn => {
      btn.addEventListener("click", () => {
        const username = btn.getAttribute("data-username");
        if (confirm(`Are you sure you want to delete user "${username}"?`)) {
          const users = getUsers();
          const filtered = users.filter(u => u.username !== username);
          saveUsers(filtered);
          renderUsers();
        }
      });
    });
  }

  addUserBtn.addEventListener("click", showAddUserModal);
  closeAddUserModal.addEventListener("click", hideAddUserModal);
  cancelAddUser.addEventListener("click", hideAddUserModal);
  addUserModal.addEventListener("click", (e) => {
    if (e.target === addUserModal) hideAddUserModal();
  });

  saveAddUser.addEventListener("click", () => {
    const username = newUsername.value.trim();
    const password = newPassword.value.trim();
    const displayName = newDisplayName.value.trim();
    const role = newRole.value;

    if (!username || !password || !displayName || !role) {
      showUserMessage("All fields are required", "danger");
      return;
    }

    if (!["admin", "staff"].includes(role)) {
      showUserMessage("Invalid role selected", "danger");
      return;
    }

    const users = getUsers();
    if (users.some(u => u.username === username)) {
      showUserMessage("Username already exists", "danger");
      return;
    }

    users.push({ username, password, displayName, role });
    saveUsers(users);
    renderUsers();
    hideAddUserModal();
    showUserMessage(`User "${username}" has been created successfully!`);
  });

  function render() {
    const appts = getAppointments();

    statTotal.textContent = String(appts.length);
    statPending.textContent = String(countByStatus(appts, "PENDING"));
    statCompleted.textContent = String(countByStatus(appts, "COMPLETED"));
    statCancelled.textContent = String(countByStatus(appts, "CANCELLED"));

    const q = filterSearch.value.trim().toLowerCase();
    const st = filterStatus.value;
    const d = filterDate.value;

    let filtered = appts.slice();

    // Apply filters in logical order: search -> status -> date
    if (q) {
      filtered = filtered.filter(a =>
        a.name.toLowerCase().includes(q) ||
        a.email.toLowerCase().includes(q) ||
        a.idNumber?.toLowerCase().includes(q) ||
        a.phone?.toLowerCase().includes(q) ||
        a.number.toLowerCase().includes(q) ||
        a.serviceName.toLowerCase().includes(q)
      );
    }
    if (st !== "ALL") {
      filtered = filtered.filter(a => a.status === st);
    }
    if (d) {
      filtered = filtered.filter(a => a.date === d);
    }

    filtered.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

    showingText.textContent = `Showing ${filtered.length} of ${appts.length} appointments${q ? ` matching "${q}"` : ''}${st !== "ALL" ? ` with status ${st}` : ''}${d ? ` on ${toPrettyDate(d)}` : ''}`;

    tableBody.innerHTML = filtered.map(a => `
      <tr>
        <td class="mono">${escapeHTML(a.number)}</td>
        <td>${escapeHTML(a.name)}</td>
        <td>${escapeHTML(a.email)}</td>
        <td>${escapeHTML(a.idNumber || 'N/A')}</td>
        <td>${escapeHTML(a.phone || 'N/A')}</td>
        <td>${escapeHTML(a.serviceName)}</td>
        <td>${escapeHTML(toPrettyDate(a.date))}</td>
        <td>${escapeHTML(a.time)}</td>
        <td>${formatStatusBadge(a.status)}</td>
        <td>
          ${a.status === "PENDING" ? `
            <button class="btn btn-small" data-action="complete" data-id="${escapeHTML(a.id)}">Complete</button>
            <button class="btn btn-small btn-danger" data-action="cancel" data-id="${escapeHTML(a.id)}">Cancel</button>
          ` : `<span class="muted">—</span>`}
        </td>
      </tr>
    `).join("");

    tableBody.querySelectorAll("button[data-action]").forEach(btn => {
      btn.addEventListener("click", () => {
        const action = btn.getAttribute("data-action");
        const id = btn.getAttribute("data-id");
        const all = getAppointments();
        const idx = all.findIndex(x => x.id === id);
        if (idx === -1) return;

        if (action === "complete") all[idx].status = "COMPLETED";
        if (action === "cancel") all[idx].status = "CANCELLED";
        all[idx].updatedAt = nowISO();

        saveAppointments(all);
        render();
      });
    });
  }

  filterSearch.addEventListener("input", render);
  filterStatus.addEventListener("change", render);
  filterDate.addEventListener("change", render);

  clearAllBtn.addEventListener("click", () => {
    if (confirm("Are you sure you want to clear all appointments? This action cannot be undone.")) {
      saveAppointments([]);
      render();
    }
  });

  exportServedBtn.addEventListener("click", () => {
    const appts = getAppointments();
    const servedAppointments = appts.filter(a => a.status === "COMPLETED");
    
    if (servedAppointments.length === 0) {
      alert("No served appointments to export.");
      return;
    }
    
    const dataStr = JSON.stringify(servedAppointments, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `served-appointments-${new Date().toISOString().slice(0, 10)}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  });

  importBtn.addEventListener("click", () => {
    importFile.click();
  });

  importFile.addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedAppointments = JSON.parse(e.target.result);
        
        if (!Array.isArray(importedAppointments)) {
          alert("Invalid JSON format. Expected an array of appointments.");
          return;
        }

        // Validate that each appointment has required fields
        const isValid = importedAppointments.every(apt => 
          apt.id && apt.number && apt.name && apt.email && apt.date && apt.time && apt.serviceName && apt.status
        );

        if (!isValid) {
          alert("Invalid appointment data. Some appointments are missing required fields.");
          return;
        }

        // Get existing appointments
        const existingAppointments = getAppointments();
        
        // Merge imported appointments with existing ones
        // Avoid duplicates by checking appointment numbers
        const existingNumbers = new Set(existingAppointments.map(a => a.number));
        const newAppointments = importedAppointments.filter(a => !existingNumbers.has(a.number));
        
        const mergedAppointments = [...existingAppointments, ...newAppointments];
        
        // Save merged appointments
        saveAppointments(mergedAppointments);
        
        alert(`Successfully imported ${newAppointments.length} appointments. ${importedAppointments.length - newAppointments.length} were duplicates and skipped.`);
        
        render();
      } catch (error) {
        alert("Error parsing JSON file. Please ensure it's a valid JSON file.");
      }
    };
    
    reader.readAsText(file);
  });

  render();
  renderUsers();
}

/* ---------------- PAGE: DATE & TIME ---------------- */
function initDateTimePage() {
  const bigCity = $("bigCity");
  const bigTime = $("bigTime");
  const bigDate = $("bigDate");

  const cityCards = $("cityCards");
  const tzTableBody = $("tzTableBody");

  const cities = [
    // Africa (4 countries)
    { key: "Harare", country: "Zimbabwe", tz: "Africa/Harare" },
    { key: "Addis Ababa", country: "Ethiopia", tz: "Africa/Addis_Ababa" },
    { key: "Cairo", country: "Egypt", tz: "Africa/Cairo" },
    { key: "Cape Town", country: "South Africa", tz: "Africa/Johannesburg" },
    
    // Europe (4 countries)
    { key: "London", country: "United Kingdom", tz: "Europe/London" },
    { key: "Berlin", country: "Germany", tz: "Europe/Berlin" },
    { key: "Paris", country: "France", tz: "Europe/Paris" },
    { key: "Moscow", country: "Russia", tz: "Europe/Moscow" },
    
    // Asia (4 countries)
    { key: "Tokyo", country: "Japan", tz: "Asia/Tokyo" },
    { key: "Dubai", country: "UAE", tz: "Asia/Dubai" },
    { key: "Beijing", country: "China", tz: "Asia/Shanghai" },
    { key: "Mumbai", country: "India", tz: "Asia/Kolkata" },
    
    // North America (4 countries)
    { key: "New York", country: "USA", tz: "America/New_York" },
    { key: "Toronto", country: "Canada", tz: "America/Toronto" },
    { key: "Mexico City", country: "Mexico", tz: "America/Mexico_City" },
    { key: "Kingston", country: "Jamaica", tz: "America/Jamaica" },
    
    // South America (4 countries)
    { key: "São Paulo", country: "Brazil", tz: "America/Sao_Paulo" },
    { key: "Buenos Aires", country: "Argentina", tz: "America/Argentina/Buenos_Aires" },
    { key: "Santiago", country: "Chile", tz: "America/Santiago" },
    { key: "Bogotá", country: "Colombia", tz: "America/Bogota" },
    
    // Australia/Oceania (4 countries)
    { key: "Sydney", country: "Australia", tz: "Australia/Sydney" },
    { key: "Auckland", country: "New Zealand", tz: "Pacific/Auckland" },
    { key: "Suva", country: "Fiji", tz: "Pacific/Fiji" },
    { key: "Apia", country: "Samoa", tz: "Pacific/Apia" }
  ];

  let selected = cities[0];

  function timeParts(tz) {
    const now = new Date();
    const time = new Intl.DateTimeFormat(undefined, {
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      hour12: true, timeZone: tz
    }).format(now);

    const date = new Intl.DateTimeFormat(undefined, {
      weekday: "long", month: "long", day: "numeric", year: "numeric",
      timeZone: tz
    }).format(now);

    return { time, date };
  }

  function renderStatic() {
    cityCards.innerHTML = cities.map(c => `
      <button class="city-card ${c.key === selected.key ? "selected" : ""}" data-city="${escapeHTML(c.key)}">
        <div class="city-name">${escapeHTML(c.key)}</div>
        <div class="city-country">${escapeHTML(c.country)}</div>
        <div class="city-time" id="t_${escapeHTML(c.key).replaceAll(" ", "_")}">--:--:--</div>
      </button>
    `).join("");

    tzTableBody.innerHTML = cities.map(c => `
      <tr>
        <td>${escapeHTML(c.key)}</td>
        <td>${escapeHTML(c.country)}</td>
        <td id="tt_${escapeHTML(c.key).replaceAll(" ", "_")}">--:--:--</td>
        <td id="td_${escapeHTML(c.key).replaceAll(" ", "_")}">---</td>
      </tr>
    `).join("");

    cityCards.querySelectorAll("button[data-city]").forEach(btn => {
      btn.addEventListener("click", () => {
        const name = btn.getAttribute("data-city");
        selected = cities.find(x => x.key === name) || selected;
        renderStatic();
      });
    });
  }

  function tick() {
    // Big banner
    const big = timeParts(selected.tz);
    bigCity.textContent = `${selected.key}, ${selected.country}`;
    bigTime.textContent = big.time;
    bigDate.textContent = big.date;

    // Cards + table
    cities.forEach(c => {
      const p = timeParts(c.tz);
      const cardEl = $("t_" + c.key.replaceAll(" ", "_"));
      const tblTime = $("tt_" + c.key.replaceAll(" ", "_"));
      const tblDate = $("td_" + c.key.replaceAll(" ", "_"));
      if (cardEl) cardEl.textContent = p.time;
      if (tblTime) tblTime.textContent = p.time;
      if (tblDate) tblDate.textContent = p.date;
    });
  }

  renderStatic();
  tick();
  setInterval(tick, 1000);
}

/* ---------------- PAGE: HOME ---------------- */
function initHomePage() {
  // Nothing heavy — just a small dynamic message if wanted later.
}

/* ---------------- BOOTSTRAP ---------------- */
document.addEventListener("DOMContentLoaded", async () => {
  await initDBOnce();
  renderHeaderFooter();
  wireLogoutIfPresent();

  const page = document.body.getAttribute("data-page");

  if (page === "home") initHomePage();
  if (page === "book") initBookPage();
  if (page === "pending") initPendingPage();
  if (page === "datetime") initDateTimePage();
  if (page === "staff-login") initStaffLoginPage();
  if (page === "staff-dashboard") initStaffDashboardPage();
  if (page === "admin-dashboard") initAdminDashboardPage();
  if (page === "success") initSuccessPage();
  if (page === "ticket") initTicketPage();
});
