'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('path');

test('the cloud panel names the five visible states',()=>{
  const source=fs.readFileSync(path.join(__dirname,'../../../apps/desktop-shared/src/cloud_panel.js'),'utf8');
  const start=source.indexOf('function syncStateLabel');
  const end=source.indexOf('function mount', start);
  const label=new Function('t', source.slice(start, end)+'\nreturn syncStateLabel;')(it=>it);
  assert.equal(label(null), 'Salvato in locale');
  assert.equal(label({status:'synced', dirty:false}), 'Sincronizzato');
  assert.equal(label({status:'offline', dirty:true}), 'Da sincronizzare');
  assert.equal(label({status:'incoming'}), 'Da sincronizzare');
  assert.equal(label({status:'error'}), 'Errore');
  assert.equal(label({status:'conflict'}), 'Conflitto');
  assert.equal(label({status:'review'}), 'Conflitto');
  assert.match(source, /gl-cloud-state/);
});
