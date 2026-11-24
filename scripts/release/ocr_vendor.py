"""Pinned offline Tesseract WASM/Italian assets. Downloads only at packaging time."""
from pathlib import Path
import base64,hashlib,io,json,os,tarfile,tempfile,urllib.request
PACKAGES = {
 'tesseract.js': ('6.0.1','/sPvMvrCtgxnNRCjbTYbr7BRu0yfWDsMZQ2a/T5aN/L1t8wUQN6tTWv6p6FwzpoEBA0jrN2UD2SX4QQFRdoDbA==', {
  'dist/tesseract.min.js':'tesseract.min.js','dist/worker.min.js':'worker.min.js',
  'LICENSE.md':'TESSERACT-LICENSE.txt','dist/tesseract.min.js.LICENSE.txt':'BROWSER-NOTICES.txt','dist/worker.min.js.LICENSE.txt':'WORKER-NOTICES.txt'}),
 'tesseract.js-core': ('6.0.0','1Qncm/9oKM7xgrQXZXNB+NRh19qiXGhxlrR8EwFbK5SaUbPZnS5OMtP/ghtqfd23hsr1ZvZbZjeuAGcMxd/ooA==', {
  'tesseract-core-lstm.wasm.js':'tesseract-core-lstm.wasm.js',
  'tesseract-core-simd-lstm.wasm.js':'tesseract-core-simd-lstm.wasm.js','LICENSE':'CORE-LICENSE.txt'})}
MODEL_REV='e12c65a915945e4c28e237a9b52bc4a8f39a0cec'
MODEL_SHA='8df9c89176fb93f56bf4b2d4ede04c01c1f31d4b7697fbd76cc336df700f3f38'
MAX_BYTES=40*1024*1024
ASSETS=('tesseract.min.js','worker.min.js','tesseract-core-lstm.wasm.js','tesseract-core-simd-lstm.wasm.js','ita.traineddata')
def cached(name,url,verify,cache):
 p=cache/name
 if p.exists():data=p.read_bytes()
 else:
  with urllib.request.urlopen(url,timeout=60) as r:data=r.read(MAX_BYTES+1)
 if len(data)>MAX_BYTES or not verify(data):raise ValueError('OCR dependency hash/size mismatch: '+name)
 if not p.exists():
  cache.mkdir(parents=True,exist_ok=True)
  with tempfile.NamedTemporaryFile(dir=cache,delete=False) as f:f.write(data);tmp=Path(f.name)
  try:tmp.replace(p)
  finally:tmp.unlink(missing_ok=True)
 return data

def stage(directory,cache=None):
 directory=Path(directory)
 if directory.exists():raise FileExistsError(directory)
 cache=Path(cache or Path(os.environ.get('XDG_CACHE_HOME') or Path.home()/'.cache')/'neuromap/ocr')
 files={}
 for name,(version,sri,selected) in PACKAGES.items():
  data=cached(name+'-'+version+'.tgz',f'https://registry.npmjs.org/{name}/-/{name}-{version}.tgz',lambda b,s=sri:hashlib.sha512(b).digest()==base64.b64decode(s),cache)
  with tarfile.open(fileobj=io.BytesIO(data),mode='r:gz') as t:
   for src,dst in selected.items():
    item=t.getmember('package/'+src)
    if not item.isfile() or not 50<item.size<10*1024*1024:raise ValueError('Invalid OCR asset')
    files[dst]=t.extractfile(item).read()
 files['ita.traineddata']=cached('ita.traineddata',f'https://raw.githubusercontent.com/tesseract-ocr/tessdata_best/{MODEL_REV}/ita.traineddata',lambda b:hashlib.sha256(b).hexdigest()==MODEL_SHA,cache)
 # The model repository and these engines are Apache-2.0; retain upstream notices.
 files['MODEL-LICENSE.txt']=cached('model-LICENSE',f'https://raw.githubusercontent.com/tesseract-ocr/tessdata_best/{MODEL_REV}/LICENSE',lambda b:hashlib.sha256(b).hexdigest()=='a6cba85bc92e0cff7a450b1d873c0eaa2e9fc96bf472df0247a26bec77bf3ff9',cache)
 files['MODEL-NOTICE.txt']=(f'Italian tessdata_best, Apache-2.0. Source: https://github.com/tesseract-ocr/tessdata_best/tree/{MODEL_REV}\nSHA256: {MODEL_SHA}\nSee TESSERACT-LICENSE.txt.\n').encode()
 files['manifest.json']=json.dumps({'engine':'Tesseract.js 6.0.1 / core 6.0.0','language':'ita','modelRevision':MODEL_REV,'sha256':{n:hashlib.sha256(b).hexdigest() for n,b in files.items()}},indent=2).encode()
 directory.mkdir(parents=True)
 for name,data in files.items():(directory/name).write_bytes(data)
 return directory
