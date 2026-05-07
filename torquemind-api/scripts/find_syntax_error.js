const fs = require('fs');
const src = fs.readFileSync('D:/Car Diagnosis Simulator/car-diagnosis-sim/script.js','utf8');
const lines = src.split('\n');
let lo = 1, hi = lines.length, bad = hi;
while (lo <= hi) {
  const mid = Math.floor((lo + hi) / 2);
  const part = lines.slice(0, mid).join('\n');
  try {
    new Function(part);
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
