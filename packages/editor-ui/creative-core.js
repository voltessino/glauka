/* Serializable, offline drawing primitives. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.NeuroMapCreativeCore = api;
})(globalThis, function () {
  "use strict";
  const esc = (s) =>
    String(s).replace(
      /[<>&"']/g,
      (c) =>
        ({
          "<": "&lt;",
          ">": "&gt;",
          "&": "&amp;",
          '"': "&quot;",
          "'": "&apos;",
        })[c],
    );
  const num = (n, f = 0) =>
    Number.isFinite(+n) ? Math.max(-50000, Math.min(50000, +n)) : f;
  function url(text) {
    if (typeof text !== "string") return "";
    const match =
      text.match(/https?:\/\/[^\s<>"\u0000-\u001f]+/i) ||
      text.match(/\bwww\.[^\s<>"\u0000-\u001f]+/i);
    if (!match) return "";
    let raw = match[0].replace(/[.,;!?]+$/, "");
    while (
      raw.endsWith(")") &&
      (raw.match(/\)/g) || []).length > (raw.match(/\(/g) || []).length
    )
      raw = raw.slice(0, -1);
    try {
      const u = new URL(/^www\./i.test(raw) ? "https://" + raw : raw);
      return ["http:", "https:"].includes(u.protocol) &&
        u.hostname &&
        !u.username &&
        !u.password &&
        raw.length <= 8192
        ? u.href
        : "";
    } catch {
      return "";
    }
  }

  const CHART_TYPES=Object.freeze(['column','column-stacked','bar','bar-stacked','line','area','pie','donut','scatter','bubble','radar','combo']);
  const WORDART_TYPES=Object.freeze(['classic','outline','shadow','neon','gradient','metal','retro','glow']);
  const CHART_PALETTE=['#6366f1','#06b6d4','#f97316','#22c55e','#ec4899','#eab308','#a78bfa','#14b8a6'];
  const validHex=(x,defaultColor)=>/^#[0-9a-f]{6}$/i.test(x||'')?x:defaultColor;
  const safeNum=(v,fallback=0)=>Number.isFinite(Number(v))?Math.max(-1e9,Math.min(1e9,Number(v))):fallback;
  function chartModel(raw){
    const labels=(Array.isArray(raw.categories)?raw.categories:[]).slice(0,60).map(x=>String(x??'').slice(0,64));
    const categories=labels.length?labels:['A','B','C'];
    const source=Array.isArray(raw.series)?raw.series:[];
    const series=source.slice(0,8).map((row,i)=>({
      name:String(row?.name||'Serie '+(i+1)).slice(0,64),
      color:validHex(row?.color,CHART_PALETTE[i]),
      values:categories.map((_,j)=>safeNum(row?.values?.[j])),
      sizes:categories.map((_,j)=>Math.max(0,safeNum(row?.sizes?.[j],Math.abs(safeNum(row?.values?.[j])))))
    }));
    return {kind:'chart',type:CHART_TYPES.includes(raw.type)?raw.type:'column',
      title:String(raw.title||'Grafico').slice(0,120),
      width:Math.max(320,Math.min(1200,safeNum(raw.width,640))),
      height:Math.max(220,Math.min(900,safeNum(raw.height,390))),
      categories,series:series.length?series:[{name:'Serie 1',color:CHART_PALETTE[0],values:categories.map((_,i)=>[5,8,3][i%3]),sizes:categories.map((_,i)=>[5,8,3][i%3])}]
    };
  }

  // Parse pasted CSV/TSV without converting invalid factual data to zeros.
  function chartNumber(value){
    let t=String(value??'').trim().replace(/\u00a0/g,'').replace(/ /g,'');
    if(!t)return 0;
    if(/^[-+]?\d{1,3}(?:\.\d{3})+,\d+$/.test(t))t=t.replace(/\./g,'').replace(',','.');
    else if(/^[-+]?\d{1,3}(?:,\d{3})+\.\d+$/.test(t))t=t.replace(/,/g,'');
    else if(t.includes(',')&&!t.includes('.'))t=t.replace(',','.');
    if(!/^[-+]?(?:(?:\d+\.?\d*)|(?:\.\d+))(?:[eE][-+]?\d+)?$/.test(t))return null;
    const n=Number(t);return Number.isFinite(n)&&Math.abs(n)<=1e9?n:null;
  }
  function parseChartTable(input){
    const raw=String(input??'').replace(/^\uFEFF/,'').slice(0,200000);
    if(!raw.trim())return {ok:false,reason:'empty'};
    let head='',q=false;
    for(const c of raw){if(c==='"')q=!q;else if(!q&&(c==='\n'||c==='\r'))break;else if(!q)head+=c}
    const delimiter=head.includes('\t')?'\t':head.includes(';')?';':',';
    const records=[];let row=[],cell='',quoted=false;
    const flushCell=()=>{row.push(cell.trim());cell=''};
    const flushRow=()=>{flushCell();if(row.some(x=>x!==''))records.push(row);row=[]};
    for(let i=0;i<raw.length;i++){
      const c=raw[i];
      if(c==='"'){if(quoted&&raw[i+1]==='"'){cell+='"';i++}else quoted=!quoted}
      else if(!quoted&&c===delimiter)flushCell();
      else if(!quoted&&(c==='\n'||c==='\r')){if(c==='\r'&&raw[i+1]==='\n')i++;flushRow();if(records.length>61)break}
      else cell+=c;
    }
    if(quoted)return {ok:false,reason:'quotes'};
    if(cell||row.length)flushRow();
    if(records.length<2||records[0].length<2)return {ok:false,reason:'headers'};
    const names=records[0].slice(1,9).map((x,i)=>String(x||'Serie '+(i+1)).slice(0,64));
    const series=names.map((name,i)=>({name,color:CHART_PALETTE[i],values:[]}));
    const categories=[],truncated=records.length>61||records[0].length>9;
    for(let i=1;i<Math.min(records.length,61);i++){
      const r=records[i];if(!r[0])return {ok:false,reason:'category',row:i+1};
      categories.push(r[0].slice(0,64));
      for(let j=0;j<series.length;j++){
        const n=chartNumber(r[j+1]);
        if(n===null)return {ok:false,reason:'number',row:i+1,column:j+2};
        series[j].values.push(n);
      }
    }
    return categories.length?{ok:true,categories,series,truncated}:{ok:false,reason:'empty'};
  }


  // Find empty space for large graphics, without changing any logical node.
  // Rectangles are world coordinates; results are deterministic and pure.
  function suggestGraphicPlacement(raw={}){
    const a=raw.anchor||{},w=Math.max(20,Math.min(1400,safeNum(raw.width,640))),
      h=Math.max(20,Math.min(1000,safeNum(raw.height,390)));
    const x=safeNum(a.x),y=safeNum(a.y),side=a.side==='left'?-1:1,padding=24;
    const stepX=w/2+Math.max(0,safeNum(a.width,100))/2+padding;
    const stepY=h/2+Math.max(0,safeNum(a.height,40))/2+padding;
    const obstacles=(Array.isArray(raw.obstacles)?raw.obstacles:[]).filter(o=>
      o&&Number.isFinite(o.x)&&Number.isFinite(o.y)&&Number.isFinite(o.w)&&Number.isFinite(o.h)
      &&o.w>0&&o.h>0);
    const hits=(cx,cy)=>{
      const left=cx-w/2-padding,right=cx+w/2+padding,
        top=cy-h/2-padding,bottom=cy+h/2+padding;
      let count=0;
      for(const o of obstacles){
        if(left<o.x+o.w&&right>o.x&&top<o.y+o.h&&bottom>o.y)count++;
      }
      return count;
    };
    const choices=[];
    if(raw.allowCenter)choices.push([0,0]);
    for(let k=1;k<=7;k++){
      choices.push([side*stepX*k,0],[side*stepX*k,-stepY],[side*stepX*k,stepY],
        [0,-stepY*k],[0,stepY*k],[-side*stepX*k,0]);
    }
    let best=null;
    for(const [dx,dy] of choices){
      const cx=x+dx,cy=y+dy,count=hits(cx,cy),distance=Math.hypot(dx,dy);
      if(!count)return {x:cx,y:cy,collisions:0};
      if(!best||count<best.collisions||(count===best.collisions&&distance<best.distance))
        best={x:cx,y:cy,collisions:count,distance};
    }
    if(!obstacles.length)return {x,y,collisions:0};
    let minX=Infinity,maxX=-Infinity;
    for(const o of obstacles){minX=Math.min(minX,o.x);maxX=Math.max(maxX,o.x+o.w);}
    const edgeX=side>0?maxX+w/2+padding:minX-w/2-padding;
    const fallback={x:edgeX,y,collisions:hits(edgeX,y)};
    return !best||fallback.collisions<best.collisions?fallback:
      {x:best.x,y:best.y,collisions:best.collisions};
  }

  function wordArtModel(raw){
    return {kind:'wordart',text:String(raw.text??'Titolo creativo').slice(0,250),
      style:WORDART_TYPES.includes(raw.style)?raw.style:'classic',
      color:validHex(raw.color,'#818cf8'),outline:validHex(raw.outline,'#1e1b4b'),
      width:Math.max(170,Math.min(1200,safeNum(raw.width,480))),
      height:Math.max(70,Math.min(500,safeNum(raw.height,142)))};
  }

  function graphic(raw, depth = 0) {
    if (!raw || typeof raw !== "object" || depth > 8) return null;
    if(raw.kind === 'chart')return chartModel(raw);
    if(raw.kind === 'wordart')return wordArtModel(raw);
    if (raw.kind === "formula")
      return {
        kind: "formula",
        tex: String(raw.tex || "").slice(0, 4000),
        color: /^#[\da-f]{6}$/i.test(raw.color) ? raw.color : "#e2e8f0",
      };
    if (raw.kind === "group")
      return {
        kind: "group",
        members: (Array.isArray(raw.members) ? raw.members : [])
          .slice(0, 100)
          .map((im) => ({ ...im, graphic: graphic(im.graphic, depth + 1) }))
          .filter((im) => im.graphic),
      };
    if (raw.kind !== "shape") return null;
    return {
      kind: "shape",
      tool: [
        "pen",
        "highlight",
        "rect",
        "ellipse",
        "line",
        "arrow",
        "text",
        "roundrect",
        "circle",
        "diamond",
        "triangle",
        "hexagon",
        "parallelogram",
        "pill",
        "cloud",
        "speech",
        "star",
        "double-arrow",
        "dashed",
        "curve",
        "elbow",
      ].includes(raw.tool)
        ? raw.tool
        : "pen",
      color: /^#[\da-f]{6}$/i.test(raw.color) ? raw.color : "#38bdf8",
      fill: /^#[\da-f]{6}$/i.test(raw.fill) ? raw.fill : "none",
      stroke: Math.max(1, Math.min(40, num(raw.stroke, 3))),
      text: String(raw.text || "").slice(0, 500),
      width: Math.max(10, num(raw.width, 160)),
      height: Math.max(10, num(raw.height, 90)),
      points: (Array.isArray(raw.points) ? raw.points : [])
        .slice(0, 4000)
        .map((p) => [num(p?.[0]), num(p?.[1])]),
    };
  }
  function shapeSVG(raw) {
    const g = graphic(raw);
    if (!g || g.kind !== "shape") throw Error("Invalid shape");
    const { width: w, height: h, stroke: s, color: c } = g,
      p = 4 + s / 2;
    let body = "";
    const style = `stroke="${c}" stroke-width="${s}" fill="${g.fill}" stroke-linejoin="round" stroke-linecap="round"`;
    const polygon=points=>'<polygon points="'+points.map(pt=>pt.join(',')).join(' ')+'" '+style+'/>';
    const minX=p,maxX=w-p,minY=p,maxY=h-p,cx=w/2,cy=h/2;
    const polyStyles={
      diamond:[[cx,minY],[maxX,cy],[cx,maxY],[minX,cy]],
      triangle:[[cx,minY],[maxX,maxY],[minX,maxY]],
      hexagon:[[minX+(maxX-minX)*.25,minY],[minX+(maxX-minX)*.75,minY],[maxX,cy],
        [minX+(maxX-minX)*.75,maxY],[minX+(maxX-minX)*.25,maxY],[minX,cy]],
      parallelogram:[[minX+(maxX-minX)*.24,minY],[maxX,minY],
        [maxX-(maxX-minX)*.24,maxY],[minX,maxY]]
    };
    if(g.tool==="ellipse"||g.tool==="circle"){
      const r=Math.max(1,Math.min(w,h)/2-p);
      body='<ellipse cx="'+cx+'" cy="'+cy+'" rx="'+(g.tool==="circle"?r:Math.max(1,w/2-p))+
        '" ry="'+(g.tool==="circle"?r:Math.max(1,h/2-p))+'" '+style+'/>';
    }else if(g.tool==="rect"||g.tool==="roundrect"||g.tool==="pill"){
      const radius=g.tool==="pill"?Math.max(0,(h-2*p)/2):
        g.tool==="roundrect"?Math.min(22,(h-2*p)*.35):8;
      body='<rect x="'+minX+'" y="'+minY+'" width="'+Math.max(1,w-2*p)+
        '" height="'+Math.max(1,h-2*p)+'" rx="'+radius+'" '+style+'/>';
    }else if(polyStyles[g.tool]){
      body=polygon(polyStyles[g.tool]);
    }else if(g.tool==="star"){
      const outer=Math.min(w*.45,h*.45)-p/2,inner=outer*.44,vertices=[];
      for(let i=0;i<10;i++){const angle=-Math.PI/2+i*Math.PI/5,r=i%2?inner:outer;
        vertices.push([+(cx+r*Math.cos(angle)).toFixed(3),+(cy+r*Math.sin(angle)).toFixed(3)])}
      body=polygon(vertices);
    }else if(g.tool==="cloud"||g.tool==="speech"){
      const x=w-2*p,y=h-2*p;
      const d=g.tool==="cloud"?
        'M12 40 C-1 40 -1 23 13 20 C10 3 32 -1 42 10 C60 -2 75 9 75 22 C99 16 110 43 92 48 H18 C11 48 8 45 12 40 Z':
        'M4 4 H96 Q100 4 100 9 V46 Q100 52 93 52 H53 L35 67 V52 H7 Q0 52 0 45 V11 Q0 4 4 4 Z';
      body='<path d="'+d+'" transform="translate('+p+' '+p+') scale('+(x/108)+' '+(y/70)+')" '+style+'/>';
    }else if(g.tool!=="text"){
      const points=g.points.length?g.points:[[p,h/2],[w-p,h/2]];
      const pointText=points.map(v=>v.join(",")).join(" ");
      const isCurve=g.tool==="curve",isElbow=g.tool==="elbow";
      if(isCurve)body='<path d="M '+p+' '+(h*.7)+' Q '+cx+' '+(h*.05)+' '+(w-p)+' '+(h*.3)+
        '" fill="none" stroke="'+c+'" stroke-width="'+s+'" stroke-linecap="round"/>';
      else if(isElbow)body='<path d="M '+p+' '+(h*.72)+' H '+cx+
        ' Q '+(cx+10)+' '+(h*.72)+' '+(cx+10)+' '+(h*.5)+
        ' V '+(h*.35)+' Q '+(cx+10)+' '+(h*.22)+' '+(cx+20)+' '+(h*.22)+
        ' H '+(w-p)+'" fill="none" stroke="'+c+'" stroke-width="'+s+
        '" stroke-linecap="round" stroke-linejoin="round"/>';
      else body='<polyline points="'+pointText+'" stroke="'+c+'" stroke-width="'+
        (g.tool==="highlight"?Math.max(14,s):s)+'" fill="none" stroke-linecap="round" stroke-linejoin="round"'+
        (g.tool==="highlight"?' opacity=".32"':g.tool==="dashed"?' stroke-dasharray="9 6"':'')+'/>';
      if((g.tool==="arrow"||g.tool==="double-arrow")&&points.length>1){
        const tip=(a,b)=>{
          const angle=Math.atan2(b[1]-a[1],b[0]-a[0]),len=Math.max(12,s*4);
          const v=t=>[b[0]-len*Math.cos(angle+t),b[1]-len*Math.sin(angle+t)].join(",");
          return '<polygon points="'+b.join(",")+' '+v(-.5)+' '+v(.5)+'" fill="'+c+'"/>';
        };
        body+=tip(points.at(-2),points.at(-1));
        if(g.tool==="double-arrow")body+=tip(points[1],points[0]);
      }
    }
    if (g.text) {
      const lines = g.text.split("\n").slice(0, 15),
        font = Math.min(
          24,
          Math.max(10, (h - 16) / Math.max(1, lines.length) / 1.3),
        );
      body += `<text x="${w / 2}" y="${h / 2 - (lines.length - 1) * font * 0.65}" text-anchor="middle" dominant-baseline="middle" font-family="Arial,sans-serif" font-size="${font}" fill="${c}">${lines.map((line, i) => `<tspan x="${w / 2}" dy="${i ? font * 1.3 : 0}">${esc(line)}</tspan>`).join("")}</text>`;
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;
  }


  function chartSVG(raw){
    const m=chartModel(raw),w=m.width,h=m.height,n=m.categories.length;
    const text=(x,y,v,size=12,align='middle')=>'<text x="'+x+'" y="'+y+'" fill="#dce7fb" font-family="Arial,sans-serif" font-size="'+size+'" text-anchor="'+align+'">'+esc(v)+'</text>';
    const path=(d,color,fill='none',strokeWidth=2)=>'<path d="'+d+'" fill="'+fill+'" stroke="'+color+'" stroke-width="'+strokeWidth+'" stroke-linecap="round" stroke-linejoin="round"/>';
    const rect=(x,y,a,b,color,r=0)=>'<rect x="'+x+'" y="'+y+'" width="'+Math.max(0,a)+'" height="'+Math.max(0,b)+'" rx="'+r+'" fill="'+color+'"/>';
    const circle=(x,y,r,color)=>'<circle cx="'+x+'" cy="'+y+'" r="'+r+'" fill="'+color+'"/>';
    let body=rect(0,0,w,h,'#101b35',14)+text(w/2,31,m.title,20);
    const left=65,top=56,pw=w-99,ph=h-119,bottom=top+ph;
    const series=m.series;
    const values=series.flatMap(s=>s.values),min=Math.min(0,...values),highest=Math.max(0,...values);
    const stackedMax=Math.max(highest,...m.categories.map((_,i)=>series.reduce((sum,item)=>sum+Math.max(0,item.values[i]),0)));
    const max=Math.max(1,m.type.endsWith('stacked')?stackedMax:highest),span=max-min||1;
    const yy=v=>bottom-(v-min)/span*ph,xx=i=>left+(i+.5)*pw/n;
    const categoryX=m.categories.map(v=>chartNumber(v));
    const numericX=['scatter','bubble'].includes(m.type)
      &&categoryX.every(v=>v!==null)
      &&new Set(categoryX).size>1;
    const minX=numericX?Math.min(...categoryX):0,maxX=numericX?Math.max(...categoryX):1;
    const xPoint=i=>numericX?left+((categoryX[i]-minX)/(maxX-minX))*pw:xx(i);
    const maxBubbleSize=Math.max(1,...series.flatMap(s=>s.sizes||[]));
    if(['pie','donut'].includes(m.type)){
      const amounts=series[0].values.map(x=>Math.max(0,x)),total=amounts.reduce((a,b)=>a+b,0);
      const cx=w*.41,cy=h*.52,r=Math.min(w*.30,h*.31);
      let angle=-Math.PI/2;
      if(total>0)amounts.forEach((amount,i)=>{
        const d=amount/total*Math.PI*2;if(d<=0)return;
        // Divide large arcs to keep SVG paths portable and avoid a full-circle degeneracy.
        const parts=Math.max(2,Math.ceil(d/(Math.PI/2)));
        let points=[];for(let j=0;j<=parts;j++){const a=angle+d*j/parts;points.push([cx+r*Math.cos(a),cy+r*Math.sin(a)])}
        body+=path('M '+cx+' '+cy+' L '+points.map(p=>p.join(' ')).join(' L ')+' Z',CHART_PALETTE[i%8],CHART_PALETTE[i%8],0);
        angle+=d;
      });
      if(m.type==='donut')body+=circle(cx,cy,r*.52,'#101b35');
      if(!total)body+=text(cx,cy,'Nessun dato',13);
      m.categories.slice(0,12).forEach((name,i)=>{const y=75+i*21;if(y<h-16){body+=rect(w*.73,y-11,11,11,CHART_PALETTE[i%8],2)+text(w*.73+16,y,name.slice(0,18),11,'start')}});
    }else if(m.type==='radar'){
      const cx=w*.51,cy=h*.54,r=Math.min(pw*.34,ph*.43),alpha=i=>-Math.PI/2+2*Math.PI*i/n;
      for(let level=1;level<=4;level++)body+=path('M '+Array.from({length:n},(_,i)=>[cx+Math.cos(alpha(i))*r*level/4,cy+Math.sin(alpha(i))*r*level/4].join(' ')).join(' L ')+' Z','#384765','none',1);
      m.categories.forEach((name,i)=>body+=text(cx+Math.cos(alpha(i))*(r+17),cy+Math.sin(alpha(i))*(r+17),name.slice(0,11),10));
      series.forEach(item=>body+=path('M '+item.values.map((v,i)=>[cx+Math.cos(alpha(i))*r*Math.max(0,v)/max,cy+Math.sin(alpha(i))*r*Math.max(0,v)/max].join(' ')).join(' L ')+' Z',item.color,item.color,2));
    }else{
      for(let k=0;k<=4;k++){const y=top+ph*k/4;body+=path('M '+left+' '+y+' H '+(left+pw),'#32415d','none',1)+text(left-8,y+4,Number((max-span*k/4).toFixed(1)),10,'end')}
      if(m.type==='bar'||m.type==='bar-stacked'){
        const row=ph/n,stacked=m.type==='bar-stacked';
        m.categories.forEach((name,i)=>body+=text(left-8,top+(i+.5)*row+3,name.slice(0,11),10,'end'));
        series.forEach((item,si)=>item.values.forEach((v,i)=>{
          const before=stacked?series.slice(0,si).reduce((a,s)=>a+Math.max(0,s.values[i]),0):0;
          const x=left+(Math.min(before,before+v)-min)/span*pw,y=top+i*row+row*(stacked?.20:(.12+si*.75/series.length));
          const bh=row*(stacked?.60:.75/series.length);
          body+=rect(x,y,Math.max(1,Math.abs(v)/span*pw),bh,item.color,2);
        }));
      }else{
        const cw=pw/n,barWidth=cw*.73,stacked=m.type==='column-stacked';
        if(['column','column-stacked','combo'].includes(m.type))series.forEach((item,si)=>{
          if(m.type==='combo'&&si>0)return;
          item.values.forEach((v,i)=>{
            const before=stacked?series.slice(0,si).reduce((a,s)=>a+Math.max(0,s.values[i]),0):0;
            const width=stacked||m.type==='combo'?barWidth:barWidth/series.length;
            const x=left+i*cw+(cw-barWidth)/2+(stacked||m.type==='combo'?0:si*width);
            const y0=yy(before),y1=yy(before+v);
            body+=rect(x,Math.min(y0,y1),width*.92,Math.max(1,Math.abs(y1-y0)),item.color,2);
          });
        });
        if(['line','area','scatter','bubble','combo'].includes(m.type))series.forEach((item,si)=>{
          if(m.type==='combo'&&si===0)return;
          const points=item.values.map((v,i)=>[['scatter','bubble'].includes(m.type)?xPoint(i):xx(i),yy(v)]);
          if(['line','area','combo'].includes(m.type)){
            const d='M '+points.map(p=>p.join(' ')).join(' L ')+(m.type==='area'?' L '+points.at(-1)[0]+' '+yy(0)+' L '+points[0][0]+' '+yy(0)+' Z':'');
            body+=path(d,item.color,m.type==='area'?item.color:'none',m.type==='area'?1:2.5);
          }
          points.forEach(([x,y],i)=>body+=circle(x,y,m.type==='bubble'?3+Math.sqrt(Math.max(0,item.sizes?.[i]||0)/maxBubbleSize)*12:3.2,item.color));
        });
        m.categories.forEach((value,i)=>{if(n<=22||i%Math.ceil(n/22)===0)body+=text(['scatter','bubble'].includes(m.type)?xPoint(i):xx(i),bottom+17,value.slice(0,11),10)});
      }
    }
    if(series.length<=6)series.forEach((item,i)=>{const x=18+i*(w-36)/series.length;body+=rect(x,h-27,9,9,item.color,2)+text(x+14,h-19,item.name.slice(0,13),11,'start')});
    return '<svg xmlns="http://www.w3.org/2000/svg" width="'+w+'" height="'+h+'" viewBox="0 0 '+w+' '+h+'">'+body+'</svg>';
  }
  function wordArtSVG(raw){
    const a=wordArtModel(raw),w=a.width,h=a.height,sz=Math.min(74,Math.max(20,w/(a.text.length*.65+1)));
    const variants={
      classic:[a.color,a.outline,2],outline:['none',a.color,3],shadow:[a.color,a.outline,1.5],
      neon:[a.color,'#f5f3ff',1.5],gradient:['url(#art-grad)',a.outline,1.5],
      metal:['url(#art-grad)','#475569',2.5],retro:['#fbbf24','#7c2d12',4],glow:[a.color,'#ddd6fe',2]
    },[fill,stroke,sw]=variants[a.style],y=h/2+sz*.3;
    const t=(x,dy,c,outline,strokeW)=>'<text x="'+x+'" y="'+dy+'" text-anchor="middle" font-family="Arial,sans-serif" font-weight="900" font-size="'+sz+'" fill="'+c+'" stroke="'+outline+'" stroke-width="'+strokeW+'" paint-order="stroke fill" stroke-linejoin="round" textLength="'+Math.max(50,w-26)+'" lengthAdjust="spacingAndGlyphs">'+esc(a.text)+'</text>';
    const defs='<defs><linearGradient id="art-grad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="'+(a.style==='metal'?'#f8fafc':a.color)+'"/><stop offset="1" stop-color="'+(a.style==='metal'?'#64748b':'#ec4899')+'"/></linearGradient></defs>';
    const cast=['shadow','neon','retro','glow'].includes(a.style)?t(w/2+4,y+5,'#030712','#030712',3):'';
    return '<svg xmlns="http://www.w3.org/2000/svg" width="'+w+'" height="'+h+'" viewBox="0 0 '+w+' '+h+'">'+defs+cast+t(w/2,y,fill,stroke,sw)+'</svg>';
  }

  // Separate verified CC0 pack: loaded before this module by prepare.py.
  // Node tests resolve the same file directly, with no external resources.
  const galleryPack=globalThis.GlaukaObjectGalleryPack||
    (typeof require==='function' ? require('./object-gallery-healthicons.js') :
      {ITEMS:[],body:()=>''});
  // The built-in catalogue is finite, curated and fully offline. Every asset
/* @neuromap-creative-core-objects */
  return { url, graphic, shapeSVG, chartSVG, wordArtSVG, chartNumber, parseChartTable, suggestGraphicPlacement, CHART_TYPES, WORDART_TYPES, esc, OBJECTS, objectArt, objectSVG,
    objectURL, objectGeometry, paintObject, svgObject, svgObjectDef };


});
