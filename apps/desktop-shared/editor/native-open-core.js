/* Native desktop import scheduling: reads may overlap, live workspace commits never do. */
(function(root,factory){
  'use strict';const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root.document)root.GlaukaNativeOpen=api;
})(globalThis,function(){
  'use strict';
  const MAX_FILE_BYTES=100*1024*1024,MAX_BATCH_BYTES=100*1024*1024,BUFFER_BYTES=16*1024*1024;
  function pathKey(path){const value=String(path||'').replace(/\\/g,'/');return /^[a-z]:\//i.test(value)||value.startsWith('//')?value.toLowerCase():value;}
  function report(source='picker'){return {source,opened:0,ignored:0,failed:0,entries:[]};}
  function record(result,file,outcome){
    const status=['opened','ignored','failed'].includes(outcome?.status)?outcome.status:'failed';
    const entry={filename:file.filename||file.name||'',path:file.path||'',status,deliveryId:file.deliveryId||file.id||'',tabId:outcome?.tabId||'',code:outcome?.code||'',message:String(outcome?.message||''),pathWarning:!!(outcome?.pathWarning||file.pathWarning)};
    result[status]++;result.entries.push(entry);return entry;
  }
  // Reservations include completed reads awaiting their turn. Releasing them
  // when fetch finishes would silently preload the entire batch into memory.
  async function run(input,{load,apply,onProgress=()=>{},concurrency=2,budget=BUFFER_BYTES,yieldUI=()=>new Promise(r=>setTimeout(r,0))}){
    const files=Array.from(input),slots=new Map(),result=report();let next=0,reserved=0;
    const weight=file=>/\.xmind$/i.test(file.filename||file.name||'')?MAX_FILE_BYTES:Math.max(1,Number(file.size??file.bytes?.byteLength)||BUFFER_BYTES);
    function pump(){
      while(next<files.length&&slots.size<Math.max(1,Math.min(2,concurrency))){
        const file=files[next],bytes=file.error||file.ignored?0:weight(file);
        if(slots.size&&reserved+bytes>budget)break;
        const index=next++;reserved+=bytes;
        const promise=Promise.resolve().then(()=>file.error?{error:file.error}:file.ignored?{ignored:file.ignored}:{payload:null}).then(async item=>item.error||item.ignored?item:{payload:await load(file)}).catch(error=>({error}));
        slots.set(index,{bytes,promise});
      }
    }
    pump();
    for(let i=0;i<files.length;i++){
      const slot=slots.get(i);let item=await slot.promise,outcome;
      try{
        if(item.error)throw item.error;
        outcome=item.ignored?{status:'ignored',code:item.ignored}:await apply(item.payload,files[i]);
      }catch(error){outcome={status:'failed',code:error?.code||'',message:error?.message||String(error)};}
      record(result,files[i],outcome);item=null;slots.delete(i);reserved-=slot.bytes;
      // Drop the settled promise too, so it cannot retain the previous payload.
      slot.promise=null;pump();onProgress(result,result.entries.at(-1));await yieldUI();
    }
    return result;
  }
  const copy={
    it:{title:'Apertura file',opened:'aperti',ignored:'ignorati',failed:'falliti',unsupported:'Formato non supportato.',unreadable:'File non accessibile.',tooLarge:'File oltre il limite di 100 MB.',batchSize:'Limite complessivo di 100 MB raggiunto.',changed:'Il file è cambiato: selezionalo di nuovo.',duplicate:'File già selezionato o già aperto.',cancelled:'Importazione annullata.',expired:'Selezione scaduta: scegli nuovamente il file.',warning:'Percorso non memorizzabile: per salvare potrà servire Salva con nome.'},
    en:{title:'Open files',opened:'opened',ignored:'skipped',failed:'failed',unsupported:'Unsupported format.',unreadable:'File is not accessible.',tooLarge:'File exceeds the 100 MB limit.',batchSize:'The 100 MB batch limit has been reached.',changed:'The file changed: select it again.',duplicate:'File already selected or open.',cancelled:'Import cancelled.',expired:'Selection expired: select the file again.',warning:'Path could not be remembered: Save as may be needed.'},
    de:{title:'Dateien öffnen',opened:'geöffnet',ignored:'übersprungen',failed:'fehlgeschlagen',unsupported:'Nicht unterstütztes Format.',unreadable:'Datei nicht zugänglich.',tooLarge:'Datei überschreitet 100 MB.',batchSize:'Die Gesamtgrenze von 100 MB ist erreicht.',changed:'Datei geändert: erneut auswählen.',duplicate:'Datei bereits ausgewählt oder geöffnet.',cancelled:'Import abgebrochen.',expired:'Auswahl abgelaufen: Datei erneut auswählen.',warning:'Pfad nicht gespeichert: möglicherweise ist Speichern unter erforderlich.'},
    es:{title:'Abrir archivos',opened:'abiertos',ignored:'omitidos',failed:'fallidos',unsupported:'Formato no compatible.',unreadable:'Archivo no accesible.',tooLarge:'El archivo supera los 100 MB.',batchSize:'Se ha alcanzado el límite total de 100 MB.',changed:'El archivo cambió: selecciónalo de nuevo.',duplicate:'Archivo ya seleccionado o abierto.',cancelled:'Importación cancelada.',expired:'La selección caducó: selecciona el archivo de nuevo.',warning:'No se pudo guardar la ruta: puede ser necesario Guardar como.'},
    fr:{title:'Ouvrir des fichiers',opened:'ouverts',ignored:'ignorés',failed:'échoués',unsupported:'Format non pris en charge.',unreadable:'Fichier inaccessible.',tooLarge:'Le fichier dépasse 100 Mo.',batchSize:'La limite totale de 100 Mo est atteinte.',changed:'Le fichier a changé : sélectionnez-le à nouveau.',duplicate:'Fichier déjà sélectionné ou ouvert.',cancelled:'Importation annulée.',expired:'Sélection expirée : sélectionnez à nouveau le fichier.',warning:'Chemin non mémorisé : Enregistrer sous peut être nécessaire.'},
    pt:{title:'Abrir ficheiros',opened:'abertos',ignored:'ignorados',failed:'falhados',unsupported:'Formato não suportado.',unreadable:'Ficheiro inacessível.',tooLarge:'O ficheiro excede 100 MB.',batchSize:'O limite total de 100 MB foi atingido.',changed:'O ficheiro mudou: selecione-o novamente.',duplicate:'Ficheiro já selecionado ou aberto.',cancelled:'Importação cancelada.',expired:'A seleção expirou: selecione novamente o ficheiro.',warning:'Não foi possível memorizar o caminho: poderá ser necessário Guardar como.'},
    ar:{title:'فتح الملفات',opened:'مفتوحة',ignored:'متجاهلة',failed:'فاشلة',unsupported:'تنسيق غير مدعوم.',unreadable:'الملف غير متاح.',tooLarge:'يتجاوز الملف حد 100 ميغابايت.',batchSize:'تم بلوغ الحد الإجمالي البالغ 100 ميغابايت.',changed:'تغير الملف: حدده مجددًا.',duplicate:'الملف محدد أو مفتوح بالفعل.',cancelled:'تم إلغاء الاستيراد.',expired:'انتهت صلاحية التحديد: حدد الملف مجددًا.',warning:'تعذر حفظ المسار: قد تحتاج إلى «حفظ باسم».'},
    'zh-CN':{title:'打开文件',opened:'已打开',ignored:'已跳过',failed:'失败',unsupported:'不支持此格式。',unreadable:'无法访问文件。',tooLarge:'文件超过 100 MB 限制。',batchSize:'已达到总计 100 MB 的限制。',changed:'文件已更改：请重新选择。',duplicate:'文件已选择或已打开。',cancelled:'导入已取消。',expired:'选择已过期：请重新选择文件。',warning:'无法记住路径：保存时可能需要使用“另存为”。'}
  };
  const labels=locale=>copy[locale]||copy.en;
  function summary(result,locale='en'){const t=labels(locale);return `${result.opened} ${t.opened} · ${result.ignored} ${t.ignored} · ${result.failed} ${t.failed}`;}
  function details(result,locale='en'){const t=labels(locale);return result.entries.filter(e=>e.status!=='opened'||e.pathWarning).map(e=>e.filename+': '+(t[e.code]||e.message||t[e.status])+(e.pathWarning?' '+t.warning:'')).join('\n');}
  return Object.freeze({MAX_TABS:100,MAX_FILE_BYTES,MAX_BATCH_BYTES,BUFFER_BYTES,pathKey,report,record,run,copy,labels,summary,details});
});
