 const HOME_VIEWS=[
  ['mindmap','Mappa mentale','Mind map','Idee intorno a un centro','Ideas around a center'],
  ['orgchart','Organigramma','Organization chart','Ruoli e strutture','Roles and structures'],
  ['concept-tree','Albero concettuale','Concept tree','Dal generale al dettaglio','From overview to detail'],
  ['concept-network','Rete concettuale','Concept network','Concetti e relazioni','Concepts and relations'],
  ['flowchart','Flusso di lavoro','Workflow','Passaggi e decisioni','Steps and decisions'],
  ['kanban','Bacheca Kanban','Kanban board','Attività per stato','Tasks by status'],
  ['timeline','Linea del tempo','Timeline','Eventi e pianificazioni','Events and schedules']
 ];
 const HOME_EXAMPLES={
  mindmap:[['Obiettivo',['Che cosa voglio ottenere?','Per chi?']],['Idee',['Prima idea','Seconda idea']],['Azioni',['Primo passo','Materiali']],['Verifiche',['Come misuro il risultato?']]],
  orgchart:[['Direzione',['Responsabile']],['Prodotto',['Progettazione','Qualità']],['Comunicazione',['Contenuti']],['Operazioni',['Coordinamento']]],
  'concept-tree':[['Definizione',['Caratteristiche chiave']],['Classificazione',['Tipo A','Tipo B']],['Esempi',['Caso pratico']],['Fonti',['Riferimento da aggiungere']]],
  'concept-network':[['Concetto A',['Osservazione']],['Concetto B',['Evidenza']],['Concetto C',[]],['Collegamenti da verificare',[]]],
  flowchart:[['Avvio',[]],['Verifica',[]],['Percorso sì',[]],['Percorso no',[]],['Fine',[]]],
  kanban:[['Definire attività',[],{taskStatus:'todo'}],['Raccogliere materiali',[],{taskStatus:'todo'}],['Attività in corso',[],{taskStatus:'doing'}],['Controllo finale',[],{taskStatus:'done'}]],
  timeline:[['Preparazione',[],{startOffset:0,dueOffset:2}],['Prima tappa',[],{startOffset:3,dueOffset:7}],['Consegna di esempio',[],{startOffset:8,dueOffset:14}]]
 };
 const HOME_EXAMPLES_EN={
  mindmap:[['Goal',['What do I want to achieve?','For whom?']],['Ideas',['First idea','Second idea']],['Actions',['First step','Resources']],['Review',['How will I measure results?']]],
  orgchart:[['Leadership',['Team lead']],['Product',['Design','Quality']],['Communications',['Content']],['Operations',['Coordination']]],
  'concept-tree':[['Definition',['Key features']],['Classification',['Type A','Type B']],['Examples',['Practical example']],['Sources',['Add a reference']]],
  'concept-network':[['Concept A',['Observation']],['Concept B',['Evidence']],['Concept C',[]],['Connections to verify',[]]],
  flowchart:[['Start',[]],['Decision',[]],['Yes path',[]],['No path',[]],['Finish',[]]],
  kanban:[['Define tasks',[],{taskStatus:'todo'}],['Gather materials',[],{taskStatus:'todo'}],['Work in progress',[],{taskStatus:'doing'}],['Final review',[],{taskStatus:'done'}]],
  timeline:[['Preparation',[],{startOffset:0,dueOffset:2}],['First milestone',[],{startOffset:3,dueOffset:7}],['Sample delivery',[],{startOffset:8,dueOffset:14}]]
 };
 function populateHomeExample(state,mode){
   const english=nmLocale()==='en',example=(english?HOME_EXAMPLES_EN:HOME_EXAMPLES)[mode];
   if(!example)return;
   const index=new Map();
   const dateInDays=offset=>{
     const now=new Date(),at=new Date(now.getFullYear(),now.getMonth(),now.getDate()+offset);
     return at.getFullYear()+'-'+String(at.getMonth()+1).padStart(2,'0')+'-'+String(at.getDate()).padStart(2,'0');
   };
   const visit=(parent,spec,number)=>{
     const [title,children=[],meta={}]=Array.isArray(spec)?spec:[String(spec),[]];
     const palette=parent===state.root?state.nextPaletteEntry():{color:parent.color,colorIndex:parent.colorIndex};
     const node={id:state.generateId(),text:window.GlaukaI18n?.translate(title)||title,parentId:parent.id,side:'right',collapsed:false,
       customOrder:number,colorIndex:palette.colorIndex,color:palette.color,children:[]};
     if(['todo','doing','done'].includes(meta.taskStatus))node.taskStatus=meta.taskStatus;
     if(Number.isInteger(meta.startOffset))node.startDate=dateInDays(meta.startOffset);
     if(Number.isInteger(meta.dueOffset))node.dueDate=dateInDays(meta.dueOffset);
     parent.children.push(node);index.set(title,node);
     (children||[]).forEach((child,i)=>visit(node,child,i));
   };
   example.forEach((spec,i)=>visit(state.root,spec,i));
   if(mode==='flowchart'){
     const paths=english?[['Start','Decision','sequence'],['Decision','Yes path','yes'],
       ['Decision','No path','no'],['Yes path','Finish','sequence'],['No path','Finish','sequence']]:
       [['Avvio','Verifica','sequence'],['Verifica','Percorso sì','yes'],
       ['Verifica','Percorso no','no'],['Percorso sì','Fine','sequence'],['Percorso no','Fine','sequence']];
     for(const [from,to,kind] of paths){
       state.relationships.push({id:state.generateId('rel'),fromId:index.get(from).id,toId:index.get(to).id,
         kind,label:kind==='yes'?((globalThis.GlaukaI18n?.pair("Sì","Yes")??(english?'Yes':'Sì'))):kind==='no'?(english?'No':'No'):((globalThis.GlaukaI18n?.pair("Segue","Next")??(english?'Next':'Segue'))),color:'#818cf8'});
     }
   }
   state.selectedNodeId=state.root.id;state.selectedNodeIds=[state.root.id];
   state.undoStack=[];state.redoStack=[];state.isDirty=true;
 }
 // Deterministic, local SVG previews of the same guided examples used when
 // creating a project. Blank projects show unlabeled structural scaffolds.
 const homePreviewScene=(mode,template='blank',english=false)=>{
   const known=Object.prototype.hasOwnProperty.call(HOME_EXAMPLES,mode)?mode:'mindmap';
   const guided=template==='guided';
   const examples=(english?HOME_EXAMPLES_EN:HOME_EXAMPLES)[known]||[];
   const title=i=>guided?(window.GlaukaI18n?.translate(String(examples[i]?.[0]||''))||String(examples[i]?.[0]||'')).slice(0,22):'';
   const line=(x1,y1,x2,y2,color='#8098c6',dash='')=>({x1,y1,x2,y2,color,dash});
   const node=(x,y,w,h,text='',color='#3c4f79',kind='box')=>({x,y,w,h,text,color,kind});
   const nodes=[],lines=[];
   const rootName=guided?((globalThis.GlaukaI18n?.pair("Progetto","Project")??(english?'Project':'Progetto'))):'';
   switch(known){
     case 'mindmap':
       nodes.push(node(142,67,77,38,rootName,'#514699','root'));
       [[236,14],[250,60],[249,111],[12,27]].forEach(([x,y],i)=>{
         const color=['#3b82f6','#10b981','#f59e0b','#ad83ed'][i];
         nodes.push(node(x,y,92,29,title(i),color));
         lines.push(line(i===3?142:219,87,x+(i===3?92:0),y+15,color));
       });break;
     case 'orgchart':
       nodes.push(node(139,10,83,30,rootName,'#514699'));
       examples.slice(0,4).forEach((_,i)=>{
         const x=8+i*89;
         nodes.push(node(x,91,78,33,title(i),['#506fab','#477e87','#9e6b54','#8269a5'][i]));
         lines.push(line(180,40,x+39,91,'#8297b8'));
       });break;
     case 'concept-tree':
       nodes.push(node(8,63,76,39,rootName,'#514699'));
       examples.slice(0,4).forEach((_,i)=>{
         const x=117+i%2*121,y=15+Math.floor(i/2)*92;
         nodes.push(node(x,y,106,33,title(i),'#446c86'));
         lines.push(line(84,81,x,y+16,'#71a7b3'));
       });break;
     case 'concept-network':
       [[21,18],[205,18],[31,114],[209,113]].forEach(([x,y],i)=>
         nodes.push(node(x,y,124,34,title(i),['#4d6ca4','#436e78','#72619e','#476f6a'][i])));
       // Guided network starts without relationships: do not imply links.
       break;
     case 'flowchart':
       nodes.push(node(6,64,70,36,title(0),'#476f8f'));
       nodes.push(node(106,60,71,46,title(1),'#806547','decision'));
       nodes.push(node(217,14,81,30,title(2),'#467c6d'));
       nodes.push(node(217,109,81,30,title(3),'#8d5767'));
       nodes.push(node(304,64,52,36,title(4),'#476f8f'));
       if(guided)lines.push(line(76,82,106,82),line(177,69,217,29,'#54b98c'),
         line(177,92,217,124,'#e68a98'),line(298,29,330,64),line(298,124,330,100));
       break;
     case 'kanban':
       ['#4c6593','#52848c','#ab8552','#7160a1'].forEach((color,i)=>{
         const x=6+i*89;
         nodes.push(node(x,16,81,18,[(globalThis.GlaukaI18n?.pair("Senza stato","Unassigned")??(english?'Unassigned':'Senza stato')),(globalThis.GlaukaI18n?.pair("Da fare","To do")??(english?'To do':'Da fare')),
           (globalThis.GlaukaI18n?.pair("In corso","Doing")??(english?'Doing':'In corso')),(globalThis.GlaukaI18n?.pair("Fatto","Done")??(english?'Done':'Fatto'))][i],color,'column'));
         if(guided&&i<3)nodes.push(node(x+3,51+i%2*43,75,43,title(i),color));
       });
       if(guided)nodes.push(node(274,51,75,43,title(3),'#7160a1'));
       break;
     case 'timeline':
       lines.push(line(18,38,345,38),line(18,90,345,90),line(18,140,345,140));
       for(let i=0;i<3;i++){
         const x=47+i*72,y=21+i*52;
         nodes.push(node(x,y,77+i*7,21,title(i),['#4d7aab','#548978','#9378bd'][i],'bar'));
       }
       break;
   }
   return {mode:known,guided,nodes,lines};
 };
 const homeSvg=(svg,scene)=>{
   if(!svg)return;
   const NS='http://www.w3.org/2000/svg';
   svg.replaceChildren();svg.setAttribute('viewBox','0 0 360 180');
   const add=(tag,attrs,textContent)=>{
     const item=document.createElementNS(NS,tag);
     for(const [key,value] of Object.entries(attrs))item.setAttribute(key,String(value));
     if(textContent!=null)item.textContent=textContent;
     svg.append(item);return item;
   };
   for(const edge of scene.lines){
     add('line',{x1:edge.x1,y1:edge.y1,x2:edge.x2,y2:edge.y2,
       stroke:edge.color,'stroke-width':2,'stroke-linecap':'round',
       ...(edge.dash?{'stroke-dasharray':edge.dash}:{})});
   }
   for(const item of scene.nodes){
     const {x,y,w,h,text,color,kind}=item;
     add('rect',{x,y,width:w,height:h,rx:kind==='bar'?4:kind==='decision'?12:8,
       fill:color,'fill-opacity':scene.guided?'.78':'.32',
       stroke:color,'stroke-opacity':'.95','stroke-width':'1.4',
       ...(!scene.guided?{'stroke-dasharray':'4 3'}:{})});
     if(text)add('text',{x:x+w/2,y:y+h/2+3.7,'text-anchor':'middle',
       'font-family':'system-ui,sans-serif','font-size':9.5,fill:'#f2f6ff',stroke:'none'},text.length>16?text.slice(0,15)+'…':text);
   }
 };
 const HOME_PURPOSE={
   mindmap:['Raccogli idee e argomenti intorno a un centro.','Organize ideas and topics around a center.'],
   orgchart:['Rappresenta ruoli, reparti e gerarchie.','Map roles, departments and reporting lines.'],
   'concept-tree':['Parti da una definizione e approfondisci per livelli.','Start with a concept and expand it into detailed levels.'],
   'concept-network':['Sposta i concetti e collega soltanto le relazioni che decidi.','Arrange concepts and add only the links you choose.'],
   flowchart:['Disegna transizioni esplicite, anche con decisioni Sì/No.','Create explicit transitions, including Yes/No decisions.'],
   kanban:['Organizza le attività in colonne per stato.','Organize tasks into status columns.'],
   timeline:['Visualizza attività con date di inizio e scadenze.','Show activities with start and due dates.']
 };
 const HOME_CATEGORIES=[
   {id:'all',it:'Tutte',en:'All',modes:null},
   {id:'study',it:'Studio e idee',en:'Study & ideas',modes:['mindmap','concept-tree','concept-network']},
   {id:'planning',it:'Attività e scadenze',en:'Tasks & dates',modes:['kanban','timeline','mindmap']},
   {id:'team',it:'Team e ruoli',en:'Teams & roles',modes:['orgchart','kanban']},
   {id:'process',it:'Processi',en:'Processes',modes:['flowchart','concept-network','orgchart']}
 ];
 const HOME_PINS_KEY='nm.home.pinned-files.v1';
 function pinnedFiles(){
   const A=window.NeuroMapAtlasLibrary;
   if(!A?.normalizedPath)return new Set();
   try{
     const stored=JSON.parse(window.localStorage?.getItem(HOME_PINS_KEY)||'[]');
     if(!Array.isArray(stored))return new Set();
     return new Set(stored.slice(0,24).map(path=>A.normalizedPath(path)).filter(Boolean));
   }catch(_){return new Set()}
 }
 function togglePinnedFile(path){
   const A=window.NeuroMapAtlasLibrary,normalized=A?.normalizedPath(path);
   if(!normalized)return false;
   const pinned=pinnedFiles();
   if(pinned.has(normalized))pinned.delete(normalized);
   else {if(pinned.size>=24)return false;pinned.add(normalized)}
   try{window.localStorage?.setItem(HOME_PINS_KEY,JSON.stringify([...pinned]));}
   catch(error){window.neuroMapApp?.showToast?.('Impossibile salvare i preferiti: '+String(error.message||error),'HOME');return false}
   return true;
 }
 const homeMatches=(title,path,query)=>{
   const q=String(query||'').trim().toLocaleLowerCase();
   return !q||(String(title||'')+' '+String(path||'')).toLocaleLowerCase().includes(q);
 };
 const recentClosed=app=>{
   const A=window.NeuroMapAtlasLibrary;
   if(!A?.clean||!window.neuromapDesktop?.openProject||!app||app._desktopRecoveryPending)return [];
   const opened=new Set((app.tabs||[]).map(t=>A.normalizedPath(t.filePath)).filter(Boolean));
   const unique=new Set(),pinned=pinnedFiles();
   const candidates=A.clean(app._nmAtlasArchive||[]).filter(entry=>{
     const path=A.normalizedPath(entry.filePath);
     if(!path||opened.has(path)||unique.has(path))return false;
     unique.add(path);return true;
   });
   candidates.sort((a,b)=>{
     const ap=Number(pinned.has(A.normalizedPath(a.filePath)));
     const bp=Number(pinned.has(A.normalizedPath(b.filePath)));
     return bp-ap||(b.updatedAt||0)-(a.updatedAt||0);
   });
   // Keep the whole bounded Atlas index searchable; only cap the rendered list.
   return candidates;
 };
 let recentOpenPending=false;
 async function reopenHomeRecent(record){
   if(recentOpenPending)return;
   const app=window.neuroMapApp,A=window.NeuroMapAtlasLibrary,native=window.neuromapDesktop;
   if(!app||app._desktopRecoveryPending||!A?.normalizedPath||!native?.openProject||!app.v6ImportNative||!app.nmAsk)return;
   const expected=A.normalizedPath(record.filePath);
   if(!expected)return;
   recentOpenPending=true;
   const english=nmLocale()==='en';
   try{
     const openTab=(app.tabs||[]).find(t=>A.normalizedPath(t.filePath)===expected);
     if(openTab){app.activateTab(openTab.id);finish();return}
     const action=await app.nmAsk({title:(globalThis.GlaukaI18n?.pair("Apri progetto recente","Open recent project")??(english?'Open recent project':'Apri progetto recente')),
       message:(record.title||'Glauka')+'\n'+
         ((globalThis.GlaukaI18n?.pair("Seleziona manualmente il file originale. Il contenuto indicizzato potrebbe essere meno recente.","Select the original file manually. The indexed copy may be out of date.")??(english?'Select the original file manually. The indexed copy may be out of date.':
           'Seleziona manualmente il file originale. Il contenuto indicizzato potrebbe essere meno recente.'))),
       choices:[{value:'cancel',text:(globalThis.GlaukaI18n?.pair("Annulla","Cancel")??(english?'Cancel':'Annulla'))},
         {value:'open',text:(globalThis.GlaukaI18n?.pair("Scegli file…","Choose file…")??(english?'Choose file…':'Scegli file…')),primary:true}]});
     if(action!=='open')return;
     const payload=await native.openProject();
     if(!payload||payload.cancelled)return;
     if(A.normalizedPath(payload.path)!==expected)
       throw Error((globalThis.GlaukaI18n?.pair("Il file scelto non corrisponde al progetto recente.","The selected file does not match this recent project.")??(english?'The selected file does not match this recent project.':'Il file scelto non corrisponde al progetto recente.')));
     if(!payload.bytes)throw Error((globalThis.GlaukaI18n?.pair("Il file selezionato non contiene dati leggibili.","The selected file has no readable data.")??(english?'The selected file has no readable data.':'Il file selezionato non contiene dati leggibili.')));
     const before=new Set((app.tabs||[]).map(tab=>tab.id));
     await app.v6ImportNative(payload,true);
     const loaded=(app.tabs||[]).some(tab=>!before.has(tab.id)&&A.normalizedPath(tab.filePath)===expected);
     if(!loaded)throw Error((globalThis.GlaukaI18n?.pair("Non è stato possibile riaprire il progetto.","The project could not be reopened.")??(english?'The project could not be reopened.':'Non è stato possibile riaprire il progetto.')));
     finish();
   }catch(error){app.showToast?.(String(error?.message||error),'HOME');}
   finally{recentOpenPending=false}
 }
 const finish=()=>{welcome.classList.add('hidden');localStorage.setItem('nm6_welcome_seen','1')};
 const isPlaceholder=app=>Boolean(app&&app._nmHomePlaceholder===true&&
   app.tabs?.length===1&&app.tabs[0]?.state===app.state&&
   !app.state?.isDirty&&!app._desktopRecoveryPending&&
   !app.tabs[0]?.filePath&&!app.tabs[0]?.fileName);
 function createFromHome(mode,template='blank',name=''){
   const app=window.neuroMapApp;if(!app||app._desktopRecoveryPending)return;
   const kind=window.NeuroMapViewCore?.mode(mode)||'mindmap';
   const choice=HOME_VIEWS.find(v=>v[0]===kind);if(!choice)return;
   const title=String(name||'').trim().slice(0,80)||(window.GlaukaI18n?.pair(choice[1],choice[2])||(nmLocale()==='en'?choice[2]:choice[1]));
   const next=app.newState(title);next.root.viewMode=kind;
   if(template==='guided')populateHomeExample(next,kind);
   app.closeEditor?.(true);
   if(isPlaceholder(app)){
     app.state=next;app.tabs[0].state=next;app.tabs[0].title=title;app.renderer.state=next;
     app.tabs[0].camera=null;app.tabs[0].viewWorkspace=null;
      app._nmHomePlaceholder=false;
   }else{
     app.saveActiveTabSnapshot();app.addTab(next,title);
   }
   app.recalculateAndRender();app.fitToScreen();app.renderTabBar();app.scheduleSave?.();
   const input=typeof document==='object'?document.getElementById('nm-home-project-name'):null;
   if(input)input.value='';
   finish();
 }
 const HOME_TOUR_KEY='nm.home.intro-hidden.v1';
 let homeSelectedPreview=null;
 let homeCategory='all';
 let homePane='landing';
 let homeRecentAll=false;
 let homeIntroOpen=false;
 function homeTourHidden(){
   try{
     const preference=localStorage.getItem(HOME_TOUR_KEY);
     return preference==='1'||(preference!== '0'&&localStorage.getItem('nm6_welcome_seen')==='1');
   }catch(_){return false}
 }
 function updateHomeIntro(english){
   const intro=document.getElementById('nm-home-intro');
   if(!intro)return;
   homeIntroOpen=!homeTourHidden();
   intro.hidden=!homeIntroOpen;
   const show=document.getElementById('nm-home-intro-show');
   show.hidden=false;
   show.setAttribute('aria-expanded',String(homeIntroOpen));
   show.textContent=homeIntroOpen
     ? (globalThis.GlaukaI18n?.pair("Nascondi guida","Hide guide")??(english?'Hide guide':'Nascondi guida'))
     : (globalThis.GlaukaI18n?.pair("Guida introduttiva","Introductory guide")??(english?'Introductory guide':'Guida introduttiva'));
   document.getElementById('nm-home-intro-title').textContent=
     (globalThis.GlaukaI18n?.pair("Il tuo primo spazio di lavoro in tre passi","Create your first workspace in three steps")??(english?'Create your first workspace in three steps':'Il tuo primo spazio di lavoro in tre passi'));
   const steps=document.getElementById('nm-home-intro-steps');steps.replaceChildren();
   for(const text of english?[
     'Pick a view that suits your goal','Inspect it and choose blank or guided',
     'Create a project, or reopen your existing work'
   ]:[
     'Scegli la vista più adatta','Guarda l’anteprima e scegli vuoto o guidato',
     'Crea oppure riapri un progetto esistente'
   ]){
     const item=document.createElement('li');item.textContent=text;steps.append(item);
   }
   document.getElementById('nm-home-intro-hide').textContent=(globalThis.GlaukaI18n?.pair("Nascondi guida","Hide guide")??(english?'Hide guide':'Nascondi guida'));
 }
 function showHomePreview(mode){
   const choice=HOME_VIEWS.find(view=>view[0]===mode);
   if(!choice)return;
   homeSelectedPreview=mode;
   const english=nmLocale()==='en',template=document.getElementById('nm-home-template').value;
   const panel=document.getElementById('nm-home-preview-panel'),svg=document.getElementById('nm-home-preview-art');
   panel.hidden=false;
   homeSvg(svg,homePreviewScene(mode,template,english));
   const title=window.GlaukaI18n?.pair(choice[1],choice[2])||choice[english?2:1];
   svg.setAttribute('aria-label',((globalThis.GlaukaI18n?.pair("Anteprima di ","Preview of ")??(english?'Preview of ':'Anteprima di ')))+title);
   document.getElementById('nm-home-preview-title').textContent=title;
   document.getElementById('nm-home-preview-description').textContent=HOME_PURPOSE[mode][english?1:0];
   document.getElementById('nm-home-preview-note').textContent=template==='guided'?
     ((globalThis.GlaukaI18n?.pair("Anteprima dell’esempio modificabile. Nessun progetto è stato ancora creato.","Preview of the editable starter example. No project has been created yet.")??(english?'Preview of the editable starter example. No project has been created yet.':
       'Anteprima dell’esempio modificabile. Nessun progetto è stato ancora creato.'))):
     ((globalThis.GlaukaI18n?.pair("Progetto vuoto: le forme tratteggiate mostrano soltanto la disposizione possibile.","Blank project: the dashed shapes show only the possible layout.")??(english?'Blank project: the dashed shapes show only the possible layout.':
       'Progetto vuoto: le forme tratteggiate mostrano soltanto la disposizione possibile.')));
   document.getElementById('nm-home-preview-create').textContent=(globalThis.GlaukaI18n?.pair("Crea questo progetto","Create this project")??(english?'Create this project':'Crea questo progetto'));
   for(const wrapper of document.querySelectorAll('.nm-home-choice-wrap')){
     const selected=wrapper.dataset.view===mode;
     wrapper.dataset.selected=String(selected);
     const peek=wrapper.querySelector('.nm-home-peek');
     peek?.setAttribute('aria-pressed',String(selected));
   }
 }
 function renderHome(){
   const english=nmLocale()==='en',gallery=document.getElementById('nm-home-gallery');
   if(!gallery)return;
   const landing=document.getElementById('nm-home-landing'),create=document.getElementById('nm-home-create');
   if(landing)landing.hidden=homePane!=='landing';
   if(create)create.hidden=homePane!=='create';
   const newer=document.getElementById('nm-home-new');
   if(newer)newer.textContent=(globalThis.GlaukaI18n?.pair("Nuovo progetto","New project")??(english?'New project':'Nuovo progetto'));
   const back=document.getElementById('nm-home-back');
   if(back)back.textContent=(globalThis.GlaukaI18n?.pair("← Torna alla Home","← Back to Home")??(english?'← Back to Home':'← Torna alla Home'));
   const note=document.getElementById('nm6-welcome-privacy');
   if(note)note.textContent=window.neuromapDesktop?nmT('local'):nmT('privacy');
   updateHomeIntro(english);
   const heading=document.getElementById('nm-home-heading');
   heading.textContent=(globalThis.GlaukaI18n?.pair("Crea un progetto","Create a project")??(english?'Create a project':'Crea un progetto'));
   document.getElementById('nm-home-name-label').textContent=(globalThis.GlaukaI18n?.pair("Nome del progetto","Project name")??(english?'Project name':'Nome del progetto'));
   document.getElementById('nm-home-project-name').placeholder=(globalThis.GlaukaI18n?.pair("Facoltativo — scrivi un nome…","Optional — enter a name…")??(english?'Optional — enter a name…':'Facoltativo — scrivi un nome…'));
   gallery.setAttribute('aria-label',heading.textContent);
   document.getElementById('nm-home-template-label').textContent=(globalThis.GlaukaI18n?.pair("Modello iniziale","Starting template")??(english?'Starting template':'Modello iniziale'));
   const templateOptions=document.getElementById('nm-home-template').options;
   templateOptions[0].textContent=(globalThis.GlaukaI18n?.pair("Progetto vuoto","Empty project")??(english?'Empty project':'Progetto vuoto'));
   templateOptions[1].textContent=(globalThis.GlaukaI18n?.pair("Esempio guidato","Guided example")??(english?'Guided example':'Esempio guidato'));
   document.getElementById('nm-home-template-hint').textContent=(globalThis.GlaukaI18n?.pair("Contenuti e date di esempio modificabili.","Examples are editable, including timeline dates.")??(english?'Examples are editable, including timeline dates.':'Contenuti e date di esempio modificabili.'));
   const searchLabel=document.getElementById('nm-home-search-label');
   searchLabel.textContent=(globalThis.GlaukaI18n?.pair("Cerca progetti","Find projects")??(english?'Find projects':'Cerca progetti'));
   document.getElementById('nm-home-search').placeholder=(globalThis.GlaukaI18n?.pair("Cerca tra progetti aperti e salvati…","Search open and saved projects…")??(english?'Search open and saved projects…':'Cerca tra progetti aperti e salvati…'));
   const categories=document.getElementById('nm-home-categories');
   categories.replaceChildren();
   categories.setAttribute('aria-label',(globalThis.GlaukaI18n?.pair("Filtra tipi di vista","Filter view types")??(english?'Filter view types':'Filtra tipi di vista')));
   for(const category of HOME_CATEGORIES){
     const filter=document.createElement('button');filter.type='button';
     filter.textContent=english?category.en:category.it;filter.dataset.category=category.id;
     filter.setAttribute('aria-pressed',String(category.id===homeCategory));
     filter.addEventListener('click',()=>{
       homeCategory=category.id;
       if(homeSelectedPreview&&category.modes&&!category.modes.includes(homeSelectedPreview)){
         homeSelectedPreview=null;document.getElementById('nm-home-preview-panel').hidden=true;
       }
       renderHome();
     });
     categories.append(filter);
   }
   const activeCategory=HOME_CATEGORIES.find(item=>item.id===homeCategory)||HOME_CATEGORIES[0];
   gallery.replaceChildren();
   for(const view of HOME_VIEWS){
     if(activeCategory.modes&&!activeCategory.modes.includes(view[0]))continue;
     const wrapper=document.createElement('div');wrapper.className='nm-home-choice-wrap';wrapper.dataset.view=view[0];
     const b=document.createElement('button');b.type='button';b.className='nm-home-choice';b.dataset.view=view[0];
     const preview=document.createElementNS('http://www.w3.org/2000/svg','svg');
     preview.classList.add('nm-home-choice-preview');
     preview.setAttribute('aria-hidden','true');
     homeSvg(preview,homePreviewScene(view[0],document.getElementById('nm-home-template').value,english));
     b.append(preview);
     const body=document.createElement('span');body.className='nm-home-choice-body';
     const name=document.createElement('strong'),hint=document.createElement('small');
     name.textContent=view[english?2:1];hint.textContent=view[english?4:3];
     body.append(name,hint);b.append(body);
     b.setAttribute('aria-label',((globalThis.GlaukaI18n?.pair("Crea ","Create ")??(english?'Create ':'Crea ')))+name.textContent);
     b.addEventListener('click',()=>createFromHome(view[0],document.getElementById('nm-home-template').value,
       document.getElementById('nm-home-project-name').value));
     const peek=document.createElement('button');peek.type='button';peek.className='nm-home-peek';
     peek.textContent=(globalThis.GlaukaI18n?.pair("Anteprima","Preview")??(english?'Preview':'Anteprima'));
     peek.setAttribute('aria-label',((globalThis.GlaukaI18n?.pair("Anteprima ","Preview ")??(english?'Preview ':'Anteprima ')))+name.textContent);
     peek.setAttribute('aria-pressed','false');
     peek.addEventListener('click',()=>showHomePreview(view[0]));
     wrapper.append(b,peek);gallery.append(wrapper);
   }
   if(homeSelectedPreview)showHomePreview(homeSelectedPreview);
   const app=window.neuroMapApp,area=document.getElementById('nm-home-open-area'),host=document.getElementById('nm-home-open-tabs');
   host.replaceChildren();
   document.getElementById('nm-home-open-title').textContent=(globalThis.GlaukaI18n?.pair("Schede aperte","Open tabs")??(english?'Open tabs':'Schede aperte'));
   const search=document.getElementById('nm-home-search').value.trim();
   for(const tab of app?.tabs||[]){
     if(isPlaceholder(app)&&app.tabs[0]===tab)continue;
     const title=tab.title||tab.state?.root?.text||'Progetto';
     if(!homeMatches(title,tab.filePath,search))continue;
     const b=document.createElement('button');b.type='button';b.dataset.glaukaUserContent='';b.textContent=title;b.title=title;
     b.addEventListener('click',()=>{app.activateTab(tab.id);finish()});host.append(b);
   }
   area.hidden=!host.childElementCount;
   const recent=document.getElementById('nm-home-recent'),recentArea=document.getElementById('nm-home-recent-area');
   recent.replaceChildren();
   document.getElementById('nm-home-recent-title').textContent=(globalThis.GlaukaI18n?.pair("File salvati di recente","Recently saved files")??(english?'Recently saved files':'File salvati di recente'));
   const A=window.NeuroMapAtlasLibrary,pins=pinnedFiles();
   const matches=recentClosed(app).filter(record=>
     homeMatches(record.title,record.filePath.replace(/\\/g,'/').split('/').pop(),search));
   const shown=matches.slice(0,search||homeRecentAll?30:6);
   const more=document.getElementById('nm-home-recent-more');
   if(more){
     more.hidden=Boolean(search)||homeRecentAll||matches.length<=6;
     more.textContent=(globalThis.GlaukaI18n?.pair("Mostra tutti","Show all")??(english?'Show all':'Mostra tutti'));
   }
   const fileMark=()=>{
     const NS='http://www.w3.org/2000/svg';
     const svg=document.createElementNS(NS,'svg');
     svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('fill','none');
     svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.7');
     svg.setAttribute('aria-hidden','true');
     for(const d of ['M6 3h8l4 4v14H6z','M14 3v5h5']){
       const path=document.createElementNS(NS,'path');path.setAttribute('d',d);svg.append(path);
     }
     return svg;
   };
   for(const record of shown){
     const parts=String(record.filePath||'').replace(/\\/g,'/').split('/').filter(Boolean);
     const basename=parts.pop()||'';
     const parent=parts.length?parts[parts.length-1]:'';
     const item=document.createElement('div');item.className='nm-home-recent-item';
     const icon=document.createElement('span');icon.className='nm-home-file-icon';icon.append(fileMark());
     const button=document.createElement('button');button.type='button';button.dataset.action='open';button.dataset.glaukaUserContent='';
     const name=document.createElement('strong'),file=document.createElement('small');
     name.textContent=record.title||'Glauka';
     file.textContent=parent?parent+' / '+basename:basename;
     button.title=record.title||basename;file.title=record.filePath;
     button.append(name,file);button.addEventListener('click',()=>{void reopenHomeRecent(record)});
     const when=document.createElement('span');when.className='nm-home-recent-when';
     const stamp=Number(record.updatedAt);
     if(Number.isFinite(stamp)&&stamp>=1e11){
       try{when.textContent=new Intl.DateTimeFormat(english?'en':'it',{day:'numeric',month:'short',year:'numeric'}).format(new Date(stamp));}
       catch(_){when.hidden=true}
     }else when.hidden=true;
     const pin=document.createElement('button');pin.type='button';pin.dataset.action='pin';
     const marked=pins.has(A.normalizedPath(record.filePath));
     pin.textContent=marked?'★':'☆';pin.setAttribute('aria-pressed',String(marked));
     pin.setAttribute('aria-label',marked?((globalThis.GlaukaI18n?.pair("Rimuovi dai preferiti: ","Unpin ")??(english?'Unpin ':'Rimuovi dai preferiti: ')))+(record.title||basename):
       ((globalThis.GlaukaI18n?.pair("Aggiungi ai preferiti: ","Pin ")??(english?'Pin ':'Aggiungi ai preferiti: ')))+(record.title||basename));
     pin.addEventListener('click',()=>{if(togglePinnedFile(record.filePath))renderHome()});
     item.append(icon,button,when,pin);recent.append(item);
   }
   recentArea.hidden=!recent.childElementCount;
   const empty=document.getElementById('nm-home-empty');
   if(empty){empty.hidden=!search||Boolean(host.childElementCount||recent.childElementCount);
     empty.textContent=(globalThis.GlaukaI18n?.pair("Nessun progetto corrispondente.","No matching projects.")??(english?'No matching projects.':'Nessun progetto corrispondente.'))}
 }
 const openHome=()=>{
   homePane='landing';
   renderHome();welcome.classList.remove('hidden');
   const app=window.neuroMapApp;
   if(app?._desktopRecoveryPending)app._desktopRecoveryReady?.finally(()=>{if(!welcome.classList.contains('hidden'))renderHome()});
   galleryFocus();
 };
 function galleryFocus(){document.getElementById(homePane==='create'?'nm-home-project-name':'nm-home-new')?.focus()}
 window.NeuroMapHome={open:openHome,close:finish,create:createFromHome,render:renderHome};
 document.getElementById('nm-home-open')?.addEventListener('click',openHome);
 document.getElementById('nm-home-search').addEventListener('input',renderHome);
 document.getElementById('nm-home-template').addEventListener('change',renderHome);
 document.getElementById('nm-home-preview-create').addEventListener('click',()=>{
   if(homeSelectedPreview)createFromHome(homeSelectedPreview,
     document.getElementById('nm-home-template').value,document.getElementById('nm-home-project-name').value);
 });
 document.getElementById('nm-home-intro-hide').addEventListener('click',()=>{
   homeIntroOpen=false;
   try{localStorage.setItem(HOME_TOUR_KEY,'1')}catch(_){}
   updateHomeIntro(nmLocale()==='en');
 });
 document.getElementById('nm-home-intro-show').addEventListener('click',()=>{
   homeIntroOpen=!homeIntroOpen;
   try{localStorage.setItem(HOME_TOUR_KEY,homeIntroOpen?'0':'1')}catch(_){}
   updateHomeIntro(nmLocale()==='en');
 });
 // Intercept only explicit New commands; direct app.createNewTab remains available to imports/tests.
 document.addEventListener('click',event=>{
   if(!event.target.closest?.('#btn-new-tab,#menu-new-tab'))return;
   event.preventDefault();event.stopImmediatePropagation();openHome();
 },true);
 welcome.addEventListener('keydown',event=>{
   if(welcome.classList.contains('hidden'))return;
   // Keep Enter, Tab and typing in Home away from the canvas editor shortcuts.
   event.stopPropagation();
   if(event.key==='Escape'){event.preventDefault();finish();document.getElementById('nm-home-open')?.focus();return}
   if(event.key==='ArrowDown'||event.key==='ArrowUp'){
     const rows=[...welcome.querySelectorAll('#nm-home-recent [data-action="open"]')].filter(el=>el.getClientRects().length);
     const index=rows.indexOf(document.activeElement);
     if(index>=0){
       event.preventDefault();
       rows[index+(event.key==='ArrowDown'?1:-1)]?.focus();
       return;
     }
   }
   if(event.key==='Tab'){
     const controls=[...welcome.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])')]
       .filter(el=>el.getClientRects().length&&!el.closest('[hidden]'));
     if(!controls.length)return;
     if(event.shiftKey&&document.activeElement===controls[0]){event.preventDefault();controls.at(-1).focus()}
     else if(!event.shiftKey&&document.activeElement===controls.at(-1)){event.preventDefault();controls[0].focus()}
   }
 });
 
 document.getElementById('nm-home-new')?.addEventListener('click',()=>{
   homePane='create';
   if(!homeSelectedPreview)homeSelectedPreview='mindmap';
   renderHome();
   document.getElementById('nm-home-project-name')?.focus();
 });
 document.getElementById('nm-home-back')?.addEventListener('click',()=>{
   homePane='landing';renderHome();document.getElementById('nm-home-new')?.focus();
 });
 document.getElementById('nm-home-recent-more')?.addEventListener('click',()=>{
   homeRecentAll=true;renderHome();
 });
 document.getElementById('nm-home-close').addEventListener('click',finish);
 document.getElementById('nm6-welcome-start').addEventListener('click',finish);
 document.getElementById('nm6-welcome-import').addEventListener('click',()=>{finish();document.getElementById('btn-import-files-new-tabs')?.click()});
 window.nm6ApplyLanguage();nmProduct.status();
 const chooseStartupHome=()=>{
   const appAtLaunch=window.neuroMapApp;
   if(!appAtLaunch)return;
   const showIfEmpty=()=>{
     if(isPlaceholder(appAtLaunch)&&localStorage.getItem('nm6_welcome_seen')!=='1')openHome();
   };
   if(appAtLaunch._desktopRecoveryPending)appAtLaunch._desktopRecoveryReady?.finally(showIfEmpty);
   else showIfEmpty();
 };
 window.NeuroMapHome.start=chooseStartupHome;
