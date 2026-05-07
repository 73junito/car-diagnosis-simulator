const fs = require('fs');
const s = fs.readFileSync('D:/Car Diagnosis Simulator/car-diagnosis-sim/script.js','utf8');
function count(ch){return s.split(ch).length-1}
console.log('backtick', count('`'));
console.log('double', count('"'));
console.log('single', count("'"));

// find first line where double quote parity flips to odd (ignoring backtick/template literals)
const lines = s.split('\n');
let inBacktick = false;
let cum = 0;
for (let i = 0; i < lines.length; i++) {
	const line = lines[i];
	for (let j = 0; j < line.length; j++) {
		const ch = line[j];
		if (ch === '`') inBacktick = !inBacktick;
		if (!inBacktick && ch === '"') cum++;
	}
	if (cum % 2 === 1) { console.log('first-odd-double-line', i + 1, line.slice(0, 200)); break; }
}
