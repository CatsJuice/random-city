import { generateGeography, waterDistance, terrainHeight, sampleShore } from './geography.js'
import { generateTrails, generateBoatRoutes, nearTrail } from './routes.js'

export const WORLD_SIZE = 120
export const MAP_SIZES = [120, 180, 240]
export const normalizeSize = (size) =>
  MAP_SIZES.includes(Number(size)) ? Number(size) : WORLD_SIZE
export const GROUND = 0.8
export const ROAD_WIDTH = 2.8
export const SIDEWALK = 0.75
export const STREET_WIDTH = ROAD_WIDTH + SIDEWALK * 2

export function random(seed) {
  let h = 2166136261
  for (const c of String(seed)) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return () => {
    h += 0x6d2b79f5
    let t = Math.imul(h ^ (h >>> 15), 1 | h)
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
export const lerp = (a, b, t) => a + (b - a) * t
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
export const smooth = (t) => {
  t = clamp(t, 0, 1)
  return t * t * (3 - 2 * t)
}
export const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z)
export function isLand(world, x, z, margin = 0) {
  return (
    Math.abs(x) <= world.size / 2 - margin &&
    Math.abs(z) <= world.size / 2 - margin &&
    waterDistance(world.geography, x, z) > margin
  )
}
export function heightAt(world, x, z) {
  return terrainHeight(world.geography, x, z)
}
export function segmentDistance(p, a, b) {
  const len2 = (b.x - a.x) ** 2 + (b.z - a.z) ** 2
  const t = clamp(((p.x - a.x) * (b.x - a.x) + (p.z - a.z) * (b.z - a.z)) / len2, 0, 1)
  return distance(p, { x: lerp(a.x, b.x, t), z: lerp(a.z, b.z, t) })
}
export function edgeHeight(edge, t) {
  if (!edge.bridge) return GROUND + 0.12
  return GROUND + 0.12 + edge.rise * Math.min(smooth(t / 0.31), smooth((1 - t) / 0.31))
}
export function edgePoint(world, edge, t, lateral = 0) {
  const a = world.nodes[edge.a],
    b = world.nodes[edge.b]
  const dx = (b.x - a.x) / edge.length,
    dz = (b.z - a.z) / edge.length
  return {
    x: lerp(a.x, b.x, t) - dz * lateral,
    z: lerp(a.z, b.z, t) + dx * lateral,
    y: edgeHeight(edge, t),
    yaw: Math.atan2(dx, dz)
  }
}
export function boxCorners(b, margin = 0) {
  return [-1, 1].flatMap((i) =>
    [-1, 1].map((j) => ({ x: b.x + i * (b.w / 2 + margin), z: b.z + j * (b.d / 2 + margin) }))
  )
}
export function boxesOverlap(a, b, margin = 0.2) {
  return (
    Math.abs(a.x - b.x) < (a.w + b.w) / 2 + margin && Math.abs(a.z - b.z) < (a.d + b.d) / 2 + margin
  )
}

export function segmentIntersectsBox(a, b, box, padding = 0) {
  let enter = 0,
    leave = 1
  for (const [axis, size] of [
    ['x', 'w'],
    ['z', 'd']
  ]) {
    const lo = box[axis] - box[size] / 2 - padding
    const hi = box[axis] + box[size] / 2 + padding
    const delta = b[axis] - a[axis]
    if (Math.abs(delta) < 1e-9) {
      if (a[axis] < lo || a[axis] > hi) return false
    } else {
      const t0 = (lo - a[axis]) / delta,
        t1 = (hi - a[axis]) / delta
      enter = Math.max(enter, Math.min(t0, t1))
      leave = Math.min(leave, Math.max(t0, t1))
      if (enter > leave) return false
    }
  }
  return true
}

function shuffled(items, rng) {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

function flatLand(world, x, z, margin = 0) {
  return isLand(world, x, z, margin) && heightAt(world, x, z) < GROUND + 0.025
}

function planRoads(world, rng) {
  const axis = () => {
    const values = []
    for (let p = -world.size / 2 + 11 + rng() * 5; p < world.size / 2 - 9; p += 12.5 + rng() * 6.5)
      values.push(p)
    return values
  }
  const cols = axis(),
    rows = axis(),
    nodes = [],
    candidates = []
  rows.forEach((z, r) =>
    cols.forEach((x, c) => {
      if (flatLand(world, x, z, STREET_WIDTH / 2 + 1.2))
        nodes.push({ id: nodes.length, x, z, r, c, edges: [] })
    })
  )
  function candidate(a, b, bridgeOnly = false) {
    const length = distance(a, b)
    if (length > (world.geography.islands.length ? 60 : 48)) return
    const points = Array.from({ length: Math.ceil(length / 0.55) + 1 }, (_, i) => {
      const t = i / Math.ceil(length / 0.55)
      return { x: lerp(a.x, b.x, t), z: lerp(a.z, b.z, t), t }
    })
    if (points.some((p) => heightAt(world, p.x, p.z) > GROUND + 0.025)) return
    const dry = points.every((p) => isLand(world, p.x, p.z, STREET_WIDTH / 2 + 0.45))
    const wet = points.filter((p) => !isLand(world, p.x, p.z))
    if (bridgeOnly && !wet.length) return
    if (
      !dry &&
      (wet.length < 2 ||
        (wet.at(-1).t - wet[0].t) * length < 2 ||
        !wet.some((p) => waterDistance(world.geography, p.x, p.z) < -0.6))
    )
      return
    if (
      !dry &&
      (!wet.length ||
        (wet.at(-1).t - wet[0].t) * length > (world.geography.islands.length ? 40 : 28) ||
        wet[0].t * length < 3 ||
        (1 - wet.at(-1).t) * length < 3)
    )
      return
    candidates.push({
      a: a.id,
      b: b.id,
      length,
      axis: Math.abs(b.x - a.x) < Math.abs(b.z - a.z) ? 'z' : 'x',
      bridge: !dry,
      weight: length * (0.8 + rng() * 0.7) * (dry ? 1 : 3.2)
    })
  }
  for (const values of [rows, cols]) {
    const horizontal = values === rows
    for (let i = 0; i < values.length; i++) {
      const line = nodes
        .filter((n) => (horizontal ? n.r === i : n.c === i))
        .sort((a, b) => (horizontal ? a.x - b.x : a.z - b.z))
      for (let j = 1; j < line.length; j++) candidate(line[j - 1], line[j])
    }
  }
  for (let i = 0; i < nodes.length; i++)
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i],
        b = nodes[j]
      if (Math.abs(a.x - b.x) < 3 || Math.abs(a.z - b.z) < 3 || distance(a, b) > 55) continue
      if (
        nodes.some((n) => n !== a && n !== b && segmentDistance(n, a, b) < STREET_WIDTH / 2 + 0.5)
      )
        continue
      candidate(a, b, true)
    }
  const parents = nodes.map((n) => n.id),
    find = (n) => (parents[n] === n ? n : (parents[n] = find(parents[n])))
  const selected = []
  const crosses = (e) =>
    selected.some((other) => {
      if ([e.a, e.b].some((id) => id === other.a || id === other.b)) return false
      const a = nodes[e.a],
        b = nodes[e.b],
        c = nodes[other.a],
        d = nodes[other.b]
      const rx = b.x - a.x,
        rz = b.z - a.z,
        sx = d.x - c.x,
        sz = d.z - c.z,
        det = rx * sz - rz * sx
      if (Math.abs(det) < 1e-9) return false
      const t = ((c.x - a.x) * sz - (c.z - a.z) * sx) / det,
        u = ((c.x - a.x) * rz - (c.z - a.z) * rx) / det
      return t > 0.001 && t < 0.999 && u > 0.001 && u < 0.999
    })
  candidates.sort((a, b) => a.weight - b.weight)
  for (const e of candidates) {
    if (find(e.a) !== find(e.b) && !crosses(e)) {
      parents[find(e.a)] = find(e.b)
      selected.push(e)
    }
  }
  const groups = new Map()
  nodes.forEach((n) => {
    const root = find(n.id)
    if (!groups.has(root)) groups.set(root, [])
    groups.get(root).push(n)
  })
  const active = [...groups.values()].sort((a, b) => b.length - a.length)[0] || []
  const ids = new Set(active.map((n) => n.id))
  let spareBridges = Math.floor(rng() * 3)
  const connectivity = 0.48 + rng() * 0.4
  for (const e of shuffled(candidates, rng)) {
    if (!ids.has(e.a) || !ids.has(e.b) || selected.includes(e) || crosses(e)) continue
    if (e.bridge) {
      if (spareBridges > 0 && rng() < 0.38) {
        selected.push(e)
        spareBridges--
      }
    } else if (rng() < connectivity) selected.push(e)
  }
  const mapping = new Map(active.map((n, i) => [n.id, i]))
  const edges = selected
    .filter((e) => ids.has(e.a) && ids.has(e.b))
    .map((e, id) => {
      const elevated = e.bridge && e.length > 20 && rng() > 0.4
      return {
        ...e,
        id,
        a: mapping.get(e.a),
        b: mapping.get(e.b),
        elevated,
        rise: elevated ? 3.5 + rng() * 1.2 : 1.9 + rng() * 0.5
      }
    })
  const result = active.map((n, id) => ({ ...n, id, edges: [] }))
  edges.forEach((e) => {
    result[e.a].edges.push(e.id)
    result[e.b].edges.push(e.id)
  })
  return { nodes: result, edges, cols, rows }
}

