#!/usr/bin/env python3
"""Exercise the real Go window-exit protocol, not native window GUI automation."""
import argparse,http.cookiejar,json,os,re,subprocess,tempfile,time,urllib.request
from urllib.parse import urlsplit, parse_qs
from pathlib import Path

def verify(binary):
 with tempfile.TemporaryDirectory(prefix='neuromap-exit-') as config:
  env=dict(os.environ,XDG_CONFIG_HOME=config,APPDATA=config)
  proc=subprocess.Popen([str(Path(binary).resolve()),'--mac-server'],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,env=env)
  try:
   url=proc.stdout.readline().strip()
   parsed=urlsplit(url)
   if (parsed.scheme!='http' or parsed.hostname!='127.0.0.1' or not parsed.port or
       not re.fullmatch(r'[A-Za-z0-9_-]{43}',parse_qs(parsed.query).get('__nm_launch',[''])[0])):
    raise RuntimeError('No authenticated loopback service launch URL')
   base=f'http://127.0.0.1:{parsed.port}/'
   jar=http.cookiejar.CookieJar()
   opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
   def page(first=False):
    with opener.open(urllib.request.Request(url if first else base,headers={'Sec-Fetch-Dest':'document'}),timeout=5) as r:return r.read().decode()
   token=re.search(r"const token='([^']+)'",page(first=True)).group(1)
   def call(route,data):
    req=urllib.request.Request(base+'__desktop/'+route,data=json.dumps(data).encode(),headers={'X-NeuroMap-Session':token,'Content-Type':'application/json'})
    with urllib.request.urlopen(req,timeout=5) as r:return r.read()
   call('heartbeat',{'windowId':'a','state':'open','sequence':1})
   page()  # A reload has begun; allow slow bootstrap past the close grace.
   call('window/closed',{'windowId':'a','sequence':3})
   time.sleep(4)
   assert proc.poll() is None,'Backend exited during a reload'
   call('heartbeat',{'windowId':'a','state':'open','sequence':1}) # late packet
   call('heartbeat',{'windowId':'b','state':'open','sequence':1})
   payload=json.dumps({'tabs':[{'id':'qa','root':{'id':'root','text':'Recovery','children':[]}}],'qa':'recoverable before close'})
   call('workspace/write',{'json':payload})
   begin=time.monotonic();call('window/closed',{'windowId':'b','sequence':2})
   assert proc.wait(timeout=8)==0,'Backend exit failed'
   files=[p for p in Path(config).rglob('*.json') if p.read_text()==payload]
   assert files,'Recovery bytes were not preserved'
   return {'reloadSurvived':True,'lateOpenIgnored':True,'processExited':True,'recoveryPreserved':True,'observedExitSeconds':round(time.monotonic()-begin,3),'nativeGUIExercised':False}
  finally:
   if proc.poll() is None:proc.terminate();proc.wait(timeout=5)
if __name__=='__main__':
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('backend');args=parser.parse_args();print(json.dumps(verify(args.backend),indent=2))
