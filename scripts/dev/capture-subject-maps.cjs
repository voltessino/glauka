/* Reproducible, unretouched captures from Glauka's actual editor.
 * Start scripts/dev/serve.py macos --port 5174 first. No custom map renderer.
 */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {chromium}=require('@playwright/test');
const subjects={
 anatomia:{text:'Anatomia del cuore',art:'heart',groups:[
  ['Camere cardiache','heart',['Atrio destro','Riceve dalle vene cave'],['Ventricolo destro','Invia sangue ai polmoni'],['Atrio sinistro','Riceve dalle vene polmonari'],['Ventricolo sinistro','Spinge il sangue nell’aorta']],
  ['Valvole','heart',['Tricuspide','Tra atrio e ventricolo destri'],['Polmonare','Verso il tronco polmonare'],['Mitrale','Tra atrio e ventricolo sinistri'],['Aortica','Tra ventricolo sinistro e aorta']],
  ['Grandi vasi','heart',['Aorta','Distribuzione sistemica'],['Vene cave','Ritorno venoso al cuore'],['Tronco polmonare','Dal cuore ai polmoni'],['Vene polmonari','Dai polmoni al cuore']],
  ['Circolazione','flat-process',['Piccolo circolo','Cuore → polmoni → cuore'],['Grande circolo','Cuore → tessuti → cuore'],['Arterie coronarie','Irrorano il miocardio'],['Seno coronario','Drena nell’atrio destro']],
  ['Parete e rivestimenti','flat-document',['Endocardio','Rivestimento interno'],['Miocardio','Muscolo cardiaco'],['Epicardio','Foglio viscerale sieroso'],['Pericardio','Sacco che avvolge il cuore']],
  ['Conduzione e ciclo','flat-clock',['Nodo senoatriale','Avvia il ritmo cardiaco'],['Nodo atrioventricolare','Rallenta la conduzione'],['His e fibre di Purkinje','Attivano i ventricoli'],['Sistole e diastole','Eiezione e riempimento']]
 ]},
 matematica:{text:'Derivate: capire e applicare',art:'flat-calculator',groups:[
  ['Definizione','flat-idea',['Rapporto incrementale','Variazione media di f'],['Passaggio al limite','Incremento h → 0'],['Derivabilità','Esistenza del limite finito'],['Continuità','Necessaria, non sufficiente']],
  ['Regole di calcolo','flat-calculator',['Somma','Deriva ogni termine'],['Prodotto','u′v + uv′'],['Quoziente','(u′v − uv′) / v²'],['Funzione composta','Regola della catena']],
  ['Derivate fondamentali','flat-rules',['Costante','f(x) = c → f′(x) = 0'],['Potenze','xⁿ → nxⁿ⁻¹'],['Esponenziale e logaritmo','eˣ → eˣ; ln x → 1/x'],['Seno e coseno','sin x → cos x; cos x → −sin x']],
  ['Esempi svolti','flat-document',['Polinomio','3x² + 2x → 6x + 2'],['Prodotto','x·eˣ → eˣ(1 + x)'],['Composta','sin(x²) → 2x·cos(x²)'],['Quoziente','1/x → −1/x², x ≠ 0']],
  ['Interpretazione grafica','flat-line-chart',['Retta tangente','Pendenza nel punto'],['Crescenza','f′ > 0 su un intervallo'],['Decrescenza','f′ < 0 su un intervallo'],['Punti stazionari','f′ = 0: verificare il segno']],
  ['Applicazioni','flat-graduation-cap',['Moto','Velocità: v(t) = s′(t)'],['Accelerazione','a(t) = v′(t)'],['Ottimizzazione','Massimi e minimi vincolati al dominio'],['Studio di funzione','Dominio, segni e limiti']]
 ]}
};
(async()=>{
 const dest=path.resolve(__dirname,'../../apps/website/home-review/assets/examples');
 const projects=path.resolve(__dirname,'../../docs/examples/website');fs.mkdirSync(projects,{recursive:true});
 const b=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox']});const proof={source:'Unretouched screenshots of the actual Glauka desktop editor; all illustrations and formulas are saved document content.',editorSourceRevision:require('node:child_process').execFileSync('git',['rev-parse','HEAD'],{cwd:path.resolve(__dirname,'../..'),encoding:'utf8'}).trim(),subjects:{}};
 try{for(const [key,s]of Object.entries(subjects)){
 const page=await b.newPage({viewport:{width:2000,height:1250},deviceScaleFactor:2});await page.addInitScript(()=>localStorage.setItem('nm6_welcome_seen','1'));
 await page.goto('http://127.0.0.1:5174/index.html');await page.waitForFunction(()=>window.neuroMapApp?.renderer&&window.NeuroMapCreativeCore&&window.NM615);
 const result=await page.evaluate(async data=>{
 const app=neuroMapApp,core=NeuroMapCreativeCore;
 app.importHierarchy({text:data.text,children:data.groups.map(([text,art,...items])=>({text,children:items.map(([text,note])=>({text,children:[{text:note,children:[]}]}))}))},{newTab:true});
 NM615.setTheme('white');NeuroMapUISkin.set({theme:'minimal'});
 app.state.root.objectArt=core.objectArt({id:data.art,size:110});
 const available=new Set(core.OBJECTS.map(o=>o.id));
 data.groups.forEach(([text,art],i)=>{if(!available.has(art))throw Error('Unknown gallery illustration '+art);app.state.root.children[i].illustration={name:art,svg:core.objectSVG(art)};});
 if(data.art==='flat-calculator'){
 const formulas=[['f\u0027(x)=\\lim_{h\\to0}\\frac{f(x+h)-f(x)}{h}',0,0],['(u\\circ v)\u0027=(u\u0027\\circ v)\\,v\u0027',1,3],['y=f(a)+f\u0027(a)(x-a)',4,0]];
 for(const [tex,i,j]of formulas){const f=await NeuroMapCreativeModules.formulas.formulaSVG(tex,'#6542b7');app.state.addImageItem({src:NeuroMapCreativeModules.ui.data(f.svg),width:Math.min(230,f.w),height:Math.min(230,f.w)*f.h/f.w,naturalWidth:f.w,naturalHeight:f.h,mode:'attached',attachedNodeId:app.state.root.children[i].children[j].children[0].id,graphic:{kind:'formula',tex,color:'#6542b7'},frame:'none',borderRadius:0});}
 }
 document.querySelectorAll('.nm6-shade').forEach(e=>e.classList.add('hidden'));document.getElementById('nm-mode-balanced').click();
 app.state.selectedImageId=null;app.recalculateAndRender();app.fitToScreen();app.requestRender();
 return {nodes:app.state.getAllNodesIncludingCollapsed().length,illustrations:7,formulas:app.state.images.length,project:app.io.buildSerializedProjectPayload()};
 },s);
 const close=page.locator('#nm616-map-close');if(await close.isVisible())await close.click();await page.waitForTimeout(2200);await page.evaluate(()=>document.fonts.ready);
 const file=path.join(dest,key+'-mappa.png');await page.screenshot({path:file});fs.writeFileSync(path.join(projects,key+'.glauka.json'),JSON.stringify(result.project,null,2)+'\n');delete result.project;
 proof.subjects[key]={...result,width:4000,height:2500,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')};await page.close();
 }fs.writeFileSync(path.join(dest,'capture-provenance.json'),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof,null,2));}finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
