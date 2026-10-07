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
 * Vitest unit tests for the SCORM 1.2 tracker (js/scorm_tracker.js).
 *
 * @category   test
 * @copyright  2026 ATE (Área de Tecnología Educativa)
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// Side-effect import: the module exposes its API on window.exeScormTracker (and on
// module.exports), so reading the global works whether Vitest treats the file as ESM
// or CJS. globals (describe/it/expect/vi) are enabled in vitest.config.mjs.
import '../../js/scorm_tracker.js';

const { parseSuspend, resolveObjectMap, captureItemScores, buildPayload, createScormApi } =
    window.exeScormTracker;

/**
 * Minimal XMLHttpRequest-like stub. Records calls and lets a test control the
 * resolved status and whether onload fires (async path).
 */
function makeXhr(status, { fireLoad = true } = {}) {
    const calls = [];
    const xhr = {
        status,
        onload: null,
        onerror: null,
        open(method, url, async) { calls.push({ method, url, async }); },
        setRequestHeader() {},
        send(payload) {
            xhr.lastPayload = payload;
            // The synchronous path inspects xhr.status right after send(); the async
            // path waits for onload. Fire onload to emulate a completed async request.
            if (fireLoad && typeof xhr.onload === 'function') { xhr.onload(); }
        },
    };
    xhr.calls = calls;
    return xhr;
}

describe('parseSuspend', () => {
    it('parses score and weighted percentages', () => {
        const r = parseSuspend('1. "Quiz"; score: 60%; weighted: 30%.');
        expect(r[1]).toEqual({ title: 'Quiz', scorepct: 60, weighted: 30 });
    });

    it('accepts a comma decimal separator (es_ES/fr_FR/de_DE)', () => {
        const r = parseSuspend('1. "Quiz"; score: 60,5%; weighted: 30,25%.');
        expect(r[1].scorepct).toBe(60.5);
        expect(r[1].weighted).toBe(30.25);
    });

    it('clamps the score percentage to a 0–100 ceiling', () => {
        const r = parseSuspend('1. "Quiz"; score: 120%; weighted: 20%.');
        expect(r[1].scorepct).toBe(100);
    });

    it('parses several entries separated by ".\\t"', () => {
        const r = parseSuspend('1. "A"; score: 60%; weighted: 30%.\t2. "B"; score: 70%; weighted: 35%.');
        expect(Object.keys(r)).toEqual(['1', '2']);
        expect(r[1].title).toBe('A');
        expect(r[2]).toEqual({ title: 'B', scorepct: 70, weighted: 35 });
    });

    it('skips malformed lines (including negative numbers the format never emits)', () => {
        const r = parseSuspend('1. "Ok"; score: 50%; weighted: 25%.\tgarbage line\t3. "Neg"; score: -5%; weighted: 0%.');
        expect(Object.keys(r)).toEqual(['1']);
    });

    it('ignores the empty tail a trailing ".\\t" separator leaves behind', () => {
        const r = parseSuspend('1. "Quiz"; score: 60%; weighted: 30%.\t');
        expect(Object.keys(r)).toEqual(['1']);
    });

    it('returns an empty map for empty/falsy input', () => {
        expect(parseSuspend('')).toEqual({});
        expect(parseSuspend(null)).toEqual({});
        expect(parseSuspend(undefined)).toEqual({});
    });

    it('tolerates a trailing "; <label>: <n>" group after the weight, with and without it', () => {
        // A legacy writer that appends a labelled per-iDevice field (exelearning #2322
        // adds "; Estado: <0|1|2>") must not make the record disappear from the
        // gradebook: the suffix is accepted and ignored, the record parses as before.
        const r = parseSuspend(
            '1. "Quiz"; Puntuación: 60%; Peso: 30%; Estado: 2.\t'
            + '2. "Plain"; Puntuación: 70%; Peso: 35%.\t'
            + '3. "Last"; Puntuación: 80%; Peso: 35%; Estado: 1.'
        );
        expect(r[1]).toEqual({ title: 'Quiz', scorepct: 60, weighted: 30 });
        expect(r[2]).toEqual({ title: 'Plain', scorepct: 70, weighted: 35 });
        expect(r[3]).toEqual({ title: 'Last', scorepct: 80, weighted: 35 });
    });

    it('still rejects a suffix that is not a labelled number', () => {
        expect(parseSuspend('1. "Quiz"; score: 60%; weighted: 30%; garbage.')).toEqual({});
        expect(parseSuspend('1. "Quiz"; score: 60%; weighted: 30% trailing.')).toEqual({});
    });
});

