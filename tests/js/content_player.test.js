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
 * Vitest unit tests for the content domain player page (js/content_player.js).
 *
 * @category   test
 * @copyright  2026 ATE (Área de Tecnología Educativa)
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import '../../js/scorm_tracker.js';
import '../../js/content_player.js';

const { boot } = window.exeContentPlayer;
const APP = 'https://moodle.example';

/**
 * A player page window. The package frame is a stub whose document is the test
 * document, so the tracker (which reads the global document) sees the iDevices in it.
 */
function makeWindow({ embedded = true, hash = '' } = {}) {
    const frame = { src: '', contentDocument: document };
    vi.spyOn(document, 'getElementById').mockImplementation((id) => {
        return id === 'exelearningobject' ? frame : document.querySelector('#' + id);
    });
    const listeners = {};
    const win = {
        document: {
            documentElement: {
                getAttribute: (name) => ({ 'data-app-origin': APP, 'data-entry': '7/index.html?exe-teacher=1' })[name],
            },
            getElementById: () => frame,
        },
        location: { hash },
        exeScormTracker: window.exeScormTracker,
        addEventListener: (type, fn) => { listeners[type] = fn; },
    };
    win.parent = embedded ? { postMessage: vi.fn() } : win;
    return { win, frame, listeners };
}

describe('content player', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div class="idevice_node" id="ide-q"><button id="check">Check</button></div>';
    });
    afterEach(() => {
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    it('does not start by itself outside a player page', () => {
        expect(window.API).toBeUndefined();
    });

    it('offers the SCORM API before loading the package, with the deep link fragment', () => {
        const { win, frame } = makeWindow({ hash: '#ide-q' });
        boot(win);
        expect(typeof win.API.LMSInitialize).toBe('function');
        expect(frame.src).toBe('7/index.html?exe-teacher=1#ide-q');
    });

    it('reports to the Moodle origin only', () => {
        const { win } = makeWindow();
        boot(win);
        expect(win.parent.postMessage).toHaveBeenCalledTimes(1);
        expect(win.parent.postMessage).toHaveBeenCalledWith({ type: 'mod_exelearning', action: 'ready' }, APP);
    });

    it('posts what has to be saved once the learner answers', () => {
        vi.useFakeTimers();
        const { win } = makeWindow();
        const tracker = boot(win);
        tracker.noteInteraction(document.getElementById('check'));
        win.API.LMSSetValue('cmi.suspend_data', '1. "Quiz"; score: 80%; weighted: 100%');
        win.API.LMSSetValue('cmi.core.score.raw', '80');
        // Handed over at once: the Moodle page is the one that spaces the requests.
        vi.advanceTimersByTime(0);
        const [message, target] = win.parent.postMessage.mock.calls[1];
        expect(target).toBe(APP);
        expect(message).toEqual({
            type: 'mod_exelearning',
            action: 'track',
            cmi: { 'cmi.suspend_data': '1. "Quiz"; score: 80%; weighted: 100%', 'cmi.core.score.raw': '80' },
            itemscores: { 'ide-q': { scorepct: 80, weighted: 100, title: 'Quiz' } },
            answered: ['ide-q'],
            flush: false,
        });
    });

    it('hands over what is left when the page is closed', () => {
        const { win, listeners } = makeWindow();
        const tracker = boot(win);
        tracker.noteInteraction(document.getElementById('check'));
        win.API.LMSSetValue('cmi.core.score.raw', '80');
        listeners.pagehide();
        expect(win.parent.postMessage.mock.calls[1][0]).toMatchObject({ action: 'track', flush: true });
    });

    it('plays without reporting when it is not framed', () => {
        const { win, frame } = makeWindow({ embedded: false });
        const tracker = boot(win);
        tracker.noteInteraction(document.getElementById('check'));
        win.API.LMSSetValue('cmi.core.score.raw', '80');
        expect(win.API.LMSCommit()).toBe('true');
        expect(frame.src).toBe('7/index.html?exe-teacher=1');
    });
});
