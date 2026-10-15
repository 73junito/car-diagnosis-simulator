const fs = require('fs')
const path = require('path')
const Ajv2020 = require('ajv/dist/2020')

const ROOT = path.resolve(__dirname, '..')
const REGISTRY_PATH = 'data/architecture/schema-registry.json'

function readJson(relative) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8').replace(/^\uFEFF/, ''))
}

function globFiles(pattern) {
  const normalized = pattern.replace(/\\/g, '/')
  const wildcard = normalized.indexOf('*')
  if (wildcard < 0) return [normalized]

  const dir = normalized.slice(0, normalized.lastIndexOf('/'))
  const filePattern = normalized.slice(normalized.lastIndexOf('/') + 1)
  const [prefix, suffix] = filePattern.split('*')
  const fullDir = path.join(ROOT, dir)

  return fs.readdirSync(fullDir)
    .filter((name) => name.startsWith(prefix) && name.endsWith(suffix))
    .map((name) => path.posix.join(dir, name))
    .sort()
}

function contractFiles(contract) {
  const files = [...(contract.files || [])]
  if (contract.glob) files.push(...globFiles(contract.glob))
  return [...new Set(files)].sort()
}

function formatErrors(errors = []) {
  return errors.map((error) => {
    const location = error.instancePath || '/'
    return `${location} ${error.message || 'schema validation error'}`
  }).join('; ')
}

function verifyArchitectureSchemas() {
  const registry = readJson(REGISTRY_PATH)

  if (registry.schemaVersion !== '1.0.0') {
    throw new Error('Architecture schema registry version drift.')
  }
  if (registry.status !== 'active') {
    throw new Error('Architecture schema registry must remain active.')
  }
  if (!Array.isArray(registry.contracts) || registry.contracts.length < 3) {
    throw new Error('Architecture schema registry is missing required contracts.')
  }

  const ajv = new Ajv2020({
    allErrors: true,
    strict: true,
    validateFormats: false
  })

  const results = []
  const validatedFiles = new Set()

  for (const contract of registry.contracts) {
    if (!contract.id || !contract.schema) {
      throw new Error('Architecture schema registry entry is missing id/schema.')
    }

    const schema = readJson(contract.schema)
    const validate = ajv.compile(schema)
    const files = contractFiles(contract)

    if (!files.length) {
      throw new Error(`${contract.id}: registry target resolved to zero files.`)
    }

    for (const file of files) {
      if (validatedFiles.has(file)) {
        throw new Error(`Architecture file is registered more than once: ${file}`)
      }
      validatedFiles.add(file)

      const absolute = path.join(ROOT, file)
      if (!fs.existsSync(absolute)) {
        throw new Error(`${contract.id}: registered file does not exist: ${file}`)
      }

      const payload = readJson(file)
      const ok = validate(payload)
      if (!ok) {
        throw new Error(`${contract.id}: ${file}: ${formatErrors(validate.errors)}`)
      }

      results.push({
        contractId: contract.id,
        schema: contract.schema,
        file
      })
    }
  }

  const lmfRuntimeCount = results.filter(
    (result) => result.contractId === 'lmf-runtime-projections'
  ).length

  return {
    registryPath: REGISTRY_PATH,
    contractCount: registry.contracts.length,
    validatedFileCount: results.length,
    lmfRuntimeCount,
    results
  }
}

if (require.main === module) {
  const result = verifyArchitectureSchemas()
  console.log(
    `Architecture schema validation: PASS (${result.contractCount} contracts; ${result.validatedFileCount} files; ${result.lmfRuntimeCount} LMF runtimes)`
  )
}

module.exports = { REGISTRY_PATH, verifyArchitectureSchemas }
