'use strict';
// Read-only offline joining of existing inventory, Cloudflare analytics and object evidence.
// Lack of analytics groups is UNKNOWN, never zero. No deletion decisions.
const fs=require('fs'),path=require('path');
function correlate(inventoryPayload,requestRows,objectPayload) {
 const inv=inventoryPayload?.inventory||inventoryPayload;
 if(!inv||inv.pagination?.complete!==true||!Array.isArray(inv.namespaces)||inv.namespaces.length!==inv.total_namespaces)throw Error('Incomplete namespace inventory');
 if(!Array.isArray(requestRows)||!objectPayload||!Array.isArray(objectPayload.namespaces)||!Array.isArray(objectPayload.failures))throw Error('Missing input data');
 const requests=new Map();
 for(const row of requestRows){
  if(!row.namespace_id||requests.has(row.namespace_id)||!['measured','unknown_no_group'].includes(row.status))throw Error('Invalid request rows');
  requests.set(row.namespace_id,row);
 }
 const objects=new Map(objectPayload.namespaces.map(x=>[x.name,x]));
 const failures=new Map(objectPayload.failures.map(x=>[x.name,x.reason]));
 const ids=new Set();
 const rows=inv.namespaces.map(n=>{
  if(ids.has(n.id))throw Error('Duplicate namespace ID');ids.add(n.id);
  const req=requests.get(n.id);
  const ob=objects.get(n.name);
  const evidence=ob?.object_enumeration_complete===true?'complete':failures.has(n.name)?'failed':'not_collected';
  const isProtected=n.script!=='autolearnpro-app'||n.name==='autolearnpro-app_TorqueMindRateLimitCounter';
  return {namespace_id:n.id,name:n.name,script:n.script,protected:isProtected,
   requests_30d:req?.status==='measured'?Number(req.requests_30d):null,
   requests_status:req?.status||'not_in_request_report',
   object_evidence_status:evidence,
   object_count:evidence==='complete'?ob.object_count:null,
   has_stored_data:evidence==='complete'?ob.has_stored_data:null,
   preview_ownership:'unverified',binding_active:'unverified',
   assessment:isProtected?'protected':'insufficient_evidence',
   deletion_authorized:false};
 });
 return {summary:{total:rows.length,measured_requests:rows.filter(r=>r.requests_status==='measured').length,unknown_requests:rows.filter(r=>r.requests_30d===null).length,object_evidence_complete:rows.filter(r=>r.object_evidence_status==='complete').length,object_evidence_failed:rows.filter(r=>r.object_evidence_status==='failed').length,protected:rows.filter(r=>r.assessment==='protected').length,deletion_authorized:0},rows};
}
function parseCsv(csv){
 const lines=csv.trim().split(/\r?\n/), cols=lines.shift().split(',');
 const parse=line=>{const out=[];let quoted=false,val='';for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'&&quoted&&line[i+1]==='"'){val+='"';i++;}else if(c==='"')quoted=!quoted;else if(c===','&&!quoted){out.push(val);val='';}else val+=c;}out.push(val);return Object.fromEntries(cols.map((k,i)=>[k,out[i]]));};
 return lines.map(parse);
}
function main(){
 const [, , inventoryPath,requestPath,objectPath,outputDir]=process.argv;
 if(!outputDir)throw Error('Usage: node scripts/correlate-do-usage-evidence.js INVENTORY REQUESTS_CSV OBJECTS_JSON OUTPUT_DIR');
 const j=p=>JSON.parse(fs.readFileSync(p,'utf8'));
 const result=correlate(j(inventoryPath),parseCsv(fs.readFileSync(requestPath,'utf8')),j(objectPath));
 fs.mkdirSync(outputDir,{recursive:true});fs.writeFileSync(path.join(outputDir,'do-evidence-correlation.json'),JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify(result.summary));
}
if(require.main===module)try{main()}catch(e){console.error(e.message);process.exitCode=1}
module.exports={correlate,parseCsv};
