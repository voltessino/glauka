  function rasterFactor(scale){
    const n=Number(scale);
    return [1,2,3].includes(n)?n:2;
  }
  function rasterBoundsValid(app,width,height,factor,kind,notify=true){
    const pixelsWide=Math.ceil(width*factor),pixelsHigh=Math.ceil(height*factor);
    // Very large maps remain exportable as vectors; never allocate an
    // unbounded canvas or silently crop a PNG to an invalid size.
    if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0||
       pixelsWide>8192||pixelsHigh>8192||pixelsWide*pixelsHigh>24000000){
      const msg=tr('Vista troppo grande per '+kind+': esporta SVG o riduci l’ambito.',
        'View too large for '+kind+': export SVG or focus on a smaller branch.');
      if(notify)app.showToast?.(msg,kind);
      return {ok:false,message:msg};
    }
    return {ok:true,pixelsWide,pixelsHigh};
  }
  function rasterizeViewRaster(app,svg,width,height,filename,scale,format='png'){
    const pdf=format==='pdf',kind=pdf?'PDF':'PNG';
    const check=rasterBoundsValid(app,width,height,rasterFactor(scale),kind,true);
    if(!check.ok)return false;
    const {pixelsWide,pixelsHigh}=check;
    const Url=root.URL,ImageType=root.Image;
    if(!Url?.createObjectURL||!Url?.revokeObjectURL||typeof ImageType!=='function'){
      app.showToast?.(tr('Esportazione '+kind+' non disponibile in questo ambiente.',
        kind+' export is unavailable in this environment.'),kind);
      return false;
    }
    let blobUrl;
    try{
      const source=new XMLSerializer().serializeToString(svg);
      blobUrl=Url.createObjectURL(new Blob([source],{type:'image/svg+xml;charset=utf-8'}));
      const image=new ImageType();
      let finished=false;
      const cleanup=()=>{if(!finished){finished=true;Url.revokeObjectURL(blobUrl)}};
      image.onerror=()=>{
        cleanup();
        app.showToast?.(tr('Impossibile convertire SVG in '+kind+'.',
          'Could not convert SVG to '+kind+'.'),kind);
      };
      image.onload=()=>{
        try{
          const canvas=document.createElement('canvas');
          canvas.width=pixelsWide;canvas.height=pixelsHigh;
          const ctx=canvas.getContext?.('2d');
          if(!ctx||typeof canvas.toBlob!=='function')throw Error('Canvas export unavailable');
          ctx.drawImage(image,0,0,pixelsWide,pixelsHigh);
          canvas.toBlob(async blob=>{
            if(!blob){
              app.showToast?.(tr('Generazione '+kind+' non riuscita.',kind+' generation failed.'),kind);
              return;
            }
            try{
              const output=pdf?new Blob([viewPdfFromJpeg(new Uint8Array(await blob.arrayBuffer()),
                pixelsWide,pixelsHigh)],{type:'application/pdf'}):blob;
              const saved=await app.io.triggerDownload(output,filename+(pdf?'.pdf':'.png'));
              if(saved!==false&&!root.neuromapDesktop)
                app.showToast?.(tr('Vista '+kind+' esportata',kind+' view exported'),kind);
            }catch(_error){
              app.showToast?.(tr('Esportazione '+kind+' non riuscita.',
                kind+' export failed.'),kind);
            }
          },pdf?'image/jpeg':'image/png',pdf?.92:undefined);
        }catch(_error){
          app.showToast?.(tr('Esportazione '+kind+' non supportata dal dispositivo.',
            kind+' export is not supported by this device.'),kind);
        }finally{cleanup()}
      };
      image.src=blobUrl;
      return true; // only means conversion started; toast follows actual save
    }catch(_error){
      if(blobUrl)Url.revokeObjectURL(blobUrl);
      app.showToast?.(tr('Impossibile preparare l’esportazione '+kind+'.',
        'Could not prepare '+kind+' export.'),kind);
      return false;
    }
  }
  function rasterizeViewPromise(app,svg,width,height,filename,scale,format='png',options={}){
    const jpegOnly=format==='pdf-jpg',pdf=format==='pdf'||jpegOnly,kind=pdf?'PDF':'PNG';
    const check=rasterBoundsValid(app,width,height,rasterFactor(scale),kind,false);
    if(!check.ok)return Promise.reject(Error(check.message));
    const {pixelsWide,pixelsHigh}=check;
    const Url=root.URL,ImageType=root.Image;
    if(!Url?.createObjectURL||!Url?.revokeObjectURL||typeof ImageType!=='function')
      return Promise.reject(Error(tr('Esportazione '+kind+' non disponibile in questo ambiente.',
        kind+' export is unavailable in this environment.')));
    return new Promise((resolve,reject)=>{
      let blobUrl,finished=false;
      const cleanup=()=>{if(!finished&&blobUrl){finished=true;Url.revokeObjectURL(blobUrl);}};
      try{
        const source=new XMLSerializer().serializeToString(svg);
        blobUrl=Url.createObjectURL(new Blob([source],{type:'image/svg+xml;charset=utf-8'}));
        const image=new ImageType();
        image.onerror=()=>{cleanup();reject(Error(tr('Impossibile convertire SVG in '+kind+'.','Could not convert SVG to '+kind+'.')));};
        image.onload=()=>{
          try{
            const canvas=document.createElement('canvas');
            canvas.width=pixelsWide;canvas.height=pixelsHigh;
            const ctx=canvas.getContext?.('2d');
            if(!ctx||typeof canvas.toBlob!=='function')throw Error('Canvas export unavailable');
            ctx.drawImage(image,0,0,pixelsWide,pixelsHigh);
            canvas.toBlob(async blob=>{
              if(!blob){reject(Error(tr('Generazione '+kind+' non riuscita.',kind+' generation failed.')));return;}
              try{
                const raw=new Uint8Array(await blob.arrayBuffer());
                if(jpegOnly){resolve({jpeg:raw,width:pixelsWide,height:pixelsHigh});return;}
                const data=format==='pdf'?viewPdfFromJpeg(raw,pixelsWide,pixelsHigh):raw;
                if(options.captureOnly){resolve({data,blob:new Blob([data],{type:format==='pdf'?'application/pdf':'image/png'}),name:filename+(format==='pdf'?'.pdf':'.png'),width:pixelsWide,height:pixelsHigh});return;}
                const output=new Blob([data],{type:format==='pdf'?'application/pdf':'image/png'});
                const saved=await app.io.triggerDownload(output,filename+(format==='pdf'?'.pdf':'.png'));
                if(saved===false){resolve(false);return;}
                if(!root.neuromapDesktop)app.showToast?.(tr('Vista '+kind+' esportata',kind+' view exported'),kind);
                resolve(true);
              }catch(err){reject(err);}
            },pdf?'image/jpeg':'image/png',pdf?.92:undefined);
          }catch(err){reject(err);}finally{cleanup();}
        };
        image.src=blobUrl;
      }catch(err){cleanup();reject(err);}
    });
  }

