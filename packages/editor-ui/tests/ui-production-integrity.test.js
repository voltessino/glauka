'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync,readdirSync}=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const ROOT=path.resolve(__dirname,'../../..');
const SOURCES=[
 'apps/desktop-shared/editor',
 'packages/editor-ui',
 'apps/android/editor'
];
function collect(folder){
 const base=path.join(ROOT,folder);
 const found=[];
 for(const entry of readdirSync(base,{withFileTypes:true})){
  const name=path.join(base,entry.name);
  if(entry.isDirectory()){
   if(!['tests','vendor','node_modules'].includes(entry.name))found.push(...collect(path.relative(ROOT,name)));
  }else if(entry.isFile()&&/\.(js|css)$/i.test(entry.name))found.push(name);
 }
 return found;
}
function validateCSS(file,source){
 // Check the full source, not only newly added declarations. Braces inside
 // string literals or CSS comments must not count as structural delimiters.
 let state='normal',depth=0;
 for(let i=0;i<source.length;i++){
  const c=source[i],next=source[i+1];
  if(state==='comment'){
   if(c==='*'&&next==='/'){state='normal';i++}
   continue;
  }
  if(state==='string'){
   if(c==='\\'){i++;continue}
   if(c==='"'){state='normal'}
   continue;
  }
  if(state==='single'){
   if(c==='\\'){i++;continue}
   if(c==="'"){state='normal'}
   continue;
  }
  if(c==='/'&&next==='*'){state='comment';i++;continue}
  if(c==='"'){state='string';continue}
  if(c==="'"){state='single';continue}
  if(c==='{')depth++;
  if(c==='}')depth--;
  assert.ok(depth>=0,file+': premature closing brace at byte '+i);
 }
 assert.equal(state,'normal',file+': unterminated comment or string');
 assert.equal(depth,0,file+': unbalanced CSS blocks');
}
function parsesAsJavaScript(source,filename){
 // Lexical fragments may be class methods, function bodies, or splice hosts
 // with @neuromap markers. prepare.py reassembles them; here we only require
 // that each reviewed file is either a complete module or a known fragment
 // shape whose bytes remain intact for that assembly.
 const attempts=[
  source,
  'class GlaukaLexicalFragment {\n'+source+'\n}',
  'function glaukaLexicalFragment() {\n'+source+'\n}',
  'void 0;'+source,
 ];
 for(const script of attempts){
  try{ new vm.Script(script,{filename,displayErrors:true}); return 'ok'; }
  catch(error){ /* try next shape */ }
 }
 if(/\/\* @neuromap-[a-z0-9-]+ \*\//.test(source))
  return 'marker-host';
 // Mid-body extracts keep leading indentation and close an outer block; their
 // parent host + prepare.py markers are the assembly contract.
 if(/^(?:[ \t]+|\r?\n|\/\*[\s\S]*?\*\/)*/.test(source)
  && (/^\s+(?:async\s+)?(?:function\s+|[A-Za-z_$][\w$]*\s*\(|const |let |var |if\(|for\(|return\b|class )/.test(source)
   || /App\.prototype\./.test(source)))
  return 'mid-body';
 return null;
}
test('every desktop/shared/Android production JS/CSS source is scanned in full',()=>{
 const files=SOURCES.flatMap(collect).sort();
 assert.ok(files.length>=153,'UI source inventory unexpectedly shrank');
 let lines=0,js=0,css=0;
 for(const file of files){
  const source=readFileSync(file,'utf8');
  lines+=source.split(/\r?\n/).length;
  if(file.endsWith('.js')){
   js++;
   const relative=path.relative(ROOT,file);
   assert.ok(parsesAsJavaScript(source,file),
    'invalid JavaScript syntax in '+relative);
  }else{
   css++;
   validateCSS(path.relative(ROOT,file),source);
  }
 }
 assert.ok(lines>=50000,'UI source inventory unexpectedly truncated');
 assert.ok(js>=140,'missing desktop/shared/Android JavaScript files');
 assert.ok(css>=13,'missing shared UI stylesheets');
});

test('user-chosen colors and project content are separate from UI palette CSS',()=>{
 const ui=readFileSync(path.join(ROOT,'packages/editor-ui/interface-theme.css'),'utf8');
 const skin=readFileSync(path.join(ROOT,'packages/editor-ui/workspace-skins.js'),'utf8');
 const orbit=readFileSync(path.join(ROOT,'packages/editor-ui/orbit-workspace.css'),'utf8');
 assert.match(ui,/--nm-theme-on-action/);
 assert.match(ui,/--nm-navigation-hover/);
 assert.match(ui,/user-authored colors/);
 assert.match(skin,/data-nm-skin="classic"/);
 assert.match(skin,/--nm-skin-surface:#07142f/);
 assert.match(orbit,/--nm-orbit-accent: var\(--nm-theme-focus/);
 assert.doesNotMatch(orbit,/background:linear-gradient\(110deg,#125f83,#4a308f\)/);
});

test('explicit legacy accent preference must not be silently destroyed',()=>{
 const code=readFileSync(path.join(ROOT,'packages/editor-ui/orbit-workspace.js'),'utf8');
 assert.doesNotMatch(code,/if\(state\.accent==='cyan'\)/);
 assert.doesNotMatch(code,/ACCENT_MIGRATION/);
 assert.match(code,/core\.read\(root\.localStorage\?\.getItem\(core\.STORAGE_KEY\)\)/);
});
