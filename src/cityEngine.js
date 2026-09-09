const TAU = Math.PI * 2
const ISO_X = 0.58
const ISO_Y = 0.32

export const WEATHER_MODES = [
  { id: 'sunny', label: '晴', hint: '清晰日照，夜晚灯光更暖' },
  { id: 'rain', label: '雨', hint: '道路反光，城市会有雨线' },
  { id: 'snow', label: '雪', hint: '慢速雪花和冷色天空' },
]

const BUILDING_PALETTE = [
  '#ef806f',
  '#f7b955',
  '#6ec1e4',
  '#7bc47f',
  '#c58be8',
  '#ef9ec1',
  '#84a9ef',
  '#f2d16b',
  '#74c7b8',
]

const CAR_PALETTE = ['#ff5b57', '#ffd166', '#4dabf7', '#65d66e', '#f06595', '#f8f9fa', '#845ef7']
const PERSON_PALETTE = ['#263238', '#d9480f', '#1971c2', '#2b8a3e', '#9c36b5', '#e67700']
const ROOF_PALETTE = ['#b94f4f', '#476b85', '#6f7950', '#8f6f45', '#66768f', '#9c6760']
const SIGN_PALETTE = ['#ffec99', '#ff8787', '#74c0fc', '#b197fc', '#63e6be', '#ffd43b']
const FACADE_MATERIALS = ['brick', 'stucco', 'tile', 'concrete', 'glass', 'painted']

export function makeSeed() {
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}