describe('parseSuspend (versioned exe12 payload, core PR #2209)', () => {
    // Captured verbatim from a package built by the new SCORM 1.2 runtime.
    const REAL = 'exe12/1|ide-a;7;0;4;100;25;0;100';

    it('parses a real captured record, keyed by the objectid it carries', () => {
        expect(parseSuspend(REAL)).toEqual({
            'ide-a': { title: '', scorepct: 100, weighted: 25, objectid: 'ide-a' },
        });
    });

    it('reads the score from field [4], never from answered/total', () => {
        // The real record above says answered=0 of total=4 while scoring 100: an
        // iDevice may report a score without reporting question counters.
        expect(parseSuspend(REAL)['ide-a'].scorepct).toBe(100);
    });

    it('normalises the score into 0-100 with the record own min/max window', () => {
        const r = parseSuspend('exe12/1|q;1;2;4;5;75;0;10');
        expect(r.q.scorepct).toBe(50);
        expect(r.q.weighted).toBe(75);
    });

    it('clamps an out-of-window score and repairs a degenerate min/max range', () => {
        expect(parseSuspend('exe12/1|q;1;0;0;250;1;0;100').q.scorepct).toBe(100);
        expect(parseSuspend('exe12/1|q;1;0;0;-5;1;0;100').q.scorepct).toBe(0);
        // max <= min cannot normalise anything; the producer falls back to a
        // 100-wide window and so do we (score 30 in 0..100).
        expect(parseSuspend('exe12/1|q;1;0;0;30;1;0;0').q.scorepct).toBe(30);
    });

    it('percent-decodes the activity id', () => {
        expect(Object.keys(parseSuspend('exe12/1|ide%20a%7Cb;1;0;0;10;1;0;100'))).toEqual(['ide a|b']);
    });

    it('parses several records separated by "|"', () => {
        const r = parseSuspend('exe12/1|a;1;0;0;10;1;0;100|b;1;0;0;20;2;0;100');
        expect(Object.keys(r)).toEqual(['a', 'b']);
        expect(r.b.scorepct).toBe(20);
    });

    it('skips records that must not reach a gradebook column', () => {
        const r = parseSuspend(
            'exe12/1|ok;1;0;0;40;1;0;100'          // evaluable, scored: kept
            + '|noscore;1;0;0;;1;0;100'            // evaluable but no result yet
            + '|notevaluable;6;0;0;80;1;0;100'     // completionRequired+completed, not evaluable
            + '|3;40;1'                            // unclaimed migrated legacy pool record
            + '|;1;0;0;50;1;0;100'                 // empty id
            + '|short;1;0;0'                       // truncated record
            + '|bad;x;0;0;50;1;0;100'              // unreadable flags
            + '|ide%zz;1;0;0;50;1;0;100'           // malformed percent escape in the id
        );
        expect(Object.keys(r)).toEqual(['ok']);
    });

    it('accepts a header with no records at all', () => {
        expect(parseSuspend('exe12/1')).toEqual({});
    });

    it('returns nothing for a version it does not understand, rather than misparsing', () => {
        // A future revision may reorder or repurpose fields; publishing a wrong grade
        // is worse than publishing none.
        expect(parseSuspend('exe12/2|ide-a;7;0;4;100;25;0;100')).toEqual({});
        expect(parseSuspend('exe12/x|ide-a;7;0;4;100;25;0;100')).toEqual({});
        expect(parseSuspend('exe12/|ide-a;7;0;4;100;25;0;100')).toEqual({});
    });

    it('still parses the legacy format (the header is what selects the parser)', () => {
        expect(parseSuspend('1. "Quiz"; score: 60%; weighted: 30%.')[1].title).toBe('Quiz');
    });
});

describe('resolveObjectMap', () => {
    it('maps 1-based page index N to each .idevice_node id', () => {
        document.body.innerHTML =
            '<div class="idevice_node" id="ide-aaa"></div><div class="idevice_node" id="ide-bbb"></div>';
        expect(resolveObjectMap(document)).toEqual({ 1: 'ide-aaa', 2: 'ide-bbb' });
    });

    it('skips nodes without an id', () => {
        document.body.innerHTML =
            '<div class="idevice_node"></div><div class="idevice_node" id="ide-bbb"></div>';
        // The id-less first node leaves slot 1 empty; the second keeps its index (2).
        expect(resolveObjectMap(document)).toEqual({ 2: 'ide-bbb' });
    });

    it('returns null when there is no document or no nodes', () => {
        expect(resolveObjectMap(null)).toBeNull();
        document.body.innerHTML = '<p>no idevices here</p>';
        expect(resolveObjectMap(document)).toBeNull();
    });
});

