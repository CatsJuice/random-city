import * as THREE from 'three'
import { Batch, ribbon } from './geometry.js'
import { GROUND, ROAD_WIDTH, STREET_WIDTH, edgePoint } from './world.js'

export function buildStreets(world, parent, uniforms) {
  const batch = new Batch()
  const asphalt = '#626e6b',
    curb = '#dddcc6',
    ink = '#466463',
    paint = '#edebd9',
    steel = '#b5654f'
  for (const path of world.footpaths)
    batch.add(
      ribbon(
        [path.a, path.b].map((p) => ({ ...p, y: GROUND + 0.025 })),
        path.width
      ),
      '#c5c6ab'
    )
  for (const edge of world.edges) {
    const start = world.nodes[edge.a],
      end = world.nodes[edge.b]
    const rotation = -Math.atan2(end.z - start.z, end.x - start.x)
    const samples = edge.bridge ? 90 : 2
    const pts = Array.from({ length: samples + 1 }, (_, i) => edgePoint(world, edge, i / samples))
    batch.add(
      ribbon(
        pts.map((p) => ({ ...p, y: p.y - 0.02 })),
        STREET_WIDTH
      ),
      curb
    )
    batch.add(
      ribbon(
        pts.map((p) => ({ ...p, y: p.y + 0.014 })),
        ROAD_WIDTH
      ),
      asphalt
    )
    for (const side of [-1, 1]) {
      const sidePts = Array.from({ length: samples + 1 }, (_, i) =>
        edgePoint(world, edge, i / samples, side * (ROAD_WIDTH / 2 + 0.04))
      )
      batch.add(
        ribbon(
          sidePts.map((p) => ({ ...p, y: p.y + 0.03 })),
          0.08
        ),
        paint
      )
    }
    for (let d = 2.7; d < edge.length - 2.5; d += 2.35) {
      const a = edgePoint(world, edge, d / edge.length),
        b = edgePoint(world, edge, (d + 0.95) / edge.length)
      batch.add(
        ribbon(
          [a, b].map((p) => ({ ...p, y: p.y + 0.035 })),
          0.055
        ),
        '#e7deb1'
      )
    }
    if (edge.bridge) {
      for (const side of [-1, 1]) {
        const rail = Array.from({ length: 70 }, (_, i) => ({
          ...edgePoint(world, edge, i / 69, side * (STREET_WIDTH / 2 - 0.08))
        }))
        batch.tube(
          rail.map((p) => ({ ...p, y: p.y + 0.75 })),
          0.055,
          ink,
          90
        )
        batch.tube(
          rail.map((p) => ({ ...p, y: p.y + 0.32 })),
          0.034,
          ink,
          90
        )
        for (let i = 0; i < rail.length; i += 3)
          batch.cylinder(rail[i].x, rail[i].y + 0.35, rail[i].z, 0.045, 0.055, 0.76, ink, 6)
      }
      if (edge.elevated) {
        for (const side of [-1, 1]) {
          const arch = Array.from({ length: 50 }, (_, i) => {
            const t = 0.15 + (i / 49) * 0.7,
              p = edgePoint(world, edge, t, side * 1.72)
            return { ...p, y: p.y + 5.8 * Math.sin((i / 49) * Math.PI) }
          })
          batch.tube(arch, 0.19, steel, 70)
          for (let i = 3; i < 47; i += 4) {
            const t = 0.15 + (i / 49) * 0.7,
              p = edgePoint(world, edge, t, side * 1.72)
            batch.cylinder(
              p.x,
              (p.y + arch[i].y) / 2,
              p.z,
              0.035,
              0.035,
              arch[i].y - p.y,
              '#eddcc3',
              6
            )
          }
        }
        for (const t of [0.17, 0.83]) {
          const p = edgePoint(world, edge, t)
          batch.box(p.x, p.y / 2 - 0.1, p.z, 0.65, p.y + 0.2, 3.6, '#d2c4a7', rotation)
        }
      } else {
        // Stone spandrels with actual arch openings under the roadway.
        for (const side of [-1, 1]) {
          const shape = new THREE.Shape(),
            length = edge.length
          shape.moveTo(0, -0.45)
          shape.lineTo(length, -0.45)
          for (let i = 90; i >= 0; i--)
            shape.lineTo((length * i) / 90, edgePoint(world, edge, i / 90).y - 0.08)
          shape.closePath()
          for (const center of [length * 0.3, length * 0.5, length * 0.7]) {
            const radius = Math.min(length * 0.061, edge.rise - 0.45),
              arch = new THREE.Path()
            arch.moveTo(center - radius, -0.44)
            arch.lineTo(center + radius, -0.44)
            arch.lineTo(center + radius, 0.6)
            arch.absarc(center, 0.6, radius, 0, Math.PI, false)
            arch.lineTo(center - radius, -0.44)
            shape.holes.push(arch)
          }
          const geo = new THREE.ExtrudeGeometry(shape, {
            depth: 0.38,
            bevelEnabled: false,
            curveSegments: 14
          })
          const a = world.nodes[edge.a]
          geo
            .translate(0, 0, side * 1.78 - 0.19)
            .rotateY(rotation)
            .translate(a.x, 0, a.z)
          batch.add(geo, '#c9b894')
        }
      }
    }
  }
  for (const node of world.nodes) {
    batch.box(node.x, GROUND + 0.102, node.z, STREET_WIDTH, 0.07, STREET_WIDTH, curb)
    batch.box(node.x, GROUND + 0.135, node.z, ROAD_WIDTH, 0.02, ROAD_WIDTH, asphalt)
    for (const eid of node.edges) {
      const edge = world.edges[eid],
        t = edge.a === node.id ? 2.0 / edge.length : 1 - 2.0 / edge.length
      for (let s = -1.05; s <= 1.06; s += 0.35) {
        const p = edgePoint(world, edge, t, s)
        batch.box(
          p.x,
          p.y + 0.035,
          p.z,
          0.66,
          0.015,
          0.19,
          paint,
          -Math.atan2(
            world.nodes[edge.b].z - world.nodes[edge.a].z,
            world.nodes[edge.b].x - world.nodes[edge.a].x
          )
        )
      }
    }
  }
  const lamps = []
  for (const p of world.lamps) {
    batch.cylinder(p.x, p.y + 0.95, p.z, 0.045, 0.075, 1.9, ink, 7)
    batch.box(p.x + 0.16, p.y + 1.85, p.z, 0.42, 0.06, 0.08, ink)
    batch.box(p.x + 0.3, p.y + 1.81, p.z, 0.27, 0.09, 0.16, ink)
    lamps.push({ x: p.x + 0.3, y: p.y + 1.75, z: p.z, groundY: p.y + 0.04 })
  }
  const signals = []
  for (const node of world.signals)
    for (const side of [-1, 1]) {
      const x = node.x + side * 1.83,
        z = node.z + side * 1.83,
        y = GROUND + 1.7
      batch.cylinder(x, GROUND + 0.85, z, 0.045, 0.065, 1.7, ink, 6)
      batch.box(x, y, z, 0.19, 0.52, 0.17, ink)
      signals.push({ x, y, z: z + 0.105, axis: side === 1 ? 'x' : 'z' })
    }
  batch.finish(parent, uniforms)
  return { lamps, signals }
}
