import {z} from 'zod';
import {type User} from './auth';
import {tx,one,hash,need,rate,audit,type Row} from './db';
import {contentCommand} from './content';
import {commerceCommand} from './commerce';
import {creatorCommand} from './creator';
import {adminCommand} from './admin';
import {adsCommand} from './ads';
export async function command(u:User,body:unknown){
 const d=z.object({action:z.string().min(1).max(50),key:z.string().uuid(),data:z.record(z.string(),z.unknown()).default({})}).parse(body);
 await rate((await import('./db')).pool,`command:${u.id}`,180,60);
 return tx(async db=>{
  // MVP serializes mutations. This provides deterministic cross-account financial
  // transactions; replace with ordered entity locks as throughput requires.
  await db.query('SELECT pg_advisory_xact_lock(802005)');
  const fingerprint=hash(JSON.stringify({action:d.action,data:d.data}));
  const old=await one(db,'SELECT * FROM app.command WHERE user_id=$1 AND key=$2',[u.id,d.key]);
  if(old){need(old.fingerprint===fingerprint,'This idempotency key was already used with different data',409);return old.response;}
  let result:Row|undefined;
  for(const handler of [contentCommand,commerceCommand,creatorCommand,adsCommand,adminCommand]){result=await handler(db,u,d.action,d.data);if(result!==undefined)break;}
  need(result,'Unknown command',404);
  await db.query('INSERT INTO app.command(user_id,key,fingerprint,response) VALUES($1,$2,$3,$4)',[u.id,d.key,fingerprint,JSON.stringify(result)]);
  if(!['watch','signal','like','ad-event'].includes(d.action))await audit(db,u.id,d.action,result.id??d.data.id as string|undefined);
  return result;
 });
}