export function generateWorld(seed, density = 0.78, size = WORLD_SIZE) {
  size = normalizeSize(size)
  density = clamp(Number(density) || 0.78, 0.4, 1)
  const rng = random(seed),
    geography = generateGeography(rng, size)
  const world = {
    seed,
    size,
    density,
    geography,
    peaks: geography.peaks,
    nodes: [],
    edges: [],
    buildings: [],
    trees: [],
    rocks: [],
    lamps: [],
    signals: [],
    parks: [],
    fairground: null,
    lighthouse: null,
    dock: null,
    boats: [],
    trails: [],
    footpaths: []
  }
  let roads = planRoads(world, rng)
  const buildableRoadLength = (plan) =>
    plan.edges.reduce((total, e) => total + (e.bridge ? 0 : e.length), 0)
  for (
    let attempt = 0;
    attempt < 7 && roads.edges.filter((e) => !e.bridge).length < 12;
    attempt++
  ) {
    const alternative = planRoads(world, rng)
    if (buildableRoadLength(alternative) > buildableRoadLength(roads)) roads = alternative
  }
  world.nodes = roads.nodes
  world.edges = roads.edges
  if (!world.edges.length) throw new Error('No buildable street network for seed ' + seed)
  world.bridges = world.edges.filter((e) => e.bridge)
  const { cols, rows } = roads,
    blocks = []
  for (let r = 1; r < rows.length; r++)
    for (let c = 1; c < cols.length; c++) {
      const box = {
        x: (cols[c] + cols[c - 1]) / 2,
        z: (rows[r] + rows[r - 1]) / 2,
        w: cols[c] - cols[c - 1] - 5.6,
        d: rows[r] - rows[r - 1] - 5.6
      }
      if (
        !boxCorners(box, 0.3).every((p) => flatLand(world, p.x, p.z, 1.2)) ||
        !flatLand(world, box.x, box.z)
      )
        continue
      if (!world.nodes.some((n) => Math.hypot(n.x - box.x, n.z - box.z) < 15)) continue
      blocks.push(box)
    }
  const spaces = shuffled(
      blocks.filter((b) => b.w >= 8.5 && b.d >= 8.5),
      rng
    ),
    parkCount = Math.min(1 + Math.floor(rng() * 3), Math.floor(world.nodes.length / 10))
  world.parks = spaces.splice(0, parkCount)
  world.park = world.parks[0] || null
  if (spaces.length && world.nodes.length > 20 && rng() > 0.24) {
    const site = spaces.find((b) => b.w >= 9.4 && b.d >= 9.4)
    if (site) {
      world.fairground = { ...site, w: 9.3, d: 9.3 }
      spaces.splice(spaces.indexOf(site), 1)
    }
  }
  const reserved = [...world.parks, ...(world.fairground ? [world.fairground] : [])]
  world.shore = sampleShore(geography)
  const nearStreet = (p) =>
    [...world.edges]
      .filter((e) => !e.bridge)
      .map((e) => {
        const a = world.nodes[e.a],
          b = world.nodes[e.b],
          t = clamp(
            ((p.x - a.x) * (b.x - a.x) + (p.z - a.z) * (b.z - a.z)) / e.length ** 2,
            0.05,
            0.95
          )
        return { ...edgePoint(world, e, t), edge: e.id }
      })
      .sort((a, b) => distance(a, p) - distance(b, p))[0]
  function connection(p, width = 1.1) {
    const nearest = nearStreet(p)
    if (!nearest || distance(nearest, p) > 16) return null
    const samples = Array.from({ length: 30 }, (_, i) => ({
      x: lerp(nearest.x, p.x, i / 29),
      z: lerp(nearest.z, p.z, i / 29)
    }))
    if (!samples.every((s) => flatLand(world, s.x, s.z, width / 2 + 0.1))) return null
    return { a: nearest, b: p, width }
  }
  for (const site of reserved) {
    const options = [
      { x: site.x - site.w / 2, z: site.z },
      { x: site.x + site.w / 2, z: site.z },
      { x: site.x, z: site.z - site.d / 2 },
      { x: site.x, z: site.z + site.d / 2 }
    ]
    const path = options
      .map((p) => connection(p))
      .filter(Boolean)
      .sort((a, b) => distance(a.a, a.b) - distance(b.a, b.b))[0]
    if (path) world.footpaths.push(path)
  }
  for (const shore of shuffled(world.shore, rng)) {
    const site = { x: shore.x + shore.nx * 3.6, z: shore.z + shore.nz * 3.6, w: 5.4, d: 5.4 }
    if (
      !world.lighthouse &&
      (geography.coast || geography.islands.length) &&
      boxCorners(site).every((p) => flatLand(world, p.x, p.z, 0.2)) &&
      !reserved.some((b) => boxesOverlap(b, site, 1))
    ) {
      const path = connection(site, 1.2)
      if (path) {
        world.lighthouse = site
        reserved.push(site)
        world.footpaths.push(path)
      }
    }
    const a = { x: shore.x + shore.nx * 1.5, z: shore.z + shore.nz * 1.5 },
      b = { x: shore.x - shore.nx * 6, z: shore.z - shore.nz * 6 }
    if (
      !world.dock &&
      Math.abs(b.x) < size / 2 - 5 &&
      Math.abs(b.z) < size / 2 - 5 &&
      waterDistance(geography, b.x, b.z) < -3 &&
      !world.edges.some((e) => segmentDistance(b, world.nodes[e.a], world.nodes[e.b]) < 5)
    ) {
      const path = connection(a, 1.3)
      if (path) {
        world.dock = { a, b }
        world.footpaths.push(path)
      }
    }
    if (world.dock && (world.lighthouse || (!geography.coast && !geography.islands.length))) break
  }
  const shoreAccess = []
  for (const p of shuffled(world.shore, rng)) {
    const destination = { x: p.x + p.nx, z: p.z + p.nz }
    if (shoreAccess.some((q) => distance(q, destination) < 14)) continue
    const path = connection(destination)
    if (path && distance(path.a, path.b) < 10 && distance(path.a, path.b) > 2) {
      world.footpaths.push(path)
      shoreAccess.push(destination)
    }
    if (shoreAccess.length >= 7) break
  }
  const centers = shuffled(
    world.nodes.filter((n) => n.edges.length >= 2),
    rng
  )
    .filter((n) => flatLand(world, n.x, n.z, 5))
    .slice(0, 1 + Math.floor(rng() * 3))
  world.districts = (centers.length ? centers : [world.nodes[0]]).map((n) => ({
    x: n.x,
    z: n.z,
    radius: 16 + rng() * 13
  }))
  world.trails = generateTrails(world, random(`${seed}:trails`), reserved)
  for (const edge of shuffled(world.edges, rng)) {
    if (edge.bridge) continue
    const a = world.nodes[edge.a],
      b = world.nodes[edge.b]
    for (const side of [-1, 1])
      for (let along = 4.9; along < edge.length - 4; along += 4.65 + rng() * 0.5) {
        if (rng() > density && world.buildings.length >= 4) continue
        const width = 3.7 + rng() * 0.3,
          depth = 3.6 + rng() * 0.4,
          pos = edgePoint(
            world,
            edge,
            along / edge.length,
            side * (STREET_WIDTH / 2 + depth / 2 + 0.65)
          )
        const lot = {
          x: pos.x,
          z: pos.z,
          w: edge.axis === 'x' ? width : depth,
          d: edge.axis === 'x' ? depth : width
        }
        if (![...boxCorners(lot, 0.3), lot].every((p) => flatLand(world, p.x, p.z, 1.1))) continue
        if (
          world.buildings.some((other) => boxesOverlap(lot, other, 0.45)) ||
          reserved.some((other) => boxesOverlap(lot, other, 0.45))
        )
          continue
        if (
          world.edges.some((e) =>
            segmentIntersectsBox(world.nodes[e.a], world.nodes[e.b], lot, STREET_WIDTH / 2 + 0.3)
          )
        )
          continue
        if (
          world.footpaths.some((path) =>
            segmentIntersectsBox(path.a, path.b, lot, path.width / 2 + 0.3)
          )
        )
          continue
        if (
          world.trails.some((trail) =>
            trail.points.some(
              (p, i, all) =>
                i > 0 && segmentIntersectsBox(all[i - 1], p, lot, trail.width / 2 + 0.4)
            )
          )
        )
          continue
        const core = world.districts.some((d) => distance(d, lot) < d.radius),
          shop = core || rng() > 0.76
        const kind = core && rng() > 0.78 ? 'tower' : shop ? 'commercial' : 'suburban'
        const pool =
            kind === 'tower'
              ? 'abcde'
              : kind === 'commercial'
                ? 'abcdefghijklmn'
                : 'abcdefghijklmnopqrstu',
          letter = pool[Math.floor(rng() * pool.length)]
        world.buildings.push({
          ...lot,
          id: world.buildings.length,
          edge: edge.id,
          side,
          kind,
          asset:
            kind === 'suburban'
              ? 'suburban/building-type-' + letter
              : kind === 'tower'
                ? 'commercial/building-skyscraper-' + letter
                : 'commercial/building-' + letter,
          yaw: Math.atan2(a.x - b.x, a.z - b.z) + (side === 1 ? Math.PI / 2 : -Math.PI / 2),
          frontage: width,
          depth,
          palette: Math.floor(rng() * 5),
          heightScale: kind === 'tower' ? 0.9 + rng() * 0.25 : 1
        })
      }
  }
  for (const edge of world.edges) {
    for (let d = 3; d < edge.length - 2; d += 6)
      for (const side of [-1, 1])
        world.lamps.push({
          ...edgePoint(world, edge, d / edge.length, side * (ROAD_WIDTH / 2 + 0.43)),
          edge: edge.id
        })
  }
  world.signals = world.nodes.filter((n) => n.edges.length > 2)
  const treeCount = Math.round((340 + Math.floor(rng() * 300)) * (size / 120) ** 2)
  for (let i = 0; i < 5500 * (size / 120) ** 2 && world.trees.length < treeCount; i++) {
    const x = -size / 2 + 4 + rng() * (size - 8),
      z = -size / 2 + 4 + rng() * (size - 8)
    if (!isLand(world, x, z, 1.3)) continue
    if (world.fairground && boxesOverlap({ x, z, w: 2, d: 2 }, world.fairground, 0.5)) continue
    if (world.lighthouse && boxesOverlap({ x, z, w: 2, d: 2 }, world.lighthouse, 0.5)) continue
    if (
      world.edges.some(
        (e) =>
          segmentDistance({ x, z }, world.nodes[e.a], world.nodes[e.b]) < STREET_WIDTH / 2 + 1.1
      )
    )
      continue
    if (world.footpaths.some((p) => segmentDistance({ x, z }, p.a, p.b) < p.width / 2 + 0.8))
      continue
    if (nearTrail(world, { x, z }, 1.3)) continue
    if (world.buildings.some((b) => boxesOverlap({ x, z, w: 1.6, d: 1.6 }, b, 0.7))) continue
    const park = world.parks.find((p) => boxesOverlap({ x, z, w: 0, d: 0 }, p, 0))
    if (
      park &&
      (Math.abs(x - park.x) < 1.25 || Math.abs(z - park.z) < 1.25 || distance({ x, z }, park) < 3.2)
    )
      continue
    const y = heightAt(world, x, z),
      mountain = y > 1.5
    if (y > 16 || (!mountain && !park && rng() > 0.42)) continue
    world.trees.push({
      x,
      z,
      y,
      h: (mountain ? 2.7 : 1.8) + rng() * 1.8,
      asset: (mountain
        ? ['tree_pineRoundA', 'tree_pineRoundC', 'tree_pineRoundE']
        : ['tree_oak', 'tree_detailed', 'tree_default'])[Math.floor(rng() * 3)],
      yaw: rng() * Math.PI * 2
    })
  }
  for (const p of world.shore) {
    if (
      rng() > 0.38 ||
      world.edges.some((e) => segmentDistance(p, world.nodes[e.a], world.nodes[e.b]) < 3.2)
    )
      continue
    world.rocks.push({
      x: p.x,
      z: p.z,
      y: 0.43,
      h: 0.45 + rng() * 0.55,
      maxWidth: 1.3 + rng() * 0.7,
      yaw: rng() * Math.PI * 2,
      asset: rng() > 0.5 ? 'stone_largeA' : 'stone_largeC'
    })
  }
  for (const peak of world.peaks)
    for (let i = 0; i < 12; i++) {
      const x = peak.x + (rng() - 0.5) * peak.w * 1.3,
        z = peak.z + (rng() - 0.5) * peak.d * 1.3,
        y = heightAt(world, x, z)
      if (isLand(world, x, z, 1) && y > 4 && !nearTrail(world, { x, z }, 2))
        world.rocks.push({
          x,
          z,
          y: y - 0.13,
          h: 0.7 + rng() * 1.5,
          maxWidth: 3 + rng() * 1.5,
          yaw: rng() * Math.PI * 2,
          asset: 'stone_largeC'
        })
    }
  const boatCount = Math.round(((2 + Math.floor(rng() * 5)) * size) / 120)
  for (let i = 0; i < 1000 && world.boats.length < boatCount; i++) {
    const x = -size / 2 + 8 + rng() * (size - 16),
      z = -size / 2 + 8 + rng() * (size - 16)
    if (
      waterDistance(geography, x, z) > -3 ||
      world.edges.some((e) => segmentDistance({ x, z }, world.nodes[e.a], world.nodes[e.b]) < 4)
    )
      continue
    if (world.boats.some((b) => distance({ x, z }, b) < 10)) continue
    world.boats.push({ x, z, scale: 0.6 + rng() * 0.45 })
  }
  world.boats = generateBoatRoutes(world, random(`${seed}:boats`))
  world.stats = {
    size,
    trails: world.trails.length,
    boats: world.boats.length,
    buildings: world.buildings.length,
    bridges: world.bridges.length,
    trees: world.trees.length,
    cars: Math.min(120, Math.max(12, world.edges.length)),
    people: Math.min(180, Math.max(24, world.edges.length * 2)),
    terrainName: geography.name
  }
  return world
}

