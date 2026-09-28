// This file is part of Moodle - http://moodle.org/
//
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// Moodle is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with Moodle. If not, see <http://www.gnu.org/licenses/>.

/**
 * Run the actual vendored runtime against the plugin's tracking API.
 *
 * The transport is captured; registry serialization, session policy, wrapper
 * discovery and tracker attribution all execute their production code.
 * These checks do not replace browser tests of the package's iDevice controls.
 *
 * @copyright 2026 ATE (Área de Tecnología Educativa)
 * @license http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { loadTracker } from './trace-replay.helper.js';

const wrapperSource = fs.readFileSync(path.resolve('assets/scorm/SCORM_API_wrapper.js'), 'utf8');
const runtimeSource = fs.readFileSync(path.resolve('assets/scorm/SCOFunctions.js'), 'utf8');

/** One persistent Moodle host, with a fresh runtime for each iframe navigation. */
function hostSession(opaque = false) {
    const posts = [];
    const { createScormApi } = loadTracker(path.resolve('js/scorm_tracker.js'));
    const { api } = createScormApi({
        cmid: 1,
        trackurl: '/track.php?id=1',
        session: 'runtime-integration',
        sesskey: 'test-sesskey',
        bindUnload: false,
        getScoringDocument: () => null,
        setTimeout: () => 1,
        clearTimeout: () => {},
        transport: opaque ? (payload) => { posts.push(payload); return true; } : undefined,
        xhrFactory: () => ({
            status: 200,
            open() {},
            setRequestHeader() {},
            send(body) { posts.push(JSON.parse(body)); },
        }),
    });
    const finish = vi.spyOn(api, 'LMSFinish');
    return {
        api,
        posts,
        finish,
        page() {
            const parent = { API: api };
            parent.parent = parent;
            if (opaque) {
                Object.defineProperty(parent, 'API', { get() { throw new Error('SecurityError'); } });
                Object.defineProperty(parent, 'API_1484_11', { get() { throw new Error('SecurityError'); } });
            }
            const child = {
                parent,
                top: parent,
                console: { log() {}, warn: vi.fn(), error: vi.fn() },
                addEventListener: vi.fn(),
                document: { addEventListener: vi.fn() },
            };
            if (opaque) { child.API = api; }
            child.window = child;
            const context = vm.createContext(child);
            vm.runInContext(wrapperSource, context);
            vm.runInContext(runtimeSource, context);
            return child;
        },
    };
}

/** Register exactly the descriptor the package's common.js supplies. */
function register(page, id, weight = 100) {
    page.exeScorm12.activities.register(id, {
        evaluable: true, completionRequired: true, weight,
        minimumScore: 0, maximumScore: 100,
    });
}

/** Exercise the public report sequence used by common.js after an answer. */
function report(page, id, score, completed) {
    const runtime = page.exeScorm12;
    runtime.activities.update(id, { score, completed });
    runtime.policy.persistActivities();
    runtime.policy.setScoreDetailed(runtime.activities.summary().score, 0, 100);
    runtime.policy.recordActivityOutcome();
    expect(runtime.client.commit()).toBe(true);
}

