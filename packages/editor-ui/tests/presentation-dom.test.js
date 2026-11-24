const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

function harness(){
  const ids=new Map(),frames=[],events={};
  let doc;
  class Element{
    constructor(tag){
      this.tagName=tag;this.children=[];this.parentElement=null;this.className='';
      this.hidden=false;this.textContent='';this.id='';this.title='';
      this.style={setProperty:(k,v)=>{this.style[k]=v}};this.attributes={};this._events={};
    }
    set id(value){this._id=value;if(value)ids.set(value,this)}
    get id(){return this._id}
    get classList(){const e=this;return{
      contains:c=>e.className.split(' ').includes(c),
      add:c=>{e.className=[...new Set([...e.className.split(' ').filter(Boolean),c])].join(' ')},
      remove:c=>{e.className=e.className.split(' ').filter(x=>x!==c).join(' ')},
      toggle:(c,on)=>{const yes=on===undefined?!e.className.split(' ').includes(c):!!on;
        if(yes)e.classList.add(c);else e.classList.remove(c);return yes}
    }}
    append(...children){for(const c of children){this.children.push(c);c.parentElement=this}}
    prepend(...children){this.children.unshift(...children);for(const c of children)c.parentElement=this}
    insertBefore(c,target){const i=this.children.indexOf(target);this.children.splice(i<0?this.children.length:i,0,c);c.parentElement=this}
    replaceChildren(...children){this.children=[];this.append(...children)}
    setAttribute(k,v){this.attributes[k]=String(v)}
    getAttribute(k){return this.attributes[k]}
    removeAttribute(k){delete this.attributes[k];if(k==='src')this.src=''}
    addEventListener(k,fn){(this._events[k]??=[]).push(fn)}
    dispatch(k,e={}){for(const fn of this._events[k]||[])fn(e)}
    focus(){doc.activeElement=this}
    closest(selector){return null}
    querySelectorAll(q){
      const matches=[],check=n=>q[0]==='.'?n.className.split(' ').includes(q.slice(1)):n.tagName===q;
      const stack=[...this.children];while(stack.length){const n=stack.shift();if(check(n))matches.push(n);stack.push(...n.children)}
      return matches;
    }
    querySelector(q){
      if(q[0]==='#')return ids.get(q.slice(1))||null;
      const find=n=>q[0]==='.'?n.className.split(' ').includes(q.slice(1)):n.tagName===q;
      const stack=[...this.children];while(stack.length){const e=stack.shift();if(find(e))return e;stack.push(...e.children)}
      return null;
    }
  }
  doc={
    head:new Element('head'),body:new Element('body'),documentElement:{lang:'it'},activeElement:null,
    getElementById:id=>ids.get(id)||null,createElement:tag=>new Element(tag),
    querySelector:q=>doc.body.querySelector(q),
    addEventListener:(kind,fn)=>(events[kind]??=[]).push(fn),
    baseURI:'https://neuromap.local/'
  };
  const bar=new Element('header');bar.className='top-chrome';doc.body.append(bar);
  const full=new Element('button');full.id='btn-fullscreen';bar.append(full);
  const imagePanel=new Element('aside');imagePanel.id='image-controls';
  const buttons=new Element('div');buttons.className='image-control-buttons';imagePanel.append(buttons);doc.body.append(imagePanel);
  const menu=new Element('div');menu.id='ctx-group-image';doc.body.append(menu);
  const contextMenu=new Element('div');contextMenu.id='context-menu';doc.body.append(contextMenu);
  class MockURL{
    constructor(src){this.protocol=/^https?:/.test(src)?src.slice(0,src.indexOf(':')+1):
      /^blob:/.test(src)?'blob:':/^data:/.test(src)?'data:':/^javascript:/.test(src)?'javascript:':'https:'}
  }
  const context={document:doc,console,URL:MockURL,requestAnimationFrame:fn=>frames.push(fn),
    innerWidth:1400,innerHeight:850,globalThis:null};
  context.globalThis=context;
  const code=fs.readFileSync(path.join(__dirname,'..','presentation-experience.js'),'utf8');
  vm.runInNewContext(code,context,{filename:'presentation-experience.js'});
  const root={id:'root',text:'Topics',children:[{id:'a',text:'Cells',parentId:'root',children:[]}]};
  const image={id:'img',src:'data:image/png;base64,iVBORw0KGgo=',caption:'Histology'};
  const state={root,selectedNodeId:'a',selectedImageId:null,undoStack:[],
    findNode(id){return id==='root'?root:id==='a'?root.children[0]:null},
    findImage(id){return id===image.id?image:null}};
  class App{
    bindUI(){}
    requestRender(){this.rendered=(this.rendered||0)+1}
    selectNode(id){state.selectedNodeId=id}
    stopTeleport(){}
    editSelected(){this.editCount=(this.editCount||0)+1}
    addChild(){this.childCount=(this.childCount||0)+1}
  }
  context.NeuroMapPresentationInstall(App);
  const app=new App();app.state=state;app.renderer={camera:{x:400,y:300,zoom:1}};
  app.layout={getLayout:id=>({root:{x:0,y:0},a:{x:100,y:40}})[id]};
  app.bindUI();
  function flush(){let guard=25;while(frames.length&&guard--)frames.shift()();assert.ok(guard>0)}
  flush();
  return {app,state,doc,context,flush,events};
}
test('Zen hides interface without mutating map or Undo, then restores all controls',()=>{
  const {app,state,doc,flush}=harness(),before=JSON.stringify(state.root);
  doc.getElementById('nm616-zen-switch').dispatch('click');flush();
  assert.equal(doc.body.classList.contains('nm616-zen'),true);
  assert.equal(doc.getElementById('nm616-zen-switch').getAttribute('aria-pressed'),'true');
  assert.equal(doc.getElementById('nm616-zen-exit').textContent,'← Esci da Zen');
  doc.getElementById('nm616-zen-exit').dispatch('click');flush();
  assert.equal(doc.body.classList.contains('nm616-zen'),false);
  assert.equal(JSON.stringify(state.root),before);
  assert.equal(state.undoStack.length,0);
});
test('breadcrumb navigation pans to ancestor without changing saved node content',()=>{
  const {app,state,doc,flush}=harness(),before=JSON.stringify(state.root);
  const nav=doc.getElementById('nm616-context-path');
  assert.equal(doc.getElementById('nm616-context').hidden,false);
  assert.equal(nav.children.length,3);
  nav.children[0].dispatch('click');flush();
  assert.equal(state.selectedNodeId,'root');
  assert.equal(JSON.stringify(state.root),before);
  assert.equal(state.undoStack.length,0);
});
test('contextual quick actions reuse existing editor commands',()=>{
  const {app,doc}=harness();
  doc.getElementById('nm616-quick-edit').dispatch('click');
  doc.getElementById('nm616-quick-add').dispatch('click');
  assert.equal(app.editCount,1);assert.equal(app.childCount,1);
});
test('image preview zoom is safe and never resizes or changes map images',()=>{
  const {app,state,doc,flush}=harness();
  state.selectedImageId='img';const before=JSON.stringify(state.root),src=state.findImage('img').src;
  doc.getElementById('nm616-image-preview').dispatch('click');flush();
  assert.equal(doc.getElementById('nm616-lightbox').hidden,false);
  assert.equal(doc.getElementById('nm616-image-zoom').src,src);
  assert.equal(doc.getElementById('nm616-image-caption').textContent,'Histology');
  doc.getElementById('nm616-image-close').dispatch('click');flush();
  assert.equal(doc.getElementById('nm616-lightbox').hidden,true);
  assert.equal(JSON.stringify(state.root),before);
  assert.equal(state.findImage('img').src,src);
  assert.equal(state.undoStack.length,0);
});
test('untrusted executable image schemes cannot be previewed',()=>{
  const {context}=harness(),api=context.NeuroMapPresentation;
  assert.equal(api.safeImageSource('javascript:alert(1)'),null);
  assert.equal(api.safeImageSource('data:text/html,<script>'),null);
  assert.equal(api.safeImageSource('https://example.com/pic.png'),'https://example.com/pic.png');
});

test('preview traps Tab and Escape and returns focus to the previous control',()=>{
  const {app,state,doc,events}=harness();
  state.selectedImageId='img';
  const opening=doc.getElementById('nm616-image-preview');opening.focus();
  opening.dispatch('click');
  const close=doc.getElementById('nm616-image-close');
  assert.equal(doc.activeElement,close);
  let prevented=0;
  const key=event=>events.keydown.forEach(fn=>fn({
    key:event.key,shiftKey:event.shiftKey||false,defaultPrevented:false,
    preventDefault(){prevented++},stopPropagation(){},stopImmediatePropagation(){}
  }));
  key({key:'Tab'});
  assert.notEqual(doc.activeElement,close);
  key({key:'Tab',shiftKey:true});
  assert.equal(doc.activeElement,close);
  key({key:'Escape'});
  assert.equal(doc.getElementById('nm616-lightbox').hidden,true);
  assert.equal(doc.activeElement,opening);
  assert.ok(prevented>=3);
});
