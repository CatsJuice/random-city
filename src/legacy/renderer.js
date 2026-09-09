import * as THREE from 'three'
import { createTownRenderer, generateTown } from '../townscape3d.js'

const legacyAssets = [
  'illustrated-city-atlas',
  'building-sprites',
  'landmark-sprites',
  'prop-sprites'
]
let assetReadiness
function preload() {
  if (!assetReadiness)
    assetReadiness = Promise.all(
      legacyAssets.map(
        (name) =>
          new Promise((resolve, reject) => {
            const image = new Image()
            image.onload = () => resolve()
            image.onerror = () => reject(new Error(`旧版素材加载失败：${name}`))
            image.src = `/assets/${name}.png`
          })
      )
    ).catch((error) => {
      assetReadiness = null
      throw error
    })
  return assetReadiness
}

// Compatibility shell only: the archived generator and its artwork are unchanged.
export function createLegacyCity(container, options, events = {}) {
  const state = { ...options }
  let engine,
    town,
    ready = false,
    disposed = false,
    revision = 0,
    scene,
    observer
  let frames = 0,
    lastNotify = performance.now()
  function release() {
    observer?.disconnect()
    observer = null
    if (!engine) return
    const textures = new Set()
    scene?.traverse((object) => {
      const materials = Array.isArray(object.material) ? object.material : [object.material]
      for (const material of materials)
        if (material)
          for (const value of Object.values(material)) if (value?.isTexture) textures.add(value)
    })
    const renderer = engine.renderer
    engine.dispose()
    textures.forEach((texture) => texture.dispose())
    renderer.forceContextLoss()
    engine = null
    scene = null
    container.style.cursor = ''
  }
  function frameView() {
    if (!engine) return
    const aspect = container.clientWidth / Math.max(1, container.clientHeight)
    const half = aspect < 1 ? 23 / aspect : 19
    Object.assign(engine.camera, {
      left: -half * aspect,
      right: half * aspect,
      top: half,
      bottom: -half
    })
    engine.syncCamera()
    if (ready && scene) engine.renderer.render(scene, engine.camera)
  }
  async function rebuild(seed) {
    const token = ++revision
    ready = false
    events.onLoading?.(0.1)
    try {
      await preload()
      if (disposed || token !== revision) return
      events.onLoading?.(0.7)
      // Enter on a frame boundary: the archived loop subtracts performance.now()
      // from RAF timestamps and assumes its first delta is non-negative.
      await new Promise((resolve) => requestAnimationFrame(resolve))
      if (disposed || token !== revision) return
      release()
      town = generateTown(seed)
      state.seed = seed
      engine = createTownRenderer(container, town, {
        weather: state.weather === 'sun' ? 'sunny' : state.weather,
        timeHours: state.time ?? 10.5,
        navigationMode: state.mode === 'pan' ? 'pan' : 'rotate',
        onPreview: () => {
          if (disposed || token !== revision) return
          ready = true
          events.onLoading?.(1)
          events.onReady?.({ ...town.stats, terrainName: '城市罗盘' })
        }
      })
      const canvas = engine.renderer.domElement
      lastNotify = performance.now()
      frames = 0
      canvas.setAttribute('aria-label', 'GPT-5.5 旧版城市')
      canvas.setAttribute('role', 'img')
      engine.controls.minPolarAngle = 0.01
      const render = engine.renderer.render.bind(engine.renderer)
      engine.renderer.render = (currentScene, camera) => {
        scene = currentScene
        render(currentScene, camera)
        frames++
        const now = performance.now()
        container.parentElement.style.setProperty('--sky-color', currentScene.background.getStyle())
        if (now - lastNotify < 1000) return
        events.onPerformance?.({ fps: Math.round((frames * 1000) / (now - lastNotify)) })
        events.onTime?.(state.time ?? 10.5)
        const north = new THREE.Vector3(0, 0, -1).project(camera),
          origin = new THREE.Vector3().project(camera)
        events.onBearing?.(
          (Math.atan2(
            (north.x - origin.x) * container.clientWidth,
            (north.y - origin.y) * container.clientHeight
          ) *
            180) /
            Math.PI
        )
        lastNotify = now
        frames = 0
      }
      observer = new ResizeObserver(frameView)
      observer.observe(container)
      frameView()
      api.set(state)
    } catch (error) {
      if (!disposed && token === revision) events.onError?.(error.message)
    }
  }
  const api = {
    rebuild,
    set(config) {
      Object.assign(state, config)
      if (!engine) return
      if (config.time !== undefined) engine.setTime(config.time)
      if (config.weather) engine.setWeather(config.weather === 'sun' ? 'sunny' : config.weather)
      if (config.mode) engine.setNavigationMode(config.mode === 'pan' ? 'pan' : 'rotate')
      if (config.autoRotate !== undefined) engine.controls.autoRotate = config.autoRotate
    },
    reset() {
      if (!engine) return
      engine.controls.target.set(0, 0.35, 0)
      engine.camera.position.set(29, 31, 29)
      engine.camera.zoom = 1
      frameView()
    },
    overview() {
      if (!engine) return
      engine.controls.target.set(0, 0, 0)
      engine.camera.position.set(0, 50, 0.1)
      engine.camera.zoom = 1
      engine.syncCamera()
    },
    zoom(factor) {
      if (!engine) return
      engine.camera.zoom = THREE.MathUtils.clamp(engine.camera.zoom * factor, 0.65, 2.7)
      engine.syncCamera()
    },
    screenshot() {
      if (!ready) return
      const a = document.createElement('a')
      a.download = `city-gpt-5.5-${town.seed}.png`
      a.href = engine.renderer.domElement.toDataURL('image/png')
      a.click()
    },
    inspect() {
      return {
        ready,
        implementation: 'gpt-5.5',
        seed: town?.seed,
        world: town,
        state: { ...state },
        camera: engine
          ? {
              position: engine.camera.position.toArray(),
              target: engine.controls.target.toArray(),
              zoom: engine.camera.zoom
            }
          : null,
        render: { ...engine?.renderer.info.render },
        memory: { ...engine?.renderer.info.memory }
      }
    },
    dispose() {
      disposed = true
      ready = false
      revision++
      release()
      if (window.__CITY__ === api) delete window.__CITY__
    }
  }
  if (import.meta.env.DEV) window.__CITY__ = api
  rebuild(options.seed)
  return api
}
