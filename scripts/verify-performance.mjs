import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import {readWorkbook,parsePerformance} from '../src/parser.js';
import {recalculateOverview} from '../src/model.js';
const file=process.argv[2];
if(!file)throw Error('Usage: node scripts/verify-performance.mjs performance.xlsx');
const wb=readWorkbook(fs.readFileSync(file)),overview=parsePerformance(wb);
const report=[];
for(const [sheet,records,nameColumn,levelColumn] of [
 ['Skor Sales',overview.sales,0,null],
 ['Skor Pimpinan',[...overview.spv,...overview.asm,overview.company],1,0]
]){
 const rows=XLSX.utils.sheet_to_json(wb.Sheets[sheet],{header:1,defval:null});
 for(const record of records){
  const row=rows.find(r=>r[nameColumn]===record.name&&(levelColumn===null||r[levelColumn]===record.level));
  assert(row,`Missing ${record.level}: ${record.name}`);
  assert.equal(typeof row[10],'number');
  assert(Math.abs(record.final-row[10])<1e-8,`${record.name}: ${record.final} != ${row[10]}`);
  report.push({level:record.level,name:record.name,excel:row[10],dashboard:record.final});
 }
}
const restored=recalculateOverview(JSON.parse(JSON.stringify(overview)));
assert.deepEqual(restored,overview);
assert.equal(overview.sales.length,28);
console.log(JSON.stringify({matched:report.length,results:report},null,2));
