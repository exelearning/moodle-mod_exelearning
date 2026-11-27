// This file is part of Moodle - http://moodle.org/
//
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// Moodle is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with Moodle.  If not, see <http://www.gnu.org/licenses/>.

/**
 * Player page of the content domain (admin setting `contentdomain`).
 *
 * content.php serves this script, with js/scorm_tracker.js before it, in the player
 * page: the document on the activity's content origin that frames the package. That
 * page stands where the Moodle page stands without a content domain, so the SCORM 1.2
 * bridge keeps its shape: the package finds `API` in its parent window and the tracker
 * reads the package document, all inside the content origin, and the state survives
 * the package moving from page to page.
 *
 * The only thing that leaves this origin is the data to save. It is posted to the
 * Moodle page (js/content_relay.js), which holds the session key and makes the
 * request. Messages are addressed to the Moodle origin, so no other page that frames
 * this one receives them, and this page listens to no message at all.
 *
 * Exposed as window.exeContentPlayer (the page boots itself) and module.exports (Vitest).
 *
 * @copyright  2026 ATE (Área de Tecnología Educativa)
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
(function () {
    'use strict';

    /**
     * Start the player in a window whose document is the player page.
     *
     * @param {Window} win The player page window.
     * @returns {{api: Object, destroy: Function, noteInteraction: Function}} The tracker.
     */
    function boot(win) {
        var root = win.document.documentElement;
        var appOrigin = root.getAttribute('data-app-origin');
        // Opened outside Moodle there is nobody to report to; the package still plays.
        var host = (win.parent && win.parent !== win) ? win.parent : null;

        function post(message) {
            message.type = 'mod_exelearning';
            if (host) { host.postMessage(message, appOrigin); }
        }

        var tracker = win.exeScormTracker.createScormApi({
            transport: function (data, sync) {
                post({
                    action: 'track',
                    cmi: data.cmi,
                    itemscores: data.itemscores,
                    answered: data.answered,
                    flush: sync
                });
                return true;
            },
            // The Moodle page spaces the requests and sends what is left when it is
            // closed, so every write is handed over at once.
            commitDelay: 0,
            bindUnload: false
        });
        win.API = tracker.api;
        win.addEventListener('pagehide', function () { tracker.api.LMSFinish(); });

        // The fragment carries the gradebook deep link to an iDevice (see view.php).
        win.document.getElementById('exelearningobject').src = root.getAttribute('data-entry') + win.location.hash;
        post({ action: 'ready' });
        return tracker;
    }

    var exp = { boot: boot };
    if (typeof module !== 'undefined' && module.exports) { module.exports = exp; }
    if (typeof window !== 'undefined') {
        window.exeContentPlayer = exp;
        if (window.exeScormTracker && document.documentElement.hasAttribute('data-entry')) { boot(window); }
    }
})();
