import * as THREE from 'three'
import { Batch, ribbon } from './geometry.js'
import { GROUND, heightAt } from './world.js'
import { boatPoint } from './routes.js'
import { glowInstances, setInstance } from './lighting.js'

export function buildDetails(world, parent, uniforms) {
  const batch = new Batch(),
    moving = [],
    lamps = []
  const y = GROUND + 0.08
  const gardenLamp = (x, base, z, height = 1.25) => {
    batch.cylinder(x, base + height / 2, z, 0.045, 0.075, height, '#405b59', 6)
    batch.box(x, base + height, z, 0.24, 0.14, 0.24, '#e9d7ab')
    batch.box(x, base + height + 0.1, z, 0.34, 0.05, 0.34, '#456763')
    lamps.push({ x, y: base + height, z, groundY: base, radius: 3.5 })
  }
  for (const p of world.parks) {
    batch.box(p.x, y, p.z, p.w, 0.14, p.d, '#88a778')
    batch.box(p.x, y + 0.08, p.z, p.w, 0.04, 1.6, '#d6d4bd')
    batch.box(p.x, y + 0.08, p.z, 1.6, 0.04, p.d, '#d6d4bd')
    batch.cylinder(p.x, y + 0.14, p.z, 3.0, 3.0, 0.16, '#d6d4bd', 48)
    batch.cylinder(p.x, y + 0.32, p.z, 2, 2.2, 0.4, '#dfe1cf', 36)
    batch.cylinder(p.x, y + 0.56, p.z, 1.82, 1.82, 0.06, '#6ab8bb', 36)
    batch.cylinder(p.x, y + 1.05, p.z, 0.2, 0.34, 1.0, '#dfe1cf', 16)
    batch.cylinder(p.x, y + 1.35, p.z, 0.98, 0.4, 0.3, '#dfe1cf', 32)
    batch.cylinder(p.x, y + 1.53, p.z, 0.89, 0.89, 0.03, '#78c7ce', 32)
    batch.sphere(p.x, y + 1.72, p.z, 0.19, '#e5ead7')
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2
      const points = Array.from({ length: 15 }, (_, j) => {
        const t = j / 14
        return {
          x: p.x + Math.cos(a) * t * 1.5,
          y: y + 1.55 + Math.sin(t * Math.PI) * 0.65 - t,
          z: p.z + Math.sin(a) * t * 1.5
        }
      })
      batch.tube(points, 0.022, '#bbebde', 18)
    }
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) {
        const x = p.x + sx * (p.w / 2 - 1.7),
          z = p.z + sz * (p.d / 2 - 1.6)
        bench(batch, x, y, z, sz > 0 ? 0 : Math.PI)
        gardenLamp(x + 1.1, y + 0.12, z)
        batch.box(x, y, z + 1.0, 2, 0.28, 0.65, '#c1bba0')
        for (let i = 0; i < 6; i++)
          batch.sphere(
            x - 0.8 + i * 0.32,
            y + 0.3,
            z + 1,
            0.15,
            i % 2 ? '#de8b76' : '#e8c66d',
            1,
            0.6,
            1
          )
      }
  }
  for (const trail of world.trails) {
    const surface = ribbon(trail.points, trail.width),
      attr = surface.attributes.position
    for (let i = 0; i < attr.count; i++) {
      const p = trail.points[Math.floor(i / 2)]
      attr.setY(i, p.raised > 0.1 ? p.y : heightAt(world, attr.getX(i), attr.getZ(i)) + 0.075)
    }
    surface.computeVertexNormals()
    batch.add(surface, '#c9b78f')
    for (let i = 6; i < trail.points.length - 1; i += 6) {
      const p = trail.points[i],
        prev = trail.points[i - 1],
        next = trail.points[i + 1]
      const yaw = Math.atan2(next.x - prev.x, next.z - prev.z)
      if (p.y > GROUND + 0.6) batch.box(p.x, p.y, p.z, trail.width, 0.08, 0.13, '#b39b72', yaw)
      if (i % 24 === 6) {
        const x = p.x + Math.cos(yaw) * 0.72,
          z = p.z - Math.sin(yaw) * 0.72
        gardenLamp(x, heightAt(world, x, z) + 0.08, z, 0.72)
      }
    }
    // Hillside rails follow the actual terrain on the outer edge of the trail.
    const rail = trail.points.map((p, i, all) => {
      const a = all[Math.max(0, i - 1)],
        b = all[Math.min(all.length - 1, i + 1)]
      const yaw = Math.atan2(b.x - a.x, b.z - a.z)
      const x = p.x + Math.cos(yaw) * 0.59,
        z = p.z - Math.sin(yaw) * 0.59
      return { x, z, y: Math.max(heightAt(world, x, z) + 0.7, p.y + 0.6) }
    })
    const climbStart = rail.findIndex((p) => p.y > GROUND + 1.1)
    if (climbStart >= 0) {
      const section = rail.slice(climbStart)
      batch.tube(section, 0.034, '#807b5b', section.length)
      for (let i = 0; i < section.length; i += 5) {
        const p = section[i]
        batch.cylinder(p.x, p.y - 0.3, p.z, 0.04, 0.045, 0.65, '#807b5b', 5)
      }
    }
    const p = trail.lookout
    const deckY = p.deckY
    for (let i = 1; i < trail.points.length - 1; i++) {
      const point = trail.points[i]
      if (!(point.raised > 0.1)) continue
      const next = trail.points[i + 1],
        yaw = Math.atan2(next.x - point.x, next.z - point.z)
      batch.box(point.x, point.y - 0.055, point.z, trail.width + 0.05, 0.12, 0.4, '#bca47f', yaw)
    }
    batch.box(p.x, deckY, p.z, 3.1, 0.18, 3.1, '#ad9771')
    for (let i = -7; i <= 7; i++)
      batch.box(p.x + i * 0.2, deckY + 0.1, p.z, 0.015, 0.025, 3.1, '#d5bd92')
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) {
        const x = p.x + sx * 1.4,
          z = p.z + sz * 1.4,
          ground = heightAt(world, x, z)
        batch.cylinder(
          x,
          (ground + deckY + 0.8) / 2,
          z,
          0.065,
          0.075,
          deckY + 0.8 - ground,
          '#807b5b',
          6
        )
      }
    for (const sx of [-1, 1])
      batch.box(p.x + sx * 1.4, deckY + 0.78, p.z, 0.07, 0.08, 2.9, '#807b5b')
    batch.box(p.x, deckY + 0.78, p.z - 1.4, 2.9, 0.08, 0.07, '#807b5b')
    bench(batch, p.x, deckY + 0.12, p.z - 0.8, 0)
    gardenLamp(p.x + 1.1, deckY + 0.12, p.z - 1.1)
  }
  const lantern = new THREE.PointLight('#ffe4a3', 0, 16, 2)
  lantern.visible = !!world.lighthouse
  parent.add(lantern)
  let beacon = null
  if (world.lighthouse) {
    const lx = world.lighthouse.x,
      lz = world.lighthouse.z
    batch.cylinder(lx, 1.1, lz, 2.65, 3.1, 1.3, '#acb6a3', 24)
    for (let i = 0; i < 5; i++)
      batch.cylinder(
        lx,
        1.85 + i * 0.95,
        lz,
        0.88 - i * 0.05,
        0.94 - i * 0.05,
        0.95,
        i % 2 ? '#c46d56' : '#f1eddb',
        20
      )
    batch.cylinder(lx, 6.35, lz, 1.17, 1.05, 0.17, '#ddd8bf', 24)
    const glass = new THREE.Mesh(
      new THREE.CylinderGeometry(0.63, 0.68, 0.85, 16),
      new THREE.MeshStandardMaterial({
        color: '#d1e4ce',
        transparent: true,
        opacity: 0.32,
        roughness: 0.1,
        depthWrite: false
      })
    )
    glass.position.set(lx, 6.85, lz)
    parent.add(glass)
    batch.cylinder(lx, 7.45, lz, 0, 1, 0.63, '#ba674e', 24)
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6
      batch.cylinder(
        lx + Math.sin(a) * 1.1,
        6.64,
        lz + Math.cos(a) * 1.1,
        0.027,
        0.027,
        0.48,
        '#4f6966',
        6
      )
    }
    lantern.position.set(lx, 6.9, lz)
    const glow = glowInstances(parent, 1, uniforms.night, '#fff3bb', 4.5)
    setInstance(glow, 0, lx, 6.9, lz)
    glow.instanceMatrix.needsUpdate = true
    const rotor = new THREE.Group()
    rotor.position.set(lx, 6.9, lz)
    parent.add(rotor)
    const coneMat = new THREE.ShaderMaterial({
      uniforms: { night: uniforms.night },
      vertexShader:
        'varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:
        'uniform float night; varying vec2 vUv; void main(){gl_FragColor=vec4(1.,.91,.63,night*.08*pow(vUv.y,.65));}',
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending
    })
    const cone = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 4.0, 42, 32, 1, true)
        .translate(0, -21, 0)
        .rotateX(-Math.PI / 2),
      coneMat
    )
    cone.rotation.x = 0.14
    rotor.add(cone)
    const spot = new THREE.SpotLight('#fff0ba', 0, 65, 0.11, 0.75, 2)
    rotor.add(spot, spot.target)
    spot.target.position.set(0, -6, 42)
    beacon = { rotor, spot }
    lamps.push({ x: lx, y: 6.9, z: lz, groundY: GROUND, radius: 6, strength: 1.1 })
  }
  const boatMaterial = new THREE.MeshStandardMaterial({ color: '#ebdfc1', roughness: 0.8 })
  const boats = []
  const navigationLights = []
  for (const data of world.boats) {
    const { x, z, scale } = data
    const hull = new THREE.Shape()
    hull.moveTo(-0.62, -1.8)
    hull.quadraticCurveTo(-1, 0, -0.38, 1.65)
    hull.quadraticCurveTo(0, 2.3, 0.38, 1.65)
    hull.quadraticCurveTo(1, 0, 0.62, -1.8)
    hull.closePath()
    const geo = new THREE.ExtrudeGeometry(hull, {
      depth: 0.46,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.11,
      bevelThickness: 0.1
    }).rotateX(-Math.PI / 2)
    geo.rotateY(Math.PI)
    const group = new THREE.Group(),
      mesh = new THREE.Mesh(geo, boatMaterial)
    mesh.castShadow = true
    group.add(mesh)
    const bb = new Batch()
    bb.box(0, 0.6, -0.6, 0.95, 0.55, 1.1, '#f4eed7')
    bb.box(0, 0.8, -0.02, 0.7, 0.2, 0.025, '#4a838c')
    bb.cylinder(0, 2, 0.4, 0.025, 0.035, 3.4, '#beaa83', 6)
    const sail = new THREE.Shape()
    sail.moveTo(0, 0)
    sail.lineTo(0, 2.7)
    sail.quadraticCurveTo(1.5, 1.4, 1.15, 0.2)
    sail.closePath()
    bb.add(
      new THREE.ExtrudeGeometry(sail, { depth: 0.018, bevelEnabled: false }).translate(
        0.05,
        0.8,
        0.4
      ),
      '#f2ebcc'
    )
    bb.finish(group)
    const port = glowInstances(group, 1, uniforms.night, '#ff5f42', 0.6)
    const starboard = glowInstances(group, 1, uniforms.night, '#8df9b7', 0.6)
    const mast = glowInstances(group, 1, uniforms.night, '#fff5cf', 0.65)
    setInstance(port, 0, -0.55, 0.65, 0.8)
    setInstance(starboard, 0, 0.55, 0.65, 0.8)
    setInstance(mast, 0, 0, 3.65, 0.4)
    navigationLights.push(port, starboard, mast)
    const wake = new THREE.Mesh(
      new THREE.PlaneGeometry(3, 7).rotateX(-Math.PI / 2),
      new THREE.ShaderMaterial({
        uniforms: { time: uniforms.time, night: uniforms.night },
        vertexShader:
          'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
        fragmentShader: `varying vec2 vUv;uniform float time;uniform float night;
          void main(){float t=vUv.y;float side=abs(vUv.x-.5)*2.;float line=exp(-pow((side-(1.-t)*.85)*18.,2.));float ripple=.65+.35*sin(t*55.+time*5.);gl_FragColor=vec4(.75,.94,.88,line*t*(1.-t)*ripple*(1.-night*.5));}`,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide
      })
    )
    parent.add(wake)
    group.position.set(x, 0.22, z)
    group.scale.setScalar(scale)
    parent.add(group)
    boats.push({ group, wake, data, pose: null })
  }
  navigationLights.forEach((m) => {
    m.instanceMatrix.needsUpdate = true
  })
  if (world.dock) {
    const { a, b } = world.dock,
      length = Math.hypot(b.x - a.x, b.z - a.z),
      angle = Math.atan2(b.x - a.x, b.z - a.z)
    const dx = (b.x - a.x) / length,
      dz = (b.z - a.z) / length
    batch.box((a.x + b.x) / 2, 0.8, (a.z + b.z) / 2, 1.8, 0.22, length, '#b29d76', angle)
    for (let d = 0; d < length; d += 0.65)
      batch.box(a.x + dx * d, 0.93, a.z + dz * d, 1.82, 0.035, 0.05, '#d2c19b', angle)
    for (let d = 0; d < length; d += 2.4)
      for (const s of [-1, 1])
        batch.cylinder(
          a.x + dx * d + dz * s * 0.8,
          0.6,
          a.z + dz * d - dx * s * 0.8,
          0.09,
          0.12,
          1.5,
          '#796f56',
          8
        )
    for (let d = 1; d < length; d += 3.5)
      gardenLamp(a.x + dx * d + dz * 0.78, 0.94, a.z + dz * d - dx * 0.78, 0.8)
  }
  if (world.fairground) buildFerris(world.fairground, batch, parent, moving)
  // Meter marks are anchored to the board and rotate with the world.
  for (let i = -world.size / 2 + 5; i <= world.size / 2 - 5; i += 5) {
    batch.box(i, 0.32, world.size / 2 + 0.85, 0.05, 0.035, i % 10 === 0 ? 0.65 : 0.3, '#6c8b83')
    batch.box(world.size / 2 + 0.85, 0.32, i, i % 10 === 0 ? 0.65 : 0.3, 0.035, 0.05, '#6c8b83')
  }
  batch.finish(parent, uniforms)
  return {
    moving,
    boats,
    lantern,
    lamps,
    beacon,
    update(seconds, night, dt) {
      lantern.intensity = night * 35
      if (beacon) {
        beacon.rotor.rotation.y = seconds * 0.28
        beacon.spot.intensity = night * 4500
      }
      for (const boat of boats) {
        const p = boatPoint(boat.data, seconds)
        if (!boat.pose) boat.pose = { ...p }
        boat.pose.x = p.x
        boat.pose.z = p.z
        boat.pose.yaw +=
          Math.atan2(Math.sin(p.yaw - boat.pose.yaw), Math.cos(p.yaw - boat.pose.yaw)) *
          (1 - Math.exp(-dt * 2.8))
        boat.group.position.set(p.x, 0.2 + Math.sin(seconds * 1.2 + boat.data.phase) * 0.045, p.z)
        boat.group.rotation.set(0, boat.pose.yaw, Math.sin(seconds * 0.8 + boat.data.phase) * 0.035)
        boat.wake.position.set(
          p.x - Math.sin(boat.pose.yaw) * 4.2,
          0.07,
          p.z - Math.cos(boat.pose.yaw) * 4.2
        )
        boat.wake.rotation.y = boat.pose.yaw
      }
    }
  }
}

