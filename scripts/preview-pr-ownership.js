'use strict';
// Pure, conservative PR to live-preview correlation. No network access or deletion.
const REPO='73junito/car-diagnosis-simulator';
const normalized=value=>typeof value==='string'?value.replace(/[^a-zA-Z0-9_-]/g,'-').slice(0,128):'';
function classify(row,prs){
 const base={branch:row.branch,builds_preview_id:row.builds_preview_id,live_status:row.live_status,
  identity:row.identity||'unverified',pr_number:null,pr_state:'unknown',ownership:'unverified',
  decision:'retain_pending_review',deletion_authorized:false};
 if(!row.branch||!row.builds_preview_id||!Array.isArray(prs))return base;
 const matched=prs.filter(p=>normalized(p?.head?.ref)===normalized(row.branch));
 if(matched.length!==1)return {...base,ownership:matched.length?'ambiguous_branch':'unmatched_branch'};
 const pr=matched[0];
 const prState=pr.state==='open'?'open':pr.state==='closed'?(pr.merged_at?'merged':'closed_unmerged'):'unknown';
 const owner=pr.head?.repo?.full_name===REPO;
 const linked={...base,pr_number:Number.isInteger(pr.number)?pr.number:null,pr_state:prState,
  ownership:owner?'branch_match_same_repo':'branch_match_foreign_or_missing_repo',
  pr_merged_at:pr.merged_at||null};
 if(!owner||!linked.pr_number)return linked;
 if(prState==='open')return {...linked,decision:'retain_active_pr'};
 if(prState==='closed_unmerged')return {...linked,decision:'retain_closed_unmerged'};
 if(prState!=='merged')return linked;
 // A branch-name match is supporting context, not ownership proof.
 if(row.live_status!=='present_by_name_lookup'||row.identity!=='verified')
  return {...linked,decision:'retain_identity_unverified'};
 return {...linked,ownership:'verified_live_preview_id_plus_pr_branch_context',
  decision:'cleanup_review_only'};
}
function reconcile(manifest,prs){
 if(!manifest?.readOnly||manifest.complete!==true||manifest.scanned!==manifest.rows?.length||manifest.buildsTotal!==manifest.rows.length)
  throw Error('Incomplete or non-read-only Cloudflare preview manifest');
 if(!Array.isArray(prs))throw Error('Missing complete PR inventory');
 const ids=new Set();
 const rows=manifest.rows.map(row=>{
  if(!row.builds_preview_id||ids.has(row.builds_preview_id))throw Error('Duplicate or invalid preview ID');
  ids.add(row.builds_preview_id);return classify(row,prs);
 });
 const counts={};for(const row of rows)counts[row.decision]=(counts[row.decision]||0)+1;
 return {read_only:true,deletion_authorized:false,manifest_created_at:manifest.created_at||null,
  worker:manifest.worker,scanned:rows.length,counts,rows,
  warning:'Only complete PR inventory and actual live preview ID verification can support review. Name matches do not authorize deletion.'};
}
module.exports={classify,reconcile};