export function createTraffic(world, count, pedestrian = false) {
  const rng = random(`${world.seed}:${pedestrian ? 'walk' : 'drive'}`)
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    edge: Math.floor(rng() * world.edges.length),
    t: rng(),
    direction: rng() > 0.5 ? 1 : -1,
    speed: pedestrian ? 0.45 + rng() * 0.2 : 1.7 + rng() * 0.8,
    variant: i % 5,
    walk: pedestrian,
    waiting: false
  }))
}
export function trafficPoint(world, agent) {
  const lane = agent.walk ? ROAD_WIDTH / 2 + SIDEWALK * 0.6 : ROAD_WIDTH * 0.24
  const p = edgePoint(world, world.edges[agent.edge], agent.t, -agent.direction * lane)
  return {
    ...p,
    y: p.y + (agent.walk ? 0.065 : 0.015),
    yaw: p.yaw + (agent.direction < 0 ? Math.PI : 0)
  }
}
export function advanceTraffic(world, agents, dt, seconds) {
  // One directed edge and a normalized distance make movement independent of frame rate.
  for (const agent of agents) {
    const edge = world.edges[agent.edge],
      node = world.nodes[agent.direction > 0 ? edge.b : edge.a]
    const remaining = (agent.direction > 0 ? 1 - agent.t : agent.t) * edge.length
    const green = (Math.floor(seconds / 8) % 2 === 0) === (edge.axis === 'x')
    const ahead =
      !agent.walk &&
      agents.some(
        (other) =>
          other !== agent &&
          other.edge === agent.edge &&
          other.direction === agent.direction &&
          (other.t - agent.t) * agent.direction > 0 &&
          (other.t - agent.t) * agent.direction * edge.length < 1.65
      )
    agent.waiting = (!agent.walk && !green && node.edges.length > 2 && remaining < 2.25) || ahead
    if (agent.waiting) continue
    agent.t += (agent.direction * agent.speed * dt) / edge.length
    if (agent.t >= 1 || agent.t <= 0) {
      const choices = node.edges.filter((id) => id !== edge.id)
      const next = choices[(agent.id + Math.floor(seconds * 0.23)) % choices.length] ?? edge.id
      const e = world.edges[next]
      agent.edge = next
      agent.direction = e.a === node.id ? 1 : -1
      agent.t = agent.direction > 0 ? 0.001 : 0.999
    }
  }
}