describe('captureItemScores', () => {
    const objmap = { 1: 'ide-aaa', 2: 'ide-bbb' };

    it('routes a newly scored entry by stable objectid', () => {
        const parsed = parseSuspend('1. "Quiz"; score: 60%; weighted: 30%.');
        const { delta, prev } = captureItemScores(parsed, {}, objmap);
        expect(delta).toEqual({ 'ide-aaa': { scorepct: 60, weighted: 30, title: 'Quiz' } });
        // The next-call baseline is keyed by objectid, never by the page-local N.
        expect(prev).toEqual({ 'ide-aaa': { scorepct: 60, weighted: 30, title: 'Quiz' } });
    });

    it('emits only the entry that changed since the previous parse', () => {
        const first = captureItemScores(parseSuspend('1. "Quiz"; score: 60%; weighted: 30%.'), {}, objmap);
        const newParsed = parseSuspend('1. "Quiz"; score: 60%; weighted: 30%.\t2. "Essay"; score: 80%; weighted: 40%.');
        const { delta } = captureItemScores(newParsed, first.prev, objmap);
        expect(Object.keys(delta)).toEqual(['ide-bbb']);
    });

    it('emits a page-2 iDevice landing on a slot whose page-1 occupant scored identically', () => {
        // The legacy suspend_data format reuses the page-local slot N across pages.
        // Page 1: its iDevice at N=1 scores 60/30. Page 2: a DIFFERENT iDevice also
        // sits at N=1 and happens to score the same 60/30. An N-keyed baseline
        // compares the two as equal and silently drops the page-2 answer, whose
        // gradebook column is then never written.
        const page1 = captureItemScores(
            parseSuspend('1. "Quiz"; score: 60%; weighted: 30%.'),
            {},
            { 1: 'ide-aaa' },
        );

        const page2 = captureItemScores(
            parseSuspend('1. "OtherQuiz"; score: 60%; weighted: 30%.'),
            page1.prev,
            { 1: 'ide-bbb' },
        );

        expect(page2.delta).toEqual({ 'ide-bbb': { scorepct: 60, weighted: 30, title: 'OtherQuiz' } });
    });

    it('does not re-emit unchanged scores when the learner returns to a page', () => {
        // The baseline carries entries for pages not currently loaded, so navigating
        // back does not flood the endpoint with already-persisted scores.
        const page1 = captureItemScores(
            parseSuspend('1. "Quiz"; score: 60%; weighted: 30%.'),
            {},
            { 1: 'ide-aaa' },
        );
        const page2 = captureItemScores(
            parseSuspend('1. "Essay"; score: 80%; weighted: 40%.'),
            page1.prev,
            { 1: 'ide-bbb' },
        );

        const backOnPage1 = captureItemScores(
            parseSuspend('1. "Quiz"; score: 60%; weighted: 30%.'),
            page2.prev,
            { 1: 'ide-aaa' },
        );

        expect(backOnPage1.delta).toEqual({});
        // And a NEW score there is still caught against the carried-forward baseline.
        const rescored = captureItemScores(
            parseSuspend('1. "Quiz"; score: 90%; weighted: 30%.'),
            backOnPage1.prev,
            { 1: 'ide-aaa' },
        );
        expect(rescored.delta).toEqual({ 'ide-aaa': { scorepct: 90, weighted: 30, title: 'Quiz' } });
    });

    it('drops stale cross-page entries that do not resolve in the current DOM (multi-page fix)', () => {
        // Entry 2 changed, but the loaded page only knows index 1 -> objectid.
        const newParsed = parseSuspend('2. "OtherPage"; score: 90%; weighted: 45%.');
        const { delta } = captureItemScores(newParsed, {}, { 1: 'ide-aaa' });
        expect(delta).toEqual({});
    });

    it('ignores a stale entry the producer carried over into another page slot', () => {
        // Page 1 banks ide-aaa. On page 2 the producer rewrites the WHOLE map, so
        // slot 1 still holds page 1's entry while slot 2 holds the answer just given.
        // Slot 1 now resolves to ide-ccc, an iDevice the learner never touched: the
        // carried-over entry must neither be graded nor banked under it.
        const page1 = captureItemScores(
            parseSuspend('1. "Quiz"; score: 60%; weighted: 30%.'),
            {},
            { 1: 'ide-aaa' },
        );
        const page2 = captureItemScores(
            parseSuspend('1. "Quiz"; score: 60%; weighted: 30%.\t2. "Essay"; score: 80%; weighted: 40%.'),
            page1.prev,
            { 1: 'ide-ccc', 2: 'ide-ddd' },
        );

        expect(page2.delta).toEqual({ 'ide-ddd': { scorepct: 80, weighted: 40, title: 'Essay' } });
        expect(page2.prev['ide-ccc']).toBeUndefined();
        // The real owner keeps its banked value.
        expect(page2.prev['ide-aaa']).toEqual({ scorepct: 60, weighted: 30, title: 'Quiz' });
    });

    it('still grades two same-titled iDevices sitting on the SAME page', () => {
        // A recorded package really does repeat titles ("Activity A" four times), so
        // the attribution test must never fire against an objectid the loaded page
        // owns — only against one carried over from a page that is not loaded.
        const first = captureItemScores(
            parseSuspend('1. "Activity A"; score: 0%; weighted: 25%.'),
            {},
            objmap,
        );
        const second = captureItemScores(
            parseSuspend('1. "Activity A"; score: 0%; weighted: 25%.\t2. "Activity A"; score: 0%; weighted: 25%.'),
            first.prev,
            objmap,
        );

        expect(Object.keys(second.delta)).toEqual(['ide-bbb']);
    });

    it('KNOWN LIMIT: a cross-page twin (same title, score and weight) stays ungraded', () => {
        // The legacy format gives the entry no identity beyond its title, so two
        // iDevices on different pages that share a title AND score identically AND
        // weigh the same are indistinguishable. The later one is read as a carried
        // over copy of the first and is not graded until its score changes. This is
        // the residual limit documented on captureItemScores; the versioned exe12
        // format below has no such case.
        const page1 = captureItemScores(
            parseSuspend('1. "Quiz"; score: 60%; weighted: 30%.'),
            {},
            { 1: 'ide-aaa' },
        );
        const page2 = captureItemScores(
            parseSuspend('1. "Quiz"; score: 60%; weighted: 30%.'),
            page1.prev,
            { 1: 'ide-bbb' },
        );
        expect(page2.delta).toEqual({});

        // ...and it lands as soon as the learner's score differs.
        const rescored = captureItemScores(
            parseSuspend('1. "Quiz"; score: 90%; weighted: 30%.'),
            page2.prev,
            { 1: 'ide-bbb' },
        );
        expect(rescored.delta).toEqual({ 'ide-bbb': { scorepct: 90, weighted: 30, title: 'Quiz' } });
    });

    it('routes versioned exe12 entries by their own objectid, with no DOM at all', () => {
        const parsed = parseSuspend('exe12/1|ide-zzz;7;0;4;100;25;0;100');
        const { delta, prev } = captureItemScores(parsed, {}, null);

        expect(delta).toEqual({ 'ide-zzz': { scorepct: 100, weighted: 25, title: '' } });
        expect(prev).toEqual({ 'ide-zzz': { scorepct: 100, weighted: 25, title: '' } });
    });

    it('emits only the changed exe12 record when the whole map is rewritten', () => {
        const first = captureItemScores(parseSuspend('exe12/1|a;1;0;0;40;1;0;100'), {}, null);
        const second = captureItemScores(
            parseSuspend('exe12/1|a;1;0;0;40;1;0;100|b;1;0;0;70;1;0;100'),
            first.prev,
            null,
        );
        expect(Object.keys(second.delta)).toEqual(['b']);
    });

    it('never applies the legacy attribution test to exe12 records', () => {
        // Two activities on different pages with identical scores and weights: the
        // legacy branch would call the second a carry-over, the versioned one must
        // not, because each record names its own owner.
        const page1 = captureItemScores(parseSuspend('exe12/1|a;1;0;0;100;1;0;100'), {}, { 1: 'a' });
        const page2 = captureItemScores(
            parseSuspend('exe12/1|a;1;0;0;100;1;0;100|b;1;0;0;100;1;0;100'),
            page1.prev,
            { 1: 'b' },
        );
        expect(page2.delta).toEqual({ b: { scorepct: 100, weighted: 1, title: '' } });
    });
});

