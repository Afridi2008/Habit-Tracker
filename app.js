/* ═══════════════════════════════════════════════════
   DISCIPLINE HABIT TRACKER — app.js
   Pure HTML / CSS / JavaScript — no frameworks
   ═══════════════════════════════════════════════════ */
'use strict';

// ── Constants ─────────────────────────────────────
const SECTIONS = [
  { id: 'fitness',  label: 'Fitness',  icon: 'fa-dumbbell'  },
  { id: 'diet',     label: 'Diet',     icon: 'fa-bowl-food' },
  { id: 'prayer',   label: 'Prayer',   icon: 'fa-moon'      },
  { id: 'learning', label: 'Learning', icon: 'fa-book-open' },
];

const DEFAULT_ACTIVITIES = {
  fitness:  [
    { id: 'workout', label: 'Workout' },
    { id: 'steps',   label: 'Steps'   },
  ],
  diet: [
    { id: 'water',    label: 'Water'       },
    { id: 'veggies',  label: 'Vegetables'  },
    { id: 'no_sugar', label: 'No Sugar'    },
    { id: 'no_junk',  label: 'No Junk Food'},
  ],
  prayer: [
    { id: 'fajr',    label: 'Fajr'    },
    { id: 'dhuhr',   label: 'Dhuhr'   },
    { id: 'asr',     label: 'Asr'     },
    { id: 'maghrib', label: 'Maghrib' },
    { id: 'isha',    label: 'Isha'    },
  ],
  learning: [
    { id: 'read',     label: 'Read'     },
    { id: 'study',    label: 'Study'    },
    { id: 'practice', label: 'Practice' },
    { id: 'reflect',  label: 'Reflect'  },
  ],
};

// ── Auth ──────────────────────────────────────────
const AUTH_KEY = 'discipline_user';

function getUser() {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function setUser(user)  { localStorage.setItem(AUTH_KEY, JSON.stringify(user)); }
function clearUser()    { localStorage.removeItem(AUTH_KEY); }

// ── Activity Config ───────────────────────────────
const CONFIG_KEY = 'discipline_activities';

function getActivities(section) {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (raw) {
      const cfg = JSON.parse(raw);
      if (cfg[section]) return cfg[section];
    }
  } catch { /* ignore */ }
  // Return a deep copy of defaults so mutations don't affect the source
  return JSON.parse(JSON.stringify(DEFAULT_ACTIVITIES[section] || []));
}

function setActivities(section, acts) {
  let cfg = {};
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (raw) cfg = JSON.parse(raw);
  } catch { /* ignore */ }
  cfg[section] = acts;
  localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
}

function genId() {
  return 'act_' + Math.random().toString(36).slice(2, 9) + '_' + Date.now();
}

// ── IndexedDB ─────────────────────────────────────
let _db        = null;
let _dbUserKey = 'guest';

function setHabitUser(email) {
  const key = email.toLowerCase().replace(/[^a-z0-9]/g, '_');
  if (key !== _dbUserKey) { _dbUserKey = key; _db = null; }
}

function openDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('discipline_habits_' + _dbUserKey, 1);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('days'))
        db.createObjectStore('days', { keyPath: 'date' });
    };
    req.onsuccess = e => { _db = e.target.result; resolve(_db); };
    req.onerror   = e => reject(e.target.error);
  });
}

async function saveDay(record) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction('days', 'readwrite');
    const req = tx.objectStore('days').put(record);
    req.onsuccess = () => resolve();
    req.onerror   = e => reject(e.target.error);
  });
}

async function getDay(date) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction('days', 'readonly').objectStore('days').get(date);
    req.onsuccess = e => resolve(e.target.result || null);
    req.onerror   = e => reject(e.target.error);
  });
}

async function getAllDays() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction('days', 'readonly').objectStore('days').getAll();
    req.onsuccess = e =>
      resolve(e.target.result.sort((a, b) => a.date.localeCompare(b.date)));
    req.onerror = e => reject(e.target.error);
  });
}

function emptyDay(date) {
  return { date, fitness: {}, diet: {}, prayer: {}, learning: {} };
}

// ── Date Utilities ────────────────────────────────
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function lastNDates(n) {
  const dates = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

function formatDatePretty(str) {
  const d = new Date(str + 'T00:00:00');
  return d.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });
}

