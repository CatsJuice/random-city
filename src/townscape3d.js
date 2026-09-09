import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

const TAU = Math.PI * 2
const GRID_SIZE = 23
const CELL_SIZE = 1.15
const HALF_GRID = GRID_SIZE / 2
const RENDER_FPS = 18
const ORTHO_BASE_SIZE = 38
const BOARD_WORLD_SIZE = 31.5
const MAP_TEXTURE_SIZE = 1536
const USE_LEGACY_GEOMETRY_PIPELINE = false

const BUILDING_COLORS = {
  brick: [0xb85f4e, 0xc9735e, 0x9f5148, 0xd4876f],
  plaster: [0xf2c078, 0xf6d38d, 0xd9a75d, 0xf0a984],
  glass: [0x7fb8d7, 0x6aa6c8, 0x8ecae6, 0x5c8fb3],
  civic: [0xd8c4a3, 0xcbb694, 0xe0d2b8],
  shop: [0xe98f7c, 0xe0b15d, 0x8ac6d1, 0x91c788],
  tower: [0x7ca7c7, 0x8ebbd3, 0x7795ad, 0xa6c5d8],
}

export const WEATHER_MODES = [
  { id: 'sunny', label: '晴' },
  { id: 'rain', label: '雨' },
  { id: 'snow', label: '雪' },
]

export function makeSeed() {
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}

export function formatCityTime(hours) {
  const normalized = ((hours % 24) + 24) % 24
  const h = Math.floor(normalized)
  const m = Math.floor((normalized - h) * 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function generateTown(seed) {
  const rng = makeRng(seed)
  const vertices = createOrganicVertices(rng)
  const river = createRiverCurve(rng)
  const cells = []
  const roads = []
  const buildings = []
  const parks = []
  const water = []

  for (let z = 0; z < GRID_SIZE; z += 1) {
    for (let x = 0; x < GRID_SIZE; x += 1) {
      const corners = [
        vertices[z][x],
        vertices[z][x + 1],
        vertices[z + 1][x + 1],
        vertices[z + 1][x],
      ]
      const center = averageXZ(corners)
      const normalizedRadius = Math.hypot(center.x / (HALF_GRID * CELL_SIZE), center.z / (HALF_GRID * CELL_SIZE))
      const islandNoise = Math.sin(center.x * 0.72 + seed.length) * 0.08 + Math.cos(center.z * 0.57) * 0.07
      const onIsland = normalizedRadius < 0.98 + islandNoise
      if (!onIsland) continue

      const riverDistance = Math.abs(center.z - river.zAt(center.x))
      const isWater = riverDistance < river.width * (0.75 + 0.22 * noise2(center.x, center.z))
      const roadBand = x % 5 === 0 || z % 6 === 0 || Math.abs(center.z - river.zAt(center.x)) < river.width + 0.46
      const isRoad = !isWater && roadBand && normalizedRadius < 0.9
      const cityCore = Math.abs(center.x) < 8.4 && Math.abs(center.z) < 8.2
      const cityShoulder = Math.abs(center.x) < 10.4 && Math.abs(center.z) < 10.2
      const parkChance = 0.08 + Math.max(0, river.width * 1.25 - riverDistance) * 0.05 + Math.max(0, normalizedRadius - 0.62) * 0.8 + (cityCore ? 0 : 0.32)
      const isPark = !isWater && !isRoad && rng() < parkChance
      const buildChance = cityCore ? 0.92 : cityShoulder ? 0.38 : 0.04

      const cell = { x, z, corners, center, riverDistance, isWater, isRoad, isPark, normalizedRadius }
      cells.push(cell)
      if (isWater) water.push(cell)
      else if (isRoad) roads.push(cell)
      else if (isPark) parks.push(cell)
      else if (rng() < buildChance) buildings.push(createBuilding(rng, cell))
      else parks.push({ ...cell, isPark: true })
    }
  }

  const bridges = createBridges(roads, river)
  const trees = createTrees(rng, cells, parks, river)
  const cars = createCars(rng, roads)
  const people = createPeople(rng, roads)
  const streetFurniture = createStreetFurniture(rng, roads, bridges)

  return {
    seed,
    cells,
    roads,
    water,
    parks,
    buildings,
    bridges,
    trees,
    cars,
    people,
    streetFurniture,
    river,
    stats: {
      buildings: buildings.length,
      roads: roads.length,
      bridges: bridges.length,
      trees: trees.length,
      cars: cars.length,
      people: people.length,
    },
  }
}

export function createTownRenderer(container, town, options = {}) {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0xf0e6d0)
  scene.fog = new THREE.Fog(0xf0e6d0, 110, 190)

  const renderer = new THREE.WebGLRenderer({
    antialias: false,
    alpha: false,
    preserveDrawingBuffer: true,
    powerPreference: 'default',
  })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1))
  renderer.setSize(container.clientWidth, container.clientHeight)
  renderer.shadowMap.enabled = false
  renderer.outputColorSpace = THREE.SRGBColorSpace
  container.appendChild(renderer.domElement)

  const camera = new THREE.OrthographicCamera(-16, 16, 16, -16, 0.1, 180)
  camera.position.set(29, 31, 29)

  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enabled = false
  controls.enableDamping = true
  controls.enableRotate = true
  controls.enablePan = true
  controls.enableZoom = true
  controls.dampingFactor = 0.07
  controls.maxPolarAngle = Math.PI * 0.42
  controls.minPolarAngle = Math.PI * 0.18
  controls.minDistance = 14
  controls.maxDistance = 72
  controls.minZoom = 0.65
  controls.maxZoom = 2.7
  controls.rotateSpeed = 0.62
  controls.panSpeed = 0.78
  controls.zoomSpeed = 1.08
  controls.screenSpacePanning = true
  controls.mouseButtons = {
    LEFT: THREE.MOUSE.ROTATE,
    MIDDLE: THREE.MOUSE.DOLLY,
    RIGHT: THREE.MOUSE.PAN,
  }
  controls.touches = {
    ONE: THREE.TOUCH.ROTATE,
    TWO: THREE.TOUCH.DOLLY_PAN,
  }
  controls.target.set(0, 0.35, 0)
  controls.update()

  const root = new THREE.Group()
  scene.add(root)

  const ambient = new THREE.HemisphereLight(0xeef8ff, 0x6d825b, 1.45)
  scene.add(ambient)
  const sun = new THREE.DirectionalLight(0xfff1cc, 2.1)
  sun.position.set(16, 24, 10)
  scene.add(sun)

  const materials = createMaterials(town)
  materials.ready.then(() => {
    materials.readyResolved = true
    if (!disposed) {
      renderer.render(scene, camera)
      capturePreview()
    }
  })
  buildTownMeshes(root, town, materials)
  const movers = buildMovers(root, town, materials)
  const weather = createWeather(scene)

  let disposed = false
  let weatherMode = options.weather || 'sunny'
  let timeHours = options.timeHours || 9
  let navigationMode = options.navigationMode || 'rotate'
  let pointerState = null
  let last = performance.now()
  let lastRender = 0
  let previewCaptured = false

  function resize() {
    const width = Math.max(1, container.clientWidth)
    const height = Math.max(1, container.clientHeight)
    const aspect = width / height
    const viewSize = ORTHO_BASE_SIZE
    camera.left = (-viewSize * aspect) / 2
    camera.right = (viewSize * aspect) / 2
    camera.top = viewSize / 2
    camera.bottom = -viewSize / 2
    camera.updateProjectionMatrix()
    renderer.setSize(width, height)
  }

  function setWeather(next) {
    weatherMode = next
    weather.rain.visible = next === 'rain'
    weather.snow.visible = next === 'snow'
  }

  function setNavigationMode(mode) {
    navigationMode = mode
    const leftButton = mode === 'pan' ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE
    const rightButton = mode === 'pan' ? THREE.MOUSE.ROTATE : THREE.MOUSE.PAN
    controls.mouseButtons.LEFT = leftButton
    controls.mouseButtons.RIGHT = rightButton
    container.style.cursor = mode === 'pan' ? 'move' : 'grab'
    renderer.domElement.style.cursor = mode === 'pan' ? 'move' : 'grab'
  }

  function syncCamera() {
    camera.lookAt(controls.target)
    camera.updateProjectionMatrix()
  }

  function rotateCamera(dx) {
    const offset = camera.position.clone().sub(controls.target)
    offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), -dx * 0.008)
    camera.position.copy(controls.target).add(offset)
    syncCamera()
  }

  function panCamera(dx, dy) {
    const forward = controls.target.clone().sub(camera.position)
    forward.y = 0
    forward.normalize()
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize()
    const scale = (camera.top - camera.bottom) / Math.max(1, renderer.domElement.clientHeight) / camera.zoom
    const movement = right.multiplyScalar(-dx * scale).add(forward.multiplyScalar(dy * scale))
    camera.position.add(movement)
    controls.target.add(movement)
    syncCamera()
  }

  function zoomCamera(deltaY) {
    const nextZoom = THREE.MathUtils.clamp(camera.zoom * (1 - deltaY * 0.001), controls.minZoom, controls.maxZoom)
    camera.zoom = nextZoom
    syncCamera()
  }

  function onPointerDown(event) {
    if (event.button !== 0) return
    pointerState = { id: event.pointerId, x: event.clientX, y: event.clientY }
    container.setPointerCapture(event.pointerId)
    container.style.cursor = 'grabbing'
    renderer.domElement.style.cursor = 'grabbing'
    event.preventDefault()
  }

  function onPointerMove(event) {
    if (!pointerState || pointerState.id !== event.pointerId) return
    const dx = event.clientX - pointerState.x
    const dy = event.clientY - pointerState.y
    if (Math.abs(dx) + Math.abs(dy) > 0.2) {
      if (navigationMode === 'pan') panCamera(dx, dy)
      else rotateCamera(dx)
    }
    pointerState.x = event.clientX
    pointerState.y = event.clientY
    event.preventDefault()
  }

  function onPointerUp(event) {
    if (pointerState?.id === event.pointerId) {
      pointerState = null
      if (container.hasPointerCapture(event.pointerId)) container.releasePointerCapture(event.pointerId)
      container.style.cursor = navigationMode === 'pan' ? 'move' : 'grab'
      renderer.domElement.style.cursor = navigationMode === 'pan' ? 'move' : 'grab'
    }
  }

  function onMouseDown(event) {
    if (event.button !== 0 || pointerState) return
    pointerState = { id: 'mouse', x: event.clientX, y: event.clientY }
    container.style.cursor = 'grabbing'
    renderer.domElement.style.cursor = 'grabbing'
    event.preventDefault()
  }

  function onMouseMove(event) {
    if (pointerState?.id !== 'mouse') return
    const dx = event.clientX - pointerState.x
    const dy = event.clientY - pointerState.y
    if (Math.abs(dx) + Math.abs(dy) > 0.2) {
      if (navigationMode === 'pan') panCamera(dx, dy)
      else rotateCamera(dx)
    }
    pointerState.x = event.clientX
    pointerState.y = event.clientY
    event.preventDefault()
  }

  function onMouseUp() {
    if (pointerState?.id !== 'mouse') return
    pointerState = null
    container.style.cursor = navigationMode === 'pan' ? 'move' : 'grab'
    renderer.domElement.style.cursor = navigationMode === 'pan' ? 'move' : 'grab'
  }

  function onWheel(event) {
    zoomCamera(event.deltaY)
    event.preventDefault()
  }

  function setTime(hours) {
    timeHours = hours
    const sunAmount = Math.max(0, Math.sin(((timeHours - 6) / 12) * Math.PI))
    const night = 1 - sunAmount
    ambient.intensity = 0.55 + sunAmount * 1.1
    sun.intensity = 0.35 + sunAmount * 2.05
    sun.position.set(Math.cos((timeHours / 24) * TAU) * 22, 7 + sunAmount * 24, Math.sin((timeHours / 24) * TAU) * 22)
    scene.background = new THREE.Color().lerpColors(new THREE.Color(0x252335), new THREE.Color(0xf0e6d0), 1 - night * 0.72)
    scene.fog.color = scene.background
  }

  function capturePreview() {
    if (previewCaptured || typeof options.onPreview !== 'function') return
    if (!materials.readyResolved) return
    previewCaptured = true
    options.onPreview(renderer.domElement.toDataURL('image/jpeg', 0.78))
  }

  function animate(now) {
    if (disposed) return
    const dt = Math.min(0.08, (now - last) / 1000)
    last = now
    if (now - lastRender > 1000 / RENDER_FPS) {
      lastRender = now
      controls.update()
      animateMovers(movers, dt)
      animateWeather(weather, dt, weatherMode)
      setTime(timeHours)
      renderer.render(scene, camera)
      capturePreview()
    }
    requestAnimationFrame(animate)
  }

  resize()
  setWeather(weatherMode)
  setNavigationMode(options.navigationMode || 'rotate')
  setTime(timeHours)
  syncCamera()
  container.addEventListener('pointerdown', onPointerDown)
  container.addEventListener('pointermove', onPointerMove)
  container.addEventListener('pointerup', onPointerUp)
  container.addEventListener('pointercancel', onPointerUp)
  container.addEventListener('mousedown', onMouseDown)
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
  container.addEventListener('wheel', onWheel, { passive: false })
  renderer.render(scene, camera)
  capturePreview()
  requestAnimationFrame(animate)
  const observer = new ResizeObserver(resize)
  observer.observe(container)

  return {
    renderer,
    camera,
    controls,
    setWeather,
    setTime,
    setNavigationMode,
    syncCamera,
    dispose() {
      disposed = true
      observer.disconnect()
      container.removeEventListener('pointerdown', onPointerDown)
      container.removeEventListener('pointermove', onPointerMove)
      container.removeEventListener('pointerup', onPointerUp)
      container.removeEventListener('pointercancel', onPointerUp)
      container.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      container.removeEventListener('wheel', onWheel)
      controls.dispose()
      scene.traverse((object) => {
        if (object.geometry) object.geometry.dispose()
        if (object.material) {
          if (Array.isArray(object.material)) object.material.forEach((mat) => mat.dispose())
          else object.material.dispose()
        }
      })
      renderer.dispose()
      renderer.domElement.remove()
    },
  }
}

