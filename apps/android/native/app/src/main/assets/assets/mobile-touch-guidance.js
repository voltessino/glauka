/* Android-owned touchscreen copy. Shared desktop catalogs and keyboard handlers stay intact. */
(function(root,factory){
  'use strict';
  const api=factory(root);
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root.document){root.GlaukaTouchGuidance=api;api.install();}
})(typeof globalThis==='object'?globalThis:this,function(root){
  'use strict';
  const packs = {
  "it": {
    "undo": "Tocca Annulla per ripristinare.",
    "closeUndo": "Chiudi il pannello e tocca Annulla per ripristinare.",
    "branchMoved": "Ramo spostato.",
    "relationRemoved": "Collegamento eliminato.",
    "noteSaved": "Nota salvata.",
    "props": "Proprietà del nodo: tocca Salva per confermare.",
    "selection": "Usa Seleziona tutto in Tutti i comandi. Per scegliere singoli nodi insieme serve una tastiera fisica.",
    "selected": "{count} nodi selezionati. Le modifiche si applicano alla selezione.",
    "summary": "Seleziona almeno due nodi fratelli. La selezione personalizzata richiede una tastiera fisica.",
    "list": "Scrivi una voce per riga. Tocca fuori dal testo per confermare.",
    "link": "Tocca ↗ per aprire. Usa Modifica per cambiare il testo.",
    "boundary": "Seleziona il recinto, apri Stile e tocca Titolo del recinto.",
    "drawing": "Trascina per disegnare. Usa Seleziona più elementi per raggruppare. Tocca Fine disegno per terminare.",
    "image": "Trascina l’immagine per spostarla e gli angoli per ridimensionarla.",
    "search": "Scrivi per cercare e tocca un risultato.",
    "editor": "Modifica testo del nodo",
    "physical": "Tastiera fisica (Bluetooth/USB)",
    "relation": "Tocca il collegamento per selezionarlo. Usa Stile per rinominarlo o eliminarlo.",
    "illustration": "Scegli un nodo o usa Seleziona tutto. Il testo non viene modificato."
  },
  "en": {
    "undo": "Tap Undo to restore.",
    "closeUndo": "Close the panel and tap Undo to restore.",
    "branchMoved": "Branch moved.",
    "relationRemoved": "Relationship deleted.",
    "noteSaved": "Note saved.",
    "props": "Node properties: tap Save to confirm.",
    "selection": "Use Select all in All commands. Selecting individual nodes together requires a physical keyboard.",
    "selected": "{count} nodes selected. Changes apply to the selection.",
    "summary": "Select at least two sibling nodes. Custom selection requires a physical keyboard.",
    "list": "Write one item per line. Tap outside the text to confirm.",
    "link": "Tap ↗ to open. Use Edit to change the text.",
    "boundary": "Select the boundary, open Style and tap Boundary title.",
    "drawing": "Drag to draw. Use Select multiple objects to group them. Tap Done drawing to finish.",
    "image": "Drag the image to move it and its corners to resize it.",
    "search": "Type to search and tap a result.",
    "editor": "Edit node text",
    "physical": "Physical keyboard (Bluetooth/USB)",
    "relation": "Tap the relationship to select it. Use Style to rename or delete it.",
    "illustration": "Choose a node or use Select all. The text is not changed."
  },
  "de": {
    "undo": "Tippe zum Wiederherstellen auf Rückgängig.",
    "closeUndo": "Schließe das Fenster und tippe zum Wiederherstellen auf Rückgängig.",
    "branchMoved": "Zweig verschoben.",
    "relationRemoved": "Verbindung gelöscht.",
    "noteSaved": "Notiz gespeichert.",
    "props": "Knoteneigenschaften: Tippe zum Bestätigen auf Speichern.",
    "selection": "Verwende Alles auswählen unter Alle Befehle. Für die gemeinsame Auswahl einzelner Knoten ist eine physische Tastatur erforderlich.",
    "selected": "{count} Knoten ausgewählt. Änderungen gelten für die Auswahl.",
    "summary": "Wähle mindestens zwei Geschwisterknoten aus. Eine benutzerdefinierte Auswahl erfordert eine physische Tastatur.",
    "list": "Schreibe einen Eintrag pro Zeile. Tippe zum Bestätigen außerhalb des Textes.",
    "link": "Tippe zum Öffnen auf ↗. Verwende Bearbeiten, um den Text zu ändern.",
    "boundary": "Wähle die Umrandung aus, öffne Stil und tippe auf Titel der Umrandung.",
    "drawing": "Ziehe zum Zeichnen. Verwende Mehrere Objekte auswählen zum Gruppieren. Tippe zum Beenden auf Zeichnen beenden.",
    "image": "Ziehe das Bild zum Verschieben und seine Ecken zum Ändern der Größe.",
    "search": "Gib einen Suchtext ein und tippe auf ein Ergebnis.",
    "editor": "Knotentext bearbeiten",
    "physical": "Physische Tastatur (Bluetooth/USB)",
    "relation": "Tippe auf die Verbindung, um sie auszuwählen. Verwende Stil zum Umbenennen oder Löschen.",
    "illustration": "Wähle einen Knoten oder verwende Alles auswählen. Der Text wird nicht geändert."
  },
  "es": {
    "undo": "Toca Deshacer para restaurar.",
    "closeUndo": "Cierra el panel y toca Deshacer para restaurar.",
    "branchMoved": "Rama movida.",
    "relationRemoved": "Relación eliminada.",
    "noteSaved": "Nota guardada.",
    "props": "Propiedades del nodo: toca Guardar para confirmar.",
    "selection": "Usa Seleccionar todo en Todos los comandos. Para seleccionar varios nodos individuales se necesita un teclado físico.",
    "selected": "{count} nodos seleccionados. Los cambios se aplican a la selección.",
    "summary": "Selecciona al menos dos nodos hermanos. La selección personalizada requiere un teclado físico.",
    "list": "Escribe un elemento por línea. Toca fuera del texto para confirmar.",
    "link": "Toca ↗ para abrir. Usa Editar para cambiar el texto.",
    "boundary": "Selecciona el contorno, abre Estilo y toca Título del contorno.",
    "drawing": "Arrastra para dibujar. Usa Seleccionar varios objetos para agruparlos. Toca Finalizar dibujo para terminar.",
    "image": "Arrastra la imagen para moverla y sus esquinas para cambiar el tamaño.",
    "search": "Escribe para buscar y toca un resultado.",
    "editor": "Editar texto del nodo",
    "physical": "Teclado físico (Bluetooth/USB)",
    "relation": "Toca la relación para seleccionarla. Usa Estilo para renombrarla o eliminarla.",
    "illustration": "Elige un nodo o usa Seleccionar todo. El texto no cambia."
  },
  "fr": {
    "undo": "Touchez Annuler pour rétablir.",
    "closeUndo": "Fermez le panneau et touchez Annuler pour rétablir.",
    "branchMoved": "Branche déplacée.",
    "relationRemoved": "Relation supprimée.",
    "noteSaved": "Note enregistrée.",
    "props": "Propriétés du nœud : touchez Enregistrer pour confirmer.",
    "selection": "Utilisez Tout sélectionner dans Toutes les commandes. La sélection de plusieurs nœuds individuels nécessite un clavier physique.",
    "selected": "{count} nœuds sélectionnés. Les modifications s’appliquent à la sélection.",
    "summary": "Sélectionnez au moins deux nœuds frères. Une sélection personnalisée nécessite un clavier physique.",
    "list": "Écrivez un élément par ligne. Touchez en dehors du texte pour confirmer.",
    "link": "Touchez ↗ pour ouvrir. Utilisez Modifier pour changer le texte.",
    "boundary": "Sélectionnez le contour, ouvrez Style et touchez Titre du contour.",
    "drawing": "Faites glisser pour dessiner. Utilisez Sélectionner plusieurs objets pour les regrouper. Touchez Terminer le dessin pour finir.",
    "image": "Faites glisser l’image pour la déplacer et ses coins pour la redimensionner.",
    "search": "Saisissez une recherche et touchez un résultat.",
    "editor": "Modifier le texte du nœud",
    "physical": "Clavier physique (Bluetooth/USB)",
    "relation": "Touchez la relation pour la sélectionner. Utilisez Style pour la renommer ou la supprimer.",
    "illustration": "Choisissez un nœud ou utilisez Tout sélectionner. Le texte reste inchangé."
  },
  "pt": {
    "undo": "Toque em Desfazer para restaurar.",
    "closeUndo": "Feche o painel e toque em Desfazer para restaurar.",
    "branchMoved": "Ramo movido.",
    "relationRemoved": "Relação eliminada.",
    "noteSaved": "Nota guardada.",
    "props": "Propriedades do nó: toque em Guardar para confirmar.",
    "selection": "Use Selecionar tudo em Todos os comandos. A seleção conjunta de nós individuais requer um teclado físico.",
    "selected": "{count} nós selecionados. As alterações aplicam-se à seleção.",
    "summary": "Selecione pelo menos dois nós irmãos. A seleção personalizada requer um teclado físico.",
    "list": "Escreva um item por linha. Toque fora do texto para confirmar.",
    "link": "Toque em ↗ para abrir. Use Editar para alterar o texto.",
    "boundary": "Selecione o contorno, abra Estilo e toque em Título do contorno.",
    "drawing": "Arraste para desenhar. Use Selecionar vários objetos para os agrupar. Toque em Concluir desenho para terminar.",
    "image": "Arraste a imagem para a mover e os cantos para a redimensionar.",
    "search": "Escreva para pesquisar e toque num resultado.",
    "editor": "Editar texto do nó",
    "physical": "Teclado físico (Bluetooth/USB)",
    "relation": "Toque na relação para a selecionar. Use Estilo para a renomear ou eliminar.",
    "illustration": "Escolha um nó ou use Selecionar tudo. O texto não é alterado."
  },
  "ar": {
    "undo": "اضغط على «تراجع» لاستعادة الحالة السابقة.",
    "closeUndo": "أغلق اللوحة واضغط على «تراجع» لاستعادة الحالة السابقة.",
    "branchMoved": "تم نقل الفرع.",
    "relationRemoved": "تم حذف الرابط.",
    "noteSaved": "تم حفظ الملاحظة.",
    "props": "خصائص العقدة: اضغط على «حفظ» للتأكيد.",
    "selection": "استخدم «تحديد الكل» في «جميع الأوامر». يتطلب تحديد عقد فردية معًا لوحة مفاتيح فعلية.",
    "selected": "تم تحديد {count} عقدة. تُطبَّق التغييرات على التحديد.",
    "summary": "حدّد عقدتين شقيقتين على الأقل. يتطلب التحديد المخصص لوحة مفاتيح فعلية.",
    "list": "اكتب عنصرًا في كل سطر. اضغط خارج النص للتأكيد.",
    "link": "اضغط على ↗ للفتح. استخدم «تعديل» لتغيير النص.",
    "boundary": "حدّد الإطار وافتح «النمط» واضغط على «عنوان الإطار».",
    "drawing": "اسحب للرسم. استخدم «تحديد عدة عناصر» لتجميعها. اضغط على «إنهاء الرسم» للانتهاء.",
    "image": "اسحب الصورة لتحريكها وزواياها لتغيير حجمها.",
    "search": "اكتب للبحث واضغط على نتيجة.",
    "editor": "تعديل نص العقدة",
    "physical": "لوحة مفاتيح فعلية (Bluetooth/USB)",
    "relation": "اضغط على الرابط لتحديده. استخدم «النمط» لإعادة تسميته أو حذفه.",
    "illustration": "اختر عقدة أو استخدم «تحديد الكل». لا يتم تغيير النص."
  },
  "zh-CN": {
    "undo": "轻点“撤销”以还原。",
    "closeUndo": "关闭面板，然后轻点“撤销”以还原。",
    "branchMoved": "分支已移动。",
    "relationRemoved": "连接已删除。",
    "noteSaved": "笔记已保存。",
    "props": "节点属性：轻点“保存”进行确认。",
    "selection": "在“所有命令”中使用“全选”。同时选择多个单独节点需要实体键盘。",
    "selected": "已选择 {count} 个节点。更改将应用于所选节点。",
    "summary": "请至少选择两个同级节点。自定义多选需要实体键盘。",
    "list": "每行输入一项。轻点文本外部进行确认。",
    "link": "轻点 ↗ 打开。使用“编辑”更改文本。",
    "boundary": "选择边界，打开“样式”，然后轻点“边界标题”。",
    "drawing": "拖动进行绘制。使用“选择多个对象”进行分组。轻点“完成绘制”结束。",
    "image": "拖动图像以移动，拖动四角以调整大小。",
    "search": "输入搜索内容，然后轻点结果。",
    "editor": "编辑节点文本",
    "physical": "实体键盘（蓝牙/USB）",
    "relation": "轻点连接以选中。使用“样式”重命名或删除。",
    "illustration": "选择一个节点或使用“全选”。文本不会更改。"
  }
};
  const codes=Object.freeze(Object.keys(packs));
  const locale=()=>root.GlaukaI18n?.locale?.()||root.document?.documentElement.lang||'it';
  function text(key,params={},code=locale()){
    const value=(packs[code]||packs.en)[key];
    if(value===undefined)throw Error('Unknown Android touch guidance: '+key);
    return value.replace(/\{(\w+)\}/g,(_,name)=>String(params[name]??''));
  }
  function message(key,params={},code=locale()){
    const suffix=['noteSaved','props','relationRemoved'].includes(key)?'closeUndo':'undo';
    return text(key,params,code)+' '+text(suffix,{},code);
  }
  // Strong keyboard/mouse instructions, including localized modifier spellings.
  const desktopPattern=/(?:⌘|contr[oô]le\s*[+＋/]|(?:ctrl|control|cmd|command|alt|shift|strg|umschalt|mai?usc|maj|may[uú]s)\s*(?:[+＋/]|(?=\s+[a-z0-9]\b))|\bF(?:[1-9]|1[0-2])\b|tasto\s+destro|right[ -]?click|rotellina|mouse\s*wheel|doppio\s+clic|double[ -]?click|clic\s+(?:droit|derecho)|mausrad|rechte\s+maustaste|molette|rueda\s+del\s+rat[oó]n|bot[aã]o\s+direito|roda\s+do\s+mouse|鼠标右键|滚轮|عجلة\s+الماوس|زر\s+الفأرة\s+الأيمن|\b(?:Esc|Escape|Invio|Enter)\s*(?:[:：]|(?:per|to|termina|exits|naviga|teletrasporta)\b)|\bTab\s+(?:per|to)\b|\b(?:ctrl|control|cmd|command|alt|shift|strg|umschalt|mai?usc|maj|may[uú]s)\s+(?:clic(?:k)?|mouse|enter|invio|tab|delete|canc)\b|\b(?:premi|press|presione|dr[uü]cken|appuyez|pressione)\s+(?:Ins|Insert|Canc|Delete|Entf|Suppr|Supr)\b|\b(?:Canc|Delete|Entf|Suppr|Supr)\s+(?:elimina|deletes?|pour|per|to)\b|(?:控制|命令|上档|换档|كنترول|كونترول|شيفت|ألت)\s*[+＋/])/i;
  const surfaces=Object.freeze([
    ['#quick-icon-summary','title','summary'],['#inline-editor-input','aria-label','editor'],
    ['#nm54-wrap-properties .nm54-hint','textContent','illustration'],
    ['#image-controls .image-control-hint','textContent','image'],
    ['#v5-relation-panel .v5-note','textContent','relation'],
    ['#nm-list-edit-hint','textContent','list'],
    ['#shortcuts-panel','aria-label','physical'],['#shortcuts-panel .shortcuts-header strong','textContent','physical']
  ]);
  const labels=Object.freeze([
    ['#btn-new-tab','Nuova mappa','New map'],['#quick-cut','Taglia','Cut'],['#quick-copy','Copia','Copy'],['#quick-paste','Incolla','Paste'],
    ['#quick-duplicate','Duplica selezione','Duplicate selection'],['#quick-icon-child','Aggiungi sotto-ramo','Add child branch'],
    ['#quick-icon-sibling','Aggiungi ramo','Add sibling'],['#btn-spotlight','Cerca nelle mappe','Search maps'],
    ['#btn-zoom-out','Riduci zoom','Zoom out'],['#btn-zoom-in','Aumenta zoom','Zoom in']
  ]);
  function write(el,kind,value){
    if(!el)return;
    if(kind==='textContent'){
      if(!el.hasAttribute('data-glauka-touch-owned'))el.setAttribute('data-glauka-touch-owned','');
      if(!el.classList.contains('nm6-skiptranslate'))el.classList.add('nm6-skiptranslate');
      if(el.textContent!==value)el.textContent=value;
    }else{
      const attrs=new Set((el.getAttribute('data-glauka-touch-attributes')||'').split(' ').filter(Boolean));
      if(!attrs.has(kind)){attrs.add(kind);el.setAttribute('data-glauka-touch-attributes',[...attrs].join(' '));}
      if(el.getAttribute(kind)!==value)el.setAttribute(kind,value);
    }
  }
  function apply(){
    const doc=root.document;if(!doc)return;
    for(const [selector,kind,key]of surfaces)for(const el of doc.querySelectorAll(selector))write(el,kind,text(key));
    for(const [selector,it,en]of labels)for(const el of doc.querySelectorAll(selector)){const label=root.GlaukaI18n?.pair(it,en)||(locale()==='it'?it:en);write(el,'title',label);write(el,'aria-label',label);}
    for(const el of doc.querySelectorAll('[data-glauka-touch-key]'))write(el,'textContent',text(el.dataset.glaukaTouchKey));
    const undo=root.document.getElementById('glauka-undo');
    const undoLabel=root.GlaukaI18n?.pair('Annulla','Undo')||(locale()==='it'?'Annulla':'Undo');
    if(undo){write(undo,'aria-label',undoLabel);write(undo.querySelector('span'),'textContent',undoLabel);}
    const count=root.neuroMapApp?.state?.selectedNodeIds?.length||0;
    write(doc.getElementById('v5-selection-hint'),'textContent',count>1?text('selected',{count}):text('selection'));
    const counter=doc.getElementById('spotlight-count');
    if(!doc.getElementById('find-query')?.value)write(counter,'textContent',text('search'));
    else if(counter)write(counter,'textContent',root.GlaukaI18n?.translate(counter.textContent)||counter.textContent);
    const physical=doc.getElementById('shortcuts-panel');if(physical)physical.setAttribute('data-glauka-physical-keyboard','');
  }
  function install(){
    const doc=root.document;if(!doc||install.done)return;install.done=true;
    const start=()=>{
      apply();let queued=false;
      const schedule=()=>{if(queued)return;queued=true;root.queueMicrotask(()=>{queued=false;apply();});};
      new root.MutationObserver(schedule).observe(doc.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['title','aria-label']});
      root.addEventListener('glauka:language-change',schedule);
    };
    const ready=()=>Promise.resolve(root.GlaukaAppReady).then(start);
    if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
  }
  return Object.freeze({packs,codes,text,message,desktopPattern,surfaces,labels,apply,install});
});
