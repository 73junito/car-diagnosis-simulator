const fs = require('fs/promises');
const path = require('path');

async function exists(p){
  try{ await fs.access(p); return true; }catch{return false}
}

async function copyIfExists(src, dest){
  if (await exists(src)){
    await fs.cp(src, dest, { recursive: true });
    console.log('Copied', src, '->', dest);
  }
}

async function main(){
  const root = process.cwd();
  const tmp = path.join(root, 'public_tmp_' + Date.now());
  const out = path.join(root, 'public');

  await fs.mkdir(tmp, { recursive: true });

  // Files to copy from repo root
  const files = ['index.html','style.css','script.js','theme.css'];
  for (const f of files){
    const src = path.join(root, f);
    const dest = path.join(tmp, f);
    await copyIfExists(src, dest);
  }

  // Copy version.json from existing public (write-version writes it there)
  const versionSrc = path.join(root, 'public', 'version.json');
  if (await exists(versionSrc)){
    await copyIfExists(versionSrc, path.join(tmp, 'version.json'));
  } else if (await exists(path.join(root,'version.json'))){
    await copyIfExists(path.join(root,'version.json'), path.join(tmp,'version.json'));
  }

  // Directories to copy
  const dirs = ['dashboard','assets','data'];
  for (const d of dirs){
    const src = path.join(root, d);
    const dest = path.join(tmp, d);
    await copyIfExists(src, dest);
  }

  // Finalize: remove old public and rename tmp
  if (await exists(out)){
    await fs.rm(out, { recursive: true, force: true });
  }
  await fs.rename(tmp, out);
  console.log('Static public/ prepared.');
}

main().catch(err=>{
  console.error(err);
  process.exit(1);
});
