import {authenticate,authAction} from '../../../lib/auth';
import {readApp,readLive} from '../../../lib/read';
import {command} from '../../../lib/commands';
import {upload} from '../../../lib/media';
import {origin,failure} from '../../../lib/http';
import {pool,need,sandbox} from '../../../lib/db';
export const runtime='nodejs';
export const dynamic='force-dynamic';
type Context={params:Promise<{path:string[]}>};
export async function GET(request:Request,context:Context){try{
 const path=(await context.params).path.join('/');
 if(path==='health'){await pool.query('SELECT 1');return Response.json({ok:true,sandbox:sandbox()});}
 if(path==='config')return Response.json({sandbox:sandbox()});
 const u=await authenticate(request);const url=new URL(request.url);
 if(path==='data')return Response.json(await readApp(u,url),{headers:{'Cache-Control':'no-store'}});
 if(path==='live')return Response.json(await readLive(u,url),{headers:{'Cache-Control':'no-store'}});
 need(false,'Not found',404);
 }catch(e){return failure(e);}}
export async function POST(request:Request,context:Context){try{
 origin(request);const path=(await context.params).path.join('/');
 if(path==='upload')return Response.json(await upload(await authenticate(request),request));
 const body=await request.text();need(body.length<=100000,'Request too large',413);
 const copy=new Request(request.url,{method:'POST',headers:request.headers,body});
 if(path.startsWith('auth/'))return await authAction(path,copy);
 need(path==='command','Not found',404);return Response.json(await command(await authenticate(request),JSON.parse(body)));
 }catch(e){return failure(e);}}
