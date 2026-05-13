const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data', 'obd2');
const jsonPath = path.join(dataDir, 'obd2_codes_database.json');
const csvPath = path.join(dataDir, 'obd2_codes_database.csv');
const seedsPath = path.join(dataDir, 'obd2_scenario_seeds.json');

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function readCsv(p) {
  const s = fs.readFileSync(p, 'utf8');
  const lines = s.split(/\r?\n/).filter(Boolean);
  const headers = lines[0].split(',').map(h=>h.trim());
  return lines.slice(1).map(l=>{
    const cols = l.split(',');
    const obj = {};
    headers.forEach((h,i)=>obj[h]=cols[i] ? cols[i].trim() : '');
    return obj;
  });
}

function validate() {
  if (!fs.existsSync(jsonPath)) throw new Error('Missing ' + jsonPath);
  if (!fs.existsSync(csvPath)) throw new Error('Missing ' + csvPath);

  const records = readJson(jsonPath);
  const csv = readCsv(csvPath);
  const seeds = fs.existsSync(seedsPath) ? readJson(seedsPath) : [];

  const codeRegex = /^[PBCU][0-9A-F]{4}$/i;
  const seen = new Set();
  const errors = [];

  records.forEach((r, idx) => {
    if (!r.code) errors.push(`Record ${idx+1}: missing code`);
    if (!r.description) errors.push(`Record ${idx+1} (${r.code}): missing description`);
    if (!codeRegex.test(r.code)) errors.push(`Record ${idx+1} (${r.code}): invalid code format`);
    const cu = r.code.toUpperCase();
    if (seen.has(cu)) errors.push(`Duplicate code: ${cu}`);
    seen.add(cu);
  });

  // cross-check CSV codes
  csv.forEach((r, idx) => {
    if (!r.code) errors.push(`CSV row ${idx+2}: missing code`);
    if (!r.description) errors.push(`CSV row ${idx+2} (${r.code}): missing description`);
    if (!codeRegex.test(r.code)) errors.push(`CSV row ${idx+2} (${r.code}): invalid code format`);
    if (!seen.has(r.code.toUpperCase())) errors.push(`CSV row ${idx+2} (${r.code}): not found in JSON dataset`);
  });

  // seeds reference valid codes
  seeds.forEach((s, idx) => {
    if (!s.code) errors.push(`Seed ${idx+1}: missing code`);
    if (!seen.has(String(s.code).toUpperCase())) errors.push(`Seed ${idx+1} (${s.code}): code not found in dataset`);
  });

  if (errors.length) {
    console.error('Validation failed with errors:');
    errors.forEach(e=>console.error(' - ' + e));
    process.exitCode = 2;
  } else {
    console.log('Validation passed: all checks OK');
  }
}

try {
  validate();
} catch (err) {
  console.error('Validation error:', err.message);
  process.exitCode = 3;
}
