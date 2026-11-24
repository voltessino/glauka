'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
new Function(require('./helpers/compose-graphics.cjs')())();
function fixture(count=1){
 const root={id:'r',text:'Root',side:'root',children:[]},metrics=new Map();let node=root;
 for(let i=0;i<count;i++){metrics.set(node.id,{x:i*140,y:0,width:80,height:32,attachInX:i*140-40,attachOutX:i*140+40,attachInY:14,attachOutY:14});if(i<count-1){const child={id:'n'+i,side:'right',children:[]};node.children=[child];node=child;}}
 const layout={nodeLayoutMap:metrics,getLayout:id=>metrics.get(id),verticalGap:12,_nmImages:[],getSubtreeBoundingBox(){return null},computeBoundingBox(){return {minX:-40,maxX:count*140,minY:-16,maxY:16,width:count*140+40,height:32}}};
 return {root,layout,metrics};
}
test('the visible minimap stays outside the framed canvas',()=>{
 const rect=(x,y,w,h)=>({left:x,top:y,right:x+w,bottom:y+h,width:w,height:h});
 const minimap={hidden:false,classList:{contains:()=>false},getBoundingClientRect:()=>rect(968,634,224,194)};
 const previous={document:global.document,innerWidth:global.innerWidth,innerHeight:global.innerHeight};
 global.innerWidth=1280;global.innerHeight=900;
 global.document={
  getElementById:id=>id==='nm616-minimap-shell'?minimap:null,
  querySelector:()=>null,
  querySelectorAll:()=>[]
 };
 const framed=NeuroMapGraphics.viewport();
 assert.equal(framed.right,956);
 minimap.getBoundingClientRect=()=>rect(170,640,150,140);
 global.innerWidth=390;global.innerHeight=844;
 const narrow=NeuroMapGraphics.viewport();
 assert.ok(narrow.right>300,'a wide radar must not collapse the framed width');
 assert.ok(narrow.bottom<=628);
 minimap.hidden=true;
 global.innerWidth=1280;global.innerHeight=900;
 const open=NeuroMapGraphics.viewport();
 assert.ok(open.right>1000);
 global.document=previous.document;global.innerWidth=previous.innerWidth;global.innerHeight=previous.innerHeight;
});
test('fit, vector decorations and collision separation are stack-safe for 14000 visible levels',()=>{
 const f=fixture(14000),app={state:{root:f.root,images:[],relationships:[],findNode:()=>f.root},layout:f.layout};
 assert.ok(NeuroMapGraphics.subtreeBounds(app,'r').width>1000000);
 assert.ok(NeuroMapGraphics.bounds(app).width>1000000);
 assert.equal(NeuroMapGraphics.svgLayers({state:app.state,layout:f.layout}).boundaries,'');
 NeuroMapGraphics.separateSubtrees(f.layout,f.root);assert.equal(f.metrics.get('n13998').y,0);
});
test('marker footprints participate in collision spacing and whole-map fit',()=>{
 const f=fixture(),a={id:'a',side:'right',markers:['star','info','check'],children:[]},b={id:'b',side:'right',children:[]};f.root.children=[a,b];
 for(const [i,n]of [a,b].entries())f.metrics.set(n.id,{x:200,y:i*44,width:80,height:32,attachInX:160,attachOutX:240,attachInY:i*44+14,attachOutY:i*44+14});
 NeuroMapGraphics.separateSubtrees(f.layout,f.root);
 const app={state:{root:f.root,images:[],relationships:[],findNode:()=>f.root},layout:f.layout};
 assert.ok(NeuroMapGraphics.bounds(app).maxX>=299,'rightmost marker is fully included');
 assert.ok(f.metrics.get('b').y-f.metrics.get('a').y>=44);
});
test('unchanged relayouts reuse text measurements while edits and typography invalidate them',()=>{
 const fs=require('node:fs'),vm=require('node:vm');let calls=0;
 const Layout=vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../../../apps/desktop-shared/editor/layout.js'),'utf8')+'\nOrganicLayoutEngine',{
  document:{createElement:()=>({getContext:()=>({measureText:t=>{calls++;return {width:t.length*8}}})})},NeuroMapCore:require('../../map-core'),nm68ClampGap:v=>v||150});
 NeuroMapGraphics.installMeasurements(Layout);const layout=new Layout(),root={id:'r',side:'root',text:'Map',children:Array.from({length:2000},(_,i)=>({id:'n'+i,side:'right',text:'Topic '+i,children:[]}))};layout.balanceBias=50;
 layout.computeLayout(root);const initial=calls,before=JSON.stringify([...layout.nodeLayoutMap]);layout.computeLayout(root);assert.equal(calls,initial);assert.equal(JSON.stringify([...layout.nodeLayoutMap]),before);
 root.children[0].text='Changed text';layout.computeLayout(root);assert.equal(calls,initial+1);
 root.children[0].fontItalic=true;layout.computeLayout(root);assert.equal(calls,initial+2);
 layout.typographyScale=1.2;layout.computeLayout(root);assert.ok(calls>=initial+2003);
});
test('iterative SVG keeps nested summary paint order and includes collapsed summary braces',()=>{
 const f=fixture(),deep={id:'deep',isSummary:true,color:'#111111',collapsed:true,children:[]},group={id:'group',children:[deep]},sibling={id:'sibling',isSummary:true,color:'#222222',children:[]};f.root.children=[group,sibling];
 for(const node of [group,deep,sibling])f.metrics.set(node.id,{x:200,y:0,width:80,height:32,bracketGeom:node.isSummary?{dir:1,baseX:100,tipX:124,minY:0,maxY:100,midY:50}:null});
 const out=NeuroMapGraphics.svgLayers({state:{root:f.root,relationships:[]},layout:f.layout});assert.ok(out.summaries.includes('#111111'));assert.ok(out.summaries.indexOf('#111111')<out.summaries.indexOf('#222222'));
});
