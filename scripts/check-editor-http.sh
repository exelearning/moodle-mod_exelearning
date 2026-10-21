#!/usr/bin/env bash
# Required deployment check: the web server must deny direct editor bundle access.
# Usage: bash scripts/check-editor-http.sh https://moodle.example/moodle
set -euo pipefail
BASE="${1:?Usage: check-editor-http.sh <Moodle URL>}"
PLUGIN="${BASE%/}/mod/exelearning"
status() {
    curl --silent --show-error --path-as-is --max-time 20 --output /dev/null --write-out '%{http_code}' "$1"
}

# Avoid passing against an unavailable site or an incorrect Moodle subdirectory.
[ "$(status "$PLUGIN/pix/icon.svg")" = 200 ] \
    || { echo "FAIL: plugin icon is not reachable; check the Moodle URL" >&2; exit 1; }
for path in \
    'dist/static/index.html' \
    'dist/static/index.html?url=https%3A%2F%2Fexample.invalid%2Ftest.elpx' \
    'dist/static/%69ndex.html' \
    'dist/static/app/app.js'; do
    code="$(status "$PLUGIN/$path")"
    case "$code" in
        403|404) ;;
        *) echo "FAIL: $path returned HTTP $code; require 403/404 without a redirect" >&2; exit 1 ;;
    esac
done
echo "OK: direct editor entry and asset requests are denied at $BASE"