function buildTownMeshes(root, town, materials) {
  root.add(createCompassBase(materials))

  if (USE_LEGACY_GEOMETRY_PIPELINE) {
    const buildingGroup = new THREE.Group()
    buildingGroup.add(createMergedBuildingGroup(town.buildings))
    buildingGroup.add(createFacadeGroup(town.buildings))
    buildingGroup.add(createRoofDetailGroup(town.buildings, materials))
    buildingGroup.add(createBuildingLineGroup(town.buildings))
    root.add(buildingGroup)
    root.add(createBridgeGroup(town.bridges, materials))
    root.add(createStreetFurnitureInstances(town.streetFurniture, materials))
    root.add(createAtlasDecals(town, materials))
  } else {
    root.add(createBridgeGroup(town.bridges, materials))
    root.add(createIllustratedPropSprites(town, materials))
    root.add(createIllustratedBuildingSprites(town.buildings, materials))
    root.add(createIllustratedLandmarkSprites(town, materials))
  }

  root.add(createMapLegend())
}

function createMaterials(town) {
  const atlas = loadAtlasTexture()
  const mapBase = createDynamicMapBaseTexture(town)
  const buildingSprites = loadBuildingSpriteTexture()
  const landmarkSprites = loadLandmarkSpriteTexture()
  const propSprites = loadPropSpriteTexture()
  const ready = Promise.all([
    atlas.userData.ready,
    buildingSprites.userData.ready,
    landmarkSprites.userData.ready,
    propSprites.userData.ready,
  ])
  const tile = (x, y, options = {}) => createAtlasMaterial(atlas, x, y, options)

  return {
    ready,
    readyResolved: false,
    atlas,
    mapBase: new THREE.MeshBasicMaterial({ map: mapBase, side: THREE.DoubleSide }),
    buildingCutouts: createSpriteAtlasMaterials(buildingSprites),
    landmarkCutouts: createSpriteAtlasMaterials(landmarkSprites),
    propCutouts: createSpriteAtlasMaterials(propSprites),
    grass: tile(2, 0, { color: 0xeef7d1 }),
    sidewalk: tile(0, 1, { color: 0xffffff }),
    road: tile(3, 0, { color: 0xffffff }),
    water: tile(1, 1, { color: 0xffffff }),
    beach: tile(2, 1, { color: 0xffffff }),
    park: tile(0, 3, { color: 0xffffff }),
    roofTile: tile(1, 0, { color: 0xffffff }),
    bridge: tile(3, 2, { color: 0xffffff }),
    treeSprites: [
      createAtlasSubMaterial(atlas, 0, 2, 0.02, 0.02, 0.23, 0.25),
      createAtlasSubMaterial(atlas, 0, 2, 0.27, 0.04, 0.22, 0.25),
      createAtlasSubMaterial(atlas, 0, 2, 0.53, 0.04, 0.2, 0.24),
      createAtlasSubMaterial(atlas, 0, 2, 0.72, 0.5, 0.23, 0.28),
      createAtlasSubMaterial(atlas, 0, 2, 0.1, 0.68, 0.22, 0.22),
    ],
    boatSprites: [
      createAtlasSubMaterial(atlas, 1, 2, 0.05, 0.08, 0.29, 0.28),
      createAtlasSubMaterial(atlas, 1, 2, 0.38, 0.08, 0.25, 0.28),
      createAtlasSubMaterial(atlas, 1, 2, 0.64, 0.1, 0.31, 0.27),
      createAtlasSubMaterial(atlas, 1, 2, 0.06, 0.42, 0.31, 0.26),
    ],
    carSprites: [
      createAtlasSubMaterial(atlas, 2, 2, 0.06, 0.08, 0.22, 0.19),
      createAtlasSubMaterial(atlas, 2, 2, 0.38, 0.1, 0.2, 0.18),
      createAtlasSubMaterial(atlas, 2, 2, 0.68, 0.1, 0.22, 0.18),
      createAtlasSubMaterial(atlas, 2, 2, 0.08, 0.44, 0.24, 0.19),
    ],
    landmarkSprites: [
      createAtlasSubMaterial(atlas, 1, 3, 0.02, 0.05, 0.22, 0.45),
      createAtlasSubMaterial(atlas, 1, 3, 0.27, 0.08, 0.22, 0.42),
      createAtlasSubMaterial(atlas, 1, 3, 0.52, 0.06, 0.21, 0.45),
      createAtlasSubMaterial(atlas, 1, 3, 0.72, 0.06, 0.24, 0.48),
    ],
    mountainSprite: createAtlasSubMaterial(atlas, 3, 1, 0.02, 0.04, 0.94, 0.9),
    bridgeSprite: createAtlasSubMaterial(atlas, 3, 2, 0.03, 0.03, 0.43, 0.3),
    lampPost: new THREE.MeshLambertMaterial({ color: 0x394b55 }),
    lampGlow: new THREE.MeshBasicMaterial({ color: 0xffedaa }),
    traffic: new THREE.MeshLambertMaterial({ color: 0x26343b }),
    rail: new THREE.MeshLambertMaterial({ color: 0xdad6bd }),
    person: new THREE.MeshLambertMaterial({ color: 0x263238 }),
  }
}

function loadAtlasTexture() {
  return loadProjectTexture('/assets/illustrated-city-atlas.png')
}

function loadBuildingSpriteTexture() {
  return loadProjectTexture('/assets/building-sprites.png', { chromaKey: true })
}

function loadLandmarkSpriteTexture() {
  return loadProjectTexture('/assets/landmark-sprites.png', { chromaKey: true })
}

function loadPropSpriteTexture() {
  return loadProjectTexture('/assets/prop-sprites.png', { chromaKey: true })
}

function loadProjectTexture(path, options = {}) {
  let resolveReady
  const ready = new Promise((resolve) => {
    resolveReady = resolve
  })
  const texture = new THREE.TextureLoader().load(path, () => {
    if (options.chromaKey) applyTextureChromaKey(texture)
    texture.needsUpdate = true
    resolveReady()
  })
  texture.colorSpace = THREE.SRGBColorSpace
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.wrapS = THREE.ClampToEdgeWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  texture.userData.ready = ready
  return texture
}

