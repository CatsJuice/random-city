import test from 'node:test'
import assert from 'node:assert/strict'
import {
  generateWorld,
  boxCorners,
  boxesOverlap,
  isLand,
  edgePoint,
  edgeHeight,
  GROUND,
  STREET_WIDTH,
  segmentDistance,
  createTraffic,
  advanceTraffic,
  trafficPoint,
  segmentIntersectsBox,
  heightAt,
  normalizeSize
} from '../src/city/world.js'
import { boatPoint, navigableWater, nearTrail } from '../src/city/routes.js'

test('a seed reproduces the same world and different seeds vary it', () => {
  assert.deepEqual(generateWorld('harbor'), generateWorld('harbor'))
  assert.notDeepEqual(generateWorld('harbor'), generateWorld('mountain'))
})
test('low density still leaves constrained coastal towns inhabited', () => {
  const world = generateWorld('stress-151', 0.4)
  assert.ok(world.buildings.length >= 4)
})
test('board sizes expand actual city parcels without scaling street or building dimensions', () => {
  assert.equal(normalizeSize(0), 120)
  assert.equal(normalizeSize('240'), 240)
  assert.equal(normalizeSize(9999), 120)
  const small = generateWorld('SHIO-949156', 0.84, 120)
  for (const size of [180, 240]) {
    const large = generateWorld('SHIO-949156', 0.84, size)
    assert.equal(large.size, size)
    assert.ok(large.buildings.length > small.buildings.length * 2)
    assert.ok(large.nodes.some((p) => Math.abs(p.x) > 60 || Math.abs(p.z) > 60))
    assert.ok(large.buildings.every((p) => p.w < 4.1 && p.d < 4.1))
    assert.ok(large.lamps.length > small.lamps.length)
    assert.ok(large.stats.cars <= 120 && large.stats.people <= 180)
    assert.ok(large.buildings.every((b) => boxCorners(b).every((p) => isLand(large, p.x, p.z))))
  }
})
test('mountain trails connect streets, stay on dry terrain and keep vegetation and lots clear', () => {
  let count = 0
  for (const size of [120, 180, 240])
    for (const seed of ['SHIO-0', 'SHIO-2', 'SHIO-6', 'SHIO-18']) {
      const world = generateWorld(seed, 0.84, size)
      for (const trail of world.trails) {
        count++
        assert.ok(
          world.nodes.some(
            (n) => Math.hypot(n.x - trail.points[0].x, n.z - trail.points[0].z) < 0.01
          )
        )
        assert.ok(trail.lookout.y > GROUND + 3)
        assert.ok(trail.points.every((p) => isLand(world, p.x, p.z, 1.1)))
        assert.ok(
          trail.points.every(
            (p) => Math.abs(p.y - heightAt(world, p.x, p.z) - 0.1 - (p.raised || 0)) < 0.001
          )
        )
        assert.ok(Math.abs(trail.points.at(-1).y - trail.lookout.deckY - 0.1) < 0.001)
        assert.ok(
          world.buildings.every(
            (b) =>
              !trail.points.some(
                (p, i, all) => i && segmentIntersectsBox(all[i - 1], p, b, trail.width / 2)
              )
          )
        )
      }
      assert.ok(world.trees.every((t) => !nearTrail(world, t, 1.2)))
      assert.ok(world.bridges.every((e) => world.lamps.some((p) => p.edge === e.id)))
    }
  assert.ok(count >= 20)
})
test('boat routes stay in navigable water, move continuously and wrap without teleporting', () => {
  let boats = 0
  for (const size of [120, 180, 240])
    for (const seed of ['SHIO-0', 'SHIO-1', 'SHIO-2', 'SHIO-18']) {
      const world = generateWorld(seed, 0.84, size)
      for (const boat of world.boats) {
        boats++
        assert.ok(boat.route.length > 15)
        assert.ok(boat.route.points.every((p) => navigableWater(world, p)))
        for (let t = 0; t < 500; t += 2.3) {
          const p = boatPoint(boat, t),
            q = boatPoint(boat, t + 0.05)
          assert.ok(navigableWater(world, p, 2.25))
          assert.ok(Math.hypot(q.x - p.x, q.z - p.z) <= boat.speed * 0.051)
        }
        const loopTime = ((1 - boat.phase) * boat.route.length) / boat.speed
        const p = boatPoint(boat, loopTime - 0.01),
          q = boatPoint(boat, loopTime + 0.01)
        assert.ok(Math.hypot(p.x - q.x, p.z - q.z) < 0.04)
      }
    }
  assert.ok(boats >= 25)
})
test('a footpath crossing the middle of a lot is rejected even when all corners are clear', () => {
  const box = { x: 0, z: 0, w: 4, d: 4 }
  assert.ok(segmentIntersectsBox({ x: -5, z: 0 }, { x: 5, z: 0 }, box, 0.5))
  assert.ok(!segmentIntersectsBox({ x: -5, z: 3 }, { x: 5, z: 3 }, box, 0.5))
})
test('100 generated cities have connected streets, dry lots and actual river crossings', () => {
  for (let n = 0; n < 100; n++) {
    const world = generateWorld(`regression-${n}`, 0.4 + (n % 7) / 10)
    const visited = new Set([0]),
      queue = [0]
    while (queue.length) {
      const node = world.nodes[queue.pop()]
      for (const id of node.edges) {
        const e = world.edges[id],
          next = e.a === node.id ? e.b : e.a
        if (!visited.has(next)) {
          visited.add(next)
          queue.push(next)
        }
      }
    }
    assert.equal(visited.size, world.nodes.length)
    assert.ok(world.nodes.length >= 4)
    assert.ok(world.buildings.length >= 1)
    for (const e of world.edges) {
      assert.equal(edgeHeight(e, 0), GROUND + 0.12)
      assert.equal(edgeHeight(e, 1), GROUND + 0.12)
      const points = Array.from({ length: 101 }, (_, i) => edgePoint(world, e, i / 100))
      if (e.bridge) {
        assert.ok(points.some((p) => !isLand(world, p.x, p.z)))
        assert.ok(isLand(world, points[0].x, points[0].z))
        assert.ok(isLand(world, points.at(-1).x, points.at(-1).z))
      } else
        assert.ok(
          points.every((p) => isLand(world, p.x, p.z, STREET_WIDTH / 2)),
          `dry road ${n}/${e.id}`
        )
    }
    for (const b of world.buildings) {
      assert.ok(
        world.footpaths.every((path) => !segmentIntersectsBox(path.a, path.b, b, path.width / 2))
      )
      assert.ok(
        boxCorners(b).every((p) => isLand(world, p.x, p.z, 1)),
        `dry lot ${n}/${b.id}`
      )
      assert.ok(
        !world.buildings.some((c) => c !== b && boxesOverlap(b, c, 0)),
        `overlap ${n}/${b.id}`
      )
      assert.ok(
        world.edges.every((e) =>
          boxCorners(b).every(
            (p) => segmentDistance(p, world.nodes[e.a], world.nodes[e.b]) > STREET_WIDTH / 2
          )
        ),
        `street setback ${n}/${b.id}`
      )
    }
  }
})
test('seeds change geography and network structure, not only objects inside a fixed map', () => {
  const kinds = new Set(),
    bridgeCounts = new Set(),
    peakCounts = new Set(),
    coasts = new Set(),
    hillQuadrants = new Set(),
    nodeCounts = new Set(),
    masks = new Set(),
    parkPositions = new Set()
  let inland = 0,
    coastal = 0,
    diagonal = 0
  for (let i = 0; i < 100; i++) {
    const world = generateWorld('morphology-' + i, 0.84),
      g = world.geography
    kinds.add(g.kind)
    bridgeCounts.add(world.bridges.length)
    peakCounts.add(world.peaks.length)
    nodeCounts.add(world.nodes.length)
    if (g.coast) {
      coastal++
      coasts.add(Math.floor(g.coast.angle / (Math.PI / 2)))
    } else inland++
    for (const p of world.peaks) hillQuadrants.add((p.x > 0 ? 1 : 0) + (p.z > 0 ? 2 : 0))
    for (const p of world.parks)
      parkPositions.add(Math.round(p.x / 10) + ':' + Math.round(p.z / 10))
    for (const b of world.bridges) {
      const a = world.nodes[b.a],
        c = world.nodes[b.b]
      if (a.x !== c.x && a.z !== c.z) diagonal++
    }
    let mask = ''
    for (let z = -55; z <= 55; z += 5)
      for (let x = -55; x <= 55; x += 5) mask += isLand(world, x, z) ? '1' : '0'
    masks.add(mask)
  }
  assert.equal(kinds.size, 6)
  assert.equal(coasts.size, 4)
  assert.equal(hillQuadrants.size, 4)
  assert.ok(bridgeCounts.size >= 5 && bridgeCounts.has(0))
  assert.ok(peakCounts.size >= 5 && peakCounts.has(0))
  assert.ok(nodeCounts.size >= 15)
  assert.equal(masks.size, 100)
  assert.ok(parkPositions.size >= 20)
  assert.ok(inland > 20 && coastal > 20 && diagonal > 20)
})
test('vehicles and pedestrians traverse connected edges at the same elevation as roads', () => {
  const world = generateWorld('traffic'),
    cars = createTraffic(world, 42),
    people = createTraffic(world, 70, true)
  const before = cars.map((a) => a.edge + ':' + a.t)
  for (let step = 0; step < 7200; step++) {
    advanceTraffic(world, cars, 1 / 30, step / 30)
    advanceTraffic(world, people, 1 / 30, step / 30)
    for (const a of [...cars, ...people]) {
      assert.ok(a.t >= 0 && a.t <= 1)
      const p = trafficPoint(world, a)
      assert.ok(Number.isFinite(p.x + p.y + p.z))
      assert.ok(
        Math.abs(p.y - edgeHeight(world.edges[a.edge], a.t) - (a.walk ? 0.065 : 0.015)) < 1e-8
      )
    }
  }
  assert.ok(cars.some((a, i) => `${a.edge}:${a.t}` !== before[i]))
})