export function formatCityTime(hours) {
  const normalized = ((hours % 24) + 24) % 24
  const h = Math.floor(normalized)
  const m = Math.floor((normalized - h) * 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function createCity(seed) {
  const rng = makeRng(seed)
  const size = 2200
  const river = createRiver(rng, size)
  const roads = createRoads(rng, size)
  const intersections = createIntersections(roads, river)
  const bridges = createBridges(roads, river)
  const viaducts = createViaducts(rng, size, river)
  const mountains = createMountains(rng, size, river)
  const blocks = createBlocks(roads, size)
  const parks = []
  const buildings = []

  blocks.forEach((block) => {
    const center = { x: block.x + block.w / 2, y: block.y + block.d / 2 }
    const riverDistance = distanceToPolyline(center, river.points)
    const mountainDistance = nearestDistance(center, mountains)
    const centerPull = 1 - clamp(distance(center.x, center.y, size / 2, size / 2) / (size * 0.7), 0, 1)

    if (riverDistance < river.width * 1.4 || mountainDistance < 120 || rng() < 0.13) {
      if (block.w > 120 && block.d > 120) {
        parks.push({
          x: block.x + 12,
          y: block.y + 12,
          w: Math.max(70, block.w - 24),
          d: Math.max(70, block.d - 24),
          pond: riverDistance > river.width * 1.6 && rng() > 0.72,
          tone: rng.pick(['#81c784', '#8fd36a', '#69b985', '#9ccc65']),
        })
      }
      return
    }

    const count = rng.int(2, centerPull > 0.52 ? 6 : 5)
    for (let i = 0; i < count; i += 1) {
      if (buildings.length > 190) break
      const bw = clamp(block.w * rng.range(0.18, 0.38), 48, 155)
      const bd = clamp(block.d * rng.range(0.2, 0.42), 48, 165)
      if (block.w - bw < 18 || block.d - bd < 18) continue
      const x = rng.range(block.x + 12, block.x + block.w - bw - 12)
      const y = rng.range(block.y + 12, block.y + block.d - bd - 12)
      const buildingCenter = { x: x + bw / 2, y: y + bd / 2 }
      if (distanceToPolyline(buildingCenter, river.points) < river.width * 0.95) continue

      const localCenterPull =
        1 - clamp(distance(buildingCenter.x, buildingCenter.y, size / 2, size / 2) / (size * 0.68), 0, 1)
      const h = rng.range(42, 110) + localCenterPull * rng.range(80, 260)
      const style =
        h > 185 && rng() > 0.24
          ? 'tower'
          : rng.pick(['apartment', 'shop', 'civic', 'rowhouse', 'apartment', 'apartment'])
      buildings.push({
        x,
        y,
        w: bw,
        d: bd,
        h,
        style,
        material: style === 'tower' ? rng.pick(['glass', 'glass', 'concrete', 'tile']) : rng.pick(FACADE_MATERIALS),
        floorHeight: rng.range(style === 'shop' ? 18 : 22, style === 'tower' ? 34 : 30),
        balconies: style !== 'tower' && style !== 'civic' && rng() > 0.28,
        fireEscape: style !== 'civic' && rng() > 0.74,
        roofClutter: rng.int(2, style === 'tower' ? 7 : 5),
        facadeRhythm: rng.int(0, 4),
        color: rng.pick(BUILDING_PALETTE),
        accent: rng.pick(ROOF_PALETTE),
        signColor: rng.pick(SIGN_PALETTE),
        roof: rng.pick(['flat', 'garden', 'antenna', 'water', 'gable', 'solar', 'billboard', 'helipad']),
        trim: rng.pick(['bands', 'vertical', 'cornice', 'none']),
        windowSeed: rng.int(0, 9999),
      })
    }
  })

  const trees = createTrees(rng, size, river, parks, mountains)
  const lamps = createStreetLamps(roads)
  const rails = createGuardRails(roads)
  const trafficLights = intersections.flatMap((intersection, index) => createTrafficLights(intersection, index))
  const cars = createCars(rng, roads)
  const pedestrians = createPedestrians(rng, roads)

  return {
    seed,
    size,
    roads,
    river,
    bridges,
    viaducts,
    mountains,
    parks,
    buildings,
    trees,
    lamps,
    rails,
    trafficLights,
    cars,
    pedestrians,
    intersections,
    stats: {
      buildings: buildings.length,
      roads: roads.length,
      bridges: bridges.length + viaducts.length,
      trees: trees.length,
      people: pedestrians.length,
      cars: cars.length,
    },
  }
}

export function getDefaultScale(city, width, height) {
  const rawWidth = city.size * ISO_X * 2
  const rawHeight = city.size * ISO_Y
  return Math.min(width / (rawWidth + 230), height / (rawHeight + 330))
}

export function drawCity(ctx, city, viewport, options) {
  const { width, height, weather, timeHours, elapsedSeconds } = options
  const theme = getTheme(timeHours, weather)
  const project = createProjector(city, viewport, width, height)

  ctx.clearRect(0, 0, width, height)
  drawSky(ctx, width, height, theme, weather)
  drawCompassFrame(ctx, width, height, theme)
  drawGround(ctx, city, project, theme)
  drawTerrain(ctx, city, project, theme)
  drawRiver(ctx, city.river, project, viewport, theme, weather, elapsedSeconds)
  drawParks(ctx, city.parks, project, theme)
  drawRoads(ctx, city, project, viewport, theme, weather)
  drawBridges(ctx, city, project, viewport, theme, weather)
  drawViaducts(ctx, city.viaducts, project, viewport, theme, weather, elapsedSeconds, 'supports')
  drawCrosswalks(ctx, city.intersections, project, viewport, theme)

  const renderables = [
    ...city.mountains.map((item) => ({ type: 'mountain', item, depth: item.x + item.y + item.radius })),
    ...city.trees.map((item) => ({ type: 'tree', item, depth: item.x + item.y + item.height * 0.2 })),
    ...city.buildings.map((item) => ({ type: 'building', item, depth: item.x + item.y + item.w + item.d })),
    ...city.lamps.map((item) => ({ type: 'lamp', item, depth: item.x + item.y })),
    ...city.trafficLights.map((item) => ({ type: 'traffic', item, depth: item.x + item.y + 8 })),
    ...city.cars.map((item) => {
      const road = city.roads[item.roadIndex]
      const info = samplePath(road.path, item.start + elapsedSeconds * item.speed, true)
      return { type: 'car', item: { ...item, info, road }, depth: info.x + info.y + 14 }
    }),
    ...city.pedestrians.map((item) => {
      const road = city.roads[item.roadIndex]
      const info = samplePath(road.path, item.start + elapsedSeconds * item.speed, true)
      return { type: 'person', item: { ...item, info, road }, depth: info.x + info.y + 12 }
    }),
  ].sort((a, b) => a.depth - b.depth)

  renderables.forEach((renderable) => {
    if (renderable.type === 'mountain') drawMountain(ctx, renderable.item, project, theme)
    if (renderable.type === 'tree') drawTree(ctx, renderable.item, project, viewport, theme)
    if (renderable.type === 'building') drawBuilding(ctx, renderable.item, project, viewport, theme, timeHours)
    if (renderable.type === 'lamp') drawStreetLamp(ctx, renderable.item, project, viewport, theme, weather)
    if (renderable.type === 'traffic') drawTrafficLight(ctx, renderable.item, project, viewport, theme, timeHours)
    if (renderable.type === 'car') drawCar(ctx, renderable.item, project, viewport, theme, weather)
    if (renderable.type === 'person') drawPerson(ctx, renderable.item, project, viewport, theme, elapsedSeconds)
  })

  drawViaducts(ctx, city.viaducts, project, viewport, theme, weather, elapsedSeconds, 'deck')
  drawNightOverlay(ctx, width, height, theme, weather)
  drawLampGlows(ctx, city.lamps, project, viewport, theme, weather)
  drawWeather(ctx, width, height, weather, elapsedSeconds, theme)
  drawCompassLabels(ctx, width, height, theme)
}

function createRiver(rng, size) {
  const vertical = rng() > 0.35
  const points = []
  const count = rng.int(18, 24)
  const base = rng.range(size * 0.36, size * 0.64)
  const amplitude = rng.range(155, 260)
  const secondary = rng.range(65, 145)
  const phase = rng.range(0, TAU)
  const phaseB = rng.range(0, TAU)
  let drift = rng.range(-60, 60)

  for (let i = 0; i < count; i += 1) {
    const t = i / (count - 1)
    const eased = smoothstep(t)
    drift = clamp(drift + rng.range(-42, 42), -170, 170)
    const wave =
      Math.sin(eased * TAU * rng.range(1.05, 1.45) + phase) * amplitude +
      Math.sin(eased * TAU * rng.range(2.4, 3.15) + phaseB) * secondary +
      drift
    const curl = Math.sin(eased * TAU * 2.1 + phase * 0.7) * amplitude * 0.28
    if (vertical) {
      points.push({
        x: clamp(base + wave + rng.range(-20, 20), 80, size - 80),
        y: lerp(-160, size + 160, t) + curl * 0.22,
      })
    } else {
      points.push({
        x: lerp(-160, size + 160, t) + curl * 0.22,
        y: clamp(base + wave + rng.range(-20, 20), 80, size - 80),
      })
    }
  }

  const midIndex = Math.floor(points.length / 2)
  const desiredCenter = size / 2 + rng.range(-95, 95)
  const correction = desiredCenter - (vertical ? points[midIndex].x : points[midIndex].y)
  points.forEach((point, index) => {
    const t = index / (points.length - 1)
    const influence = Math.exp(-Math.pow((t - 0.5) / 0.26, 2))
    if (vertical) point.x = clamp(point.x + correction * influence, 80, size - 80)
    else point.y = clamp(point.y + correction * influence, 80, size - 80)
  })

  return {
    points,
    width: rng.range(96, 150),
    color: rng.pick(['#47b9e8', '#42c7d9', '#5ab0ff']),
    bankColor: rng.pick(['#d7c184', '#cdbb78', '#e0cd93']),
    foamSeed: rng.int(0, 9999),
  }
}

function createRoads(rng, size) {
  const verticals = createRoadPositions(rng, size)
  const horizontals = createRoadPositions(rng, size)
  const roads = []

  verticals.forEach((x, index) => {
    const major = index === Math.floor(verticals.length / 2) || index % 3 === 0
    roads.push(createRoad(rng, 'vertical', x, size, major))
  })

  horizontals.forEach((y, index) => {
    const major = index === Math.floor(horizontals.length / 2) || index % 3 === 1
    roads.push(createRoad(rng, 'horizontal', y, size, major))
  })

  const diagonalCount = rng.int(1, 2)
  for (let i = 0; i < diagonalCount; i += 1) {
    const forward = rng() > 0.5
    const inset = rng.range(130, 310)
    const path = []
    for (let step = 0; step <= 7; step += 1) {
      const t = step / 7
      const x = lerp(inset, size - inset, t)
      const y = forward ? lerp(inset, size - inset, t) : lerp(size - inset, inset, t)
      path.push({
        x: x + Math.sin(t * TAU + rng.range(0, TAU)) * 42,
        y: y + Math.cos(t * TAU + rng.range(0, TAU)) * 42,
      })
    }
    roads.push({
      id: `diagonal-${i}`,
      axis: 'diagonal',
      base: 0,
      path,
      width: rng.range(48, 60),
      major: true,
      laneCount: 2,
      length: pathLength(path),
    })
  }

  return roads
}

function createRoadPositions(rng, size) {
  const count = rng.int(6, 8)
  const positions = []
  const step = size / (count + 1)
  for (let i = 1; i <= count; i += 1) {
    positions.push(clamp(i * step + rng.range(-58, 58), 145, size - 145))
  }
  positions.push(size / 2 + rng.range(-32, 32))
  return [...new Set(positions.map((value) => Math.round(value)))].sort((a, b) => a - b)
}

function createRoad(rng, axis, base, size, major) {
  const points = []
  const count = 9
  const amplitude = major ? rng.range(12, 28) : rng.range(22, 48)
  const phase = rng.range(0, TAU)
  for (let i = 0; i < count; i += 1) {
    const t = i / (count - 1)
    const wiggle = Math.sin(t * TAU * 1.25 + phase) * amplitude + rng.range(-amplitude * 0.22, amplitude * 0.22)
    if (axis === 'vertical') points.push({ x: clamp(base + wiggle, 80, size - 80), y: lerp(0, size, t) })
    if (axis === 'horizontal') points.push({ x: lerp(0, size, t), y: clamp(base + wiggle, 80, size - 80) })
  }

  return {
    id: `${axis}-${Math.round(base)}`,
    axis,
    base,
    path: points,
    width: major ? 68 : 48,
    major,
    laneCount: major ? 4 : 2,
    length: pathLength(points),
  }
}

function createBlocks(roads, size) {
  const verticals = roads.filter((road) => road.axis === 'vertical').map((road) => road.base).sort((a, b) => a - b)
  const horizontals = roads.filter((road) => road.axis === 'horizontal').map((road) => road.base).sort((a, b) => a - b)
  const xBounds = [90, ...verticals, size - 90]
  const yBounds = [90, ...horizontals, size - 90]
  const blocks = []

  for (let x = 0; x < xBounds.length - 1; x += 1) {
    for (let y = 0; y < yBounds.length - 1; y += 1) {
      const x0 = xBounds[x] + 44
      const x1 = xBounds[x + 1] - 44
      const y0 = yBounds[y] + 44
      const y1 = yBounds[y + 1] - 44
      if (x1 - x0 > 98 && y1 - y0 > 98) {
        blocks.push({ x: x0, y: y0, w: x1 - x0, d: y1 - y0 })
      }
    }
  }

  return blocks
}

function createIntersections(roads, river) {
  const verticals = roads.filter((road) => road.axis === 'vertical')
  const horizontals = roads.filter((road) => road.axis === 'horizontal')
  const intersections = []

  verticals.forEach((vertical) => {
    horizontals.forEach((horizontal) => {
      const point = { x: vertical.base, y: horizontal.base }
      if (distanceToPolyline(point, river.points) < river.width * 0.52) return
      intersections.push({ ...point, vertical, horizontal })
    })
  })

  return intersections
}

function createBridges(roads, river) {
  const bridges = []

  roads.forEach((road, roadIndex) => {
    const step = 22
    let start = null

    for (let d = 0; d <= road.length; d += step) {
      const info = samplePath(road.path, d, false)
      const hit = distanceToPolyline(info, river.points) < river.width * 0.68 + road.width * 0.28
      if (hit && start === null) start = d
      if ((!hit || d + step > road.length) && start !== null) {
        const end = d
        if (end - start > 32) {
          const mid = (start + end) / 2
          const midpoint = samplePath(road.path, mid, false)
          bridges.push({
            roadIndex,
            distance: mid,
            length: clamp(end - start + 118, 120, 340),
            width: road.width + 34,
            elevation: road.major ? 26 : 16,
            archHeight: road.major ? 54 : 36,
            kind: road.major ? 'truss' : 'stone',
            railColor: road.major ? '#f8f3df' : '#e8d7aa',
            x: midpoint.x,
            y: midpoint.y,
          })
        }
        start = null
      }
    }
  })

  return bridges
}

function createViaducts(rng, size, river) {
  const viaducts = []
  const count = rng.int(1, 2)

  for (let i = 0; i < count; i += 1) {
    const path = []
    const forward = rng() > 0.5
    const inset = rng.range(150, 260)
    const bow = rng.range(140, 270) * (rng() > 0.5 ? 1 : -1)
    const crossBias = rng.range(size * 0.32, size * 0.68)

    for (let step = 0; step <= 14; step += 1) {
      const t = step / 14
      const bend = Math.sin(t * Math.PI) * bow + Math.sin(t * TAU * 1.6) * 55
      const x = forward ? lerp(inset, size - inset, t) : lerp(size - inset, inset, t)
      const y = crossBias + bend + Math.sin(t * TAU + i) * 42
      path.push({
        x: clamp(x, 60, size - 60),
        y: clamp(y, 60, size - 60),
      })
    }

    const length = pathLength(path)
    const riverCrossings = []
    for (let d = 0; d < length; d += 55) {
      const point = samplePath(path, d, false)
      if (distanceToPolyline(point, river.points) < river.width * 0.8) riverCrossings.push(d)
    }

    viaducts.push({
      id: `viaduct-${i}`,
      path,
      length,
      width: rng.range(58, 74),
      elevation: rng.range(82, 118),
      pillarSpacing: rng.range(135, 185),
      color: rng.pick(['#c9b48a', '#cfc5a5', '#bfc8c0']),
      deckColor: rng.pick(['#6a7480', '#5f6d78', '#737167']),
      accent: rng.pick(['#fff3bf', '#d0ebff', '#ffe3e3']),
      riverCrossings,
    })
  }

  return viaducts
}

function createMountains(rng, size, river) {
  const mountains = []
  const clusters = rng.pick(['north', 'west', 'northwest'])
  const count = rng.int(20, 30)

  for (let i = 0; i < count; i += 1) {
    let x = rng.range(70, size - 70)
    let y = rng.range(70, size - 70)
    if (clusters === 'north') y = rng.range(35, size * 0.24)
    if (clusters === 'west') x = rng.range(35, size * 0.24)
    if (clusters === 'northwest') {
      if (rng() > 0.45) y = rng.range(35, size * 0.26)
      else x = rng.range(35, size * 0.26)
    }
    if (distanceToPolyline({ x, y }, river.points) < river.width * 1.1) {
      x += rng.range(130, 240)
      y += rng.range(80, 180)
    }
    const peakCount = rng.int(3, 5)
    const peaks = []
    for (let peak = 0; peak < peakCount; peak += 1) {
      peaks.push({
        dx: rng.range(-0.42, 0.42),
        dy: rng.range(-0.34, 0.34),
        height: rng.range(0.62, 1.08),
      })
    }
    mountains.push({
      x: clamp(x, 40, size - 40),
      y: clamp(y, 40, size - 40),
      radius: rng.range(58, 146),
      height: rng.range(80, 245),
      color: rng.pick(['#8d9b61', '#7fa26c', '#9aa36b', '#7e8f5d']),
      snow: rng() > 0.68,
      peaks,
    })
  }

  return mountains
}

function createTrees(rng, size, river, parks, mountains) {
  const trees = []

  parks.forEach((park) => {
    const count = rng.int(7, 18)
    for (let i = 0; i < count; i += 1) {
      trees.push(createTree(rng, rng.range(park.x + 16, park.x + park.w - 16), rng.range(park.y + 16, park.y + park.d - 16)))
    }
  })

  for (let d = 35; d < pathLength(river.points); d += rng.range(45, 78)) {
    const info = samplePath(river.points, d, false)
    const side = rng() > 0.5 ? 1 : -1
    const offset = river.width / 2 + rng.range(30, 95)
    const x = info.x + info.normalX * offset * side
    const y = info.y + info.normalY * offset * side
    if (x > 40 && y > 40 && x < size - 40 && y < size - 40) trees.push(createTree(rng, x, y))
  }

  mountains.forEach((mountain) => {
    const count = rng.int(2, 6)
    for (let i = 0; i < count; i += 1) {
      const angle = rng.range(0, TAU)
      const radius = mountain.radius * rng.range(0.75, 1.25)
      const x = mountain.x + Math.cos(angle) * radius
      const y = mountain.y + Math.sin(angle) * radius
      if (x > 30 && y > 30 && x < size - 30 && y < size - 30) trees.push(createTree(rng, x, y, true))
    }
  })

  for (let i = 0; i < 80; i += 1) {
    trees.push(createTree(rng, rng.range(70, size - 70), rng.range(70, size - 70), rng() > 0.7))
  }

  return trees.slice(0, 430)
}

function createTree(rng, x, y, pine = false) {
  return {
    x,
    y,
    height: rng.range(28, pine ? 74 : 58),
    radius: rng.range(13, pine ? 22 : 25),
    pine: pine || rng() > 0.74,
    color: rng.pick(['#2f9e44', '#37b24d', '#66a80f', '#20c997', '#51cf66']),
  }
}

function createStreetLamps(roads) {
  const lamps = []
  roads.forEach((road, roadIndex) => {
    const spacing = road.major ? 145 : 190
    for (let d = 70; d < road.length; d += spacing) {
      const info = samplePath(road.path, d, false)
      const side = Math.floor(d / spacing) % 2 === 0 ? 1 : -1
      lamps.push({
        x: info.x + info.normalX * (road.width / 2 + 24) * side,
        y: info.y + info.normalY * (road.width / 2 + 24) * side,
        roadIndex,
        side,
      })
    }
  })
  return lamps
}

function createGuardRails(roads) {
  const rails = []
  roads
    .filter((road) => road.major)
    .forEach((road) => {
      rails.push({ road, side: 1 })
      rails.push({ road, side: -1 })
    })
  return rails
}

function createTrafficLights(intersection, index) {
  const offset = 42
  return [
    { x: intersection.x - offset, y: intersection.y - offset, phase: index * 0.37 },
    { x: intersection.x + offset, y: intersection.y + offset, phase: index * 0.37 + 0.5 },
  ]
}

function createCars(rng, roads) {
  const cars = []
  for (let i = 0; i < 54; i += 1) {
    const roadIndex = rng.int(0, roads.length - 1)
    const road = roads[roadIndex]
    cars.push({
      roadIndex,
      start: rng.range(0, road.length),
      speed: rng.range(28, road.major ? 78 : 56),
      laneOffset: rng.pick([-1, 1]) * rng.range(road.width * 0.08, road.width * 0.26),
      color: rng.pick(CAR_PALETTE),
      size: rng.range(0.8, 1.22),
    })
  }
  return cars
}

function createPedestrians(rng, roads) {
  const people = []
  for (let i = 0; i < 92; i += 1) {
    const roadIndex = rng.int(0, roads.length - 1)
    const road = roads[roadIndex]
    const side = rng.pick([-1, 1])
    people.push({
      roadIndex,
      start: rng.range(0, road.length),
      speed: rng.range(5, 15),
      side,
      offset: side * (road.width / 2 + rng.range(28, 42)),
      color: rng.pick(PERSON_PALETTE),
      stride: rng.range(0, TAU),
    })
  }
  return people
}

function createProjector(city, viewport, width, height) {
  const scale = viewport.scale
  const centerY = city.size * ISO_Y
  return (x, y, z = 0) => {
    const rawX = (x - y) * ISO_X
    const rawY = (x + y) * ISO_Y - z
    return {
      x: width / 2 + (rawX + viewport.offsetX) * scale,
      y: height / 2 + (rawY - centerY + viewport.offsetY) * scale,
    }
  }
}

function drawSky(ctx, width, height, theme, weather) {
  const gradient = ctx.createLinearGradient(0, 0, 0, height)
  if (theme.night > 0.55) {
    gradient.addColorStop(0, weather === 'snow' ? '#26334a' : '#1f2740')
    gradient.addColorStop(1, weather === 'rain' ? '#314052' : '#394569')
  } else if (weather === 'rain') {
    gradient.addColorStop(0, '#8fb3c7')
    gradient.addColorStop(1, '#d7e5e4')
  } else if (weather === 'snow') {
    gradient.addColorStop(0, '#d8e9f8')
    gradient.addColorStop(1, '#f5fbff')
  } else {
    gradient.addColorStop(0, '#8dd7ff')
    gradient.addColorStop(0.62, '#d8f3ff')
    gradient.addColorStop(1, '#f8fbda')
  }
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)

  if (theme.sun > 0.15) {
    ctx.save()
    ctx.globalAlpha = 0.7 * theme.sun
    ctx.fillStyle = '#ffe066'
    ctx.beginPath()
    ctx.arc(width * 0.82, height * 0.15, Math.max(32, width * 0.035), 0, TAU)
    ctx.fill()
    ctx.restore()
  } else {
    ctx.save()
    ctx.globalAlpha = 0.8
    ctx.fillStyle = '#f2f0ff'
    ctx.beginPath()
    ctx.arc(width * 0.82, height * 0.14, Math.max(20, width * 0.024), 0, TAU)
    ctx.fill()
    ctx.globalCompositeOperation = 'destination-out'
    ctx.beginPath()
    ctx.arc(width * 0.835, height * 0.13, Math.max(18, width * 0.022), 0, TAU)
    ctx.fill()
    ctx.restore()
  }
}

function drawCompassFrame(ctx, width, height, theme) {
  ctx.save()
  ctx.strokeStyle = `rgba(41, 54, 71, ${0.35 + theme.night * 0.24})`
  ctx.lineWidth = 2
  ctx.strokeRect(16, 16, width - 32, height - 32)

  ctx.strokeStyle = `rgba(41, 54, 71, ${0.18 + theme.night * 0.18})`
  ctx.lineWidth = 1
  for (let i = 0; i <= 10; i += 1) {
    const t = 26 + ((width - 52) * i) / 10
    const len = i % 5 === 0 ? 18 : 10
    ctx.beginPath()
    ctx.moveTo(t, 16)
    ctx.lineTo(t, 16 + len)
    ctx.moveTo(t, height - 16)
    ctx.lineTo(t, height - 16 - len)
    ctx.moveTo(16, t)
    ctx.lineTo(16 + len, t)
    ctx.moveTo(width - 16, t)
    ctx.lineTo(width - 16 - len, t)
    ctx.stroke()
  }
  ctx.restore()
}

function drawCompassLabels(ctx, width, height, theme) {
  ctx.save()
  ctx.fillStyle = theme.night > 0.5 ? 'rgba(245, 249, 255, 0.82)' : 'rgba(41, 54, 71, 0.78)'
  ctx.font = '700 13px Inter, system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('N', width / 2, 33)
  ctx.fillText('S', width / 2, height - 33)
  ctx.fillText('W', 33, height / 2)
  ctx.fillText('E', width - 33, height / 2)
  ctx.restore()
}

function drawGround(ctx, city, project, theme) {
  const corners = [
    project(0, 0),
    project(city.size, 0),
    project(city.size, city.size),
    project(0, city.size),
  ]
  ctx.save()
  ctx.fillStyle = theme.night > 0.5 ? '#4a684c' : '#9ed06e'
  ctx.strokeStyle = 'rgba(44, 73, 55, 0.42)'
  ctx.lineWidth = 2
  polygon(ctx, corners)
  ctx.fill()
  ctx.stroke()

  ctx.globalAlpha = 0.28
  ctx.strokeStyle = '#e7f5b6'
  for (let i = 0; i <= city.size; i += 220) {
    pathThrough(ctx, [project(i, 0), project(i, city.size)])
    ctx.stroke()
    pathThrough(ctx, [project(0, i), project(city.size, i)])
    ctx.stroke()
  }
  ctx.restore()
}

function drawTerrain(ctx, city, project, theme) {
  const corners = [
    project(0, 0),
    project(city.size, 0),
    project(city.size, city.size),
    project(0, city.size),
  ]
  const north = [corners[0], corners[1], project(city.size * 0.83, city.size * 0.12), project(city.size * 0.16, city.size * 0.1)]
  const west = [corners[0], project(city.size * 0.12, city.size * 0.18), project(city.size * 0.12, city.size * 0.84), corners[3]]
  ctx.save()
  ctx.globalAlpha = theme.night > 0.45 ? 0.16 : 0.22
  ctx.fillStyle = '#486b43'
  polygon(ctx, north)
  ctx.fill()
  ctx.fillStyle = '#6e934a'
  polygon(ctx, west)
  ctx.fill()
  ctx.restore()
}

function drawRiver(ctx, river, project, viewport, theme, weather, elapsedSeconds) {
  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  ctx.strokeStyle = shade(river.bankColor, theme.night > 0.5 ? -28 : 0)
  ctx.lineWidth = worldStroke(river.width + 34, viewport)
  strokeSmoothProjectedPath(ctx, river.points, project)

  ctx.strokeStyle = weather === 'snow' ? 'rgba(238, 247, 255, 0.55)' : 'rgba(67, 106, 90, 0.18)'
  ctx.lineWidth = worldStroke(river.width + 18, viewport)
  strokeSmoothProjectedPath(ctx, river.points, project)

  ctx.strokeStyle = shade(river.color, theme.night > 0.5 ? -26 : weather === 'snow' ? 16 : 0)
  ctx.lineWidth = worldStroke(river.width, viewport)
  strokeSmoothProjectedPath(ctx, river.points, project)

  const inner = theme.night > 0.5 ? 'rgba(118, 203, 240, 0.28)' : 'rgba(204, 244, 255, 0.42)'
  ctx.strokeStyle = inner
  ctx.lineWidth = worldStroke(river.width * 0.42, viewport)
  strokeSmoothProjectedPath(ctx, river.points, project)

  ctx.strokeStyle = weather === 'rain' ? 'rgba(232, 250, 255, 0.38)' : 'rgba(255, 255, 255, 0.34)'
  ctx.lineWidth = worldStroke(8, viewport)
  ctx.setLineDash([worldStroke(35, viewport), worldStroke(45, viewport)])
  ctx.lineDashOffset = -elapsedSeconds * 28 * viewport.scale
  strokeSmoothProjectedPath(ctx, river.points, project)
  ctx.setLineDash([])

  drawRiverFoam(ctx, river, project, viewport, elapsedSeconds, theme)
  drawRiverDocks(ctx, river, project, viewport, theme)
  ctx.restore()
}

function drawRiverFoam(ctx, river, project, viewport, elapsedSeconds, theme) {
  const length = pathLength(river.points)
  const count = Math.floor(length / 115)
  ctx.save()
  ctx.strokeStyle = theme.night > 0.5 ? 'rgba(216, 245, 255, 0.32)' : 'rgba(255, 255, 255, 0.46)'
  ctx.lineWidth = Math.max(0.8, 1.6 * viewport.scale)
  for (let i = 0; i < count; i += 1) {
    const d = (i * 113 + elapsedSeconds * 16 + river.foamSeed) % length
    const info = samplePath(river.points, d, true)
    const side = i % 2 === 0 ? 1 : -1
    const a = project(info.x + info.normalX * side * river.width * 0.18, info.y + info.normalY * side * river.width * 0.18)
    const b = project(
      info.x + info.normalX * side * river.width * 0.32 + info.tangentX * 24,
      info.y + info.normalY * side * river.width * 0.32 + info.tangentY * 24,
    )
    pathThrough(ctx, [a, b])
    ctx.stroke()
  }
  ctx.restore()
}

function drawRiverDocks(ctx, river, project, viewport, theme) {
  const length = pathLength(river.points)
  const dockCount = Math.max(4, Math.floor(length / 520))
  ctx.save()
  for (let i = 0; i < dockCount; i += 1) {
    const info = samplePath(river.points, 130 + i * (length / dockCount), false)
    const side = i % 2 === 0 ? 1 : -1
    const bank = {
      x: info.x + info.normalX * side * (river.width * 0.55),
      y: info.y + info.normalY * side * (river.width * 0.55),
    }
    const end = {
      x: info.x + info.normalX * side * (river.width * 0.82),
      y: info.y + info.normalY * side * (river.width * 0.82),
    }
    const a = project(bank.x, bank.y, 2)
    const b = project(end.x, end.y, 2)
    ctx.strokeStyle = shade('#8b6f47', theme.night > 0.5 ? -26 : 0)
    ctx.lineWidth = Math.max(2, 7 * viewport.scale)
    pathThrough(ctx, [a, b])
    ctx.stroke()
    ctx.strokeStyle = 'rgba(255, 244, 213, 0.5)'
    ctx.lineWidth = Math.max(1, 1.5 * viewport.scale)
    pathThrough(ctx, [a, b])
    ctx.stroke()
  }
  ctx.restore()
}

function drawParks(ctx, parks, project, theme) {
  parks.forEach((park) => {
    const points = [
      project(park.x, park.y),
      project(park.x + park.w, park.y),
      project(park.x + park.w, park.y + park.d),
      project(park.x, park.y + park.d),
    ]
    ctx.save()
    ctx.fillStyle = shade(park.tone, theme.night > 0.5 ? -18 : 0)
    ctx.strokeStyle = 'rgba(61, 100, 63, 0.42)'
    ctx.lineWidth = 1.5
    polygon(ctx, points)
    ctx.fill()
    ctx.stroke()

    const crossA = [project(park.x + park.w * 0.18, park.y + park.d * 0.5), project(park.x + park.w * 0.82, park.y + park.d * 0.5)]
    const crossB = [project(park.x + park.w * 0.5, park.y + park.d * 0.18), project(park.x + park.w * 0.5, park.y + park.d * 0.82)]
    ctx.strokeStyle = 'rgba(255, 242, 196, 0.52)'
    ctx.lineWidth = 3
    pathThrough(ctx, crossA)
    ctx.stroke()
    pathThrough(ctx, crossB)
    ctx.stroke()

    if (park.pond) {
      const p = project(park.x + park.w * 0.55, park.y + park.d * 0.48)
      ctx.fillStyle = 'rgba(70, 185, 232, 0.72)'
      ctx.beginPath()
      ctx.ellipse(p.x, p.y, Math.max(10, park.w * 0.045), Math.max(6, park.d * 0.025), -0.35, 0, TAU)
      ctx.fill()
    }
    ctx.restore()
  })
}

function drawRoads(ctx, city, project, viewport, theme, weather) {
  city.roads.forEach((road) => {
    ctx.save()
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    ctx.strokeStyle = theme.night > 0.55 ? '#718078' : '#d7c79d'
    ctx.lineWidth = worldStroke(road.width + 30, viewport)
    strokeSmoothProjectedPath(ctx, road.path, project)

    ctx.strokeStyle = theme.night > 0.55 ? '#a6a28d' : '#f0e4bc'
    ctx.lineWidth = worldStroke(road.width + 16, viewport)
    ctx.setLineDash([worldStroke(13, viewport), worldStroke(18, viewport)])
    strokeSmoothProjectedPath(ctx, road.path, project)
    ctx.setLineDash([])

    ctx.strokeStyle = weather === 'rain' ? '#55606b' : theme.night > 0.55 ? '#4d5964' : '#66707a'
    ctx.lineWidth = worldStroke(road.width, viewport)
    strokeSmoothProjectedPath(ctx, road.path, project)

    if (weather === 'rain') {
      ctx.strokeStyle = 'rgba(210, 236, 255, 0.2)'
      ctx.lineWidth = worldStroke(road.width * 0.62, viewport)
      strokeSmoothProjectedPath(ctx, road.path, project)
    }

    ctx.strokeStyle = 'rgba(255, 246, 190, 0.7)'
    ctx.lineWidth = Math.max(1, worldStroke(3, viewport))
    ctx.setLineDash([worldStroke(20, viewport), worldStroke(20, viewport)])
    strokeSmoothProjectedPath(ctx, road.path, project)
    ctx.restore()
  })

  city.rails.forEach((rail) => drawRoadRail(ctx, rail.road, rail.side, project, viewport, theme))
}

function drawRoadRail(ctx, road, side, project, viewport, theme) {
  const points = []
  for (let d = 0; d <= road.length; d += 42) {
    const info = samplePath(road.path, d, false)
    points.push({
      x: info.x + info.normalX * (road.width / 2 + 11) * side,
      y: info.y + info.normalY * (road.width / 2 + 11) * side,
    })
  }
  ctx.save()
  ctx.strokeStyle = theme.night > 0.5 ? 'rgba(230, 235, 242, 0.42)' : 'rgba(247, 248, 242, 0.7)'
  ctx.lineWidth = Math.max(1, worldStroke(4, viewport))
  ctx.setLineDash([worldStroke(18, viewport), worldStroke(11, viewport)])
  strokeSmoothProjectedPath(ctx, points, project)
  ctx.restore()
}

function drawBridges(ctx, city, project, viewport, theme, weather) {
  city.bridges.forEach((bridge) => {
    const road = city.roads[bridge.roadIndex]
    const start = bridge.distance - bridge.length / 2
    const end = bridge.distance + bridge.length / 2
    const z = bridge.elevation || 0
    const deckPoints = []
    for (let d = start; d <= end; d += 22) {
      deckPoints.push(samplePath(road.path, d, false))
    }
    if (deckPoints.length < 2) return

    ctx.save()
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    for (let d = start + 22; d < end; d += 72) {
      const info = samplePath(road.path, d, false)
      const foot = project(info.x, info.y, 0)
      const cap = project(info.x, info.y, z)
      ctx.strokeStyle = theme.night > 0.5 ? 'rgba(82, 74, 67, 0.68)' : 'rgba(116, 100, 80, 0.56)'
      ctx.lineWidth = Math.max(1.5, worldStroke(8, viewport))
      pathThrough(ctx, [foot, cap])
      ctx.stroke()
    }

    ctx.strokeStyle = theme.night > 0.5 ? '#8e816d' : '#dbc28d'
    ctx.lineWidth = worldStroke(bridge.width + 16, viewport)
    strokeSmoothWorldPath(ctx, deckPoints, project, z - 5)

    ctx.strokeStyle = weather === 'rain' ? '#596271' : bridge.kind === 'stone' ? '#82796d' : '#66707a'
    ctx.lineWidth = worldStroke(road.width * 0.88, viewport)
    strokeSmoothWorldPath(ctx, deckPoints, project, z)

    ctx.strokeStyle = bridge.railColor || 'rgba(255, 255, 255, 0.82)'
    ctx.lineWidth = Math.max(1, worldStroke(4, viewport))
    ;[-1, 1].forEach((side) => {
      const railPoints = deckPoints.map((point, index) => {
        const reference = samplePath(road.path, start + index * 22, false)
        return {
          x: point.x + reference.normalX * (bridge.width / 2) * side,
          y: point.y + reference.normalY * (bridge.width / 2) * side,
        }
      })
      strokeSmoothWorldPath(ctx, railPoints, project, z + 12)
    })

    if (bridge.kind === 'truss') {
      drawBridgeTruss(ctx, deckPoints, road, start, bridge, project, viewport, theme)
    } else {
      drawBridgeArches(ctx, deckPoints, project, viewport, bridge, theme)
    }
    ctx.restore()
  })
}

function drawViaducts(ctx, viaducts, project, viewport, theme, weather, elapsedSeconds, layer = 'all') {
  viaducts.forEach((viaduct) => {
    ctx.save()
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    if (layer === 'all' || layer === 'supports') {
      for (let d = 40; d < viaduct.length; d += viaduct.pillarSpacing) {
        const info = samplePath(viaduct.path, d, false)
        const foot = project(info.x, info.y, 0)
        const cap = project(info.x, info.y, viaduct.elevation - 8)
        ctx.strokeStyle = theme.night > 0.5 ? 'rgba(72, 76, 80, 0.62)' : 'rgba(102, 113, 110, 0.54)'
        ctx.lineWidth = Math.max(2, worldStroke(12, viewport))
        pathThrough(ctx, [foot, cap])
        ctx.stroke()

        const shadow = project(info.x + info.normalX * 18, info.y + info.normalY * 18, 0)
        ctx.fillStyle = 'rgba(37, 45, 43, 0.13)'
        ctx.beginPath()
        ctx.ellipse(shadow.x, shadow.y, Math.max(6, 18 * viewport.scale), Math.max(3, 8 * viewport.scale), 0, 0, TAU)
        ctx.fill()
      }
    }

    if (layer === 'supports') {
      ctx.restore()
      return
    }

    ctx.strokeStyle = shade(viaduct.color, theme.night > 0.5 ? -22 : 0)
    ctx.lineWidth = worldStroke(viaduct.width + 20, viewport)
    strokeSmoothWorldPath(ctx, viaduct.path, project, viaduct.elevation - 10)

    ctx.strokeStyle = weather === 'rain' ? '#59636f' : shade(viaduct.deckColor, theme.night > 0.5 ? -16 : 0)
    ctx.lineWidth = worldStroke(viaduct.width, viewport)
    strokeSmoothWorldPath(ctx, viaduct.path, project, viaduct.elevation)

    ctx.strokeStyle = viaduct.accent
    ctx.lineWidth = Math.max(1, worldStroke(4, viewport))
    ctx.setLineDash([worldStroke(28, viewport), worldStroke(22, viewport)])
    strokeSmoothWorldPath(ctx, viaduct.path, project, viaduct.elevation + 4)
    ctx.setLineDash([])

    ;[-1, 1].forEach((side) => {
      const rail = offsetPath(viaduct.path, side, viaduct.width / 2 + 7)
      ctx.strokeStyle = theme.night > 0.5 ? 'rgba(235, 242, 250, 0.62)' : 'rgba(255, 255, 248, 0.8)'
      ctx.lineWidth = Math.max(1, worldStroke(4, viewport))
      strokeSmoothWorldPath(ctx, rail, project, viaduct.elevation + 12)
    })

    for (let i = 0; i < 5; i += 1) {
      const info = samplePath(viaduct.path, elapsedSeconds * (42 + i * 5) + i * viaduct.length * 0.22, true)
      drawElevatedCar(ctx, info, viaduct, project, viewport, theme, i)
    }
    ctx.restore()
  })
}

function drawBridgeTruss(ctx, deckPoints, road, start, bridge, project, viewport, theme) {
  ctx.save()
  ctx.strokeStyle = theme.night > 0.5 ? 'rgba(244, 246, 250, 0.58)' : 'rgba(255, 255, 255, 0.75)'
  ctx.lineWidth = Math.max(1, 2.4 * viewport.scale)
  const z = (bridge.elevation || 0) + 12
  ;[-1, 1].forEach((side) => {
    const rail = deckPoints.map((point, index) => {
      const reference = samplePath(road.path, start + index * 22, false)
      return {
        x: point.x + reference.normalX * (bridge.width / 2 + 8) * side,
        y: point.y + reference.normalY * (bridge.width / 2 + 8) * side,
      }
    })
    for (let i = 0; i < rail.length - 1; i += 2) {
      const a = project(rail[i].x, rail[i].y, z)
      const b = project(rail[i + 1].x, rail[i + 1].y, z + bridge.archHeight * 0.45)
      const c = project(rail[Math.min(i + 2, rail.length - 1)].x, rail[Math.min(i + 2, rail.length - 1)].y, z)
      pathThrough(ctx, [a, b, c])
      ctx.stroke()
    }
  })
  ctx.restore()
}

function drawBridgeArches(ctx, deckPoints, project, viewport, bridge, theme) {
  ctx.save()
  ctx.strokeStyle = theme.night > 0.5 ? 'rgba(248, 239, 210, 0.45)' : 'rgba(255, 249, 230, 0.68)'
  ctx.lineWidth = Math.max(1, 2.2 * viewport.scale)
  const z = bridge.elevation || 0
  for (let i = 0; i < deckPoints.length - 3; i += 3) {
    const a = project(deckPoints[i].x, deckPoints[i].y, z - 6)
    const b = project(deckPoints[i + 1].x, deckPoints[i + 1].y, z - bridge.archHeight * 0.62)
    const c = project(deckPoints[i + 3].x, deckPoints[i + 3].y, z - 6)
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.quadraticCurveTo(b.x, b.y, c.x, c.y)
    ctx.stroke()
  }
  ctx.restore()
}

function drawElevatedCar(ctx, info, viaduct, project, viewport, theme, index) {
  const lane = index % 2 === 0 ? -0.18 : 0.18
  const x = info.x + info.normalX * viaduct.width * lane
  const y = info.y + info.normalY * viaduct.width * lane
  const p = project(x, y, viaduct.elevation + 12)
  const f = project(x + info.tangentX * 24, y + info.tangentY * 24, viaduct.elevation + 12)
  const angle = Math.atan2(f.y - p.y, f.x - p.x)
  const scale = viewport.scale * 0.92
  const length = Math.max(7, 30 * scale)
  const width = Math.max(4, 14 * scale)
  ctx.save()
  ctx.translate(p.x, p.y)
  ctx.rotate(angle)
  ctx.fillStyle = shade(CAR_PALETTE[index % CAR_PALETTE.length], theme.night > 0.5 ? -12 : 0)
  roundRect(ctx, -length / 2, -width / 2, length, width, Math.max(2, 4 * scale))
  ctx.fill()
  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)'
  ctx.fillRect(-length * 0.08, -width * 0.38, length * 0.24, width * 0.76)
  ctx.restore()
}

