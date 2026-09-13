from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import re
root = Path(__file__).resolve().parents[2]
class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(root), **kwargs)
    def send_head(self):
        path = Path(self.translate_path(self.path))
        if not self.headers.get('Range') or not path.is_file():
            return super().send_head()
        match = re.fullmatch(r'bytes=(\d+)-(\d*)', self.headers['Range'])
        if not match:
            self.send_error(416); return None
        size = path.stat().st_size
        start = int(match[1]); end = min(size-1, int(match[2]) if match[2] else size-1)
        if start > end:
            self.send_error(416); return None
        f = path.open('rb'); f.seek(start); self.remaining = end-start+1
        self.send_response(206)
        self.send_header('Content-Type', self.guess_type(str(path)))
        self.send_header('Accept-Ranges', 'bytes')
        self.send_header('Content-Range', f'bytes {start}-{end}/{size}')
        self.send_header('Content-Length', str(self.remaining)); self.end_headers()
        return f
    def copyfile(self, source, output):
        remaining = getattr(self, 'remaining', None)
        if remaining is None:
            return super().copyfile(source, output)
        del self.remaining
        while remaining:
            data = source.read(min(65536, remaining))
            if not data: break
            output.write(data); remaining -= len(data)
ThreadingHTTPServer(('127.0.0.1', 8783), Handler).serve_forever()
