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
 * Vitest unit tests for the Moodle-page relay of the content domain (js/content_relay.js).
 *
 * @category   test
 * @copyright  2026 ATE (Área de Tecnología Educativa)
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import '../../js/content_relay.js';

const { init } = window.exeContentRelay;
const CONTENT = 'https://m0123456789abcdef0123456789abcdef01234567.content.example';
const CONFIG = {
    iframeid: 'exelearningobject',
    noticeid: 'notice',
    contentorigin: CONTENT,
    cmid: 42,
    trackurl: 'https://moodle.example/mod/exelearning/track.php?id=42&mode=grading',
    session: 'tok',
    sesskey: 'KEY',
};
const CMI = { 'cmi.core.score.raw': '80' };

/** Starts a relay on a page with the activity iframe and the hidden error notice. */
function start({ ok = true } = {}) {
    const player = {};
    const frame = { hidden: false, contentWindow: player };
    const notice = { hidden: true };
    const listeners = {};
    const win = {
        document: {
            getElementById: (id) => ({ exelearningobject: frame, notice })[id] || null,
            addEventListener: (type, fn) => { listeners['document.' + type] = fn; },
        },
        addEventListener: (type, fn) => { listeners[type] = fn; },
        setTimeout: (fn, ms) => setTimeout(fn, ms),
        clearTimeout: (id) => clearTimeout(id),
    };
    const outcome = { ok };
    const fetch = vi.fn(() => Promise.resolve({ ok: outcome.ok }));
    const sendBeacon = vi.fn(() => true);
    init(CONFIG, { window: win, fetch, sendBeacon });
    const message = (data, from = {}) => listeners.message({
        data,
        source: 'source' in from ? from.source : player,
        origin: 'origin' in from ? from.origin : CONTENT,
    });
    return { frame, notice, listeners, fetch, sendBeacon, message, outcome };
}

const track = (extra = {}) => ({ type: 'mod_exelearning', action: 'track', cmi: CMI, ...extra });

