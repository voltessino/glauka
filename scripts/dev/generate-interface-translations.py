# Optional developer utility: catalog text only, no projects, keys, or document content.
from pathlib import Path
import json,re,urllib.request,urllib.parse,time,threading,concurrent.futures,collections
import argparse
parser=argparse.ArgumentParser(description='Regenerate missing UI translations using Google Translate; never called by the application or release build.')
parser.add_argument('--allow-network',action='store_true',help='Explicitly allow sending catalog UI strings to the translation service')
args=parser.parse_args()
if not args.allow_network:parser.error('--allow-network is required; local builds never translate online')
root=Path(__file__).resolve().parents[2]/'packages/editor-ui/locales';base=json.loads((root/'source.json').read_text());entries=base['entries'];lock=threading.Lock();progress=collections.Counter()
protected=re.compile(r'Glauka|NeuroMap|OpenAI|OpenRouter|Anthropic|Google Gemini|Claude|Gemini|Groq|Ollama|LM Studio|Microsoft Word|XMind|xmind|Anki|Iconify|MyMemory|Flashcard|Ctrl|Alt|Shift|Enter|Tab|Esc|Cmd|Command|\{\d+\}|\.(?:neuromap|xmind|json|md|opml|png|svg|pdf|docx)|API|JSON|SVG|PNG|PDF|HTML|Markdown|OPML|OCR|UTF-8|CSV|SHA-256')
def shield(s):
 tokens=[]
 def sub(m):tokens.append(m.group());return '⟦TOKEN'+str(len(tokens)-1)+'⟧'
 return protected.sub(sub,s).replace('\n','⟦NEWLINE⟧'),tokens
def unshield(s,tokens):
 for i,t in enumerate(tokens):
  token='⟦TOKEN'+str(i)+'⟧'
  if token not in s:raise ValueError('Translation changed a protected token')
  s=s.replace(token,t)
 return s.replace('⟦NEWLINE⟧','\n')
def request(text,lang,sl):
 u='https://translate.googleapis.com/translate_a/single?'+urllib.parse.urlencode(dict(client='gtx',sl=sl,tl=lang,dt='t',q=text))
 for attempt in range(6):
  try:
   req=urllib.request.Request(u,headers={'User-Agent':'Glauka localization build'})
   data=json.load(urllib.request.urlopen(req,timeout=25));return ''.join(p[0]or''for p in data[0])
  except Exception:
   if attempt==5:raise
   time.sleep(min(8,1+attempt*2))
def translate_batch(items,lang,sl):
 shielded=[shield(text)for _,text in items]
 try:
  output=request('\n'.join(s for s,_ in shielded),lang,sl).split('\n')
  if len(output)!=len(items):raise ValueError('Line count')
  return {key:unshield(out.strip(),tokens)for(key,_),out,(_,tokens)in zip(items,output,shielded)}
 except Exception:
  if len(items)==1:
   print('TOKEN-FAIL',lang,repr(items[0]),repr(output) if 'output' in locals() else '',flush=True);raise
  mid=len(items)//2;return {**translate_batch(items[:mid],lang,sl),**translate_batch(items[mid:],lang,sl)}
def run(lang):
 p=root/(lang+'.json');values=json.loads(p.read_text())if p.exists()else{}
 for key,e in entries.items():
  if e['known']and lang in ['it','en']:values[key]=e[lang]
  elif re.fullmatch(r'(?:Ctrl|Alt|Shift|Cmd|Command|⌘)[+A-Za-z0-9/ ·↑↓-]{1,30}',e['en']) or not re.search('[A-Za-zÀ-ž]',protected.sub('',e['en'])):values[key]=e['en']
 def save():
  reviewed=json.loads((root/'reviewed-terms.json').read_text())
  for key,terms in reviewed.items():
   if lang in terms:values[key]=terms[lang]
  temp=p.with_suffix('.json.tmp');temp.write_text(json.dumps(values,ensure_ascii=False,indent=2)+'\n');temp.replace(p)
 save()
 for known in [True,False]:
  batch=[];size=0
  pending=[(k,e['en'])for k,e in entries.items()if k not in values and e['known']==known]
  batches=[]
  for item in pending:
   if size+len(item[1])>2600 and batch:batches.append(batch);batch=[];size=0
   batch.append(item);size+=len(item[1])+1
  if batch:batches.append(batch)
  for batch in batches:
   values.update(translate_batch(batch,lang,'en'if known else'auto'));save()
   with lock:
    progress[lang]=len(values);print(lang,len(values),'/',len(entries),flush=True)
 print('COMPLETE',lang,len(values),flush=True)
with concurrent.futures.ThreadPoolExecutor(max_workers=8)as pool:
 futures={pool.submit(run,l['code']):l['code']for l in base['languages']}
 for future in concurrent.futures.as_completed(futures):
  try:future.result()
  except Exception as e:print('FAILED',futures[future],type(e).__name__,str(e),flush=True);raise
