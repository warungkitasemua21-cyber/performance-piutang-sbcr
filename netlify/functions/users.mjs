import {createClient} from '@supabase/supabase-js';
const reply=(status,body)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
export default async function handler(req){
 if(!['GET','POST'].includes(req.method))return reply(405,{error:'Metode tidak diizinkan'});
 const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY;
 if(!url||!key)return reply(503,{error:'Konfigurasi server akun belum lengkap'});
 const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const token=req.headers.get('authorization')?.replace(/^Bearer\s+/i,'');
 if(!token)return reply(401,{error:'Silakan masuk'});
 const {data:{user},error:authError}=await db.auth.getUser(token);
 if(authError||!user)return reply(401,{error:'Sesi tidak valid'});
 const {data:profile}=await db.from('profiles').select('role,active').eq('id',user.id).single();
 if(!profile?.active||profile.role!=='admin')return reply(403,{error:'Hanya admin dapat mengelola akun'});
 try{
  if(req.method==='GET'){
   const page=Math.max(0,Number(new URL(req.url).searchParams.get('page'))||0);
   const {data,error,count}=await db.from('profiles').select('id,email,full_name,role,active,created_at',{count:'exact'}).order('created_at',{ascending:false}).range(page*100,page*100+99);
   if(error)throw error;return reply(200,{users:data,count});
  }
  const raw=await req.text();if(raw.length>12000)return reply(413,{error:'Permintaan terlalu besar'});
  const body=JSON.parse(raw);
  if(body.action==='create'){
   if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email||'')||typeof body.password!=='string'||body.password.length<12||!['admin','viewer'].includes(body.role))return reply(400,{error:'Email, peran, atau password (minimal 12 karakter) tidak valid'});
   const {data,error}=await db.auth.admin.createUser({email:body.email,password:body.password,email_confirm:true,user_metadata:{full_name:String(body.name||'').slice(0,100)}});
   if(error)return reply(400,{error:'Akun gagal dibuat. Periksa email yang sudah terdaftar dan ketentuan password.'});
   const {error:pe}=await db.from('profiles').update({role:body.role}).eq('id',data.user.id);
   if(pe){await db.auth.admin.deleteUser(data.user.id);throw pe;}
   return reply(201,{ok:true});
  }
  if(!/^[0-9a-f-]{36}$/i.test(body.id||''))return reply(400,{error:'ID tidak valid'});
  if(body.action==='reset-password'){
   if(typeof body.password!=='string'||body.password.length<12)return reply(400,{error:'Password minimal 12 karakter'});
   const {error}=await db.auth.admin.updateUserById(body.id,{password:body.password});if(error)throw error;return reply(200,{ok:true});
  }
  if(body.action==='update'){
   if(body.id===user.id)return reply(400,{error:'Ubah peran/status sendiri melalui admin lain'});
   if(!['admin','viewer'].includes(body.role)||typeof body.active!=='boolean')return reply(400,{error:'Peran/status tidak valid'});
   const {error}=await db.from('profiles').update({role:body.role,active:body.active}).eq('id',body.id);if(error)throw error;
   return reply(200,{ok:true});
  }
  return reply(400,{error:'Aksi tidak dikenal'});
 }catch{return reply(400,{error:'Operasi gagal. Periksa data dan pastikan masih ada admin aktif.'});}
}
