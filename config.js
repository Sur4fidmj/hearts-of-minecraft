
(function () {
    'use strict';
    const _W = 'eXl5e3l7X2hoaW9mYWZbKiooZWtpbGhtamkqZWtuamkqampqZmpsamlrampqKiYmJSQmJCMnJiMlJCInJColJSMlJCE4' +
        'WWdcXl1bX1hCdm5UW1h3bmVqVHFZXmpueldUVmd4elN3ZFV6c1lucGt4' +
        'WmxoWGpsVm5YbFdXWHZqZmdYNldaVm9SdFdrUkVV';
    function _decode() {
        try {
            return atob(_W).split('').map(c =>
                String.fromCharCode(c.charCodeAt(0) ^ 0x1F)
            ).join('');
        } catch (e) {
            console.error('[HoM] Webhook init failed — regenerate _W.');
            return '';
        }
    }
    const HOM_CONFIG = {

        get DISCORD_WEBHOOK_URL() { return _decode(); },
        LOG: {
            signup: true,
            login: true,
            logout: true,
            loginFailed: true,
            blogPublished: true,
            blogDeleted: true,
            adminAction: true,
        },
        MAX_LOGIN_ATTEMPTS: 5,
        LOCKOUT_MINUTES: 15,
        DEFAULT_ADMINS: ['ILKING'],
    };

    window.HOM_CONFIG = HOM_CONFIG;
})();
