"""Same-LAN remote. Dedicated server exposes only remote assets and token-protected commands."""
import io,json,secrets,socket,threading,time
from pathlib import Path
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
ROOT=Path(__file__).resolve().parents[2]
LOCK=threading.RLock()
SESSION=None
SERVER=None

def access(token,role):
    if not SESSION or time.monotonic()>SESSION['expires'] or not secrets.compare_digest(str(token or ''),SESSION[role]):
        raise ValueError('Pairing ended. Scan a new code on the computer.')
    return SESSION

def create():
    global SESSION,SERVER
    import qrcode,qrcode.image.svg
    with LOCK:
        if SERVER is None:
            SERVER=ThreadingHTTPServer(('0.0.0.0',8892),Handler)
            threading.Thread(target=SERVER.serve_forever,daemon=True).start()
        s=socket.socket(socket.AF_INET,socket.SOCK_DGRAM)
        try:s.connect(('8.8.8.8',80));address=s.getsockname()[0]
        finally:s.close()
        SESSION={'desktop':secrets.token_urlsafe(32),'phone':secrets.token_urlsafe(32),'expires':time.monotonic()+1800,'heartbeat':0,'queue':[],'seen':set(),'state':{'phase':'waiting','title':'Choose an exercise on the computer','voice':True},'seq':0}
        url=f'http://{address}:8892/phone.html#'+SESSION['phone']
        out=io.BytesIO();qrcode.make(url,image_factory=qrcode.image.svg.SvgPathImage,border=4).save(out)
        return {'token':SESSION['desktop'],'url':url,'svg':out.getvalue().decode(),'expires_in_s':1800}

def desktop(body):
    global SESSION
    with LOCK:
        a=access(body.get('token'),'desktop')
        if body.get('close'):SESSION=None;return {'closed':True}
        state=body.get('state',{})
        if state.get('phase') not in ('waiting','ready','countdown','running','paused','finished','guide'):raise ValueError('Invalid state.')
        a['state']={'phase':state['phase'],'title':str(state.get('title',''))[:100],'voice':bool(state.get('voice'))}
        a['state']['exercises']=[{'id':str(e.get('id',''))[:60],'title':str(e.get('title',''))[:100]} for e in state.get('exercises',[])[:40]]
        a['heartbeat']=time.monotonic()
        commands=a['queue'];a['queue']=[]
        return {'commands':commands}

class Handler(BaseHTTPRequestHandler):
    def log_message(self,*args):pass # Do not log pairing tokens.
    def respond(self,data,status=200,mime='application/json'):
        raw=json.dumps(data).encode() if mime=='application/json' else data
        self.send_response(status);self.send_header('Content-Type',mime);self.send_header('Cache-Control','no-store');self.send_header('Referrer-Policy','no-referrer');self.send_header('Content-Length',str(len(raw)));self.end_headers();self.wfile.write(raw)
    def do_GET(self):
        name={'/phone.html':'phone.html','/phone-remote.mjs':'phone-remote.mjs'}.get(self.path)
        if not name:self.respond({'error':'Not found'},404);return
        self.respond((ROOT/name).read_bytes(),mime='text/html' if name.endswith('html') else 'text/javascript')
    def do_POST(self):
        if self.headers.get('Origin')!='http://'+self.headers.get('Host',''):
            self.respond({'error':'Origin rejected'},403);return
        try:
            n=int(self.headers.get('Content-Length','0'))
            if not 0<n<=2048:raise ValueError('Invalid request.')
            body=json.loads(self.rfile.read(n))
            with LOCK:
                a=access(body.get('token'),'phone')
                live=time.monotonic()-a['heartbeat']<6
                if self.path=='/remote/state':self.respond({'connected':live,**a['state']});return
                if self.path!='/remote/command':raise ValueError('Unknown request.')
                if not live:raise ValueError('Computer disconnected. Controls paused.')
                action=body.get('action');phase=a['state']['phase']
                allowed={'select':['waiting','ready','finished'],'continue':['guide'],'start':['ready'],'cancel':['countdown'],'pause':['running'],'resume':['paused'],'finish':['running','paused'],'voice':['waiting','ready','countdown','running','paused','guide']}
                if phase not in allowed.get(action,[]):raise ValueError('This control is not available now.')
                exercise=str(body.get('exercise',''))
                if action=='select' and exercise not in [e['id'] for e in a['state'].get('exercises',[])]:raise ValueError('Exercise unavailable.')
                request_id=str(body.get('id',''))
                if not request_id or len(request_id)>80:raise ValueError('Invalid command.')
                if request_id not in a['seen']:
                    if len(a['queue'])>=10:raise ValueError('Please wait for the computer.')
                    a['seen'].add(request_id);a['seq']+=1;a['queue'].append({'action':action,'seq':a['seq'],'exercise':exercise})
                self.respond({'accepted':True})
        except Exception as e:self.respond({'error':str(e)},400)
