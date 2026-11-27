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
 * Moodle-page side of the SCORM bridge on a content domain (admin setting `contentdomain`).
 *
 * view.php injects this inline, before the iframe, when the package is served from a
 * content origin. The package and its tracker run there (js/content_player.js) and
 * cannot reach this page; they post the data to save, and this script makes the
 * track.php request with the session key, which never leaves this page.
 *
 * A message is accepted only when it comes from the window of the activity iframe
 * (event.source) and from the activity's content origin (event.origin). What it
 * carries is still untrusted: track.php validates and clamps it for the current user,
 * exactly as it does for a package served from the Moodle origin.
 *
 * If the player never reports, the content domain cannot be reached: an error is
 * shown in place of the iframe. The package is never loaded from the Moodle origin
 * instead.
 *
 * Exposed as window.exeContentRelay (view.php) and module.exports (Vitest).
 *
 * @copyright  2026 ATE (Área de Tecnología Educativa)
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
(function () {
    'use strict';

    /**
     * Create and start the relay.
     *
     * @param {Object} config iframeid, noticeid, contentorigin, cmid, trackurl, session,
     *     sesskey; optionally savedelay, waitafterload and waittotal in ms.
     * @param {Object} [deps] window, fetch and sendBeacon, for tests.
     * @returns {{onMessage: Function, flush: Function}} Handlers, for tests.
     */
    function init(config, deps) {
        deps = deps || {};
        var win = deps.window || window;
        var doc = win.document;
        var fetchFn = deps.fetch || win.fetch.bind(win);
        var beacon = deps.sendBeacon || win.navigator.sendBeacon.bind(win.navigator);
        // The request body not yet confirmed by the server, and the timer that sends it.
        var pending = null;
        var timer = null;
        var ready = false;

        function frame() { return doc.getElementById(config.iframeid); }

        function showError(failed) {
            var notice = doc.getElementById(config.noticeid);
            if (notice) { notice.hidden = !failed; }
            if (frame()) { frame().hidden = failed; }
        }

        function expectReady(ms) {
            win.setTimeout(function () { if (!ready) { showError(true); } }, ms);
        }

        function save() {
            timer = null;
            var body = pending;
            fetchFn(config.trackurl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: body,
                credentials: 'same-origin',
                keepalive: true
            }).then(function (response) {
                // A newer body may have arrived meanwhile; a failed one stays pending and
                // goes out with the next save or when the page is left.
                if (response.ok && pending === body) { pending = null; }
                return null;
            }).catch(function () { return null; });
        }

        function track(data) {
            if (!data.cmi || typeof data.cmi !== 'object') { return; }
            // Identity (activity, attempt, session key) is this page's. The session key
            // goes in the body, never in the URL (SEC-04).
            pending = JSON.stringify({
                id: config.cmid,
                session: config.session,
                cmi: data.cmi,
                itemscores: (data.itemscores && typeof data.itemscores === 'object') ? data.itemscores : {},
                answered: Array.isArray(data.answered) ? data.answered : undefined,
                sesskey: config.sesskey
            });
            if (timer) { win.clearTimeout(timer); }
            if (data.flush === true) {
                save();
            } else {
                // One request per burst of writes, like the tracker's own autocommit.
                timer = win.setTimeout(save, config.savedelay || 500);
            }
        }

        function onMessage(event) {
            var fr = frame();
            if (!fr || !fr.contentWindow || event.source !== fr.contentWindow
                    || event.origin !== config.contentorigin) {
                return;
            }
            var data = event.data;
            if (!data || data.type !== 'mod_exelearning') { return; }
            if (data.action === 'ready') {
                ready = true;
                showError(false);
            } else if (data.action === 'track') {
                track(data);
            }
        }

        // Leaving the page: fetch may be cancelled, a beacon is not.
        function flush() {
            if (timer) { win.clearTimeout(timer); timer = null; }
            if (pending) { beacon(config.trackurl, new Blob([pending], { type: 'application/json' })); }
        }

        win.addEventListener('message', onMessage);
        win.addEventListener('pagehide', flush);
        // The iframe fires load for an error page too, so shortly after it the player
        // must have reported; the longer wait covers a host that never answers.
        doc.addEventListener('load', function (event) {
            if (event.target === frame()) { expectReady(config.waitafterload || 3000); }
        }, true);
        expectReady(config.waittotal || 15000);

        return { onMessage: onMessage, flush: flush };
    }

    var exp = { init: init };
    if (typeof module !== 'undefined' && module.exports) { module.exports = exp; }
    if (typeof window !== 'undefined') { window.exeContentRelay = exp; }
})();
