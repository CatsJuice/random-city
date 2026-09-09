const TAU = Math.PI * 2
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x))
const pick = (rng, lo, hi) => lo + rng() * (hi - lo)
const names = ['海湾城镇', '曲流河谷', '湖畔街区', '岛屿聚落', '岬角海岸', '交汇河网']

function ellipse(rng, x, z, rx, rz) {
  return {
    x,
    z,
    rx,
    rz,
    angle: rng() * TAU,
    phase: rng() * TAU,
    irregularity: pick(rng, 0.04, 0.15)
  }
}

function ellipseDistance(shape, x, z) {
  const dx = x - shape.x,
    dz = z - shape.z,
    c = Math.cos(shape.angle),
    s = Math.sin(shape.angle)
  const u = (dx * c + dz * s) / shape.rx,
    v = (-dx * s + dz * c) / shape.rz
  const a = Math.atan2(v, u)
  return (
    (Math.hypot(u, v) - 1 - shape.irregularity * Math.sin(a * 3 + shape.phase)) *
    Math.min(shape.rx, shape.rz)
  )
}

export function generateGeography(rng, size = 120) {
  const kind = Math.floor(rng() * names.length)
  const g = { kind, name: names[kind], coast: null, islands: [], lakes: [], rivers: [], peaks: [] }
  if (kind === 0 || kind === 4) {
    g.coast = {
      angle: rng() * TAU,
      level: pick(rng, kind === 4 ? 8 : 20, kind === 4 ? 22 : 37),
      amplitude: pick(rng, 5, 15),
      frequency: pick(rng, 0.035, 0.07),
      phase: rng() * TAU
    }
  }
  if (kind === 3) {
    const count = 3 + Math.floor(rng() * 3),
      angle = rng() * TAU
    for (let i = 0; i < count; i++) {
      const a = angle + (i / count) * TAU + pick(rng, -0.2, 0.2),
        r = pick(rng, 23, 34)
      g.islands.push(
        ellipse(rng, Math.cos(a) * r, Math.sin(a) * r, pick(rng, 20, 28), pick(rng, 18, 26))
      )
    }
  }
  if (kind === 2 || ((kind === 0 || kind === 4) && rng() > 0.65)) {
    const count = kind === 2 ? 1 + Math.floor(rng() * 3) : 1
    for (let i = 0; i < count; i++)
      g.lakes.push(
        ellipse(rng, pick(rng, -32, 32), pick(rng, -32, 32), pick(rng, 10, 23), pick(rng, 8, 19))
      )
  }
  if (kind === 1 || kind === 5 || kind === 0 || (kind === 4 && rng() > 0.55)) {
    const angle = rng() * TAU
    g.rivers.push({
      angle,
      offset: pick(rng, -23, 23),
      amplitude: pick(rng, 6, 17),
      frequency: pick(rng, 0.035, 0.075),
      phase: rng() * TAU,
      width: pick(rng, 2.1, 4.4)
    })
    if (kind === 5 || (kind === 1 && rng() > 0.72)) {
      // Independently oriented channels intersect in the shared water field.
      g.rivers.push({
        angle: angle + pick(rng, 0.65, 1.45),
        offset: pick(rng, -18, 18),
        amplitude: pick(rng, 4, 11),
        frequency: pick(rng, 0.035, 0.07),
        phase: rng() * TAU,
        width: pick(rng, 1.8, 3.0)
      })
    }
  }
  const count = Math.floor(rng() * 6)
  for (let i = 0; i < count; i++) {
    for (let attempt = 0; attempt < 80; attempt++) {
      const x = pick(rng, -48, 48),
        z = pick(rng, -48, 48)
      if (waterDistance(g, x, z) < 8 || g.peaks.some((p) => Math.hypot(p.x - x, p.z - z) < 19))
        continue
      g.peaks.push({
        x,
        z,
        h: pick(rng, 9, 24),
        w: pick(rng, 10, 19),
        d: pick(rng, 10, 20),
        phase: rng() * TAU
      })
      break
    }
  }
  let landArea = 0
  for (let z = -57.5; z < 60; z += 5)
    for (let x = -57.5; x < 60; x += 5) if (waterDistance(g, x, z) > 0) landArea += 25
  const mountainArea = g.peaks.reduce((sum, p) => sum + Math.PI * p.w * p.d, 0)
  const scale = Math.min(1, Math.sqrt((landArea * 0.2) / (mountainArea || 1)))
  for (const p of g.peaks) {
    p.w *= scale
    p.d *= scale
  }
  const extent = size / 120
  g.size = size
  for (const shape of [...g.islands, ...g.lakes]) {
    for (const key of ['x', 'z', 'rx', 'rz']) shape[key] *= extent
  }
  for (const p of g.peaks) {
    for (const key of ['x', 'z', 'w', 'd']) p[key] *= extent
  }
  if (g.coast) {
    g.coast.level *= extent
    g.coast.amplitude *= extent
    g.coast.frequency /= extent
  }
  for (const river of g.rivers) {
    river.offset *= extent
    river.amplitude *= extent
    river.frequency /= extent
    river.width *= Math.sqrt(extent)
  }
  return g
}