describe('buildPayload', () => {
    it('serializes the track.php POST body', () => {
        const body = buildPayload(42, 'tok', { 'cmi.core.score.raw': '60' }, { 'ide-aaa': { scorepct: 60 } }, 'k1');
        expect(JSON.parse(body)).toEqual({
            id: 42,
            session: 'tok',
            cmi: { 'cmi.core.score.raw': '60' },
            itemscores: { 'ide-aaa': { scorepct: 60 } },
            sesskey: 'k1',
        });
    });

    // SEC-04: the session key used to travel in the track.php query string, where
    // proxies and web-server access logs record it verbatim. It belongs in the body.
    it('carries the sesskey in the body', () => {
        const body = JSON.parse(buildPayload(42, 'tok', {}, {}, 'secretkey'));
        expect(body.sesskey).toBe('secretkey');
    });
});

describe('createScormApi state machine', () => {
    // Capture the autocommit callback so a test can fire it deterministically instead
    // of waiting on a real 500 ms timer.
    let scheduled;
    function baseConfig(overrides = {}) {
        scheduled = null;
        return {
            cmid: 42,
            trackurl: 'https://example.test/track.php',
            session: 'tok',
            bindUnload: false,
            // These cases test the commit contract itself, not when an attempt starts.
            awaitInteraction: false,
            getScoringDocument: () => document,
            setTimeout: (fn) => { scheduled = fn; return 1; },
            clearTimeout: () => { scheduled = null; },
            ...overrides,
        };
    }

    it('exposes the SCORM 1.2 contract', () => {
        const { api } = createScormApi(baseConfig());
        expect(api.LMSInitialize()).toBe('true');
        expect(api.LMSGetValue('cmi.core.score.raw')).toBe('');
        api.LMSSetValue('cmi.core.student_id', 'u7');
        expect(api.LMSGetValue('cmi.core.student_id')).toBe('u7');
        expect(api.LMSGetLastError()).toBe('0');
    });

    // SEC-04: the tracker must send the key it was configured with in the body and
    // must never append it to the endpoint URL, where logs and proxies would keep it.
    it('sends the sesskey in the POST body and leaves the endpoint URL untouched', () => {
        const xhr = makeXhr(200);
        const { api } = createScormApi(baseConfig({ xhrFactory: () => xhr, sesskey: 'secretkey' }));
        api.LMSSetValue('cmi.core.score.raw', '80');
        scheduled();
        expect(JSON.parse(xhr.lastPayload).sesskey).toBe('secretkey');
        expect(xhr.calls[0].url).toBe('https://example.test/track.php');
    });

    it('autocommits on a score key and clears dirty on a 2xx response', () => {
        const xhr = makeXhr(200);
        const { api } = createScormApi(baseConfig({ xhrFactory: () => xhr }));
        api.LMSSetValue('cmi.core.score.raw', '80');
        expect(typeof scheduled).toBe('function');   // autocommit was scheduled
        scheduled();                                   // fire the debounced send(false)
        expect(xhr.calls[0]).toMatchObject({ method: 'POST', async: true });
        // dirty cleared by the 2xx onload -> a follow-up Commit sends nothing new.
        const before = xhr.calls.length;
        expect(api.LMSCommit()).toBe('true');
        expect(xhr.calls.length).toBe(before);
    });

    it('keeps dirty after a failed autocommit so the grade is retried (never silently lost)', () => {
        const failing = makeXhr(500);
        const { api } = createScormApi(baseConfig({ xhrFactory: () => failing }));
        api.LMSSetValue('cmi.core.score.raw', '80');
        scheduled();                                   // async send fails (500), dirty stays set
        expect(failing.calls.length).toBe(1);
        // Still dirty: the next Commit re-sends the buffered score (synchronously)
        // rather than silently dropping it. The server is still failing, so the SCORM
        // contract reports 'false', but the retry is what guards the grade.
        expect(api.LMSCommit()).toBe('false');
        expect(failing.calls.length).toBe(2);
        expect(failing.calls[1]).toMatchObject({ async: false }); // Commit is synchronous
    });

    it('LMSFinish flushes synchronously and reports failure via LMSCommit', () => {
        const ok = makeXhr(200);
        const a = createScormApi(baseConfig({ xhrFactory: () => ok }));
        a.api.LMSSetValue('cmi.core.lesson_status', 'completed');
        expect(a.api.LMSFinish()).toBe('true');
        expect(ok.calls[ok.calls.length - 1]).toMatchObject({ async: false });

        const bad = makeXhr(500);
        const b = createScormApi(baseConfig({ xhrFactory: () => bad }));
        b.api.LMSSetValue('cmi.score.raw', '10');
        expect(b.api.LMSCommit()).toBe('false');
    });

    it('flushes synchronously on beforeunload and destroy() cancels a pending autocommit', () => {
        const xhr = makeXhr(200);
        let timer = null;
        const { api, destroy } = createScormApi({
            cmid: 1,
            trackurl: 'https://example.test/track.php',
            session: 'tok',
            bindUnload: true,
            awaitInteraction: false,
            getScoringDocument: () => document,
            xhrFactory: () => xhr,
            setTimeout: (fn) => { timer = fn; return 7; },
            clearTimeout: () => { timer = null; },
        });
        api.LMSSetValue('cmi.core.score.raw', '50');   // schedules an autocommit
        expect(typeof timer).toBe('function');
        destroy();                                      // cancels the pending timer
        expect(timer).toBeNull();
        // Closing the tab must still flush the buffered (dirty) score synchronously.
        window.dispatchEvent(new window.Event('beforeunload'));
        expect(xhr.calls.some((c) => c.async === false)).toBe(true);
    });

    it('captures per-iDevice scores by objectid into the committed payload', () => {
        document.body.innerHTML = '<div class="idevice_node" id="ide-aaa"></div>';
        const xhr = makeXhr(200);
        const { api } = createScormApi(baseConfig({ xhrFactory: () => xhr }));
        api.LMSSetValue('cmi.suspend_data', '1. "Quiz"; score: 60%; weighted: 30%.');
        expect(typeof scheduled).toBe('function');     // suspend_data write schedules a commit
        api.LMSCommit();
        const body = JSON.parse(xhr.lastPayload);
        expect(body.id).toBe(42);
        expect(body.session).toBe('tok');
        expect(body.itemscores).toEqual({ 'ide-aaa': { scorepct: 60, weighted: 30, title: 'Quiz' } });
    });

});

