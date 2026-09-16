
import { getStore } from "@netlify/blobs";

export async function handler(event){
 const store=getStore("sbcr-embalase");
 if(event.httpMethod==="GET"){
   const data=await store.get("dashboard_data",{type:"json"});
   const history=await store.get("agent_history",{type:"json"});
   return {statusCode:200,body:JSON.stringify({data:data||null,history:history||{}})};
 }
 if(event.httpMethod==="POST"){
   const body=JSON.parse(event.body||"{}");
   if(body.data) await store.setJSON("dashboard_data",body.data);
   if(body.history) await store.setJSON("agent_history",body.history);
   return {statusCode:200,body:JSON.stringify({success:true})};
 }
 return {statusCode:405,body:"Method not allowed"};
}
