export const aliases:Record<string,string>={kacchi:'কাচ্চি',biriyani:'বিরিয়ানি',jamdani:'জামদানি',kurti:'কুর্তি',shapla:'শাপলা',dhaka:'ঢাকা',skincare:'স্কিনকেয়ার',beauty:'বিউটি'};
export function searchTerms(q:string){const n=q.trim().toLowerCase().slice(0,100);return [...new Set([n,...Object.entries(aliases).flatMap(([a,b])=>n.includes(a)?[n.replaceAll(a,b)]:n.includes(b)?[n.replaceAll(b,a)]:[])])];}
export interface Candidate {id:string;author_id:string;plays:number;completions:number;likes:number;reports:number;served_impressions:number;guaranteed_impressions:number;published_at:string|Date}
export function rank<T extends Candidate>(items:T[],now=Date.now()):T[]{
 const scored=items.map(p=>({p,score:((p.completions+1)/(p.plays+5))*4+Math.log1p(p.likes)*.15-Math.log1p(p.reports)*.6+Math.max(0,1-(now-new Date(p.published_at).getTime())/259200000)+(p.served_impressions<p.guaranteed_impressions?1.5:0)})).sort((a,b)=>b.score-a.score||a.p.id.localeCompare(b.p.id));
 const result:T[]=[];
 while(scored.length){let i=scored.findIndex(s=>result.slice(-2).every(p=>p.author_id!==s.p.author_id));if(i<0)i=0;result.push(scored.splice(i,1)[0].p);}
 return result;
}
