/**
 * Hearts of Minecraft – Database Layer
 * Uses Dexie.js (IndexedDB) for zero-config, plug-and-play persistence.
 * Also manages cookie-based session (30-day auto-login) and
 * auto-migrates legacy localStorage data on first run.
 *
 * Expose: window.DB
 */

(function () {
  'use strict';

  /* ─── Cookie helpers ────────────────────────────────────────────────────── */
  const COOKIE_NAME   = 'hom_session';
  const COOKIE_DAYS   = 30;
  const COOKIE_MAXAGE = COOKIE_DAYS * 86400;

  function _setCookie(value) {
    const secure = location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${COOKIE_NAME}=${encodeURIComponent(value)}; max-age=${COOKIE_MAXAGE}; SameSite=Strict; path=/${secure}`;
  }

  function _getCookie() {
    const pair = document.cookie.split(';').map(c => c.trim()).find(c => c.startsWith(COOKIE_NAME + '='));
    if (!pair) return null;
    try { return decodeURIComponent(pair.slice(COOKIE_NAME.length + 1)); } catch { return null; }
  }

  function _clearCookie() {
    document.cookie = `${COOKIE_NAME}=; max-age=0; SameSite=Strict; path=/`;
  }

  /* ─── Dexie database definition ─────────────────────────────────────────── */
  // Loaded via CDN (see each page's <script> tag before db.js)
  const db = new Dexie('HoMDB');

  db.version(2).stores({
    users    : '&username',          // primary key = username
    blogs    : '&id, author, date',  // unique id, indexes on author & date
    settings : '&key'                // key/value store (searchTerm, etc.)
  });

  /* ─── Migrate legacy localStorage data ──────────────────────────────────── */
  async function _migrateLocalStorage() {
    try {
      const flag = await db.settings.get('migrated_v1');
      if (flag) return;

      const lsUsers = JSON.parse(localStorage.getItem('users') || '[]');
      const lsBlogs = JSON.parse(localStorage.getItem('blogs') || '[]');

      if (lsUsers.length) await db.users.bulkPut(lsUsers).catch(() => {});
      if (lsBlogs.length) await db.blogs.bulkPut(lsBlogs).catch(() => {});

      // Migrate current session
      const lsUser = localStorage.getItem('currentUser');
      if (lsUser) _setCookie(lsUser);

      await db.settings.put({ key: 'migrated_v1', value: true });
      console.info('[HoMDB] Migrated', lsUsers.length, 'users,', lsBlogs.length, 'blogs from localStorage.');
    } catch (e) {
      console.warn('[HoMDB] Migration failed (non-fatal):', e);
    }
  }

  /* ─── DB ready promise ───────────────────────────────────────────────────── */
  const _ready = db.open().then(_migrateLocalStorage);

  async function _ensureReady() {
    await _ready;
  }

  /* ─── Public API ─────────────────────────────────────────────────────────── */
  const DB = {

    // ── Users ────────────────────────────────────────────────────────────────
    async getUsers() {
      await _ensureReady();
      return db.users.toArray();
    },

    async saveUsers(usersArray) {
      await _ensureReady();
      await db.users.bulkPut(usersArray);
    },

    async getUser(username) {
      await _ensureReady();
      return db.users.get(username);
    },

    async saveUser(userObj) {
      await _ensureReady();
      await db.users.put(userObj);
    },

    // ── Blogs ────────────────────────────────────────────────────────────────
    async getBlogs() {
      await _ensureReady();
      return db.blogs.toArray();
    },

    async saveBlogs(blogsArray) {
      await _ensureReady();
      // Overwrite all – replaces the whole collection atomically
      await db.transaction('rw', db.blogs, async () => {
        await db.blogs.clear();
        if (blogsArray.length) await db.blogs.bulkAdd(blogsArray);
      });
    },

    async saveBlog(blogObj) {
      await _ensureReady();
      await db.blogs.put(blogObj);
    },

    async deleteBlog(id) {
      await _ensureReady();
      await db.blogs.delete(id);
    },

    // ── Session (cookie-based) ────────────────────────────────────────────────
    async getCurrentUser() {
      return _getCookie();
    },

    async setCurrentUser(username) {
      _setCookie(username);
    },

    async clearCurrentUser() {
      _clearCookie();
    },

    // ── Search term (cross-page pass) ─────────────────────────────────────────
    async getSearchTerm() {
      await _ensureReady();
      const row = await db.settings.get('searchTerm');
      return row ? row.value : '';
    },

    async setSearchTerm(term) {
      await _ensureReady();
      await db.settings.put({ key: 'searchTerm', value: term });
    },

    async clearSearchTerm() {
      await _ensureReady();
      await db.settings.delete('searchTerm');
    }
  };

  window.DB = DB;
})();
