const {test}=require('node:test');
const assert=require('node:assert/strict');
const {translate,messages,rangeLabels}=require('./helpers/compose-localization.cjs')();
test('shared UI catalog supports Italian/English round trips with icons and whitespace',()=>{
  for(const [it,en] of Object.entries(messages)){
    assert.equal(translate(it,'en'),en);
    // Multiple Italian phrases may share one English translation. The reverse
    // must still produce a valid source phrase with the same English meaning.
    assert.equal(translate(translate(en,'it'),'en'),en);
  }
  assert.equal(translate('  ✨ Revisione AI della mappa  ','en'),'  ✨ AI map review  ');
  assert.equal(translate('  ✨ AI map review  ','it'),'  ✨ Revisione AI della mappa  ');
});
test('every slider has both Italian and English accessible labels',()=>{
  assert.equal(Object.keys(rangeLabels).length,11);
  for(const label of Object.values(rangeLabels)){
    assert.ok(Object.hasOwn(messages,label),label);
    assert.notEqual(translate(label,'en'),label);
  }
});
test('dynamic UI labels retain numeric values and user-supplied preview titles',()=>{
  for(const [it,en] of [['80 nodi','80 nodes'],['1 nodo','1 node'],['125 nodi/mappa','125 nodes/map'],['48 caratteri','48 characters'],['Predefinito: 48','Default: 48'],['Predefinito: Uniforme','Default: Uniform'],['Predefinito: My custom preset','Default: My custom preset'],['Anteprima importazione · Salva my title','Import preview · Salva my title'],['5 nodi → 1 mappa','5 nodes → 1 map']]){
    assert.equal(translate(it,'en'),en);assert.equal(translate(en,'it'),it);
  }
  assert.equal(translate('My unrecognized note','en'),'My unrecognized note');
});
test('Mac Command tooltips translate without turning the shortcut back into Ctrl',()=>{
  assert.equal(translate('Incolla (⌘+V)','en'),'Paste (⌘+V)');
  assert.equal(translate('Paste (⌘+V)','it'),'Incolla (⌘+V)');
  assert.equal(translate('📋 Incolla (⌘+V)','en'),'📋 Paste (⌘+V)');
  assert.equal(translate('Duplica rami selezionati (⌘+Shift+D)','en'),'Duplicate selected branches (⌘+Shift+D)');
});

test('failure prefixes preserve filenames and provider error details',()=>{
  for(const [it,en] of [
    ['Salvato su disco: Salva.neuromap','Saved to disk: Salva.neuromap'],
    ['Salvato su disco: My $& report.neuromap','Saved to disk: My $& report.neuromap'],
    ['Salvataggio fallito: /tmp/Annulla.neuromap (EACCES)','Save failed: /tmp/Annulla.neuromap (EACCES)'],
    ['Apertura fallita: external provider message','Opening failed: external provider message'],
    ['1 risultati · 2 schede','1 results · 2 maps'],
    ['93 (primi 75) risultati · 4 schede','93 (first 75) results · 4 maps'],
    ['Modifica Mod+S','Edit Mod+S'],['Rimuovi Alt+ArrowDown','Remove Alt+ArrowDown'],
    ['DES 12 / SIN 34','R 12 / L 34'],['Shift+Invio','Shift+Enter'],['Ctrl+Clic','Ctrl+Click']
  ]){assert.equal(translate(it,'en'),en);assert.equal(translate(en,'it'),it);}
  assert.equal(translate('Salva.neuromap','en'),'Salva.neuromap');
});

test('Mac multi-shortcut descriptions translate Enter without changing Command',()=>{
  assert.equal(translate('⌘+F / ⌘+K · ↑↓ · Invio · Esc','en'),'⌘+F / ⌘+K · ↑↓ · Enter · Esc');
  assert.equal(translate('⌘+F / ⌘+K · ↑↓ · Enter · Esc','it'),'⌘+F / ⌘+K · ↑↓ · Invio · Esc');
});
