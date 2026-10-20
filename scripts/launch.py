"""Start the built app locally; Python 3 standard library only."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import threading
import webbrowser

root = Path(__file__).resolve().parent
if not (root / 'dist').is_dir():
    root = root.parent
if not (root / 'dist' / 'index.html').is_file():
    raise SystemExit('Missing dist/index.html. Run npm run build first.')

class Handler(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map, '.mjs': 'application/javascript', '.woff2': 'font/woff2', '.ttf': 'font/ttf'}

try:
    server = ThreadingHTTPServer(('127.0.0.1', 8765), partial(Handler, directory=str(root / 'dist')))
except OSError as error:
    raise SystemExit('Port 8765 is in use. Close the previous finance desk window/server, then try again.') from error

url = 'http://127.0.0.1:8765'
print('LONGUN Finance Desk: ' + url)
print('Keep this window open while using the app. Press Ctrl+C to stop.')
threading.Timer(0.8, lambda: webbrowser.open(url)).start()
try:
    server.serve_forever()
except KeyboardInterrupt:
    pass
finally:
    server.server_close()
