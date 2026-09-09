import {randomUUID} from 'node:crypto';
import {mkdir,writeFile,readFile,unlink,stat} from 'node:fs/promises';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {type User,blocked} from './auth';
import {pool,one,need,flag,rate} from './db';
const exec=promisify(execFile);
const directory=()=>path.resolve(process.env.MEDIA_DIR??'.data/media');
function detect(b:Buffer):{mime:string,ext:string}|undefined{
 if(b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return {mime:'image/png',ext:'png'};
 if(b[0]===255&&b[1]===216&&b[2]===255)return {mime:'image/jpeg',ext:'jpg'};
 if(b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP')return {mime:'image/webp',ext:'webp'};
 if(b.toString('ascii',4,8)==='ftyp')return {mime:'video/mp4',ext:'mp4'};
 if(b.subarray(0,4).equals(Buffer.from([0x1a,0x45,0xdf,0xa3])))return {mime:'video/webm',ext:'webm'};
}
export async function upload(u:User,request:Request){
 await flag(pool,'uploads');await rate(pool,`upload:${u.id}`,10,600);
 const limit=22*1024*1024;need(Number(request.headers.get('content-length')??0)<=limit,'Upload limit is 20 MB',413);
 const reader=request.body?.getReader();need(reader,'Choose a file');const chunks:Uint8Array[]=[];let bytes=0;
 while(true){const chunk=await reader.read();if(chunk.done)break;bytes+=chunk.value.byteLength;if(bytes>limit){await reader.cancel();need(false,'Upload limit is 20 MB',413);}chunks.push(chunk.value);}
 const form=await new Request('http://local',{method:'POST',headers:{'content-type':request.headers.get('content-type')??''},body:Buffer.concat(chunks)}).formData();
 const file=form.get('file');need(file instanceof File,'Choose a file');need(file.size>0&&file.size<=20*1024*1024,'Upload a file under 20 MB');
 const bytesBuffer=Buffer.from(await file.arrayBuffer());let kind=detect(bytesBuffer);need(kind,'Use a PNG, JPEG, WebP, MP4 or WebM file');
 await mkdir(directory(),{recursive:true});const id=randomUUID();let filename=`${id}.${kind.ext}`;const source=path.join(directory(),filename);await writeFile(source,bytesBuffer,{flag:'wx'});
 try{
  if(kind.mime.startsWith('video/')){
   const out=`${id}-480.mp4`;
   let ffmpeg=process.env.FFMPEG_PATH??'ffmpeg';if(ffmpeg==='bundled')ffmpeg=(await import('ffmpeg-static')).default!;
   try{await exec(ffmpeg,['-nostdin','-y','-i',source,'-t','600','-vf',"scale='min(480,iw)':-2",'-c:v','libx264','-preset','veryfast','-crf','28','-c:a','aac','-b:a','64k','-movflags','+faststart',path.join(directory(),out)],{timeout:120000,maxBuffer:2*1024*1024});}catch{await unlink(path.join(directory(),out)).catch(()=>{});throw new Error('Video processing failed. Check FFMPEG_PATH and upload a valid video.');}
   await unlink(source);filename=out;kind={mime:'video/mp4',ext:'mp4'};
  }
  const size=(await stat(path.join(directory(),filename))).size;
  await pool.query('INSERT INTO app.media(id,owner_id,filename,mime,bytes) VALUES($1,$2,$3,$4,$5)',[id,u.id,filename,kind.mime,size]);
  return {id,url:`/api/media/${id}`,mime:kind.mime};
 }catch(e){await unlink(path.join(directory(),filename)).catch(()=>{});throw e;}
}
export async function mediaResponse(u:User,id:string,request:Request){
 need(/^[0-9a-f-]{36}$/i.test(id),'Media not found',404);
 const m=await one(pool,'SELECT * FROM app.media WHERE id=$1',[id]);need(m,'Media not found',404);
 if(m.owner_id!==u.id){need(!await blocked(pool,u.id,m.owner_id),'Media not found',404);need(await one(pool,"SELECT 1 FROM content.post WHERE media_id=$1 AND state='published'",[id]),'Media not found',404);}
 const buffer=await readFile(path.join(directory(),m.filename));
 const headers:Record<string,string>={'Content-Type':m.mime,'Cache-Control':'private, no-store','Accept-Ranges':'bytes','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'"};
 const range=request.headers.get('range');
 if(range){const match=/^bytes=(\d*)-(\d*)$/.exec(range);if(!match||!match[1]&&!match[2])return new Response(null,{status:416,headers:{'Content-Range':`bytes */${buffer.length}`}});
  const start=match[1]?Number(match[1]):Math.max(0,buffer.length-Number(match[2]));const end=match[1]?Math.min(match[2]?Number(match[2]):buffer.length-1,buffer.length-1):buffer.length-1;
  if(start>end||start>=buffer.length)return new Response(null,{status:416,headers:{'Content-Range':`bytes */${buffer.length}`}});
  return new Response(new Uint8Array(buffer.subarray(start,end+1)),{status:206,headers:{...headers,'Content-Length':String(end-start+1),'Content-Range':`bytes ${start}-${end}/${buffer.length}`}});
 }
 return new Response(new Uint8Array(buffer),{headers:{...headers,'Content-Length':String(buffer.length)}});
}
