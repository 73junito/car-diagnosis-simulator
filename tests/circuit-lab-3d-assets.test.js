/** @jest-environment node */
const fs = require('fs')
const path = require('path')
const {
  parseGlb,
  validateCircuitLab3dAssets
} = require('../scripts/verify-circuit-lab-3d-assets')

const ROOT = path.resolve(__dirname, '..')

describe('Circuit Lab 3D presentation assets', () => {
  test('all governed 3D assets are valid GLB 2.0 triangle meshes', () => {
    const result = validateCircuitLab3dAssets()
    expect(result.assetCount).toBe(8)
    expect(result.parsed).toHaveLength(8)
    expect(result.parsed.every((asset) => asset.bytes > 0 && asset.primitives > 0)).toBe(true)
  })

  test('active 3D diagnostic tools exactly cover the Circuit Lab runtime tool contract', () => {
    const result = validateCircuitLab3dAssets()
    expect(result.activeToolIds).toEqual(['tool.current-clamp', 'tool.dmm'])
    expect(result.runtimeToolCount).toBe(2)
    expect(result.oscilloscopeEnabled).toBe(false)
  })

  test('3D presentation manifest cannot claim engineering or governance authority', () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(ROOT, 'data', 'architecture', 'circuit-lab-3d-assets.json'), 'utf8')
    )
    expect(Object.values(manifest.authority).every((value) => value === false)).toBe(true)
    expect(manifest.presentationRole).toBe('circuit-lab-3d-presentation-only')
  })

  test('generated current clamp is a generic GLB with vertex colors', () => {
    const file = path.join(ROOT, 'dashboard', 'student', 'circuit-lab', 'assets', '3d', 'current-clamp.glb')
    const { gltf, primitives } = parseGlb(file)
    expect(gltf.asset.version).toBe('2.0')
    expect(gltf.asset.generator).toContain('AutoLearnPro generic low-poly current-clamp generator')
    expect(primitives.every((primitive) => primitive.attributes.COLOR_0 !== undefined)).toBe(true)
  })

  test('prototype simulation mesh JSON is not shipped as Circuit Lab engineering input', () => {
    expect(
      fs.existsSync(
        path.join(ROOT, 'dashboard', 'student', 'circuit-lab', 'assets', '3d', 'prototype-scene-meshes.json')
      )
    ).toBe(false)
  })
})
