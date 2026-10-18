'use strict';
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root&&root.document)api.mount(root.document);
})(typeof window!=='undefined'?window:null,function(){
 function review(d){
  const issues=[];
  if(!/^draft-[a-z0-9-]{4,64}$/.test(d.id||''))issues.push('Use a draft- identifier (lowercase letters, digits and hyphens).');
  if(!['OBD_I','OBD_II'].includes(d.protocol))issues.push('Choose a supported protocol.');
  if(!['apply','analyze','evaluate'].includes(d.bloom))issues.push('Choose a supported learning level.');
  for(const k of ['stem','expectedEvidence','rationale'])if(typeof d[k]!=='string'||d[k].trim().length<15)issues.push(k+' needs at least 15 characters.');
  if(d.sourceId && (!Number.isInteger(d.page)||d.page<1))issues.push('A source requires a valid page reference.');
  if(d.page!==null&&!d.sourceId)issues.push('A page requires a source identifier.');
  if(!d.applicability)issues.push('Document vehicle/system applicability or say not verified.');
  const packageDraft={...d,courseId:'aut-250',competencyId:'ug-aut250-systematic-diagnostics',status:'draft_needs_independent_review',technicalSmeApproved:false,sourceRightsApproved:false,instructorApproved:false,assessmentEligible:false,productionPublishAllowed:false};
  return {valid:issues.length===0,issues,draft:packageDraft};
 }
 function mount(doc){
  const form=doc.getElementById('author');if(!form)return;
  const get=id=>doc.getElementById(id).value.trim();
  const status=doc.getElementById('status'),output=doc.getElementById('output'),copy=doc.getElementById('copy');
  let last=null;
  form.addEventListener('submit',e=>{
   e.preventDefault();last=null;copy.disabled=true;
   const rawPage=get('page');
   const result=review({id:get('itemId'),protocol:get('protocol'),bloom:get('level'),stem:get('stem'),expectedEvidence:get('answer'),rationale:get('rationale'),sourceId:get('source')||null,page:rawPage===''?null:Number(rawPage),applicability:get('applicability')});
   if(!result.valid){status.textContent='Draft requires corrections: '+result.issues.join(' ');output.textContent='No review package generated.';return;}
   last=JSON.stringify(result.draft,null,2);output.textContent=last;status.textContent='Draft validated for independent review only. Not published.';copy.disabled=false;
  });
  copy.addEventListener('click',()=>{if(last&&typeof navigator!=='undefined'&&navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(last).catch(()=>{status.textContent='Copy unavailable; select the draft text manually.';});});
 }
 return {review,mount};
});
