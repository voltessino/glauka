'use strict';
// Source contracts: exclusive Android linked views never sit under sheets.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const shell=fs.readFileSync(
  path.join(__dirname,'../native/app/src/main/assets/assets/mobile-app.js'),
  'utf8');

test('GlaukaMobileShell dismisses chrome for exclusive linked views',()=>{
  assert.match(shell,/function dismissChrome\s*\(/);
  assert.match(shell,/dismissChrome,/);
  assert.match(shell,/nm74-overlay/);
  assert.match(shell,/NeuroMapLinkedViews\?\.refresh/);
});

test('Options sheet lists linked views and Android back leaves a view',()=>{
  assert.match(shell,/sectionLabel\("Viste",\s*"Views"\)/);
  assert.match(shell,/NeuroMapLinkedViews\.setMode\(current,\s*id\)/);
  assert.match(shell,/Bacheca Kanban/);
  assert.match(shell,/nm-view-overlay/);
  assert.match(shell,/setMode\(app\(\),\s*"mindmap"\)/);
});

test('Views use distinct icons and a bottom chip instead of the header picker',()=>{
  assert.match(shell,/glauka-views-open/);
  assert.match(shell,/glauka-views-chip/);
  assert.match(shell,/openLinkedViews/);
  assert.match(shell,/const LINKED_VIEWS\s*=/);
  // Options must not reuse the focus/zoom glyph for every linked view.
  const viewsBlock=shell.slice(shell.indexOf('sectionLabel("Viste"'),shell.indexOf('sectionLabel("Progetto"'));
  assert.ok(viewsBlock.length>40);
  assert.doesNotMatch(viewsBlock,/row\("focus"/);
  assert.match(viewsBlock,/for \(const \[id, it, en\] of LINKED_VIEWS\)/);
  assert.match(viewsBlock,/row\(id, it, en/);
  for(const id of ['mindmap','orgchart','concept-tree','concept-network','flowchart','kanban','timeline']){
    assert.match(shell,new RegExp('(?:^|\\n)\\s*"?'+id+'"?:\\s*"'));
    assert.match(shell,new RegExp('\\["'+id+'"'));
  }
});

test('Seven diagram glyphs are unique, legible and limited to view rows',()=>{
  const ids=['mindmap','orgchart','concept-tree','concept-network','flowchart','kanban','timeline'];
  const drawings=ids.map(id=>{
    const match=shell.match(new RegExp('^\\s*(?:"?'+id+'"?):\\s*"(M[^"]+)"','m'));
    assert.ok(match,'missing '+id+' path');
    assert.ok(match[1].length>40,'too sparse '+id+' glyph');
    return match[1];
  });
  assert.equal(new Set(drawings).size,ids.length,'linked-view silhouettes must differ');
  assert.ok(shell.includes('choice.classList.add("glauka-linked-view-action")'));
  assert.ok(shell.includes('choice.setAttribute("aria-current", "true")'));
  const css=fs.readFileSync(
    path.join(__dirname,'../native/app/src/main/assets/assets/mobile-app.css'),'utf8');
  assert.ok(css.includes('.glauka-app-action.glauka-linked-view-action > svg'));
  assert.ok(css.includes('.glauka-app-action.glauka-linked-view-action:focus-visible'));
});

test('View icons stay large and unframed in both bottom sheet and Options',()=>{
  const css=fs.readFileSync(
    path.join(__dirname,'../native/app/src/main/assets/assets/mobile-app.css'),'utf8');
  const selector='.glauka-app-action.glauka-linked-view-action > svg {';
  assert.ok(css.includes(selector));
  const rule=css.split(selector)[1].split('}')[0];
  for(const expected of [
    'width: 28px','height: 28px','padding: 0','border: 0',
    'background: transparent','stroke-width: 2.2'
  ])assert.ok(rule.includes(expected),'missing standalone SVG rule: '+expected);
  assert.ok(css.includes(
    '.glauka-options-menu .glauka-app-action:not(.glauka-linked-view-action) svg'));
  const chip=css.split('#glauka-views-open.glauka-views-chip svg {')[1].split('}')[0];
  assert.ok(chip.includes('width: 24px'));
  assert.ok(shell.includes('chip.insertAdjacentHTML("afterbegin", icon(symbol))'));
  assert.equal(shell.split('root.NeuroMapLinkedViews.setMode(current, id);\n        refresh();').length-1,2);
});

test('Android AI settings keep setup controls but not Expand or Explain actions',()=>{
  const html=fs.readFileSync(
    path.join(__dirname,'../native/app/src/main/assets/app/index.html'),'utf8');
  const study=fs.readFileSync(
    path.join(__dirname,'../editor/navigation-study.js'),'utf8');
  for(const id of ['ai-expand-from-settings','ai-explain-from-settings']){
    assert.ok(!html.includes('id="'+id+'"'),'obsolete UI: '+id);
    assert.ok(!study.includes("on('"+id+"'"),'obsolete listener: '+id);
  }
  for(const id of ['ai-model-detect','ai-connection-test','ai-settings-save'])
    assert.ok(html.includes('id="'+id+'"'),'required AI control missing: '+id);
  assert.ok(study.includes("on('btn-ai-expand'"),'contextual expand must remain');
  assert.ok(study.includes("on('btn-ai-explain'"),'contextual explain must remain');
});
