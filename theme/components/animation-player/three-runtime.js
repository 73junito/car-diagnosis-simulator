const THREE_MODULE_URL = '/vendor/three/three.module.js'
const GLTF_LOADER_URL = '/vendor/three/addons/loaders/GLTFLoader.js'
const ORBIT_CONTROLS_URL = '/vendor/three/addons/controls/OrbitControls.js'

let modulePromise = null

function loadThreeModules() {
  if (!modulePromise) {
    modulePromise = Promise.all([
      import(THREE_MODULE_URL),
      import(GLTF_LOADER_URL),
      import(ORBIT_CONTROLS_URL),
    ]).then(([THREE, loaderModule, controlsModule]) => ({
      THREE,
      GLTFLoader: loaderModule.GLTFLoader,
      OrbitControls: controlsModule.OrbitControls,
    }))
  }
  return modulePromise
}

function normalizeComponentKey(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

function resolveComponentId(object, componentIds) {
  let current = object
  while (current) {
    const candidates = [current.userData?.animationComponentId, current.userData?.componentId, current.name]
    for (const candidate of candidates) {
      const normalized = normalizeComponentKey(candidate)
      if (componentIds.has(normalized)) return normalized
    }
    current = current.parent
  }
  return null
}

function fitCamera(THREE, camera, controls, object) {
  const box = new THREE.Box3().setFromObject(object)
  if (box.isEmpty()) return
  const sphere = box.getBoundingSphere(new THREE.Sphere())
  const radius = Math.max(sphere.radius, 0.5)
  const fov = THREE.MathUtils.degToRad(camera.fov)
  const distance = radius / Math.sin(fov / 2)
  camera.position.set(sphere.center.x + distance * 0.65, sphere.center.y + distance * 0.35, sphere.center.z + distance)
  camera.near = Math.max(distance / 1000, 0.01)
  camera.far = Math.max(distance * 100, 100)
  camera.updateProjectionMatrix()
  controls.target.copy(sphere.center)
  controls.update()
}

export async function createThreeAnimationRuntime({
  canvas,
  assetUrl,
  components = [],
  reducedMotion = false,
  onComponentSelect = () => {},
  onError = () => {},
} = {}) {
  if (!canvas || typeof canvas.getBoundingClientRect !== 'function') {
    throw new Error('A canvas element is required for the Three.js animation runtime.')
  }
  if (!assetUrl) throw new Error('A GLB/glTF asset URL is required for the Three.js animation runtime.')

  const { THREE, GLTFLoader, OrbitControls } = await loadThreeModules()
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: !reducedMotion, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(42, 1, 0.01, 1000)
  camera.position.set(3, 2, 5)
  scene.add(new THREE.HemisphereLight(0xffffff, 0x334155, 1.8))
  const keyLight = new THREE.DirectionalLight(0xffffff, 2.2)
  keyLight.position.set(4, 6, 5)
  scene.add(keyLight)

  const controls = new OrbitControls(camera, canvas)
  controls.enableDamping = !reducedMotion
  controls.enablePan = false
  controls.minDistance = 0.5
  controls.maxDistance = 50

  const raycaster = new THREE.Raycaster()
  const pointer = new THREE.Vector2()
  const componentIds = new Set(components.map((item) => normalizeComponentKey(item.id)))
  const componentObjects = new Map()
  const clipActions = []
  let model = null
  let mixer = null
  let maxDuration = 0
  let playing = !reducedMotion
  let disposed = false
  let frameId = null
  let selectionHelper = null
  let defaultCamera = null

  function render() { renderer.render(scene, camera) }

  function resize() {
    const rect = canvas.getBoundingClientRect()
    const width = Math.max(Math.floor(rect.width), 1)
    const height = Math.max(Math.floor(rect.height), 1)
    renderer.setSize(width, height, false)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
    render()
  }

  const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null
  resizeObserver?.observe(canvas)

  function clearSelection() {
    if (!selectionHelper) return
    scene.remove(selectionHelper)
    selectionHelper.geometry?.dispose?.()
    selectionHelper.material?.dispose?.()
    selectionHelper = null
  }

  function selectComponent(componentId) {
    clearSelection()
    const object = componentObjects.get(normalizeComponentKey(componentId))
    if (!object) { render(); return false }
    selectionHelper = new THREE.BoxHelper(object, 0x2563eb)
    scene.add(selectionHelper)
    render()
    return true
  }

  function pointerSelect(event) {
    if (!model) return
    const rect = canvas.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    raycaster.setFromCamera(pointer, camera)
    for (const hit of raycaster.intersectObject(model, true)) {
      const componentId = resolveComponentId(hit.object, componentIds)
      if (!componentId) continue
      selectComponent(componentId)
      onComponentSelect(componentId)
      break
    }
  }

  canvas.addEventListener('pointerdown', pointerSelect)
  controls.addEventListener('change', render)

  function animationFrame() {
    if (disposed) return
    if (playing && mixer) mixer.update(1 / 60)
    if (controls.enableDamping) controls.update()
    render()
    if (playing || controls.enableDamping) frameId = requestAnimationFrame(animationFrame)
    else frameId = null
  }

  function ensureLoop() {
    if (frameId == null && !disposed) frameId = requestAnimationFrame(animationFrame)
  }

  function dispose() {
    if (disposed) return
    disposed = true
    if (frameId != null) cancelAnimationFrame(frameId)
    resizeObserver?.disconnect()
    canvas.removeEventListener('pointerdown', pointerSelect)
    controls.removeEventListener('change', render)
    controls.dispose()
    clearSelection()
    scene.traverse((object) => {
      object.geometry?.dispose?.()
      if (Array.isArray(object.material)) {
        for (const material of object.material) material?.dispose?.()
      } else {
        object.material?.dispose?.()
      }
    })
    renderer.dispose()
  }

  try {
    const loader = new GLTFLoader()
    const gltf = await loader.loadAsync(assetUrl)
    model = gltf.scene
    scene.add(model)
    model.traverse((object) => {
      const componentId = resolveComponentId(object, componentIds)
      if (componentId && !componentObjects.has(componentId)) componentObjects.set(componentId, object)
    })
    if (Array.isArray(gltf.animations) && gltf.animations.length > 0) {
      mixer = new THREE.AnimationMixer(model)
      for (const clip of gltf.animations) {
        maxDuration = Math.max(maxDuration, Number(clip.duration) || 0)
        const action = mixer.clipAction(clip)
        action.play()
        action.paused = reducedMotion
        clipActions.push(action)
      }
    }
    fitCamera(THREE, camera, controls, model)
    defaultCamera = { position: camera.position.clone(), target: controls.target.clone() }
    resize()
    if (playing || controls.enableDamping) ensureLoop()
  } catch (error) {
    onError(error)
    dispose()
    throw error
  }

  function setPlaying(nextPlaying) {
    playing = Boolean(nextPlaying) && !reducedMotion
    for (const action of clipActions) action.paused = !playing
    if (playing) ensureLoop()
    else render()
  }

  function seekNormalized(value) {
    const normalized = Math.min(Math.max(Number(value) || 0, 0), 1)
    if (mixer && maxDuration > 0) mixer.setTime(maxDuration * normalized)
    render()
  }

  function resetCamera() {
    if (!defaultCamera) return
    camera.position.copy(defaultCamera.position)
    controls.target.copy(defaultCamera.target)
    controls.update()
    render()
  }

  return {
    setPlaying,
    seekNormalized,
    resetCamera,
    selectComponent,
    dispose,
    hasAnimations: maxDuration > 0,
    availableComponents: Array.from(componentObjects.keys()),
  }
}
