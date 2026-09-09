import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import {
  normalizeSize,
  createTraffic,
  advanceTraffic,
  trafficPoint,
  GROUND,
  edgeHeight,
  STREET_WIDTH
} from './world.js'
import { loadAssets, paintedGeometry, makeAssetMaterial } from './assets.js'
import { buildLandscape } from './landscape.js'
import { buildStreets } from './streets.js'
import { buildDetails } from './details.js'
import { Batch } from './geometry.js'
import { buildNightLighting, buildCarLights } from './lighting.js'

const dummy = new THREE.Object3D(),
  color = new THREE.Color()
const carNames = ['sedan', 'taxi', 'van', 'suv', 'delivery']

function disposeTree(root) {
  const geometries = new Set(),
    materials = new Set()
  root.traverse((o) => {
    if (o.geometry) geometries.add(o.geometry)
    if (o.material)
      (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => materials.add(m))
  })
  geometries.forEach((g) => g.dispose())
  materials.forEach((m) => m.dispose())
}

function instance(geometry, material, count, parent) {
  const mesh = new THREE.InstancedMesh(geometry, material, count)
  mesh.castShadow = true
  mesh.receiveShadow = true
  mesh.frustumCulled = false
  parent.add(mesh)
  return mesh
}
function matrix(mesh, i, x, y, z, yaw, sx, sy = sx, sz = sx, pitch = 0) {
  dummy.position.set(x, y, z)
  dummy.rotation.set(pitch, yaw, 0, 'YXZ')
  dummy.scale.set(sx, sy, sz)
  dummy.updateMatrix()
  mesh.setMatrixAt(i, dummy.matrix)
}

function addModels(world, assets, parent, uniforms) {
  const mat = makeAssetMaterial(uniforms),
    parts = [],
    pads = new Batch()
  const addDetail = (key, x, y, z, scale, yaw = 0) => {
    dummy.position.set(x, y, z)
    dummy.rotation.set(0, yaw, 0)
    dummy.scale.setScalar(scale)
    dummy.updateMatrix()
    parts.push(assets.get(key).geometry.clone().applyMatrix4(dummy.matrix))
  }
  for (const b of world.buildings) {
    const source = assets.get(b.asset)
    const scale = Math.min(b.frontage / source.size.x, b.depth / source.size.z)
    const sy = Math.min(scale * b.heightScale, 19 / source.size.y)
    dummy.position.set(b.x, GROUND + 0.08, b.z)
    dummy.rotation.set(0, b.yaw, 0)
    dummy.scale.set(scale, sy, scale)
    dummy.updateMatrix()
    parts.push(paintedGeometry(source.geometry, b.palette, b.asset).applyMatrix4(dummy.matrix))
    pads.box(b.x, GROUND + 0.015, b.z, b.w + 0.1, 0.07, b.d + 0.1, '#ced1be')
    const edge = world.edges[b.edge],
      node = world.nodes[edge.a],
      horizontal = edge.axis === 'x'
    const frontX = horizontal ? 0 : b.side,
      frontZ = horizontal ? -b.side : 0
    const street = horizontal ? node.z : node.x,
      center = horizontal ? b.z : b.x
    const reach = Math.abs(street - center) - STREET_WIDTH / 2
    const px = b.x + (frontX * reach) / 2,
      pz = b.z + (frontZ * reach) / 2
    pads.box(
      px,
      GROUND + 0.055,
      pz,
      horizontal ? 1.0 : reach,
      0.08,
      horizontal ? reach : 1.0,
      '#d1d0bc'
    )
    // Entry planting is inside each parcel, leaving a clear route to the sidewalk.
    for (const side of [-1, 1]) {
      const tx =
        b.x + frontX * (b.depth / 2 - 0.18) + (horizontal ? side * (b.frontage / 2 - 0.4) : 0)
      const tz =
        b.z + frontZ * (b.depth / 2 - 0.18) + (horizontal ? 0 : side * (b.frontage / 2 - 0.4))
      addDetail('suburban/planter', tx, GROUND + 0.08, tz, 0.5, b.yaw)
    }
    if (b.kind === 'suburban') {
      const bx = b.x - frontX * (b.depth / 2 - 0.04),
        bz = b.z - frontZ * (b.depth / 2 - 0.04)
      for (let i = -1; i <= 1; i++) {
        const sx = bx + (horizontal ? i * b.frontage * 0.29 : 0),
          sz = bz + (horizontal ? 0 : i * b.frontage * 0.29)
        addDetail('nature/plant_bushDetailed', sx, GROUND + 0.08, sz, 0.42, 0)
      }
    }
  }
  for (const park of world.parks)
    for (const s of [-1, 1]) {
      addDetail(
        'commercial/detail-parasol-a',
        park.x + s * 3.8,
        GROUND + 0.1,
        park.z + 2.5,
        0.85,
        s
      )
      for (let i = 0; i < 10; i++)
        addDetail(
          'nature/flower_yellowA',
          park.x + s * (park.w / 2 - 0.7),
          GROUND + 0.12,
          park.z - park.d / 2 + 1 + (i * (park.d - 2)) / 10,
          0.55,
          i
        )
    }
  if (parts.length) {
    const buildings = new THREE.Mesh(mergeGeometries(parts, false), mat)
    buildings.castShadow = true
    buildings.receiveShadow = true
    parent.add(buildings)
    parts.forEach((g) => g.dispose())
  }
  const natural = new Map()
  for (const item of [...world.trees, ...world.rocks]) {
    if (!natural.has(item.asset)) natural.set(item.asset, [])
    natural.get(item.asset).push(item)
  }
  for (const [key, items] of natural) {
    const source = assets.get(`nature/${key}`),
      mesh = instance(source.geometry.clone(), mat, items.length, parent)
    items.forEach((t, i) =>
      matrix(
        mesh,
        i,
        t.x,
        t.y,
        t.z,
        t.yaw,
        Math.min(
          t.h / source.size.y,
          (t.maxWidth ?? Infinity) / Math.max(source.size.x, source.size.z)
        )
      )
    )
    mesh.instanceMatrix.needsUpdate = true
  }
  pads.finish(parent, uniforms)
  return mat
}