describe('vendored SCORM runtime → plugin tracker', () => {
    it('reports through the local bridge transport without accessing an opaque parent', () => {
        const host = hostSession(true);
        const page = host.page();
        register(page, 'secure-item');
        expect(page.exeScorm12.session.open({ ownsLifecycle: false })).toBe(true);
        report(page, 'secure-item', 75, true);
        expect(host.posts.at(-1).itemscores['secure-item'].scorepct).toBe(75);
        expect(host.posts.at(-1).cmi['cmi.core.score.raw']).toBe('75');
        expect(host.finish).not.toHaveBeenCalled();
    });

    it('opens an untouched activity without manufacturing an item or overall score', () => {
        const host = hostSession();
        const page = host.page();
        register(page, 'untouched');

        expect(page.exeScorm12.session.open({ ownsLifecycle: false })).toBe(true);
        expect(page.exeScorm12.client.commit()).toBe(true);

        expect(host.posts.at(-1).itemscores).toEqual({});
        expect(host.posts.at(-1).cmi['cmi.core.score.raw']).toBeUndefined();
        expect(host.posts.at(-1).cmi['cmi.core.lesson_status']).toBe('incomplete');
    });

    it('flushes a report made before session opening without erasing restored sibling scores', () => {
        const host = hostSession();
        const first = host.page();
        register(first, 'a');
        register(first, 'b');
        first.exeScorm12.session.open({ ownsLifecycle: false });
        report(first, 'a', 100, true);
        report(first, 'b', 50, true);

        const resumed = host.page();
        register(resumed, 'a');
        resumed.exeScorm12.activities.update('a', { score: 0, completed: false });
        resumed.exeScorm12.session.open({ ownsLifecycle: false });

        const last = host.posts.at(-1);
        expect(last.itemscores.a.scorepct).toBe(0);
        expect(last.itemscores.b.scorepct).toBe(50);
        expect(last.cmi['cmi.core.score.raw']).toBe('25');
        expect(last.cmi['cmi.core.lesson_status']).toBe('incomplete');
        expect(last.cmi['cmi.core.exit']).toBe('suspend');
    });

    it('preserves the host lifecycle and stable ids when navigating to another page', () => {
        const host = hostSession();
        const first = host.page();
        register(first, 'page-a');
        first.exeScorm12.session.open({ ownsLifecycle: false });
        report(first, 'page-a', 100, true);

        const second = host.page();
        register(second, 'page-b');
        second.exeScorm12.session.open({ ownsLifecycle: false });
        second.loadPage();
        report(second, 'page-b', 50, true);

        expect(host.posts.at(-1).itemscores).toEqual({
            'page-a': { scorepct: 100, weighted: 100, title: '' },
            'page-b': { scorepct: 50, weighted: 100, title: '' },
        });
        expect(second.exeScorm12.client.isActive()).toBe(true);
        expect(second.addEventListener).not.toHaveBeenCalled();
        expect(second.document.addEventListener).not.toHaveBeenCalled();
        expect(host.finish).not.toHaveBeenCalled();
    });

    it('restores sibling scores when an iDevice calls scorm.init before the host bootstrap', () => {
        const host = hostSession();
        const first = host.page();
        register(first, 'a');
        register(first, 'b');
        first.exeScorm12.session.open({ ownsLifecycle: false });
        report(first, 'a', 100, true);
        report(first, 'b', 50, true);

        const resumed = host.page();
        register(resumed, 'a');
        expect(resumed.scorm.init()).toBe(true);
        expect(resumed.exeScorm12.activities.get('b').score).toBe(50);
        report(resumed, 'a', 0, false);
        resumed.exeScorm12.session.open({ ownsLifecycle: false });
        resumed.loadPage();

        expect(host.posts.at(-1).itemscores.b.scorepct).toBe(50);
        expect(host.posts.at(-1).cmi['cmi.core.score.raw']).toBe('25');
        expect(resumed.addEventListener).not.toHaveBeenCalled();
        expect(host.finish).not.toHaveBeenCalled();
    });

    it('keeps incomplete until every activity finishes, then permits a restart after navigation', () => {
        const host = hostSession();
        const page = host.page();
        register(page, 'a');
        register(page, 'b');
        page.exeScorm12.session.open({ ownsLifecycle: false });
        report(page, 'a', 100, true);

        expect(host.posts.at(-1).cmi['cmi.core.score.raw']).toBe('50');
        expect(host.posts.at(-1).cmi['cmi.core.lesson_status']).toBe('incomplete');
        // Empty-score records stay ungraded in the plugin's per-item contract.
        expect(host.posts.at(-1).itemscores.b).toBeUndefined();
        report(page, 'b', 100, true);
        expect(host.posts.at(-1).cmi['cmi.core.lesson_status']).toBe('passed');
        expect(host.posts.at(-1).cmi['cmi.core.exit']).toBe('');

        const resumed = host.page();
        register(resumed, 'a');
        register(resumed, 'b');
        resumed.exeScorm12.session.open({ ownsLifecycle: false });
        report(resumed, 'a', 0, false);
        expect(host.posts.at(-1).cmi['cmi.core.lesson_status']).toBe('incomplete');
        expect(host.posts.at(-1).cmi['cmi.core.exit']).toBe('suspend');
        expect(host.posts.at(-1).itemscores.a.scorepct).toBe(0);
    });

    it.each([[100, 50, 0], [0, 50, 100]])('publishes the same weighted mean for order %j', (...scores) => {
        const host = hostSession();
        const page = host.page();
        scores.forEach((score, index) => register(page, 'item-' + index));
        page.exeScorm12.session.open({ ownsLifecycle: false });
        scores.forEach((score, index) => report(page, 'item-' + index, score, true));

        expect(host.posts.at(-1).cmi['cmi.core.score.raw']).toBe('50');
        expect(host.posts.at(-1).cmi['cmi.core.lesson_status']).toBe('passed');
        expect(Object.values(host.posts.at(-1).itemscores).map(item => item.scorepct)).toEqual(scores);
    });
});
