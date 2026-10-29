import { defineConfig } from 'vitest/config';

// Vitest config for the plugin's own JavaScript unit tests. Scope: the grade-critical
// SCORM tracker (js/scorm_tracker.js), the secure-mode SCORM bridge (js/scorm_bridge_*),
// the external-embed shim/relay (js/exe_embed_*) and the editor bootstrap
// (editor/index.php). Other UI glue (amd/src/*) and the vendored pipwerks wrappers
// (assets/scorm/*) are out of scope. The embedded editor (exelearning/) ships its own
// Vitest suite and is not retested here.
export default defineConfig({
    test: {
        globals: true,
        // happy-dom gives the tracker a window/document for resolveObjectMap and the
        // beforeunload wiring, matching the embedded editor's own setup.
        environment: 'happy-dom',
        // happy-dom 21 makes iframe page loading opt-in, which leaves iframes
        // without a contentWindow; the embed/bridge tests identify a message's
        // sender by comparing event.source against it.
        environmentOptions: {
            happyDOM: { settings: { enableIframePageLoading: true } },
        },
        include: ['tests/js/**/*.test.js'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'lcovonly', 'cobertura'],
            reportsDirectory: './coverage',
            include: ['js/**'],
            // The editor bridge lives in js/ only because it is not an AMD module; it stays
            // out of unit scope (DEC-74-01: postMessage glue to editor internals, e2e territory).
            exclude: ['js/moodle_exe_bridge.js'],
        },
    },
});
