'use strict';
// Tiny fully local PDF fixture generator. No pdfkit, API or external PDF files.
function pdfFixture(pages=200,{bookmarks=true,texts=[]}={}){
 if(!Number.isInteger(pages)||pages<1||pages>10000)throw Error('Bad PDF test page count');
 const objects=[null],pageIds=[],outlineRoot=4+2*pages,chapter1=outlineRoot+1,chapter2=outlineRoot+2;
 objects[1]='<< /Type /Catalog /Pages 2 0 R'+(bookmarks?' /Outlines '+outlineRoot+' 0 R /PageMode /UseOutlines':'')+' >>';
 objects[3]='<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
 for(let i=0;i<pages;i++){
  const pageId=4+2*i,streamId=5+2*i;
  pageIds.push(pageId);
  const label=String(texts[i]??('Page '+(i+1)+' Cardiovascular anatomy and physiology')).replace(/[\\()]/g,'\\$&').replace(/[\r\n]/g,' ');
  const text='BT /F1 13 Tf 72 720 Td ('+label+') Tj ET\n';
  objects[pageId]='<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents '+streamId+' 0 R >>';
  objects[streamId]='<< /Length '+Buffer.byteLength(text,'latin1')+' >>\nstream\n'+text+'endstream';
 }
 objects[2]='<< /Type /Pages /Kids ['+pageIds.map(id=>id+' 0 R').join(' ')+'] /Count '+pages+' >>';
 if(bookmarks){
  objects[outlineRoot]='<< /Type /Outlines /First '+chapter1+' 0 R /Last '+chapter2+' 0 R /Count 2 >>';
  objects[chapter1]='<< /Title (Part I - Anatomy) /Parent '+outlineRoot+' 0 R /Dest ['+pageIds[0]+' 0 R /Fit] /Next '+chapter2+' 0 R >>';
  objects[chapter2]='<< /Title (Part II - Physiology) /Parent '+outlineRoot+' 0 R /Dest ['+pageIds[Math.floor(pages/2)]+' 0 R /Fit] /Prev '+chapter1+' 0 R >>';
 }
 let str='%PDF-1.4\n%\xE2\xE3\xCF\xD3\n',offsets=[0];
 for(let i=1;i<objects.length;i++){
  if(!objects[i])throw Error('Missing generated PDF object '+i);
  offsets[i]=Buffer.byteLength(str,'latin1');
  str+=i+' 0 obj\n'+objects[i]+'\nendobj\n';
 }
 const pos=Buffer.byteLength(str,'latin1');
 str+='xref\n0 '+objects.length+'\n0000000000 65535 f \n';
 for(let i=1;i<objects.length;i++)
  str+=String(offsets[i]).padStart(10,'0')+' 00000 n \n';
 str+='trailer\n<< /Root 1 0 R /Size '+objects.length+' >>\nstartxref\n'+pos+'\n%%EOF\n';
 return Buffer.from(str,'latin1');
}
module.exports={pdfFixture};
