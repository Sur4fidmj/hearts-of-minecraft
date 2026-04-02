/**
 * COMPATIBILITY SHIM — redirects to js/db.js
 * This file exists so that admin.html and blog-logic.js (which load db.js
 * from root) continue to work. The real implementation is in js/db.js.
 *
 * NOTE: Dexie must be loaded BEFORE this file. Each page that uses this shim
 * must include:
 *   <script src="https://unpkg.com/dexie@3/dist/dexie.min.js"></script>
 *   <script src="db.js"></script>
 *
 * window.DB will be set by js/db.js after it loads.
 */
(function () {
    'use strict';
    function _loadScript(src) {
        return new Promise(function (resolve, reject) {
            if (document.querySelector('script[src="' + src + '"]')) { resolve(); return; }
            var s = document.createElement('script');
            s.src = src;
            s.onload  = resolve;
            s.onerror = reject;
            document.head.appendChild(s);
        });
    }

    // Chain: Dexie → security → real db
    var dexieSrc    = 'https://unpkg.com/dexie@3/dist/dexie.min.js';
    var securitySrc = 'js/security.js';
    var dbSrc       = 'js/db.js';

    _loadScript(dexieSrc)
        .then(function () { return _loadScript(securitySrc); })
        .then(function () { return _loadScript(dbSrc); })
        .catch(function (e) { console.error('[HoM shim] Failed to load db chain:', e); });
})();
