import {readWorkbook,parsePerformance,parseDetail,reconciliation,SOURCES} from './parser.js';
self.onmessage=async({data})=>{try{
 self.postMessage({type:'progress',message:'Membaca workbook performance…'});
 const overview=parsePerformance(readWorkbook(data.performance));
 self.postMessage({type:'progress',message:'Membaca rincian laporan manager…'});
 const master=readWorkbook(data.manager),details={},checks={};
 for(const metric of Object.keys(SOURCES)){self.postMessage({type:'progress',message:`Memproses detail ${metric}…`});details[metric]=parseDetail(master,metric,overview);checks[metric]=reconciliation(details[metric],overview);}
 self.postMessage({type:'done',overview,details,checks});
 }catch(error){self.postMessage({type:'error',message:error.message});}};