// Positive is land. All renderers and placement constraints use this same field.
export function waterDistance(g, x, z) {
  let d = 1000
  if (g.islands.length) d = Math.max(...g.islands.map((s) => -ellipseDistance(s, x, z)))
  if (g.coast) {
    const c = g.coast,
      u = x * Math.cos(c.angle) + z * Math.sin(c.angle),
      v = -x * Math.sin(c.angle) + z * Math.cos(c.angle)
    d = Math.min(
      d,
      (c.level +
        c.amplitude * Math.sin(v * c.frequency + c.phase) +
        c.amplitude * 0.25 * Math.sin(v * c.frequency * 2.3) -
        u) /
        1.35
    )
  }
  for (const lake of g.lakes) d = Math.min(d, ellipseDistance(lake, x, z))
  for (const r of g.rivers) {
    const u = x * Math.cos(r.angle) + z * Math.sin(r.angle),
      v = -x * Math.sin(r.angle) + z * Math.cos(r.angle)
    const center =
      r.offset +
      r.amplitude * Math.sin(u * r.frequency + r.phase) +
      Math.sin(u * r.frequency * 2.2 - r.phase) * r.amplitude * 0.22
    const slope =
      r.amplitude * r.frequency * Math.cos(u * r.frequency + r.phase) +
      Math.cos(u * r.frequency * 2.2 - r.phase) * r.amplitude * 0.22 * r.frequency * 2.2
    d = Math.min(
      d,
      (Math.abs(v - center) - r.width * (1 + 0.16 * Math.sin(u * 0.09 + r.phase))) /
        Math.sqrt(1 + slope * slope)
    )
  }
  return d
}

export function terrainHeight(g, x, z) {
  let h = 0
  for (const p of g.peaks) {
    const r2 = ((x - p.x) / p.w) ** 2 + ((z - p.z) / p.d) ** 2
    if (r2 >= 1) continue
    const detail =
      1 + 0.13 * Math.sin(x * 0.63 + z * 0.34 + p.phase) + 0.08 * Math.cos(z * 0.61 - x * 0.27)
    h += p.h * (1 - r2) ** 2 * detail
  }
  return 0.8 + h * clamp((waterDistance(g, x, z) - 1.2) / 5, 0, 1)
}

export function sampleShore(g) {
  const points = []
  const step = 2.5
  const bound = (g.size || 120) / 2 - 3
  for (let z = -bound; z < bound; z += step)
    for (let x = -bound; x < bound; x += step) {
      const d = waterDistance(g, x, z)
      for (const [dx, dz] of [
        [step, 0],
        [0, step]
      ]) {
        const other = waterDistance(g, x + dx, z + dz)
        if (d > 0 === other > 0) continue
        const t = d / (d - other),
          px = x + dx * t,
          pz = z + dz * t
        const nx = waterDistance(g, px + 0.15, pz) - waterDistance(g, px - 0.15, pz)
        const nz = waterDistance(g, px, pz + 0.15) - waterDistance(g, px, pz - 0.15)
        const length = Math.hypot(nx, nz) || 1
        points.push({ x: px, z: pz, nx: nx / length, nz: nz / length })
      }
    }
  return points
}
