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

// Resilience script inlined by editor/index.php (exelearning/exelearning issue 2476).
//
// The editor's preview needs its preview-sw.js: without it the preview falls back
// to a blob: URL where the theme CSS url(...) images (navigation icons, sprites)
// cannot resolve. The editor already handles a failed registration itself, so the
// bootstrap must leave navigator.serviceWorker.register untouched.
const fs = require('fs');
const path = require('path');

/** Extracts the resilience block of the bootstrap script and runs it. */
function runBootstrap(window) {
    const source = fs.readFileSync(path.join(__dirname, '../../editor/index.php'), 'utf8');
    const start = source.indexOf("// The static editor's ResourceFetcher rejects");
    const end = source.indexOf('</script>', start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    // The block lives in a PHP heredoc, which escapes "$" as "\$".
    const block = source.slice(start, end).replace(/\\\$/g, '$');
    new Function('window', 'navigator', block)(window, window.navigator);
}

describe('editor bootstrap: preview service worker', () => {
    it('leaves navigator.serviceWorker.register to the editor', () => {
        const register = vi.fn();
        const window = { navigator: { serviceWorker: { register } } };

        runBootstrap(window);

        expect(window.navigator.serviceWorker.register).toBe(register);
    });
});
