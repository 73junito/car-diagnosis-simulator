'use strict'

const fs = require('fs')
const path = require('path')

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

function readGlbJson(file) {
  const buffer = fs.readFileSync(file)
  if (buffer.length < 20 || buffer.toString('ascii', 0, 4) !== 'glTF') {
    throw new Error('invalid GLB header')
  }
  const jsonLength = buffer.readUInt32LE(12)
  if (buffer.toString('ascii', 16, 20) !== 'JSON') {
    throw new Error('GLB first chunk is not JSON')
  }
  return JSON.parse(buffer.toString('utf8', 20, 20 + jsonLength).trim())
}

function validateAnimationPresentationContract(manifest, { rootDir, requireDeployableAsset = false } = {}) {
  const errors = []
  if (manifest?.schemaVersion !== '1.1.0') return errors

  const presentation = manifest.presentation
  if (!presentation) return ['ANIM-2B manifest requires presentation contract']

  const componentIds = new Set((manifest.components || []).map((item) => item.id))
  const bindingIds = Object.keys(presentation.componentBindings || {})
  const bindingSet = new Set(bindingIds)

  for (const id of componentIds) {
    if (!bindingSet.has(id)) errors.push('presentation missing component binding for ' + id)
  }
  for (const id of bindingIds) {
    if (!componentIds.has(id)) errors.push('presentation binding references unknown manifest component ' + id)
  }

  const sourceRef = presentation.simulationSource?.engineeringArtifactRef
  const sourcePath = sourceRef && rootDir ? path.join(rootDir, sourceRef) : null
  let source = null
  if (!sourceRef) {
    errors.push('presentation simulation source is required')
  } else if (!Array.isArray(manifest.evidence?.engineeringArtifactRefs) || !manifest.evidence.engineeringArtifactRefs.includes(sourceRef)) {
    errors.push('presentation simulation source must also be an engineeringArtifactRef')
  } else if (rootDir && !fs.existsSync(sourcePath)) {
    errors.push('presentation simulation source does not exist: ' + sourceRef)
  } else if (rootDir) {
    source = readJson(sourcePath)
  }

  if (source) {
    const engineeringComponents = new Set((source.components || []).map((item) => item.id))
    const engineeringConnections = new Set((source.connections || []).map((item) => item.id))
    const boundEngineeringIds = new Set()

    for (const [canonicalId, binding] of Object.entries(presentation.componentBindings || {})) {
      if (binding.sourceType === 'engineering-component') {
        if (!binding.engineeringComponentId) {
          errors.push('engineering-component binding ' + canonicalId + ' requires engineeringComponentId')
        } else if (!engineeringComponents.has(binding.engineeringComponentId)) {
          errors.push('binding ' + canonicalId + ' references unknown engineering component ' + binding.engineeringComponentId)
        } else if (boundEngineeringIds.has(binding.engineeringComponentId)) {
          errors.push('engineering component bound more than once: ' + binding.engineeringComponentId)
        } else {
          boundEngineeringIds.add(binding.engineeringComponentId)
        }
      }
      if (binding.sourceType === 'connection-derived') {
        if (!Array.isArray(binding.engineeringConnectionIds) || binding.engineeringConnectionIds.length === 0) {
          errors.push('connection-derived binding ' + canonicalId + ' requires engineeringConnectionIds')
        } else {
          for (const id of binding.engineeringConnectionIds) {
            if (!engineeringConnections.has(id)) errors.push('binding ' + canonicalId + ' references unknown engineering connection ' + id)
          }
        }
      }
      if (binding.sourceType === 'instructional-overlay' && (binding.engineeringComponentId || binding.engineeringConnectionIds)) {
        errors.push('instructional-overlay binding ' + canonicalId + ' may not claim engineering identity')
      }
    }

    for (const id of engineeringComponents) {
      if (!boundEngineeringIds.has(id)) errors.push('engineering component is not canonically bound: ' + id)
    }

    const sourceStates = new Set((source.operatingStates || []).map((item) => item.id))
    const mappedStates = new Set()
    for (const mapping of presentation.stateMappings || []) {
      if (!sourceStates.has(mapping.stateId)) errors.push('state mapping references unknown operating state ' + mapping.stateId)
      if (mappedStates.has(mapping.stateId)) errors.push('duplicate state mapping ' + mapping.stateId)
      mappedStates.add(mapping.stateId)
      validateComponentStates(mapping.componentStates, componentIds, 'state ' + mapping.stateId, errors)
    }
    for (const id of sourceStates) {
      if (!mappedStates.has(id)) errors.push('operating state missing presentation mapping: ' + id)
    }

    const sourceFaults = new Set((source.faultCatalog || []).map((item) => item.id))
    const mappedFaults = new Set()
    for (const mapping of presentation.faultMappings || []) {
      if (!sourceFaults.has(mapping.faultId)) errors.push('fault mapping references unknown training fault ' + mapping.faultId)
      if (mappedFaults.has(mapping.faultId)) errors.push('duplicate fault mapping ' + mapping.faultId)
      mappedFaults.add(mapping.faultId)
      validateComponentStates(mapping.componentStates, componentIds, 'fault ' + mapping.faultId, errors)
    }
    for (const id of sourceFaults) {
      if (!mappedFaults.has(id)) errors.push('training fault missing presentation mapping: ' + id)
    }
  }

  const clips = presentation.clips || []
  const clipIds = new Set()
  const clipNames = new Set()
  for (const clip of clips) {
    if (clipIds.has(clip.id)) errors.push('duplicate presentation clip id ' + clip.id)
    if (clipNames.has(clip.assetClipName)) errors.push('duplicate GLB clip name ' + clip.assetClipName)
    clipIds.add(clip.id)
    clipNames.add(clip.assetClipName)
  }
  if (presentation.mode === 'animated' && clips.length === 0) errors.push('animated presentation requires at least one declared clip')
  if (presentation.mode !== 'animated' && clips.length !== 0) errors.push('static presentation may not declare animation clips')

  for (const step of manifest.steps || []) {
    for (const id of step.highlightComponentIds || []) {
      if (!componentIds.has(id)) errors.push('step ' + step.id + ' highlights unknown component ' + id)
    }
    if (step.camera?.behavior === 'frame-component') {
      if (!step.camera.componentId) errors.push('step ' + step.id + ' frame-component camera requires componentId')
      else if (!componentIds.has(step.camera.componentId)) errors.push('step ' + step.id + ' camera references unknown component ' + step.camera.componentId)
    }
    if (step.camera?.behavior === 'frame-highlighted-components' && !(step.highlightComponentIds || []).length) {
      errors.push('step ' + step.id + ' frame-highlighted-components requires at least one highlight')
    }

    const timeline = step.timeline
    if (!timeline) continue
    if (timeline.kind === 'clip') {
      const clip = clips.find((item) => item.id === timeline.clipId)
      if (!clip) {
        errors.push('step ' + step.id + ' references unknown clip ' + timeline.clipId)
      } else {
        if (!(timeline.endSeconds > timeline.startSeconds)) errors.push('step ' + step.id + ' clip timing must have endSeconds > startSeconds')
        if (timeline.endSeconds > clip.durationSeconds) errors.push('step ' + step.id + ' exceeds declared clip duration')
      }
    } else if (timeline.kind === 'static-interval') {
      if (timeline.endSeconds < timeline.startSeconds) errors.push('step ' + step.id + ' static interval ends before it starts')
    }
  }

  const fallbackRef = manifest.rendering?.fallbackImagePath
  if (!fallbackRef) {
    errors.push('ANIM-2B presentation requires a static fallback asset')
  } else if (rootDir && !fs.existsSync(path.join(rootDir, fallbackRef))) {
    errors.push('static fallback asset does not exist: ' + fallbackRef)
  }

  const assetRef = manifest.rendering?.assetPath
  if (requireDeployableAsset && !assetRef) errors.push('release candidate requires a deployable model asset')
  if (assetRef && rootDir) {
    const assetPath = path.join(rootDir, assetRef)
    if (!fs.existsSync(assetPath)) {
      errors.push('model asset does not exist: ' + assetRef)
    } else if (/\.glb$/i.test(assetRef)) {
      try {
        const gltf = readGlbJson(assetPath)
        const exportedClips = new Set((gltf.animations || []).map((item) => item.name).filter(Boolean))
        if (presentation.mode === 'animated' && exportedClips.size === 0) errors.push('animated GLB contains no animation clips')
        for (const clip of clips) {
          if (!exportedClips.has(clip.assetClipName)) errors.push('GLB missing required clip ' + clip.assetClipName)
        }
      } catch (error) {
        errors.push('model asset could not be validated: ' + error.message)
      }
    }
  }

  return errors
}

