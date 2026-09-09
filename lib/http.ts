import {ZodError} from 'zod';
import {AppError,need} from './db';
export function origin(request:Request){
 const incoming=request.headers.get('origin');const allowed=process.env.APP_ORIGIN??'http://localhost:3000';
 need(incoming===allowed,'Request origin is not allowed',403);
 need(request.headers.get('sec-fetch-site')!=='cross-site','Cross-site requests are not allowed',403);
}
export function failure(error:unknown){
 if(error instanceof ZodError)return Response.json({error:error.issues.map(i=>`${i.path.join('.')}: ${i.message}`).join('; ')},{status:400});
 if(error instanceof AppError)return Response.json({error:error.message},{status:error.status});
 const code=(error as {code?:string})?.code;
 if(code==='23505')return Response.json({error:'This already exists. Refresh to see its current status.'},{status:409});
 if(['23503','23514','22P02'].includes(code??''))return Response.json({error:'Invalid record or value. Refresh and try again.'},{status:400});
 console.error('[bdos]',error instanceof Error?error.message:error);
 return Response.json({error:'The operation could not finish. Please retry. If it persists, contact operations.'},{status:500});
}