function drawCrosswalks(ctx, intersections, project, viewport, theme) {
  ctx.save()
  ctx.strokeStyle = theme.night > 0.52 ? 'rgba(250,250,245,0.48)' : 'rgba(255,255,255,0.62)'
  ctx.lineWidth = Math.max(1, worldStroke(4, viewport))
  intersections.forEach((intersection, index) => {
    if (index % 2 !== 0) return
    for (let i = -2; i <= 2; i += 1) {
      const a = project(intersection.x - 30, intersection.y + i * 8, 2)
      const b = project(intersection.x + 30, intersection.y + i * 8, 2)
      pathThrough(ctx, [a, b])
      ctx.stroke()
    }
  })
  ctx.restore()
}

function drawMountain(ctx, mountain, project, theme) {
  ctx.save()
  ctx.strokeStyle = 'rgba(51, 68, 53, 0.4)'
  ctx.lineWidth = 1.2
  const baseNorth = project(mountain.x, mountain.y - mountain.radius * 0.92, 0)
  const baseEast = project(mountain.x + mountain.radius, mountain.y + mountain.radius * 0.05, 0)
  const baseSouth = project(mountain.x, mountain.y + mountain.radius * 0.94, 0)
  const baseWest = project(mountain.x - mountain.radius, mountain.y - mountain.radius * 0.05, 0)
  const peaks = (mountain.peaks || [{ dx: 0, dy: 0, height: 1 }]).map((peak) =>
    project(
      mountain.x + peak.dx * mountain.radius,
      mountain.y + peak.dy * mountain.radius,
      mountain.height * peak.height,
    ),
  )
  const mainPeak = peaks.reduce((highest, peak) => (peak.y < highest.y ? peak : highest), peaks[0])
  const left = shade(mountain.color, theme.night > 0.5 ? -36 : -13)
  const right = shade(mountain.color, theme.night > 0.5 ? -20 : 12)
  const front = shade(mountain.color, theme.night > 0.5 ? -17 : 0)

  peaks.forEach((peak, index) => {
    const blend = index % 2 === 0 ? 1 : -1
    drawTriangle(ctx, [baseWest, baseNorth, peak], shade(left, blend * 5))
    drawTriangle(ctx, [baseNorth, baseEast, peak], shade(right, blend * 4))
    drawTriangle(ctx, [baseEast, baseSouth, peak], shade(front, -index * 2))
    drawTriangle(ctx, [baseSouth, baseWest, peak], shade(front, -10))
  })

  ctx.strokeStyle = theme.night > 0.5 ? 'rgba(243, 249, 255, 0.16)' : 'rgba(255, 255, 255, 0.24)'
  ctx.lineWidth = 1
  peaks.forEach((peak) => {
    pathThrough(ctx, [peak, interpolatePoint(baseEast, baseSouth, 0.45)])
    ctx.stroke()
    pathThrough(ctx, [peak, interpolatePoint(baseWest, baseSouth, 0.45)])
    ctx.stroke()
  })

  if (mountain.snow) {
    const snowA = interpolatePoint(mainPeak, baseNorth, 0.2)
    const snowB = interpolatePoint(mainPeak, baseEast, 0.24)
    const snowC = interpolatePoint(mainPeak, baseWest, 0.25)
    ctx.fillStyle = 'rgba(247, 250, 255, 0.88)'
    polygon(ctx, [mainPeak, snowA, snowB])
    ctx.fill()
    polygon(ctx, [mainPeak, snowC, snowA])
    ctx.fill()
  }
  ctx.restore()
}

