"""Local-only RealSense comparison service. Camera opens only on an explicit start."""
import base64
import io
import json
import secrets
import threading
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from .capture import REPO_DIR, DEFAULT_MODEL, open_camera, landmarker, read_frame
from .comparison import compare
from .height_3d import fit, prior
from . import remote


class Camera:
    def __init__(self):
        self.lock = threading.RLock()
        self.pipeline = self.detector = self.token = None
        self.last = 0

    def stop(self):
        with self.lock:
            try:
                if self.pipeline: self.pipeline.stop()
            finally:
                self.pipeline = None
                if self.detector: self.detector.close()
                self.detector = self.token = None

    def start(self, side):
        with self.lock:
            if self.pipeline:
                raise ValueError('The comparison camera is already open in another session.')
            if side not in ('left', 'right'): raise ValueError('Choose the operated side.')
            try:
                self.pipeline,self.align,self.scale,_,self.info = open_camera()
                self.detector = landmarker(DEFAULT_MODEL)
            except Exception:
                self.stop()
                raise
            self.side,self.token,self.last = side,secrets.token_urlsafe(24),time.monotonic()
            read_frame.reference = None
            return {'token':self.token, 'device':self.info['model']}

    def frame(self, body):
        with self.lock:
            if not self.token or not secrets.compare_digest(str(body.get('token','')),self.token):
                raise ValueError('Camera session ended. Start the camera again.')
            self.last = time.monotonic()
            result = {}
            def receive(colour,record):
                from PIL import Image
                data=io.BytesIO()
                Image.fromarray(colour[:,:,::-1]).save(data,format='JPEG',quality=88)
                result.update(compare(record,body.get('height_cm'),body.get('weight_kg')))
                result['height_3d']=fit(record,body.get('height_cm'),body.get('reference_group','combined')) if body.get('height_3d_enabled') else {'available':False,'reason':'Research fit is switched off.'}
                result.update(image=base64.b64encode(data.getvalue()).decode('ascii'),
                              width=colour.shape[1],height=colour.shape[0],
                              points_px=record['points_px'] if record else [],
                              captured_at=time.time(),device=self.info['model'])
            try:
                read_frame(self.pipeline,self.align,self.scale,self.detector,self.side,
                           time.monotonic()*1000,on_frame=receive)
            except Exception:
                self.stop()
                raise
            if not result: raise ValueError('No synchronised colour and depth frame. Try again.')
            return result


camera = Camera()


class Handler(SimpleHTTPRequestHandler):
    def __init__(self,*args,**kwargs):
        super().__init__(*args,directory=REPO_DIR,**kwargs)

    def do_GET(self):
        if self.path=="/api/intel/status":
            self.respond({"service":"kneora-intel"})
        else:
            super().do_GET()

    def do_POST(self):
        origin=self.headers.get('Origin')
        if origin and origin != 'http://'+self.headers.get('Host',''):
            self.send_error(403);return
        try:
            size=int(self.headers.get('Content-Length','0'))
            if not 0 < size <= 4096: raise ValueError('Invalid request size.')
            body=json.loads(self.rfile.read(size))
            if self.path=='/api/remote/create': result=remote.create()
            elif self.path=='/api/remote/poll': result=remote.desktop(body)
            elif self.path=='/api/intel/height-prior': result=prior(body.get('height_cm'),body.get('reference_group','combined'))
            elif self.path=='/api/intel/start': result=camera.start(body.get('side'))
            elif self.path=='/api/intel/frame': result=camera.frame(body)
            elif self.path=='/api/intel/stop':
                with camera.lock:
                    if camera.token and not secrets.compare_digest(str(body.get('token','')),camera.token):
                        raise ValueError('Camera belongs to another session.')
                    camera.stop()
                result={'stopped':True}
            else:
                self.send_error(404);return
            self.respond(result)
        except ImportError as error:
            self.respond({'error':'RealSense comparison dependencies are missing: '+str(error)+'. See depth-bench/README.md.'},503)
        except Exception as error:
            self.respond({'error':str(error)},503)

    def respond(self,body,status=200):
        data=json.dumps(body,allow_nan=False).encode()
        self.send_response(status);self.send_header('Content-Type','application/json')
        self.send_header('Cache-Control','no-store');self.send_header('Content-Length',str(len(data)))
        self.end_headers();self.wfile.write(data)


def main():
    import argparse
    parser=argparse.ArgumentParser();parser.add_argument('--port',type=int,default=8000)
    args=parser.parse_args()
    def expire():
        while True:
            time.sleep(2)
            with camera.lock:
                if camera.pipeline and time.monotonic()-camera.last>10: camera.stop()
    threading.Thread(target=expire,daemon=True).start()
    server=ThreadingHTTPServer(('127.0.0.1',args.port),Handler)
    print('Intel comparison: http://localhost:%d/intel-comparison.html'%args.port,flush=True)
    try: server.serve_forever()
    finally: camera.stop();server.server_close()

if __name__=='__main__': main()