function applyTextureChromaKey(texture) {
  const image = texture.image
  if (!image?.width || !image?.height) return
  const canvas = document.createElement('canvas')
  canvas.width = image.width
  canvas.height = image.height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(image, 0, 0)
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const { data } = imageData
  for (let i = 0; i < data.length; i += 4) {
    const red = data[i]
    const green = data[i + 1]
    const blue = data[i + 2]
    const magentaStrength = Math.min(red, blue) - green
    if (red > 145 && blue > 145 && magentaStrength > 72) {
      const keep = THREE.MathUtils.clamp((168 - magentaStrength) / 96, 0, 1)
      data[i + 3] = Math.round(data[i + 3] * keep)
      if (keep > 0) {
        data[i] = Math.round(red * keep + green * (1 - keep))
        data[i + 2] = Math.round(blue * keep + green * (1 - keep))
      }
    }
  }
  ctx.putImageData(imageData, 0, 0)
  texture.image = canvas
  texture.format = THREE.RGBAFormat
  texture.premultiplyAlpha = false
}

function createDynamicMapBaseTexture(town) {
  const canvas = document.createElement('canvas')
  canvas.width = MAP_TEXTURE_SIZE
  canvas.height = MAP_TEXTURE_SIZE
  const ctx = canvas.getContext('2d')
  const project = createMapProjection(MAP_TEXTURE_SIZE)

  drawMapPaper(ctx, canvas.width)
  drawMapCells(ctx, town, project)
  drawRiverCourse(ctx, town.river, project)
  drawBuildingParcels(ctx, town.buildings, project)
  drawRoadNetwork(ctx, town.roads, project)
  drawBridgeDecks(ctx, town.bridges, project)
  drawStreetAnnotations(ctx, town.streetFurniture, project)
  drawMapTextureGrain(ctx, canvas.width, town.seed)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.wrapS = THREE.ClampToEdgeWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  texture.anisotropy = 4
  texture.userData.ready = Promise.resolve()
  return texture
}

function createMapProjection(size) {
  const scale = size / BOARD_WORLD_SIZE
  return {
    size,
    scale,
    point(point) {
      return {
        x: (point.x / BOARD_WORLD_SIZE + 0.5) * size,
        y: (point.z / BOARD_WORLD_SIZE + 0.5) * size,
      }
    },
  }
}

function drawMapPaper(ctx, size) {
  const gradient = ctx.createLinearGradient(0, 0, size, size)
  gradient.addColorStop(0, '#efe5ca')
  gradient.addColorStop(0.55, '#e5d7b7')
  gradient.addColorStop(1, '#d7c59f')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)

  const pad = size * 0.035
  ctx.fillStyle = '#d9caa7'
  roundedRect(ctx, pad * 0.55, pad * 0.72, size - pad * 0.72, size - pad * 0.62, size * 0.018)
  ctx.fill()
  ctx.fillStyle = '#f1e7c9'
  roundedRect(ctx, pad, pad, size - pad * 2, size - pad * 2, size * 0.018)
  ctx.fill()
  ctx.strokeStyle = '#7a6a4e'
  ctx.lineWidth = 5
  ctx.stroke()
}

function drawMapCells(ctx, town, project) {
  town.cells.forEach((cell) => {
    const palette =
      cell.isWater ? ['#61afd2', '#4f9fc3'] :
        cell.isPark ? ['#9dbc6a', '#81a857'] :
          ['#c7d99c', '#b7ca8a']
    ctx.fillStyle = palette[Math.abs(cell.x * 17 + cell.z * 29) % palette.length]
    drawWorldPolygon(ctx, cell.corners, project)
    ctx.fill()
  })

  ctx.save()
  town.parks.forEach((cell, index) => {
    if (index % 2 !== 0) return
    const p = project.point(cell.center)
    ctx.fillStyle = 'rgba(91, 129, 62, 0.18)'
    ctx.beginPath()
    ctx.ellipse(p.x, p.y, project.scale * 0.34, project.scale * 0.18, index * 0.47, 0, TAU)
    ctx.fill()
  })
  ctx.restore()
}

function drawRiverCourse(ctx, river, project) {
  const points = []
  const minX = -HALF_GRID * CELL_SIZE * 0.98
  const maxX = HALF_GRID * CELL_SIZE * 0.98
  for (let x = minX; x <= maxX; x += 0.32) {
    points.push(project.point({ x, z: river.zAt(x) }))
  }

  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  strokeProjectedPath(ctx, points, '#ead9a6', (river.width * 2.25 + 0.75) * project.scale)
  strokeProjectedPath(ctx, points, '#3f99bf', river.width * 2.18 * project.scale)
  strokeProjectedPath(ctx, points, 'rgba(255,255,255,0.35)', 4)

  ctx.setLineDash([18, 20])
  strokeProjectedPath(ctx, points.map((p, index) => ({ x: p.x + Math.sin(index) * 5, y: p.y + Math.cos(index * 0.7) * 5 })), 'rgba(233, 249, 255, 0.55)', 3)
  ctx.restore()
}

function drawBuildingParcels(ctx, buildings, project) {
  buildings.forEach((building, index) => {
    drawWorldPolygon(ctx, insetFootprint(building.corners, -0.22), project)
    ctx.fillStyle = index % 3 === 0 ? '#eadcb8' : '#e5d3a8'
    ctx.fill()
    ctx.strokeStyle = 'rgba(98, 81, 58, 0.24)'
    ctx.lineWidth = 2
    ctx.stroke()
  })
}

function drawRoadNetwork(ctx, roads, project) {
  ctx.save()
  roads.forEach((cell) => {
    drawWorldPolygon(ctx, cell.corners, project)
    ctx.fillStyle = '#ebe5d2'
    ctx.fill()
  })

  roads.forEach((cell) => {
    drawWorldPolygon(ctx, insetFootprint(cell.corners, 0.17), project)
    ctx.fillStyle = '#5b6060'
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.28)'
    ctx.lineWidth = 1.5
    ctx.stroke()
  })

  ctx.setLineDash([11, 16])
  roads.forEach((cell) => {
    const vertical = cell.x % 5 === 0 && cell.z % 6 !== 0
    const a = project.point({
      x: cell.center.x + (vertical ? 0 : -CELL_SIZE * 0.34),
      z: cell.center.z + (vertical ? -CELL_SIZE * 0.34 : 0),
    })
    const b = project.point({
      x: cell.center.x + (vertical ? 0 : CELL_SIZE * 0.34),
      z: cell.center.z + (vertical ? CELL_SIZE * 0.34 : 0),
    })
    ctx.strokeStyle = 'rgba(255, 244, 194, 0.86)'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.stroke()
  })
  ctx.setLineDash([])
  ctx.restore()
}

function drawBridgeDecks(ctx, bridges, project) {
  bridges.forEach((bridge, index) => {
    const elevated = bridge.elevated
    drawOrientedWorldRect(ctx, project, bridge.x + 0.09, bridge.z + 0.09, bridge.length * 1.08, elevated ? 1.16 : 0.96, bridge.rotation, {
      fill: elevated ? 'rgba(67, 61, 51, 0.25)' : 'rgba(78, 68, 53, 0.18)',
    })
    drawOrientedWorldRect(ctx, project, bridge.x, bridge.z, bridge.length, elevated ? 0.88 : 0.72, bridge.rotation, {
      fill: elevated ? '#b8b0a1' : '#c68c5c',
      stroke: '#6d553f',
      lineWidth: elevated ? 4 : 3,
    })
    drawOrientedBridgeRail(ctx, project, bridge, index)
  })
}

function drawOrientedBridgeRail(ctx, project, bridge, index) {
  const right = { x: Math.cos(bridge.rotation), z: -Math.sin(bridge.rotation) }
  const normal = { x: Math.sin(bridge.rotation), z: Math.cos(bridge.rotation) }
  const offsets = bridge.elevated ? [-0.48, 0.48] : [-0.38, 0.38]
  ctx.save()
  ctx.strokeStyle = index % 2 === 0 ? '#74422e' : '#5d625f'
  ctx.lineWidth = bridge.elevated ? 5 : 4
  offsets.forEach((offset) => {
    const a = project.point({
      x: bridge.x - right.x * bridge.length * 0.5 + normal.x * offset,
      z: bridge.z - right.z * bridge.length * 0.5 + normal.z * offset,
    })
    const b = project.point({
      x: bridge.x + right.x * bridge.length * 0.5 + normal.x * offset,
      z: bridge.z + right.z * bridge.length * 0.5 + normal.z * offset,
    })
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.stroke()
  })
  ctx.restore()
}

function drawStreetAnnotations(ctx, furniture, project) {
  ctx.save()
  furniture.lamps.slice(0, 120).forEach((lamp) => {
    const p = project.point(lamp)
    ctx.fillStyle = '#f7d974'
    ctx.beginPath()
    ctx.arc(p.x, p.y, 3.2, 0, TAU)
    ctx.fill()
    ctx.strokeStyle = '#45505a'
    ctx.lineWidth = 1.5
    ctx.stroke()
  })

  furniture.trafficLights.forEach((light) => {
    const p = project.point(light)
    ctx.fillStyle = '#2c3538'
    roundedRect(ctx, p.x - 4, p.y - 7, 8, 14, 2)
    ctx.fill()
    ;['#dd4d3f', '#f1c644', '#58a95a'].forEach((color, index) => {
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc(p.x, p.y - 4 + index * 4, 1.6, 0, TAU)
      ctx.fill()
    })
  })
  ctx.restore()
}

function drawMapTextureGrain(ctx, size, seed) {
  const rng = makeRng(`${seed}:paper-grain`)
  ctx.save()
  for (let i = 0; i < 3600; i += 1) {
    const alpha = 0.025 + (i % 7) * 0.003
    ctx.fillStyle = i % 2 === 0 ? `rgba(93, 70, 45, ${alpha})` : `rgba(255, 255, 240, ${alpha})`
    ctx.fillRect(rng() * size, rng() * size, 1 + rng() * 2, 1 + rng() * 2)
  }
  ctx.restore()
}