// exelearning/exelearning issue 2458: the package's own runtime seeds every gradable
// iDevice with a score of 0 as soon as the page loads (registerActivity, then
// showFinalScore writing cmi.core.score.raw = 0). Those writes are byte-identical to a
// real answer worth 0, so only the learner's interaction tells them apart: an attempt
// must start when a score is written AFTER the learner interacted with an iDevice.
describe('createScormApi: attempts start on learner interaction', () => {
    const SEED = '1. "Verdadero o falso"; Puntuación: 0%; Peso: 100%';
    let scheduled;
    function config(xhr) {
        scheduled = null;
        return {
            cmid: 42,
            trackurl: 'https://example.test/track.php',
            session: 'tok',
            bindUnload: false,
            getScoringDocument: () => document,
            xhrFactory: () => xhr,
            setTimeout: (fn) => { scheduled = fn; return 1; },
            clearTimeout: () => { scheduled = null; },
        };
    }
    /** Replays what the package runtime writes on load, before any interaction. */
    function seedOnLoad(api) {
        api.LMSInitialize('');
        api.LMSSetValue('cmi.suspend_data', SEED);
        api.LMSSetValue('cmi.core.score.raw', '0');
        api.LMSSetValue('cmi.core.lesson_status', 'failed');
    }
    beforeEach(() => {
        document.body.innerHTML = '<nav><a id="next" href="#">Next</a></nav>'
            + '<div class="idevice_node" id="ide-tf"><button id="check">Check</button></div>';
    });

    it('sends nothing when the page is only opened (no attempt, no grade change)', () => {
        const xhr = makeXhr(200);
        const { api } = createScormApi(config(xhr));
        seedOnLoad(api);
        if (scheduled) { scheduled(); }
        expect(api.LMSCommit()).toBe('true');
        expect(api.LMSFinish()).toBe('true');
        expect(xhr.calls).toHaveLength(0);
    });

    it('records a legitimate score of 0 once the learner answers', () => {
        const xhr = makeXhr(200);
        const tracker = createScormApi(config(xhr));
        seedOnLoad(tracker.api);
        tracker.noteInteraction(document.getElementById('check'));
        // The learner checks a wrong answer: the runtime rewrites the same 0 values.
        tracker.api.LMSSetValue('cmi.suspend_data', SEED);
        tracker.api.LMSSetValue('cmi.core.score.raw', '0');
        tracker.api.LMSSetValue('cmi.core.lesson_status', 'failed');
        scheduled();
        expect(xhr.calls).toHaveLength(1);
        const body = JSON.parse(xhr.lastPayload);
        expect(body.cmi['cmi.core.score.raw']).toBe('0');
        expect(body.itemscores).toEqual({ 'ide-tf': { scorepct: 0, weighted: 100, title: 'Verdadero o falso' } });
    });

    it('does not start an attempt when the learner interacts without producing a score', () => {
        const xhr = makeXhr(200);
        const tracker = createScormApi(config(xhr));
        seedOnLoad(tracker.api);
        tracker.noteInteraction(document.getElementById('check'));
        expect(tracker.api.LMSFinish()).toBe('true');
        expect(xhr.calls).toHaveLength(0);
    });

    it('does not treat navigation outside an iDevice as an answer', () => {
        const xhr = makeXhr(200);
        const tracker = createScormApi(config(xhr));
        tracker.noteInteraction(document.getElementById('next'));
        // The next page's iDevices seed themselves.
        seedOnLoad(tracker.api);
        expect(tracker.api.LMSFinish()).toBe('true');
        expect(xhr.calls).toHaveLength(0);
    });

    it('does not let an interaction on one package page start an attempt on the next', () => {
        const xhr = makeXhr(200);
        let current = document;
        const tracker = createScormApi({ ...config(xhr), getScoringDocument: () => current });
        seedOnLoad(tracker.api);
        // The learner clicks inside a (text) iDevice, then moves to the next page,
        // whose iDevices seed themselves on load.
        tracker.noteInteraction(document.getElementById('check'));
        current = document.implementation.createHTMLDocument('page 2');
        seedOnLoad(tracker.api);
        expect(tracker.api.LMSFinish()).toBe('true');
        expect(xhr.calls).toHaveLength(0);
    });

    it('ignores synthetic (untrusted) events dispatched by scripts', () => {
        const xhr = makeXhr(200);
        const { api } = createScormApi(config(xhr));
        seedOnLoad(api);
        document.getElementById('check').dispatchEvent(new window.Event('pointerdown', { bubbles: true }));
        api.LMSSetValue('cmi.core.score.raw', '0');
        expect(api.LMSFinish()).toBe('true');
        expect(xhr.calls).toHaveLength(0);
    });

    /**
     * Capture the listeners the tracker registers on the document: the DOM cannot
     * dispatch trusted events, so tests call them with the event real input produces.
     */
    function captureDocumentListeners() {
        const listeners = {};
        const spy = vi.spyOn(document, 'addEventListener').mockImplementation((type, fn) => {
            listeners[type] = fn;
        });
        return { listeners, spy };
    }

    it('starts the attempt on real learner input inside an iDevice', () => {
        const { listeners, spy } = captureDocumentListeners();
        try {
            const xhr = makeXhr(200);
            const { api } = createScormApi(config(xhr));
            seedOnLoad(api);
            listeners.pointerdown({ isTrusted: true, target: document.getElementById('check') });
            api.LMSSetValue('cmi.core.score.raw', '0');
            scheduled();
            expect(xhr.calls).toHaveLength(1);
        } finally {
            spy.mockRestore();
        }
    });

    it('starts the attempt on a bare trusted click (assistive technology)', () => {
        // Screen reader browse mode, voice and switch control activate a control with a
        // click that no pointerdown or keydown precedes.
        const { listeners, spy } = captureDocumentListeners();
        try {
            const xhr = makeXhr(200);
            const { api } = createScormApi(config(xhr));
            seedOnLoad(api);
            listeners.click({ isTrusted: true, target: document.getElementById('check') });
            api.LMSSetValue('cmi.core.score.raw', '0');
            scheduled();
            expect(xhr.calls).toHaveLength(1);
        } finally {
            spy.mockRestore();
        }
    });

    it('starts the attempt on dictated text (trusted input without a key press)', () => {
        document.getElementById('ide-tf').innerHTML = '<input id="answer">';
        const { listeners, spy } = captureDocumentListeners();
        try {
            const xhr = makeXhr(200);
            const { api } = createScormApi(config(xhr));
            seedOnLoad(api);
            listeners.input({ isTrusted: true, target: document.getElementById('answer') });
            api.LMSSetValue('cmi.core.score.raw', '0');
            scheduled();
            expect(xhr.calls).toHaveLength(1);
        } finally {
            spy.mockRestore();
        }
    });

    it('ignores a click the runtime synthesises (el.click(), jQuery .trigger())', () => {
        const xhr = makeXhr(200);
        const { api } = createScormApi(config(xhr));
        seedOnLoad(api);
        document.getElementById('check').click();
        api.LMSSetValue('cmi.core.score.raw', '0');
        expect(api.LMSFinish()).toBe('true');
        expect(xhr.calls).toHaveLength(0);
    });

    /**
     * Fire the captured window blur listeners, run the tracker's deferred focus check
     * through the injected timer, then let any other pending timer settle too.
     */
    async function blurWindow(blur) {
        blur.forEach((fn) => fn());
        scheduled();
        await new Promise((resolve) => setTimeout(resolve, 0));
    }

    it('starts the attempt when focus moves into an iframe nested in an iDevice', async () => {
        const blur = [];
        const spy = vi.spyOn(window, 'addEventListener').mockImplementation((type, fn) => {
            if (type === 'blur') { blur.push(fn); }
        });
        try {
            document.getElementById('ide-tf').innerHTML = '<iframe id="applet"></iframe>';
            const xhr = makeXhr(200);
            const { api } = createScormApi(config(xhr));
            seedOnLoad(api);
            // Clicking the applet moves focus to the nested iframe, which becomes the
            // page's active element once the blur has settled.
            document.getElementById('applet').focus();
            await blurWindow(blur);
            api.LMSSetValue('cmi.core.score.raw', '0');
            scheduled();
            expect(xhr.calls).toHaveLength(1);
        } finally {
            spy.mockRestore();
        }
    });

    it('does not start the attempt when focus leaves the page outside an iDevice', async () => {
        const blur = [];
        const spy = vi.spyOn(window, 'addEventListener').mockImplementation((type, fn) => {
            if (type === 'blur') { blur.push(fn); }
        });
        try {
            const xhr = makeXhr(200);
            const { api } = createScormApi(config(xhr));
            seedOnLoad(api);
            document.getElementById('next').focus();
            await blurWindow(blur);
            api.LMSSetValue('cmi.core.score.raw', '0');
            expect(api.LMSFinish()).toBe('true');
            expect(xhr.calls).toHaveLength(0);
        } finally {
            spy.mockRestore();
        }
    });

    it('does not start the attempt when the page loses focus with an iDevice field focused', async () => {
        // The runtime focuses a field on load; the learner then switches tabs or
        // clicks the Moodle page. Losing focus is not an answer.
        const blur = [];
        const spy = vi.spyOn(window, 'addEventListener').mockImplementation((type, fn) => {
            if (type === 'blur') { blur.push(fn); }
        });
        try {
            document.getElementById('ide-tf').innerHTML = '<input id="answer">';
            const xhr = makeXhr(200);
            const { api } = createScormApi(config(xhr));
            seedOnLoad(api);
            document.getElementById('answer').focus();
            await blurWindow(blur);
            api.LMSSetValue('cmi.core.score.raw', '0');
            expect(api.LMSFinish()).toBe('true');
            expect(xhr.calls).toHaveLength(0);
        } finally {
            spy.mockRestore();
        }
    });

    it('keeps committing normally once the attempt has started', () => {
        const xhr = makeXhr(200);
        const tracker = createScormApi(config(xhr));
        seedOnLoad(tracker.api);
        tracker.noteInteraction(document.getElementById('check'));
        tracker.api.LMSSetValue('cmi.core.score.raw', '100');
        scheduled();
        // A later page's seed rides along with the attempt that already exists.
        tracker.api.LMSSetValue('cmi.core.lesson_status', 'passed');
        expect(tracker.api.LMSCommit()).toBe('true');
        expect(xhr.calls).toHaveLength(2);
    });
});

