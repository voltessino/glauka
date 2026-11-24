/* Shared background palette for the desktop inspector and Android style panel. */
(function(global) {
  'use strict';
  const THEMES = [
    {id:'night',it:'Notte',en:'Night',color:'#090e1b',ink:'#a99cff'},
    {id:'slate',it:'Ardesia',en:'Slate',color:'#172438',ink:'#9cb8d8'},
    {id:'ocean',it:'Oceano',en:'Ocean',color:'#0a2536',ink:'#72cdd6'},
    {id:'graphite',it:'Grafite',en:'Graphite',color:'#17191f',ink:'#c2c9d8'},
    {id:'midnight',it:'Blu notte',en:'Midnight',color:'#10182e',ink:'#99b5ff'},
    {id:'indigo',it:'Indaco',en:'Indigo',color:'#1d2040',ink:'#b8b2ff'},
    {id:'plum',it:'Prugna',en:'Plum',color:'#291c32',ink:'#d4a9df'},
    {id:'forest',it:'Foresta',en:'Forest',color:'#122a25',ink:'#8dd7b7'},
    {id:'petrol',it:'Petrolio',en:'Teal',color:'#103038',ink:'#86d3dc'},
    {id:'cocoa',it:'Cacao',en:'Cocoa',color:'#2c2321',ink:'#debba1'},
    {id:'charcoal',it:'Carbone',en:'Charcoal',color:'#20252b',ink:'#b9c6d1'},
    {id:'aubergine',it:'Melanzana',en:'Aubergine',color:'#261c2b',ink:'#d7a9cb'},
    {id:'white',it:'Bianco',en:'White',color:'#ffffff',ink:'#6441df',light:true},
    {id:'paper',it:'Carta',en:'Paper',color:'#f4f2ea',ink:'#8a6f54',light:true},
    {id:'pearl',it:'Perla',en:'Pearl',color:'#e9edf4',ink:'#737e9b',light:true},
    {id:'ivory',it:'Avorio',en:'Ivory',color:'#fff9ed',ink:'#8d745b',light:true},
    {id:'linen',it:'Lino',en:'Linen',color:'#eee8dc',ink:'#8d7964',light:true},
    {id:'sand',it:'Sabbia',en:'Sand',color:'#e8dbc5',ink:'#856d4c',light:true},
    {id:'rose',it:'Rosa',en:'Rose',color:'#f6e7ec',ink:'#9d637c',light:true},
    {id:'mist',it:'Nebbia',en:'Mist',color:'#e7edeb',ink:'#607e75',light:true},
    {id:'lavender',it:'Lavanda',en:'Lavender',color:'#ece8f7',ink:'#7f6caa',light:true},
    {id:'ice',it:'Ghiaccio',en:'Ice',color:'#e4f0f7',ink:'#5e819c',light:true},
    {id:'mint',it:'Menta',en:'Mint',color:'#e2f2e9',ink:'#5c8c73',light:true},
    {id:'sage',it:'Salvia',en:'Sage',color:'#e3e8db',ink:'#73835a',light:true},
    {id:'cream',it:'Crema',en:'Cream',color:'#faf0d9',ink:'#947c46',light:true}
  ];
  function addStyles() {
    if(document.getElementById('nm-theme-picker-styles'))return;
    const style=document.createElement('style');style.id='nm-theme-picker-styles';
    style.textContent=`
.nm-theme-picker{margin:8px;padding:14px 10px 10px;flex-shrink:0;border:1px solid rgba(143,156,194,.2);border-radius:16px;background:linear-gradient(140deg,rgba(37,48,78,.7),rgba(16,26,46,.85));color:#edf1fb;box-sizing:border-box;min-width:0}
.nm-theme-heading{display:flex;align-items:center;gap:8px;margin:0 2px 12px;font:600 12px/1.3 Inter,system-ui,sans-serif;letter-spacing:.01em}
.nm-theme-heading svg{width:15px;height:15px;color:#b7a9ed;flex-shrink:0}
.nm-theme-picker .nm-theme-name{max-width:100%;font:500 10px/1.3 Inter,system-ui,sans-serif;white-space:normal;overflow-wrap:normal;text-align:center}.nm-theme-group{grid-column:1/-1;margin:9px 2px 3px;font:600 11px system-ui;color:#afbdd3}.nm-theme-options{display:grid;grid-template-columns:repeat(auto-fit,minmax(56px,1fr));gap:4px}
.nm-theme-picker .nm-theme-option{position:relative;display:flex;flex-direction:column;align-items:center;gap:7px;min-width:0;min-height:61px;margin:0;padding:5px 3px 7px;background:transparent;border:1px solid transparent;border-radius:11px;color:#aebbd3;cursor:pointer;touch-action:manipulation;font:500 10px/1.2 Inter,system-ui,sans-serif;transition:background .16s,border-color .16s,color .16s}
.nm-theme-picker .nm-theme-option:hover{background:rgba(173,156,241,.08);border-color:rgba(172,154,239,.3);color:#f2efff}
.nm-theme-picker .nm-theme-option[aria-checked="true"]{background:rgba(153,126,236,.13);border-color:#aa90ed;color:#f4eeff}
.nm-theme-picker .nm-theme-option:focus-visible{outline:2px solid #c2acff;outline-offset:3px}
.nm-theme-preview{position:relative;display:grid;place-items:center;width:100%;height:31px;border:1px solid rgba(159,174,204,.25);border-radius:8px;background:var(--nm-swatch);color:var(--nm-swatch-ink);box-shadow:inset 0 1px 0 rgba(255,255,255,.06);box-sizing:border-box}
.nm-theme-preview>svg{width:31px;height:27px;opacity:.9}
.nm-theme-check{position:absolute;top:-4px;right:-4px;display:grid;place-items:center;width:15px;height:15px;border-radius:50%;background:#b49af1;color:#172039;box-shadow:0 0 0 2px #1b253d;opacity:0;transform:scale(.65);transition:opacity .16s,transform .16s}
.nm-theme-check svg{width:10px;height:10px}
.nm-theme-option[aria-checked="true"] .nm-theme-check{opacity:1;transform:scale(1)}
.nm-theme-disclosure{min-width:0}
.nm-theme-disclosure>summary{display:flex;align-items:center;gap:10px;cursor:pointer;list-style:none;min-height:42px;
 padding:7px 11px;border:1px solid rgba(166,150,229,.42);border-radius:11px;color:#eef0ff;background:#172441;
 font:600 12px/1.35 Inter,system-ui,sans-serif}
.nm-theme-disclosure>summary::-webkit-details-marker{display:none}
.nm-theme-disclosure>summary:focus-visible{outline:2px solid #c2acff;outline-offset:3px}
.nm-theme-current-color{width:25px;height:25px;flex:0 0 25px;border-radius:7px;border:2px solid #c6b8f1;background:var(--nm-current-bg,#090e1b)}
.nm-theme-current-label{flex:1;min-width:0}
.nm-theme-disclosure>summary::after{content:'⌄';font-size:19px;transition:transform .15s}
.nm-theme-disclosure[open]>summary::after{transform:rotate(180deg)}
.nm-theme-disclosure:not([open])>.nm-theme-options{display:none!important}
.nm-theme-disclosure>.nm-theme-options{padding-top:9px;max-height:min(47vh,340px);overflow-y:auto;overflow-x:hidden;
 grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}
.nm-theme-picker .nm-theme-option{min-height:67px;padding:6px 3px 8px}
.nm-theme-picker .nm-theme-name{font-size:11px;line-height:1.25}

@media(prefers-reduced-motion:reduce){.nm-theme-picker .nm-theme-option,.nm-theme-check{transition:none}}
`;
    document.head.append(style);
  }
  function create({value='night',onChange=()=>{}}={}) {
    addStyles();
    const element=document.createElement('section');element.className='nm-theme-picker nm6-skiptranslate';
    const heading=document.createElement('div');heading.className='nm-theme-heading';
    heading.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="9" cy="9" r="2"/><path d="m4 17 5-5 4 4 3-3 5 5"/></svg><span></span>';
    const disclosure=document.createElement('details');disclosure.className='nm-theme-disclosure';
    disclosure.id='nm-map-background-picker';
    const trigger=document.createElement('summary');trigger.id='nm-map-background-trigger';
    const currentColor=document.createElement('span');currentColor.className='nm-theme-current-color';currentColor.setAttribute('aria-hidden','true');
    const currentLabel=document.createElement('span');currentLabel.className='nm-theme-current-label';
    trigger.append(currentColor,currentLabel);
    disclosure.append(trigger);
    const options=document.createElement('div');options.className='nm-theme-options';options.setAttribute('role','radiogroup');
    disclosure.append(options);
    let selected;
    const groupLabels=[];
    const buttons=THEMES.map((theme,index)=>{
      if(index===0||index===12){const group=document.createElement('span');group.className='nm-theme-group';group.setAttribute('aria-hidden','true');options.append(group);groupLabels.push(group);}
      const button=document.createElement('button');button.type='button';button.className='nm-theme-option';button.dataset.nmTheme=theme.id;button.setAttribute('role','radio');
      button.style.setProperty('--nm-swatch',theme.color);button.style.setProperty('--nm-swatch-ink',theme.ink);
      button.innerHTML='<span class="nm-theme-preview" aria-hidden="true"><svg viewBox="0 0 36 28" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><path d="M9 14h5c5 0 4-7 10-7h4M14 14c5 0 4 7 10 7h4"/><rect x="3" y="10.5" width="9" height="7" rx="3.5" fill="currentColor" stroke="none"/><path d="M27 5h5M27 9h4M27 19h5M27 23h4"/></svg><span class="nm-theme-check"><svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m2.5 6 2.2 2.2 4.8-4.5"/></svg></span></span><span class="nm-theme-name"></span>';
      button.onclick=()=>{setValue(theme.id);onChange(theme.id);if(!element.closest("#gl-settings-center"))disclosure.open=false;};
      options.append(button);return button;
    });
    function setValue(next) {
      selected=THEMES.some(theme=>theme.id===next)?next:'night';
      buttons.forEach(button=>{const active=button.dataset.nmTheme===selected;button.setAttribute('aria-checked',String(active));button.tabIndex=active?0:-1;});
      const selectedTheme=THEMES.find(theme=>theme.id===selected);
      currentColor.style.setProperty('--nm-current-bg',selectedTheme.color);
      const en=document.documentElement.lang==='en';
      currentLabel.textContent=(en?'Background: ':'Sfondo: ')+(en?selectedTheme.en:selectedTheme.it);
      trigger.setAttribute('aria-label',(en?'Choose map background, current: ':'Scegli sfondo della mappa, attuale: ')+(en?selectedTheme.en:selectedTheme.it));
    }
    options.onkeydown=event=>{
      if(event.ctrlKey||event.metaKey||event.altKey)return;
      // Keep widget navigation and activation away from canvas editing shortcuts.
      // Tab/Enter/Space retain their native button behavior.
      event.stopPropagation();
      const i=THEMES.findIndex(theme=>theme.id===selected);let next;
      if(event.key==='ArrowRight'||event.key==='ArrowDown')next=(i+1)%THEMES.length;
      else if(event.key==='ArrowLeft'||event.key==='ArrowUp')next=(i+THEMES.length-1)%THEMES.length;
      else if(event.key==='Home')next=0;
      else if(event.key==='End')next=THEMES.length-1;
      else return;
      event.preventDefault();
      // Arrow navigation must keep the disclosure open so the focused radio stays visible.
      setValue(THEMES[next].id);onChange(THEMES[next].id);buttons[next].focus();
    };
    function translate() {
      const language=document.documentElement.lang==='en'?'en':'it';
      const title=(globalThis.GlaukaI18n?.pair("Sfondo mappa","Map background")??(language==='en'?'Map background':'Sfondo mappa'));
      groupLabels[0].textContent=(globalThis.GlaukaI18n?.pair("Sfondi scuri","Dark backgrounds")??(language==='en'?'Dark backgrounds':'Sfondi scuri'));groupLabels[1].textContent=(globalThis.GlaukaI18n?.pair("Sfondi chiari","Light backgrounds")??(language==='en'?'Light backgrounds':'Sfondi chiari'));
      heading.querySelector('span').textContent=title;options.setAttribute('aria-label',title);
      const active=THEMES.find(theme=>theme.id===selected)||THEMES[0];
      currentLabel.textContent=(language==='en'?'Background: ':'Sfondo: ')+active[language];
      trigger.setAttribute('aria-label',(language==='en'?'Choose map background, current: ':'Scegli sfondo della mappa, attuale: ')+active[language]);
      buttons.forEach((button,i)=>{const label=THEMES[i][language];button.querySelector('.nm-theme-name').textContent=label;button.setAttribute('aria-label',label);});
    }
    const localeObserver=new MutationObserver(translate);localeObserver.observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
    element.append(heading,disclosure);setValue(value);translate();
    return {element,setValue,destroy(){localeObserver.disconnect();element.remove();}};
  }
  global.NeuroMapThemePicker=Object.freeze({create,themes:Object.freeze(Object.fromEntries(THEMES.map(t=>[t.id,Object.freeze({...t,light:!!t.light})])))});
})(globalThis);
