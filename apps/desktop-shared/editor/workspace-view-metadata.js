    // Workspace-only presentation metadata. Never part of the .neuromap node schema.
    // Sanitize recovery snapshots rather than trusting arbitrary persistent JSON.
    function nmCleanViewWorkspace(raw){
      const mode=value=>['orgchart','concept-tree','concept-network','flowchart','kanban','timeline'].includes(value)?value:null;
      const primary=value=>mode(value)||'mindmap';
      const width=value=>value!=null&&Number.isFinite(Number(value))?Math.max(30,Math.min(65,Math.round(Number(value)))):50;
      const layouts=[],names=new Set();
      for(const item of (Array.isArray(raw?.layouts)?raw.layouts:[]).slice(0,24)){
        const name=typeof item?.name==='string'?item.name.trim().slice(0,50):'';
        const key=name.toLocaleLowerCase();
        if(!name||names.has(key))continue;
        names.add(key);
        layouts.push({name,primaryMode:primary(item.primaryMode),sideMode:mode(item.sideMode),width:width(item.width)});
        if(layouts.length===8)break;
      }
      const activeName=layouts.some(item=>item.name===raw?.activeName)?raw.activeName:null;
      // R2: view cameras are presentation-only metadata: 6 linked views,
      // each with an independent full-screen and side-panel camera.
      const cameras={};
      const allowed=['orgchart','concept-tree','concept-network','flowchart','kanban','timeline'];
      const source=raw?.cameras;
      if(source&&typeof source==='object'&&!Array.isArray(source)){
        for(const view of allowed)for(const suffix of ['',':side']){
          const key=view+suffix,camera=Object.prototype.hasOwnProperty.call(source,key)?source[key]:null;
          if(!camera||typeof camera!=='object'||Array.isArray(camera)||
             camera.zoom==null||camera.left==null||camera.top==null)continue;
          const zoom=Number(camera.zoom),left=Number(camera.left),top=Number(camera.top);
          if(!Number.isFinite(zoom)||!Number.isFinite(left)||!Number.isFinite(top))continue;
          cameras[key]={zoom:Math.max(.02,Math.min(3.5,zoom)),
            left:Math.max(0,Math.min(100000000,left)),
            top:Math.max(0,Math.min(100000000,top))};
        }
      }
      return {sideMode:mode(raw?.sideMode),width:width(raw?.width),layouts,activeName,cameras};
    }
    function nmCleanCanvasCamera(raw){
      if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;
      const {x,y,zoom}=raw;
      if(![x,y,zoom].every(Number.isFinite))return null;
      return {x:Math.max(-100000000,Math.min(100000000,x)),
        y:Math.max(-100000000,Math.min(100000000,y)),
        zoom:Math.max(.001,Math.min(3.5,zoom))};
    }
    // Bounded file-backed UI preferences, keyed by Atlas's normalized file/sheet ID.
    // No project content or node text is stored in this index.
    function nmArchiveViewWorkspaces(raw,tabs=[]){
      const A=typeof NeuroMapAtlasLibrary!=='undefined'?NeuroMapAtlasLibrary:null;
      if(!A?.keyFor)return [];
      const byKey=new Map();
      for(const item of (Array.isArray(raw)?raw:[]).slice(0,180)){
        const key=A.keyFor(item);
        if(!key)continue;
        const updatedAt=Number.isFinite(item.updatedAt)?Math.max(0,Math.floor(item.updatedAt)):0;
        const entry={filePath:A.normalizedPath(item.filePath),
          originSheetIndex:Number.isInteger(item.originSheetIndex)&&item.originSheetIndex>=0&&item.originSheetIndex<=1000?item.originSheetIndex:0,
          viewWorkspace:nmCleanViewWorkspace(item.viewWorkspace),updatedAt};
        const prev=byKey.get(key);if(!prev||prev.updatedAt<=updatedAt)byKey.set(key,entry);
      }
      for(const tab of tabs){
        const key=A.keyFor(tab);if(!key)continue;
        byKey.set(key,{filePath:A.normalizedPath(tab.filePath),
          originSheetIndex:Number.isInteger(tab.originSheetIndex)&&tab.originSheetIndex>=0&&tab.originSheetIndex<=1000?tab.originSheetIndex:0,
          viewWorkspace:nmCleanViewWorkspace(tab.viewWorkspace),updatedAt:Date.now()});
      }
      return [...byKey.values()].sort((a,b)=>b.updatedAt-a.updatedAt).slice(0,60);
    }