describe('content relay', () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    it('saves what the player posts, with this page\'s identity and session key', () => {
        const page = start();
        page.message(track({ itemscores: { 'ide-q': { scorepct: 80 } }, answered: ['ide-q'], id: 999, sesskey: 'FORGED' }));
        expect(page.fetch).not.toHaveBeenCalled();
        vi.advanceTimersByTime(500);
        expect(page.fetch).toHaveBeenCalledTimes(1);
        const [url, request] = page.fetch.mock.calls[0];
        expect(url).toBe(CONFIG.trackurl);
        expect(request).toMatchObject({ method: 'POST', credentials: 'same-origin', keepalive: true });
        expect(JSON.parse(request.body)).toEqual({
            id: 42,
            session: 'tok',
            cmi: CMI,
            itemscores: { 'ide-q': { scorepct: 80 } },
            answered: ['ide-q'],
            sesskey: 'KEY',
        });
    });

    it('ignores a message that does not come from the activity iframe', () => {
        const page = start();
        page.message(track(), { source: {} });
        page.message(track(), { source: null });
        vi.advanceTimersByTime(500);
        expect(page.fetch).not.toHaveBeenCalled();
    });

    it('ignores a message from the iframe when it is not on the content origin', () => {
        const page = start();
        page.message(track(), { origin: 'https://evil.example' });
        page.message(track(), { origin: 'https://moodle.example' });
        page.message(track(), { origin: 'null' });
        vi.advanceTimersByTime(500);
        expect(page.fetch).not.toHaveBeenCalled();
    });

    it('ignores messages that are not the bridge\'s, or carry no CMI data', () => {
        const page = start();
        page.message(null);
        page.message({ type: 'other', action: 'track', cmi: CMI });
        page.message({ type: 'mod_exelearning', action: 'unknown', cmi: CMI });
        page.message({ type: 'mod_exelearning', action: 'track', cmi: 'text' });
        vi.advanceTimersByTime(500);
        expect(page.fetch).not.toHaveBeenCalled();
    });

    it('sends one request for a burst of writes, with the latest data', () => {
        const page = start();
        page.message(track());
        vi.advanceTimersByTime(300);
        page.message(track({ cmi: { 'cmi.core.score.raw': '90' }, itemscores: 'bad', answered: 'bad' }));
        vi.advanceTimersByTime(499);
        expect(page.fetch).not.toHaveBeenCalled();
        vi.advanceTimersByTime(1);
        expect(page.fetch).toHaveBeenCalledTimes(1);
        const body = JSON.parse(page.fetch.mock.calls[0][1].body);
        expect(body.cmi).toEqual({ 'cmi.core.score.raw': '90' });
        expect(body.itemscores).toEqual({});
        expect('answered' in body).toBe(false);
    });

    it('saves at once when the package commits', () => {
        const page = start();
        page.message(track());
        page.message(track({ flush: true }));
        expect(page.fetch).toHaveBeenCalledTimes(1);
        vi.advanceTimersByTime(500);
        expect(page.fetch).toHaveBeenCalledTimes(1);
    });

    it('sends nothing on leaving the page once the server has confirmed', async () => {
        const page = start();
        page.message(track({ flush: true }));
        await vi.advanceTimersByTimeAsync(0);
        page.listeners.pagehide();
        expect(page.sendBeacon).not.toHaveBeenCalled();
    });

    it('sends unsaved data with a beacon on leaving the page', async () => {
        const page = start();
        page.message(track());
        page.listeners.pagehide();
        expect(page.fetch).not.toHaveBeenCalled();
        expect(page.sendBeacon).toHaveBeenCalledTimes(1);
        expect(page.sendBeacon.mock.calls[0][0]).toBe(CONFIG.trackurl);
        expect(JSON.parse(await page.sendBeacon.mock.calls[0][1].text()).cmi).toEqual(CMI);
        // The timer was cancelled: the same data is not sent twice.
        vi.advanceTimersByTime(500);
        expect(page.fetch).not.toHaveBeenCalled();
    });

    it('keeps data the server refused and sends it again', async () => {
        const page = start({ ok: false });
        page.message(track({ flush: true }));
        await vi.advanceTimersByTimeAsync(0);
        page.listeners.pagehide();
        expect(page.sendBeacon).toHaveBeenCalledTimes(1);
    });

    it('keeps data whose request failed', async () => {
        const page = start();
        page.fetch.mockImplementation(() => Promise.reject(new Error('offline')));
        page.message(track({ flush: true }));
        await vi.advanceTimersByTimeAsync(0);
        page.listeners.pagehide();
        expect(page.sendBeacon).toHaveBeenCalledTimes(1);
    });

    it('shows the error instead of the iframe when the player never reports', () => {
        const page = start();
        vi.advanceTimersByTime(14999);
        expect(page.notice.hidden).toBe(true);
        vi.advanceTimersByTime(1);
        expect(page.notice.hidden).toBe(false);
        expect(page.frame.hidden).toBe(true);
    });

    it('expects the player shortly after the iframe has loaded', () => {
        const page = start();
        page.listeners['document.load']({ target: {} });
        vi.advanceTimersByTime(3000);
        expect(page.notice.hidden).toBe(true);
        page.listeners['document.load']({ target: page.frame });
        vi.advanceTimersByTime(3000);
        expect(page.notice.hidden).toBe(false);
    });

    it('shows the content once the player reports, even late', () => {
        const page = start();
        vi.advanceTimersByTime(15000);
        expect(page.frame.hidden).toBe(true);
        page.message({ type: 'mod_exelearning', action: 'ready' });
        expect(page.frame.hidden).toBe(false);
        expect(page.notice.hidden).toBe(true);
    });

    it('does not show the error after the player has reported', () => {
        const page = start();
        page.message({ type: 'mod_exelearning', action: 'ready' });
        page.listeners['document.load']({ target: page.frame });
        vi.advanceTimersByTime(20000);
        expect(page.notice.hidden).toBe(true);
        expect(page.frame.hidden).toBe(false);
    });
});
