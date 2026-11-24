/* NeuroMap multi-view core v1: read-only graph projection, never mutates source nodes.
 * The renderer consumes stable node IDs; editor changes are made on the original tree.
 * Deliberately excludes semantic flowcharts: hierarchy alone cannot infer sequence/decisions.
 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.NeuroMapViewCore=api;
})(typeof globalThis==='object'?globalThis:this,function(){
'use strict';
const MODES=Object.freeze(['mindmap','orgchart','concept-tree','concept-network','flowchart','kanban','timeline']);
function mode(value){return MODES.includes(value)?value:'mindmap'}
function project(root,view='orgchart',opts={}){
  if(!root||typeof root!=='object'||typeof root.id!=='string')throw Error('Missing map root');
  const format=mode(view);
  if(format==='mindmap')return Object.freeze({mode:format,nodes:[],edges:[],width:0,height:0});
  if(['concept-network','flowchart','kanban','timeline'].includes(format))throw Error('Use the dedicated semantic projector for this view');
  const maxNodes=Math.max(1,Math.min(8000,Number(opts.maxNodes)||4000));
  const nodes=[],edges=[],byId=new Map(),visited=new Set(),groups=new Map(),stack=[{node:root,depth:0,parentId:null,groupId:null}];
  while(stack.length){
    const {node,depth,parentId,groupId}=stack.pop();
    if(!node||typeof node!=='object'||typeof node.id!=='string'||!node.id||visited.has(node)||byId.has(node.id)){
      throw Error('Invalid tree: cyclic, missing or duplicated node identifiers');
    }
    if(nodes.length>=maxNodes)throw Error('View contains too many nodes');
    visited.add(node);
    if(groupId&&!groups.has(groupId))groups.set(groupId,groups.size);
    const entry={id:node.id,parentId,depth,groupId:groupId||null,groupIndex:groupId?groups.get(groupId):-1,
      text:String(node.text??''),color:node.color||'#818cf8',
      collapsed:!!node.collapsed,hiddenChildren:node.collapsed&&Array.isArray(node.children)?node.children.length:0,
      childIds:[],x:0,y:0,w:0,h:0,leaf:0};
    byId.set(node.id,entry);nodes.push(entry);
    if(parentId){const parent=byId.get(parentId);parent.childIds.push(node.id);edges.push({fromId:parentId,toId:node.id})}
    const children=node.collapsed?[]:(Array.isArray(node.children)?node.children:[]);
    for(let i=children.length-1;i>=0;i--)stack.push({node:children[i],parentId:node.id,depth:depth+1,groupId:depth===0?children[i]?.id:groupId});
  }
  let nextLeaf=0,lastTreeGroup=null;
  // Reserve a small visual gutter between *top-level subtrees* in the
  // conceptual tree. A leaf retains the same ordinal within its own group;
  // changing group adds only presentation space, never writes to the source.
  // Orgchart layouts retain their existing vertical and horizontal spacing.
  const GROUP_GUTTER=32/88;
  // Assign left-to-right leaf order first, then center ancestor boxes on children.
  for(const n of nodes)if(!n.childIds.length){
    if(format==='concept-tree'&&n.groupId!==null){
      if(lastTreeGroup!==null&&n.groupId!==lastTreeGroup)nextLeaf+=GROUP_GUTTER;
      lastTreeGroup=n.groupId;
    }
    n.leaf=nextLeaf++;
  }
  for(let i=nodes.length-1;i>=0;i--){
    const n=nodes[i];
    if(n.childIds.length){
      const xs=n.childIds.map(id=>byId.get(id).leaf);
      n.leaf=(Math.min(...xs)+Math.max(...xs))/2;
    }
  }
  const orgchart=format==='orgchart';
  const vertical=orgchart&&opts.orientation!=='horizontal';
  const horizontalOrg=orgchart&&!vertical;
  const gap=vertical?206:horizontalOrg?116:88;
  const depthStep=vertical?152:horizontalOrg?262:230;
  const xInset=vertical?36:horizontalOrg?148:124,yInset=vertical?46:horizontalOrg?66:32;
  for(const n of nodes){
    // Concept-tree titles wrap inside a short card. A 152px box hides
    // "Architettura" behind the collapse control. Stay inside the 230px column step.
    n.w=vertical?172:horizontalOrg?184:format==='concept-tree'
      ?Math.min(208,Math.max(188,96+Math.min(n.text.length,48)*4.6))
      :Math.min(192,Math.max(152,126+Math.min(n.text.length,40)*1.15));
    n.h=orgchart?72:58;
    n.x=xInset+(vertical?n.leaf*gap:n.depth*depthStep);
    n.y=yInset+(vertical?n.depth*depthStep:n.leaf*gap);
    if(orgchart)n.orientation=vertical?'vertical':'horizontal';
  }
  const sourceRoot=nodes[0],direct=sourceRoot.childIds.map(id=>byId.get(id));
  if(orgchart&&direct.length>=25&&direct.length===nodes.length-1&&
     direct.every(n=>n.childIds.length===0)){
    // A flat company with 100 direct reports should not become a 20,000px
    // horizontal strip. Wrap visual cards but never invent intermediary roles.
    const columns=Math.min(12,Math.max(6,Math.ceil(Math.sqrt(direct.length*1.4))));
    const xStep=vertical?206:262,yStep=vertical?152:116;
    const startX=vertical?150:390,startY=vertical?260:190;
    for(let index=0;index<direct.length;index++){
      const n=direct[index],column=index%columns,row=Math.floor(index/columns);
      n.x=startX+column*xStep;n.y=startY+row*yStep;
      n.packedOrgReport=true;
    }
    sourceRoot.x=vertical?startX+(columns-1)*xStep/2:155;
    sourceRoot.y=96;
  }else if(format==='concept-tree'&&nodes.length>=100&&direct.length>=8&&
     direct.every(n=>n.childIds.every(id=>byId.get(id).childIds.length===0))){
    // Large two-level conceptual taxonomies use readable group sections
    // arranged in columns. Preserve exact branch order, IDs and hierarchy;
    // deep trees retain their conventional left-to-right projection.
    const LEAF_STEP=72,GROUP_GAP=96,MAX_COLUMN_BOTTOM=7900;
    const GROUP_X=360,LEAF_X=590,COLUMN_STEP=480,FIRST_Y=132;
    let column=0,cursor=FIRST_Y;
    sourceRoot.x=124;sourceRoot.y=96;
    for(const group of direct){
      const children=group.childIds.map(id=>byId.get(id));
      const blockHeight=Math.max(1,children.length)*LEAF_STEP+GROUP_GAP;
      if(cursor+blockHeight>MAX_COLUMN_BOTTOM&&cursor>FIRST_Y){
        column++;cursor=FIRST_Y;
      }
      group.x=GROUP_X+column*COLUMN_STEP;
      group.packedTreeGroup=true;
      if(children.length){
        for(let i=0;i<children.length;i++){
          const leaf=children[i];
          leaf.x=LEAF_X+column*COLUMN_STEP;
          leaf.y=cursor+i*LEAF_STEP;
        }
        group.y=(children[0].y+children[children.length-1].y)/2;
      }else group.y=cursor;
      cursor+=blockHeight;
    }
  }
  if(vertical){
    const minX=Math.min(...nodes.map(n=>n.x-n.w/2));
    for(const n of nodes)n.x+=Math.max(0,24-minX);
  }
  const width=Math.max(540,...nodes.map(n=>Math.ceil(n.x+n.w/2+60)));
  const height=Math.max(290,...nodes.map(n=>Math.ceil(n.y+n.h/2+66)));
  const output={mode:format,orientation:orgchart?(vertical?'vertical':'horizontal'):null,nodes,edges,width,height};
  return output;
}
function path(a,b,mode){
  if(mode==='concept-tree'&&a.depth===0&&b.packedTreeGroup){
    // A root-to-category link must use the whitespace between packed groups,
    // rather than cutting through unrelated category and leaf cards.
    const start=a.x+a.w/2,target=b.x-b.w/2;
    const channel=target-22;
    return 'M'+start+' '+a.y+' H'+(start+20)+' V24 H'+channel+
      ' V'+b.y+' H'+target;
  }
  if(mode==='orgchart'&&a.depth===0&&b.packedOrgReport){
    const startX=a.orientation==='horizontal'?a.x+a.w/2:a.x;
    const startY=a.orientation==='horizontal'?a.y:a.y+a.h/2;
    const targetTop=b.y-b.h/2;
    const laneX=b.x-b.w/2-22;
    const railY=a.orientation==='horizontal'?126:180;
    return 'M'+startX+' '+startY+' V'+railY+' H'+laneX+
      ' V'+(targetTop-14)+' H'+b.x+' V'+targetTop;
  }
  if(mode==='orgchart'){
    if(a.orientation==='horizontal'||b.orientation==='horizontal'){
      const ax=a.x+a.w/2,bx=b.x-b.w/2,mid=(ax+bx)/2;
      return 'M'+ax+' '+a.y+' H'+mid+' V'+b.y+' H'+bx;
    }
    const ay=a.y+a.h/2,by=b.y-b.h/2,mid=(ay+by)/2;
    return 'M'+a.x+' '+ay+' V'+mid+' H'+b.x+' V'+by;
  }
  const ax=a.x+a.w/2,bx=b.x-b.w/2,mid=(ax+bx)/2;
  return 'M'+ax+' '+a.y+' H'+mid+' V'+b.y+' H'+bx;
}
return Object.freeze({MODES,mode,project,path});
});
