#!/usr/bin/env python3
"""Validate untrusted build output before copying it into a clean release checkout."""

import os
from pathlib import Path
import re
import shutil
import stat
import sys

# Static formats shipped by the editor; new formats require an explicit review.
STATIC_SUFFIXES = set('''
.appcache .bak .css .csv .dtd .eot .gif .gz .html .ico .jpeg .jpg .js .json
.map .md .mjs .mp3 .mp4 .mts .ogg .otf .pdf .png .po .sdf .svg .swf .ts
.ttf .txt .wasm .wav .webm .webp .woff .woff2 .xap .xml .xsd .zip .zst
'''.split())
# Apache can run PHP/CGI/SSI handlers on an inner extension (shell.php.png); other
# script types only matter as the final suffix, which the allowlist already rejects,
# so locale infixes such as messages.pl.json stay valid.
SERVER_SUFFIX = re.compile(r'\.(?:php\d*|phtml|pht|phar|shtml|cgi)(?:\.|$)', re.I)


def install(source: Path, destination: Path) -> None:
    """Reject links, server code and configuration files before copying any assets."""
    if source.is_symlink() or not source.is_dir():
        raise ValueError('Editor artifact must be a directory')
    for root, dirs, files in os.walk(source, followlinks=False):
        for name in dirs + files:
            path = Path(root) / name
            mode = path.lstat().st_mode
            if name.startswith('.') or not (stat.S_ISDIR(mode) or stat.S_ISREG(mode)):
                raise ValueError(f'Unsafe editor asset: {path}')
            if stat.S_ISREG(mode) and (
                SERVER_SUFFIX.search(name)
                or (path.suffix.lower() not in STATIC_SUFFIXES and name not in {'LICENSE', 'mimetype'})
            ):
                raise ValueError(f'Non-static editor asset: {path}')
    if not (source / 'index.html').is_file() or not any(
        (source / name).is_dir() for name in ('app', 'libs', 'files')
    ):
        raise ValueError('Editor artifact is missing its entry page or assets')
    # Never merge untrusted files with an existing tree, or copy anything outside dist/static.
    shutil.copytree(source, destination)


if __name__ == '__main__':
    install(Path(sys.argv[1]), Path('dist/static'))
