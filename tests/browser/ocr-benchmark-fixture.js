// Only self-authored synthetic pages; no real documents or patient data.
const cases=[
 {id:'clean',text:['Anatomia e fisiologia del cuore.','Le valvole regolano il flusso del sangue.','Le arterie portano il sangue ai tessuti.','Il ritorno venoso raggiunge gli atri.']},
 {id:'faint',faint:true,text:['Appunti di istologia e anatomia.','Il tessuto contiene cellule specializzate.','La membrana delimita ogni cellula.','Il nucleo conserva il materiale genetico.']},
 {id:'tilted',angle:2.25,text:['La respirazione permette lo scambio dei gas.','Il diaframma partecipa alla ventilazione.','Il sangue trasporta ossigeno ai tessuti.','Le vie aeree conducono il flusso respiratorio.']},
 {id:'faint-tilted',angle:-2,faint:true,text:['Il rene partecipa alla regolazione dei liquidi.','Il nefrone contiene un glomerulo.','Il tubulo modifica il filtrato iniziale.','Questi appunti sono un esempio sintetico.']},
 {id:'columns',columns:true,text:['Il cuore contiene quattro cavita.','Gli atri ricevono il sangue.','I ventricoli generano pressione.','I polmoni permettono gli scambi.','Gli alveoli hanno pareti sottili.','La ventilazione rinnova i gas.']},
 {id:'table',table:true,text:['Elemento Valore','Sodio 140 mmol/L','Potassio 4,2 mmol/L','Volume 2,5 mL','Massa 500 mg']},
 {id:'faint-units',faint:true,angle:2,text:['ESEMPIO SINTETICO.','Concentrazione 0,5 mg/mL.','Quantita 5 µg, volume 2,5 mL.','Misura 4,2 mmol/L.']},
 {id:'units',text:['ESEMPIO SINTETICO: nessuna indicazione clinica.','Quantita 5 µg e concentrazione 5 µg/mL.','Massa 500 mg, volume 2,5 mL.','Valore 0,9 % e misura 4,2 mmol/L.']}
];
async function corpus(page){
 const images=await page.evaluate(cases=>cases.map(c=>{
  const canvas=document.createElement('canvas');canvas.width=1600;canvas.height=900;const cx=canvas.getContext('2d');cx.fillStyle=c.faint?'#c8c8c8':'#fff';cx.fillRect(0,0,1600,900);cx.save();cx.translate(800,450);cx.rotate((c.angle||0)*Math.PI/180);cx.translate(-800,-450);cx.fillStyle=c.faint?'#a0a0a0':'#111';cx.font='30px sans-serif';
  if(c.columns)c.text.forEach((s,i)=>cx.fillText(s,i<3?65:865,120+(i%3)*100+(i<3?0:40)));
  else if(c.table)c.text.forEach((s,i)=>{const split=s.indexOf(' ');cx.fillText(s.slice(0,split),70,130+i*95);cx.fillText(s.slice(split+1),870,130+i*95)});
  else c.text.forEach((s,i)=>cx.fillText(s,85,160+i*120));
  cx.restore();return canvas.toDataURL('image/jpeg',.96).split(',')[1];
 }),cases);
 return imagePDF(images);
}
function imagePDF(images){
 const objects=[null,'<< /Type /Catalog /Pages 2 0 R >>',''],ids=[];
 images.forEach((base64,i)=>{const page=3+i*3,im=page+1,stream=page+2,bytes=Buffer.from(base64,'base64'),ops='q 640 0 0 360 0 0 cm /Im0 Do Q';ids.push(page);
  objects[page]='<< /Type /Page /Parent 2 0 R /MediaBox [0 0 640 360] /Resources << /XObject << /Im0 '+im+' 0 R >> >> /Contents '+stream+' 0 R >>';
  objects[im]='<< /Type /XObject /Subtype /Image /Width 1600 /Height 900 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length '+bytes.length+' >>\nstream\n'+bytes.toString('latin1')+'\nendstream';objects[stream]='<< /Length '+ops.length+' >>\nstream\n'+ops+'\nendstream';
 });objects[2]='<< /Type /Pages /Kids ['+ids.map(id=>id+' 0 R').join(' ')+'] /Count '+ids.length+' >>';
 let raw='%PDF-1.4\n',offsets=[0];for(let i=1;i<objects.length;i++){offsets[i]=Buffer.byteLength(raw,'latin1');raw+=i+' 0 obj\n'+objects[i]+'\nendobj\n'}const pos=Buffer.byteLength(raw,'latin1');raw+='xref\n0 '+objects.length+'\n0000000000 65535 f \n';for(let i=1;i<objects.length;i++)raw+=String(offsets[i]).padStart(10,'0')+' 00000 n \n';raw+='trailer\n<< /Root 1 0 R /Size '+objects.length+' >>\nstartxref\n'+pos+'\n%%EOF';return Buffer.from(raw,'latin1');
}
module.exports={cases,corpus,imagePDF};