describe('parseSuspend (versioned exe12 payload, core PR #2209)', () => {
    // Captured verbatim from a package built by the new SCORM 1.2 runtime.
    const REAL = 'exe12/1|ide-a;7;0;4;100;25;0;100';

    it('parses a real captured record, keyed by the objectid it carries', () => {
        expect(parseSuspend(REAL)).toEqual({
            'ide-a': { title: '', scorepct: 100, weighted: 25, objectid: 'ide-a' },
        });
    });

    it('reads the score from field [4], never from answered/total', () => {
        // The real record above says answered=0 of total=4 while scoring 100: an
        // iDevice may report a score without reporting question counters.
        expect(parseSuspend(REAL)['ide-a'].scorepct).toBe(100);
    });

    it('normalises the score into 0-100 with the record own min/max window', () => {
        const r = parseSuspend('exe12/1|q;1;2;4;5;75;0;10');
        expect(r.q.scorepct).toBe(50);
        expect(r.q.weighted).toBe(75);
    });

    it('clamps an out-of-window score and repairs a degenerate min/max range', () => {
        expect(parseSuspend('exe12/1|q;1;0;0;250;1;0;100').q.scorepct).toBe(100);
        expect(parseSuspend('exe12/1|q;1;0;0;-5;1;0;100').q.scorepct).toBe(0);
        // max <= min cannot normalise anything; the producer falls back to a
        // 100-wide window and so do we (score 30 in 0..100).
        expect(parseSuspend('exe12/1|q;1;0;0;30;1;0;0').q.scorepct).toBe(30);
    });

    it('percent-decodes the activity id', () => {
        expect(Object.keys(parseSuspend('exe12/1|ide%20a%7Cb;1;0;0;10;1;0;100'))).toEqual(['ide a|b']);
    });

    it('parses several records separated by "|"', () => {
        const r = parseSuspend('exe12/1|a;1;0;0;10;1;0;100|b;1;0;0;20;2;0;100');
        expect(Object.keys(r)).toEqual(['a', 'b']);
        expect(r.b.scorepct).toBe(20);
    });

    it('skips records that must not reach a gradebook column', () => {
        const r = parseSuspend(
            'exe12/1|ok;1;0;0;40;1;0;100'          // evaluable, scored: kept
            + '|noscore;1;0;0;;1;0;100'            // evaluable but no result yet
            + '|notevaluable;6;0;0;80;1;0;100'     // completionRequired+completed, not evaluable
            + '|3;40;1'                            // unclaimed migrated legacy pool record
            + '|;1;0;0;50;1;0;100'                 // empty id
            + '|short;1;0;0'                       // truncated record
            + '|bad;x;0;0;50;1;0;100'              // unreadable flags
            + '|ide%zz;1;0;0;50;1;0;100'           // malformed percent escape in the id
        );
        expect(Object.keys(r)).toEqual(['ok']);
    });

    it('accepts a header with no records at all', () => {
        expect(parseSuspend('exe12/1')).toEqual({});
    });

    it('returns nothing for a version it does not understand, rather than misparsing', () => {
        // A future revision may reorder or repurpose fields; publishing a wrong grade
        // is worse than publishing none.
        expect(parseSuspend('exe12/2|ide-a;7;0;4;100;25;0;100')).toEqual({});
        expect(parseSuspend('exe12/x|ide-a;7;0;4;100;25;0;100')).toEqual({});
        expect(parseSuspend('exe12/|ide-a;7;0;4;100;25;0;100')).toEqual({});
    });

    it('still parses the legacy format (the header is what selects the parser)', () => {
        expect(parseSuspend('1. "Quiz"; score: 60%; weighted: 30%.')[1].title).toBe('Quiz');
    });
});

