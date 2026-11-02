import * as XLSX from 'xlsx';
import {METRICS,norm,numeric,buildOverview,sum} from './model.js';
export const SOURCES={NOO:'NOO',OA:'Check OA',SKU:'Check SKU',EC:'Check EC',Collection:'Collectionpiutang'};
const matrix=(wb,name)=>{const sheet=wb.Sheets[name];if(!sheet)throw new Error(`Sheet wajib tidak ditemukan: ${name}`);return XLSX.utils.sheet_to_json(sheet,{header:1,defval:null,blankrows:true,raw:true});};
const cell=(wb,sheet,address,fallback)=>{const x=wb.Sheets[sheet]?.[address]?.v;return x??fallback;};
// Excel dates have no timezone. Preserve their local calendar fields, not UTC shifts.
const clean=v=>v instanceof Date?`${v.getFullYear()}-${String(v.getMonth()+1).padStart(2,'0')}-${String(v.getDate()).padStart(2,'0')}`:typeof v==='string'?v.trim():v??null;
export function readWorkbook(buffer){return XLSX.read(buffer,{type:'array',cellDates:true,cellFormula:false,cellHTML:false,cellText:false});}
export function parsePerformance(wb){
 const rows=matrix(wb,'Input Sales'),headerIndex=rows.findIndex(r=>r.some(x=>norm(x)==='nama salesman'));if(headerIndex<0)throw new Error('Header Nama Salesman tidak ditemukan');
 const h=rows[headerIndex],idx=name=>h.findIndex(x=>norm(x)===norm(name));
 const required=['Depo','SPV','ASM','Nama Salesman','Jabatan','Target Omzet (Rp)','Realisasi Omzet (Rp)','Bobot Omset','Target OA','Realisasi OA','Bobot OA','Target EC','Realisasi EC','Bobot EC','Target SKU','Realisasi SKU','Bobot SKU','Target NOO','Realisasi NOO','Bobot NOO','Target Collection','Pencapaian Collection','Bobot Collection'];
 for(const name of required)if(idx(name)<0)throw new Error(`Kolom wajib: ${name}`);
 const metrics=[['Target Omzet (Rp)','Realisasi Omzet (Rp)','Bobot Omset'],['Target OA','Realisasi OA','Bobot OA'],['Target EC','Realisasi EC','Bobot EC'],['Target SKU','Realisasi SKU','Bobot SKU'],['Target NOO','Realisasi NOO','Bobot NOO'],['Target Collection','Pencapaian Collection','Bobot Collection']];
 const inputs=rows.slice(headerIndex+1).filter(r=>r[idx('Nama Salesman')]).map(r=>{
 const weights=metrics.map(m=>numeric(r[idx(m[2])]));
 if(weights[4]===null&&Math.abs(sum(weights)-1)<1e-6)weights[4]=0;
 const item={level:'Sales',name:String(r[idx('Nama Salesman')]).trim(),depo:String(r[idx('Depo')]??'').trim(),spv:String(r[idx('SPV')]??'').trim(),asm:String(r[idx('ASM')]??'').trim(),job:String(r[idx('Jabatan')]??''),metrics:metrics.map((m,i)=>({name:METRICS[i],target:numeric(r[idx(m[0])]),actual:numeric(r[idx(m[1])]),weight:weights[i]}))};
 if(!item.depo||!item.spv||!item.asm)throw new Error(`Mapping depo/SPV/ASM kosong: ${item.name}`);return item;
 });
 if(!inputs.length)throw new Error('Input Sales tidak berisi data');
 if(new Set(inputs.map(x=>norm(x.name))).size!==inputs.length)throw new Error('Nama Sales duplikat. Perbaiki sebelum publikasi.');
 const rule=(a,b)=>({salesWeight:Number(cell(wb,'Aturan KPI',`C${a}`,NaN)),salesTarget:Number(cell(wb,'Aturan KPI',`D${a}`,NaN)),kpiWeight:Number(cell(wb,'Aturan KPI',`C${b}`,NaN)),kpiTarget:Number(cell(wb,'Aturan KPI',`D${b}`,NaN))});
 const rules={cap:Number(cell(wb,'Aturan KPI','D12',1)),SPV:rule(6,7),ASM:rule(8,9),company:rule(10,11),incentive:{salesThreshold:Number(cell(wb,'Aturan KPI','I24',.95)),kpiThreshold:Number(cell(wb,'Aturan KPI','I25',90)),cap:Number(cell(wb,'Aturan KPI','I29',1.2))}};
 for(const r of [rules.SPV,rules.ASM,rules.company])if(!Object.values(r).every(Number.isFinite)||r.salesTarget<=0||r.kpiTarget<=0||r.salesWeight<0||r.kpiWeight<0||Math.abs(r.salesWeight+r.kpiWeight-1)>1e-6)throw new Error('Aturan KPI SPV/ASM/perusahaan tidak valid');
 if(!(rules.cap>0&&rules.incentive.cap>0&&rules.incentive.salesThreshold>0&&rules.incentive.kpiThreshold>0))throw new Error('Batas pencapaian/pengali tidak valid');
 let period=clean(cell(wb,'Aturan KPI','D13',null));if(typeof period==='number')period=XLSX.SSF.format('yyyy-mm-dd',period);
 const overview=buildOverview(inputs,rules,period);
 return overview; // Whitelist: no Input Sales AA, no Insentif Tim amounts, no workbook copy in this object.
}
function uniqueHeaders(row){const count=new Map();return row.map((x,i)=>{const base=x===null||x===''?`Kolom ${XLSX.utils.encode_col(i)}`:String(x).trim(),key=norm(base),n=(count.get(key)||0)+1;count.set(key,n);return n===1?base:`${base} (${n})`;});}
export function parseDetail(wb,metric,overview){
 const sheet=SOURCES[metric],grid=matrix(wb,sheet);
 const hi=grid.slice(0,40).findIndex(r=>metric==='Collection'?r.some(x=>norm(x)==='no. faktur')&&r.some(x=>norm(x)==='customer'):r.some(x=>norm(x)==='id toko')&&r.some(x=>norm(x)==='salesman'));
 if(hi<0)throw new Error(`Header detail tidak dikenali pada ${sheet}`);
 let raw=grid[hi];while(raw.length&&raw.at(-1)==null)raw=raw.slice(0,-1);
 const headers=uniqueHeaders(raw),id=raw.findIndex(x=>norm(x)===(metric==='Collection'?'no. faktur':'id'));
 const find=names=>raw.findIndex(x=>names.includes(norm(x)));
 const indices={sales:find(['salesman']),depo:find(['depo','gudang']),customer:find(['nama toko','customer']),customerId:find(['id toko','id customer']),spv:find(['spv sales','spv']),asm:find(['asm']),date:find(['tanggal','tanggal faktur']),closing:find(['tgl closing']),cek:find(['cek']),order:find(['id_order','no. faktur'])};
 const roster=new Map(overview.sales.map(x=>[norm(x.name),x]));let unmatched=0,conflicts=0;
 const rows=[];const meta=[];const dates=new Set(),closing=new Set();
 for(let n=hi+1;n<grid.length;n++){
 const r=grid[n];if(r[id]===null||r[id]===undefined||r[id]==='')continue;
 const values=headers.map((_,i)=>clean(r[i]));const match=roster.get(norm(values[indices.sales]));
 if(!match)unmatched++;
 if(match&&indices.spv>=0&&values[indices.spv]&&norm(values[indices.spv])!==norm(match.spv))conflicts++;
 rows.push(values);meta.push({sourceRow:n+1,sales:match?.name??String(values[indices.sales]??''),depo:String(values[indices.depo]??''),spv:match?.spv??String(values[indices.spv]??''),asm:match?.asm??String(values[indices.asm]??''),matched:!!match});
 if(indices.date>=0&&/^\d{4}-\d{2}-\d{2}$/.test(values[indices.date]??''))dates.add(values[indices.date]);
 if(indices.closing>=0&&values[indices.closing])closing.add(String(values[indices.closing]));
 }
 const sorted=[...dates].sort();
 return {metric,sheet,headers,indices,rows,meta,count:rows.length,unmatched,conflicts,dateMin:sorted[0]??null,dateMax:sorted.at(-1)??null,closingDates:[...closing].sort(),headerRow:hi+1};
}
export function reconciliation(detail,overview){
 if(detail.metric==='Collection')return {note:'Detail Collection berisi histori faktur. Rasio KPI mengikuti input performance; bukan jumlah pembayaran historis / pembelian historis.'};
 const field=overview.sales[0]?.metrics.findIndex(m=>m.name===detail.metric);
 return overview.sales.map(s=>{const ids=detail.meta.map((m,i)=>m.sales===s.name?i:-1).filter(i=>i>=0),cek=detail.indices.cek;
 const count=cek>=0?sum(ids.map(i=>detail.rows[i][cek])):null;
 return {sales:s.name,overview:s.metrics[field]?.actual??null,detailCek:count,detailRows:ids.length,delta:count===null||s.metrics[field]?.actual===null?null:count-s.metrics[field].actual};});
}