function drawWorldPolygon(ctx, corners, project) {
  ctx.beginPath()
  corners.forEach((corner, index) => {
    const p = project.point(corner)
    if (index === 0) ctx.moveTo(p.x, p.y)
    else ctx.lineTo(p.x, p.y)
  })
  ctx.closePath()
}

function strokeProjectedPath(ctx, points, color, width) {
  if (!points.length) return
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.beginPath()
  points.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y)
    else ctx.lineTo(point.x, point.y)
  })
  ctx.stroke()
}

function drawOrientedWorldRect(ctx, project, x, z, width, height, rotation, options) {
  const right = { x: Math.cos(rotation), z: -Math.sin(rotation) }
  const normal = { x: Math.sin(rotation), z: Math.cos(rotation) }
  const corners = [
    { x: x - right.x * width * 0.5 - normal.x * height * 0.5, z: z - right.z * width * 0.5 - normal.z * height * 0.5 },
    { x: x + right.x * width * 0.5 - normal.x * height * 0.5, z: z + right.z * width * 0.5 - normal.z * height * 0.5 },
    { x: x + right.x * width * 0.5 + normal.x * height * 0.5, z: z + right.z * width * 0.5 + normal.z * height * 0.5 },
    { x: x - right.x * width * 0.5 + normal.x * height * 0.5, z: z - right.z * width * 0.5 + normal.z * height * 0.5 },
  ]
  drawWorldPolygon(ctx, corners, project)
  if (options.fill) {
    ctx.fillStyle = options.fill
    ctx.fill()
  }
  if (options.stroke) {
    ctx.strokeStyle = options.stroke
    ctx.lineWidth = options.lineWidth ?? 2
    ctx.stroke()
  }
}

function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + width - r, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + r)
  ctx.lineTo(x + width, y + height - r)
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height)
  ctx.lineTo(x + r, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function createAtlasMaterial(atlas, tileX, tileY, options = {}) {
  const texture = atlas.clone()
  texture.repeat.set(0.25, 0.25)
  texture.offset.set(tileX * 0.25, 1 - (tileY + 1) * 0.25)
  texture.needsUpdate = true
  return new THREE.MeshLambertMaterial({
    map: texture,
    color: options.color ?? 0xffffff,
    side: options.side ?? THREE.FrontSide,
  })
}

function createAtlasSubMaterial(atlas, tileX, tileY, x, y, w, h) {
  const texture = atlas.clone()
  const tileSize = 0.25
  texture.repeat.set(tileSize * w, tileSize * h)
  texture.offset.set(tileSize * (tileX + x), 1 - tileSize * (tileY + y + h))
  texture.needsUpdate = true
  const material = new THREE.MeshLambertMaterial({
    map: texture,
    color: 0xffffff,
    side: THREE.DoubleSide,
  })
  applyCutoutShader(material)
  return material
}

function createSpriteAtlasMaterials(atlas, columns = 4, rows = 4) {
  const materials = []
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < columns; x += 1) {
      const texture = atlas.clone()
      texture.repeat.set(1 / columns, 1 / rows)
      texture.offset.set(x / columns, 1 - (y + 1) / rows)
      texture.needsUpdate = true
      const material = new THREE.SpriteMaterial({
        map: texture,
        color: 0xffffff,
        transparent: true,
        alphaTest: 0.05,
        depthTest: true,
        depthWrite: false,
        toneMapped: false,
      })
      applyMagentaCutoutShader(material)
      materials.push(material)
    }
  }
  return materials
}

function applyMagentaCutoutShader(material) {
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <alphatest_fragment>',
      `
        bool chromaMagenta = diffuseColor.r > 0.86 && diffuseColor.g < 0.28 && diffuseColor.b > 0.86;
        if (chromaMagenta) discard;
        #include <alphatest_fragment>
      `,
    )
  }
}

function applyCutoutShader(material) {
  material.transparent = true
  material.alphaTest = 0.15
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <alphatest_fragment>',
      `
        float maxChannel = max(diffuseColor.r, max(diffuseColor.g, diffuseColor.b));
        float minChannel = min(diffuseColor.r, min(diffuseColor.g, diffuseColor.b));
        bool paperWhite = diffuseColor.r > 0.82 && diffuseColor.g > 0.79 && diffuseColor.b > 0.70;
        bool paperTan = diffuseColor.r > 0.64 && diffuseColor.g > 0.58 && diffuseColor.b > 0.46 && maxChannel - minChannel < 0.22;
        if (paperWhite || paperTan) discard;
        #include <alphatest_fragment>
      `,
    )
  }
}

function createMergedBuildingGroup(buildings) {
  const group = new THREE.Group()
  const batches = new Map()
  const materialCache = new Map()

  const addBatch = (key, material, geometry) => {
    if (!batches.has(key)) batches.set(key, { material, geometries: [] })
    batches.get(key).geometries.push(geometry)
  }

  const getMaterial = (key, color) => {
    if (!materialCache.has(key)) materialCache.set(key, new THREE.MeshLambertMaterial({ color }))
    return materialCache.get(key)
  }

  buildings.forEach((building) => {
    const wallKey = `wall-${building.material}-${building.color}`
    const wallMaterial = getMaterial(wallKey, building.color)
    addBatch(wallKey, wallMaterial, createPrismGeometry(building.corners, building.height))

    if (building.style === 'tower' && building.height > 3.8) {
      const second = insetFootprint(building.corners, 0.16)
      const third = insetFootprint(building.corners, 0.31)
      addBatch(wallKey, wallMaterial, createPrismGeometry(second, building.height * 0.62, building.height * 0.38))
      addBatch(wallKey, wallMaterial, createPrismGeometry(third, building.height * 0.32, building.height * 0.7))
    }

    const roofKey = `roof-${building.roofColor}`
    const roofMaterial = getMaterial(roofKey, building.roofColor)
    const roofGeometry =
      building.roof === 'gable'
        ? createGableRoofGeometry(building)
        : createRoofSlabGeometry(insetFootprint(building.corners, -0.03), building.height + 0.05, 0.1)
    addBatch(roofKey, roofMaterial, roofGeometry)
  })

  batches.forEach(({ material, geometries }) => {
    const mesh = new THREE.Mesh(mergeBufferGeometries(geometries), material)
    mesh.castShadow = true
    mesh.receiveShadow = true
    group.add(mesh)
  })

  return group
}

function createFacadeGroup(buildings) {
  const group = new THREE.Group()
  buildings.forEach((building) => {
    const texture = makeFacadeTexture(building)
    const material = new THREE.MeshLambertMaterial({
      map: texture,
      color: 0xffffff,
      side: THREE.DoubleSide,
    })
    const mesh = new THREE.Mesh(createFacadeGeometry(building), material)
    mesh.renderOrder = 2
    group.add(mesh)
  })
  return group
}

function createFacadeGeometry(building) {
  const positions = []
  const normals = []
  const uvs = []
  const indices = []
  const bottom = 0.05
  const lift = building.height - bottom
  building.corners.forEach((a, sideIndex) => {
    const b = building.corners[(sideIndex + 1) % building.corners.length]
    const edge = new THREE.Vector3(b.x - a.x, 0, b.z - a.z)
    const right = edge.clone().normalize()
    const normal = new THREE.Vector3(right.z, 0, -right.x)
    const start = positions.length / 3
    const offset = normal.clone().multiplyScalar(0.032)

    positions.push(
      a.x + offset.x, bottom, a.z + offset.z,
      b.x + offset.x, bottom, b.z + offset.z,
      b.x + offset.x, bottom + lift, b.z + offset.z,
      a.x + offset.x, bottom + lift, a.z + offset.z,
    )
    for (let i = 0; i < 4; i += 1) normals.push(normal.x, normal.y, normal.z)
    uvs.push(0, 0, 1, 0, 1, 1, 0, 1)
    indices.push(start, start + 2, start + 1, start, start + 3, start + 2)
  })

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  return geometry
}

function createRoofDetailGroup(buildings, materials) {
  const group = new THREE.Group()
  const roofGeometries = buildings.map((building) => createRoofTextureGeometry(building))
  const roofTexture = new THREE.Mesh(mergeBufferGeometries(roofGeometries), materials.roofTile)
  roofTexture.position.y = 0.035
  roofTexture.renderOrder = 3
  group.add(roofTexture)
  return group
}

function createRoofTextureGeometry(building) {
  const y = building.height + 0.11
  const corners = insetFootprint(building.corners, -0.02)
  const positions = []
  const normals = []
  const uvs = []
  const indices = [0, 2, 1, 0, 3, 2]
  corners.forEach((corner, index) => {
    positions.push(corner.x, y, corner.z)
    normals.push(0, 1, 0)
    uvs.push(index === 1 || index === 2 ? 1 : 0, index >= 2 ? 1 : 0)
  })
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  return geometry
}

function createBuildingLineGroup(buildings) {
  const positions = []
  const color = new THREE.Color(0x4f493d)

  buildings.forEach((building) => {
    const topY = building.height + 0.13
    const baseY = 0.06
    building.corners.forEach((a, index) => {
      const b = building.corners[(index + 1) % building.corners.length]
      positions.push(a.x, topY, a.z, b.x, topY, b.z)
      positions.push(a.x, baseY, a.z, a.x, topY, a.z)
      if (index % 2 === 0) positions.push(a.x, baseY + building.height * 0.52, a.z, b.x, baseY + building.height * 0.52, b.z)
    })
  })

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0.42,
  })
  const lines = new THREE.LineSegments(geometry, material)
  lines.renderOrder = 8
  return lines
}

