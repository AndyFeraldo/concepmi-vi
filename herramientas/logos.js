const s=require('sharp');const d='D:/DOCUMENTOS/STUDENT CLUB PMI LIMA/CONCEPMI VI/PAGINA WEB/';
const out=process.argv[2]||__dirname+'/../concepmi-vi/public/images';
function components(mask,w,h,minArea){
  const lab=new Int32Array(w*h).fill(-1);const keep=new Uint8Array(w*h);const st=[];
  for(let i=0;i<w*h;i++){ if(!mask[i]||lab[i]>=0)continue;
    const px=[];st.push(i);lab[i]=i;
    while(st.length){const p=st.pop();px.push(p);const x=p%w,y=(p/w)|0;
      for(const q of [x>0?p-1:-1,x<w-1?p+1:-1,y>0?p-w:-1,y<h-1?p+w:-1]) if(q>=0&&mask[q]&&lab[q]<0){lab[q]=i;st.push(q);} }
    if(px.length>=minArea) for(const p of px) keep[p]=1; }
  return keep;
}
function erode(m,w,h,r){const o=new Uint8Array(w*h);for(let y=0;y<h;y++)for(let x=0;x<w;x++){let v=1;for(let dy=-r;dy<=r&&v;dy++)for(let dx=-r;dx<=r;dx++){const X=x+dx,Y=y+dy;if(X<0||Y<0||X>=w||Y>=h||!m[Y*w+X]){v=0;break;}}o[y*w+x]=v;}return o;}
function dilate(m,w,h,r){const o=new Uint8Array(w*h);for(let y=0;y<h;y++)for(let x=0;x<w;x++){let v=0;for(let dy=-r;dy<=r&&!v;dy++)for(let dx=-r;dx<=r;dx++){const X=x+dx,Y=y+dy;if(X>=0&&Y>=0&&X<w&&Y<h&&m[Y*w+X]){v=1;break;}}o[y*w+x]=v;}return o;}
(async()=>{
  // CONCEPMI: solo la palabra principal (el subtítulo va como texto en la página)
  const img=s(d+'LOGO CONCEPMI VI.png').extract({left:0,top:150,width:2172,height:330});
  const {data,info}=await img.raw().toBuffer({resolveWithObject:true});
  const w=info.width,h=info.height,m=new Uint8Array(w*h);
  for(let i=0;i<w*h;i++) m[i]=data[i*4+3]>128?1:0;
  const opened=dilate(erode(m,w,h,4),w,h,4);
  const keep=dilate(components(opened,w,h,8000),w,h,1);
  for(let i=0;i<w*h;i++){ const r=data[i*4],g=data[i*4+1],bb=data[i*4+2],sat=Math.max(r,g,bb)-Math.min(r,g,bb); if(!keep[i]&&!(sat>60&&m[i])) data[i*4+3]=0; else if(!m[i]) data[i*4+3]=0; }
  await s(data,{raw:{width:w,height:h,channels:4}}).trim().resize({width:1200}).png({compressionLevel:9,palette:true,quality:90}).toFile(out+'/concepmi-vi-logo.png');
  // PMI Lima: texto negro -> blanco para fondo oscuro
  const p=await s(d+'Logotipo PMI Lima, Perú Student Club.png').raw().toBuffer({resolveWithObject:true});
  const b=p.data;for(let i=0;i<b.length;i+=4){const mx=Math.max(b[i],b[i+1],b[i+2]);if(mx<90){b[i]=b[i+1]=b[i+2]=255;}}
  await s(b,{raw:{width:p.info.width,height:p.info.height,channels:4}}).trim().resize({width:700}).png({compressionLevel:9,palette:true,quality:90}).toFile(out+'/pmi-lima-student-club.png');
  await s(d+'WOLFITO FONDO TRANSPARENTE.png').trim().resize({width:800,height:800,fit:'inside'}).png({compressionLevel:9,palette:true,quality:90}).toFile(out+'/wolfito-concepmi.png');
})();
