#!/usr/bin/env node
// Rebuild every native icon from the *same* outlined, three-square site SVG.
// Requires local Playwright Chromium; never uses network services or CI.
'use strict';
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require('@playwright/test');
(async()=>{
 const root=path.resolve(__dirname,'../..');
 const mark=fs.readFileSync(path.join(root,'packages/brand/glauka-mark.svg'),'utf8');
 const website=fs.readFileSync(path.join(root,'apps/website/assets/glauka-mark.svg'),'utf8');
 if(mark.trim()!==website.trim())throw Error('Website and native master logos differ');
 const tile='<rect x="2.93" y="2.93" width="24.14" height="24.14" rx="5.4" fill="#ffffff" stroke="rgba(20,24,42,0.08)" stroke-width="0.22"/>';
 const native=mark
  .replace(/(<svg[^>]*>)/,'$1'+tile+'<g transform="translate(15,15) scale(0.72) translate(-15,-14.58)">')
  .replace(/<\/svg>/,'</g></svg>');
 const chromePath=process.env.CHROMIUM_EXECUTABLE_PATH||(process.platform==='linux'&&fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined);
 const browser=await chromium.launch({executablePath:chromePath,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({deviceScaleFactor:1});
  const capture=async size=>{
   await page.setViewportSize({width:size,height:size});
   await page.setContent('<style>html,body{margin:0;background:transparent}svg{display:block;width:100vw;height:100vh}</style>'+native);
   return page.screenshot({omitBackground:true});
  };
  const iconPng=await capture(256);
  for(const name of ['apps/desktop-shared/src/resources/icon.png','apps/windows/installer/binaries/icon.png','apps/windows/installer/binaries/brand.png','apps/android/native/app/src/main/res/drawable/app_icon.png'])
   fs.writeFileSync(path.join(root,name),iconPng);
  const sizes=[16,24,32,48,64,128,256],images=[];
  for(const size of sizes)images.push(await capture(size));
  const ico=Buffer.alloc(6+sizes.length*16+images.reduce((a,b)=>a+b.length,0));
  ico.writeUInt16LE(1,2);ico.writeUInt16LE(sizes.length,4);
  let offset=6+sizes.length*16;
  images.forEach((png,i)=>{
   const entry=6+i*16,size=sizes[i];
   ico[entry]=size===256?0:size;ico[entry+1]=ico[entry];
   ico.writeUInt16LE(1,entry+4);ico.writeUInt16LE(32,entry+6);
   ico.writeUInt32LE(png.length,entry+8);ico.writeUInt32LE(offset,entry+12);
   png.copy(ico,offset);offset+=png.length;
  });
  for(const name of ['apps/desktop-shared/src/resources/icon.ico','apps/windows/installer/binaries/icon.ico'])
   fs.writeFileSync(path.join(root,name),ico);
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