function drawTree(ctx, tree, project, viewport, theme) {
  const base = project(tree.x, tree.y, 0)
  const top = project(tree.x, tree.y, tree.height)
  const scale = viewport.scale
  ctx.save()
  ctx.strokeStyle = shade('#6b4f31', theme.night > 0.5 ? -26 : 0)
  ctx.lineWidth = Math.max(1.4, 5 * scale)
  ctx.beginPath()
  ctx.moveTo(base.x, base.y)
  ctx.lineTo(top.x, top.y + tree.radius * scale * 0.4)
  ctx.stroke()

  ctx.fillStyle = shade(tree.color, theme.night > 0.5 ? -28 : 0)
  ctx.strokeStyle = 'rgba(30, 72, 38, 0.36)'
  ctx.lineWidth = Math.max(0.8, 1.6 * scale)
  if (tree.pine) {
    const r = tree.radius * scale
    drawScreenTriangle(ctx, top.x, top.y - r * 0.75, r * 1.35, r * 1.45)
    drawScreenTriangle(ctx, top.x, top.y + r * 0.18, r * 1.7, r * 1.6)
  } else {
    const r = tree.radius * scale
    drawBlob(ctx, top.x, top.y, r, [
      [0, -0.38, 0.92],
      [-0.58, 0.08, 0.76],
      [0.58, 0.08, 0.78],
      [0, 0.42, 0.68],
    ])
  }
  ctx.restore()
}

