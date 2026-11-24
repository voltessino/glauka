    // ===================== NEUROMAP 5.4 =====================
    // Lightweight icons: one view, in-memory cache, single undo for bulk actions.
    const nm54 = id => document.getElementById(id);
    const nm54IconUriCache = new WeakMap();
    // Canvas drawImage rasterizes an SVG at its width/height. A 24px icon
    // upscaled at 150–200% or while zooming is soft. A viewBox keeps the
    // vectors; the larger viewport only changes the bitmap the canvas samples.
    function nm54SharpSvg(clean){
      if(typeof clean!=='string'||!/\bviewBox\s*=/i.test(clean))return clean;
      return clean.replace(/<svg\b([^>]*)>/i,(full,attrs)=>{
        const next=attrs.replace(/\s(?:width|height)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi,'');
        return '<svg'+next+' width="256" height="256">';
      });
    }
    function nm54IconUri(illustration){
      if(typeof illustration?.svg!=='string')return '';
      // Imported .gk/.neuromap maps are untrusted. Sanitize the actual SVG
      // before making an image URL, not only fresh Iconify downloads.
      const cached=nm54IconUriCache.get(illustration);
      if(cached?.source===illustration.svg)return cached.uri;
      let uri='';
      try{
        const clean=nm54SharpSvg(nm54SanitizeSvg(illustration.svg));
        uri='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(clean);
      }catch(_){/* Keep the map intact; reject unsafe artwork only at rendering/export. */}
      nm54IconUriCache.set(illustration,{source:illustration.svg,uri});
      return uri;
    }
    const nm54Dictionary={
      'causa':'warning','f.ne':'gear','funzione':'gear','def.':'book','definizione':'book',
      'cuore':'heart','sangue':'drop','osso':'bone','ossa':'bone','tess. cartil.':'bone',
      'cartilagine':'bone','cell.':'microbe','cellula':'microbe','cellule':'microbe',
      'muscolo':'muscle','muscoli':'muscle','nervo':'brain','nervi':'brain',
      'fegato':'liver','rene':'kidney','reni':'kidney','polmone':'lungs','polmoni':'lungs',
      'stomaco':'stomach','intestino':'intestine','occhio':'eye','occhi':'eye',
      'orecchio':'ear','mano':'hand','mani':'hand','piede':'foot','piedi':'foot',
      'articolazione':'joint','articolazioni':'joint','movimento':'runner','ricerca':'search',
      'terapia':'pill','farmaco':'pill','virus':'virus','batterio':'microbe',
      'tess. conn.':'network','cute':'skin','linfa':'drop','midollo':'brain',
      'cranio':'skull','colonna':'spine','vertebra':'spine','vertebre':'spine',
      'ossa lunghe':'bone','scheletro':'bone','cervello':'brain','encefalo':'brain',
      'arteria':'blood vessel','vene':'blood vessel','anatomia':'anatomy',
      'malattia':'sick','infezione':'microbe','es.':'light bulb','esempio':'light bulb',
      'respirazione':'lungs','tessuto':'microscope','nucleo':'microscope',
      'mitocondrio':'battery','dna':'dna','rna':'dna','f.ne':'gear',
      'muscoli scheletrici':'muscle','neurone':'brain','membrana':'cell'
    };
    const nm54StopWords=new Set(['il','lo','la','i','gli','le','di','del','della','dei','delle','alla','allo','a','da','e','ed','un','una','uno','in','con','per','tra','fra','dentro','sopra','sotto','che','si','sono','come','tipo','tipi','nel','nella','loro']);
    const nm54TermCache=new Map(),nm54SearchCache=new Map(),nm54SvgCache=new Map();
    function nm54Remember(cache,key,value,limit=90){
      if(cache.size>=limit)cache.delete(cache.keys().next().value);
      cache.set(key,value);return value;
    }
    function nm54Candidate(text){
      const raw=String(text||'').toLowerCase().replace(/[↔→←↗✓•\[\](){};,:!?"'`]/g,' ').replace(/\s+/g,' ').trim();
      if(!raw||raw.length>160) return '';
      if(nm54Dictionary[raw])return nm54Dictionary[raw];
      const words=raw.split(/\s+/).filter(w=>!nm54StopWords.has(w)&&w.length>=2).slice(0,5);
      for(const size of [3,2,1])for(let i=0;i<=words.length-size;i++){
        const part=words.slice(i,i+size).join(' ');if(nm54Dictionary[part])return nm54Dictionary[part];
      }
      return words.slice(0,2).join(' ').replace(/[^a-zà-ÿ0-9 .-]/gi,'').slice(0,80);
    }
    async function nm54API(kind,params){
      if(window.neuromapDesktop?.illustration)return window.neuromapDesktop.illustration({kind,...params});
      const q=String(params.query||'');
      const urls={translate:'https://api.mymemory.translated.net/get?q='+encodeURIComponent(q)+'&langpair=it%7Cen',
        search:'https://api.iconify.design/search?query='+encodeURIComponent(q)+'&prefixes=fluent-emoji-flat,noto&limit=6',
        svg:'https://api.iconify.design/'+params.prefix+'/'+params.name+'.svg'};
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
      try{const r=await fetch(urls[kind],{signal:controller.signal,cache:'no-store'});
        if(!r.ok)throw Error('Servizio illustrazioni HTTP '+r.status);
        const content=await r.text();if(content.length>120000)throw Error('Icona troppo grande');return content;
      }finally{clearTimeout(timer);}
    }
    async function get_iconify_keyword(node_text){
      const raw=nm54Candidate(node_text);if(!raw)return '';
      if(nm54TermCache.has(raw))return nm54TermCache.get(raw);
      if(Object.values(nm54Dictionary).includes(raw))return nm54Remember(nm54TermCache,raw,raw);
      let translated=raw;
      try{
        const data=JSON.parse(await nm54API('translate',{query:raw}));
        const result=String(data.responseData?.translatedText||'').toLowerCase().replace(/[^a-z0-9 -]/g,' ').replace(/\s+/g,' ').trim();
        if(result && !/mymemory|query|error|no translation/i.test(result))translated=result.split(' ').slice(0,2).join(' ');
      }catch(_){/* Unknown words may still have matching Iconify names. */}
      return nm54Remember(nm54TermCache,raw,translated,150);
    }
    async function nm54FindIcons(word){
      const query=String(word||'').trim().toLowerCase().slice(0,80);if(!query)return [];
      if(nm54SearchCache.has(query))return nm54SearchCache.get(query);
      const data=JSON.parse(await nm54API('search',{query}));
      const allowed=new Set(['fluent-emoji-flat','noto']);
      const icons=(Array.isArray(data.icons)?data.icons:[]).map(id=>{
        const colon=id.indexOf(':');return {prefix:id.slice(0,colon),name:id.slice(colon+1),id};
      }).filter(x=>allowed.has(x.prefix)&&/^[\w-]+$/.test(x.name)).slice(0,6);
      return nm54Remember(nm54SearchCache,query,icons,130);
    }
    // SVG sanitizer: only vector primitives and safe rendering attributes.
    // No scripts, event handlers, remote references, foreignObject or embedded HTML.
    function nm54SanitizeSvg(raw){
      if(typeof raw!=='string'||raw.length>90000)throw Error('SVG troppo grande');
      // Reject entity declarations before XML parsing to prevent expansion bombs.
      if(/<!doctype|<!entity|<\?xml-stylesheet/i.test(raw))throw Error('SVG non valido');
      const doc=new DOMParser().parseFromString(raw,'image/svg+xml');
      if(doc.querySelector('parsererror')||doc.documentElement?.localName!=='svg')throw Error('SVG non valido');
      const allowedTags=new Set(['svg','g','path','rect','circle','ellipse','line','polygon','polyline','defs','linearGradient','radialGradient','stop','clipPath','mask','use','title']);
      const allowedAttributes=new Set(['xmlns','viewBox','width','height','fill','fill-opacity','stroke','stroke-width','stroke-linecap','stroke-linejoin','stroke-opacity','opacity','d','x','y','x1','y1','x2','y2','cx','cy','r','rx','ry','points','transform','id','gradientUnits','gradientTransform','offset','stop-color','stop-opacity','clip-path','mask','href','preserveAspectRatio','fill-rule','clip-rule']);
      // Iterative walk avoids call-stack exhaustion on deeply nested imports.
      const pending=[doc.documentElement];
      let checked=0;
      while(pending.length){
        if(++checked>3000)throw Error('SVG troppo complesso');
        const el=pending.pop();
        for(const child of [...el.children]){
          if(!allowedTags.has(child.localName)){child.remove();continue;}
          pending.push(child);
        }
        for(const attr of [...el.attributes]){
          const key=attr.localName,value=attr.value.trim();
          if(!allowedAttributes.has(key)||(/^on/i.test(key))||/javascript:|data:|https?:|@import|expression\s*\(/i.test(value)||
          ((key==='href'||key==='mask'||key==='clip-path')&&!(value.startsWith('#')||/^url\(#[\w-]+\)$/.test(value)))||
          (value.includes('url(')&&!/^url\(#[\w-]+\)$/.test(value))){el.removeAttributeNode(attr);}
        }
      }
      doc.documentElement.setAttribute('xmlns','http://www.w3.org/2000/svg');
      const clean=new XMLSerializer().serializeToString(doc.documentElement);
      if(clean.length>90000)throw Error('SVG troppo grande');
      return clean;
    }
    async function nm54DownloadIcon(icon,keyword){
      const key=icon.prefix+':'+icon.name;
      if(nm54SvgCache.has(key))return {...nm54SvgCache.get(key),keyword};
      const svg=nm54SanitizeSvg(await nm54API('svg',{prefix:icon.prefix,name:icon.name}));
      const item={type:'iconify',prefix:icon.prefix,name:icon.name,svg};
      nm54Remember(nm54SvgCache,key,item,100);
      return {...item,keyword};
    }