function bench(b, x, y, z, rot) {
  for (let i = 0; i < 3; i++)
    b.box(x, y + 0.42, z + (i - 1) * 0.17, 1.5, 0.07, 0.12, '#b2956a', rot)
  for (const s of [-1, 1]) b.box(x + s * 0.55, y + 0.18, z, 0.08, 0.38, 0.48, '#52706b')
  b.box(x, y + 0.75, z + 0.29, 1.5, 0.4, 0.07, '#b2956a', rot)
}

function buildFerris(p, b, parent, moving) {
  const x = p.x,
    z = p.z,
    y = GROUND
  b.cylinder(x, y + 0.07, z, 4.6, 4.6, 0.14, '#d4cead', 40)
  for (const s of [-1, 1])
    for (const zz of [-0.85, 0.85])
      b.tube(
        [
          { x: x + s * 2.1, y: y + 0.2, z: z + zz },
          { x, y: y + 5.5, z: z + zz }
        ],
        0.12,
        '#e7dfc4',
        2
      )
  const group = new THREE.Group()
  group.position.set(x, y + 5.5, z)
  parent.add(group)
  const wheel = new Batch(),
    radius = 4.1
  for (const zz of [-0.65, 0.65]) {
    const points = Array.from({ length: 65 }, (_, i) => ({
      x: Math.sin((i / 64) * Math.PI * 2) * radius,
      y: Math.cos((i / 64) * Math.PI * 2) * radius,
      z: zz
    }))
    wheel.tube(points, 0.085, '#ca7d59', 100)
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2
      wheel.tube(
        [
          { x: 0, y: 0, z: zz },
          { x: Math.sin(a) * radius, y: Math.cos(a) * radius, z: zz }
        ],
        0.042,
        '#dfc99d',
        2
      )
    }
  }
  wheel.finish(group)
  const cabins = []
  for (let i = 0; i < 12; i++) {
    const c = new THREE.Group(),
      cb = new Batch()
    cb.box(0, -0.5, 0, 0.75, 0.5, 1.02, ['#d88b71', '#76a7a1', '#d0b76d'][i % 3])
    cb.box(0, 0.05, 0, 0.85, 0.1, 1.1, '#efe5c7')
    for (const side of [-1, 1]) cb.box(side * 0.33, -0.15, 0, 0.045, 0.6, 0.8, '#e8d9bc')
    cb.finish(c)
    group.add(c)
    cabins.push(c)
  }
  moving.push({ group, cabins, radius })
}
