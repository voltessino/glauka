'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../../..');
const media=fs.readFileSync(path.join(root,'packages/editor-ui/editor-shared/media-icon-core.js'),'utf8');

test('Imported illustrations are sanitized at the shared rendering boundary',()=>{
  assert.match(media,/function nm54IconUri\(illustration\)/);
  const body=media.slice(media.indexOf('function nm54IconUri('),media.indexOf('const nm54Dictionary='));
  assert.match(body,/nm54SanitizeSvg\(illustration\.svg\)/);
  assert.match(body,/cached\?\.source===illustration\.svg/);
  assert.doesNotMatch(body,/encodeURIComponent\(illustration\.svg\)/);
  assert.match(body,/catch\(_\)/);
});

test('Android and desktop export reuse sanitized illustration URLs',()=>{
  for(const platform of ['apps/android','apps/desktop-shared']){
    const file=fs.readFileSync(path.join(root,platform,'editor/io.js'),'utf8');
    assert.match(file,/const src=nm54IconUri\(node\.illustration\)/);
    assert.match(file,/if\(src\)nodeElements\.push/);
    assert.doesNotMatch(file,/encodeURIComponent\(node\.illustration\.svg\)/);
  }
});

test('Shared SVG sanitizer retains strict tag and attribute allowlists',()=>{
  assert.match(media,/function nm54SanitizeSvg\(raw\)/);
  assert.match(media,/const allowedTags=new Set/);
  assert.match(media,/const allowedAttributes=new Set/);
  assert.match(media,/javascript:\|data:\|https\?:/);
  assert.match(media,/child\.remove\(\)/);
  assert.match(media,/el\.removeAttributeNode\(attr\)/);
});
