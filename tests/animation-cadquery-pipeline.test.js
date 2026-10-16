const fs = require('fs')
const path = require('path')
const { verifyCadQueryPipeline } = require('../scripts/verify-cadquery-animation-pipeline')
const { candidatePythonPaths, findCadQueryPython } = require('../scripts/resolve-cadquery-environment')

describe('ANIM-1C CadQuery geometry-authoring pipeline', () => {
  test('defines a non-authoritative upstream geometry-authoring stage', () => {
    const result = verifyCadQueryPipeline()
    expect(result.errors).toEqual([])
    expect(result.config.phase).toBe('ANIM-1C-CAD')
    expect(result.config.outputs).toMatchObject({
      directGlbPublicationAllowed: false,
      downstreamPipeline: 'animation/blender/pipeline.json',
    })
    expect(result.config.governance).toMatchObject({
      geometryAuthoringOnly: true,
      engineeringAuthority: false,
      measurementAuthority: false,
      assessmentAuthority: false,
      publicationAuthority: false,
      controlsEngineeringState: false,
      humanApprovalRequired: true,
      agentMayApprove: false,
      agentMayRelease: false,
    })
  })

  test('resolves the Windows Miniforge cadquery env through USERPROFILE without hardcoding a user name', () => {
    const candidates = candidatePythonPaths(
      { USERPROFILE: 'C:\\Users\\example' },
      'win32'
    )
    expect(candidates).toContain(path.join('C:\\Users\\example', 'miniforge3', 'envs', 'cadquery', 'python.exe'))

    const resolver = fs.readFileSync(
      path.resolve(__dirname, '..', 'scripts', 'resolve-cadquery-environment.js'),
      'utf8'
    )
    expect(resolver).toContain('CADQUERY_PYTHON')
    expect(resolver).toContain('CADQUERY_ENV')
    expect(resolver).toContain('USERPROFILE')
    expect(resolver).not.toContain('rod63')
    expect(resolver).not.toContain('C:\\Users\\rod63')
  })

  test('supports explicit CADQUERY_PYTHON and CADQUERY_ENV overrides', () => {
    const direct = candidatePythonPaths(
      {
        CADQUERY_PYTHON: 'D:\\tools\\cq-python.exe',
        CADQUERY_ENV: 'D:\\envs\\cadquery',
      },
      'win32'
    )
    expect(direct[0]).toBe(path.resolve('D:\\tools\\cq-python.exe'))
    expect(direct[1]).toBe(path.join(path.resolve('D:\\envs\\cadquery'), 'python.exe'))
    expect(typeof findCadQueryPython).toBe('function')
  })

  test('Blender pipeline explicitly accepts CadQuery as upstream geometry authoring', () => {
    const pipeline = JSON.parse(fs.readFileSync(
      path.resolve(__dirname, '..', 'animation', 'blender', 'pipeline.json'),
      'utf8'
    ))
    expect(pipeline.upstreamGeometryAuthoring).toContainEqual({
      id: 'cadquery',
      pipeline: 'animation/cadquery/pipeline.json',
      role: 'deterministic-parametric-cad-authoring',
      acceptedIntermediates: ['STEP', 'STL'],
      directPublicationAuthority: false,
    })
  })

  test('static deployment does not expose CadQuery authoring pipeline internals', () => {
    const build = fs.readFileSync(path.resolve(__dirname, '..', 'scripts', 'build-static-site.js'), 'utf8')
    expect(build).not.toContain('source: "animation/cadquery"')
  })
})