describe('createScormApi: the payload names the iDevices the learner answered', () => {
    // Two gradable iDevices on one page, as in the demo activity (True/False + Guess).
    // On load the runtime seeds both with 0 in a single suspend_data write. Their seeds
    // stay in every later write, so the tracker sends the full map (the attempt score
    // the package computes) and lists in `answered` the iDevices answered in this visit
    // (exelearning issue 2481): only those get a per-iDevice result.
    const SEED = '1. "Verdadero o falso"; Puntuación: 0%; Peso: 50%.\t'
        + '2. "Adivina"; Puntuación: 0%; Peso: 50%';
    const GUESS_RIGHT = '1. "Verdadero o falso"; Puntuación: 0%; Peso: 50%.\t'
        + '2. "Adivina"; Puntuación: 100%; Peso: 50%';
    let scheduled;
    function config(xhr) {
        scheduled = null;
        return {
            cmid: 42,
            trackurl: 'https://example.test/track.php',
            session: 'tok',
            bindUnload: false,
            getScoringDocument: () => document,
            xhrFactory: () => xhr,
            setTimeout: (fn) => { scheduled = fn; return 1; },
            clearTimeout: () => { scheduled = null; },
        };
    }
    function seedOnLoad(api) {
        api.LMSInitialize('');
        api.LMSSetValue('cmi.suspend_data', SEED);
        api.LMSSetValue('cmi.core.score.raw', '0');
    }
    function lastBody(xhr) {
        return JSON.parse(xhr.lastPayload);
    }
    beforeEach(() => {
        document.body.innerHTML = '<div class="idevice_node" id="ide-tf">'
            + '<p id="tf-text">The sky is green.</p><button id="tf">Check</button></div>'
            + '<div class="idevice_node" id="ide-guess"><button id="guess">Check</button></div>';
    });

    it('sends the full map and lists only the answered iDevice (issue 2481)', () => {
        const xhr = makeXhr(200);
        const tracker = createScormApi(config(xhr));
        seedOnLoad(tracker.api);
        // The learner plays only the Guess iDevice and gets it right.
        tracker.noteInteraction(document.getElementById('guess'));
        tracker.api.LMSSetValue('cmi.suspend_data', GUESS_RIGHT);
        tracker.api.LMSSetValue('cmi.core.score.raw', '50');
        scheduled();
        expect(xhr.calls).toHaveLength(1);
        expect(lastBody(xhr).itemscores).toEqual({
            'ide-tf': { scorepct: 0, weighted: 50, title: 'Verdadero o falso' },
            'ide-guess': { scorepct: 100, weighted: 50, title: 'Adivina' },
        });
        expect(lastBody(xhr).answered).toEqual(['ide-guess']);
    });

    it('does not count a click on another iDevice\'s text as an answer', () => {
        const xhr = makeXhr(200);
        const tracker = createScormApi(config(xhr));
        seedOnLoad(tracker.api);
        // The learner reads the True/False statement, then answers only Guess, wrongly:
        // the Guess score stays at its seed, so only the attribution can name it.
        tracker.noteInteraction(document.getElementById('tf-text'));
        tracker.noteInteraction(document.getElementById('guess'));
        tracker.api.LMSSetValue('cmi.suspend_data', SEED);
        tracker.api.LMSSetValue('cmi.core.score.raw', '0');
        scheduled();
        expect(lastBody(xhr).answered).toEqual(['ide-guess']);
    });

    it('lists a genuine 0 answer, identical to its seed', () => {
        const xhr = makeXhr(200);
        const tracker = createScormApi(config(xhr));
        seedOnLoad(tracker.api);
        tracker.noteInteraction(document.getElementById('guess'));
        tracker.api.LMSSetValue('cmi.suspend_data', GUESS_RIGHT);
        scheduled();
        // Then answers the True/False wrongly: its value stays 0, identical to the seed.
        tracker.noteInteraction(document.getElementById('tf'));
        tracker.api.LMSSetValue('cmi.suspend_data', GUESS_RIGHT);
        scheduled();
        expect(lastBody(xhr).answered.sort()).toEqual(['ide-guess', 'ide-tf']);
    });

    it('lists an iDevice whose score moved away from its seed', () => {
        const xhr = makeXhr(200);
        const tracker = createScormApi(config(xhr));
        seedOnLoad(tracker.api);
        // The write that scores Guess lands after the learner's last interaction moved
        // to True/False (an asynchronous check): attribution names True/False, and the
        // changed score still names Guess.
        tracker.noteInteraction(document.getElementById('tf'));
        tracker.api.LMSSetValue('cmi.suspend_data', GUESS_RIGHT);
        scheduled();
        expect(lastBody(xhr).answered.sort()).toEqual(['ide-guess', 'ide-tf']);
    });

    it('omits answered when interaction gating is off', () => {
        const xhr = makeXhr(200);
        const tracker = createScormApi({ ...config(xhr), awaitInteraction: false });
        seedOnLoad(tracker.api);
        scheduled();
        expect(lastBody(xhr)).not.toHaveProperty('answered');
        expect(Object.keys(lastBody(xhr).itemscores).sort()).toEqual(['ide-guess', 'ide-tf']);
    });

    it('keeps attributing answers on later pages after the attempt has started', () => {
        const xhr = makeXhr(200);
        let current = document;
        const tracker = createScormApi({ ...config(xhr), getScoringDocument: () => current });
        seedOnLoad(tracker.api);
        tracker.noteInteraction(document.getElementById('guess'));
        tracker.api.LMSSetValue('cmi.suspend_data', GUESS_RIGHT);
        scheduled();
        // Page 2 carries one gradable iDevice; its seed is not attributed to Guess.
        current = document.implementation.createHTMLDocument('page 2');
        current.body.innerHTML = '<div class="idevice_node" id="ide-p2"><button id="p2">Check</button></div>';
        const listeners = {};
        current.addEventListener = (type, fn) => { listeners[type] = fn; };
        tracker.api.LMSSetValue('cmi.suspend_data', '1. "Quiz"; Puntuación: 0%; Peso: 100%');
        scheduled();
        expect(lastBody(xhr).answered).toEqual(['ide-guess']);
        // Real input on the new page must still be watched after the attempt started;
        // a wrong answer leaves the score at its seed.
        listeners.pointerdown({ isTrusted: true, target: current.getElementById('p2') });
        tracker.api.LMSSetValue('cmi.suspend_data', '1. "Quiz"; Puntuación: 0%; Peso: 100%');
        scheduled();
        expect(lastBody(xhr).answered.sort()).toEqual(['ide-guess', 'ide-p2']);
        expect(Object.keys(lastBody(xhr).itemscores).sort()).toEqual(['ide-guess', 'ide-p2', 'ide-tf']);
    });
});