function makeFacadeTexture(building) {
  const canvas = document.createElement('canvas')
  canvas.width = 320
  canvas.height = 640
  const ctx = canvas.getContext('2d')
  const rng = mulberry32(building.seed + 8917)
  const base = building.material === 'glass' ? 0x80b7cf : building.color
  const ink = shadeColor(base, -0.48)
  const light = shadeColor(base, 0.2)
  const dark = shadeColor(base, -0.18)
  const floors = Math.max(2, Math.min(13, Math.floor(building.height / building.floorHeight)))
  const cols = building.material === 'glass' ? 5 : building.style === 'shop' ? 3 : 4

  ctx.fillStyle = cssColor(base)
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  drawPaperWash(ctx, rng, base, light, dark)
  drawFacadeFrame(ctx, ink, light)

  if (building.material === 'glass') {
    drawGlassFacade(ctx, rng, floors, cols, ink)
  } else {
    drawMasonryFacade(ctx, rng, building, floors, cols, ink, light, dark)
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.anisotropy = 2
  return texture
}

function drawPaperWash(ctx, rng, base, light, dark) {
  ctx.globalAlpha = 0.18
  for (let i = 0; i < 140; i += 1) {
    const x = rng() * ctx.canvas.width
    const y = rng() * ctx.canvas.height
    const r = 3 + rng() * 20
    ctx.fillStyle = cssColor(rng() > 0.5 ? light : dark)
    ctx.beginPath()
    ctx.ellipse(x, y, r, r * (0.45 + rng() * 0.8), rng() * TAU, 0, TAU)
    ctx.fill()
  }
  ctx.globalAlpha = 1
  ctx.fillStyle = rgbaColor(base, 0.08)
  for (let y = 8; y < ctx.canvas.height; y += 19) {
    ctx.fillRect(0, y + rng() * 4, ctx.canvas.width, 1)
  }
}

function drawFacadeFrame(ctx, ink, light) {
  ctx.strokeStyle = rgbaColor(ink, 0.7)
  ctx.lineWidth = 7
  ctx.strokeRect(9, 9, ctx.canvas.width - 18, ctx.canvas.height - 18)
  ctx.strokeStyle = rgbaColor(light, 0.55)
  ctx.lineWidth = 3
  ctx.strokeRect(18, 18, ctx.canvas.width - 36, ctx.canvas.height - 36)
}

function drawGlassFacade(ctx, rng, floors, cols, ink) {
  const pad = 28
  const top = 34
  const bottom = 28
  const cellW = (ctx.canvas.width - pad * 2) / cols
  const cellH = (ctx.canvas.height - top - bottom) / floors
  ctx.fillStyle = 'rgba(216,245,255,0.26)'
  ctx.fillRect(pad, top, cellW * cols, cellH * floors)
  ctx.strokeStyle = rgbaColor(ink, 0.42)
  ctx.lineWidth = 2

  for (let c = 0; c <= cols; c += 1) {
    const x = pad + c * cellW
    ctx.beginPath()
    ctx.moveTo(x, top)
    ctx.lineTo(x + Math.sin(c) * 2, top + cellH * floors)
    ctx.stroke()
  }
  for (let f = 0; f <= floors; f += 1) {
    const y = top + f * cellH
    ctx.beginPath()
    ctx.moveTo(pad, y)
    ctx.lineTo(pad + cellW * cols, y + Math.sin(f) * 1.4)
    ctx.stroke()
  }

  ctx.strokeStyle = 'rgba(255,255,255,0.5)'
  ctx.lineWidth = 4
  for (let i = 0; i < 7; i += 1) {
    const x = pad + rng() * cellW * cols
    ctx.beginPath()
    ctx.moveTo(x, top + rng() * 120)
    ctx.lineTo(x + 36 + rng() * 44, top + 140 + rng() * 260)
    ctx.stroke()
  }
}

function drawMasonryFacade(ctx, rng, building, floors, cols, ink, light, dark) {
  const pad = 30
  const top = 42
  const bottom = building.style === 'shop' ? 120 : 42
  const cellW = (ctx.canvas.width - pad * 2) / cols
  const cellH = (ctx.canvas.height - top - bottom) / floors

  ctx.strokeStyle = rgbaColor(dark, 0.22)
  ctx.lineWidth = 2
  for (let y = top; y < ctx.canvas.height - bottom; y += cellH) {
    ctx.beginPath()
    ctx.moveTo(24, y)
    ctx.lineTo(ctx.canvas.width - 24, y + rng() * 2 - 1)
    ctx.stroke()
  }

  for (let floor = 0; floor < floors; floor += 1) {
    for (let col = 0; col < cols; col += 1) {
      const x = pad + col * cellW + cellW * 0.18
      const y = top + floor * cellH + cellH * 0.22
      const w = cellW * 0.62
      const h = cellH * 0.48
      drawWindow(ctx, x, y, w, h, ink, light, rng, building.style === 'civic')
    }
  }

  if (building.style === 'shop') {
    drawShopfront(ctx, rng, ink, light, dark)
  } else {
    drawDoor(ctx, rng, ink, light)
  }
}

function drawWindow(ctx, x, y, w, h, ink, light, rng, arched = false) {
  ctx.fillStyle = rng() > 0.18 ? '#d9f3f8' : '#ffdf86'
  ctx.strokeStyle = rgbaColor(ink, 0.76)
  ctx.lineWidth = 4
  ctx.beginPath()
  if (arched) {
    ctx.moveTo(x, y + h)
    ctx.lineTo(x, y + h * 0.38)
    ctx.quadraticCurveTo(x + w / 2, y - h * 0.12, x + w, y + h * 0.38)
    ctx.lineTo(x + w, y + h)
  } else {
    ctx.rect(x, y, w, h)
  }
  ctx.fill()
  ctx.stroke()
  ctx.strokeStyle = rgbaColor(ink, 0.35)
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(x + w / 2, y + 4)
  ctx.lineTo(x + w / 2, y + h - 4)
  ctx.moveTo(x + 5, y + h / 2)
  ctx.lineTo(x + w - 5, y + h / 2)
  ctx.stroke()
  ctx.fillStyle = rgbaColor(light, 0.75)
  ctx.fillRect(x + 5, y + 5, Math.max(2, w * 0.18), Math.max(2, h * 0.24))
}

function drawShopfront(ctx, rng, ink, light, dark) {
  const y = ctx.canvas.height - 112
  ctx.fillStyle = rgbaColor(dark, 0.55)
  ctx.fillRect(34, y + 22, ctx.canvas.width - 68, 72)
  ctx.strokeStyle = rgbaColor(ink, 0.76)
  ctx.lineWidth = 5
  ctx.strokeRect(34, y + 22, ctx.canvas.width - 68, 72)

  const awningColors = ['#d95e45', '#f5d08a', '#4c8da0', '#e8f0dd']
  const stripeW = 26
  for (let x = 26; x < ctx.canvas.width - 26; x += stripeW) {
    ctx.fillStyle = awningColors[Math.floor((x / stripeW + rng() * 2) % awningColors.length)]
    ctx.fillRect(x, y, stripeW + 2, 24)
  }
  ctx.strokeStyle = rgbaColor(ink, 0.72)
  ctx.lineWidth = 4
  ctx.strokeRect(26, y, ctx.canvas.width - 52, 24)
  ctx.fillStyle = rgbaColor(light, 0.55)
  ctx.fillRect(54, y + 38, 62, 34)
  ctx.fillRect(188, y + 38, 62, 34)
}

function drawDoor(ctx, rng, ink, light) {
  const w = 58
  const h = 92
  const x = ctx.canvas.width / 2 - w / 2 + (rng() - 0.5) * 36
  const y = ctx.canvas.height - h - 25
  ctx.fillStyle = '#7d5a3a'
  ctx.strokeStyle = rgbaColor(ink, 0.78)
  ctx.lineWidth = 5
  ctx.fillRect(x, y, w, h)
  ctx.strokeRect(x, y, w, h)
  ctx.fillStyle = rgbaColor(light, 0.85)
  ctx.beginPath()
  ctx.arc(x + w - 15, y + h / 2, 4, 0, TAU)
  ctx.fill()
}

function createBoxInstances(items, material) {
  if (!items.length) return new THREE.Group()
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), material, items.length)
  items.forEach((item, index) => {
    const matrix = new THREE.Matrix4()
    matrix.makeBasis(
      item.right.clone().multiplyScalar(item.w),
      new THREE.Vector3(0, item.h, 0),
      item.normal.clone().multiplyScalar(item.d),
    )
    matrix.setPosition(item.pos)
    mesh.setMatrixAt(index, matrix)
  })
  mesh.castShadow = true
  mesh.instanceMatrix.needsUpdate = true
  return mesh
}

function createBridgeGroup(bridges, materials) {
  const group = new THREE.Group()
  const railItems = []
  bridges.forEach((bridge) => {
    const deckY = bridge.elevated ? 0.72 : 0.3
    const center = new THREE.Vector3(bridge.x, deckY, bridge.z)
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(bridge.length, bridge.elevated ? 0.18 : 0.24, 0.82), materials.bridge)
    mesh.position.copy(center)
    mesh.rotation.y = bridge.rotation
    mesh.castShadow = true
    mesh.receiveShadow = true
    group.add(mesh)

    const right = new THREE.Vector3(Math.cos(bridge.rotation), 0, -Math.sin(bridge.rotation))
    const normal = new THREE.Vector3(Math.sin(bridge.rotation), 0, Math.cos(bridge.rotation))
    railItems.push(
      { pos: center.clone().addScaledVector(normal, 0.48).setY(deckY + 0.18), right, normal, w: bridge.length, h: 0.08, d: 0.05 },
      { pos: center.clone().addScaledVector(normal, -0.48).setY(deckY + 0.18), right, normal, w: bridge.length, h: 0.08, d: 0.05 },
    )

    if (bridge.elevated) {
      const supportGeometry = new THREE.CylinderGeometry(0.08, 0.1, deckY, 8)
      ;[-0.34, 0.34].forEach((offset) => {
        const support = new THREE.Mesh(supportGeometry, materials.bridge)
        support.position.copy(new THREE.Vector3(bridge.x, deckY / 2, bridge.z).addScaledVector(normal, offset))
        group.add(support)
      })
    }
  })
  group.add(createBoxInstances(railItems, materials.rail))
  return group
}

