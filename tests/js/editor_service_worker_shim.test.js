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

// Service-worker shim inlined by editor/index.php (exelearning/exelearning issue 2476).
//
// The editor's preview needs its preview-sw.js: without it the preview falls back
// to a blob: URL where the theme CSS url(...) images (navigation icons, sprites)
// cannot resolve. The shim must let that registration through and only absorb a
// failed one (a proxied static.php router that 404s the worker script).
const fs = require('fs');
const path = require('path');

/** Extracts the service-worker block of the bootstrap script and runs it. */
function installShim(navigator, console) {
    const source = fs.readFileSync(path.join(__dirname, '../../editor/index.php'), 'utf8');
    const start = source.indexOf('if ("serviceWorker" in navigator) {');
    const end = source.indexOf('var originalFetch = window.fetch;', start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    new Function('navigator', 'console', source.slice(start, end))(navigator, console);
}

function fakeNavigator(register) {
    return { serviceWorker: { register } };
}

describe('editor bootstrap: preview service worker', () => {
    it('registers preview-sw.js so the preview can resolve theme images', async () => {
        const registration = { scope: '/mod/exelearning/editor/static.php/2/viewer/' };
        const register = vi.fn(() => Promise.resolve(registration));
        const nav = fakeNavigator(register);
        installShim(nav, console);

        const result = await nav.serviceWorker.register('/static.php/2/preview-sw.js', { scope: 'viewer/' });

        expect(register).toHaveBeenCalledWith('/static.php/2/preview-sw.js', { scope: 'viewer/' });
        expect(result).toBe(registration);
    });

    it('resolves a failed registration quietly so the editor uses its blob fallback', async () => {
        const nav = fakeNavigator(() => Promise.reject(new TypeError('404 fetching the script')));
        const warn = vi.fn();
        installShim(nav, { warn });

        await expect(nav.serviceWorker.register('/static.php/2/preview-sw.js')).resolves.toEqual({ scope: '' });
        expect(warn).toHaveBeenCalled();
    });
});
