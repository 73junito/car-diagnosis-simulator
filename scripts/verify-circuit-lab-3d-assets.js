'use strict'

const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const runtime = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'architecture', 'circuit-lab-lmf-runtime.json'), 'utf8'))
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'architecture', 'circuit-lab-3d-assets.json'), 'utf8'))
const ASSET_DIR = path.join(ROOT, 'dashboard', 'student', 'circuit-lab', 'assets', '3d')

function parseGlb(file) {
  const buffer = fs.readFileSync(file)
  if (buffer.length < 20) throw new Error(path.basename(file) + ': GLB too small')
  if (buffer.subarray(0, 4).toString() !== 'glTF') throw new Error(path.basename(file) + ': invalid GLB magic')
  if (buffer.readUInt32LE(4) !== 2) throw new Error(path.basename(file) + ': expected glTF 2.0')
  if (buffer.readUInt32LE(8) !== buffer.length) throw new Error(path.basename(file) + ': declared length mismatch')

  const jsonLength = buffer.readUInt32LE(12)
  if (buffer.readUInt32LE(16) !== 0x4E4F534A) throw new Error(path.basename(file) + ': missing JSON chunk')
  const gltf = JSON.parse(buffer.subarray(20, 20 + jsonLength).toString('utf8').trim())

  const primitives = (gltf.meshes || []).flatMap((mesh) => mesh.primitives || [])
  if (!primitives.length) throw new Error(path.basename(file) + ': no mesh primitives')
  for (const primitive of primitives) {
    if (primitive.mode !== undefined && primitive.mode !== 4) {
      throw new Error(path.basename(file) + ': only triangle primitives are permitted')
    }
    if (primitive.attributes?.POSITION === undefined) {
      throw new Error(path.basename(file) + ': primitive missing POSITION')
    }
    if (primitive.attributes?.COLOR_0 === undefined) {
      throw new Error(path.basename(file) + ': primitive missing COLOR_0')
    }
    if (primitive.indices === undefined) {
      throw new Error(path.basename(file) + ': primitive missing indices')
    }
  }
  return { buffer, gltf, primitives }
}

function validateCircuitLab3dAssets() {
  if (manifest.presentationRole !== 'circuit-lab-3d-presentation-only') {
    throw new Error('3D manifest presentation role drift')
  }
  if (manifest.authoritativeRuntime !== '/data/architecture/circuit-lab-lmf-runtime.json') {
    throw new Error('3D manifest is not bound to the Circuit Lab runtime')
  }
  for (const [key, value] of Object.entries(manifest.authority || {})) {
    if (value !== false) throw new Error('3D presentation authority must remain false: ' + key)
  }

  const assets = manifest.assets || []
  const diagnosticAssets = assets.filter((asset) => asset.kind === 'diagnostic-tool')
  const runtimeTools = new Set(runtime.toolIds || [])
  const activeToolAssets = diagnosticAssets.filter((asset) => runtimeTools.has(asset.toolId))
  const activeToolIds = activeToolAssets.map((asset) => asset.toolId).sort()
  const expectedToolIds = [...runtimeTools].sort()
  if (JSON.stringify(activeToolIds) !== JSON.stringify(expectedToolIds)) {
    throw new Error('Runtime-enabled diagnostic tools do not have exact 3D model coverage')
  }

  const oscilloscope = diagnosticAssets.find((asset) => asset.toolId === 'tool.oscilloscope')
  if (!oscilloscope) throw new Error('Oscilloscope presentation asset metadata is missing')
  if (runtimeTools.has('tool.oscilloscope')) {
    throw new Error('Circuit Lab unexpectedly enables tool.oscilloscope')
  }

  const parsed = []
  for (const asset of assets) {
    const file = path.join(ASSET_DIR, asset.file)
    if (!fs.existsSync(file)) throw new Error('Missing 3D asset: ' + asset.file)
    const info = parseGlb(file)
    parsed.push({
      assetId: asset.assetId,
      file: asset.file,
      bytes: info.buffer.length,
      primitives: info.primitives.length,
      enabledAsDiagnosticTool: asset.kind === 'diagnostic-tool' && runtimeTools.has(asset.toolId)
    })
  }

  return {
    labId: runtime.labId,
    assetCount: assets.length,
    runtimeToolCount: runtimeTools.size,
    activeToolIds,
    oscilloscopeEnabled: runtimeTools.has('tool.oscilloscope'),
    parsed
  }
}

if (require.main === module) {
  const result = validateCircuitLab3dAssets()
  console.log(
    'Circuit Lab 3D assets: PASS (' +
    result.assetCount + ' GLBs; ' +
    result.runtimeToolCount + ' runtime tools covered; oscilloscope fail-closed)'
  )
}

module.exports = { parseGlb, validateCircuitLab3dAssets }