function addTraffic(world, assets, parent, mat, uniforms) {
  const cars = createTraffic(world, world.stats.cars),
    people = createTraffic(world, world.stats.people, true)
  const hikers = world.trails.flatMap((trail, index) =>
    Array.from({ length: 3 }, (_, i) => ({
      trail,
      phase: (i / 3 + index * 0.13) % 1,
      id: i + index * 3
    }))
  )
  const walkers = [...people, ...hikers]
  const carLights = buildCarLights(parent, cars.length, uniforms)
  const carMeshes = carNames.map((name, variant) => {
    const src = assets.get(`cars/${name}`),
      agents = cars.filter((a) => a.variant === variant)
    const mesh = instance(src.geometry.clone(), mat, agents.length, parent)
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    return { mesh, agents, scale: 1.48 / src.size.z }
  })
  const bodyMat = new THREE.MeshStandardMaterial({ color: 'white', roughness: 0.8 })
  const body = instance(
    new THREE.CylinderGeometry(0.105, 0.13, 0.29, 6),
    bodyMat,
    walkers.length,
    parent
  )
  const heads = instance(
    new THREE.SphereGeometry(0.102, 8, 6),
    new THREE.MeshStandardMaterial({ color: '#dbb092' }),
    walkers.length,
    parent
  )
  const limbs = instance(
    new THREE.CylinderGeometry(0.036, 0.042, 0.27, 5),
    new THREE.MeshStandardMaterial({ color: '#455d62' }),
    walkers.length * 4,
    parent
  )
  for (let i = 0; i < walkers.length; i++)
    body.setColorAt(i, color.set(['#dc8a67', '#789a96', '#e9c56d', '#e8e3d2', '#9a858f'][i % 5]))
  const positionAgent = (a, dt) => {
    const p = trafficPoint(world, a)
    if (!a.pose) a.pose = { ...p }
    const blend = 1 - Math.exp(-dt * 15)
    a.pose.x = THREE.MathUtils.lerp(a.pose.x, p.x, blend)
    a.pose.z = THREE.MathUtils.lerp(a.pose.z, p.z, blend)
    a.pose.y = THREE.MathUtils.lerp(a.pose.y, p.y, blend)
    a.pose.yaw += Math.atan2(Math.sin(p.yaw - a.pose.yaw), Math.cos(p.yaw - a.pose.yaw)) * blend
    return a.pose
  }
  return {
    cars,
    people,
    hikers,
    update(dt, seconds) {
      advanceTraffic(world, cars, dt, seconds)
      advanceTraffic(world, people, dt, seconds)
      for (const { mesh, agents, scale } of carMeshes) {
        agents.forEach((a, i) => {
          const p = positionAgent(a, dt),
            edge = world.edges[a.edge]
          const slope =
            (edgeHeight(edge, Math.min(1, a.t + 0.01)) -
              edgeHeight(edge, Math.max(0, a.t - 0.01))) /
            (edge.length * 0.02)
          matrix(
            mesh,
            i,
            p.x,
            p.y,
            p.z,
            p.yaw,
            scale,
            scale,
            scale,
            -Math.atan(slope) * a.direction
          )
        })
        mesh.instanceMatrix.needsUpdate = true
      }
      carLights.update(cars)
      walkers.forEach((a, i) => {
        let p
        if (a.trail) {
          const phase = (a.phase + (seconds * 0.42) / a.trail.length) % 2,
            forward = phase < 1
          const progress = (forward ? phase : 2 - phase) * (a.trail.points.length - 1)
          const index = Math.min(a.trail.points.length - 2, Math.floor(progress)),
            t = progress - index
          const p0 = a.trail.points[index],
            p1 = a.trail.points[index + 1]
          p = {
            x: THREE.MathUtils.lerp(p0.x, p1.x, t),
            y: THREE.MathUtils.lerp(p0.y, p1.y, t),
            z: THREE.MathUtils.lerp(p0.z, p1.z, t),
            yaw: Math.atan2(p1.x - p0.x, p1.z - p0.z) + (forward ? 0 : Math.PI)
          }
          a.pose = p
        } else p = positionAgent(a, dt)
        const bob = Math.sin(seconds * 8 + a.id) * 0.015
        matrix(body, i, p.x, p.y + 0.44 + bob, p.z, p.yaw, 1)
        matrix(heads, i, p.x, p.y + 0.7 + bob, p.z, p.yaw, 1)
        for (let j = 0; j < 4; j++) {
          const side = j % 2 === 0 ? -1 : 1,
            arm = j > 1,
            swing = Math.sin(seconds * 8 + a.id) * 0.45 * side * (arm ? -1 : 1)
          const dx = side * (arm ? 0.15 : 0.065)
          matrix(
            limbs,
            i * 4 + j,
            p.x + Math.cos(p.yaw) * dx,
            p.y + (arm ? 0.43 : 0.18) + bob,
            p.z - Math.sin(p.yaw) * dx,
            p.yaw,
            1,
            1,
            1,
            swing
          )
        }
      })
      body.instanceMatrix.needsUpdate = true
      heads.instanceMatrix.needsUpdate = true
      limbs.instanceMatrix.needsUpdate = true
    }
  }
}

