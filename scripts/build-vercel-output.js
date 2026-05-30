const fs = require('fs');
const path = require('path');

async function copyDir(src, dest) {
  await fs.promises.mkdir(dest, { recursive: true });
  const entries = await fs.promises.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else if (entry.isFile()) {
      await fs.promises.copyFile(srcPath, destPath);
    }
  }
}

async function main() {
  const publicDir = path.resolve(__dirname, '..', 'public');
  const outDir = path.resolve(__dirname, '..', 'vercel', 'output', 'static');

  try {
    const exists = await fs.promises.stat(publicDir).then(() => true).catch(() => false);
    if (!exists) {
      console.log('No public directory to copy. Skipping.');
      return;
    }

    await copyDir(publicDir, outDir);
    console.log('Copied public ->', outDir);
  } catch (err) {
    console.error('Failed to create vercel output:', err);
    process.exitCode = 1;
  }
}

main();
