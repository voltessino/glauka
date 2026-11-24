// Self-authored university-style pages, not real lecture notes or clinical guidance.
const {imagePDF}=require('./ocr-benchmark-fixture');
const definitions=[
 {id:'university',lines:[
  ['ANATOMIA DEL CUORE','heading',64,90],['1.1 Camere cardiache','heading',38,170],['Il cuore comprende quattro camere.','paragraph',28,230],['Gli atri ricevono il sangue venoso.','paragraph',28,275],['• Atrio destro','list',28,340],['• Ventricolo destro','list',28,390],['1.2 Circolazione','heading',38,485],['Il sangue raggiunge i polmoni.','paragraph',28,545],['Il flusso attraversa le valvole.','paragraph',28,590],['ESEMPIO SINTETICO, NON CLINICO.','paragraph',28,700]]},
 {id:'aligned-prose',columns:true,lines:[
  ['Il cuore riceve sangue dagli atri.','paragraph',28,150,65],['Il polmone permette lo scambio dei gas.','paragraph',28,150,865],['Le valvole regolano il flusso sanguigno.','paragraph',28,245,65],['Gli alveoli hanno una parete sottile.','paragraph',28,245,865],['I ventricoli generano la pressione.','paragraph',28,340,65],['La ventilazione rinnova i gas alveolari.','paragraph',28,340,865]]},
 {id:'sideways',rotation:270,lines:[['ISTOLOGIA GENERALE','heading',40,190],['Il tessuto contiene cellule specializzate.','paragraph',28,290],['La membrana delimita ogni cellula.','paragraph',28,380],['Il nucleo conserva materiale genetico.','paragraph',28,470],['ESEMPIO SINTETICO, NON CLINICO.','paragraph',28,560]]},
 {id:'scientific',lines:[['CHIMICA E FISIOLOGIA','heading',56,110],['Concentrazione 5 µg/mL e massa 500 mg.','paragraph',28,220],['Misura 4,2 mmol/L e volume 2,5 mL.','paragraph',28,315],['Espressione: 2 × 10^-3 mol/L.','paragraph',28,410],['Simboli: α, β, Δ, Ca2+ e HCO3-.','paragraph',28,505],['ESEMPIO SINTETICO, NON CLINICO.','paragraph',28,630]]}
];
async function fixture(page){
 const images=await page.evaluate(defs=>defs.map(d=>{const c=document.createElement('canvas');c.width=1600;c.height=900;let canvas=c;if(d.rotation){canvas=document.createElement('canvas');canvas.width=900;canvas.height=1600}const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#111';for(const [text,role,size,y,x=65]of d.lines){ctx.font=(role==='heading'?'bold ':'')+size+'px sans-serif';ctx.fillText(text,x,y)}if(d.rotation){const cx=c.getContext('2d');cx.translate(800,450);cx.rotate(Math.PI/2);cx.drawImage(canvas,-450,-800)}return c.toDataURL('image/jpeg',.96).split(',')[1]}),definitions);
 return imagePDF(images);
}
function nativeFixture(){
 const rows=[['ANATOMIA DEL CUORE',30,740],['1.1 Camere cardiache',18,680],['Il cuore comprende quattro camere.',12,640],['Gli atri ricevono il sangue venoso.',12,620],['- Atrio destro',12,585],['- Ventricolo destro',12,560],['1.2 Circolazione',18,510],['Il sangue raggiunge i polmoni.',12,470],['Dose 5 mg: esempio sintetico non clinico.',12,440]],content=rows.map(([text,size,y])=>'BT /F1 '+size+' Tf 40 '+y+' Td ('+text+') Tj ET').join('\n');
 const objects=[null,'<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 800] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>','<< /Length '+content.length+' >>\nstream\n'+content+'\nendstream'];let raw='%PDF-1.4\n',offsets=[0];for(let i=1;i<objects.length;i++){offsets[i]=Buffer.byteLength(raw,'latin1');raw+=i+' 0 obj\n'+objects[i]+'\nendobj\n'}const pos=Buffer.byteLength(raw,'latin1');raw+='xref\n0 6\n0000000000 65535 f \n';for(let i=1;i<6;i++)raw+=String(offsets[i]).padStart(10,'0')+' 00000 n \n';raw+='trailer\n<< /Root 1 0 R /Size 6 >>\nstartxref\n'+pos+'\n%%EOF';return Buffer.from(raw,'latin1');
}
module.exports={definitions,fixture,nativeFixture};