function drawBuilding(ctx, building, project, viewport, theme, timeHours) {
  const baseColor = shade(building.color, theme.night > 0.5 ? -30 : 0)
  const rootBox = {
    x: building.x,
    y: building.y,
    w: building.w,
    d: building.d,
    z: 0,
    h: building.h,
    color: baseColor,
  }

  ctx.save()
  ctx.strokeStyle = 'rgba(37, 45, 53, 0.34)'
  ctx.lineWidth = Math.max(1, 1.45 * viewport.scale)
  drawBuildingShadow(ctx, rootBox, project, viewport)

  if (building.style === 'tower' && building.h > 145) {
    const baseHeight = building.h * 0.42
    const midHeight = building.h * 0.34
    const topHeight = building.h - baseHeight - midHeight
    const base = { ...rootBox, h: baseHeight, color: shade(baseColor, -2) }
    const mid = insetBox(building, 0.14, baseHeight, midHeight, shade(baseColor, 8))
    const top = insetBox(building, 0.28, baseHeight + midHeight, topHeight, shade(baseColor, 17))
    drawBuildingBox(ctx, base, project, viewport, theme, building, timeHours, 0)
    drawBuildingBox(ctx, mid, project, viewport, theme, building, timeHours, 17)
    const topCorners = drawBuildingBox(ctx, top, project, viewport, theme, building, timeHours, 31)
    drawRoofFeature(ctx, top, topCorners, building, project, viewport, theme)
  } else if (building.style === 'civic') {
    const hall = { ...rootBox, h: building.h * 0.76, color: shade(baseColor, 6) }
    const corners = drawBuildingBox(ctx, hall, project, viewport, theme, building, timeHours, 5)
    drawCivicRoof(ctx, hall, corners, building, project, viewport, theme)
  } else {
    const corners = drawBuildingBox(ctx, rootBox, project, viewport, theme, building, timeHours, 0)
    if (building.style === 'shop' || building.style === 'rowhouse') {
      drawStorefront(ctx, corners, building, viewport, theme)
    }
    drawRoofFeature(ctx, rootBox, corners, building, project, viewport, theme)
  }
  ctx.restore()
}

function insetBox(building, insetRatio, z, h, color) {
  const insetX = building.w * insetRatio
  const insetY = building.d * insetRatio
  return {
    x: building.x + insetX,
    y: building.y + insetY,
    w: building.w - insetX * 2,
    d: building.d - insetY * 2,
    z,
    h,
    color,
  }
}

function drawBuildingShadow(ctx, box, project, viewport) {
  const p0 = project(box.x, box.y, 0)
  const p1 = project(box.x + box.w, box.y, 0)
  const p2 = project(box.x + box.w, box.y + box.d, 0)
  const p3 = project(box.x, box.y + box.d, 0)
  ctx.save()
  ctx.globalAlpha = 0.16
  ctx.fillStyle = '#24313a'
  polygon(ctx, [
    { x: p0.x + 8 * viewport.scale, y: p0.y + 12 * viewport.scale },
    { x: p1.x + 10 * viewport.scale, y: p1.y + 13 * viewport.scale },
    { x: p2.x + 16 * viewport.scale, y: p2.y + 16 * viewport.scale },
    { x: p3.x + 14 * viewport.scale, y: p3.y + 15 * viewport.scale },
  ])
  ctx.fill()
  ctx.restore()
}

function drawBuildingBox(ctx, box, project, viewport, theme, building, timeHours, salt) {
  const corners = getBoxCorners(box, project)
  const baseColor = box.color
  drawFace(ctx, [corners.t0, corners.t1, corners.p1, corners.p0], shade(baseColor, 9))
  drawFace(ctx, [corners.t1, corners.t2, corners.p2, corners.p1], shade(baseColor, -8))
  drawFace(ctx, [corners.t2, corners.t3, corners.p3, corners.p2], shade(baseColor, -18))
  drawFace(ctx, [corners.t3, corners.t0, corners.p0, corners.p3], shade(baseColor, -13))
  drawFace(ctx, [corners.t0, corners.t1, corners.t2, corners.t3], shade(baseColor, 23))

  const night = theme.night > 0.38
  const frontFace = [corners.t0, corners.t1, corners.p1, corners.p0]
  const sideFace = [corners.t1, corners.t2, corners.p2, corners.p1]
  if (viewport.scale > 0.27 || building.material === 'glass') {
    drawFacadeTexture(ctx, frontFace, building, viewport, salt)
    drawFacadeTexture(ctx, sideFace, building, viewport, salt + 4)
  }
  drawFacadeTrim(ctx, frontFace, building, viewport, salt)
  drawFacadeTrim(ctx, sideFace, building, viewport, salt + 4)
  drawWindows(ctx, frontFace, building, viewport, night, timeHours, salt)
  drawWindows(ctx, sideFace, building, viewport, night, timeHours, salt + 11)
  if (viewport.scale > 0.16) {
    drawFacadeLife(ctx, frontFace, building, viewport, theme, salt)
    drawFacadeLife(ctx, sideFace, building, viewport, theme, salt + 13)
  }
  drawParapet(ctx, corners, building, viewport, theme)
  drawRooftopClutter(ctx, corners, building, viewport, theme, salt)
  return corners
}

function getBoxCorners(box, project) {
  const z = box.z || 0
  const topZ = z + box.h
  return {
    p0: project(box.x, box.y, z),
    p1: project(box.x + box.w, box.y, z),
    p2: project(box.x + box.w, box.y + box.d, z),
    p3: project(box.x, box.y + box.d, z),
    t0: project(box.x, box.y, topZ),
    t1: project(box.x + box.w, box.y, topZ),
    t2: project(box.x + box.w, box.y + box.d, topZ),
    t3: project(box.x, box.y + box.d, topZ),
  }
}

function drawWindows(ctx, face, building, viewport, night, timeHours, salt) {
  const [topLeft, topRight, bottomRight, bottomLeft] = face
  const maxCols = viewport.scale > 0.3 ? (building.style === 'rowhouse' ? 5 : 11) : building.style === 'rowhouse' ? 4 : 7
  const maxRows = viewport.scale > 0.3 ? (building.style === 'shop' ? 7 : 15) : building.style === 'shop' ? 5 : 8
  const cols = clamp(Math.floor(screenDistance(topLeft, topRight) / 15), 2, maxCols)
  const rows = clamp(Math.floor(screenDistance(topLeft, bottomLeft) / 18), 2, maxRows)
  const rng = makeRng(`${building.windowSeed}:${salt}`)
  const windowColor = night ? '#ffe68a' : 'rgba(235, 250, 255, 0.76)'
  const darkWindow = night ? 'rgba(55, 67, 79, 0.62)' : 'rgba(67, 91, 112, 0.2)'
  const frameColor = night ? 'rgba(255, 236, 153, 0.25)' : 'rgba(255, 255, 255, 0.45)'

  if (building.material === 'glass') {
    drawCurtainWall(ctx, face, building, viewport, night, timeHours, salt)
    return
  }

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      if ((row + col + salt) % 7 === 0 && rows > 5) continue
      const u = (col + 0.34) / cols
      const v = (row + 0.28) / rows
      if (building.style === 'shop' && v > 0.78) continue
      const p = bilinear(topLeft, topRight, bottomRight, bottomLeft, u, v)
      const glow = night && (rng() > 0.52 || (timeHours > 18 && timeHours < 23 && rng() > 0.34))
      const w = Math.max(2.2, 7.5 * viewport.scale)
      const h = Math.max(2.4, 9.5 * viewport.scale)
      ctx.fillStyle = frameColor
      roundRect(ctx, p.x - w * 0.58, p.y - h * 0.56, w * 1.16, h * 1.12, Math.max(1, 1.8 * viewport.scale))
      ctx.fill()
      ctx.fillStyle = glow ? windowColor : darkWindow
      roundRect(ctx, p.x - w / 2, p.y - h / 2, w, h, Math.max(1, 1.5 * viewport.scale))
      ctx.fill()
      if (!night && rng() > 0.7) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.48)'
        ctx.lineWidth = Math.max(0.6, 1 * viewport.scale)
        pathThrough(ctx, [
          { x: p.x - w * 0.25, y: p.y - h * 0.32 },
          { x: p.x + w * 0.22, y: p.y - h * 0.05 },
        ])
        ctx.stroke()
      }
    }
  }
}

function drawCurtainWall(ctx, face, building, viewport, night, timeHours, salt) {
  const [topLeft, topRight, bottomRight, bottomLeft] = face
  const cols = clamp(Math.floor(screenDistance(topLeft, topRight) / 16), 3, viewport.scale > 0.28 ? 12 : 7)
  const rows = clamp(Math.floor(screenDistance(topLeft, bottomLeft) / 18), 4, viewport.scale > 0.28 ? 18 : 9)
  const rng = makeRng(`${building.windowSeed}:glass:${salt}`)
  ctx.save()
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const u0 = col / cols + 0.03
      const u1 = (col + 1) / cols - 0.03
      const v0 = row / rows + 0.04
      const v1 = (row + 1) / rows - 0.04
      const panel = [
        bilinear(topLeft, topRight, bottomRight, bottomLeft, u0, v0),
        bilinear(topLeft, topRight, bottomRight, bottomLeft, u1, v0),
        bilinear(topLeft, topRight, bottomRight, bottomLeft, u1, v1),
        bilinear(topLeft, topRight, bottomRight, bottomLeft, u0, v1),
      ]
      const lit = night && (rng() > 0.48 || (timeHours > 18 && rng() > 0.35))
      ctx.fillStyle = lit
        ? 'rgba(255, 230, 132, 0.78)'
        : row % 2 === 0
          ? 'rgba(146, 213, 235, 0.5)'
          : 'rgba(61, 129, 166, 0.42)'
      polygon(ctx, panel)
      ctx.fill()
    }
  }
  ctx.strokeStyle = night ? 'rgba(244, 250, 255, 0.18)' : 'rgba(255, 255, 255, 0.42)'
  ctx.lineWidth = Math.max(0.6, 1 * viewport.scale)
  for (let i = 1; i < cols; i += 1) {
    const u = i / cols
    pathThrough(ctx, [
      bilinear(topLeft, topRight, bottomRight, bottomLeft, u, 0.04),
      bilinear(topLeft, topRight, bottomRight, bottomLeft, u, 0.96),
    ])
    ctx.stroke()
  }
  for (let i = 1; i < rows; i += 2) {
    const v = i / rows
    pathThrough(ctx, [
      bilinear(topLeft, topRight, bottomRight, bottomLeft, 0.04, v),
      bilinear(topLeft, topRight, bottomRight, bottomLeft, 0.96, v),
    ])
    ctx.stroke()
  }
  ctx.restore()
}

