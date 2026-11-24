  function viewPdfFromJpeg(data,width,height){
    if(!(data instanceof Uint8Array)||data.length<4||data[0]!==255||data[1]!==216||
       data[data.length-2]!==255||data[data.length-1]!==217||
       data.length>64000000||!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||
       width<1||height<1||width>8192||height>8192)
      throw Error('Invalid JPEG data or image dimensions');
    const chunks=[],offsets=[];let pos=0;
    const put=value=>{
      const bytes=typeof value==='string'?Uint8Array.from(value,c=>c.charCodeAt(0)&255):value;
      chunks.push(bytes);pos+=bytes.length;
    };
    const obj=(id,value)=>{offsets[id]=pos;put(id+' 0 obj\n'+value+'\nendobj\n')};
    const W=(width*.75).toFixed(2),H=(height*.75).toFixed(2);
    put('%PDF-1.4\n%Glauka\n');
    obj(1,'<< /Type /Catalog /Pages 2 0 R >>');
    obj(2,'<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
    obj(3,'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 '+W+' '+H+
      '] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>');
    const draw='q\n'+W+' 0 0 '+H+' 0 0 cm\n/Im0 Do\nQ\n';
    obj(4,'<< /Length '+draw.length+' >>\nstream\n'+draw+'endstream');
    offsets[5]=pos;
    put('5 0 obj\n<< /Type /XObject /Subtype /Image /Width '+width+
      ' /Height '+height+' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length '+data.length+
      ' >>\nstream\n');
    put(data);put('\nendstream\nendobj\n');
    const xref=pos;
    put('xref\n0 6\n0000000000 65535 f \n');
    for(let id=1;id<=5;id++)put(String(offsets[id]).padStart(10,'0')+' 00000 n \n');
    put('trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF');
    const out=new Uint8Array(pos);let index=0;
    for(const chunk of chunks){out.set(chunk,index);index+=chunk.length}
    return out;
  }

  // Convert a linked view's exact SVG into PNG or raster-backed PDF, offline,
  // without third-party services. Explicitly cap canvas dimensions/memory.
