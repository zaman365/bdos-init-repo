import { randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { type DB, type Row, pool, tx, rows, one, hash, need, rate, requireSandbox, sandbox } from './db';
export interface User { id:string;handle:string;display_name:string;roles:string[];locale:'bn'|'en';data_saver:boolean;date_of_birth:string;state:string;msisdn:string }
export const phone=z.string().regex(/^\+8801[3-9][0-9]{8}$/,'Use a Bangladesh mobile number, e.g. +8801712345678');
export async function authenticate(request:Request):Promise<User>{
 const token=request.headers.get('cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith('bdos_session='))?.slice(13);
 need(token,'Sign in to continue',401);
 const u=await one(pool,`SELECT u.* FROM app.session s JOIN identity.user_account u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now() AND u.state='active'`,[hash(token)]);
 need(u,'Your session expired. Sign in again.',401); return u as User;
}
export function hasRole(u:User,role:string){ return u.roles.includes(role)||u.roles.includes('admin'); }
export function role(u:User,r:string){need(hasRole(u,r),'You do not have permission for this action',403);}
export function adult(u:User){const dob=new Date(u.date_of_birth); const cutoff=new Date();cutoff.setUTCFullYear(cutoff.getUTCFullYear()-18);need(dob<=cutoff,'This feature is available to adults aged 18 and over',403);}
export async function blocked(db:DB,a:string,b:string){return !!await one(db,'SELECT 1 FROM app.block WHERE (user_id=$1 AND target_id=$2) OR (user_id=$2 AND target_id=$1)',[a,b]);}
export async function authAction(path:string,request:Request){
 if(path==='auth/logout'){
  const cookie=request.headers.get('cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith('bdos_session='))?.slice(13);
  if(cookie)await pool.query('DELETE FROM app.session WHERE token_hash=$1',[hash(cookie)]);
  return Response.json({ok:true},{headers:{'Set-Cookie':'bdos_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0'}});
 }
 const input=await request.json();
 if(path==='auth/request'){
  requireSandbox(); const p=phone.parse(input.phone);
  // A shared limit bounds number rotation without trusting spoofable proxy headers.
  await rate(pool,'otp-global',100,600); await rate(pool,`otp:${p}`,5,600);
  const old=await one(pool,'SELECT sent_at FROM app.otp WHERE phone=$1',[p]);
  need(!old||Date.now()-new Date(old.sent_at).getTime()>30000,'Wait 30 seconds before requesting another code',429);
  const code=String(randomInt(100000,1000000));
  await pool.query(`INSERT INTO app.otp(phone,code_hash,expires_at) VALUES($1,$2,now()+interval '5 minutes') ON CONFLICT(phone) DO UPDATE SET code_hash=$2,attempts=0,expires_at=now()+interval '5 minutes',sent_at=now()`,[p,hash(code)]);
  return Response.json({ok:true,sandboxCode:code,message:'Sandbox code. No SMS was sent.'});
 }
 need(path==='auth/verify','Not found',404);
 const data=z.object({phone,code:z.string().regex(/^\d{6}$/),handle:z.string().regex(/^[a-z0-9._]{3,24}$/).optional(),name:z.string().min(1).max(40).optional(),dob:z.string().date().optional()}).parse(input);
 const result=await tx(async db=>{
  const otp=await one(db,'SELECT * FROM app.otp WHERE phone=$1 FOR UPDATE',[data.phone]);
  need(otp&&new Date(otp.expires_at).getTime()>Date.now()&&otp.attempts<5,'Code expired or attempts exhausted. Request another code.',401);
  await db.query('UPDATE app.otp SET attempts=attempts+1 WHERE phone=$1',[data.phone]);
  if(!timingSafeEqual(Buffer.from(hash(data.code)),Buffer.from(otp.code_hash))) return {error:'Incorrect code'};
  let u=await one(db,'SELECT * FROM identity.user_account WHERE msisdn=$1',[data.phone]);
  if(!u){
   need(data.name&&data.handle&&data.dob,'Enter your name, handle and date of birth to create an account');
   const cutoff=new Date(); cutoff.setUTCFullYear(cutoff.getUTCFullYear()-13);
   need(new Date(data.dob)<=cutoff && new Date(data.dob)>new Date('1900-01-01'),'You must be at least 13 years old');
   u=await one(db,`INSERT INTO identity.user_account(msisdn,handle,display_name,date_of_birth,state) VALUES($1,$2,$3,$4,'active') RETURNING *`,[data.phone,data.handle,data.name,data.dob]);
   await db.query('INSERT INTO identity.creator_profile(user_id) VALUES($1)',[u!.id]);
   await db.query('INSERT INTO trust.nirapod_setting(user_id) VALUES($1)',[u!.id]);
  }
  need(u!.state==='active','This account is restricted',403);
  await db.query('DELETE FROM app.otp WHERE phone=$1',[data.phone]);
  const token=randomBytes(32).toString('hex');
  await db.query(`INSERT INTO app.session(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '7 days')`,[hash(token),u!.id]);
  return {token};
 });
 if(result.error)return Response.json({error:result.error},{status:401});
 return Response.json({ok:true},{headers:{'Set-Cookie':`bdos_session=${result.token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=604800${process.env.APP_ORIGIN?.startsWith('https:')?'; Secure':''}`}});
}
export async function sessionInfo(u:User){ return {user:u,sandbox:sandbox(),people:await rows(pool,`SELECT id,handle,display_name FROM identity.user_account WHERE state='active' AND id<>$1 AND NOT EXISTS(SELECT 1 FROM app.block WHERE (user_id=$1 AND target_id=identity.user_account.id) OR (target_id=$1 AND user_id=identity.user_account.id)) ORDER BY display_name LIMIT 100`,[u.id])}; }
