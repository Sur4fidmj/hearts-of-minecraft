/**
 * Hearts of Minecraft — Auth Widget
 * Injects a profile icon + dropdown into #nav-auth on every page.
 * Requires: Dexie, js/security.js, js/db.js, js/i18n.js, config.js
 *
 * Features:
 *  - Shows "Login / Sign Up" button if not logged in
 *  - Shows avatar + username dropdown if logged in
 *  - Dropdown: My Profile · Settings · Admin Panel (if admin) · Logout
 *  - Notification badge on avatar
 *  - Translates nav links via i18n
 */

(function () {
  'use strict';

  /* ─── CSS injected once ─────────────────────────────────────────────────── */
  const CSS = `
    /* ── Auth Widget ── */
    .hom-auth-widget { position:relative; display:flex; align-items:center; }

    .hom-login-btn {
      display:inline-flex; align-items:center; gap:8px;
      padding:9px 18px; background:linear-gradient(135deg,#1a75ff,#0052cc);
      color:#fff; text-decoration:none; border-radius:8px;
      font-weight:700; font-size:14px; white-space:nowrap;
      transition:filter .2s, transform .2s; border:none; cursor:pointer;
      font-family:inherit;
    }
    .hom-login-btn:hover { filter:brightness(1.15); transform:translateY(-1px); }

    /* Profile toggle button */
    .hom-profile-btn {
      display:flex; align-items:center; gap:8px;
      background:rgba(255,255,255,.08); border:1px solid rgba(255,255,255,.15);
      border-radius:10px; padding:6px 12px 6px 6px;
      cursor:pointer; transition:background .2s, border-color .2s;
      color:#fff; font-family:inherit; font-size:14px; font-weight:600;
      position:relative;
    }
    .hom-profile-btn:hover { background:rgba(255,255,255,.16); border-color:rgba(255,255,255,.3); }

    .hom-avatar {
      width:32px; height:32px; border-radius:50%;
      object-fit:cover; border:2px solid rgba(255,255,255,.25);
      flex-shrink:0;
    }
    .hom-uname { max-width:100px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .hom-arrow { font-size:10px; opacity:.7; transition:transform .2s; margin-left:2px; }
    .hom-profile-btn[aria-expanded="true"] .hom-arrow { transform:rotate(180deg); }

    /* Notification badge */
    .hom-badge {
      position:absolute; top:-4px; right:-4px;
      background:#e74c3c; color:#fff; font-size:10px; font-weight:700;
      min-width:16px; height:16px; border-radius:8px; display:flex;
      align-items:center; justify-content:center; padding:0 3px;
      pointer-events:none;
    }
    .hom-badge[hidden] { display:none; }

    /* Dropdown menu */
    .hom-dropdown {
      position:absolute; top:calc(100% + 10px); right:0;
      background:rgba(15,15,25,.95); backdrop-filter:blur(20px);
      border:1px solid rgba(255,255,255,.12); border-radius:12px;
      min-width:220px; padding:8px 0; z-index:9999;
      box-shadow:0 8px 32px rgba(0,0,0,.6);
      opacity:0; transform:translateY(-8px) scale(.97);
      pointer-events:none; transition:opacity .18s ease, transform .18s ease;
    }
    .hom-dropdown.open {
      opacity:1; transform:translateY(0) scale(1); pointer-events:auto;
    }

    .hom-dropdown-header {
      padding:12px 16px 8px; border-bottom:1px solid rgba(255,255,255,.08);
      margin-bottom:4px;
    }
    .hom-dropdown-uname { font-weight:700; color:#fff; font-size:14px; }
    .hom-dropdown-role  { font-size:11px; color:#888; margin-top:2px; }

    .hom-dropdown a, .hom-dropdown button.hom-ddi {
      display:flex; align-items:center; gap:10px;
      padding:9px 16px; color:#ccc; text-decoration:none;
      font-size:14px; font-weight:500; transition:background .15s, color .15s;
      background:none; border:none; width:100%; text-align:left; cursor:pointer;
      font-family:inherit;
    }
    .hom-dropdown a:hover, .hom-dropdown button.hom-ddi:hover {
      background:rgba(255,255,255,.06); color:#fff;
    }
    .hom-dropdown a .hom-icon, .hom-dropdown button.hom-ddi .hom-icon {
      width:18px; text-align:center; flex-shrink:0;
    }
    .hom-dropdown hr {
      border:none; border-top:1px solid rgba(255,255,255,.08); margin:4px 0;
    }
    .hom-ddi-danger { color:#e74c3c !important; }
    .hom-ddi-danger:hover { background:rgba(231,76,60,.1) !important; }
    .hom-ddi-admin  { color:#f0b429 !important; }
    .hom-ddi-admin:hover { background:rgba(240,180,41,.08) !important; }

    /* Translate nav links */
    .nav a { transition:background .3s, color .2s; }
  `;

  function injectCSS() {
    if (document.getElementById('hom-auth-css')) return;
    const s = document.createElement('style');
    s.id = 'hom-auth-css';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  /* ─── Nav link i18n map (by href) ──────────────────────────────────────── */
  const NAV_MAP = {
    'index.html':  'nav.home',
    './':          'nav.home',
    '#':           'nav.home',
    'shop.html':   'nav.shop',
    'map.html':    'nav.map',
    'stats.html':  'nav.stats',
    'foryou.html': 'nav.foryou',
    'blog.html':   'nav.blog',
    'about.html':  'nav.about',
  };

  function translateNavLinks() {
    if (typeof i18n === 'undefined') return;
    document.querySelectorAll('.nav > a').forEach(a => {
      const href = a.getAttribute('href') || '';
      const filename = href.split('/').pop() || href;
      const key = NAV_MAP[filename] || NAV_MAP[href];
      if (key) a.textContent = i18n.t(key);
    });
    // Search placeholder
    const gs = document.getElementById('globalSearch');
    if (gs) gs.placeholder = i18n.t('common.search');
  }

  /* ─── Admin check ───────────────────────────────────────────────────────── */
  function isAdmin(username) {
    if (!username) return false;
    const cfg = window.HOM_CONFIG;
    if (cfg && cfg.DEFAULT_ADMINS && cfg.DEFAULT_ADMINS.includes(username)) return true;
    return false;
  }
  async function isAdminDB(username) {
    if (!username) return false;
    if (isAdmin(username)) return true;
    if (typeof DB === 'undefined') return false;
    const u = await DB.getUser(username);
    return u && u.isAdmin === true;
  }

  /* ─── Build widget ──────────────────────────────────────────────────────── */
  async function buildWidget() {
    const slot = document.getElementById('nav-auth');
    if (!slot) return;
    slot.innerHTML = '';

    const username = typeof DB !== 'undefined' ? (await DB.getCurrentUser()) : null;

    /* ── Logged OUT ── */
    if (!username) {
      const a = document.createElement('a');
      a.href = 'login.html';
      a.className = 'hom-login-btn';
      a.innerHTML = '<span>🔐</span><span data-i18n="nav.login">' + (typeof i18n !== 'undefined' ? i18n.t('nav.login') : 'Login / Sign Up') + '</span>';
      slot.appendChild(a);
      return;
    }

    /* ── Logged IN ── */
    const user = typeof DB !== 'undefined' ? (await DB.getUser(username)) : null;
    const notifCount = user ? (user.notifications || []).length : 0;
    const admin = await isAdminDB(username);
    const pic = (user && user.profilePic) || `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><circle cx='16' cy='16' r='16' fill='%23334'/><text x='16' y='21' text-anchor='middle' fill='%23fff' font-size='13'>${String(username)[0].toUpperCase()}</text></svg>`;

    const wrapper = document.createElement('div');
    wrapper.className = 'hom-auth-widget';

    // Toggle button
    const btn = document.createElement('button');
    btn.className = 'hom-profile-btn';
    btn.setAttribute('aria-haspopup', 'true');
    btn.setAttribute('aria-expanded', 'false');

    const img = document.createElement('img');
    img.className = 'hom-avatar';
    img.src = pic;
    img.alt = username;

    const nameSpan = document.createElement('span');
    nameSpan.className = 'hom-uname';
    nameSpan.textContent = username;

    const arrow = document.createElement('span');
    arrow.className = 'hom-arrow';
    arrow.innerHTML = '▼';

    // Badge
    const badge = document.createElement('span');
    badge.className = 'hom-badge';
    badge.textContent = notifCount;
    if (notifCount === 0) badge.hidden = true;

    btn.appendChild(img);
    btn.appendChild(nameSpan);
    btn.appendChild(arrow);
    btn.appendChild(badge);

    // Dropdown
    const drop = document.createElement('div');
    drop.className = 'hom-dropdown';

    // Header
    const hdr = document.createElement('div');
    hdr.className = 'hom-dropdown-header';
    const uname = document.createElement('div');
    uname.className = 'hom-dropdown-uname';
    uname.textContent = username;
    const role = document.createElement('div');
    role.className = 'hom-dropdown-role';
    role.textContent = admin ? '🛡️ Administrator' : '⚔️ Player';
    hdr.appendChild(uname);
    hdr.appendChild(role);
    drop.appendChild(hdr);

    // Profile link
    const profileLink = document.createElement('a');
    profileLink.href = `profile.html?user=${encodeURIComponent(username)}`;
    profileLink.innerHTML = `<span class="hom-icon">👤</span><span data-i18n="nav.profile">${typeof i18n !== 'undefined' ? i18n.t('nav.profile') : 'My Profile'}</span>`;
    drop.appendChild(profileLink);

    // Settings link
    const settingsLink = document.createElement('a');
    settingsLink.href = 'settings.html';
    settingsLink.innerHTML = `<span class="hom-icon">⚙️</span><span data-i18n="nav.settings">${typeof i18n !== 'undefined' ? i18n.t('nav.settings') : 'Settings'}</span>`;
    drop.appendChild(settingsLink);

    // Admin link (if admin)
    if (admin) {
      const adminLink = document.createElement('a');
      adminLink.href = 'admin.html';
      adminLink.className = 'hom-ddi-admin';
      adminLink.innerHTML = `<span class="hom-icon">🛡️</span><span data-i18n="nav.admin">${typeof i18n !== 'undefined' ? i18n.t('nav.admin') : 'Admin Panel'}</span>`;
      drop.appendChild(adminLink);
    }

    // Divider
    const hr = document.createElement('hr');
    drop.appendChild(hr);

    // Logout button
    const logoutBtn = document.createElement('button');
    logoutBtn.className = 'hom-ddi hom-ddi-danger';
    logoutBtn.innerHTML = `<span class="hom-icon">↩</span><span data-i18n="nav.logout">${typeof i18n !== 'undefined' ? i18n.t('nav.logout') : 'Logout'}</span>`;
    logoutBtn.addEventListener('click', async () => {
      await DB.clearCurrentUser();
      window.location.href = 'index.html';
    });
    drop.appendChild(logoutBtn);

    wrapper.appendChild(btn);
    wrapper.appendChild(drop);
    slot.appendChild(wrapper);

    // Toggle dropdown on button click
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const open = drop.classList.toggle('open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    // Close on outside click
    document.addEventListener('click', () => {
      drop.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
    });
    drop.addEventListener('click', e => e.stopPropagation());
  }

  /* ─── Init ──────────────────────────────────────────────────────────────── */
  async function init() {
    injectCSS();
    await buildWidget();
    translateNavLinks();
    if (typeof i18n !== 'undefined') {
      i18n.apply();
      document.addEventListener('hom:langchange', () => {
        translateNavLinks();
        i18n.apply();
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