function formatShortDate(str) {
  const d = new Date(str + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── Scoring ───────────────────────────────────────
function sectionScore(secData, acts) {
  if (!acts || acts.length === 0) return 0;
  const done = acts.filter(a => secData[a.id] === true).length;
  return Math.round((done / acts.length) * 100);
}

function dailyScore(record) {
  const scores = SECTIONS.map(s =>
    sectionScore(record[s.id] || {}, getActivities(s.id))
  );
  return Math.round(scores.reduce((a, b) => a + b, 0) / SECTIONS.length);
}

function avgScore(records) {
  if (!records || records.length === 0) return 0;
  const sum = records.reduce((acc, r) => acc + dailyScore(r), 0);
  return Math.round(sum / records.length);
}

function scoreColor(score) {
  if (score >= 75) return 'sc-green';
  if (score >= 50) return 'sc-amber';
  return 'sc-red';
}

function scoreMessage(score) {
  if (score === 100) return 'Perfect day — incredible!';
  if (score >= 75)  return 'Great momentum, keep going.';
  if (score >= 50)  return 'Good start. Push further.';
  return 'Every habit counts today.';
}

// ── Notifications ─────────────────────────────────
function setupNotifications() {
  if (!('Notification' in window)) return;
  Notification.requestPermission().then(permission => {
    if (permission !== 'granted') return;
    const now    = new Date();
    const target = new Date();
    target.setHours(20, 0, 0, 0);
    if (target <= now) target.setDate(target.getDate() + 1);
    setTimeout(() => {
      new Notification('Discipline Check-in', {
        body: 'Time to log your daily habits!',
      });
    }, target - now);
  });
}

// ── Chart ─────────────────────────────────────────
let _chart = null;

function renderChart(records) {
  const canvas = document.getElementById('week-chart');
  if (!canvas || typeof Chart === 'undefined') return;
  if (_chart) { _chart.destroy(); _chart = null; }

  _chart = new Chart(canvas, {
    type: 'line',
    data: {
      labels: records.map(r => formatShortDate(r.date)),
      datasets: [{
        label: 'Score',
        data: records.map(r => dailyScore(r)),
        borderColor: '#4f46e5',
        backgroundColor: 'rgba(79,70,229,0.10)',
        borderWidth: 3,
        pointBackgroundColor: '#4f46e5',
        pointBorderColor: '#d4d9ee',
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 7,
        pointHoverBackgroundColor: '#f59e0b',
        fill: true,
        tension: 0.4,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(255,255,255,0.92)',
          titleColor: '#5a6a90',
          bodyColor: '#1a2444',
          bodyFont: { weight: 'bold', size: 14 },
          borderColor: 'rgba(255,255,255,0.6)',
          borderWidth: 1,
          padding: 10,
          callbacks: { label: ctx => ' ' + ctx.raw + '%' },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: { color: '#8a9abc', font: { size: 10, weight: '600' } },
        },
        y: {
          min: 0, max: 100,
          border: { display: false },
          grid: { color: 'rgba(100,120,180,0.1)' },
          ticks: {
            color: '#8a9abc',
            font: { size: 10 },
            stepSize: 25,
            callback: v => v + '%',
          },
        },
      },
    },
  });
}

// ── HTML Escape ───────────────────────────────────
function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Background Blobs ──────────────────────────────
function ensureBlobs() {
  if (!document.querySelector('.blobs')) {
    document.body.insertAdjacentHTML('afterbegin',
      '<div class="blobs">' +
      '<div class="blob blob-1"></div>' +
      '<div class="blob blob-2"></div>' +
      '<div class="blob blob-3"></div>' +
      '</div>'
    );
  }
}

// ── Router ────────────────────────────────────────
function navigate(page) {
  const nav = document.getElementById('bottom-nav');
  const app = document.getElementById('app');

  if (_chart && page !== 'dashboard') { _chart.destroy(); _chart = null; }

  if (page === 'login') {
    nav.classList.add('hidden');
    renderLogin(app);
  } else {
    nav.classList.remove('hidden');
    document.querySelectorAll('.nav-item').forEach(el =>
      el.classList.toggle('active', el.dataset.page === page)
    );
    if (page === 'dashboard') renderDashboard(app);
    else renderSection(app, page);
  }
}

// ═══════════════════════════════════════════════════
// LOGIN PAGE
// ═══════════════════════════════════════════════════
function renderLogin(app) {
  app.innerHTML = `
    <div class="login-page">
      <div class="login-inner">

        <div class="login-brand">
          <div class="login-logo neu-raised">
           <img src="logo.PNG" width="60" height="60" alt="Logo" />
          </div>
          <div class="login-title">SIRAT<p class="login-p">– Habit Tracker</p></div>
          <div class="login-subtitle"><em>Your daily habit companion</em></div>
        </div>

        <div class="login-card glass-strong">
          <div class="login-card-title">Sign in to your space</div>

          <div class="field">
            <label class="field-label" for="inp-name">Your Name</label>
            <div class="input-row neu-inset-sm">
              <i class="fa-solid fa-user"></i>
              <input type="text" id="inp-name" placeholder="e.g. Ahmad Khan"
                     autocomplete="name" />
            </div>
            <div class="field-error" id="err-name">Name is required</div>
          </div>

          <div class="field">
            <label class="field-label" for="inp-email">Email Address</label>
            <div class="input-row neu-inset-sm">
              <i class="fa-solid fa-envelope"></i>
              <input type="email" id="inp-email" placeholder="you@gmail.com"
                     autocomplete="email" inputmode="email" />
            </div>
            <div class="field-error" id="err-email">Enter a valid email address</div>
          </div>

          <button class="btn-primary" id="btn-login">
            Start Tracking <i class="fa-solid fa-arrow-right"></i>
          </button>
        </div>

        <div class="login-footer">
          Data is stored on this device.<br/>
          Each email address has its own private space.
        </div>
      </div>
    </div>`;

  function doLogin() {
    const nameEl  = document.getElementById('inp-name');
    const emailEl = document.getElementById('inp-email');
    const errN    = document.getElementById('err-name');
    const errE    = document.getElementById('err-email');
    const card    = document.querySelector('.login-card');
    const name    = nameEl.value.trim();
    const email   = emailEl.value.trim().toLowerCase();
    let ok = true;

    errN.classList.remove('show');
    errE.classList.remove('show');

    if (!name)  { errN.classList.add('show'); ok = false; }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errE.classList.add('show'); ok = false;
    }
    if (!ok) {
      card.classList.add('shake');
      card.addEventListener('animationend', () => card.classList.remove('shake'), { once: true });
      return;
    }

    setUser({ username: name, email });
    setHabitUser(email);
    setupNotifications();
    navigate('dashboard');
  }

  document.getElementById('btn-login').addEventListener('click', doLogin);
  document.getElementById('inp-name').addEventListener('keydown',
    e => { if (e.key === 'Enter') document.getElementById('inp-email').focus(); });
  document.getElementById('inp-email').addEventListener('keydown',
    e => { if (e.key === 'Enter') doLogin(); });
}

// ═══════════════════════════════════════════════════
// DASHBOARD PAGE
// ═══════════════════════════════════════════════════
async function renderDashboard(app) {
  app.innerHTML = spinner();

  const user  = getUser();
  const today = todayStr();

  let todayRec = await getDay(today);
  if (!todayRec) { todayRec = emptyDay(today); await saveDay(todayRec); }

  const allDays = await getAllDays();
  const last7   = lastNDates(7).map(d => allDays.find(r => r.date === d) || emptyDay(d));
  const last30d = lastNDates(30);
  const last30  = allDays.filter(r => last30d.includes(r.date));

  const tScore = dailyScore(todayRec);
  const w7     = avgScore(last7);
  const w30    = avgScore(last30);
  const first  = user ? esc(user.username.split(' ')[0]) : 'Friend';

  const sectionRows = SECTIONS.map(s => {
    const sc = sectionScore(todayRec[s.id] || {}, getActivities(s.id));
    return `
      <div class="section-card neu-raised-sm" data-nav="${s.id}">
        <div class="section-icon neu-inset-sm"><i class="fa-solid ${s.icon}"></i></div>
        <div class="section-label">${s.label}</div>
        <div class="section-score ${scoreColor(sc)}">${sc}%</div>
        <div class="section-arrow"><i class="fa-solid fa-chevron-right"></i></div>
      </div>`;
  }).join('');

  app.innerHTML = `
    <div class="page">
      <div class="dash-topbar">
        <div>
          <div class="dash-date">${formatDatePretty(today)}</div>
          <div class="dash-greet">Hey, ${first}</div>
        </div>
        <button class="btn-logout neu-raised-sm" id="btn-logout">
          <i class="fa-solid fa-right-from-bracket"></i> Out
        </button>
      </div>

      <div class="score-hero glass-card">
        <div class="score-hero-num ${scoreColor(tScore)}">${tScore}</div>
        <div class="score-hero-label">Today's Score</div>
        <div class="score-hero-msg">${scoreMessage(tScore)}</div>
      </div>

      <div class="score-grid">
        <div class="score-mini glass-card">
          <div class="score-mini-label">7-Day Avg</div>
          <div class="score-mini-num ${scoreColor(w7)}">${w7}<sup>%</sup></div>
        </div>
        <div class="score-mini glass-card">
          <div class="score-mini-label">30-Day Avg</div>
          <div class="score-mini-num ${scoreColor(w30)}">${w30}<sup>%</sup></div>
        </div>
      </div>

      <div class="chart-card glass-card">
        <div class="chart-title">7-Day Trend</div>
        <canvas id="week-chart" class="chart-canvas"></canvas>
      </div>

      <div class="sections-title">Sections</div>
      ${sectionRows}
    </div>`;

  renderChart(last7);

  document.getElementById('btn-logout').addEventListener('click', () => {
    clearUser();
    navigate('login');
  });
  document.querySelectorAll('.section-card[data-nav]').forEach(el =>
    el.addEventListener('click', () => navigate(el.dataset.nav))
  );
}

// ═══════════════════════════════════════════════════
// SECTION PAGE
// ═══════════════════════════════════════════════════
async function renderSection(app, section) {
  app.innerHTML = spinner();

  const meta  = SECTIONS.find(s => s.id === section);
  const today = todayStr();

  let rec = await getDay(today);
  if (!rec) rec = emptyDay(today);

  // Ensure all current activities exist in today's record
  const acts    = getActivities(section);
  const secData = { ...(rec[section] || {}) };
  acts.forEach(a => { if (!(a.id in secData)) secData[a.id] = false; });
  rec = { ...rec, [section]: secData };
  await saveDay(rec);

  drawSection(app, section, meta, rec, acts, false);
}

function drawSection(app, section, meta, rec, acts, editing) {
  const secData = rec[section] || {};
  const score   = sectionScore(secData, acts);
  const done    = acts.filter(a => secData[a.id]).length;
  const pct     = acts.length > 0 ? (done / acts.length) * 100 : 0;

  app.innerHTML = `
    <div class="page">
      <div class="section-page-header">
        <div class="section-page-icon neu-raised">
          <i class="fa-solid ${meta.icon}"></i>
        </div>
        <div class="section-page-title">${meta.label}</div>
        <div class="section-page-date">${formatDatePretty(todayStr())}</div>
        <button class="btn-edit neu-raised-sm" id="btn-edit">
          ${editing
            ? '<i class="fa-solid fa-check"></i> Done'
            : '<i class="fa-solid fa-pen"></i> Edit'}
        </button>
      </div>

      <div class="section-score-card glass-card">
        <div class="section-score-num ${scoreColor(score)}" id="score-num">
          ${score}<sup>%</sup>
        </div>
        <div class="section-score-sub" id="score-sub">
          ${done} of ${acts.length} completed
        </div>
        <div class="progress-track neu-inset-sm">
          <div class="progress-fill" id="prog-fill" style="width:${pct}%"></div>
        </div>
      </div>

      <div class="habits-list" id="habits-list">
        ${editing ? buildEditRows(acts) : buildViewRows(acts, secData)}
      </div>
    </div>`;

  // Edit / Done button
  document.getElementById('btn-edit').addEventListener('click', async () => {
    if (editing) {
      // Collect renamed labels
      const updated = [];
      document.querySelectorAll('.edit-row[data-id]').forEach(row => {
        const id    = row.dataset.id;
        const label = row.querySelector('input').value.trim();
        const orig  = acts.find(a => a.id === id);
        if (orig) updated.push({ id, label: label || orig.label });
      });
      setActivities(section, updated);
      await renderSection(app, section);
    } else {
      drawSection(app, section, meta, rec, acts, true);
    }
  });

  if (editing) {
    bindEditRows(app, section, meta, rec, acts);
  } else {
    bindViewRows(section, meta, rec, acts);
  }
}

// ── View mode ─────────────────────────────────────
function buildViewRows(acts, secData) {
  if (acts.length === 0) {
    return `<div class="empty-state">
      <p>No activities yet.</p>
      <a id="lnk-edit">Tap Edit to add some</a>
    </div>`;
  }
  return acts.map(a => {
    const checked = secData[a.id] === true;
    return `
      <div class="habit-row ${checked ? 'checked' : ''}" data-id="${a.id}">
        <div class="habit-check ${checked ? 'checked-state' : 'unchecked'}">
          ${checked ? '<i class="fa-solid fa-check"></i>' : ''}
        </div>
        <div class="habit-label">${esc(a.label)}</div>
        <div class="habit-dot"></div>
      </div>`;
  }).join('');
}

function bindViewRows(section, meta, rec, acts) {
  // Empty state edit link
  const lnk = document.getElementById('lnk-edit');
  if (lnk) {
    lnk.addEventListener('click', () =>
      drawSection(document.getElementById('app'), section, meta, rec, acts, true)
    );
  }

  document.querySelectorAll('.habit-row[data-id]').forEach(row => {
    row.addEventListener('click', async () => {
      const id      = row.dataset.id;
      const checked = !row.classList.contains('checked');
      const secData = { ...(rec[section] || {}), [id]: checked };
      rec = { ...rec, [section]: secData };
      await saveDay(rec);

      // Fast DOM update — no full re-render
      row.classList.toggle('checked', checked);
      const chk = row.querySelector('.habit-check');
      chk.className = 'habit-check ' + (checked ? 'checked-state' : 'unchecked');
      chk.innerHTML = checked ? '<i class="fa-solid fa-check"></i>' : '';

      // Update score panel
      const s   = sectionScore(secData, acts);
      const d   = acts.filter(a => secData[a.id]).length;
      const pct = acts.length > 0 ? (d / acts.length) * 100 : 0;
      const numEl  = document.getElementById('score-num');
      const subEl  = document.getElementById('score-sub');
      const fillEl = document.getElementById('prog-fill');
      if (numEl)  { numEl.className = 'section-score-num ' + scoreColor(s); numEl.innerHTML = s + '<sup>%</sup>'; }
      if (subEl)  subEl.textContent = d + ' of ' + acts.length + ' completed';
      if (fillEl) fillEl.style.width = pct + '%';
    });
  });
}

// ── Edit mode ─────────────────────────────────────
function buildEditRows(acts) {
  const rows = acts.map(a => `
    <div class="edit-row" data-id="${a.id}">
      <input type="text" value="${esc(a.label)}" placeholder="Activity name" />
      <button class="btn-delete" data-del="${a.id}">
        <i class="fa-solid fa-trash"></i>
      </button>
    </div>`).join('');

  return rows + `
    <div class="add-row">
      <input type="text" id="inp-new" placeholder="New activity name..." />
      <button class="btn-add" id="btn-add" disabled>
        <i class="fa-solid fa-plus"></i>
      </button>
    </div>`;
}

function bindEditRows(app, section, meta, rec, acts) {
  // Delete buttons
  document.querySelectorAll('.btn-delete[data-del]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id      = btn.dataset.del;
      const newActs = acts.filter(a => a.id !== id);
      setActivities(section, newActs);
      const secData = { ...(rec[section] || {}) };
      delete secData[id];
      rec = { ...rec, [section]: secData };
      await saveDay(rec);
      acts = newActs;
      drawSection(app, section, meta, rec, acts, true);
    });
  });

  // Add activity
  const inpNew = document.getElementById('inp-new');
  const btnAdd = document.getElementById('btn-add');
  if (!inpNew || !btnAdd) return;

  inpNew.addEventListener('input', () => {
    btnAdd.disabled = !inpNew.value.trim();
  });
  inpNew.addEventListener('keydown', e => { if (e.key === 'Enter') btnAdd.click(); });
  btnAdd.addEventListener('click', async () => {
    const label = inpNew.value.trim();
    if (!label) return;
    const newAct  = { id: genId(), label };
    const newActs = [...acts, newAct];
    setActivities(section, newActs);
    const secData = { ...(rec[section] || {}), [newAct.id]: false };
    rec  = { ...rec, [section]: secData };
    acts = newActs;
    await saveDay(rec);
    drawSection(app, section, meta, rec, acts, true);
    setTimeout(() => { const el = document.getElementById('inp-new'); if (el) el.focus(); }, 40);
  });
}

// ── Spinner ───────────────────────────────────────
function spinner() {
  return `<div class="page" style="text-align:center;padding:60px 0;color:var(--fg-muted)">
    <i class="fa-solid fa-spinner fa-spin fa-2x"></i>
  </div>`;
}

// ── Bottom Nav Delegate ───────────────────────────
document.getElementById('bottom-nav').addEventListener('click', e => {
  const item = e.target.closest('.nav-item[data-page]');
  if (item) navigate(item.dataset.page);
});

// ── Init ──────────────────────────────────────────
(function init() {
  ensureBlobs();
  const user = getUser();
  if (user) {
    setHabitUser(user.email);
    navigate('dashboard');
  } else {
    navigate('login');
  }
})();
