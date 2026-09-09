import {z} from 'zod';
import {randomUUID} from 'node:crypto';
import {type DB,type Row,one,rows,need,flag,notify,requireSandbox} from './db';
import {type User,adult,blocked} from './auth';
import {sellerFor} from './commerce';
import {journal,balance} from './journal';
import {sendGift,clearCommission} from '../packages/ledger/src/index.ts';
import {withhold} from '../packages/money/src/index.ts';
const uuid=z.string().uuid();
export async function clearDue(db:DB){
 const due=await rows(db,`SELECT a.* FROM ledger.commission_accrual a JOIN commerce.order_item i ON i.id=a.order_item_id JOIN commerce.customer_order o ON o.id=i.order_id WHERE a.state='held' AND a.hold_until<=now() AND o.state IN ('delivered','completed') FOR UPDATE OF a`);
 for(const a of due){const entry=await journal(db,clearCommission({orderItemId:a.order_item_id,creatorId:a.creator_id,netPaisa:a.net_paisa}));await db.query("UPDATE ledger.commission_accrual SET state='cleared',cleared_entry_id=$2 WHERE id=$1",[a.id,entry]);}
 await db.query("UPDATE commerce.customer_order SET state='completed' WHERE state='delivered' AND return_window_ends<=now()");
 return due.length;
}
export async function creatorCommand(db:DB,u:User,action:string,raw:Row):Promise<Row|undefined>{
 if(action==='plan'){
  const s=await sellerFor(db,u);const d=z.object({kind:z.enum(['open','targeted','shop']),productId:uuid,rate:z.number().int().min(1).max(2000),creatorId:uuid.optional()}).parse(raw);
  const p=await one(db,'SELECT p.*,c.commission_bp FROM commerce.product p JOIN commerce.category c ON c.id=p.category_id WHERE p.id=$1 AND p.seller_id=$2',[d.productId,s.id]);need(p,'Choose one of your products');
  if(d.kind==='shop'){const minimum=await one(db,'SELECT min(c.commission_bp) rate FROM commerce.product p JOIN commerce.category c ON c.id=p.category_id WHERE seller_id=$1',[s.id]);need(d.rate<=minimum!.rate,'Shop commission cannot exceed the lowest category fee');}else need(d.rate<=p.commission_bp,'Affiliate rate cannot exceed the marketplace fee');
  if(d.kind==='targeted')need(d.creatorId&&d.creatorId!==u.id,'Choose a creator to invite');
  const plan=await one(db,'INSERT INTO affiliate.plan(seller_id,kind,rate_bp) VALUES($1,$2,$3) RETURNING id',[s.id,d.kind,d.rate]);
  await db.query('INSERT INTO affiliate.plan_product(plan_id,product_id) VALUES($1,$2)',[plan!.id,p.id]);if(d.kind==='targeted')await db.query('INSERT INTO affiliate.plan_creator(plan_id,creator_id) VALUES($1,$2)',[plan!.id,d.creatorId]);return {message:'Affiliate plan is active'};
 }
 if(action==='showcase'){
  const d=z.object({productId:uuid,add:z.boolean()}).parse(raw);need(await one(db,'SELECT 1 FROM commerce.product WHERE id=$1 AND is_active',[d.productId]),'Product unavailable');
  if(d.add)await db.query('INSERT INTO affiliate.showcase(creator_id,product_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[u.id,d.productId]);else await db.query('DELETE FROM affiliate.showcase WHERE creator_id=$1 AND product_id=$2',[u.id,d.productId]);return {message:'Showcase updated'};
 }
 if(action==='sample'){
  adult(u);const d=z.object({productId:uuid,pitch:z.string().trim().min(10).max(500)}).parse(raw);
  const p=await one(db,"SELECT p.id,s.owner_id FROM commerce.product p JOIN identity.seller s ON s.id=p.seller_id WHERE p.id=$1 AND p.is_active AND s.state='active'",[d.productId]);need(p&&p.owner_id!==u.id,'Choose another seller’s product');
  await db.query('INSERT INTO affiliate.sample_request(creator_id,product_id,pitch) VALUES($1,$2,$3)',[u.id,d.productId,d.pitch]);await notify(db,p.owner_id,'Sample requested',`${u.display_name} requested a sample`);return {message:'Sample request sent'};
 }
 if(action==='sample-status'){
  const d=z.object({id:uuid,state:z.enum(['approved','rejected','shipped','received','content_posted']),tracking:z.string().max(100).default('')}).parse(raw);
  const s=await one(db,'SELECT r.*,se.owner_id FROM affiliate.sample_request r JOIN commerce.product p ON p.id=r.product_id JOIN identity.seller se ON se.id=p.seller_id WHERE r.id=$1 FOR UPDATE OF r',[d.id]);need(s,'Sample not found',404);
  const flow:Record<string,string[]>={requested:['approved','rejected'],approved:['shipped'],shipped:['received'],received:['content_posted']};need(flow[s.state]?.includes(d.state),'Invalid sample transition',409);
  need(['received','content_posted'].includes(d.state)?s.creator_id===u.id:s.owner_id===u.id,'This sample belongs to another account',403);
  if(d.state==='shipped')need(d.tracking.length>=3,'Enter a tracking reference');
  if(d.state==='content_posted')need(await one(db,"SELECT 1 FROM commerce.post_product pp JOIN content.post p ON p.id=pp.post_id WHERE pp.product_id=$1 AND p.author_id=$2 AND p.state='published'",[s.product_id,u.id]),'Publish a product-tagged post first');
  await db.query('UPDATE affiliate.sample_request SET state=$2,tracking=coalesce(nullif($3,\'\'),tracking),decided_at=now() WHERE id=$1',[d.id,d.state,d.tracking]);return {message:'Sample status updated'};
 }
 if(action==='topup'){
  adult(u);requireSandbox();const amount=z.number().int().min(1000).max(1000000).parse(raw.amount);const id=randomUUID();
  await journal(db,{kind:'coins_purchased',idempotencyKey:`topup:${id}`,description:'Sandbox prepaid digital goods; no real money',lines:[{account:{kind:'cash_mfs'},amount},{account:{kind:'coin_liability',owner:u.id},amount:-amount}]});return {message:'Sandbox credit added. No real payment was made.'};
 }
 if(action==='payout-method'){
  adult(u);const d=z.object({channel:z.enum(['bkash','nagad','rocket','upay','beftn']),account:z.string().regex(/^\+?\d{8,20}$/)}).parse(raw);requireSandbox();
  await db.query('UPDATE identity.payout_method SET is_default=false WHERE user_id=$1',[u.id]);
  await db.query('INSERT INTO identity.payout_method(user_id,channel,account_ref,verified_at,is_default) VALUES($1,$2,$3,now(),true) ON CONFLICT(user_id,channel,account_ref) DO UPDATE SET is_default=true,verified_at=now()',[u.id,d.channel,`sandbox:${d.account}`]);return {message:'Sandbox payout destination saved'};
 }
 if(action==='kyc-submit'){
  adult(u);requireSandbox();await db.query("INSERT INTO identity.kyc_record(subject_id,vault_ref) VALUES($1,$2)",[u.id,`sandbox-review:${randomUUID()}`]);return {message:'Sandbox identity review requested. Do not upload real NID documents.'};
 }
 if(action==='withdraw'){
  adult(u);requireSandbox();await flag(db,'payouts');
  const d=z.object({amount:z.number().int().min(100).max(100000000),source:z.enum(['creator_payable','gift_liability','seller_payable']),simulateFailure:z.boolean().default(false)}).parse(raw);
  need(await one(db,"SELECT 1 FROM identity.kyc_record WHERE subject_id=$1 AND state='verified'",[u.id]),'Identity verification is required before withdrawal',403);
  const method=await one(db,'SELECT * FROM identity.payout_method WHERE user_id=$1 AND is_default AND verified_at IS NOT NULL',[u.id]);need(method,'Save a verified payout destination first');await clearDue(db);
  const owner=d.source==='seller_payable'?(await sellerFor(db,u)).id:u.id;
  let available=await balance(db,d.source,owner);
  if(d.source==='seller_payable'){const held=await one(db,"SELECT coalesce(sum(seller_net_paisa),0) amount FROM commerce.customer_order WHERE seller_id=$1 AND (state='returned' OR state='delivered' AND return_window_ends>now())",[owner]);available-=held!.amount;}
  need(available>=d.amount,'Insufficient cleared balance. Return-window holds are not withdrawable.',409);
  const tax=d.source==='gift_liability'?withhold(d.amount,1000):0;const net=d.amount-tax;
  const p=await one(db,`INSERT INTO ledger.payout(payee_id,payout_method_id,amount_paisa,state,provider_ref,failure_reason,settled_at) VALUES($1,$2,$3,$4,$5,$6,now()) RETURNING id`,[u.id,method.id,net,d.simulateFailure?'failed':'paid',`sandbox-payout-${randomUUID()}`,d.simulateFailure?'Sandbox provider failure; balance unchanged':null]);
  if(!d.simulateFailure){const entry=await journal(db,{kind:'payout_executed',idempotencyKey:`payout:${p!.id}`,description:`Sandbox ${method.channel} payout`,lines:[{account:{kind:d.source,owner},amount:d.amount},{account:{kind:'cash_mfs'},amount:-net},...(tax?[{account:{kind:'tax_withheld' as const},amount:-tax}]:[])]});await db.query('UPDATE ledger.payout SET entry_id=$2 WHERE id=$1',[p!.id,entry]);}
  await notify(db,u.id,d.simulateFailure?'Payout failed':'Sandbox payout completed',d.simulateFailure?'Your balance is unchanged. You may retry.':`${net/100} BDT recorded to ${method.channel}; no real transfer.`);
  return {id:p!.id,message:d.simulateFailure?'Sandbox payout failed. Your balance is unchanged.':'Sandbox payout completed',net,tax};
 }
 if(action==='live-start'){
  adult(u);await flag(db,'live');const d=z.object({title:z.string().trim().min(3).max(100),productId:uuid.optional()}).parse(raw);
  need(!await one(db,"SELECT 1 FROM live.session WHERE host_id=$1 AND state='live'",[u.id]),'You already have a live room');
  if(d.productId)need(await one(db,'SELECT 1 FROM commerce.product WHERE id=$1 AND is_active',[d.productId]),'Product unavailable');
  const s=await one(db,"INSERT INTO live.session(host_id,title,state,started_at,product_id) VALUES($1,$2,'live',now(),$3) RETURNING id",[u.id,d.title,d.productId??null]);return {id:s!.id,message:'Room created. Start your camera to broadcast.'};
 }
 if(action==='live-end'){
  const id=uuid.parse(raw.id);const s=await one(db,"UPDATE live.session SET state='ended',ended_at=now() WHERE id=$1 AND host_id=$2 AND state='live' RETURNING id",[id,u.id]);need(s,'Only the host can end this room',403);return {message:'LIVE ended'};
 }
 if(['gift','live-chat','signal'].includes(action)){
  adult(u);await flag(db,'live');const id=uuid.parse(raw.id);const s=await one(db,"SELECT * FROM live.session WHERE id=$1 AND state='live'",[id]);need(s,'This room has ended',409);need(!await blocked(db,u.id,s.host_id),'Room unavailable',403);
  if(action==='live-chat'){const body=z.string().trim().min(1).max(500).parse(raw.body);need(!/(kill yourself|মরে যা|toke marbo|মেরে ফেলব)/iu.test(body),'Message blocked by Nirapod');await db.query('INSERT INTO live.chat(session_id,user_id,body) VALUES($1,$2,$3)',[id,u.id,body]);return {ok:true};}
  if(action==='signal'){
   const d=z.object({recipientId:uuid,payload:z.record(z.string(),z.unknown())}).parse(raw);need(JSON.stringify(d.payload).length<30000,'Signal too large');
   need(d.recipientId===s.host_id||u.id===s.host_id,'Only host/viewer signalling is permitted',403);
   if(u.id===s.host_id)need(await one(db,"SELECT 1 FROM live.signal WHERE session_id=$1 AND sender_id=$2 AND recipient_id=$3",[id,d.recipientId,u.id]),'Viewer must join before the host can signal');
   need(!await blocked(db,u.id,d.recipientId),'Participant unavailable',403);
   await db.query('INSERT INTO live.signal(session_id,sender_id,recipient_id,payload) VALUES($1,$2,$3,$4)',[id,u.id,d.recipientId,JSON.stringify(d.payload)]);return {ok:true};
  }
  requireSandbox();const giftId=z.number().int().min(1).max(7).parse(raw.giftId);const g=await one(db,'SELECT * FROM live.gift_catalog WHERE id=$1 AND is_active',[giftId]);need(g,'Gift unavailable');need(s.host_id!==u.id,'You cannot gift yourself');
  need(await balance(db,'coin_liability',u.id)>=g.price_paisa,'Add prepaid sandbox credit first',409);
  const sendId=randomUUID();const split=sendGift({sendId,hostId:s.host_id,senderId:u.id,grossPaisa:g.price_paisa});
  const entry=await journal(db,{...split.entry,lines:split.entry.lines.map(l=>l.account.kind==='coin_liability'?{...l,account:{...l.account,owner:u.id}}:l)});
  await db.query('INSERT INTO live.gift_send(session_id,gift_id,sender_id,host_id,gross_paisa,creator_paisa,platform_paisa,entry_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[id,giftId,u.id,s.host_id,g.price_paisa,split.creatorPaisa,split.platformPaisa,entry]);await db.query('UPDATE live.session SET gift_paisa=gift_paisa+$2 WHERE id=$1',[id,g.price_paisa]);return {message:`Gift sent. Creator receives 60%, before sandbox withholding.`};
 }
 if(action==='brief'){
  const s=await sellerFor(db,u);const d=z.object({title:z.string().trim().min(3).max(100),description:z.string().trim().min(10).max(2000),budget:z.number().int().min(100).max(100000000)}).parse(raw);
  await db.query('INSERT INTO app.brief(seller_id,title,description,budget_paisa) VALUES($1,$2,$3,$4)',[s.id,d.title,d.description,d.budget]);return {message:'Brand brief published'};
 }
 if(action==='brief-apply'){
  const d=z.object({id:uuid,pitch:z.string().trim().min(10).max(1000)}).parse(raw);need(await one(db,"SELECT 1 FROM app.brief b JOIN identity.seller s ON s.id=b.seller_id WHERE b.id=$1 AND b.state='open' AND s.owner_id<>$2",[d.id,u.id]),'Brief unavailable');await db.query('INSERT INTO app.application(brief_id,creator_id,pitch) VALUES($1,$2,$3)',[d.id,u.id,d.pitch]);return {message:'Application sent'};
 }
 if(action==='brief-select'){
  const d=z.object({id:uuid,creatorId:uuid}).parse(raw);const s=await sellerFor(db,u);need(await one(db,'SELECT 1 FROM app.brief WHERE id=$1 AND seller_id=$2',[d.id,s.id]),'This brief belongs to another seller',403);need(await one(db,"UPDATE app.application SET state='selected' WHERE brief_id=$1 AND creator_id=$2 RETURNING 1",[d.id,d.creatorId]),'Application not found');await db.query("UPDATE app.brief SET state='assigned' WHERE id=$1",[d.id]);return {message:'Creator selected for this brief'};
 }
 return undefined;
}