function drawFacadeTexture(ctx, face, building, viewport, salt) {
  const [topLeft, topRight, bottomRight, bottomLeft] = face
  const rng = makeRng(`${building.windowSeed}:texture:${salt}`)
  ctx.save()
  ctx.lineWidth = Math.max(0.5, 0.8 * viewport.scale)

  if (building.material === 'brick') {
    ctx.strokeStyle = 'rgba(112, 61, 54, 0.22)'
    const rows = clamp(Math.floor(screenDistance(topLeft, bottomLeft) / 9), 4, 18)
    for (let row = 1; row < rows; row += 1) {
      const v = row / rows
      pathThrough(ctx, [
        bilinear(topLeft, topRight, bottomRight, bottomLeft, 0.04, v),
        bilinear(topLeft, topRight, bottomRight, bottomLeft, 0.96, v),
      ])
      ctx.stroke()
    }
    ctx.strokeStyle = 'rgba(92, 53, 48, 0.12)'
    for (let i = 0; i < 24; i += 1) {
      const u = rng.range(0.08, 0.92)
      const v = rng.range(0.08, 0.94)
      const p = bilinear(topLeft, topRight, bottomRight, bottomLeft, u, v)
      ctx.beginPath()
      ctx.moveTo(p.x - 2 * viewport.scale, p.y)
      ctx.lineTo(p.x + 2 * viewport.scale, p.y)
      ctx.stroke()
    }
  }

  if (building.material === 'tile' || building.material === 'concrete') {
    ctx.strokeStyle = building.material === 'tile' ? 'rgba(255,255,255,0.18)' : 'rgba(45,55,64,0.12)'
    const cols = 4 + (building.facadeRhythm % 3)
    const rows = 5 + (salt % 4)
    for (let i = 1; i < cols; i += 1) {
      const u = i / cols
      pathThrough(ctx, [
        bilinear(topLeft, topRight, bottomRight, bottomLeft, u, 0.06),
        bilinear(topLeft, topRight, bottomRight, bottomLeft, u, 0.96),
      ])
      ctx.stroke()
    }
    for (let i = 1; i < rows; i += 1) {
      const v = i / rows
      pathThrough(ctx, [
        bilinear(topLeft, topRight, bottomRight, bottomLeft, 0.05, v),
        bilinear(topLeft, topRight, bottomRight, bottomLeft, 0.95, v),
      ])
      ctx.stroke()
    }
  }

  if (building.material === 'stucco' || building.material === 'painted') {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)'
    for (let i = 0; i < 16; i += 1) {
      const p = bilinear(
        topLeft,
        topRight,
        bottomRight,
        bottomLeft,
        rng.range(0.08, 0.92),
        rng.range(0.08, 0.94),
      )
      ctx.beginPath()
      ctx.arc(p.x, p.y, Math.max(0.7, rng.range(1.2, 2.4) * viewport.scale), 0, TAU)
      ctx.fill()
    }
  }
  ctx.restore()
}

function drawFacadeTrim(ctx, face, building, viewport, salt) {
  if (building.trim === 'none') return
  const [topLeft, topRight, bottomRight, bottomLeft] = face
  ctx.save()
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.24)'
  ctx.lineWidth = Math.max(0.7, 1.2 * viewport.scale)
  if (building.trim === 'bands' || building.trim === 'cornice') {
    const bands = building.trim === 'cornice' ? [0.12, 0.88] : [0.22, 0.44, 0.66, 0.86]
    bands.forEach((v) => {
      const a = bilinear(topLeft, topRight, bottomRight, bottomLeft, 0.05, v)
      const b = bilinear(topLeft, topRight, bottomRight, bottomLeft, 0.95, v)
      pathThrough(ctx, [a, b])
      ctx.stroke()
    })
  }
  if (building.trim === 'vertical') {
    const count = 3 + (salt % 3)
    for (let i = 1; i < count; i += 1) {
      const u = i / count
      const a = bilinear(topLeft, topRight, bottomRight, bottomLeft, u, 0.08)
      const b = bilinear(topLeft, topRight, bottomRight, bottomLeft, u, 0.94)
      pathThrough(ctx, [a, b])
      ctx.stroke()
    }
  }
  ctx.restore()
}

function drawFacadeLife(ctx, face, building, viewport, theme, salt) {
  if (building.material === 'glass') return
  const [topLeft, topRight, bottomRight, bottomLeft] = face
  const rng = makeRng(`${building.windowSeed}:life:${salt}`)
  const cols = clamp(Math.floor(screenDistance(topLeft, topRight) / 19), 2, viewport.scale > 0.3 ? 8 : 5)
  const rows = clamp(Math.floor(screenDistance(topLeft, bottomLeft) / 26), 2, viewport.scale > 0.3 ? 11 : 6)

  ctx.save()
  if (building.balconies) {
    ctx.strokeStyle = theme.night > 0.5 ? 'rgba(235,242,250,0.48)' : 'rgba(60, 72, 78, 0.34)'
    ctx.fillStyle = theme.night > 0.5 ? 'rgba(160, 172, 184, 0.35)' : 'rgba(245, 248, 240, 0.56)'
    ctx.lineWidth = Math.max(0.8, 1.3 * viewport.scale)
    for (let row = 1; row < rows; row += 2) {
      for (let col = 0; col < cols; col += 1) {
        if ((row + col + salt) % 3 === 0) continue
        const u = (col + 0.5) / cols
        const v = (row + 0.4) / rows
        if (v > 0.88) continue
        const center = bilinear(topLeft, topRight, bottomRight, bottomLeft, u, v)
        const w = Math.max(5, 15 * viewport.scale)
        const h = Math.max(2, 5 * viewport.scale)
        roundRect(ctx, center.x - w / 2, center.y + h * 0.1, w, h, 1.5)
        ctx.fill()
        ctx.stroke()
        if (rng() > 0.68) {
          ctx.strokeStyle = rng.pick(['#ff8787', '#74c0fc', '#ffd43b', '#f8f9fa'])
          pathThrough(ctx, [
            { x: center.x - w * 0.35, y: center.y + h * 0.95 },
            { x: center.x + w * 0.35, y: center.y + h * 0.95 },
          ])
          ctx.stroke()
          ctx.strokeStyle = theme.night > 0.5 ? 'rgba(235,242,250,0.48)' : 'rgba(60, 72, 78, 0.34)'
        }
      }
    }
  }

  ctx.fillStyle = theme.night > 0.5 ? '#8d99a6' : '#d0d6d8'
  ctx.strokeStyle = 'rgba(48, 59, 66, 0.22)'
  ctx.lineWidth = Math.max(0.6, 1 * viewport.scale)
  const acCount = viewport.scale > 0.3 ? Math.min(8, rows) : Math.min(3, rows)
  for (let i = 0; i < acCount; i += 1) {
    if (rng() < 0.45) continue
    const u = rng.range(0.16, 0.84)
    const v = rng.range(0.16, 0.76)
    const p = bilinear(topLeft, topRight, bottomRight, bottomLeft, u, v)
    const w = Math.max(2.5, 6 * viewport.scale)
    const h = Math.max(1.8, 4 * viewport.scale)
    roundRect(ctx, p.x - w / 2, p.y + h * 0.2, w, h, 1)
    ctx.fill()
    ctx.stroke()
  }

  if (building.fireEscape && rows > 4 && viewport.scale > 0.24) {
    ctx.strokeStyle = theme.night > 0.5 ? 'rgba(218, 226, 235, 0.5)' : 'rgba(44, 52, 58, 0.42)'
    ctx.lineWidth = Math.max(0.8, 1.4 * viewport.scale)
    const sideU = salt % 2 === 0 ? 0.16 : 0.84
    let previous = null
    for (let row = 1; row < rows - 1; row += 1) {
      const p = bilinear(topLeft, topRight, bottomRight, bottomLeft, sideU, row / rows)
      const landingW = Math.max(5, 12 * viewport.scale)
      pathThrough(ctx, [
        { x: p.x - landingW / 2, y: p.y },
        { x: p.x + landingW / 2, y: p.y },
      ])
      ctx.stroke()
      if (previous) {
        pathThrough(ctx, [previous, p])
        ctx.stroke()
      }
      previous = p
    }
  }
  ctx.restore()
}

function drawParapet(ctx, corners, building, viewport, theme) {
  const roof = [corners.t0, corners.t1, corners.t2, corners.t3]
  ctx.save()
  ctx.strokeStyle = theme.night > 0.5 ? 'rgba(230, 235, 242, 0.35)' : 'rgba(51, 61, 66, 0.28)'
  ctx.lineWidth = Math.max(1, 2.2 * viewport.scale)
  polygon(ctx, roof)
  ctx.stroke()
  if (building.style === 'tower' || building.trim === 'cornice') {
    ctx.strokeStyle = shade(building.accent, theme.night > 0.5 ? -26 : -4)
    ctx.lineWidth = Math.max(1.5, 4 * viewport.scale)
    pathThrough(ctx, [corners.t0, corners.t1, corners.t2, corners.t3, corners.t0])
    ctx.stroke()
  }
  ctx.restore()
}

function drawRooftopClutter(ctx, corners, building, viewport, theme, salt) {
  const roof = [corners.t0, corners.t1, corners.t2, corners.t3]
  const rng = makeRng(`${building.windowSeed}:roof:${salt}`)
  const count = viewport.scale > 0.28 ? building.roofClutter || 3 : Math.min(3, building.roofClutter || 3)
  ctx.save()
  for (let i = 0; i < count; i += 1) {
    const p = bilinear(roof[0], roof[1], roof[2], roof[3], rng.range(0.18, 0.82), rng.range(0.18, 0.78))
    const w = Math.max(4, rng.range(8, 18) * viewport.scale)
    const h = Math.max(3, rng.range(6, 13) * viewport.scale)
    const kind = rng.pick(['hvac', 'vent', 'pipe'])
    if (kind === 'pipe') {
      ctx.strokeStyle = theme.night > 0.5 ? '#cfd8e3' : '#687782'
      ctx.lineWidth = Math.max(1, 2 * viewport.scale)
      pathThrough(ctx, [
        { x: p.x, y: p.y + h * 0.4 },
        { x: p.x, y: p.y - h * 0.9 },
      ])
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(p.x, p.y - h, Math.max(1.2, 2.3 * viewport.scale), 0, TAU)
      ctx.fillStyle = ctx.strokeStyle
      ctx.fill()
    } else {
      ctx.fillStyle = kind === 'hvac' ? (theme.night > 0.5 ? '#7d8795' : '#d7dedf') : '#9aa6ad'
      ctx.strokeStyle = 'rgba(41, 50, 57, 0.28)'
      roundRect(ctx, p.x - w / 2, p.y - h / 2, w, h, 1.5)
      ctx.fill()
      ctx.stroke()
      if (kind === 'hvac') {
        ctx.strokeStyle = 'rgba(66, 78, 86, 0.35)'
        ctx.lineWidth = Math.max(0.6, 1 * viewport.scale)
        pathThrough(ctx, [
          { x: p.x - w * 0.3, y: p.y },
          { x: p.x + w * 0.3, y: p.y },
        ])
        ctx.stroke()
      }
    }
  }
  ctx.restore()
}

