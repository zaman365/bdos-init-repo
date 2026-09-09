import {z} from 'zod';
import {randomUUID} from 'node:crypto';
import {type DB,type Row,one,need,flag,requireSandbox} from './db';
import {type User,adult,blocked} from './auth';
import {sellerFor} from './commerce';
import {journal,balance} from './journal';
const uuid=z.string().uuid();
export async function adsCommand(db:DB,u:User,action:string,raw:Row):Promise<Row|undefined>{
 if(action==='spark-consent'){
  const d=z.object({postId:uuid,sellerId:uuid,grant:z.boolean()}).parse(raw);
  need(await one(db,"SELECT 1 FROM content.post WHERE id=$1 AND author_id=$2 AND state='published'",[d.postId,u.id]),'You can only authorise your own published posts',403);
  if(d.grant)await db.query('INSERT INTO ads.consent(post_id,seller_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[d.postId,d.sellerId]);else{
   await db.query('DELETE FROM ads.consent WHERE post_id=$1 AND seller_id=$2',[d.postId,d.sellerId]);
   await db.query("UPDATE ads.campaign SET state='paused' WHERE id IN (SELECT c.campaign_id FROM ads.creative c JOIN ads.advertiser a ON a.seller_id=$2 WHERE c.post_id=$1 AND a.id=ads.campaign.advertiser_id)",[d.postId,d.sellerId]);
  }
  return {message:d.grant?'Promotion permission granted. Creator receives 10% of ad spend.':'Permission revoked; promotions paused'};
 }
 if(action==='campaign'){
  await flag(db,'ads');adult(u);const s=await sellerFor(db,u);
  const d=z.object({name:z.string().trim().min(3).max(100),postId:uuid,productId:uuid,objective:z.enum(['reach','traffic','engagement','conversion','product_sales']),budget:z.number().int().min(100).max(100000000),daily:z.number().int().min(100).max(100000000),bid:z.number().int().min(1).max(10000)}).parse(raw);need(d.daily<=d.budget,'Daily budget must fit within the total budget');
  need(await one(db,'SELECT 1 FROM commerce.product WHERE id=$1 AND seller_id=$2 AND is_active',[d.productId,s.id]),'Choose one of your active products');
  const consent=await one(db,"SELECT c.* FROM ads.consent c JOIN content.post p ON p.id=c.post_id WHERE c.post_id=$1 AND c.seller_id=$2 AND p.state='published'",[d.postId,s.id]);need(consent,'Recorded creator permission is required for Spark promotion',403);
  let ad=await one(db,'SELECT id FROM ads.advertiser WHERE owner_id=$1',[u.id]);if(!ad)ad=await one(db,'INSERT INTO ads.advertiser(owner_id,seller_id,name) VALUES($1,$2,$3) RETURNING id',[u.id,s.id,s.trade_name]);
  const c=await one(db,`INSERT INTO ads.campaign(advertiser_id,name,objective,pricing,state,daily_budget_paisa,total_budget_paisa,bid_paisa,product_id) VALUES($1,$2,$3,'cpm','pending_review',$4,$5,$6,$7) RETURNING id`,[ad!.id,d.name,d.objective,d.daily,d.budget,d.bid,d.productId]);
  await db.query('INSERT INTO ads.creative(campaign_id,post_id,is_spark,creator_consent_at,revshare_bp) VALUES($1,$2,true,$3,1000)',[c!.id,d.postId,consent.granted_at]);return {id:c!.id,message:'Campaign submitted for review'};
 }
 if(action==='campaign-toggle'){
  const d=z.object({id:uuid,active:z.boolean()}).parse(raw);const c=await one(db,'SELECT c.* FROM ads.campaign c JOIN ads.advertiser a ON a.id=c.advertiser_id WHERE c.id=$1 AND a.owner_id=$2',[d.id,u.id]);need(c,'Campaign belongs to another advertiser',403);need(['active','paused'].includes(c.state),'Campaign must be approved before activation',409);await db.query('UPDATE ads.campaign SET state=$2 WHERE id=$1',[d.id,d.active?'active':'paused']);return {message:'Campaign updated'};
 }
 if(action==='ad-event'){
  await flag(db,'ads');requireSandbox();const d=z.object({id:uuid,kind:z.enum(['impression','click'])}).parse(raw);
  const c=await one(db,`SELECT c.*,a.owner_id,a.seller_id,cr.post_id,p.author_id FROM ads.campaign c JOIN ads.advertiser a ON a.id=c.advertiser_id JOIN ads.creative cr ON cr.campaign_id=c.id JOIN content.post p ON p.id=cr.post_id JOIN ads.consent con ON con.post_id=p.id AND con.seller_id=a.seller_id WHERE c.id=$1 AND c.state='active' AND p.state='published' AND c.starts_at<=now() AND (c.ends_at IS NULL OR c.ends_at>now()) FOR UPDATE OF c`,[d.id]);need(c,'Campaign unavailable',409);
  need(c.owner_id!==u.id&&c.author_id!==u.id&&!await blocked(db,u.id,c.author_id),'Self impressions are not billable');
  // Only issueable placements can be billed; the client cannot invent inventory.
  need(await one(db,"SELECT 1 FROM ads.placement WHERE campaign_id=$1 AND user_id=$2 AND expires_at>now()",[d.id,u.id]),'Load an eligible ad placement before recording an event',403);
  if(d.kind==='click')need(await one(db,"SELECT 1 FROM ads.event WHERE campaign_id=$1 AND user_id=$2 AND kind='impression' AND day=current_date",[d.id,u.id]),'An impression is required before a click');
  const previous=await one(db,'SELECT 1 FROM ads.event WHERE campaign_id=$1 AND user_id=$2 AND kind=$3 AND day=current_date',[d.id,u.id,d.kind]);if(previous)return {ok:true};
  const cost=d.kind==='impression'?c.bid_paisa:0;
  const daily=(await one(db,'SELECT coalesce(sum(cost_paisa),0) amount FROM ads.event WHERE campaign_id=$1 AND day=current_date',[d.id]))!.amount;
  need(c.spent_paisa+cost<=c.total_budget_paisa&&daily+cost<=c.daily_budget_paisa,'Campaign budget exhausted',409);
  if(cost){need(await balance(db,'coin_liability',c.owner_id)>=cost,'Advertiser credit exhausted',409);const creator=Math.floor(cost/10);await journal(db,{kind:'manual_correction',idempotencyKey:`ad:${randomUUID()}`,description:'Sandbox Spark impression; 10% creator revenue share',lines:[{account:{kind:'coin_liability',owner:c.owner_id},amount:cost},{account:{kind:'platform_revenue'},amount:-(cost-creator)},...(creator?[{account:{kind:'gift_liability' as const,owner:c.author_id},amount:-creator}]:[])]});}
  await db.query('INSERT INTO ads.event(campaign_id,user_id,kind,cost_paisa) VALUES($1,$2,$3,$4)',[d.id,u.id,d.kind,cost]);await db.query("UPDATE ads.campaign SET spent_paisa=spent_paisa+$2,state=CASE WHEN spent_paisa+$2>=total_budget_paisa THEN 'exhausted'::ads.campaign_state ELSE state END WHERE id=$1",[d.id,cost]);return {ok:true};
 }
 return undefined;
}
