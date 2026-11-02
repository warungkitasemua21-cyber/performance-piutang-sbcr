export const METRICS=['Penjualan','OA','EC','SKU','NOO','Collection'];
export const norm=x=>String(x??'').trim().replace(/\s+/g,' ').toLocaleLowerCase('id-ID');
export const numeric=x=>typeof x==='number'&&Number.isFinite(x)?x:null;
export const sum=a=>a.reduce((x,y)=>x+(numeric(y)??0),0);
export const mean=a=>a.length&&a.every(x=>numeric(x)!==null)?sum(a)/a.length:null;
export const ratio=(a,t)=>numeric(a)!==null&&numeric(t)!==null&&t>0?a/t:null;
export function incentive(sales,kpi,{salesThreshold=.95,kpiThreshold=90,cap=1.2}={}){
 if(numeric(sales)===null||numeric(kpi)===null)return {status:'Data belum lengkap',points:null,basis:'—',factor:null};
 const a=sales>salesThreshold,b=kpi>kpiThreshold,factor=a&&b?1:a||b?.5:0;
 const points=factor?Math.min(a&&!b?sales:kpi/100,cap)*100:0;
 return {status:factor?'Tercapai':'Tidak tercapai',points,basis:a&&!b?'Penjualan':b?'Total KPI':'—',factor};
}
export function ranks(rows,key){return [...rows].map(x=>({...x,rank:numeric(x[key])===null?null:1+rows.filter(y=>numeric(y[key])!==null&&y[key]>x[key]+1e-9).length})).sort((a,b)=>(a.rank??Infinity)-(b.rank??Infinity)||a.name.localeCompare(b.name));}
export function scoreSales(input,cap){
 const warnings=[];const totalWeight=sum(input.metrics.map(m=>m.weight));
 let points=0,coverage=0;
 const metrics=input.metrics.map(m=>{const achievement=ratio(m.actual,m.target),valid=numeric(m.weight)!==null&&m.weight>=0&&(m.weight===0||achievement!==null);
 if(!valid)warnings.push(`${m.name}: target, aktual atau bobot tidak valid`);
 const contribution=valid&&m.weight>0?Math.min(achievement,cap)*m.weight*100:0;
 points+=contribution;if(valid)coverage+=m.weight;
 return {...m,achievement,points:contribution,valid};});
 if(Math.abs(totalWeight-1)>1e-6)warnings.push('Total bobot harus 100%');
 const final=warnings.length?null:points;
 return {...input,metrics,points,final,coverage,salesAchievement:metrics[0].achievement,warnings};
}
export function buildOverview(inputs,rules,period){
 const sales=inputs.map(x=>scoreSales(x,rules.cap));
 const aggregate=(rows,level,name,rule)=>{
 const target=sum(rows.map(x=>x.metrics[0].target)),actual=sum(rows.map(x=>x.metrics[0].actual)),salesAchievement=ratio(actual,target);
 const average=mean(rows.map(x=>x.points)),valid=rows.every(x=>x.final!==null);
 const points=(salesAchievement??0)*rule.salesWeight*100+(average??0)*rule.kpiWeight;
 return {level,name,count:rows.length,target,actual,salesAchievement,average,points,final:valid&&salesAchievement!==null?points:null,depots:[...new Set(rows.map(x=>x.depo))]};
 };
 const spv=[...new Set(sales.map(x=>x.spv))].map(n=>aggregate(sales.filter(x=>x.spv===n),'SPV',n,rules.SPV));
 const asm=[...new Set(sales.map(x=>x.asm))].map(n=>aggregate(sales.filter(x=>x.asm===n),'ASM',n,rules.ASM));
 const allTarget=sum(sales.map(x=>x.metrics[0].target)),allActual=sum(sales.map(x=>x.metrics[0].actual));
 const companyRatio=ratio(allActual,allTarget),asmAverage=mean(asm.map(x=>x.points));
 const points=(companyRatio??0)*rules.company.salesWeight*100+(asmAverage??0)*rules.company.kpiWeight;
 const company={name:'PT SBCR',level:'Perusahaan',target:allTarget,actual:allActual,salesAchievement:companyRatio,average:asmAverage,points,final:asm.every(x=>x.final!==null)&&companyRatio!==null?points:null};
 const depots=[...new Set(sales.map(x=>x.depo))].map(name=>{
 const members=sales.filter(x=>x.depo===name);
 const metrics=METRICS.map((name,i)=>{const ms=members.map(x=>x.metrics[i]);const avg=i===5;const complete=ms.every(x=>numeric(x.actual)!==null&&numeric(x.target)!==null);const target=complete?(avg?mean(ms.map(x=>x.target)):sum(ms.map(x=>x.target))):null,actual=complete?(avg?mean(ms.map(x=>x.actual)):sum(ms.map(x=>x.actual))):null;return {name,target,actual,achievement:ratio(actual,target),method:avg?'Rata-rata rasio Sales':'Jumlah target dan realisasi Sales'};});
 return {name,level:'Depo',count:members.length,metrics,points:mean(members.map(x=>x.points)),final:mean(members.map(x=>x.final)),salesAchievement:metrics[0].achievement,target:metrics[0].target,actual:metrics[0].actual};
 });
 for(const row of [...sales,...spv,...asm,company,...depots])row.incentive=incentive(row.salesAchievement,row.final,rules.incentive);
 return {schema:1,period,rules,sales,spv,asm,company,depots};
}
export function filterRows(rows,headers,filters=[],query=''){
 const q=norm(query);
 return rows.filter(row=>(!q||row.some(v=>norm(v).includes(q)))&&filters.every(f=>{
  const value=row[headers.indexOf(f.column)];const a=norm(value),b=norm(f.value);
  if(f.op==='equals')return a===b;if(f.op==='not')return a!==b;
  if(f.op==='gt'||f.op==='lt')return numeric(value)!==null&&Number.isFinite(Number(f.value))&&(f.op==='gt'?value>Number(f.value):value<Number(f.value));
  if(f.op==='after')return String(value??'')>=f.value;if(f.op==='before')return String(value??'')<=f.value;
  return a.includes(b);
 }));
}

// Recalculate stored datasets with the same model used for fresh Excel imports.
export function recalculateOverview(saved){
 return saved ? buildOverview(saved.sales,saved.rules,saved.period) : null;
}
