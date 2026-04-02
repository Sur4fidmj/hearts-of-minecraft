/**
 * COMPATIBILITY SHIM — redirects to js/security.js
 * The real implementation is in js/security.js.
 * window.security will be set after js/security.js loads.
 */
(function () {
    'use strict';
    if (document.querySelector('script[src="js/security.js"]')) return;
    var s = document.createElement('script');
    s.src = 'js/security.js';
    document.head.appendChild(s);
})();
