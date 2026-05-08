const fs = require('fs')
const path = require('path')
const Ajv = require('ajv')
const addFormats = require('ajv-formats')

function loadJson(p) {
  const s = fs.readFileSync(p, 'utf8')
  return JSON.parse(s)
}

const repoRoot = path.resolve(__dirname, '..')
const schemaPath = path.join(repoRoot, 'schemas', 'db-ssl-validation-report.schema.json')
const reportPath = path.join(repoRoot, 'reports', 'db-ssl-validation-report.json')

if (!fs.existsSync(reportPath)) {
  console.error('Report not found:', reportPath)
  process.exit(1)
}

if (!fs.existsSync(schemaPath)) {
  console.error('Schema not found:', schemaPath)
  process.exit(1)
}

const schema = loadJson(schemaPath)
const report = loadJson(reportPath)

const ajv = new Ajv({ allErrors: true, strict: false })
addFormats(ajv)
const validate = ajv.compile(schema)
const valid = validate(report)
if (valid) {
  console.log('DB SSL validation report: valid')
  process.exit(0)
} else {
  console.error('DB SSL validation report: INVALID')
  console.error(JSON.stringify(validate.errors, null, 2))
  process.exit(1)
}
