import { readdir,readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
try { process.loadEnvFile('.env.local'); } catch {}
const {pool,tx}=await import('../lib/db');
await tx(async db=>{
 await db.query('SELECT pg_advisory_xact_lock(802004)');
 await db.query('CREATE TABLE IF NOT EXISTS public.bdos_migration(name text PRIMARY KEY,checksum text NOT NULL,applied_at timestamptz DEFAULT now())');
 for(const name of (await readdir('db/migrations')).filter(n=>n.endsWith('.sql')).sort()){
  const sql=await readFile(`db/migrations/${name}`,'utf8');const checksum=createHash('sha256').update(sql).digest('hex');
  const old=(await db.query('SELECT checksum FROM public.bdos_migration WHERE name=$1',[name])).rows[0];
  if(old){if(old.checksum!==checksum)throw new Error(`Migration ${name} changed after application`);continue;}
  await db.query(sql);await db.query('INSERT INTO public.bdos_migration(name,checksum) VALUES($1,$2)',[name,checksum]);console.log(`Applied ${name}`);
 }
});
await pool.end();