function validateComponentStates(states, componentIds, label, errors) {
  const seen = new Set()
  for (const item of states || []) {
    if (!componentIds.has(item.componentId)) errors.push(label + ' references unknown component ' + item.componentId)
    if (seen.has(item.componentId)) errors.push(label + ' duplicates component state ' + item.componentId)
    seen.add(item.componentId)
  }
}

function validateAnimationReleaseCandidate(manifest, options = {}) {
  const errors = validateAnimationPresentationContract(manifest, { ...options, requireDeployableAsset: true })
  const governance = manifest?.governance || {}
  if (governance.status !== 'final_content_approved') errors.push('release requires final_content_approved')
  if (governance.humanApprovalRecorded !== true) errors.push('release requires explicit human approval')
  if (governance.publicationAllowed !== true) errors.push('release requires explicit publication authorization')
  if (governance.assessmentEligible !== false || governance.scoredAssessmentApproved !== false) {
    errors.push('release candidate must remain outside assessment eligibility and scored delivery')
  }
  if (governance.agentMayApprove !== false || governance.agentMayRelease !== false) {
    errors.push('automated agents may reject but may not approve or release')
  }
  return errors
}

module.exports = {
  readGlbJson,
  validateAnimationPresentationContract,
  validateAnimationReleaseCandidate,
}
