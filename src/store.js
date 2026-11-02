import {createClient} from '@supabase/supabase-js';
const url=import.meta.env.VITE_SUPABASE_URL,key=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const configured=!!url&&!!key&&!url.includes('YOUR_PROJECT');
export const db=configured?createClient(url,key):null;
export async function profile(){const {data:{user}}=await db.auth.getUser();if(!user)return null;const {data,error}=await db.from('profiles').select('*').eq('id',user.id).single();if(error)throw error;return data;}
export async function current(){const {data,error}=await db.from('app_state').select('active_dataset,updated_at').eq('id',1).single();if(error)throw error;return data;}
export async function dataset(id){const {data,error}=await db.from('datasets').select('*').eq('id',id).single();if(error)throw error;return data;}
export async function json(path){const {data,error}=await db.storage.from('sbcr-data').download(path);if(error)throw error;return JSON.parse(await data.text());}
async function put(bucket,path,body,type){const {error}=await db.storage.from(bucket).upload(path,body,{contentType:type,upsert:false,cacheControl:'3600'});if(error)throw error;}
export async function publish(parsed,files,period,label,expected,onProgress){
 const id=crypto.randomUUID(),paths=[],metrics={};
 const save=async(name,value)=>{const path=`${id}/${name}.json`;await put('sbcr-data',path,new Blob([JSON.stringify(value)],{type:'application/json'}),'application/json');paths.push(path);return path;};
 const overview=await save('overview',{...parsed.overview,period});
 for(const [metric,detail] of Object.entries(parsed.details)){
  const {rows,meta,...info}=detail,parts=[];
  for(let i=0;i<rows.length;i+=5000){onProgress(`Menyimpan ${metric}: ${Math.min(i+5000,rows.length).toLocaleString('id-ID')} / ${rows.length.toLocaleString('id-ID')} baris`);parts.push(await save(`${metric}-${i/5000}`,{rows:rows.slice(i,i+5000),meta:meta.slice(i,i+5000)}));}
  if(!parts.length)parts.push(await save(`${metric}-0`,{rows:[],meta:[]}));
  metrics[metric]={...info,parts};
 }
 const checks=await save('checks',parsed.checks);
 for(const [name,file] of Object.entries(files)){onProgress(`Menyimpan arsip admin: ${file.name}`);await put('sbcr-raw',`${id}/${name}.xlsx`,file,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');}
 const manifest={schema:1,overview,metrics,checks,paths,sources:Object.fromEntries(Object.entries(files).map(([k,v])=>[k,{name:v.name,size:v.size}]))};
 onProgress('Mengaktifkan versi untuk seluruh pengguna…');
 const {error}=await db.rpc('publish_dataset',{p_id:id,p_label:label,p_period:period,p_manifest:manifest,p_expected:expected});if(error)throw error;
 return id;
}
export async function loadDetail(info,onProgress=()=>{}){
 const rows=[],meta=[];
 for(let i=0;i<info.parts.length;i+=3){const batch=await Promise.all(info.parts.slice(i,i+3).map(json));for(const x of batch){rows.push(...x.rows);meta.push(...x.meta);}onProgress(Math.min(i+3,info.parts.length),info.parts.length);}
 return {...info,rows,meta};
}
export async function users(body,page=0){const {data:{session}}=await db.auth.getSession();if(!session)throw Error('Silakan masuk');const res=await fetch(`/.netlify/functions/users?page=${page}`,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${session.access_token}`,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});const data=await res.json();if(!res.ok)throw Error(data.error||'Operasi akun gagal');return data;}