function addLights(streets, parent) {
  const signals = instance(
    new THREE.SphereGeometry(0.065, 6, 4),
    new THREE.MeshBasicMaterial({ color: 'white' }),
    streets.signals.length,
    parent
  )
  streets.signals.forEach((p, i) => matrix(signals, i, p.x, p.y, p.z, 0, 1))
  return {
    update(seconds) {
      streets.signals.forEach((s, i) =>
        signals.setColorAt(
          i,
          color.set(
            (Math.floor(seconds / 8) % 2 === 0) === (s.axis === 'x') ? '#8cca8c' : '#e06d51'
          )
        )
      )
      if (signals.instanceColor) signals.instanceColor.needsUpdate = true
    }
  }
}

function addWeather(parent, size) {
  const count = Math.min(2800, Math.round(950 * (size / 120) ** 2)),
    rainPos = new Float32Array(count * 6),
    snowPos = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    const x = Math.random() * size - size / 2,
      y = Math.random() * 38 + 1,
      z = Math.random() * size - size / 2
    rainPos.set([x, y, z, x - 0.18, y + 1.1, z], i * 6)
    snowPos.set([x, y, z], i * 3)
  }
  const rg = new THREE.BufferGeometry()
  rg.setAttribute('position', new THREE.BufferAttribute(rainPos, 3))
  const rain = new THREE.LineSegments(
    rg,
    new THREE.LineBasicMaterial({
      color: '#b2d2da',
      transparent: true,
      opacity: 0.55,
      depthWrite: false
    })
  )
  const sg = new THREE.BufferGeometry()
  sg.setAttribute('position', new THREE.BufferAttribute(snowPos, 3))
  const snow = new THREE.Points(
    sg,
    new THREE.PointsMaterial({
      color: '#ffffff',
      size: 0.18,
      transparent: true,
      opacity: 0.85,
      depthWrite: false
    })
  )
  rain.frustumCulled = false
  snow.frustumCulled = false
  parent.add(rain, snow)
  return {
    update(mode, dt, t) {
      rain.visible = mode === 'rain'
      snow.visible = mode === 'snow'
      if (rain.visible) {
        for (let i = 0; i < count; i++) {
          const k = i * 6
          rainPos[k + 1] -= dt * 20
          if (rainPos[k + 1] < 0) rainPos[k + 1] = 38
          rainPos[k + 4] = rainPos[k + 1] + 1.1
        }
        rg.attributes.position.needsUpdate = true
      }
      if (snow.visible) {
        for (let i = 0; i < count; i++) {
          const k = i * 3
          snowPos[k + 1] -= dt * 2
          snowPos[k] += Math.sin(t * 0.5 + i) * dt * 0.5
          if (Math.abs(snowPos[k]) > size / 2) snowPos[k] *= -0.99
          if (snowPos[k + 1] < 0) snowPos[k + 1] = 38
        }
        sg.attributes.position.needsUpdate = true
      }
    }
  }
}

