#!/usr/bin/env bash
#
# Static guard (DEC-78-01): the Release workflow must build the embedded editor
# from a fixed editor TAG matching the plugin release tag -- never from the
# moving `main` branch -- so two builds of the same plugin release always bundle
# the same editor (and the editor reports the final version, not a nightly/alpha
# build). This mirrors the convention in exelearning/mod_exeweb and
# exelearning/mod_exescorm. The manual `workflow_dispatch` branch is exempt: it
# legitimately keeps the `main`/`auto` defaults for local/manual testing.
#
# Usage: bash scripts/check-release-workflow.sh
#
set -euo pipefail

WF=".github/workflows/release.yml"
[ -f "$WF" ] || { echo "ERROR: $WF not found"; exit 1; }

# Isolate only the release-event branch of the env-setup conditional:
#   if [ "...event_name" = "release" ]; then  <BLOCK>  else ...
block="$(awk '/= "release" \]; then/{f=1; next} f && /^[[:space:]]*else/{f=0} f' "$WF")"

if [ -z "$block" ]; then
    echo "ERROR: could not locate the release-event branch in $WF"; exit 1
fi

fail=0

echo "$block" | grep -q 'EXELEARNING_EDITOR_REF_TYPE=tag' \
    || { echo "FAIL: release event must set EXELEARNING_EDITOR_REF_TYPE=tag"; fail=1; }

if echo "$block" | grep -qE 'EXELEARNING_EDITOR_REF=(main|master)'; then
    echo "FAIL: release event must NOT build the editor from a branch (main/master)"; fail=1
fi

if echo "$block" | grep -q 'EXELEARNING_EDITOR_REF_TYPE=branch'; then
    echo "FAIL: release event must NOT use EXELEARNING_EDITOR_REF_TYPE=branch"; fail=1
fi

echo "$block" | grep -q 'EXELEARNING_EDITOR_REF=v${VERSION_TAG}' \
    || { echo 'FAIL: release event must pin EXELEARNING_EDITOR_REF=v${VERSION_TAG}'; fail=1; }

# Untrusted builds may export only assets; packaging must run on the clean runner.
build="$(sed -n '/^  build:/,/^  publish:/p' "$WF")"
publish="$(sed -n '/^  publish:/,$p' "$WF")"
if echo "$build" | grep -q 'make package'; then
    echo "FAIL: untrusted build job must not package plugin source"; fail=1
fi
echo "$build" | grep -q 'path: dist/static/' \
    || { echo "FAIL: build artifact must contain static assets only"; fail=1; }
echo "$publish" | grep -q 'scripts/install-editor-assets.py' \
    || { echo "FAIL: clean packaging job must validate static assets"; fail=1; }
echo "$publish" | grep -q 'make package' \
    || { echo "FAIL: clean packaging job must build the plugin ZIP"; fail=1; }
if echo "$publish" | grep -q 'needs.build.outputs'; then
    echo "FAIL: privileged release metadata must not come from the untrusted job"; fail=1
fi

if [ "$fail" -ne 0 ]; then
    echo "Release workflow editor-pinning guard FAILED."; exit 1
fi

echo "OK: release workflow pins the editor to the matching tag (REF=v\${VERSION_TAG}, TYPE=tag)."
