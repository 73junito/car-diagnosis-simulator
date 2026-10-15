'use strict'

const fs = require('fs')
const path = require('path')

const OUT = path.resolve(__dirname, '..', 'dashboard', 'student', 'circuit-lab', 'assets', '3d', 'current-clamp.glb')

const positions = []
const colors = []
const indices = []

function box(cx, cy, cz, sx, sy, sz, color) {
  const base = positions.length / 3
  const x0 = cx - sx / 2, x1 = cx + sx / 2
  const y0 = cy - sy / 2, y1 = cy + sy / 2
  const z0 = cz - sz / 2, z1 = cz + sz / 2
  const vertices = [
    [x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0],
    [x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]
  ]
  for (const v of vertices) {
    positions.push(...v)
    colors.push(...color)
  }
  const faces = [
    0,1,2, 0,2,3, 4,6,5, 4,7,6,
    0,4,5, 0,5,1, 3,2,6, 3,6,7,
    1,5,6, 1,6,2, 0,3,7, 0,7,4
  ]
  indices.push(...faces.map((i) => i + base))
}

// Generic low-poly clamp meter: body, display, trigger and two separated jaws.
box(0, -0.45, 0, 1.45, 2.1, 0.48, [0.16, 0.18, 0.22, 1])
box(0, -0.35, 0.255, 0.9, 0.46, 0.03, [0.35, 0.82, 0.70, 1])
box(-0.52, 0.24, 0.27, 0.2, 0.5, 0.08, [0.95, 0.52, 0.10, 1])
box(-0.48, 1.0, 0, 0.43, 1.18, 0.5, [0.95, 0.52, 0.10, 1])
box(0.48, 1.0, 0, 0.43, 1.18, 0.5, [0.95, 0.52, 0.10, 1])
box(-0.28, 1.55, 0, 0.52, 0.34, 0.5, [0.95, 0.52, 0.10, 1])
box(0.28, 1.55, 0, 0.52, 0.34, 0.5, [0.95, 0.52, 0.10, 1])

const pos = Buffer.from(new Float32Array(positions).buffer)
const col = Buffer.from(new Float32Array(colors).buffer)
const idxArray = Math.max(...indices) < 65536 ? new Uint16Array(indices) : new Uint32Array(indices)
const idx = Buffer.from(idxArray.buffer)

function pad4(buffer) {
  const extra = (4 - (buffer.length % 4)) % 4
  return extra ? Buffer.concat([buffer, Buffer.alloc(extra)]) : buffer
}

const posP = pad4(pos)
const colP = pad4(col)
const idxP = pad4(idx)
const bin = Buffer.concat([posP, colP, idxP])

const mins = [Infinity, Infinity, Infinity]
const maxs = [-Infinity, -Infinity, -Infinity]
for (let i = 0; i < positions.length; i += 3) {
  for (let axis = 0; axis < 3; axis += 1) {
    mins[axis] = Math.min(mins[axis], positions[i + axis])
    maxs[axis] = Math.max(maxs[axis], positions[i + axis])
  }
}

const gltf = {
  asset: { version: '2.0', generator: 'AutoLearnPro generic low-poly current-clamp generator' },
  scene: 0,
  scenes: [{ nodes: [0] }],
  nodes: [{ mesh: 0, name: 'Generic Current Clamp' }],
  meshes: [{ name: 'Generic Current Clamp', primitives: [{
    attributes: { POSITION: 0, COLOR_0: 1 },
    indices: 2,
    mode: 4
  }] }],
  buffers: [{ byteLength: bin.length }],
  bufferViews: [
    { buffer: 0, byteOffset: 0, byteLength: pos.length, target: 34962 },
    { buffer: 0, byteOffset: posP.length, byteLength: col.length, target: 34962 },
    { buffer: 0, byteOffset: posP.length + colP.length, byteLength: idx.length, target: 34963 }
  ],
  accessors: [
    { bufferView: 0, componentType: 5126, count: positions.length / 3, type: 'VEC3', min: mins, max: maxs },
    { bufferView: 1, componentType: 5126, count: colors.length / 4, type: 'VEC4' },
    { bufferView: 2, componentType: idxArray.BYTES_PER_ELEMENT === 2 ? 5123 : 5125, count: indices.length, type: 'SCALAR' }
  ]
}

let json = Buffer.from(JSON.stringify(gltf))
const jsonPad = (4 - (json.length % 4)) % 4
if (jsonPad) json = Buffer.concat([json, Buffer.alloc(jsonPad, 0x20)])

const totalLength = 12 + 8 + json.length + 8 + bin.length
const header = Buffer.alloc(12)
header.write('glTF', 0)
header.writeUInt32LE(2, 4)
header.writeUInt32LE(totalLength, 8)

const jsonHeader = Buffer.alloc(8)
jsonHeader.writeUInt32LE(json.length, 0)
jsonHeader.writeUInt32LE(0x4E4F534A, 4)

const binHeader = Buffer.alloc(8)
binHeader.writeUInt32LE(bin.length, 0)
binHeader.writeUInt32LE(0x004E4942, 4)

fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, Buffer.concat([header, jsonHeader, json, binHeader, bin]))
console.log(`Wrote ${path.relative(process.cwd(), OUT)} (${totalLength} bytes)`)