export function createCity(container, options, events = {}) {
  let disposed = false,
    raf = 0,
    root = new THREE.Group(),
    traffic,
    details,
    lights,
    nightLighting,
    weather,
    world,
    cancelGeneration,
    ready = false,
    revision = 0
  let seconds = 0,
    frameCount = 0,
    fpsStart = performance.now(),
    last = performance.now(),
    lastSun = -1,
    lastNotify = 0
  const state = {
    time: 10.5,
    weather: 'sun',
    paused: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    speed: 1,
    ...options,
    size: normalizeSize(options.size)
  }
  const uniforms = { time: { value: 0 }, night: { value: 0 }, snow: { value: 0 } }
  const scene = new THREE.Scene()
  scene.background = new THREE.Color('#dfe9e5')
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    preserveDrawingBuffer: true,
    powerPreference: 'high-performance'
  })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.0
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.shadowMap.autoUpdate = false
  renderer.domElement.setAttribute('aria-label', '可旋转的三维城市')
  renderer.domElement.setAttribute('role', 'img')
  container.appendChild(renderer.domElement)
  const camera = new THREE.OrthographicCamera(-90, 90, 90, -90, 0.1, 700)
  camera.position.set(112, 113, 150)
  const controls = new OrbitControls(camera, renderer.domElement)
  controls.target.set(0, 1, 0)
  controls.enableDamping = true
  controls.dampingFactor = 0.075
  controls.minPolarAngle = 0.01
  controls.maxPolarAngle = Math.PI * 0.43
  controls.minZoom = 0.55
  controls.maxZoom = 5
  controls.screenSpacePanning = true
  controls.enablePan = true
  controls.rotateSpeed = 0.6
  controls.zoomSpeed = 0.85
  controls.autoRotateSpeed = 0.4
  controls.touches.ONE = THREE.TOUCH.ROTATE
  controls.touches.TWO = THREE.TOUCH.DOLLY_PAN
  controls.update()
  controls.saveState()
  const ambient = new THREE.HemisphereLight('#e7f4ff', '#afae91', 2.5)
  scene.add(ambient)
  const sun = new THREE.DirectionalLight('#fff0d0', 3.2)
  sun.position.set(-45, 90, 40)
  sun.castShadow = true
  Object.assign(sun.shadow.camera, {
    left: -88,
    right: 88,
    top: 88,
    bottom: -88,
    near: 1,
    far: 270
  })
  sun.shadow.mapSize.set(2048, 2048)
  sun.shadow.normalBias = 0.08
  sun.shadow.bias = -0.00015
  sun.shadow.radius = 3
  scene.add(sun)
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(1000, 1000),
    new THREE.ShadowMaterial({ opacity: 0.1 })
  )
  floor.rotation.x = -Math.PI / 2
  floor.position.y = -2.5
  floor.receiveShadow = true
  scene.add(floor, root)
  function resize() {
    const w = container.clientWidth,
      h = container.clientHeight,
      aspect = w / h,
      halfHeight = ((aspect < 1 ? 90 / aspect : 82) * state.size) / 120
    camera.left = -halfHeight * aspect
    camera.right = halfHeight * aspect
    camera.top = halfHeight
    camera.bottom = -halfHeight
    camera.updateProjectionMatrix()
    renderer.setSize(w, h)
    if (ready) renderer.render(scene, camera)
  }
  const observer = new ResizeObserver(resize)
  observer.observe(container)
  resize()
  function generate(seed, density, size) {
    cancelGeneration?.()
    return new Promise((resolve, reject) => {
      const worker = new Worker(new URL('./world.worker.js', import.meta.url), { type: 'module' })
      cancelGeneration = () => {
        worker.terminate()
        resolve(null)
      }
      worker.onmessage = ({ data }) => {
        worker.terminate()
        cancelGeneration = null
        if (data.error) reject(new Error(data.error))
        else resolve(data.world)
      }
      worker.onerror = (e) => {
        worker.terminate()
        cancelGeneration = null
        reject(new Error(e.message || '城市生成失败'))
      }
      worker.postMessage({ seed, density, size })
    })
  }
  async function rebuild(seed, density, size = state.size) {
    const token = ++revision
    ready = false
    events.onLoading?.(0.02)
    try {
      const nextWorld = await generate(seed, density, normalizeSize(size))
      if (!nextWorld || disposed || token !== revision) return
      events.onLoading?.(0.28)
      const assets = await loadAssets(nextWorld, (p) => {
        if (!disposed && token === revision) events.onLoading?.(0.28 + p * 0.35)
      })
      if (disposed || token !== revision) return
      const next = new THREE.Group()
      buildLandscape(nextWorld, next, uniforms)
      events.onLoading?.(0.72)
      await new Promise((resolve) => setTimeout(resolve, 0))
      if (disposed || token !== revision) {
        disposeTree(next)
        return
      }
      const streets = buildStreets(nextWorld, next, uniforms)
      const nextDetails = buildDetails(nextWorld, next, uniforms)
      const mat = addModels(nextWorld, assets, next, uniforms)
      const nextTraffic = addTraffic(nextWorld, assets, next, mat, uniforms),
        nextLights = addLights(streets, next),
        nextWeather = addWeather(next, nextWorld.size)
      const nextNightLighting = buildNightLighting(
        nextWorld,
        next,
        [...streets.lamps, ...nextDetails.lamps],
        uniforms
      )
      events.onLoading?.(0.92)
      scene.remove(root)
      nightLighting?.dispose()
      disposeTree(root)
      root = next
      scene.add(root)
      const sizeChanged = !world || world.size !== nextWorld.size
      world = nextWorld
      traffic = nextTraffic
      details = nextDetails
      lights = nextLights
      nightLighting = nextNightLighting
      weather = nextWeather
      state.seed = seed
      state.density = density
      state.size = nextWorld.size
      const extent = state.size / 120
      controls.maxZoom = 5 * extent
      Object.assign(sun.shadow.camera, {
        left: -88 * extent,
        right: 88 * extent,
        top: 88 * extent,
        bottom: -88 * extent,
        far: 270 * extent
      })
      sun.shadow.camera.updateProjectionMatrix()
      resize()
      if (sizeChanged) api.reset()
      lastSun = -1
      traffic.update(0.016, seconds)
      details.update(seconds, uniforms.night.value, 0.016)
      renderer.shadowMap.needsUpdate = true
      await renderer.compileAsync(scene, camera)
      if (disposed || token !== revision) return
      ready = true
      fpsStart = performance.now()
      frameCount = 0
      events.onLoading?.(1)
      events.onReady?.(world.stats)
    } catch (error) {
      if (!disposed && token === revision) events.onError?.(error.message)
    }
  }
  function setSun() {
    const angle = ((state.time - 6) / 12) * Math.PI,
      elevation = Math.sin(angle),
      night = THREE.MathUtils.smoothstep(-elevation, -0.08, 0.45),
      cloud = state.weather === 'sun' ? 1 : 0.67
    uniforms.night.value = night
    const extent = state.size / 120
    sun.position.set(
      Math.cos(angle) * 80 * extent,
      Math.max(16, elevation * 100) * extent,
      40 * extent
    )
    sun.intensity = (1 - night) * 3.0 * cloud + 0.15
    ambient.intensity = (1.5 - night * 0.94) * cloud
    sun.color.set(night > 0.5 ? '#b7d1e9' : elevation < 0.35 ? '#ffbf88' : '#fff1d5')
    scene.background
      .set('#dfebe6')
      .lerp(color.set('#283f50'), night)
      .lerp(color.set('#a1b7bb'), state.weather === 'sun' ? 0 : 0.32)
    container.parentElement.style.setProperty('--sky-color', scene.background.getStyle())
    renderer.shadowMap.needsUpdate = true
  }
  function animate(now) {
    if (disposed) return
    raf = requestAnimationFrame(animate)
    const dt = Math.min((now - last) / 1000, 0.06)
    last = now
    const active = state.paused ? 0 : dt
    if (ready) {
      seconds += active
      state.time = (state.time + active * 0.025 * state.speed) % 24
    }
    uniforms.time.value = seconds
    uniforms.snow.value = THREE.MathUtils.damp(
      uniforms.snow.value,
      state.weather === 'snow' ? 1 : 0,
      0.45,
      dt
    )
    if (Math.abs(lastSun - state.time) > 0.04) {
      lastSun = state.time
      setSun()
    }
    controls.update()
    if (ready) {
      traffic.update(active, seconds)
      lights.update(seconds)
      weather.update(state.weather, active, seconds)
      details.update(seconds, uniforms.night.value, active)
      for (const { group, cabins, radius } of details.moving) {
        group.rotation.z = seconds * 0.075
        cabins.forEach((c, i) => {
          const a = (i / cabins.length) * Math.PI * 2
          c.position.set(Math.sin(a) * radius, Math.cos(a) * radius, 0)
          c.rotation.z = -group.rotation.z
        })
      }
    }
    renderer.render(scene, camera)
    frameCount++
    if (now - fpsStart > 1200) {
      events.onPerformance?.({
        fps: Math.round((frameCount * 1000) / (now - fpsStart)),
        drawCalls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles
      })
      fpsStart = now
      frameCount = 0
    }
    if (now - lastNotify > 400) {
      events.onTime?.(state.time)
      const north = new THREE.Vector3(0, 0, -1).project(camera)
      const origin = new THREE.Vector3().project(camera)
      events.onBearing?.(
        (Math.atan2(
          (north.x - origin.x) * container.clientWidth,
          (north.y - origin.y) * container.clientHeight
        ) *
          180) /
          Math.PI
      )
      lastNotify = now
    }
  }
  const api = {
    rebuild,
    set(config) {
      Object.assign(state, config)
      lastSun = -1
      if (config.autoRotate !== undefined) controls.autoRotate = config.autoRotate
      if (config.mode) {
        controls.mouseButtons.LEFT = config.mode === 'pan' ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE
        controls.touches.ONE = config.mode === 'pan' ? THREE.TOUCH.PAN : THREE.TOUCH.ROTATE
      }
    },
    reset() {
      controls.reset()
      const extent = state.size / 120
      controls.target.set(0, 1, 0)
      camera.position.set(112 * extent, 113 * extent, 150 * extent)
      camera.zoom = 1
      camera.updateProjectionMatrix()
      controls.update()
    },
    overview() {
      controls.target.set(0, 0, 0)
      camera.position.set(0, (200 * state.size) / 120, 0.1)
      camera.zoom = 1.1
      camera.updateProjectionMatrix()
      controls.update()
    },
    zoom(factor) {
      camera.zoom = THREE.MathUtils.clamp(camera.zoom * factor, controls.minZoom, controls.maxZoom)
      camera.updateProjectionMatrix()
    },
    screenshot() {
      renderer.render(scene, camera)
      const a = document.createElement('a')
      a.download = `city-${world.seed}.png`
      a.href = renderer.domElement.toDataURL('image/png')
      a.click()
    },
    inspect() {
      return {
        ready,
        seed: world?.seed,
        world,
        agents: traffic?.cars,
        people: traffic?.people,
        hikers: traffic?.hikers.map((h) => h.pose),
        boats: details?.boats.map((b) => ({ ...b.pose, speed: b.data.speed })),
        lighting: {
          night: uniforms.night.value,
          lamps: nightLighting?.count,
          headlights: (traffic?.cars.length || 0) * 2,
          lighthouseIntensity: details?.lantern.intensity,
          beaconAngle: details?.beacon?.rotor.rotation.y
        },
        state: { ...state },
        camera: {
          position: camera.position.toArray(),
          target: controls.target.toArray(),
          zoom: camera.zoom
        },
        render: { ...renderer.info.render },
        memory: { ...renderer.info.memory }
      }
    },
    dispose() {
      disposed = true
      revision++
      cancelGeneration?.()
      cancelAnimationFrame(raf)
      observer.disconnect()
      controls.dispose()
      disposeTree(scene)
      nightLighting?.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      renderer.domElement.remove()
      if (window.__CITY__ === api) delete window.__CITY__
    }
  }
  if (import.meta.env.DEV) window.__CITY__ = api
  setSun()
  raf = requestAnimationFrame(animate)
  rebuild(options.seed, options.density, state.size)
  return api
}
