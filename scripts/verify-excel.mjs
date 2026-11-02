import fs from 'node:fs';import assert from 'node:assert/strict';
import {readWorkbook,parsePerformance,parseDetail,SOURCES,reconciliation} from '../src/parser.js';
const [performance,manager]=process.argv.slice(2);if(!performance||!manager){console.error('Usage: npm run verify:excel -- performance.xlsx manager.xlsx');process.exit(1);}
const wb=readWorkbook(fs.readFileSync(performance)),o=parsePerformance(wb),mw=readWorkbook(fs.readFileSync(manager));
assert(o.sales.length>0);assert.equal(new Set(o.sales.map(x=>x.name)).size,o.sales.length);
const total=o.depots.reduce((a,d)=>a+d.actual,0);assert(Math.abs(total-o.company.actual)<.01);
const serialized=JSON.stringify(o);for(const name of ['insentif_dasar','insentif_rp','payment','salary'])assert(!serialized.includes(name));
const report={sales:o.sales.length,spv:o.spv.length,asm:o.asm.length,depots:o.depots.length,companyScore:o.company.final,actual:o.company.actual,period:o.period,details:{},cachedScoreMismatches:[]};
for(const metric of Object.keys(SOURCES)){const d=parseDetail(mw,metric,o);assert.equal(d.rows.length,d.meta.length);assert.equal(new Set(d.headers).size,d.headers.length);assert(d.rows.length>0);const check=reconciliation(d,o);report.details[metric]={rows:d.rows.length,unmatched:d.unmatched,conflicts:d.conflicts,min:d.dateMin,max:d.dateMax,closing:d.closingDates,deltaCount:Array.isArray(check)?check.filter(x=>x.delta!==0).length:null};}
// Compare calculations with workbook cached final score by name; no dependence on caches at runtime.
const sheet=wb.Sheets['Skor Sales'];for(let row=6;row<=1000;row++){const name=sheet?.[`A${row}`]?.v;if(!name)continue;const cached=sheet[`K${row}`]?.v,actual=o.sales.find(x=>x.name===name)?.final;if(typeof cached==='number'&&typeof actual==='number'&&Math.abs(cached-actual)>1e-6)report.cachedScoreMismatches.push(name);}
assert.equal(report.cachedScoreMismatches.length,0);console.log(JSON.stringify(report,null,2));
