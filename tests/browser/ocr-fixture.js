// Self-authored scanned page, embedded as a JPEG XObject with no PDF text layer.
async function scannedPDF(page){
 const base64=await page.evaluate(()=>{
  const c=document.createElement('canvas');c.width=1400;c.height=700;
  const ctx=c.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle='black';ctx.font='32px sans-serif';
  ['Anatomia e fisiologia','Il cuore ha quattro cavita.','Le valvole regolano il flusso del sangue.','Concentrazione: 5 µg/mL.','Controllare sempre il testo originale.'].forEach((s,i)=>ctx.fillText(s,55,80+i*95));
  return c.toDataURL('image/jpeg',.96).split(',')[1];
 });
 const jpeg=Buffer.from(base64,'base64'),content='q 600 0 0 300 0 0 cm /Im0 Do Q';
 const objects=[null,'<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
 '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 300] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>',
 '<< /Type /XObject /Subtype /Image /Width 1400 /Height 700 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length '+jpeg.length+' >>\nstream\n'+jpeg.toString('latin1')+'\nendstream',
 '<< /Length '+content.length+' >>\nstream\n'+content+'\nendstream'];
 let raw='%PDF-1.4\n',offsets=[0];for(let i=1;i<objects.length;i++){offsets[i]=Buffer.byteLength(raw,'latin1');raw+=i+' 0 obj\n'+objects[i]+'\nendobj\n'}
 const xref=Buffer.byteLength(raw,'latin1');raw+='xref\n0 6\n0000000000 65535 f \n';for(let i=1;i<6;i++)raw+=String(offsets[i]).padStart(10,'0')+' 00000 n \n';
 raw+='trailer\n<< /Root 1 0 R /Size 6 >>\nstartxref\n'+xref+'\n%%EOF';return Buffer.from(raw,'latin1');
}
module.exports={scannedPDF};
