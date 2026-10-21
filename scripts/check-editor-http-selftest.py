#!/usr/bin/env python3
"""Exercise the deployment check against actual HTTP responses, including redirects."""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import subprocess
import threading
import unittest


class DeploymentCheckTest(unittest.TestCase):
    def test_http_responses(self):
        class Handler(BaseHTTPRequestHandler):
            icon_status = 200
            asset_status = 403

            def do_GET(self):
                status = self.icon_status if self.path.endswith('/pix/icon.svg') else self.asset_status
                self.send_response(status)
                if status == 302:
                    self.send_header('Location', '/login/index.php')
                self.end_headers()

            def log_message(self, *args):
                pass

        server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        script = Path(__file__).with_name('check-editor-http.sh')
        try:
            for icon, asset, success in ((200, 403, True), (200, 404, True), (200, 200, False),
                                         (200, 302, False), (200, 500, False), (404, 403, False)):
                with self.subTest(icon=icon, asset=asset):
                    Handler.icon_status, Handler.asset_status = icon, asset
                    result = subprocess.run(['bash', str(script), f'http://127.0.0.1:{server.server_port}/moodle'],
                                            capture_output=True, text=True)
                    self.assertEqual(result.returncode == 0, success, result.stdout + result.stderr)
        finally:
            server.shutdown()
            server.server_close()
            thread.join()


if __name__ == '__main__':
    unittest.main()
