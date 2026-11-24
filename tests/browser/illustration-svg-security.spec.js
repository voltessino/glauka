'use strict';
const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const sharedSource=fs.readFileSync(path.join(root,'packages/editor-ui/editor-shared/media-icon-core.js'),'utf8');

// Exercise the real shared editor function, not a copy of the sanitizer.
// The source runs as a classic script with the browser's DOMParser/XMLSerializer.
test('imported SVG illustrations are filtered before WebView/desktop image URLs',async({page})=>{
  await page.setContent('<!doctype html><html><body></body></html>');
  await page.addScriptTag({content:sharedSource});
  const result=await page.evaluate(()=>{
    const valid={svg:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><path fill="#123456" d="M1 1L31 31"/></svg>'};
    const malicious={svg:'<svg xmlns="http://www.w3.org/2000/svg"><script>window.SVG_EXECUTED=true</script><rect width="20" height="20" onload="alert(1)" fill="#f00"/><foreignObject><iframe src="https://evil.invalid"></iframe></foreignObject><use href="javascript:alert(1)"/></svg>'};
    const decode=object=>{
      const url=nm54IconUri(object);
      return url?decodeURIComponent(url.slice(url.indexOf(',')+1)):'';
    };
    const safeValid=decode(valid);
    const safeMalicious=decode(malicious);
    const unchangedOriginal=malicious.svg.includes('<script>');
    const initial=nm54IconUri(malicious);
    malicious.svg='<svg xmlns="http://www.w3.org/2000/svg"><circle cx="5" cy="5" r="4"/></svg>';
    const updated=nm54IconUri(malicious);
    const malformed=nm54IconUri({svg:'<svg><path></svg>'});
    const dtd=nm54IconUri({svg:'<!DOCTYPE svg [<!ENTITY x "boom">]><svg xmlns="http://www.w3.org/2000/svg"><text>&x;</text></svg>'});
    const tooManyElements=nm54IconUri({svg:'<svg xmlns="http://www.w3.org/2000/svg">'+ '<g/>'.repeat(3100) +'</svg>'});
    return {safeValid,safeMalicious,unchangedOriginal,cacheInvalidated:initial!==updated,malformed,dtd,tooManyElements,scriptRan:window.SVG_EXECUTED===true};
  });
  expect(result.safeValid).toContain('<path');
  expect(result.safeValid).toContain('#123456');
  expect(result.safeMalicious).toContain('<rect');
  for(const forbidden of ['<script','onload=','foreignObject','<iframe','javascript:']){
    expect(result.safeMalicious).not.toContain(forbidden);
  }
  expect(result.unchangedOriginal).toBe(true);
  expect(result.cacheInvalidated).toBe(true);
  expect(result.malformed).toBe('');
  expect(result.dtd).toBe('');
  expect(result.tooManyElements).toBe('');
  expect(result.scriptRan).toBe(false);
});