function drawStorefront(ctx, corners, building, viewport, theme) {
  const face = [corners.t1, corners.t2, corners.p2, corners.p1]
  const signA = bilinear(face[0], face[1], face[2], face[3], 0.16, 0.72)
  const signB = bilinear(face[0], face[1], face[2], face[3], 0.84, 0.72)
  const door = bilinear(face[0], face[1], face[2], face[3], 0.5, 0.89)
  ctx.save()
  ctx.strokeStyle = shade(building.signColor, theme.night > 0.5 ? -18 : -4)
  ctx.lineWidth = Math.max(4, 9 * viewport.scale)
  pathThrough(ctx, [signA, signB])
  ctx.stroke()

  for (let i = 0; i < 5; i += 1) {
    const p = bilinear(face[0], face[1], face[2], face[3], 0.18 + i * 0.16, 0.79)
    ctx.fillStyle = i % 2 === 0 ? '#fff4c2' : '#e8590c'
    ctx.beginPath()
    ctx.arc(p.x, p.y, Math.max(1.5, 4 * viewport.scale), 0, TAU)
    ctx.fill()
  }

  ctx.fillStyle = theme.night > 0.5 ? 'rgba(255, 232, 140, 0.58)' : 'rgba(55, 86, 105, 0.38)'
  roundRect(ctx, door.x - 7 * viewport.scale, door.y - 11 * viewport.scale, 14 * viewport.scale, 18 * viewport.scale, 2)
  ctx.fill()
  ctx.restore()
}

function drawRoofFeature(ctx, box, corners, building, project, viewport, theme) {
  if (building.roof === 'garden') drawRoofGarden(ctx, corners, viewport, theme)
  if (building.roof === 'antenna') drawAntenna(ctx, box, project, viewport, theme)
  if (building.roof === 'water') drawWaterTank(ctx, corners, viewport, theme)
  if (building.roof === 'gable') drawGabledRoof(ctx, box, corners, building, project, viewport, theme)
  if (building.roof === 'solar') drawSolarPanels(ctx, corners, viewport, theme)
  if (building.roof === 'billboard') drawBillboard(ctx, corners, building, viewport, theme)
  if (building.roof === 'helipad') drawHelipad(ctx, corners, viewport, theme)
}

function drawRoofGarden(ctx, corners, viewport, theme) {
  const roof = [corners.t0, corners.t1, corners.t2, corners.t3]
  const center = bilinear(roof[0], roof[1], roof[2], roof[3], 0.5, 0.5)
  ctx.fillStyle = shade('#5fbf6b', theme.night > 0.5 ? -22 : 0)
  ctx.beginPath()
  ctx.ellipse(center.x, center.y, 20 * viewport.scale, 11 * viewport.scale, -0.2, 0, TAU)
  ctx.fill()
  ctx.fillStyle = shade('#2f9e44', theme.night > 0.5 ? -24 : 0)
  for (let i = 0; i < 4; i += 1) {
    const p = bilinear(roof[0], roof[1], roof[2], roof[3], 0.26 + i * 0.16, 0.34 + (i % 2) * 0.24)
    ctx.beginPath()
    ctx.arc(p.x, p.y, Math.max(1.5, 4 * viewport.scale), 0, TAU)
    ctx.fill()
  }
}

function drawAntenna(ctx, box, project, viewport, theme) {
  const z = (box.z || 0) + box.h
  const base = project(box.x + box.w * 0.52, box.y + box.d * 0.45, z)
  const top = project(box.x + box.w * 0.52, box.y + box.d * 0.45, z + 48)
  ctx.strokeStyle = theme.night > 0.5 ? '#d7e0ec' : '#54616f'
  ctx.lineWidth = Math.max(1, 2 * viewport.scale)
  pathThrough(ctx, [base, top])
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(top.x, top.y, Math.max(1.8, 3 * viewport.scale), 0, TAU)
  ctx.fillStyle = '#ff6b6b'
  ctx.fill()
}

function drawWaterTank(ctx, corners, viewport, theme) {
  const roof = [corners.t0, corners.t1, corners.t2, corners.t3]
  const center = bilinear(roof[0], roof[1], roof[2], roof[3], 0.5, 0.5)
  ctx.fillStyle = theme.night > 0.5 ? '#8795a8' : '#a8c3d9'
  ctx.strokeStyle = 'rgba(37, 45, 53, 0.26)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.ellipse(center.x, center.y, 13 * viewport.scale, 7 * viewport.scale, 0, 0, TAU)
  ctx.fill()
  ctx.stroke()
  ctx.strokeStyle = 'rgba(37, 45, 53, 0.42)'
  for (let i = -1; i <= 1; i += 2) {
    pathThrough(ctx, [
      { x: center.x + i * 7 * viewport.scale, y: center.y + 4 * viewport.scale },
      { x: center.x + i * 10 * viewport.scale, y: center.y + 14 * viewport.scale },
    ])
    ctx.stroke()
  }
}

function drawGabledRoof(ctx, box, corners, building, project, viewport, theme) {
  const z = (box.z || 0) + box.h
  const roofHeight = Math.max(18, Math.min(54, box.h * 0.18))
  const ridgeA = project(box.x + box.w * 0.5, box.y, z + roofHeight)
  const ridgeB = project(box.x + box.w * 0.5, box.y + box.d, z + roofHeight)
  ctx.strokeStyle = 'rgba(56, 46, 42, 0.35)'
  ctx.lineWidth = Math.max(1, 1.2 * viewport.scale)
  drawFace(ctx, [corners.t0, ridgeA, ridgeB, corners.t3], shade(building.accent, theme.night > 0.5 ? -20 : 0))
  drawFace(ctx, [ridgeA, corners.t1, corners.t2, ridgeB], shade(building.accent, theme.night > 0.5 ? -30 : -12))
}

function drawSolarPanels(ctx, corners, viewport, theme) {
  const roof = [corners.t0, corners.t1, corners.t2, corners.t3]
  ctx.save()
  ctx.fillStyle = theme.night > 0.5 ? '#24364f' : '#264b7f'
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.36)'
  ctx.lineWidth = Math.max(0.8, 1 * viewport.scale)
  for (let row = 0; row < 2; row += 1) {
    for (let col = 0; col < 3; col += 1) {
      const u = 0.25 + col * 0.18
      const v = 0.34 + row * 0.18
      const panel = [
        bilinear(roof[0], roof[1], roof[2], roof[3], u, v),
        bilinear(roof[0], roof[1], roof[2], roof[3], u + 0.12, v),
        bilinear(roof[0], roof[1], roof[2], roof[3], u + 0.12, v + 0.1),
        bilinear(roof[0], roof[1], roof[2], roof[3], u, v + 0.1),
      ]
      polygon(ctx, panel)
      ctx.fill()
      ctx.stroke()
    }
  }
  ctx.restore()
}

function drawBillboard(ctx, corners, building, viewport, theme) {
  const roof = [corners.t0, corners.t1, corners.t2, corners.t3]
  const base = bilinear(roof[0], roof[1], roof[2], roof[3], 0.55, 0.38)
  const w = Math.max(13, 34 * viewport.scale)
  const h = Math.max(8, 20 * viewport.scale)
  ctx.save()
  ctx.strokeStyle = theme.night > 0.5 ? '#d8dee9' : '#45545f'
  ctx.lineWidth = Math.max(1, 2 * viewport.scale)
  pathThrough(ctx, [
    { x: base.x - w * 0.32, y: base.y + h * 0.4 },
    { x: base.x - w * 0.32, y: base.y + h * 1.05 },
  ])
  ctx.stroke()
  pathThrough(ctx, [
    { x: base.x + w * 0.32, y: base.y + h * 0.4 },
    { x: base.x + w * 0.32, y: base.y + h * 1.05 },
  ])
  ctx.stroke()
  ctx.fillStyle = shade(building.signColor, theme.night > 0.5 ? -14 : 0)
  roundRect(ctx, base.x - w / 2, base.y - h / 2, w, h, 3)
  ctx.fill()
  ctx.fillStyle = 'rgba(255, 255, 255, 0.68)'
  ctx.fillRect(base.x - w * 0.34, base.y - h * 0.08, w * 0.68, Math.max(1, 2 * viewport.scale))
  ctx.restore()
}

