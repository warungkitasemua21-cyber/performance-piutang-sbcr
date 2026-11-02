import {buildOverview,METRICS} from './model.js';
export function demo(){
 const rule={salesWeight:.7,salesTarget:.95,kpiWeight:.3,kpiTarget:90};
 const inputs=Array.from({length:8},(_,i)=>({level:'Sales',name:`Sales Contoh ${i+1}`,depo:['Depo Utara','Depo Selatan','Depo Timur'][i%3],spv:`SPV Contoh ${i%3+1}`,asm:`ASM Contoh ${i%2+1}`,job:'Sales',metrics:METRICS.map((name,j)=>({name,target:[200000000,100,250,30,10,.95][j],actual:[200000000*(.7+i*.06),68+i*6,180+i*10,20+i*2,5+i,.72+i*.025][j],weight:[.35,.25,.2,.1,0,.1][j]}))}));
 return buildOverview(inputs,{cap:1,SPV:rule,ASM:rule,company:rule,incentive:{salesThreshold:.95,kpiThreshold:90,cap:1.2}},'2026-10-26');
}
