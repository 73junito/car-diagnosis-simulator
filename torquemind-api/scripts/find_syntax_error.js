const fs = require('fs');
const acorn = require('acorn');

// Read the source file and split into lines
const srcPath = 'D:/Car Diagnosis Simulator/car-diagnosis-sim/script.js';
const src = fs.readFileSync(srcPath, 'utf8');
const lines = src.split('\n');

// Binary search for the earliest line that causes a parse error
let lo = 1, hi = lines.length, bad = hi;
while (lo <= hi) {
  const mid = Math.floor((lo + hi) / 2);
  const part = lines.slice(0, mid).join('\n');
  try {
    // Use a safe parser instead of executing code
    acorn.parse(part, { ecmaVersion: 'latest', sourceType: 'script' });
    lo = mid + 1;
  } catch (e) {
    bad = mid;
    hi = mid - 1;
  }
}

console.log('Syntax error around line', bad);
const start = Math.max(1, bad - 10);
for (let i = start; i <= Math.min(lines.length, bad + 10); i++) {
  console.log(i + ' | ' + lines[i - 1]);
}
