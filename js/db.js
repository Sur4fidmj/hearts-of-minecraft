/**
 * Hearts of Minecraft – Backend Database Layer
 * Replaces IndexedDB/Dexie with direct Fetch calls to our internal Node.js + SQLite backend.
 * Keeps the identical API so the rest of the site functions exactly as before.
 */

(function () {
  'use strict';

  const API_URL = 'http://localhost:3000/api';

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

  /* ─── Public API ─────────────────────────────────────────────────────────── */
  const DB = {

    // ── Users ────────────────────────────────────────────────────────────────
    async getUsers() {
      try {
        const res = await fetch(`${API_URL}/users`);
        return await res.json();
      } catch (e) {
        console.error('API Error: getUsers()', e);
        return [];
      }
    },

    async saveUsers(usersArray) {
      if(!usersArray || !usersArray.length) return;
      try {
        await fetch(`${API_URL}/users/bulk`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(usersArray)
        });
      } catch (e) { console.error('API Error: saveUsers()', e); }
    },

    async getUser(username) {
      try {
        const res = await fetch(`${API_URL}/users/${encodeURIComponent(username)}`);
        return await res.json();
      } catch (e) {
        console.error('API Error: getUser()', e);
        return null;
      }
    },

    async saveUser(userObj) {
      try {
        await fetch(`${API_URL}/users`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(userObj)
        });
      } catch (e) { console.error('API Error: saveUser()', e); }
    },

    // ── Blogs ────────────────────────────────────────────────────────────────
    async getBlogs() {
      try {
        const res = await fetch(`${API_URL}/blogs`);
        return await res.json();
      } catch (e) {
        console.error('API Error: getBlogs()', e);
        return [];
      }
    },

    async saveBlogs(blogsArray) {
      try {
        await fetch(`${API_URL}/blogs/bulk`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(blogsArray || [])
        });
      } catch (e) { console.error('API Error: saveBlogs()', e); }
    },

    async saveBlog(blogObj) {
      try {
        await fetch(`${API_URL}/blogs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(blogObj)
        });
      } catch (e) { console.error('API Error: saveBlog()', e); }
    },

    async deleteBlog(id) {
      try {
        await fetch(`${API_URL}/blogs/${id}`, { method: 'DELETE' });
      } catch (e) { console.error('API Error: deleteBlog()', e); }
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

    // ── Search term (Session Storage) ─────────────────────────────────────────
    async getSearchTerm() {
      return sessionStorage.getItem('hom_searchTerm') || '';
    },

    async setSearchTerm(term) {
      sessionStorage.setItem('hom_searchTerm', term);
    },

    async clearSearchTerm() {
      sessionStorage.removeItem('hom_searchTerm');
    }
  };

  window.DB = DB;
})();
