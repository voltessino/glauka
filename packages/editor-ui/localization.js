/* Shared Italian/English UI messages. User-authored content is excluded by callers. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.NeuroMapLocale=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
/* @neuromap-localization-messages */
  function translate(raw,locale,dictionary=messages){
    if(locale!=='it'&&locale!=='en'&&typeof globalThis.GlaukaI18n?.translate==='function')return globalThis.GlaukaI18n.translate(raw,locale);
    const text=String(raw??''),trim=text.trim(),en=locale==='en';
    const directLookup=value=>{
      if(Object.prototype.hasOwnProperty.call(dictionary,value))return en?dictionary[value]:value;
      if(!en){const pair=Object.entries(dictionary).find(([,english])=>english===value);if(pair)return pair[0];}
      return null;
    };
    // Platform hints replace Ctrl+ with Command before translation. Match the
    // catalog's portable spelling, then retain the shortcut shown on the Mac.
    const lookup=value=>{
      const direct=directLookup(value);
      if(direct!==null||!value.includes('⌘+'))return direct;
      const portable=directLookup(value.replace(/⌘\+/g,'Ctrl+'));
      return portable===null?null:portable.replace(/Ctrl\+/g,'⌘+');
    };
    let result=lookup(trim);
    if(result===null){
      const at=trim.search(/[A-Za-zÀ-ÿ]/);
      if(at>0){const label=lookup(trim.slice(at));if(label!==null)result=trim.slice(0,at)+label;}
    }
    if(result===null){
      let m;
      if((m=trim.match(/^(\d+)(?: \((?:primi|first) 75\))? (?:risultati|results) · (\d+) (?:schede|maps)$/)))
        result=m[1]+(trim.includes('75)')?(en?' (first 75)':' (primi 75)'):'')+(en?' results · ':' risultati · ')+m[2]+(en?' maps':' schede');
      else if((m=trim.match(/^(?:Modifica|Edit|Rimuovi|Remove) ((?:Mod|Alt|Shift|Tab|Enter|F\d|Delete|Backspace).*)$/)))
        result=(en?(/^(?:Modifica|Edit) /.test(trim)?'Edit ':'Remove '):(/^(?:Modifica|Edit) /.test(trim)?'Modifica ':'Rimuovi '))+m[1];
      else if((m=trim.match(/^(?:DES|R) (\d+) \/ (?:SIN|L) (\d+)$/)))result=(en?'R ':'DES ')+m[1]+(en?' / L ':' / SIN ')+m[2];
      else if(/^(?:(?:Ctrl|Shift|Tab|Invio|Enter|Spazio|Space|Clic|Click|⌘)[+ /·A-Za-z0-9↑↓?⌘]+)$/.test(trim))
        result=en?trim.replace(/Invio/g,'Enter').replace(/Clic(?!k)/g,'Click').replace(/Spazio/g,'Space'):trim.replace(/Enter/g,'Invio').replace(/Click/g,'Clic').replace(/Space/g,'Spazio');
      else if((m=trim.match(/^(\d+) (?:nodi|nodo|nodes|node)(?:\/(mappa|map))?$/)))
        result=m[1]+' '+(en?(m[1]==='1'?'node':'nodes'):(m[1]==='1'?'nodo':'nodi'))+(m[2]?(en?'/map':'/mappa'):'');
      else if((m=trim.match(/^(\d+) (?:caratteri|characters)$/)))result=m[1]+(en?' characters':' caratteri');
      else if((m=trim.match(/^(?:Predefinito|Default): (.+)$/)))result=(en?'Default: ':'Predefinito: ')+(lookup(m[1])??m[1]);
      else if((m=trim.match(/^(?:Anteprima importazione|Import preview) · (.+)$/)))result=(en?'Import preview · ':'Anteprima importazione · ')+m[1];
      else if((m=trim.match(/^(\d+) (?:nodi|nodes) → (\d+) (?:mappe|maps|mappa|map)$/)))
        result=m[1]+(en?' nodes → ':' nodi → ')+m[2]+(en?(m[2]==='1'?' map':' maps'):(m[2]==='1'?' mappa':' mappe'));
    }
    if(result===null){
      for(const [italian,english] of Object.entries(dictionary)){
        if(!italian.endsWith(':'))continue;
        const prefix=(en?italian:english)+' ';
        if(trim.startsWith(prefix)){result=(en?english:italian)+' '+trim.slice(prefix.length);break;}
      }
    }
    return result===null?text:text.replace(trim,()=>result);
  }
  return Object.freeze({messages:Object.freeze(messages),rangeLabels,translate});
});