function createStreetFurnitureInstances(furniture, materials) {
  const group = new THREE.Group()
  const lampPosts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.025, 0.035, 0.78, 6), materials.lampPost, furniture.lamps.length || 1)
  const lampGlows = new THREE.InstancedMesh(new THREE.SphereGeometry(0.075, 8, 6), materials.lampGlow, furniture.lamps.length || 1)
  furniture.lamps.forEach((lamp, index) => {
    lampPosts.setMatrixAt(index, new THREE.Matrix4().makeTranslation(lamp.x, 0.44, lamp.z))
    lampGlows.setMatrixAt(index, new THREE.Matrix4().makeTranslation(lamp.x, 0.86, lamp.z))
  })
  lampPosts.instanceMatrix.needsUpdate = true
  lampGlows.instanceMatrix.needsUpdate = true

  const trafficPosts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.022, 0.028, 0.62, 6), materials.traffic, furniture.trafficLights.length || 1)
  const trafficHeads = new THREE.InstancedMesh(new THREE.BoxGeometry(0.1, 0.22, 0.08), materials.traffic, furniture.trafficLights.length || 1)
  furniture.trafficLights.forEach((light, index) => {
    trafficPosts.setMatrixAt(index, new THREE.Matrix4().makeTranslation(light.x, 0.34, light.z))
    trafficHeads.setMatrixAt(index, new THREE.Matrix4().compose(new THREE.Vector3(light.x, 0.72, light.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), light.rot), new THREE.Vector3(1, 1, 1)))
  })
  trafficPosts.instanceMatrix.needsUpdate = true
  trafficHeads.instanceMatrix.needsUpdate = true

  group.add(lampPosts, lampGlows, trafficPosts, trafficHeads)
  return group
}

const BUILDING_VARIANTS_BY_STYLE = {
  tower: [0, 3, 5, 9],
  civic: [2, 7, 15],
  shop: [4, 6, 8, 13],
  brick: [4, 10, 11, 14],
  plaster: [1, 6, 12, 14],
}

const LANDMARK_SIZES = [
  [2.0, 2.3],
  [3.25, 2.0],
  [2.8, 2.2],
  [2.35, 2.95],
  [2.35, 3.0],
  [1.75, 3.1],
  [2.0, 2.35],
  [2.75, 2.1],
  [2.1, 1.45],
  [3.3, 2.1],
  [2.05, 1.8],
  [2.1, 1.8],
  [1.6, 2.75],
  [2.4, 2.2],
  [2.15, 2.05],
  [2.25, 2.1],
]

function createIllustratedBuildingSprites(buildings, materials) {
  const group = new THREE.Group()
  buildings.forEach((building, index) => {
    const material = materials.buildingCutouts[pickBuildingSpriteVariant(building, index)]
    const size = getBuildingSpriteSize(building)
    const offset = seededOffset(building.seed || index, 0.08)
    const sprite = createCutoutSprite(material, {
      x: building.center.x + offset.x,
      z: building.center.z + offset.z,
      y: 0.1,
      w: size.w,
      h: size.h,
      centerY: 0.045,
      renderOrder: 20,
    })
    group.add(sprite)
  })
  return group
}

function pickBuildingSpriteVariant(building, index) {
  const variants = BUILDING_VARIANTS_BY_STYLE[building.style] || BUILDING_VARIANTS_BY_STYLE.plaster
  return variants[Math.abs((building.seed || 0) + index * 7) % variants.length]
}

function getBuildingSpriteSize(building) {
  if (building.style === 'tower') {
    const h = THREE.MathUtils.clamp(2.9 + building.height * 0.38, 3.55, 4.85)
    return { w: h * 0.68, h }
  }
  if (building.style === 'civic') {
    const h = THREE.MathUtils.clamp(2.05 + building.height * 0.22, 2.25, 2.8)
    return { w: h * 0.92, h }
  }
  if (building.style === 'shop') {
    const h = THREE.MathUtils.clamp(1.8 + building.height * 0.26, 2.05, 2.65)
    return { w: h * 0.95, h }
  }
  const h = THREE.MathUtils.clamp(1.95 + building.height * 0.28, 2.2, 3.0)
  return { w: h * 0.82, h }
}

function createIllustratedLandmarkSprites(town, materials) {
  const group = new THREE.Group()
  const candidates = spreadPick(
    town.parks
      .filter((cell) => cell.normalizedRadius < 0.92)
      .sort((a, b) => scenicSortValue(a) - scenicSortValue(b)),
    13,
  )

  candidates.forEach((cell, index) => {
    const variant = (index * 3 + 1) % materials.landmarkCutouts.length
    const [w, h] = LANDMARK_SIZES[variant]
    const p = randomPointInQuad(cell.corners, cell.x * 911 + cell.z * 397 + index * 23)
    group.add(createCutoutSprite(materials.landmarkCutouts[variant], {
      x: p.x,
      z: p.z,
      y: 0.13,
      w,
      h,
      centerY: 0.045,
      renderOrder: 24,
    }))
  })

  const riverEnds = [
    { x: -HALF_GRID * CELL_SIZE * 0.88, z: town.river.zAt(-HALF_GRID * CELL_SIZE * 0.88), variant: 0 },
    { x: HALF_GRID * CELL_SIZE * 0.84, z: town.river.zAt(HALF_GRID * CELL_SIZE * 0.84), variant: 7 },
  ]
  riverEnds.forEach((item) => {
    const [w, h] = LANDMARK_SIZES[item.variant]
    group.add(createCutoutSprite(materials.landmarkCutouts[item.variant], {
      x: item.x,
      z: item.z,
      y: 0.14,
      w,
      h,
      centerY: 0.045,
      renderOrder: 25,
    }))
  })

  return group
}

function createIllustratedPropSprites(town, materials) {
  const group = new THREE.Group()
  const parkCells = spreadPick(
    town.parks.filter((cell) => cell.normalizedRadius < 0.97),
    82,
  )

  parkCells.forEach((cell, index) => {
    const variant = index % 11 === 0 ? 13 : index % 7 === 0 ? 2 : index % 5 === 0 ? 1 : 0
    const p = randomPointInQuad(cell.corners, cell.x * 619 + cell.z * 233 + index)
    const scale = variant === 0 ? 0.85 + (index % 4) * 0.12 : variant === 13 ? 1.15 : 0.72
    group.add(createCutoutSprite(materials.propCutouts[variant], {
      x: p.x,
      z: p.z,
      y: 0.12,
      w: scale * 1.08,
      h: scale * 0.92,
      centerY: 0.055,
      renderOrder: 14,
    }))
  })

  spreadPick(town.roads, 48).forEach((cell, index) => {
    const p = randomPointInQuad(cell.corners, cell.x * 313 + cell.z * 521 + index)
    const variant = index % 4 === 0 ? 3 : 2
    group.add(createCutoutSprite(materials.propCutouts[variant], {
      x: p.x,
      z: p.z,
      y: 0.11,
      w: variant === 3 ? 0.82 : 0.56,
      h: variant === 3 ? 0.65 : 0.62,
      centerY: 0.08,
      renderOrder: 16,
    }))
  })

  sampleRiverItems(town.river, 18).forEach((item, index) => {
    const variant = [8, 9, 10][index % 3]
    group.add(createCutoutSprite(materials.propCutouts[variant], {
      x: item.x + Math.sin(index * 1.7) * 0.24,
      z: item.z + Math.cos(index * 1.3) * 0.42,
      y: 0.14,
      w: variant === 10 ? 1.35 : 0.95,
      h: variant === 10 ? 0.78 : 0.68,
      centerY: 0.06,
      renderOrder: 15,
    }))
  })

  spreadPick(
    town.parks.filter((cell) => cell.normalizedRadius > 0.68),
    7,
  ).forEach((cell, index) => {
    const p = randomPointInQuad(cell.corners, cell.x * 991 + cell.z * 109 + index)
    group.add(createCutoutSprite(materials.propCutouts[15], {
      x: p.x,
      z: p.z,
      y: 0.13,
      w: 1.0,
      h: 1.42,
      centerY: 0.045,
      renderOrder: 13,
    }))
  })

  return group
}

function createCutoutSprite(material, options) {
  const sprite = new THREE.Sprite(material)
  sprite.position.set(options.x, options.y, options.z)
  sprite.scale.set(options.w, options.h, 1)
  sprite.center.set(0.5, options.centerY ?? 0.05)
  sprite.renderOrder = options.renderOrder ?? 10
  return sprite
}

function spreadPick(items, count) {
  if (items.length <= count) return [...items]
  if (count <= 1) return items.length ? [items[0]] : []
  const picked = []
  const step = (items.length - 1) / (count - 1)
  for (let i = 0; i < count; i += 1) {
    picked.push(items[Math.round(i * step)])
  }
  return picked
}

function scenicSortValue(cell) {
  return noise2(cell.center.x * 0.7, cell.center.z * 0.7) + cell.normalizedRadius * 0.35
}

function seededOffset(seed, amount) {
  const rng = mulberry32(seed + 13579)
  return {
    x: (rng() - 0.5) * amount,
    z: (rng() - 0.5) * amount,
  }
}

function createAtlasDecals(town, materials) {
  const group = new THREE.Group()

  const boats = sampleRiverItems(town.river, 18).map((item, index) => ({
    ...item,
    y: 0.16,
    w: index % 3 === 0 ? 1.12 : 0.72,
    h: index % 3 === 0 ? 0.62 : 0.46,
    variant: index,
  }))

  const parkTreePatches = [
    ...town.parks
      .filter((cell, index) => index % 2 === 0)
      .slice(0, 95)
      .map((cell, index) => {
        const p = randomPointInQuad(cell.corners, cell.x * 733 + cell.z * 271 + index)
        return { x: p.x, z: p.z, y: 0.34, w: 0.62 + (index % 3) * 0.12, h: 0.78 + (index % 4) * 0.12, rot: -Math.PI / 4, variant: index }
      }),
    ...town.trees.slice(0, 110).map((tree, index) => ({
      x: tree.x,
      z: tree.z,
      y: 0.32,
      w: 0.52 * tree.s,
      h: 0.74 * tree.s,
      rot: -Math.PI / 4,
      variant: index + 2,
    })),
  ]

  const landmarks = town.parks
    .filter((cell) => cell.normalizedRadius < 0.83)
    .slice(0, 7)
    .map((cell, index) => {
      const p = randomPointInQuad(cell.corners, cell.x * 491 + cell.z * 113 + index)
      return { x: p.x, z: p.z, y: 0.72, w: 0.8 + (index % 2) * 0.18, h: 1.24 + (index % 3) * 0.18, rot: -Math.PI / 4, variant: index }
    })

  const bridgeDecals = town.bridges.map((bridge, index) => ({
    x: bridge.x,
    z: bridge.z,
    y: bridge.elevated ? 0.9 : 0.48,
    w: 2.55,
    h: 0.78,
    rot: bridge.rotation,
    variant: index,
  }))

  group.add(createMaterialGroups(boats, materials.boatSprites, createGroundDecalInstances))
  group.add(createMaterialGroups(bridgeDecals, [materials.bridgeSprite], createGroundDecalInstances))
  group.add(createMaterialGroups(parkTreePatches, materials.treeSprites, createBillboardInstances))
  group.add(createMaterialGroups(landmarks, materials.landmarkSprites, createBillboardInstances))
  return group
}

