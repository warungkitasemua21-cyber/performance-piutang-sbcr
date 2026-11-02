import test from 'node:test';import assert from 'node:assert/strict';
import {incentive,filterRows,ranks,scoreSales} from '../src/model.js';
test('incentive strict thresholds and cap, without currency fields',()=>{
 for(const [a,b,status,points,factor] of [[.95,90,'Tidak tercapai',0,0],[.96,80,'Tercapai',96,.5],[1.4,80,'Tercapai',120,.5],[.9,91,'Tercapai',91,.5],[.96,91,'Tercapai',91,1],[1.4,140,'Tercapai',120,1]]){const r=incentive(a,b);assert.equal(r.status,status);assert.equal(r.points,points);assert.equal(r.factor,factor);assert.equal('amount' in r,false);}
 assert.equal(incentive(null,90).points,null);
});
test('rank ties and unknowns',()=>{const r=ranks([{name:'A',final:90},{name:'B',final:90},{name:'C',final:80},{name:'D',final:null}],'final');assert.deepEqual(r.map(x=>x.rank),[1,1,3,null]);});
test('zero target with positive weight is unavailable; zero actual is valid',()=>{const m={name:'X',target:0,actual:0,weight:1};assert.equal(scoreSales({metrics:[m]},1).final,null);assert.equal(scoreSales({metrics:[{...m,target:10}]},1).final,0);});
test('filters use literal text, support numeric and date comparisons',()=>{const h=['name','amount','date'],r=[['A|B',10,'2026-10-21'],['A',20,'2026-10-22']];assert.equal(filterRows(r,h,[{column:'name',op:'equals',value:'A|B'}]).length,1);assert.equal(filterRows(r,h,[{column:'amount',op:'gt',value:'15'}])[0][0],'A');assert.equal(filterRows(r,h,[{column:'date',op:'before',value:'2026-10-21'}]).length,1);});

test('leader weights match Excel without threshold normalization or extra cap',async()=>{
 const {buildOverview,recalculateOverview}=await import('../src/model.js');
 const rule={salesWeight:.7,kpiWeight:.3,salesTarget:.95,kpiTarget:90};
 const rules={cap:1.2,SPV:rule,ASM:rule,company:rule};
 const inputs=[{name:'A',spv:'S',asm:'M',depo:'D',metrics:['Penjualan','OA','EC','SKU','NOO','Collection'].map((name,i)=>({name,target:100,actual:150,weight:i===0?1:0}))}];
 const o=buildOverview(inputs,rules,'2026-10-31');
 assert.equal(o.sales[0].final,120);
 assert.equal(o.spv[0].final,141);
 assert.equal(o.asm[0].final,141);
 assert(Math.abs(o.company.final-147.3)<1e-10);
 const old=structuredClone(o);old.spv[0].final=999;old.asm[0].final=999;
 assert.deepEqual(recalculateOverview(old),o);
 assert.equal(recalculateOverview(null),null);
});
