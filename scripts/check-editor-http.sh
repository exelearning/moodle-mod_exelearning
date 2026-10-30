#!/usr/bin/env bash
# Required deployment check: the web server must deny direct editor bundle access.
# Usage: bash scripts/check-editor-http.sh https://moodle.example/moodle
set -euo pipefail
PLUGIN="${1:?Usage: check-editor-http.sh <Moodle URL>}"
PLUGIN="${PLUGIN%/}/mod/exelearning"
status() {
    curl --silent --show-error --max-time 20 --output /dev/null --write-out '%{http_code}' "$PLUGIN/$1"
}

# A public plugin asset first, so a wrong URL or a missing plugin cannot pass.
[ "$(status pix/icon.svg)" = 200 ] \
    || { echo "FAIL: plugin icon is not reachable; check the Moodle URL" >&2; exit 1; }
for path in dist/static/index.html dist/static/app/app.js; do
    case "$(status "$path")" in
        403|404) ;;
        *) echo "FAIL: $path is reachable or errored; require HTTP 403/404" >&2; exit 1 ;;
    esac
done
echo "OK: direct editor bundle requests are denied at $1"
