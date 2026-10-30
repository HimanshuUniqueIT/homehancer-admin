// Shared runtime for every admin page: data store, layout shell, tables, dialogs, charts, Razorpay checkout.
(function () {
  const STORE_KEY = 'hh_admin_db';
  const SESSION_KEY = 'hh_admin_session';

  // ---------- Page loader ----------
  const loader = document.createElement('div');
  loader.className = 'page-loader';
  loader.setAttribute('role', 'status');
  loader.setAttribute('aria-label', 'Loading');
  loader.innerHTML = '<div class="page-loader-mark"><span class="page-loader-ring"></span><img src="/assets/brand/logo-192.png" alt="" width="34" height="34"></div>';
  document.body.appendChild(loader);
  const hideLoader = () => loader.classList.add('hidden-loader');
  const showLoader = () => loader.classList.remove('hidden-loader');
  const loaderStart = Date.now();
  window.addEventListener('load', () => setTimeout(hideLoader, Math.max(0, 500 - (Date.now() - loaderStart))));
  setTimeout(hideLoader, 2500);
  window.addEventListener('pageshow', e => { if (e.persisted) hideLoader(); });
  window.addEventListener('beforeunload', showLoader);
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href]');
    if (!a || e.defaultPrevented || e.ctrlKey || e.metaKey || e.shiftKey || a.target || a.hasAttribute('download')) return;
    const href = a.getAttribute('href');
    if (href.startsWith('/') && !href.startsWith('//')) showLoader();
  });

  // ---------- Store ----------
  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_KEY));
      if (saved && saved.version === window.HH_SEED.version) return saved;
    } catch {}
    return structuredClone(window.HH_SEED);
  }
  const db = load();
  function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(db)); } catch {} }
  function reset() { try { localStorage.removeItem(STORE_KEY); } catch {} location.reload(); }

  const session = (() => { try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY)); } catch { return null; } })();
  const page = document.body.dataset.page;
  if (page !== 'login' && !session) { location.replace('/login?next=' + encodeURIComponent(location.pathname + location.search)); return; }

  // ---------- Formatting ----------
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const inr = (n, dec = 0) => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  const num = (n) => Number(n || 0).toLocaleString('en-IN');
  const date = (iso) => iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
  const time = (iso) => iso ? new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }) : '';
  const datetime = (iso) => iso ? `${date(iso)}, ${time(iso)}` : '—';
  const rel = (iso) => {
    if (!iso) return '—';
    const s = (Date.now() - new Date(iso)) / 1000, a = Math.abs(s), f = s >= 0;
    const v = a < 60 ? 'just now' : a < 3600 ? `${Math.round(a / 60)} min` : a < 86400 ? `${Math.round(a / 3600)} h` : `${Math.round(a / 86400)} d`;
    return v === 'just now' ? v : f ? v + ' ago' : 'in ' + v;
  };
  const initials = (name) => (name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const uid = (p, n = 14) => p + '_' + Array.from(crypto.getRandomValues(new Uint8Array(n)), b => 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'[b % 56]).join('');
  const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();

  // ---------- Lookups ----------
  const by = (list, id) => list.find(x => x.id === id);
  const customer = (id) => by(db.customers, id) || { name: 'Unknown customer', phone: '' };
  const partner = (id) => by(db.partners, id);
  const service = (id) => by(db.services, id) || { name: 'Removed service' };
  const category = (id) => by(db.categories, id) || { name: id };

  // ---------- Status badges ----------
  const STATUS = {
    booking: { pending: ['Pending', 'warn'], confirmed: ['Confirmed', 'info'], assigned: ['Assigned', 'accent'], in_progress: ['In progress', 'accent'], completed: ['Completed', 'good'], cancelled: ['Cancelled', 'bad'] },
    pay: { paid: ['Paid', 'good'], pending: ['Unpaid', 'warn'], failed: ['Failed', 'bad'], refunded: ['Refunded', 'info'], partially_refunded: ['Part refunded', 'info'] },
    tx: { captured: ['Captured', 'good'], authorized: ['Authorized', 'warn'], failed: ['Failed', 'bad'], refunded: ['Refunded', 'info'], partially_refunded: ['Part refunded', 'info'] },
    partner: { active: ['Active', 'good'], pending: ['KYC pending', 'warn'], suspended: ['Suspended', 'bad'], rejected: ['Rejected', 'bad'] },
    kyc: { verified: ['Verified', 'good'], submitted: ['To review', 'warn'], missing: ['Missing', 'bad'], rejected: ['Rejected', 'bad'] },
    payout: { paid: ['Paid', 'good'], pending: ['Pending', 'warn'], processing: ['Processing', 'info'], failed: ['Failed', 'bad'] },
    ticket: { open: ['Open', 'warn'], in_progress: ['In progress', 'info'], resolved: ['Resolved', 'good'] },
    priority: { urgent: ['Urgent', 'bad'], high: ['High', 'warn'], normal: ['Normal', 'accent'], low: ['Low', ''] },
    review: { published: ['Published', 'good'], pending: ['Pending', 'warn'], hidden: ['Hidden', ''] },
    generic: { active: ['Active', 'good'], inactive: ['Inactive', ''], draft: ['Draft', ''], published: ['Published', 'good'], scheduled: ['Scheduled', 'info'], invited: ['Invited', 'warn'], blocked: ['Blocked', 'bad'], expired: ['Expired', ''], processed: ['Processed', 'good'], rejected: ['Rejected', 'bad'], duplicate: ['Duplicate', 'warn'] }
  };
  const badge = (type, value) => { const [label, k] = (STATUS[type] || STATUS.generic)[value] || STATUS.generic[value] || [value, '']; return `<span class="badge ${k ? 'b-' + k : ''}">${esc(label)}</span>`; };

  // ---------- Icons ----------
  const P = {
    dashboard: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
    bookings: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M8 15l2 2 4-4"/>',
    customers: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    partners: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
    services: '<path d="M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9zM3 9l2.45-4.9A2 2 0 0 1 7.24 3h9.52a2 2 0 0 1 1.8 1.1L21 9M12 3v6"/>',
    zones: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>',
    payments: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/>',
    payouts: '<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
    razorpay: '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>',
    coupons: '<path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><circle cx="7" cy="7" r="1.5"/>',
    reviews: '<path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>',
    support: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    content: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>',
    notifications: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    reports: '<path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/>',
    admins: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
    copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
    alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3zM12 9v4M12 17h.01"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5"/>',
    edit: '<path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    trash: '<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    send: '<path d="m22 2-7 20-4-9-9-4zM22 2 11 13"/>',
    logo: '<path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" fill="#fff" stroke="none"/>'
  };
  const icon = (name, attrs = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${attrs}>${P[name] || ''}</svg>`;

  // ---------- Navigation ----------
  const NAV = [
    ['Overview', [['dashboard', 'Dashboard', '/dashboard'], ['reports', 'Reports', '/reports']]],
    ['Operations', [['bookings', 'Bookings', '/bookings', () => db.bookings.filter(b => b.status === 'pending').length], ['customers', 'Customers', '/customers'], ['partners', 'Partners', '/partners', () => db.partners.filter(p => p.status === 'pending').length], ['services', 'Services', '/services'], ['zones', 'Zones', '/zones']]],
    ['Finance', [['payments', 'Payments', '/payments'], ['payouts', 'Partner payouts', '/payouts'], ['razorpay', 'Razorpay', '/razorpay']]],
    ['Growth', [['coupons', 'Coupons & offers', '/coupons'], ['reviews', 'Reviews', '/reviews', () => db.reviews.filter(r => r.status === 'pending').length], ['support', 'Support tickets', '/support', () => db.tickets.filter(t => t.status === 'open').length], ['content', 'Content & SEO', '/content'], ['notifications', 'Notifications', '/notifications']]],
    ['Admin', [['admins', 'Admin users', '/admins'], ['settings', 'Settings', '/settings']]]
  ];

  function shell({ title, subtitle = '', crumbs = '', actions = '' }) {
    const nav = NAV.map(([label, items]) => `
      <div class="nav-group"><div class="nav-label">${label}</div>
        ${items.map(([key, name, href, count]) => { const c = count ? count() : 0; return `<a class="nav-link ${key === page || (page === 'booking' && key === 'bookings') ? 'active' : ''}" href="${href}">${icon(key)}<span>${name}</span>${c ? `<span class="nav-count">${c}</span>` : ''}</a>`; }).join('')}
      </div>`).join('');
    const me = session || { name: 'Admin', role: 'Super Admin' };
    document.getElementById('app').innerHTML = `
      <div class="shell">
        <aside class="sidebar" id="sidebar">
          <a class="brand" href="/dashboard" style="text-decoration:none"><span class="brand-mark"><img src="/assets/brand/logo-192.png" alt="" width="26" height="26"></span><span><div class="brand-name">HomeHancer</div><div class="brand-sub">Admin console</div></span></a>
          ${nav}
        </aside>
        <div class="main">
          <header class="topbar">
            <button class="icon-btn menu-btn" id="menuBtn" aria-label="Open menu">${icon('menu')}</button>
            <div class="search">${icon('search')}<input id="globalSearch" type="search" placeholder="Search bookings, customers, partners…" autocomplete="off" aria-label="Search"><div class="search-results hidden" id="searchResults"></div></div>
            <div class="top-actions">
              <a href="/razorpay" id="modePill" class="mode-pill badge plain">Razorpay</a>
              <button class="icon-btn" id="themeBtn" aria-label="Switch light or dark theme" title="Switch theme">${icon('moon')}</button>
              <div style="position:relative">
                <button class="icon-btn" id="bellBtn" aria-label="Notifications">${icon('bell')}${db.notifications.length ? '<span class="dot"></span>' : ''}</button>
                <div class="dropdown hidden" id="bellMenu" style="min-width:320px">${db.notifications.map(n => `<a class="notif" href="${n.href}"><div>${esc(n.text)}</div><div class="cell-sub">${rel(n.at)}</div></a>`).join('') || '<div class="notif muted">No notifications</div>'}</div>
              </div>
              <div style="position:relative">
                <button class="user-menu" id="userBtn" aria-label="Account menu"><span class="avatar">${initials(me.name)}</span><span class="small user-name" style="text-align:left;line-height:1.2"><b>${esc(me.name)}</b><br><span class="muted">${esc(me.role)}</span></span></button>
                <div class="dropdown hidden" id="userMenu">
                  <a href="/admins">My account & roles</a>
                  <button id="resetBtn">Reset sample data</button>
                  <button id="logoutBtn">Sign out</button>
                </div>
              </div>
            </div>
          </header>
          <main class="content" id="content">
            <div class="page-head"><div>${crumbs ? `<div class="crumbs">${crumbs}</div>` : ''}<h1>${esc(title)}</h1>${subtitle ? `<p>${subtitle}</p>` : ''}</div><div class="row" id="pageActions">${actions}</div></div>
            <div id="view" class="stack" style="gap:20px"></div>
          </main>
        </div>
      </div>
      <div class="toasts" id="toasts" aria-live="polite"></div>`;
    document.title = `${title} · HomeHancer Admin`;
    wireShell();
    return document.getElementById('view');
  }

  function wireShell() {
    const $ = (id) => document.getElementById(id);
    const toggle = (btn, menu) => $(btn).addEventListener('click', e => { e.stopPropagation(); document.querySelectorAll('.dropdown').forEach(d => d.id !== menu && d.classList.add('hidden')); $(menu).classList.toggle('hidden'); });
    toggle('bellBtn', 'bellMenu'); toggle('userBtn', 'userMenu');
    document.addEventListener('click', () => { document.querySelectorAll('.dropdown').forEach(d => d.classList.add('hidden')); $('searchResults').classList.add('hidden'); $('sidebar').classList.remove('open'); });
    $('menuBtn').addEventListener('click', e => { e.stopPropagation(); $('sidebar').classList.toggle('open'); });
    $('sidebar').addEventListener('click', e => e.stopPropagation());
    $('logoutBtn').addEventListener('click', () => { try { sessionStorage.removeItem(SESSION_KEY); localStorage.removeItem(SESSION_KEY); } catch {} location.href = '/login'; });
    $('resetBtn').addEventListener('click', async () => { if (await confirmDialog({ title: 'Reset sample data?', text: 'All bookings, payments and settings you changed in this browser go back to the original sample data.', ok: 'Reset data', danger: true })) reset(); });
    $('themeBtn').addEventListener('click', () => {
      const dark = document.documentElement.dataset.theme === 'dark';
      document.documentElement.dataset.theme = dark ? 'light' : 'dark';
      try { localStorage.setItem('hh_theme_v2', document.documentElement.dataset.theme); } catch {}
    });
    // Global search
    const input = $('globalSearch'), out = $('searchResults');
    input.addEventListener('click', e => e.stopPropagation());
    input.addEventListener('input', () => {
      const q = input.value.trim().toLowerCase();
      if (q.length < 2) return out.classList.add('hidden');
      const hits = [
        ...db.bookings.filter(b => b.id.toLowerCase().includes(q) || customer(b.customerId).name.toLowerCase().includes(q)).slice(0, 5).map(b => [`/bookings/${b.id}`, `<b>${b.id}</b> · ${esc(service(b.serviceId).name)}`, `${esc(customer(b.customerId).name)} · ${date(b.slot)}`]),
        ...db.customers.filter(c => (c.name + c.phone + c.email).toLowerCase().includes(q)).slice(0, 4).map(c => [`/customers?id=${c.id}`, `<b>${esc(c.name)}</b>`, `Customer · ${esc(c.phone)}`]),
        ...db.partners.filter(p => (p.name + p.phone).toLowerCase().includes(q)).slice(0, 4).map(p => [`/partners?id=${p.id}`, `<b>${esc(p.name)}</b>`, `Partner · ${p.skills.map(s => category(s).name).join(', ')}`]),
        ...db.transactions.filter(t => t.id.toLowerCase().includes(q) || t.orderId.toLowerCase().includes(q)).slice(0, 3).map(t => [`/payments/${t.id}`, `<b class="mono">${t.id}</b>`, `Payment · ${inr(t.amount)}`])
      ];
      out.innerHTML = hits.length ? hits.map(([href, a, b]) => `<a href="${href}">${a}<div class="cell-sub">${b}</div></a>`).join('') : '<div class="empty">No matches</div>';
      out.classList.remove('hidden');
    });
    // Razorpay mode pill
    rzpConfig().then(cfg => {
      const pill = $('modePill');
      if (!cfg) { pill.textContent = 'Razorpay: test mode'; pill.className = 'mode-pill badge plain'; pill.title = 'Server not running, checkout is simulated'; return; }
      const keys = cfg.mode === 'live' ? cfg.live : cfg.test;
      const ready = keys.keyId && keys.hasSecret;
      pill.textContent = cfg.enabled ? (cfg.mode === 'live' ? 'Razorpay LIVE' : ready ? 'Razorpay test mode' : 'Razorpay: add keys') : 'Razorpay off';
      pill.className = 'mode-pill badge plain ' + (!cfg.enabled ? '' : cfg.mode === 'live' ? 'b-good' : ready ? 'b-warn' : 'b-bad');
    });
  }

  // ---------- Toasts & dialogs ----------
  function toast(msg, kind = '') {
    const t = document.createElement('div');
    t.className = 'toast ' + kind;
    t.innerHTML = `${kind === 'good' ? icon('check', 'style="width:16px"') : kind === 'bad' ? icon('alert', 'style="width:16px"') : ''}<span>${esc(msg)}</span>`;
    (document.getElementById('toasts') || document.body).appendChild(t);
    setTimeout(() => t.remove(), 3800);
  }

  function modal({ title, body, foot = '', wide = false, drawer = false, onOpen }) {
    const wrap = document.createElement('div');
    wrap.className = 'overlay' + (drawer ? ' drawer-wrap' : '');
    wrap.innerHTML = `<div class="${drawer ? 'drawer' : 'modal' + (wide ? ' wide' : '')}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="modal-head"><h2>${title}</h2><button class="icon-btn" data-close aria-label="Close">${icon('x')}</button></div>
      <div class="modal-body">${body}</div>${foot ? `<div class="modal-foot">${foot}</div>` : ''}</div>`;
    const close = () => { wrap.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    wrap.addEventListener('mousedown', e => { if (e.target === wrap) close(); });
    wrap.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', close));
    document.addEventListener('keydown', onKey);
    document.body.appendChild(wrap);
    const first = wrap.querySelector('input:not([type=hidden]), select, textarea');
    if (first) first.focus();
    const api = { el: wrap, close, $: (s) => wrap.querySelector(s), $$: (s) => [...wrap.querySelectorAll(s)] };
    onOpen && onOpen(api);
    return api;
  }
  const drawer = (opts) => modal({ ...opts, drawer: true });

  function confirmDialog({ title, text, ok = 'Confirm', danger = false, input = null }) {
    return new Promise(resolve => {
      const m = modal({
        title: esc(title),
        body: `<p style="margin:0 0 ${input ? 14 : 0}px">${esc(text)}</p>${input ? `<div class="field"><label for="cdInput">${esc(input.label)}</label>${input.type === 'textarea' ? `<textarea id="cdInput">${esc(input.value || '')}</textarea>` : `<input id="cdInput" value="${esc(input.value || '')}">`}</div>` : ''}`,
        foot: `<button class="btn" data-close>Cancel</button><button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="cdOk">${esc(ok)}</button>`
      });
      m.$('#cdOk').addEventListener('click', () => { const v = input ? m.$('#cdInput').value : true; m.close(); resolve(v); });
      m.el.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => resolve(false)));
    });
  }

  // Reads every [name] control in a container into an object. Supports name="a.b" nesting and checkboxes.
  function formData(root) {
    const out = {};
    root.querySelectorAll('[name]').forEach(el => {
      let v = el.type === 'checkbox' ? el.checked : el.type === 'number' ? (el.value === '' ? '' : Number(el.value)) : el.value;
      if (el.type === 'radio' && !el.checked) return;
      if (el.multiple) v = [...el.selectedOptions].map(o => o.value);
      const keys = el.name.split('.');
      let o = out; keys.slice(0, -1).forEach(k => (o = o[k] = o[k] || {}));
      o[keys.at(-1)] = v;
    });
    return out;
  }
  const opt = (list, selected) => list.map(o => { const [v, l] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}" ${String(v) === String(selected) ? 'selected' : ''}>${esc(l)}</option>`; }).join('');
  const sw = (name, checked, label) => `<label class="switch"><input type="checkbox" name="${name}" id="f-${name.replace(/\./g, '-')}" ${checked ? 'checked' : ''}><span class="track"></span>${label ? `<span>${label}</span>` : ''}</label>`;

  // ---------- Data table ----------
  // columns: [{ key, label, render(row), sort(row) -> value, align:'right' }]
  function table(el, { columns, rows, search, filters = [], pageSize = 12, onRow, empty = 'Nothing matches these filters.', tools = '', tabs, defaultSort }) {
    const state = { q: '', f: {}, page: 1, sort: defaultSort || null, dir: -1, tab: tabs ? tabs.items[0][0] : null };
    el.innerHTML = `${tabs ? `<div class="tabs" role="tablist"></div>` : ''}<div class="table-tools">${search ? `<input type="search" placeholder="${esc(search.placeholder || 'Search')}" aria-label="Search table">` : ''}${filters.map((f, i) => `<select data-f="${i}" aria-label="${esc(f.label)}"><option value="">${esc(f.label)}: All</option>${opt(f.options)}</select>`).join('')}<span class="spacer"></span>${tools}</div><div class="table-wrap"><table><thead></thead><tbody></tbody></table></div><div class="pager"></div>`;
    const getRows = typeof rows === 'function' ? rows : () => rows;
    const render = () => {
      let list = getRows();
      if (tabs && state.tab) list = list.filter(r => tabs.match(r, state.tab));
      if (state.q && search) list = list.filter(r => search.fields(r).join(' ').toLowerCase().includes(state.q));
      filters.forEach((f, i) => { if (state.f[i]) list = list.filter(r => String(f.value(r)) === state.f[i]); });
      if (state.sort) { const c = columns.find(c => c.key === state.sort); if (c?.sort) list = [...list].sort((a, b) => { const x = c.sort(a), y = c.sort(b); return (x > y ? 1 : x < y ? -1 : 0) * state.dir; }); }
      const pages = Math.max(1, Math.ceil(list.length / pageSize));
      state.page = Math.min(state.page, pages);
      const slice = list.slice((state.page - 1) * pageSize, state.page * pageSize);
      if (tabs) el.querySelector('.tabs').innerHTML = tabs.items.map(([k, l]) => `<button class="tab ${k === state.tab ? 'active' : ''}" data-tab="${k}">${l}<span class="count">${getRows().filter(r => tabs.match(r, k)).length}</span></button>`).join('');
      el.querySelector('thead').innerHTML = `<tr>${columns.map(c => `<th class="${c.sort ? 'sortable' : ''} ${c.align || ''}" data-k="${c.key}">${c.label}${state.sort === c.key ? (state.dir > 0 ? ' ↑' : ' ↓') : ''}</th>`).join('')}</tr>`;
      el.querySelector('tbody').innerHTML = slice.length ? slice.map((r, i) => `<tr data-i="${i}" class="${onRow ? 'clickable' : ''}">${columns.map(c => `<td class="${c.align || ''}">${c.render ? c.render(r) : esc(r[c.key])}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${columns.length}"><div class="empty">${empty}</div></td></tr>`;
      el.querySelector('.pager').innerHTML = `<span>${list.length ? `Showing ${(state.page - 1) * pageSize + 1}–${Math.min(state.page * pageSize, list.length)} of ${num(list.length)}` : 'No results'}</span><span class="row"><button class="btn btn-sm" data-p="-1" ${state.page <= 1 ? 'disabled' : ''}>Previous</button><span>Page ${state.page} of ${pages}</span><button class="btn btn-sm" data-p="1" ${state.page >= pages ? 'disabled' : ''}>Next</button></span>`;
      el.querySelectorAll('tbody tr[data-i]').forEach(tr => onRow && tr.addEventListener('click', e => { if (!e.target.closest('button, a, input, select')) onRow(slice[+tr.dataset.i]); }));
      api.visible = list;
    };
    el.addEventListener('click', e => {
      const th = e.target.closest('th.sortable'); if (th) { state.dir = state.sort === th.dataset.k ? -state.dir : -1; state.sort = th.dataset.k; render(); }
      const p = e.target.closest('[data-p]'); if (p) { state.page += +p.dataset.p; render(); }
      const t = e.target.closest('[data-tab]'); if (t) { state.tab = t.dataset.tab; state.page = 1; render(); }
    });
    el.querySelector('input[type=search]')?.addEventListener('input', e => { state.q = e.target.value.trim().toLowerCase(); state.page = 1; render(); });
    el.querySelectorAll('select[data-f]').forEach(s => s.addEventListener('change', () => { state.f[s.dataset.f] = s.value; state.page = 1; render(); }));
    const api = { render, state, visible: [] };
    render();
    return api;
  }

  function toCSV(rows, cols) {
    const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    return [cols.map(c => q(c[0])).join(','), ...rows.map(r => cols.map(c => q(c[1](r))).join(','))].join('\n');
  }
  function downloadCSV(name, rows, cols) {
    const blob = new Blob([toCSV(rows, cols)], { type: 'text/csv' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: name });
    document.body.appendChild(a); a.click(); a.remove();
    toast(`Exported ${rows.length} rows to ${name}`, 'good');
  }

  // ---------- Charts (single-series, accent colour, hover tooltips) ----------
  function lineChart(el, points, { format = inr, height = 220 } = {}) {
    const W = 720, H = height, pad = { l: 56, r: 12, t: 12, b: 28 };
    const max = Math.max(...points.map(p => p.value), 1);
    const step = niceStep(max / 4), top = Math.ceil(max / step) * step;
    const x = (i) => pad.l + (i / Math.max(points.length - 1, 1)) * (W - pad.l - pad.r);
    const y = (v) => pad.t + (1 - v / top) * (H - pad.t - pad.b);
    const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
    const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join('');
    const every = Math.ceil(points.length / 8);
    el.classList.add('chart');
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Line chart">
      ${ticks.map(t => `<line class="grid-line" x1="${pad.l}" x2="${W - pad.r}" y1="${y(t)}" y2="${y(t)}"/><text class="axis-text" x="${pad.l - 8}" y="${y(t) + 4}" text-anchor="end">${format(t, true)}</text>`).join('')}
      ${points.map((p, i) => (i % every === 0 && points.length - 1 - i >= every / 2) || i === points.length - 1 ? `<text class="axis-text" x="${x(i)}" y="${H - 8}" text-anchor="middle">${esc(p.label)}</text>` : '').join('')}
      <path class="area" d="${path}L${x(points.length - 1)},${y(0)}L${x(0)},${y(0)}Z"/>
      <path class="line" d="${path}"/>
      <circle class="marker" cx="${x(points.length - 1)}" cy="${y(points.at(-1).value)}" r="4.5"/>
      <line class="crosshair hidden" y1="${pad.t}" y2="${H - pad.b}"/><circle class="marker hover-dot hidden" r="4.5"/>
      <rect x="${pad.l}" y="0" width="${W - pad.l - pad.r}" height="${H}" fill="transparent" class="hit"/>
    </svg><div class="tip hidden"></div>`;
    const svg = el.querySelector('svg'), tip = el.querySelector('.tip'), ch = el.querySelector('.crosshair'), dot = el.querySelector('.hover-dot');
    svg.querySelector('.hit').addEventListener('mousemove', e => {
      const r = svg.getBoundingClientRect(), sx = (e.clientX - r.left) * (W / r.width);
      const i = Math.max(0, Math.min(points.length - 1, Math.round((sx - pad.l) / ((W - pad.l - pad.r) / Math.max(points.length - 1, 1)))));
      const px = x(i), py = y(points[i].value);
      ch.setAttribute('x1', px); ch.setAttribute('x2', px); dot.setAttribute('cx', px); dot.setAttribute('cy', py);
      [ch, dot, tip].forEach(n => n.classList.remove('hidden'));
      tip.innerHTML = `<b>${esc(points[i].label)}</b> · ${format(points[i].value)}${points[i].sub ? ' · ' + esc(points[i].sub) : ''}`;
      tip.style.left = (px / W) * r.width + 'px'; tip.style.top = (py / H) * r.height - 6 + 'px';
    });
    svg.querySelector('.hit').addEventListener('mouseleave', () => [ch, dot, tip].forEach(n => n.classList.add('hidden')));
  }
  function barChart(el, points, { format = num, height = 200 } = {}) {
    const W = 720, H = height, pad = { l: 44, r: 8, t: 10, b: 28 };
    const max = Math.max(...points.map(p => p.value), 1), step = niceStep(max / 4), top = Math.ceil(max / step) * step;
    const bw = (W - pad.l - pad.r) / points.length, gap = Math.max(2, bw * .25);
    const y = (v) => pad.t + (1 - v / top) * (H - pad.t - pad.b);
    const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
    const every = Math.ceil(points.length / 10);
    el.classList.add('chart');
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Bar chart">
      ${ticks.map(t => `<line class="grid-line" x1="${pad.l}" x2="${W - pad.r}" y1="${y(t)}" y2="${y(t)}"/><text class="axis-text" x="${pad.l - 8}" y="${y(t) + 4}" text-anchor="end">${format(t, true)}</text>`).join('')}
      ${points.map((p, i) => { const x0 = pad.l + i * bw + gap / 2, h = Math.max(0, y(0) - y(p.value)); return `<path class="bar" data-i="${i}" d="M${x0},${y(0)}v${-Math.max(h - 4, 0)}q0,-4 4,-4h${bw - gap - 8}q4,0 4,4v${Math.max(h - 4, 0)}z"/>${i % every === 0 ? `<text class="axis-text" x="${x0 + (bw - gap) / 2}" y="${H - 8}" text-anchor="middle">${esc(p.label)}</text>` : ''}`; }).join('')}
    </svg><div class="tip hidden"></div>`;
    const svg = el.querySelector('svg'), tip = el.querySelector('.tip');
    svg.querySelectorAll('.bar').forEach(b => {
      b.addEventListener('mouseenter', () => { const i = +b.dataset.i, r = svg.getBoundingClientRect(); tip.innerHTML = `<b>${esc(points[i].label)}</b> · ${format(points[i].value)}`; tip.style.left = ((pad.l + i * bw + bw / 2) / W) * r.width + 'px'; tip.style.top = (y(points[i].value) / H) * r.height - 4 + 'px'; tip.classList.remove('hidden'); });
      b.addEventListener('mouseleave', () => tip.classList.add('hidden'));
    });
  }
  function hbars(el, rows, format = inr) {
    const max = Math.max(...rows.map(r => r.value), 1);
    el.innerHTML = rows.map(r => `<div class="hbar-row" title="${esc(r.label)}: ${format(r.value)}"><span>${esc(r.label)}</span><span class="hbar-track"><span class="hbar-fill" style="width:${(r.value / max) * 100}%"></span></span><span class="right num">${format(r.value)}</span></div>`).join('');
  }
  function niceStep(raw) { const p = Math.pow(10, Math.floor(Math.log10(raw || 1))), n = raw / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p; }
  const compactINR = (v, axis) => axis ? (v >= 1e5 ? '₹' + (v / 1e5).toFixed(v % 1e5 ? 1 : 0) + 'L' : v >= 1e3 ? '₹' + (v / 1e3).toFixed(0) + 'k' : '₹' + v) : inr(v);

  // ---------- Server API ----------
  let serverUp = null;
  async function api(path, { method = 'GET', body } = {}) {
    const res = await fetch(path, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.error || `Request failed (HTTP ${res.status})`), { data });
    return data;
  }
  async function server() {
    if (serverUp !== null) return serverUp;
    try { await api('/api/health'); serverUp = true; } catch { serverUp = false; }
    return serverUp;
  }
  let cfgCache;
  async function rzpConfig(force) {
    if (cfgCache && !force) return cfgCache;
    if (!(await server())) return (cfgCache = null);
    try { return (cfgCache = await api('/api/razorpay/config')); } catch { return (cfgCache = null); }
  }

  // ---------- Audit ----------
  function audit(action) {
    db.audit.unshift({ at: new Date().toISOString(), admin: session?.name || 'Admin', action, ip: '127.0.0.1' });
    db.audit = db.audit.slice(0, 300);
    save();
  }

  // ---------- Razorpay checkout ----------
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) return resolve();
      const s = Object.assign(document.createElement('script'), { src, onload: resolve, onerror: () => reject(new Error('Could not load Razorpay Checkout. Check your internet connection.')) });
      document.head.appendChild(s);
    });
  }
  // Steps a payment went through, oldest first. Real Razorpay payments use the events recorded during checkout;
  // sample and test payments get typical step timings.
  const isSettled = (x) => x.status !== 'failed' && x.source !== 'razorpay' && new Date(x.createdAt).getTime() + 2 * 864e5 < Date.now();
  function paymentJourney(x) {
    const b = db.bookings.find(k => k.id === x.bookingId), steps = [];
    const start = new Date(x.createdAt).getTime();
    let h = 0; for (const ch of x.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    let t = start - 40000 - h % 30000;
    const add = (gap, actor, title, detail, tone) => { t += gap * 1000; steps.push({ at: new Date(t).toISOString(), actor, title, detail, tone }); };
    const AUTH = { upi: 'Customer approved with UPI PIN', card: 'Customer completed the bank OTP check', netbanking: 'Customer signed in to the bank', wallet: 'Customer approved from the wallet' };
    if (x.events) steps.push(...x.events);
    else {
      add(0, x.device === 'Admin panel' ? 'HomeHancer' : 'Customer', x.device === 'Admin panel' ? `Admin started collection of ${inr(x.amount)}` : `Customer tapped Pay ${inr(x.amount)}`, `${x.device || b?.source || 'App'} · Booking ${x.bookingId}`);
      add(1, 'HomeHancer', 'Razorpay order created', x.orderId);
      add(1, 'Razorpay', 'Checkout opened on the customer\'s screen');
      add(6 + h % 15, 'Customer', `Chose ${x.method === 'upi' ? 'UPI' : x.method === 'card' ? 'card' : x.method === 'netbanking' ? 'netbanking' : 'wallet'}`, x.instrument);
      if (x.status === 'failed') {
        const e = x.error || {};
        if (e.step !== 'payment_initiation' && e.reason !== 'payment_cancelled') add(10 + h % 20, 'Bank', 'Sent to the bank for approval');
        add(5 + h % 25, e.source === 'customer' ? 'Customer' : e.source === 'gateway' ? 'Razorpay' : 'Bank', 'Payment failed: ' + (e.description || 'Reason not returned'), e.reason ? `${e.code} · ${e.reason} · step ${e.step}` : '', 'bad');
        add(2, 'Razorpay', 'Webhook received: payment.failed', 'Booking kept unpaid');
        add(3, 'HomeHancer', 'Customer told the payment failed', 'Retry option shown in the app');
      } else {
        add(10 + h % 20, 'Customer', AUTH[x.method] || 'Customer approved the payment');
        add(2 + h % 4, 'Bank', 'Payment authorised by the bank');
        add(1, 'Razorpay', `Payment captured: ${inr(x.amount)}`, x.id, 'good');
        add(1, 'HomeHancer', 'Payment signature verified');
        add(2, 'Razorpay', 'Webhook received: payment.captured');
        add(1, 'HomeHancer', 'Booking marked as paid', 'Receipt sent to the customer by SMS');
      }
    }
    const next = db.transactions.filter(o => o.orderId === x.orderId && o.createdAt > x.createdAt).sort((p, q) => p.createdAt.localeCompare(q.createdAt))[0];
    if (next) steps.push({ at: next.createdAt, actor: 'Customer', title: 'Customer tried again', detail: `${next.id} · ${next.status === 'failed' ? 'failed too' : 'succeeded'}` });
    if (x.status !== 'failed') {
      const due = new Date(start + 2 * 864e5);
      const net = x.amount - x.fee - x.tax - x.refunds.filter(r => new Date(r.at) <= due).reduce((s, r) => s + r.amount, 0);
      if (isSettled(x)) steps.push({ at: due.toISOString(), actor: 'Razorpay', title: `Settled to your bank: ${inr(net, 2)}`, detail: `After ${inr(x.fee + x.tax, 2)} Razorpay fee and GST${net < x.amount - x.fee - x.tax ? ' and refunds' : ''} · UTR SETL${x.createdAt.slice(0, 10).replace(/-/g, '')}`, tone: 'good' });
      else steps.push({ at: due.toISOString(), actor: 'Razorpay', title: 'Settlement expected', detail: x.source === 'razorpay' ? 'Confirm in the Razorpay Dashboard' : `${inr(x.amount - x.fee - x.tax, 2)} after fee and GST`, tone: 'pending' });
    }
    for (const r of x.refunds) {
      steps.push({ at: r.at, actor: 'HomeHancer', title: `Refund started: ${inr(r.amount, 2)}`, detail: `${r.id}${r.reason ? ' · ' + r.reason : ''}` });
      steps.push({ at: r.at, actor: 'Razorpay', title: r.status === 'processed' ? 'Refund processed' : 'Refund ' + r.status, detail: r.speed === 'optimum' ? 'Instant refund' : 'Reaches the customer in 5–7 working days', tone: 'good' });
    }
    return steps.sort((p, q) => p.at.localeCompare(q.at));
  }

  function recordPayment(b, { paymentId, orderId, method, source, status = 'captured', amount, instrument, error, events }) {
    const fee = Math.round(amount * .02 * 100) / 100;
    db.transactions.unshift({ id: paymentId, orderId, bookingId: b.id, customerId: b.customerId, amount, method, status, fee: status === 'failed' ? 0 : fee, tax: status === 'failed' ? 0 : Math.round(fee * .18 * 100) / 100, createdAt: new Date().toISOString(), source, refunds: [], device: 'Admin panel', ...(instrument ? { instrument } : {}), ...(error ? { error } : {}), ...(events ? { events } : {}) });
    if (status === 'captured') {
      b.payStatus = 'paid'; if (b.payMode !== 'online') b.payMode = 'online';
      b.timeline.push({ at: new Date().toISOString(), text: `Payment received ${inr(amount)} via Razorpay (${method.toUpperCase()}) · ${paymentId}`, by: source === 'razorpay' ? 'razorpay' : 'test checkout' });
    } else {
      b.payStatus = 'failed';
      b.timeline.push({ at: new Date().toISOString(), text: `Payment failed via Razorpay · ${error?.description || 'reason not returned'} · ${paymentId}`, by: source === 'razorpay' ? 'razorpay' : 'test checkout' });
    }
    save();
  }

  // Opens Razorpay Checkout for a booking. Uses real Razorpay when the server has keys, otherwise a clearly-labelled simulator.
  async function collectPayment(b, onDone) {
    const amount = b.price.total;
    const cust = customer(b.customerId);
    const cfg = await rzpConfig(true);
    const keys = cfg ? (cfg.mode === 'live' ? cfg.live : cfg.test) : null;
    if (cfg && !cfg.enabled) return toast('Razorpay is turned off on the Razorpay page.', 'bad');

    if (keys?.keyId && keys.hasSecret) {
      try {
        const events = [];
        const mark = (actor, title, detail, tone) => events.push({ at: new Date().toISOString(), actor, title, detail, tone });
        mark('HomeHancer', `Payment started: ${inr(amount)}`, `Admin panel · Booking ${b.id}`);
        const { order, keyId, checkout } = await api('/api/razorpay/orders', { method: 'POST', body: { amount: Math.round(amount * 100), receipt: b.id, notes: { booking_id: b.id, customer_id: b.customerId } } });
        mark('HomeHancer', 'Razorpay order created', order.id);
        await loadScript('https://checkout.razorpay.com/v1/checkout.js');
        const methodFlags = checkout.methods || {};
        const rzp = new window.Razorpay({
          key: keyId, amount: order.amount, currency: order.currency, order_id: order.id,
          name: checkout.businessName, description: `${service(b.serviceId).name} · ${b.id}`, image: checkout.logoUrl || undefined,
          prefill: checkout.prefill ? { name: cust.name, email: cust.email, contact: cust.phone.replace(/\s/g, '') } : {},
          notes: { booking_id: b.id }, theme: { color: checkout.themeColor || '#C8287C' },
          timeout: (checkout.timeoutMinutes || 15) * 60, retry: { enabled: !!checkout.retry },
          method: Object.fromEntries(Object.entries(methodFlags).map(([k, v]) => [k, !!v])),
          handler: async (resp) => {
            try {
              const v = await api('/api/razorpay/verify', { method: 'POST', body: resp });
              if (!v.valid) { toast('Signature check failed. Payment NOT marked as paid.', 'bad'); return; }
              mark('Razorpay', 'Razorpay confirmed the payment', resp.razorpay_payment_id, 'good');
              mark('HomeHancer', 'Payment signature verified');
              mark('HomeHancer', 'Booking marked as paid');
              recordPayment(b, { paymentId: resp.razorpay_payment_id, orderId: resp.razorpay_order_id, method: 'razorpay', source: 'razorpay', amount, events });
              audit(`Collected ${inr(amount)} on ${b.id} via Razorpay (${resp.razorpay_payment_id})`);
              toast('Payment verified and recorded.', 'good'); onDone && onDone();
            } catch (e) { toast(e.message, 'bad'); }
          },
          modal: { ondismiss: () => toast('Checkout closed before payment.') }
        });
        rzp.on('payment.failed', (r) => { const e = r.error || {}; mark(e.source === 'customer' ? 'Customer' : 'Razorpay', 'Payment failed: ' + (e.description || 'Reason not returned'), [e.code, e.reason, e.step].filter(Boolean).join(' · '), 'bad'); recordPayment(b, { paymentId: e.metadata?.payment_id || uid('pay'), orderId: order.id, method: 'razorpay', source: 'razorpay', status: 'failed', amount, events, error: { code: e.code, description: e.description, source: e.source, step: e.step, reason: e.reason } }); toast('Payment failed: ' + (r.error?.description || 'unknown reason'), 'bad'); onDone && onDone(); });
        mark('Razorpay', 'Checkout opened');
        rzp.open();
        return;
      } catch (e) { return toast(e.message, 'bad'); }
    }
    simulatedCheckout(b, amount, cust, cfg, onDone);
  }

  function simulatedCheckout(b, amount, cust, cfg, onDone) {
    const methods = cfg?.checkout?.methods || { upi: true, card: true, netbanking: true, wallet: true };
    const labels = { upi: ['UPI / QR', 'Google Pay, PhonePe, Paytm'], card: ['Card', 'Visa, Mastercard, RuPay'], netbanking: ['Netbanking', 'All Indian banks'], wallet: ['Wallet', 'Paytm, Mobikwik, Freecharge'], emi: ['EMI', 'Cards & cardless'], paylater: ['Pay Later', 'Simpl, LazyPay'] };
    const wrap = document.createElement('div');
    wrap.className = 'overlay';
    wrap.innerHTML = `<div class="stack" style="align-items:center;gap:10px">
      <div class="badge b-warn plain">Test checkout. Add Razorpay test keys on the Razorpay page to open the real one.</div>
      <div class="rzp" role="dialog" aria-label="Razorpay checkout">
        <div class="rzp-head"><span class="rzp-logo"><img src="/assets/brand/logo-192.png" alt="" width="30" height="30"></span><div><div style="font-weight:700">HomeHancer</div><div style="font-size:12.5px;opacity:.8">${esc(service(b.serviceId).name)} · ${b.id}</div></div><div style="margin-left:auto;font:700 18px var(--font-display)">${inr(amount)}</div></div>
        <div class="rzp-body"><div style="font-size:12.5px;color:#6b7b8d">${esc(cust.phone)} · ${esc(cust.email)}</div>
          ${Object.entries(labels).filter(([k]) => methods[k]).map(([k, [l, s]]) => `<button class="rzp-method" data-m="${k}"><span>${l}<div style="font-weight:400;font-size:12px;color:#6b7b8d">${s}</div></span><span>›</span></button>`).join('')}
          <div class="field hidden" id="simWhy"><label for="simReason" style="color:#6b7b8d;font-size:12px">If this attempt fails, the reason is</label><select id="simReason">${window.HH_FAILURES.map((f, i) => `<option value="${i}">${esc(f.description)}</option>`).join('')}</select></div>
          <div class="row hidden" id="simResult" style="justify-content:space-between"><button class="btn btn-danger btn-sm" id="simFail">Simulate failure</button><button class="btn btn-primary btn-sm" id="simOk">Simulate success</button></div>
        </div>
        <div class="rzp-foot">Secured by Razorpay · <button class="btn btn-ghost btn-sm" id="simClose" style="height:auto;padding:0;color:#6b7b8d">Cancel</button></div>
      </div></div>`;
    document.body.appendChild(wrap);
    let method = 'upi';
    wrap.querySelectorAll('[data-m]').forEach(btn => btn.addEventListener('click', () => { method = btn.dataset.m; wrap.querySelectorAll('[data-m]').forEach(x => x.style.borderColor = ''); btn.style.borderColor = '#3395ff'; wrap.querySelector('#simResult').classList.remove('hidden'); wrap.querySelector('#simWhy').classList.remove('hidden'); }));
    wrap.querySelector('#simClose').addEventListener('click', () => { wrap.remove(); toast('Checkout closed before payment.'); });
    const finish = (ok) => {
      const { methods: _, ...failure } = window.HH_FAILURES[wrap.querySelector('#simReason').value];
      wrap.remove();
      const instrument = { upi: cust.name.split(' ')[0].toLowerCase() + '@okhdfcbank', card: 'Visa •••• 1111', netbanking: 'HDFC Bank', wallet: 'Paytm Wallet' }[method] || method.toUpperCase();
      recordPayment(b, { paymentId: uid('pay'), orderId: uid('order'), method, source: 'test', status: ok ? 'captured' : 'failed', amount, instrument, ...(ok ? {} : { error: failure }) });
      audit(`${ok ? 'Collected' : 'Failed to collect'} ${inr(amount)} on ${b.id} (test checkout)`);
      toast(ok ? `Payment of ${inr(amount)} recorded (test).` : 'Payment failed (test).', ok ? 'good' : 'bad');
      onDone && onDone();
    };
    wrap.querySelector('#simOk').addEventListener('click', () => finish(true));
    wrap.querySelector('#simFail').addEventListener('click', () => finish(false));
  }

  // Refund: real Razorpay API for real payments, simulated for test ones.
  async function refund(tx, amount, { speed = 'normal', reason = '' } = {}) {
    const refunded = tx.refunds.reduce((s, r) => s + r.amount, 0);
    if (amount <= 0 || amount > tx.amount - refunded + 0.001) throw new Error(`Refund must be between ₹1 and ${inr(tx.amount - refunded, 2)}.`);
    let rf;
    if (tx.source === 'razorpay') {
      const { refund } = await api('/api/razorpay/refund', { method: 'POST', body: { paymentId: tx.id, amount: Math.round(amount * 100), speed, notes: { reason, booking_id: tx.bookingId } } });
      rf = { id: refund.id, amount: refund.amount / 100, status: refund.status, speed: refund.speed_processed || speed, at: new Date().toISOString(), reason };
    } else {
      rf = { id: uid('rfnd'), amount, status: 'processed', speed, at: new Date().toISOString(), reason };
    }
    tx.refunds.push(rf);
    const total = refunded + amount;
    tx.status = total >= tx.amount - 0.001 ? 'refunded' : 'partially_refunded';
    const b = by(db.bookings, tx.bookingId);
    if (b) { b.payStatus = tx.status; b.timeline.push({ at: rf.at, text: `Refund ${inr(amount)} ${speed === 'optimum' ? '(instant)' : ''} · ${rf.id}${reason ? ' · ' + reason : ''}`, by: session?.name || 'Admin' }); }
    audit(`Refunded ${inr(amount)} on ${tx.bookingId} (${tx.id})`);
    save();
    return rf;
  }

  // ---------- Assign partner (used by bookings list and booking detail) ----------
  function assignDialog(b, done) {
    const fits = db.partners.filter(p => p.status === 'active' && p.skills.includes(b.catId));
    const ranked = fits.map(p => ({ p, zone: p.zones.includes(b.zone), busy: db.bookings.some(x => x.partnerId === p.id && x.slot === b.slot && x.id !== b.id && x.status !== 'cancelled') }))
      .sort((a, c) => (c.zone - a.zone) || (a.busy - c.busy) || (c.p.rating - a.p.rating));
    const m = HH.modal({
      title: `Assign partner · ${b.id}`,
      body: `<p class="muted" style="margin:0 0 12px">${esc(service(b.serviceId).name)} in ${esc(b.zone)} · ${date(b.slot)}, ${time(b.slot)}</p>
        <div class="list card">${ranked.map(({ p, zone, busy }) => `<label class="list-item" style="cursor:pointer"><input type="radio" name="pid" value="${p.id}" ${busy ? 'disabled' : ''}><span class="avatar">${HH.initials(p.name)}</span><span><div class="cell-main">${esc(p.name)}</div><div class="cell-sub">${p.rating} ★ · ${p.jobs} jobs · ${p.online ? 'Online now' : 'Offline'}</div></span><span class="spacer"></span>${zone ? '<span class="badge b-good">Serves this zone</span>' : '<span class="badge">Other zone</span>'}${busy ? '<span class="badge b-bad">Busy at this slot</span>' : ''}</label>`).join('') || '<div class="empty">No active partners have this skill.</div>'}</div>
        <label class="check" style="margin-top:12px"><input type="checkbox" id="notifyP" checked> Send job notification to partner and customer</label>`,
      foot: `<button class="btn" data-close>Cancel</button><button class="btn btn-primary" id="doAssign">Assign partner</button>`
    });
    m.$('#doAssign').addEventListener('click', () => {
      const pid = m.$('input[name=pid]:checked')?.value;
      if (!pid) return HH.toast('Pick a partner first.', 'bad');
      b.partnerId = pid;
      if (['pending', 'confirmed'].includes(b.status)) b.status = 'assigned';
      b.timeline.push({ at: new Date().toISOString(), text: `Assigned to ${partner(pid).name}${m.$('#notifyP').checked ? ' · SMS + push sent' : ''}`, by: HH.session.name });
      HH.audit(`Assigned ${b.id} to ${partner(pid).name}`);
      HH.save(); m.close(); HH.toast(`${partner(pid).name} assigned to ${b.id}.`, 'good'); done && done();
    });
  }

  // ---------- Refund dialog (used by booking detail and payments) ----------
  function refundDialog(t, render) {
    const left = t.amount - t.refunds.reduce((s, r) => s + r.amount, 0);
    const m = modal({
      title: 'Refund ' + t.id,
      body: `<div class="form-grid"><div class="field"><label for="rf-amt">Amount (₹)</label><input id="rf-amt" type="number" min="1" step="0.01" max="${left}" value="${left}"><span class="hint">Up to ${inr(left, 2)} left to refund</span></div>
        <div class="field"><label for="rf-speed">Speed</label><select id="rf-speed">${opt([['normal', 'Normal (5–7 days, free)'], ['optimum', 'Instant (Razorpay fee applies)']])}</select></div>
        <div class="field full"><label for="rf-reason">Reason</label><input id="rf-reason" value="Customer complaint"></div></div>
        ${t.source === 'razorpay' ? `<div class="callout info" style="margin-top:12px">${icon('info')}<div>This calls the Razorpay Refunds API with your stored keys.</div></div>` : `<div class="callout warn" style="margin-top:12px">${icon('info')}<div>Test payment: the refund is recorded only in this panel.</div></div>`}`,
      foot: `<button class="btn" data-close>Cancel</button><button class="btn btn-danger" id="rf-ok">Refund</button>`
    });
    m.$('#rf-ok').addEventListener('click', async () => {
      m.$('#rf-ok').disabled = true;
      try { const r = await refund(t, Number(m.$('#rf-amt').value), { speed: m.$('#rf-speed').value, reason: m.$('#rf-reason').value }); m.close(); toast(`Refund ${r.id} created for ${inr(r.amount, 2)}.`, 'good'); render(); }
      catch (e) { m.$('#rf-ok').disabled = false; toast(e.message, 'bad'); }
    });
  }


  // ---------- Theme ----------
  try { const t = localStorage.getItem('hh_theme_v2'); if (t) document.documentElement.dataset.theme = t; } catch {}

  window.HH = {
    db, save, reset, session, page, esc, inr, num, date, time, datetime, rel, initials, uid, sameDay, by,
    customer, partner, service, category, badge, icon, shell, toast, modal, drawer, confirmDialog, formData, opt, sw,
    table, downloadCSV, toCSV, lineChart, barChart, hbars, compactINR, api, server, rzpConfig, audit, collectPayment, paymentJourney, isSettled, refund, assignDialog, refundDialog,
    params: new URLSearchParams(location.search), SESSION_KEY
  };
})();
