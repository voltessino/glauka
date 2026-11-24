const fs=require('fs');const {chromium}=require('@playwright/test');
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox']});const p=await b.newPage();await p.goto('http://127.0.0.1:5174/index.html');await p.waitForFunction(()=>window.NeuroMapCreativeCore);const source=JSON.parse(fs.readFileSync('docs/examples/website/views-it.glauka.json'));const result=await p.evaluate(source=>{
 const core=NeuroMapCreativeCore,root=source.root;
 const available=new Set(core.OBJECTS.map(o=>o.id));
 for(const id of ['gl-leaf-plant','flat-idea','gl-sun-rays','flat-process','flat-home','lc-flower-2','lc-droplets'])if(!available.has(id))throw Error('Missing gallery vector: '+id);
 const it=['Giardino condiviso','Visione','Un angolo verde','Per il quartiere','Progetto','Erbe e fiori','Acqua e luce','Attività','Preparare il terreno','Piantare insieme','Comunità','Laboratorio','Inaugurazione'];
 const en=['Community garden','Vision','A greener corner','For neighbours','Design','Herbs and flowers','Water and light','Tasks','Prepare the soil','Plant together','Community','Workshop','Opening day'];
 const colors=['#7c3aed','#0d9488','#d97706','#db2777'];
 const art=['flat-idea','gl-sun-rays','flat-process','flat-home'];
 let index=0;const labels={};
 function visit(n,depth=0,branch=0){
  const i=index++;n.text=it[i];labels[n.id]=en[i];
  delete n.illustration;delete n.objectArt;
  n.fontSize=depth===0?28:depth===1?22:17;n.fontWeight=depth<2?700:500;
  if(depth===2&&!([8,9,11,12].includes(i))){delete n.taskStatus;delete n.startDate;delete n.dueDate;}
  n.fontFamily='Inter';n.nodeShape=depth===0?'pill':depth===1?'card':'outline';
  n.color=depth===0?'#7c3aed':colors[branch];n.colorIndex=branch;
  if(depth===0)n.objectArt=core.objectArt({id:'gl-leaf-plant',size:140});
  if(depth===1)n.illustration={name:art[branch],svg:core.objectSVG(art[branch])};
  if(depth===2&&i===5)n.illustration={name:'lc-flower-2',svg:core.objectSVG('lc-flower-2')};
  if(depth===2&&i===6)n.illustration={name:'lc-droplets',svg:core.objectSVG('lc-droplets')};
  (n.children||[]).forEach((c,j)=>visit(c,depth+1,depth===0?j:branch));
 }
 visit(root);
 const tasks=[root.children[2].children[0],root.children[2].children[1],...root.children[3].children];
 tasks.forEach((n,i)=>Object.assign(n,{taskStatus:['done','doing','todo','todo'][i],startDate:['2026-10-30','2026-11-07','2026-11-16','2026-11-21'][i],dueDate:['2026-11-02','2026-11-11','2026-11-17','2026-11-22'][i]}));
 source.typographyPreset='uniform';source.typographyScale=1;source.branchStyle='neon';source.strokeScale=1.15;source.compactness=125;
 // Two real tasks, one essential transition. No inferred/fabricated workflow.
 source.relationships=[{id:'website-planting-step',fromId:root.children[2].children[0].id,toId:root.children[2].children[1].id,kind:'sequence',label:'poi',color:'#0d9488'}];
 const translated=JSON.parse(JSON.stringify(source));
 function translate(n){n.text=labels[n.id];(n.children||[]).forEach(translate)}translate(translated.root);translated.relationships[0].label='then';
 return {it:source,en:translated};
},source);for(const lang of ['it','en'])fs.writeFileSync(`docs/examples/website/views-${lang}.glauka.json`,JSON.stringify(result[lang],null,2)+'\n');await b.close()})()
