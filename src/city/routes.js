import PF from 'pathfinding'
import { CatmullRomCurve3, Vector3 } from 'three'
import { distance, lerp, isLand, heightAt, segmentDistance, boxesOverlap, GROUND } from './world.js'
import { waterDistance } from './geography.js'

function navigationGrid(world, step, passable) {
  const bound = world.size / 2 - 3,
    count = Math.floor((bound * 2) / step) + 1
  const grid = new PF.Grid(count, count),
    cells = []
  for (let z = 0; z < count; z++)
    for (let x = 0; x < count; x++) {
      const p = { x: -bound + x * step, z: -bound + z * step, col: x, row: z }
      const valid = passable(p)
      grid.setWalkableAt(x, z, valid)
      if (valid) cells.push(p)
    }
  const nearest = (p) =>
    cells.reduce((best, c) => (!best || distance(p, c) < distance(p, best) ? c : best), null)
  const finder = new PF.AStarFinder({ allowDiagonal: true, dontCrossCorners: true })
  return {
    cells,
    nearest,
    path(a, b) {
      if (!a || !b) return []
      return finder
        .findPath(a.col, a.row, b.col, b.row, grid.clone())
        .map(([x, z]) => ({ x: -bound + x * step, z: -bound + z * step }))
    }
  }
}

function subdivide(points, spacing = 0.4) {
  const result = [points[0]]
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i],
      count = Math.ceil(distance(a, b) / spacing)
    for (let j = 1; j <= count; j++)
      result.push({ x: lerp(a.x, b.x, j / count), z: lerp(a.z, b.z, j / count) })
  }
  return result
}

export function generateTrails(world, rng, reserved) {
  if (!world.peaks.length) return []
  const dry = (p) =>
    isLand(world, p.x, p.z, 1.2) &&
    !reserved.some((b) => boxesOverlap({ ...p, w: 1.8, d: 1.8 }, b, 0.3))
  const nav = navigationGrid(world, 1.8, (p) => dry(p) && heightAt(world, p.x, p.z) < GROUND + 0.1)
  const trails = []
  for (const peak of world.peaks) {
    const streets = [...world.nodes].sort((a, b) => distance(a, peak) - distance(b, peak))
    let result = null
    for (const street of streets.slice(0, 6)) {
      const startAngle = Math.atan2((street.z - peak.z) / peak.d, (street.x - peak.x) / peak.w)
      const direction = rng() > 0.5 ? 1 : -1
      const climb = Array.from({ length: 220 }, (_, i) => {
        const t = i / 219,
          angle = startAngle + direction * t * Math.PI * 2.15,
          r = 1.08 - t * 0.75
        return {
          x: peak.x + Math.cos(angle) * peak.w * r,
          z: peak.z + Math.sin(angle) * peak.d * r
        }
      })
      if (!climb.every(dry)) continue
      const approach = nav.path(nav.nearest(street), nav.nearest(climb[0]))
      if (approach.length < 1 || approach.length > world.size) continue
      const points = subdivide([street, ...approach, ...climb])
      if (!points.every(dry)) continue
      result = {
        width: 1.05,
        peak: { x: peak.x, z: peak.z },
        points: points.map((p) => ({ ...p, y: heightAt(world, p.x, p.z) + 0.1 }))
      }
      result.lookout = { ...result.points.at(-1) }
      const lookout = result.lookout
      lookout.deckY =
        Math.max(
          ...[-1, 1].flatMap((sx) =>
            [-1, 1].map((sz) => heightAt(world, lookout.x + sx * 1.45, lookout.z + sz * 1.45))
          )
        ) + 0.18
      let remaining = 0
      const rise = lookout.deckY + 0.1 - result.points.at(-1).y
      for (let i = result.points.length - 1; i >= 0 && remaining < 5; i--) {
        if (i < result.points.length - 1)
          remaining += distance(result.points[i], result.points[i + 1])
        const p = result.points[i]
        p.raised = Math.max(0, 1 - remaining / 5) * rise
        p.y += p.raised
      }
      result.length = result.points.reduce(
        (s, p, i, all) => s + (i ? distance(p, all[i - 1]) : 0),
        0
      )
      break
    }
    if (result) trails.push(result)
  }
  return trails
}

export function nearTrail(world, p, margin) {
  return world.trails.some(
    (t) =>
      distance(t.lookout, p) < 2.4 + margin ||
      t.points.some((q, i, all) => i && segmentDistance(p, all[i - 1], q) < margin + t.width / 2)
  )
}

export function navigableWater(world, p, clearance = 2.3) {
  return (
    Math.abs(p.x) < world.size / 2 - 3 &&
    Math.abs(p.z) < world.size / 2 - 3 &&
    waterDistance(world.geography, p.x, p.z) < -clearance &&
    !world.bridges.some(
      (e) => segmentDistance(p, world.nodes[e.a], world.nodes[e.b]) < clearance + 2.3
    ) &&
    (!world.dock || segmentDistance(p, world.dock.a, world.dock.b) > clearance + 1)
  )
}

export function generateBoatRoutes(world, rng) {
  if (!world.boats.length) return []
  const nav = navigationGrid(world, 2.5, (p) => navigableWater(world, p, 3.5))
  const boats = []
  for (const boat of world.boats) {
    const start = nav.nearest(boat)
    if (!start || distance(start, boat) > 12) continue
    const options = nav.cells.filter((p) => distance(p, start) > 9 && distance(p, start) < 50)
    let route
    for (let attempt = 0; attempt < 10 && !route; attempt++) {
      const b = options[Math.floor(rng() * options.length)],
        c = options[Math.floor(rng() * options.length)]
      if (!b || !c || distance(b, c) < 9) continue
      const legs = [nav.path(start, b), nav.path(b, c), nav.path(c, start)]
      if (legs.some((leg) => leg.length < 2)) continue
      const vertices = legs.flatMap((leg) => leg.slice(0, -1))
      const curve = new CatmullRomCurve3(
        vertices.map((p) => new Vector3(p.x, 0, p.z)),
        true,
        'centripetal'
      )
      const smooth = curve
        .getSpacedPoints(Math.max(100, Math.ceil(curve.getLength() / 0.4)))
        .map((p) => ({ x: p.x, z: p.z }))
      const points = smooth.every((p) => navigableWater(world, p))
        ? smooth
        : subdivide([...vertices, vertices[0]])
      if (!points.every((p) => navigableWater(world, p))) continue
      const lengths = [0]
      points.forEach((p, i) => {
        if (i) lengths.push(lengths[i - 1] + distance(p, points[i - 1]))
      })
      route = { points, lengths, length: lengths.at(-1) }
    }
    if (route)
      boats.push({
        ...boat,
        x: route.points[0].x,
        z: route.points[0].z,
        route,
        speed: 0.65 + rng() * 0.5,
        phase: rng()
      })
  }
  return boats
}

export function boatPoint(boat, seconds) {
  const { points, lengths, length } = boat.route
  const d = (((seconds * boat.speed + boat.phase * length) % length) + length) % length
  let lo = 0,
    hi = lengths.length - 1
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1
    if (lengths[mid] <= d) lo = mid
    else hi = mid
  }
  const a = points[lo],
    b = points[hi],
    t = (d - lengths[lo]) / (lengths[hi] - lengths[lo] || 1)
  return { x: lerp(a.x, b.x, t), z: lerp(a.z, b.z, t), yaw: Math.atan2(b.x - a.x, b.z - a.z) }
}
