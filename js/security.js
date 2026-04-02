/**
 * Hearts of Minecraft – Security Utilities
 * XSS protection, sanitization, password hashing, rate limiting.
 * Exposed as: window.security
 */

(function () {
  'use strict';

  /* ─── Login rate limiting ────────────────────────────────────────────────── */
  const _loginAttempts = {};          // { username: { count, lockedUntil } }
  const MAX_ATTEMPTS   = 5;
  const LOCK_MS        = 30_000;      // 30 seconds lockout

  /* ─── Public API ─────────────────────────────────────────────────────────── */
  const security = {

    /**
     * Escapes standard HTML special characters to prevent XSS.
     * @param {string} str
     * @returns {string}
     */
    escapeHTML(str) {
      if (str == null) return '';
      return String(str)
        .replace(/&/g,  '&amp;')
        .replace(/</g,  '&lt;')
        .replace(/>/g,  '&gt;')
        .replace(/"/g,  '&quot;')
        .replace(/'/g,  '&#x27;')
        .replace(/\//g, '&#x2F;');
    },

    /**
     * Sanitizes blog content: allows only B/I/U/STRONG/EM/P/BR.
     * Strips ALL attributes (including style) to prevent CSS injection.
     * @param {string} html
     * @returns {string}
     */
    sanitizeBlogHTML(html) {
      if (!html) return '';
      const ALLOWED = new Set(['B', 'I', 'U', 'STRONG', 'EM', 'P', 'BR']);
      const temp    = document.createElement('div');
      temp.innerHTML = html;

      // Walk all elements; collect those to strip
      const all = Array.from(temp.querySelectorAll('*'));
      for (const node of all) {
        if (!ALLOWED.has(node.tagName)) {
          // Replace disallowed node with its text content only
          node.replaceWith(document.createTextNode(node.textContent));
        } else {
          // Strip every attribute on allowed nodes
          const attrs = Array.from(node.attributes).map(a => a.name);
          attrs.forEach(a => node.removeAttribute(a));
        }
      }
      return temp.innerHTML;
    },

    /**
     * Hashes a password string using SHA-256.
     * @param {string} password
     * @returns {Promise<string>} hex hash
     */
    async hashPassword(password) {
      if (!password) return '';
      const data   = new TextEncoder().encode(password);
      const buf    = await crypto.subtle.digest('SHA-256', data);
      return Array.from(new Uint8Array(buf))
                  .map(b => b.toString(16).padStart(2, '0'))
                  .join('');
    },

    /**
     * Safely sets element text content (no innerHTML).
     * @param {Element} el
     * @param {string} text
     */
    safeRender(el, text) {
      if (el) el.textContent = String(text ?? '');
    },

    /**
     * Safely renders username + optional nation tag into an element.
     * Uses DOM nodes – never innerHTML.
     * @param {Element} el
     * @param {string} username
     * @param {string|null} nation
     * @param {Object} nations   { [nation]: { tag, color } }
     */
    setSafeDisplayName(el, username, nation, nations) {
      if (!el) return;
      el.textContent = '';
      el.appendChild(document.createTextNode(String(username ?? '')));
      if (nation && nations && nations[nation]) {
        const { tag, color } = nations[nation];
        const span = document.createElement('span');
        span.style.color = color;
        span.textContent = ` [${tag}]`;
        el.appendChild(span);
      }
    },

    /**
     * URL-safe encode a parameter value to prevent URL injection.
     * @param {string} str
     * @returns {string}
     */
    encodeParam(str) {
      return encodeURIComponent(String(str ?? ''));
    },

    /**
     * Rate-limits login attempts per username.
     * @param {string} username
     * @returns {{ allowed: boolean, remainingMs: number }}
     */
    checkLoginRateLimit(username) {
      const key  = username.toLowerCase();
      const now  = Date.now();
      const rec  = _loginAttempts[key] || { count: 0, lockedUntil: 0 };

      if (rec.lockedUntil > now) {
        return { allowed: false, remainingMs: rec.lockedUntil - now };
      }
      return { allowed: true, remainingMs: 0 };
    },

    /**
     * Records a failed login attempt and potentially locks the account.
     * @param {string} username
     */
    recordFailedLogin(username) {
      const key = username.toLowerCase();
      const rec = _loginAttempts[key] || { count: 0, lockedUntil: 0 };
      rec.count++;
      if (rec.count >= MAX_ATTEMPTS) {
        rec.lockedUntil = Date.now() + LOCK_MS;
        rec.count       = 0;
      }
      _loginAttempts[key] = rec;
    },

    /**
     * Clears the rate limit record on successful login.
     * @param {string} username
     */
    clearLoginRateLimit(username) {
      delete _loginAttempts[username.toLowerCase()];
    }
  };

  window.security = security;
})();