function sampleRiverItems(river, count) {
  return Array.from({ length: count }, (_, index) => {
    const t = (index + 0.42) / count
    const x = lerp(-HALF_GRID * CELL_SIZE * 0.88, HALF_GRID * CELL_SIZE * 0.88, t)
    const z = river.zAt(x)
    const nextZ = river.zAt(x + 0.2)
    return {
      x,
      z,
      rot: Math.atan2(0.2, nextZ - z) + (index % 2 === 0 ? 0.12 : -0.18),
    }
  })
}

function createMaterialGroups(items, materials, factory) {
  const group = new THREE.Group()
  materials.forEach((material, materialIndex) => {
    const subset = items.filter((item) => item.variant % materials.length === materialIndex)
    group.add(factory(subset, material))
  })
  return group
}

function createGroundDecalInstances(items, material) {
  if (!items.length) return new THREE.Group()
  const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), material, items.length)
  items.forEach((item, index) => {
    const right = new THREE.Vector3(Math.cos(item.rot), 0, Math.sin(item.rot)).multiplyScalar(item.w)
    const forward = new THREE.Vector3(-Math.sin(item.rot), 0, Math.cos(item.rot)).multiplyScalar(item.h)
    const matrix = new THREE.Matrix4()
    matrix.makeBasis(right, forward, new THREE.Vector3(0, 1, 0))
    matrix.setPosition(new THREE.Vector3(item.x, item.y, item.z))
    mesh.setMatrixAt(index, matrix)
  })
  mesh.instanceMatrix.needsUpdate = true
  mesh.renderOrder = 4
  return mesh
}

function createBillboardInstances(items, material) {
  if (!items.length) return new THREE.Group()
  const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), material, items.length)
  items.forEach((item, index) => {
    const right = new THREE.Vector3(Math.cos(item.rot), 0, Math.sin(item.rot)).multiplyScalar(item.w)
    const normal = new THREE.Vector3(-Math.sin(item.rot), 0, Math.cos(item.rot)).normalize()
    const matrix = new THREE.Matrix4()
    matrix.makeBasis(right, new THREE.Vector3(0, item.h, 0), normal)
    matrix.setPosition(new THREE.Vector3(item.x, item.y, item.z))
    mesh.setMatrixAt(index, matrix)
  })
  mesh.instanceMatrix.needsUpdate = true
  mesh.renderOrder = 5
  return mesh
}

function buildMovers(root, town, materials) {
  const group = new THREE.Group()
  const cars = town.cars.slice(0, 44)
  const people = town.people.slice(0, 58)
  const carSprites = cars.map((car, index) => {
    const variant = [4, 5, 6][index % 3]
    const sprite = createCutoutSprite(materials.propCutouts[variant], {
      x: 0,
      z: 0,
      y: 0.18,
      w: variant === 5 ? 0.62 : 0.46,
      h: variant === 5 ? 0.42 : 0.32,
      centerY: 0.08,
      renderOrder: 30,
    })
    group.add(sprite)
    return sprite
  })
  const personSprites = people.map(() => {
    const sprite = createCutoutSprite(materials.propCutouts[7], {
      x: 0,
      z: 0,
      y: 0.18,
      w: 0.36,
      h: 0.28,
      centerY: 0.08,
      renderOrder: 31,
    })
    group.add(sprite)
    return sprite
  })
  root.add(group)
  return { cars, people, carSprites, personSprites, carTime: 0, personTime: 0 }
}

function animateMovers(movers, dt) {
  movers.carTime += dt
  movers.personTime += dt
  movers.cars.forEach((car, index) => {
    const p = car.path[Math.floor((movers.carTime * car.speed + car.offset) % car.path.length)]
    const sprite = movers.carSprites[index]
    sprite.position.set(p.x, 0.18, p.z)
    sprite.scale.x = Math.abs(sprite.scale.x) * (Math.cos(p.rot) >= 0 ? 1 : -1)
  })
  movers.people.forEach((person, index) => {
    const p = person.path[Math.floor((movers.personTime * person.speed + person.offset) % person.path.length)]
    const sprite = movers.personSprites[index]
    sprite.position.set(p.x, 0.17 + Math.sin(movers.personTime * 8 + index) * 0.012, p.z)
  })
}

function createWeather(scene) {
  const rain = createParticleField(800, 0x8fc9ff, 0.035)
  const snow = createParticleField(520, 0xffffff, 0.07)
  rain.visible = false
  snow.visible = false
  scene.add(rain, snow)
  return { rain, snow, rainSpeed: 0, snowSpeed: 0 }
}

function createParticleField(count, color, size) {
  const positions = []
  for (let i = 0; i < count; i += 1) {
    positions.push((Math.random() - 0.5) * 34, Math.random() * 18 + 4, (Math.random() - 0.5) * 34)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  return new THREE.Points(geometry, new THREE.PointsMaterial({ color, size, transparent: true, opacity: 0.72 }))
}

function animateWeather(weather, dt, mode) {
  const field = mode === 'rain' ? weather.rain : mode === 'snow' ? weather.snow : null
  if (!field) return
  const speed = mode === 'rain' ? 16 : 3
  const positions = field.geometry.attributes.position
  for (let i = 0; i < positions.count; i += 1) {
    let y = positions.getY(i) - speed * dt
    if (y < 0) y = 22
    positions.setY(i, y)
    if (mode === 'snow') positions.setX(i, positions.getX(i) + Math.sin(y + i) * 0.002)
  }
  positions.needsUpdate = true
}

function createCompassBase(materials) {
  const group = new THREE.Group()
  const board = new THREE.Mesh(
    new THREE.PlaneGeometry(BOARD_WORLD_SIZE, BOARD_WORLD_SIZE),
    materials.mapBase,
  )
  board.rotation.x = -Math.PI / 2
  board.position.y = -0.08
  group.add(board)

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(21.0, 21.35, 4, 1, Math.PI / 4),
    new THREE.MeshBasicMaterial({ color: 0x5a5141, transparent: true, opacity: 0.45, side: THREE.DoubleSide }),
  )
  ring.rotation.x = -Math.PI / 2
  ring.position.y = -0.06
  group.add(ring)
  return group
}

function createMapLegend() {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 360
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#f3ead2'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.strokeStyle = '#5f5545'
  ctx.lineWidth = 8
  ctx.strokeRect(16, 16, canvas.width - 32, canvas.height - 32)
  ctx.fillStyle = '#40392f'
  ctx.font = 'bold 38px system-ui, sans-serif'
  ctx.fillText('城市旅游地图', 46, 70)
  const items = [
    ['#4f94b6', '市中心'],
    ['#e0b75c', '商业区'],
    ['#83a866', '公园/绿地'],
    ['#c06b58', '住宅区'],
    ['#d2d2c2', '车站'],
    ['#7a8f9e', '码头'],
  ]
  ctx.font = '24px system-ui, sans-serif'
  items.forEach(([color, label], index) => {
    const x = index < 3 ? 56 : 270
    const y = 116 + (index % 3) * 48
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(x, y - 8, 12, 0, TAU)
    ctx.fill()
    ctx.strokeStyle = '#534a3c'
    ctx.lineWidth = 3
    ctx.stroke()
    ctx.fillStyle = '#40392f'
    ctx.fillText(label, x + 28, y)
  })
  drawLegendCompass(ctx)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(5.0, 3.5),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide }),
  )
  mesh.rotation.x = -Math.PI / 2
  mesh.rotation.z = -0.05
  mesh.position.set(-11.4, 0.095, 12.0)
  mesh.renderOrder = 7
  return mesh
}

function drawLegendCompass(ctx) {
  const cx = 405
  const cy = 275
  ctx.save()
  ctx.translate(cx, cy)
  ctx.strokeStyle = '#5f5545'
  ctx.fillStyle = '#b66b45'
  ctx.lineWidth = 4
  for (let i = 0; i < 8; i += 1) {
    ctx.rotate(Math.PI / 4)
    ctx.beginPath()
    ctx.moveTo(0, -46)
    ctx.lineTo(10, -8)
    ctx.lineTo(0, -16)
    ctx.lineTo(-10, -8)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  }
  ctx.fillStyle = '#40392f'
  ctx.font = 'bold 22px system-ui, sans-serif'
  ctx.fillText('N', -7, -58)
  ctx.restore()
}

function createOrganicVertices(rng) {
  const vertices = []
  for (let z = 0; z <= GRID_SIZE; z += 1) {
    const row = []
    for (let x = 0; x <= GRID_SIZE; x += 1) {
      const px = (x - GRID_SIZE / 2) * CELL_SIZE
      const pz = (z - GRID_SIZE / 2) * CELL_SIZE
      const jitter = 0.18
      row.push({
        x: px + (x === 0 || x === GRID_SIZE ? 0 : rng.range(-jitter, jitter)),
        z: pz + (z === 0 || z === GRID_SIZE ? 0 : rng.range(-jitter, jitter)),
      })
    }
    vertices.push(row)
  }
  return vertices
}

