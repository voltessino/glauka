/* Conservative OCR-input enhancement. The source preview is never modified. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.NeuroMapOCRImage=api;})(globalThis,function(){
'use strict';
function histogram(gray){const h=new Uint32Array(256);for(const v of gray)h[v]++;return h}
function percentile(h,p){const n=h.reduce((a,b)=>a+b,0),target=Math.max(1,n*p);let sum=0;for(let i=0;i<256;i++){sum+=h[i];if(sum>=target)return i}return 255}
function contrast(gray){const h=histogram(gray),low=percentile(h,.005),high=percentile(h,.90),range=high-low;
 // Avoid thresholding/binarization: weak accents and decimal points must survive.
 return {low,high,apply:range>=12&&range<120&&high<245,gain:range?Math.min(2.5,235/range):1};}
// Projection-only orientation hint: distinguishes axes, never guesses 0 vs 180 or 90 vs 270.
function orientation(gray,width,height){
 if(!Number.isInteger(width)||!Number.isInteger(height)||width*height!==gray.length||gray.length>1500000)throw Error('Invalid orientation sample');
 const c=contrast(gray),threshold=c.low+(c.high-c.low)*.55,rows=new Uint32Array(height),cols=new Uint32Array(width);let count=0;
 if(c.high-c.low<12)return {axis:'unknown',ratio:1};
 for(let y=4;y<height-4;y+=2)for(let x=4;x<width-4;x+=2)if(gray[y*width+x]<threshold){rows[y]++;cols[x]++;count++}
 if(count<200)return {axis:'unknown',ratio:1};
 const r=rows.reduce((s,n)=>s+n*n,0)*height,co=cols.reduce((s,n)=>s+n*n,0)*width,ratio=co/Math.max(1,r);
 return {axis:ratio>1.8?'vertical':ratio<1/1.8?'horizontal':'unknown',ratio};
}
async function orientationOf(canvas,{signal}={}){
 check(signal);const sample=document.createElement('canvas'),ratio=Math.min(1,320/canvas.width,500/canvas.height);sample.width=Math.max(20,Math.floor(canvas.width*ratio));sample.height=Math.max(20,Math.floor(canvas.height*ratio));
 try{const cx=sample.getContext('2d',{willReadFrequently:true});cx.drawImage(canvas,0,0,sample.width,sample.height);const pixels=cx.getImageData(0,0,sample.width,sample.height).data,gray=new Uint8Array(sample.width*sample.height);for(let i=0;i<gray.length;i++)gray[i]=Math.round(.299*pixels[i*4]+.587*pixels[i*4+1]+.114*pixels[i*4+2]);check(signal);return orientation(gray,sample.width,sample.height)}finally{sample.width=sample.height=0}
}
function skew(gray,width,height){
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<20||height<20||width*height!==gray.length||gray.length>1500000)throw Error('Invalid deskew sample');
 const c=contrast(gray);if(c.high-c.low<12)return {angle:0,improvement:0};
 const threshold=c.low+(c.high-c.low)*.55,points=[];
 // Bounded deterministic sampling. Ignore page edges and background speckles.
 for(let y=4;y<height-4;y++)for(let x=4;x<width-4;x+=2)if(gray[y*width+x]<threshold)points.push(x,y);
 if(points.length<400||points.length>180000)return {angle:0,improvement:0};
 let minX=width,maxX=0;for(let i=0;i<points.length;i+=2){minX=Math.min(minX,points[i]);maxX=Math.max(maxX,points[i])}const midpoint=(minX+maxX)/2;
 function score(angle,side=0){const a=angle*Math.PI/180,s=Math.sin(a),co=Math.cos(a),bins=new Uint32Array(height+width+4),offset=width/2;
  for(let i=0;i<points.length;i+=2){if(side<0&&points[i]>midpoint||side>0&&points[i]<midpoint)continue;const y=Math.round((points[i+1]-height/2)*co-(points[i]-width/2)*s+height/2+offset);if(y>=0&&y<bins.length)bins[y]++}
  let total=0;for(const n of bins)total+=n*n;return total;
 }
 const zero=score(0);let best=zero,angle=0;
 for(let a=-3;a<=3;a+=.25){const s=score(a);if(s>best){best=s;angle=a}}
 const improvement=zero?best/zero-1:0;
 // Both page halves must independently support the rotation. Staggered columns
 // can otherwise create a spurious diagonal in the combined projection.
 let supported=true;
 for(const side of [-1,1]){let local=0,bestScore=score(0,side);const baseScore=bestScore;
  for(let a=-3;a<=3;a+=.25){const value=score(a,side);if(value>bestScore){bestScore=value;local=a}}
  if(!baseScore||bestScore/baseScore<1.1||Math.abs(local-angle)>.5)supported=false;
 }
 return {angle:supported&&improvement>.15&&Math.abs(angle)>=.5?angle:0,improvement};
}
function sourceBox(box,transform){
 const {width:w,height:h,outWidth:ow,outHeight:oh,angle=0,scale=1}=transform;
 const a=angle*Math.PI/180,co=Math.cos(a),s=Math.sin(a),[x,y,bw,bh]=box,points=[];
 for(const xx of [x,x+bw])for(const yy of [y,y+bh]){const px=(xx*ow-ow/2)/scale,py=(yy*oh-oh/2)/scale;points.push([(co*px-s*py+w/2)/w,(s*px+co*py+h/2)/h])}
 const clip=n=>Math.max(0,Math.min(1,n)),x0=clip(Math.min(...points.map(p=>p[0]))),y0=clip(Math.min(...points.map(p=>p[1])));
 return [x0,y0,Math.max(0,clip(Math.max(...points.map(p=>p[0])))-x0),Math.max(0,clip(Math.max(...points.map(p=>p[1])))-y0)];
}
function check(signal){if(signal?.aborted)throw new DOMException('Cancelled','AbortError')}
async function improve(canvas,{signal}={}){
 check(signal);const sample=document.createElement('canvas'),ratio=Math.min(1,640/canvas.width,1000/canvas.height);
 sample.width=Math.max(20,Math.floor(canvas.width*ratio));sample.height=Math.max(20,Math.floor(canvas.height*ratio));
 let analysis;
 try{const cx=sample.getContext('2d',{willReadFrequently:true});cx.drawImage(canvas,0,0,sample.width,sample.height);const rgba=cx.getImageData(0,0,sample.width,sample.height).data,gray=new Uint8Array(sample.width*sample.height);
  for(let i=0;i<gray.length;i++)gray[i]=Math.round(.299*rgba[4*i]+.587*rgba[4*i+1]+.114*rgba[4*i+2]);analysis={...skew(gray,sample.width,sample.height),contrast:contrast(gray),orientationHint:orientation(gray,sample.width,sample.height)};
 }finally{sample.width=sample.height=0}
 check(signal);if(!analysis.angle&&!analysis.contrast.apply)return {png:null,width:canvas.width,height:canvas.height,processing:{angle:0,contrast:false,orientationHint:analysis.orientationHint},transform:{width:canvas.width,height:canvas.height,outWidth:canvas.width,outHeight:canvas.height,angle:0,scale:1}};
 check(signal);const w=canvas.width,h=canvas.height,a=analysis.angle*Math.PI/180;
 const rw=Math.ceil(Math.abs(w*Math.cos(a))+Math.abs(h*Math.sin(a))),rh=Math.ceil(Math.abs(h*Math.cos(a))+Math.abs(w*Math.sin(a)));
 const scale=Math.min(1,Math.sqrt(6000000/(rw*rh)),4000/rw,4000/rh),out=document.createElement('canvas');out.width=Math.max(1,Math.floor(rw*scale));out.height=Math.max(1,Math.floor(rh*scale));
 try{
  const cx=out.getContext('2d',{willReadFrequently:true});cx.fillStyle='#fff';cx.fillRect(0,0,out.width,out.height);cx.save();cx.translate(out.width/2,out.height/2);cx.scale(scale,scale);cx.rotate(-a);cx.drawImage(canvas,-w/2,-h/2);cx.restore();
  if(analysis.contrast.apply){
   const image=cx.getImageData(0,0,out.width,out.height),data=image.data,{high,gain}=analysis.contrast;
   for(let y=0;y<out.height;y++){
    if(y%64===0){check(signal);await new Promise(r=>setTimeout(r,0))}
    for(let x=0;x<out.width;x++){const i=(y*out.width+x)*4,v=Math.max(0,Math.min(255,Math.round((.299*data[i]+.587*data[i+1]+.114*data[i+2]-high)*gain+245)));data[i]=data[i+1]=data[i+2]=v}
   }
   cx.putImageData(image,0,0);
  }
  check(signal);const png=await new Promise((resolve,reject)=>out.toBlob(b=>b?resolve(b):reject(Error('PNG failed')),'image/png'));check(signal);
  return {png,width:out.width,height:out.height,processing:{angle:analysis.angle,contrast:analysis.contrast.apply,orientationHint:analysis.orientationHint},transform:{width:w,height:h,outWidth:out.width,outHeight:out.height,angle:analysis.angle,scale}};
 }finally{out.width=out.height=0}
}
return Object.freeze({histogram,percentile,contrast,orientation,orientationOf,skew,sourceBox,improve});
});
