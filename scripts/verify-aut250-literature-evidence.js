'use strict';
const fs=require('node:fs');
const path=require('node:path');
const registry=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/curriculum/aut250-literature-evidence.json'),'utf8'));
function verify(data){
 const errors=[];
 if(data.schemaVersion!=='1.0.0'||data.registryType!=='aut250-literature-evidence'||data.course!=='AUT-250')errors.push('registry identity invalid');
 if(!Array.isArray(data.sources)||data.sources.length===0)return {valid:false,errors:[...errors,'sources missing']};
 const ids=new Set();
 for(const s of data.sources){
  if(!s.source_id||ids.has(s.source_id))errors.push('missing or duplicate source_id');
  ids.add(s.source_id);
  if(s.course!=='AUT-250'||!s.publisher||!s.title||!s.source_type||!Array.isArray(s.units)||s.units.length===0||!Array.isArray(s.topics)||s.topics.length===0)errors.push('source metadata incomplete: '+s.source_id);
  if(s.canonical_url!==null&&(!/^https:\/\//.test(s.canonical_url)))errors.push('invalid URL: '+s.source_id);
  if(s.reuse_mode!=='external-link-only'||s.content_ingestion_allowed!==false||s.rag_allowed!==false||s.figure_reuse_allowed!==false||s.assessment_authority!==false)errors.push('unsafe reuse or authority: '+s.source_id);
  if(s.license_review!=='pending'||s.technical_review!=='pending')errors.push('unsubstantiated approval: '+s.source_id);
 }
 return {valid:errors.length===0,errors,count:data.sources.length};
}
if(require.main===module){const result=verify(registry);console.log(JSON.stringify(result));if(!result.valid)process.exitCode=1}
module.exports={verify};