function createRiverCurve(rng) {
  const amp = rng.range(1.6, 3.2)
  const freq = rng.range(0.23, 0.34)
  const phase = rng.range(0, TAU)
  const drift = rng.range(-0.8, 0.8)
  return {
    width: rng.range(1.05, 1.55),
    zAt(x) {
      return Math.sin(x * freq + phase) * amp + Math.sin(x * freq * 2.2 + phase * 0.5) * 0.62 + drift
    },
  }
}

function createBuilding(rng, cell) {
  const density = 1 - cell.normalizedRadius
  const nearWater = cell.riverDistance < 2.2
  const style = density > 0.52 && rng() > 0.68 ? 'tower' : nearWater && rng() > 0.48 ? 'shop' : rng.pick(['brick', 'plaster', 'shop', 'civic'])
  const material = style === 'tower' ? rng.pick(['glass', 'glass', 'concrete']) : style === 'brick' ? 'brick' : rng.pick(['plaster', 'painted', 'tile'])
  const height = style === 'tower' ? rng.range(3.0, 5.4) : style === 'civic' ? rng.range(1.35, 2.45) : rng.range(1.05, 3.0)
  const palette = BUILDING_COLORS[style] || BUILDING_COLORS.plaster
  return {
    ...cell,
    corners: insetFootprint(cell.corners, 0.08),
    style,
    material,
    height,
    color: rng.pick(palette),
    roofColor: rng.pick([0x8d5a47, 0x536879, 0x8f7750, 0x6e7c5c]),
    roof: rng.pick(['flat', 'flat', 'gable']),
    floorHeight: style === 'tower' ? rng.range(0.48, 0.64) : rng.range(0.45, 0.58),
    balconies: style !== 'tower' && rng() > 0.38,
    hasAC: style !== 'civic' && rng() > 0.35,
    roofUnits: rng.int(1, style === 'tower' ? 7 : 4),
    seed: rng.int(0, 99999),
  }
}

function createBridges(roads, river) {
  const candidates = roads
    .filter((cell) => Math.abs(cell.center.z - river.zAt(cell.center.x)) < river.width + 0.42)
    .sort((a, b) => a.center.x - b.center.x)
  const bridges = []
  candidates.forEach((cell) => {
    const farFromLast = bridges.every((bridge) => Math.abs(bridge.x - cell.center.x) > 3.2)
    if (!farFromLast) return
    bridges.push({
      x: cell.center.x,
      z: river.zAt(cell.center.x),
      length: 3.85,
      rotation: Math.PI / 2,
      elevated: bridges.length % 4 === 1,
    })
  })
  return bridges.slice(0, 8)
}

function createStreetFurniture(rng, roads, bridges) {
  const lamps = []
  const trafficLights = []

  roads.forEach((cell, index) => {
    const vertical = cell.x % 5 === 0
    const offsetAxis = vertical ? 'x' : 'z'
    if (index % 3 === 0) {
      const side = rng() > 0.5 ? 1 : -1
      lamps.push({
        x: cell.center.x + (offsetAxis === 'x' ? side * 0.46 : rng.range(-0.22, 0.22)),
        z: cell.center.z + (offsetAxis === 'z' ? side * 0.46 : rng.range(-0.22, 0.22)),
      })
    }

    if (cell.x % 5 === 0 && cell.z % 6 === 0 && rng() > 0.24) {
      trafficLights.push({
        x: cell.center.x + 0.42,
        z: cell.center.z + 0.42,
        rot: rng.pick([0, Math.PI / 2, Math.PI, Math.PI * 1.5]),
      })
    }
  })

  bridges.forEach((bridge) => {
    lamps.push({ x: bridge.x - 0.34, z: bridge.z - 0.58 })
    lamps.push({ x: bridge.x + 0.34, z: bridge.z + 0.58 })
  })

  return {
    lamps: lamps.slice(0, 130),
    trafficLights: trafficLights.slice(0, 36),
  }
}

function createTrees(rng, cells, parks, river) {
  const trees = []
  const source = [...parks, ...cells.filter((cell) => !cell.isRoad && !cell.isWater && cell.riverDistance < river.width + 1.35)]
  source.forEach((cell) => {
    if (trees.length > 520) return
    const count = cell.isPark ? rng.int(3, 7) : rng() > 0.72 ? 1 : 0
    for (let i = 0; i < count; i += 1) {
      const p = randomPointInQuad(cell.corners, rng.int(0, 99999))
      trees.push({ x: p.x, z: p.z, s: rng.range(0.72, 1.22) })
    }
  })
  return trees
}

function createCars(rng, roads) {
  const paths = createRoadPaths(roads)
  return Array.from({ length: 52 }, () => {
    const path = rng.pick(paths)
    return { path, speed: rng.range(5, 13), offset: rng.range(0, path.length) }
  })
}

function createPeople(rng, roads) {
  const paths = createRoadPaths(roads)
  return Array.from({ length: 90 }, () => {
    const path = rng.pick(paths).map((p) => ({ ...p, x: p.x + rng.range(-0.28, 0.28), z: p.z + rng.range(-0.28, 0.28) }))
    return { path, speed: rng.range(2, 5), offset: rng.range(0, path.length) }
  })
}

function createRoadPaths(roads) {
  const byRow = new Map()
  const byCol = new Map()
  roads.forEach((cell) => {
    if (!byRow.has(cell.z)) byRow.set(cell.z, [])
    if (!byCol.has(cell.x)) byCol.set(cell.x, [])
    byRow.get(cell.z).push(cell)
    byCol.get(cell.x).push(cell)
  })
  const paths = []
  ;[...byRow.values(), ...byCol.values()].forEach((line) => {
    if (line.length < 5) return
    const sorted = line.sort((a, b) => a.center.x - b.center.x || a.center.z - b.center.z)
    const path = sorted.map((cell, index) => {
      const next = sorted[Math.min(index + 1, sorted.length - 1)].center
      return { x: cell.center.x, z: cell.center.z, rot: Math.atan2(next.x - cell.center.x, next.z - cell.center.z) }
    })
    paths.push(path)
  })
  return paths.length ? paths : [[{ x: 0, z: 0, rot: 0 }]]
}

function createPrismGeometry(corners, height, bottom = 0) {
  const positions = []
  const indices = []
  corners.forEach((p) => positions.push(p.x, bottom, p.z))
  corners.forEach((p) => positions.push(p.x, bottom + height, p.z))
  indices.push(4, 6, 5, 4, 7, 6)
  for (let i = 0; i < 4; i += 1) {
    const next = (i + 1) % 4
    indices.push(i, next + 4, next, i, i + 4, next + 4)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

function createRoofSlabGeometry(corners, y, thickness) {
  return createPrismGeometry(corners, thickness, y)
}

function createGableRoofGeometry(building) {
  const [a, b, c, d] = building.corners
  const mid1 = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 }
  const mid2 = { x: (d.x + c.x) / 2, z: (d.z + c.z) / 2 }
  const y = building.height
  const h = 0.55
  const positions = [
    a.x, y, a.z, b.x, y, b.z, c.x, y, c.z, d.x, y, d.z,
    mid1.x, y + h, mid1.z, mid2.x, y + h, mid2.z,
  ]
  const indices = [0, 4, 5, 0, 5, 3, 4, 1, 2, 4, 2, 5, 0, 1, 4, 3, 5, 2]
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

function mergeBufferGeometries(geometries) {
  const positions = []
  const normals = []
  const indices = []
  let vertexOffset = 0

  geometries.forEach((geometry) => {
    const position = geometry.getAttribute('position')
    const normal = geometry.getAttribute('normal')
    const index = geometry.getIndex()

    for (let i = 0; i < position.count; i += 1) {
      positions.push(position.getX(i), position.getY(i), position.getZ(i))
      if (normal) normals.push(normal.getX(i), normal.getY(i), normal.getZ(i))
    }

    for (let i = 0; i < index.count; i += 1) {
      indices.push(index.getX(i) + vertexOffset)
    }

    vertexOffset += position.count
    geometry.dispose()
  })

  const merged = new THREE.BufferGeometry()
  merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  if (normals.length === positions.length) merged.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  merged.setIndex(indices)
  if (!merged.getAttribute('normal')) merged.computeVertexNormals()
  return merged
}

function cssColor(color) {
  return `#${color.toString(16).padStart(6, '0')}`
}

function rgbaColor(color, alpha) {
  const r = (color >> 16) & 255
  const g = (color >> 8) & 255
  const b = color & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function shadeColor(color, amount) {
  const mix = amount >= 0 ? 255 : 0
  const t = Math.abs(amount)
  const r = Math.round(((color >> 16) & 255) * (1 - t) + mix * t)
  const g = Math.round(((color >> 8) & 255) * (1 - t) + mix * t)
  const b = Math.round((color & 255) * (1 - t) + mix * t)
  return (r << 16) | (g << 8) | b
}

function averageXZ(points) {
  return {
    x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
    z: points.reduce((sum, p) => sum + p.z, 0) / points.length,
  }
}

function insetFootprint(corners, amount) {
  const center = averageXZ(corners)
  return corners.map((p) => ({
    x: lerp(p.x, center.x, amount),
    z: lerp(p.z, center.z, amount),
  }))
}

function randomPointInQuad(corners, seed) {
  const r1 = fract(Math.sin(seed * 12.9898) * 43758.5453)
  const r2 = fract(Math.sin(seed * 78.233) * 23454.123)
  const a = lerpPoint(corners[0], corners[1], r1)
  const b = lerpPoint(corners[3], corners[2], r1)
  return lerpPoint(a, b, r2)
}

function lerpPoint(a, b, t) {
  return { x: lerp(a.x, b.x, t), z: lerp(a.z, b.z, t) }
}

function noise2(x, z) {
  return fract(Math.sin(x * 12.9898 + z * 78.233) * 43758.5453)
}

function lerp(a, b, t) {
  return a + (b - a) * t
}

function fract(value) {
  return value - Math.floor(value)
}

function makeRng(seed) {
  const base = mulberry32(hashSeed(String(seed)))
  base.range = (min, max) => min + (max - min) * base()
  base.int = (min, max) => Math.floor(base.range(min, max + 1))
  base.pick = (items) => items[Math.floor(base() * items.length)]
  return base
}

function hashSeed(seed) {
  let h = 2166136261
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function mulberry32(seed) {
  return function random() {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
