'use strict';
const composeStateSource=require('./helpers/compose-state-source.cjs');
const composeUiSource=require('./helpers/compose-ui-source.cjs');

const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const core=require('./helpers/compose-creative-core.cjs')();
const source=p=>fs.readFileSync(path.resolve(__dirname,'../../../',p),'utf8');

test('twelve vector chart formats support editable, bounded numeric models',()=>{
 assert.equal(core.CHART_TYPES.length,12);
 for(const type of core.CHART_TYPES){
  const raw={kind:'chart',type,title:'Trend <A&B>',width:650,height:390,
    categories:['Jan','Feb','Mar'],series:[{name:'Volume',values:[20,-4,9]},{name:'Budget',values:[11,5,20]}]};
  const meta=core.graphic(raw),copy=core.graphic(JSON.parse(JSON.stringify(meta)));
  assert.deepEqual(copy,meta,'save/reload must preserve chart data: '+type);
  assert.equal(meta.type,type);
  const svg=core.chartSVG(meta);
  assert.match(svg,/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg"/);
  assert.ok(svg.includes('Trend &lt;A&amp;B&gt;'));
  assert.doesNotMatch(svg,/<script\b/i);
  assert.ok(svg.length>300,type);
 }
});
test('chart data validation rejects non-finite numbers and caps sizes',()=>{
 const chart=core.graphic({kind:'chart',type:'invalid',title:'<script>alert(1)</script>',width:Infinity,height:900000,
  categories:Array.from({length:100},(_,i)=>'Group '+i),
  series:Array.from({length:20},(_,i)=>({name:'S'+i,values:[Infinity,-Infinity,NaN,7]}))});
 assert.equal(chart.type,'column');
 assert.equal(chart.categories.length,60);
 assert.equal(chart.series.length,8);
 assert.equal(chart.width,640);
 assert.equal(chart.height,900);
 assert.ok(chart.series.every(s=>s.values.every(Number.isFinite)));
 assert.doesNotMatch(core.chartSVG(chart),/<script>/i);
});
test('eight WordArt styles survive round trips and escape user text',()=>{
 assert.equal(core.WORDART_TYPES.length,8);
 for(const style of core.WORDART_TYPES){
  const input={kind:'wordart',text:'Hi <script> & "friends"',style,color:'#123abc',outline:'#abcdef'};
  const value=core.graphic(input),svg=core.wordArtSVG(value);
  assert.equal(value.style,style);
  assert.deepEqual(core.graphic(JSON.parse(JSON.stringify(value))),value);
  assert.match(svg,/^<svg xmlns=/);
  assert.doesNotMatch(svg,/<script>/);
  assert.match(svg,/&lt;script&gt;/);
 }
});
test('ink toolbar connects to the existing canvas drawing engine and preserves highlighted text',()=>{
 const layout=composeUiSource('workspace-layout');
 const drawing=composeUiSource('creative-drawing');
 const state=source('apps/desktop-shared/editor/state.js');
 const canvas=source('apps/desktop-shared/editor/renderer.js');
 const exportSVG=source('apps/desktop-shared/editor/io.js');
 for(const id of ['select','lasso','eraser','pen','pencil','highlight'])
  assert.ok(layout.includes("'"+id+"'"),id);
 for(const id of ['lasso','eraser','pencil'])
  assert.ok(drawing.includes('"'+id+'"')||drawing.includes("'"+id+"'"),id);
 assert.match(drawing,/lasso:\s*"<svg/);
 assert.match(drawing,/Lazo: seleziona più immagini/);
 assert.match(state,/fontHighlight/);
 assert.match(canvas,/ctx\.fillRect\(hx-2,y-lineH/);
 assert.match(exportSVG,/fill-opacity="\.54"/);
});
test('chart and WordArt launchers use native graphic persistence and edit handlers',()=>{
 const layout=composeUiSource('workspace-layout');
 const drawing=composeUiSource('creative-drawing');
 const tools=composeUiSource('creative-tools');
 for(const id of ['nm-insert-chart','nm-insert-wordart','nm-shapes-picker'])
  assert.ok(layout.includes(id),id);
 for(const feature of ['chartDialog','wordArtDialog','setGraphicPlacement'])
  assert.ok(drawing.includes(feature),feature);
 assert.match(tools,/State\.cloneImages\s*=\s*function/);
 assert.match(tools,/State\.prototype\.addImageItem\s*=\s*function/);
});


test('CSV/TSV import keeps Italian decimals and quoted headings',()=>{
 const examples=[
  ['Categoria\tA\tB\nGen\t1,23\t3\nFeb\t4\t5',2,1.23],
  ['Categoria;A;B\n"Età; 18-30";1.234,56;2\nTotale;3;4',2,1234.56],
  ['Categoria,A\n"Sezione, speciale",1.5\nB,2.5',2,1.5]
 ];
 for(const [source,rows,first] of examples){
  const result=core.parseChartTable(source);
  assert.equal(result.ok,true,JSON.stringify(result));
  assert.equal(result.categories.length,rows);
  assert.equal(result.series[0].values[0],first);
  const roundTrip=core.graphic({kind:'chart',...result,type:'column'});
  assert.deepEqual(roundTrip.series[0].values,result.series[0].values);
 }
});
test('bad CSV values do not silently become zero',()=>{
 for(const raw of ['Categoria;A\nGen;testo','Categoria;A\nGen;1e999','Categoria;A\nGen;12kg']){
  const result=core.parseChartTable(raw);
  assert.equal(result.ok,false);
  assert.equal(result.reason,'number');
  assert.equal(result.row,2);
  assert.equal(result.column,2);
 }
 assert.equal(core.chartNumber('-1,75'),-1.75);
 assert.equal(core.chartNumber('1.234,56'),1234.56);
 assert.equal(core.chartNumber(''),0);
});
test('WordArt empty fields stay empty so the editor can reject a blank title',()=>{
 const meta=core.graphic({kind:'wordart',text:''});
 assert.equal(meta.text,'');
 assert.ok(core.wordArtSVG(meta).startsWith('<svg'));
});


test('scatter uses numeric X spacing; bubbles retain a third, independently editable value',()=>{
 const graphic={kind:'chart',type:'bubble',categories:['0','10','100'],
  series:[{name:'Serie',values:[9,20,30],sizes:[1,20,100]}]};
 const chart=core.graphic(graphic);
 assert.deepEqual(chart.series[0].sizes,[1,20,100]);
 assert.deepEqual(core.graphic(JSON.parse(JSON.stringify(chart))),chart);
 const scatter=core.chartSVG({...chart,type:'scatter'});
 const points=[...scatter.matchAll(/<circle cx="([\d.]+)" cy="([\d.]+)" r="3\.2"/g)].map(match=>Number(match[1]));
 assert.equal(points.length,3);
 assert.ok(points[1]-points[0]<points[2]-points[1]);
 const bubble=core.chartSVG(chart);
 const radii=[...bubble.matchAll(/<circle cx="[\d.]+" cy="[\d.]+" r="([\d.]+)"/g)].map(match=>Number(match[1]));
 assert.equal(radii.length,3);
 assert.ok(radii[0]<radii[1]&&radii[1]<radii[2]);
});
