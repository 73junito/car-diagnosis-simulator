const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {verify}=require('../scripts/verify-preview-lifecycle-contract');
const root=path.resolve(__dirname,'..');
test('existing preview isolation and protected cleanup contract passes',()=>{const r=verify(root);expect(r.pass).toBe(true);expect(r.deletion_authorized).toBe(false);expect(r.contract.preview_binding).toBe('TORQUEMIND_RATE_LIMITER')});
test('removing preview binding fails closed',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'preview-contract-'));
 try{
  for(const f of ['wrangler.app.jsonc','scripts/reconcile-cloudflare-previews.js','.github/workflows/cloudflare-preview-reconciliation.yml','.github/workflows/cloudflare-preview-cleanup.yml']){
   const target=path.join(dir,f);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(root,f),target);
  }
  const p=path.join(dir,'wrangler.app.jsonc');let c=fs.readFileSync(p,'utf8');c=c.replace(/"previews":\s*{\s*"durable_objects":\s*{\s*"bindings":\s*\[[\s\S]*?\]\s*},/,'"previews": {"durable_objects":{"bindings":[]},');
  fs.writeFileSync(p,c);
  const result=verify(dir);expect(result.pass).toBe(false);expect(result.errors).toEqual(expect.arrayContaining([expect.stringContaining('Preview rate limiter')]));
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