function drawHelipad(ctx, corners, viewport, theme) {
  const roof = [corners.t0, corners.t1, corners.t2, corners.t3]
  const center = bilinear(roof[0], roof[1], roof[2], roof[3], 0.5, 0.5)
  const r = Math.max(8, 19 * viewport.scale)
  ctx.save()
  ctx.strokeStyle = theme.night > 0.5 ? 'rgba(255,255,255,0.64)' : 'rgba(34, 44, 52, 0.42)'
  ctx.lineWidth = Math.max(1, 2.2 * viewport.scale)
  ctx.beginPath()
  ctx.ellipse(center.x, center.y, r, r * 0.56, -0.02, 0, TAU)
  ctx.stroke()
  ctx.font = `700 ${Math.max(8, 14 * viewport.scale)}px Inter, system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = ctx.strokeStyle
  ctx.fillText('H', center.x, center.y)
  ctx.restore()
}

function drawCivicRoof(ctx, box, corners, building, project, viewport, theme) {
  if (building.roof === 'gable') {
    drawGabledRoof(ctx, box, corners, building, project, viewport, theme)
    return
  }
  const roof = [corners.t0, corners.t1, corners.t2, corners.t3]
  const center = bilinear(roof[0], roof[1], roof[2], roof[3], 0.5, 0.48)
  ctx.save()
  ctx.fillStyle = shade(building.accent, theme.night > 0.5 ? -20 : 6)
  ctx.strokeStyle = 'rgba(56, 46, 42, 0.32)'
  ctx.lineWidth = Math.max(1, 1.2 * viewport.scale)
  ctx.beginPath()
  ctx.ellipse(center.x, center.y - 9 * viewport.scale, 24 * viewport.scale, 14 * viewport.scale, 0, Math.PI, TAU)
  ctx.lineTo(center.x + 24 * viewport.scale, center.y + 4 * viewport.scale)
  ctx.lineTo(center.x - 24 * viewport.scale, center.y + 4 * viewport.scale)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  ctx.restore()
}

function drawStreetLamp(ctx, lamp, project, viewport, theme, weather) {
  const base = project(lamp.x, lamp.y, 0)
  const top = project(lamp.x, lamp.y, 54)
  ctx.save()
  ctx.strokeStyle = theme.night > 0.5 ? '#c9d5dc' : '#53636a'
  ctx.lineWidth = Math.max(1.1, 4 * viewport.scale)
  pathThrough(ctx, [base, top])
  ctx.stroke()
  ctx.fillStyle = theme.night > 0.28 || weather !== 'sunny' ? '#ffe66d' : '#fff3bf'
  ctx.beginPath()
  ctx.arc(top.x, top.y, Math.max(2.2, 5 * viewport.scale), 0, TAU)
  ctx.fill()
  ctx.restore()
}

function drawTrafficLight(ctx, light, project, viewport, theme, timeHours) {
  const base = project(light.x, light.y, 0)
  const top = project(light.x, light.y, 42)
  const phase = (timeHours * 6 + light.phase * 10) % 20
  const green = phase < 10
  const size = Math.max(3.2, 7 * viewport.scale)
  ctx.save()
  ctx.strokeStyle = theme.night > 0.5 ? '#d2d9e2' : '#42505a'
  ctx.lineWidth = Math.max(1.1, 3 * viewport.scale)
  pathThrough(ctx, [base, top])
  ctx.stroke()
  ctx.fillStyle = '#263238'
  roundRect(ctx, top.x - size * 0.6, top.y - size * 1.6, size * 1.2, size * 2.1, size * 0.22)
  ctx.fill()
  ctx.fillStyle = green ? '#35d66b' : '#49545f'
  ctx.beginPath()
  ctx.arc(top.x, top.y - size * 0.95, size * 0.33, 0, TAU)
  ctx.fill()
  ctx.fillStyle = green ? '#49545f' : '#ff5b57'
  ctx.beginPath()
  ctx.arc(top.x, top.y - size * 0.25, size * 0.33, 0, TAU)
  ctx.fill()
  ctx.restore()
}

function drawCar(ctx, car, project, viewport, theme, weather) {
  const info = car.info
  const x = info.x + info.normalX * car.laneOffset
  const y = info.y + info.normalY * car.laneOffset
  const p = project(x, y, 8)
  const f = project(x + info.tangentX * 25, y + info.tangentY * 25, 8)
  const angle = Math.atan2(f.y - p.y, f.x - p.x)
  const scale = viewport.scale * car.size
  const length = Math.max(8, 34 * scale)
  const width = Math.max(5, 17 * scale)

  ctx.save()
  ctx.translate(p.x, p.y)
  ctx.rotate(angle)
  ctx.fillStyle = weather === 'rain' ? 'rgba(20, 34, 45, 0.18)' : 'rgba(26, 35, 45, 0.14)'
  ctx.fillRect(-length * 0.48, width * 0.28, length * 0.96, width * 0.35)
  ctx.fillStyle = shade(car.color, theme.night > 0.5 ? -14 : 0)
  roundRect(ctx, -length / 2, -width / 2, length, width, Math.max(2, 5 * scale))
  ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.58)'
  roundRect(ctx, -length * 0.08, -width * 0.42, length * 0.28, width * 0.84, Math.max(1.5, 3 * scale))
  ctx.fill()
  ctx.fillStyle = '#202830'
  ctx.fillRect(-length * 0.34, width * 0.4, length * 0.18, Math.max(1.5, 3 * scale))
  ctx.fillRect(length * 0.18, width * 0.4, length * 0.18, Math.max(1.5, 3 * scale))
  if (theme.night > 0.34 || weather === 'rain') {
    ctx.fillStyle = '#fff3bf'
    ctx.beginPath()
    ctx.arc(length * 0.52, -width * 0.22, Math.max(1.4, 2.2 * scale), 0, TAU)
    ctx.arc(length * 0.52, width * 0.22, Math.max(1.4, 2.2 * scale), 0, TAU)
    ctx.fill()
  }
  ctx.restore()
}

function drawPerson(ctx, person, project, viewport, theme, elapsedSeconds) {
  const info = person.info
  const x = info.x + info.normalX * person.offset
  const y = info.y + info.normalY * person.offset
  const base = project(x, y, 2)
  const head = project(x, y, 22)
  const scale = viewport.scale
  const phase = Math.sin(elapsedSeconds * person.speed * 0.35 + person.stride)

  ctx.save()
  ctx.strokeStyle = shade(person.color, theme.night > 0.5 ? -12 : 0)
  ctx.lineWidth = Math.max(1, 3.2 * scale)
  pathThrough(ctx, [head, base])
  ctx.stroke()
  const leg = Math.max(2, 7 * scale)
  ctx.beginPath()
  ctx.moveTo(base.x, base.y)
  ctx.lineTo(base.x - leg * phase, base.y + leg * 0.4)
  ctx.moveTo(base.x, base.y)
  ctx.lineTo(base.x + leg * phase, base.y + leg * 0.4)
  ctx.stroke()
  ctx.fillStyle = '#f4b183'
  ctx.beginPath()
  ctx.arc(head.x, head.y - Math.max(2, 4 * scale), Math.max(2, 5 * scale), 0, TAU)
  ctx.fill()
  ctx.restore()
}

function drawNightOverlay(ctx, width, height, theme, weather) {
  const weatherDim = weather === 'rain' ? 0.13 : weather === 'snow' ? 0.05 : 0
  const alpha = clamp(theme.night * 0.44 + weatherDim, 0, 0.58)
  if (alpha <= 0.01) return
  ctx.save()
  ctx.fillStyle = `rgba(20, 28, 54, ${alpha})`
  ctx.fillRect(0, 0, width, height)
  ctx.restore()
}

function drawLampGlows(ctx, lamps, project, viewport, theme, weather) {
  const glow = clamp(theme.night * 0.9 + (weather === 'rain' ? 0.45 : weather === 'snow' ? 0.25 : 0), 0, 1)
  if (glow <= 0.05) return
  ctx.save()
  ctx.globalCompositeOperation = 'screen'
  lamps.forEach((lamp, index) => {
    if (index % 2 !== 0 && glow < 0.5) return
    const top = project(lamp.x, lamp.y, 52)
    const radius = Math.max(10, 34 * viewport.scale)
    const gradient = ctx.createRadialGradient(top.x, top.y, 0, top.x, top.y, radius)
    gradient.addColorStop(0, `rgba(255, 233, 132, ${0.48 * glow})`)
    gradient.addColorStop(1, 'rgba(255, 233, 132, 0)')
    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.arc(top.x, top.y, radius, 0, TAU)
    ctx.fill()
  })
  ctx.restore()
}

function drawWeather(ctx, width, height, weather, elapsedSeconds, theme) {
  if (weather === 'sunny') return
  ctx.save()
  if (weather === 'rain') {
    ctx.strokeStyle = theme.night > 0.5 ? 'rgba(190, 224, 255, 0.45)' : 'rgba(63, 108, 138, 0.36)'
    ctx.lineWidth = 1.2
    const count = Math.floor((width * height) / 4600)
    for (let i = 0; i < count; i += 1) {
      const seed = pseudo(i * 9.137)
      const x = (seed * width * 1.25 + elapsedSeconds * 210 + i * 19) % (width + 160) - 80
      const y = (pseudo(i * 3.41) * height + elapsedSeconds * 420 + i * 11) % (height + 120) - 60
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x - 10, y + 26)
      ctx.stroke()
    }
  }

  if (weather === 'snow') {
    ctx.fillStyle = theme.night > 0.5 ? 'rgba(245, 250, 255, 0.82)' : 'rgba(255, 255, 255, 0.92)'
    const count = Math.floor((width * height) / 6200)
    for (let i = 0; i < count; i += 1) {
      const seed = pseudo(i * 7.217)
      const x = (seed * width + Math.sin(elapsedSeconds * 0.6 + i) * 28 + i * 31) % (width + 80) - 40
      const y = (pseudo(i * 2.817) * height + elapsedSeconds * 42 + i * 17) % (height + 80) - 40
      const r = 1.2 + pseudo(i * 5.51) * 2.4
      ctx.beginPath()
      ctx.arc(x, y, r, 0, TAU)
      ctx.fill()
    }
  }
  ctx.restore()
}

function getTheme(timeHours, weather) {
  const sun = clamp(Math.sin(((timeHours - 6) / 12) * Math.PI), 0, 1)
  const night = 1 - sun
  const weatherDim = weather === 'rain' ? 0.12 : weather === 'snow' ? 0.03 : 0
  return {
    sun,
    night: clamp(night + weatherDim, 0, 1),
  }
}

function worldStroke(value, viewport) {
  return Math.max(0.5, value * viewport.scale * 0.52)
}

function strokeSmoothProjectedPath(ctx, points, project) {
  strokeSmoothWorldPath(ctx, points, project, undefined)
}

function strokeSmoothWorldPath(ctx, points, project, z) {
  if (points.length < 2) return
  const projected = points.map((point) => project(point.x, point.y, z ?? point.z ?? 0))
  ctx.beginPath()
  ctx.moveTo(projected[0].x, projected[0].y)
  if (projected.length === 2) {
    ctx.lineTo(projected[1].x, projected[1].y)
  } else {
    for (let i = 1; i < projected.length - 1; i += 1) {
      const current = projected[i]
      const next = projected[i + 1]
      const mid = {
        x: (current.x + next.x) / 2,
        y: (current.y + next.y) / 2,
      }
      ctx.quadraticCurveTo(current.x, current.y, mid.x, mid.y)
    }
    const last = projected[projected.length - 1]
    ctx.lineTo(last.x, last.y)
  }
  ctx.stroke()
}

function pathThrough(ctx, points) {
  if (points.length < 2) return
  ctx.beginPath()
  ctx.moveTo(points[0].x, points[0].y)
  for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y)
}

function polygon(ctx, points) {
  ctx.beginPath()
  ctx.moveTo(points[0].x, points[0].y)
  for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y)
  ctx.closePath()
}

function drawFace(ctx, points, fillStyle) {
  ctx.fillStyle = fillStyle
  polygon(ctx, points)
  ctx.fill()
  ctx.stroke()
}

function drawTriangle(ctx, points, fillStyle) {
  ctx.fillStyle = fillStyle
  polygon(ctx, points)
  ctx.fill()
  ctx.stroke()
}

function drawScreenTriangle(ctx, x, y, width, height) {
  ctx.beginPath()
  ctx.moveTo(x, y - height * 0.45)
  ctx.lineTo(x - width * 0.5, y + height * 0.55)
  ctx.lineTo(x + width * 0.5, y + height * 0.55)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
}

function drawBlob(ctx, x, y, radius, circles) {
  circles.forEach(([dx, dy, scale]) => {
    ctx.beginPath()
    ctx.arc(x + dx * radius, y + dy * radius, radius * scale, 0, TAU)
    ctx.fill()
    ctx.stroke()
  })
}

function roundRect(ctx, x, y, w, h, radius) {
  const r = Math.min(radius, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function pathLength(points) {
  let total = 0
  for (let i = 1; i < points.length; i += 1) {
    total += distance(points[i - 1].x, points[i - 1].y, points[i].x, points[i].y)
  }
  return total
}

function offsetPath(points, side, offset) {
  const total = pathLength(points)
  const shifted = []
  const steps = Math.max(8, Math.ceil(total / 70))
  for (let i = 0; i <= steps; i += 1) {
    const info = samplePath(points, (total * i) / steps, false)
    shifted.push({
      x: info.x + info.normalX * side * offset,
      y: info.y + info.normalY * side * offset,
    })
  }
  return shifted
}

function samplePath(points, distanceAlong, loop = true) {
  const total = pathLength(points)
  let target = loop ? ((distanceAlong % total) + total) % total : clamp(distanceAlong, 0, total)
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1]
    const b = points[i]
    const segmentLength = distance(a.x, a.y, b.x, b.y)
    if (target <= segmentLength) {
      const t = segmentLength === 0 ? 0 : target / segmentLength
      const x = lerp(a.x, b.x, t)
      const y = lerp(a.y, b.y, t)
      const tangentX = segmentLength === 0 ? 1 : (b.x - a.x) / segmentLength
      const tangentY = segmentLength === 0 ? 0 : (b.y - a.y) / segmentLength
      return { x, y, tangentX, tangentY, normalX: -tangentY, normalY: tangentX }
    }
    target -= segmentLength
  }
  const last = points[points.length - 1]
  return { x: last.x, y: last.y, tangentX: 1, tangentY: 0, normalX: 0, normalY: 1 }
}

function distanceToPolyline(point, points) {
  let best = Infinity
  for (let i = 1; i < points.length; i += 1) {
    best = Math.min(best, pointToSegmentDistance(point, points[i - 1], points[i]))
  }
  return best
}

function pointToSegmentDistance(point, a, b) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared === 0) return distance(point.x, point.y, a.x, a.y)
  const t = clamp(((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared, 0, 1)
  return distance(point.x, point.y, a.x + dx * t, a.y + dy * t)
}

function nearestDistance(point, items) {
  return items.reduce((best, item) => Math.min(best, distance(point.x, point.y, item.x, item.y) - item.radius), Infinity)
}

function screenDistance(a, b) {
  return distance(a.x, a.y, b.x, b.y)
}

function interpolatePoint(a, b, t) {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) }
}

function bilinear(a, b, c, d, u, v) {
  const top = interpolatePoint(a, b, u)
  const bottom = interpolatePoint(d, c, u)
  return interpolatePoint(top, bottom, v)
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function lerp(a, b, t) {
  return a + (b - a) * t
}

function smoothstep(t) {
  return t * t * (3 - 2 * t)
}

function distance(x1, y1, x2, y2) {
  return Math.hypot(x2 - x1, y2 - y1)
}

function pseudo(value) {
  return fract(Math.sin(value * 12.9898) * 43758.5453)
}

function fract(value) {
  return value - Math.floor(value)
}

function shade(hex, amount) {
  const rgb = hexToRgb(hex)
  const shifted = rgb.map((channel) => clamp(Math.round(channel + amount * 2.55), 0, 255))
  return `rgb(${shifted[0]}, ${shifted[1]}, ${shifted[2]})`
}

function hexToRgb(hex) {
  const rgbMatch = String(hex).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
  if (rgbMatch) return [Number(rgbMatch[1]), Number(rgbMatch[2]), Number(rgbMatch[3])]
  const clean = hex.replace('#', '')
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ]
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
