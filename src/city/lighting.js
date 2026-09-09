import * as THREE from 'three'

const transform = new THREE.Object3D()
export function setInstance(mesh, i, x, y, z, yaw = 0, sx = 1, sy = sx, sz = sx) {
  transform.position.set(x, y, z)
  transform.rotation.set(0, yaw, 0)
  transform.scale.set(sx, sy, sz)
  transform.updateMatrix()
  mesh.setMatrixAt(i, transform.matrix)
}

// Camera-facing, depth-tested lamp optics. Hundreds of bulbs use a single draw call.
export function glowInstances(parent, count, night, tint = '#ffe2a0', diameter = 1.1) {
  const material = new THREE.ShaderMaterial({
    uniforms: { night, tint: { value: new THREE.Color(tint) }, diameter: { value: diameter } },
    vertexShader: `uniform float diameter; varying vec2 vUv;
      void main() {
        vUv=uv;
        vec4 center=modelViewMatrix*instanceMatrix*vec4(0.,0.,0.,1.);
        center.xy+=position.xy*diameter;
        gl_Position=projectionMatrix*center;
      }`,
    fragmentShader: `uniform float night; uniform vec3 tint; varying vec2 vUv;
      void main(){
        float r=length(vUv-.5)*2.;
        float glow=pow(max(0.,1.-r),3.)*.65+exp(-r*r*110.);
        gl_FragColor=vec4(tint,glow*night);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false
  })
  const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), material, count)
  mesh.frustumCulled = false
  mesh.renderOrder = 3
  parent.add(mesh)
  return mesh
}

export function softPool(parent, count, night, tint = '#ffd18b') {
  const material = new THREE.ShaderMaterial({
    uniforms: { night, tint: { value: new THREE.Color(tint) } },
    vertexShader: `varying vec2 vUv;
      void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}`,
    fragmentShader: `uniform float night; uniform vec3 tint; varying vec2 vUv;
      void main(){float d=length((vUv-.5)*2.);gl_FragColor=vec4(tint,pow(max(0.,1.-d),2.)*night*.6);}`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    polygonOffset: true,
    polygonOffsetFactor: -2
  })
  const mesh = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
    material,
    count
  )
  mesh.frustumCulled = false
  mesh.renderOrder = 2
  parent.add(mesh)
  return mesh
}

function irradianceTexture(world, lamps) {
  const size = world.size > 180 ? 1024 : 512,
    data = new Uint8Array(size * size * 4)
  const pixelsPerUnit = size / world.size
  for (const lamp of lamps) {
    const cx = (lamp.x / world.size + 0.5) * size,
      cz = (lamp.z / world.size + 0.5) * size
    const radius = lamp.radius || 4.8,
      r = Math.ceil(radius * pixelsPerUnit)
    const tint = new THREE.Color(lamp.color || '#ffd392')
    for (let z = Math.max(0, Math.floor(cz - r)); z <= Math.min(size - 1, cz + r); z++)
      for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(size - 1, cx + r); x++) {
        const d = Math.hypot(x - cx, z - cz) / (radius * pixelsPerUnit)
        if (d >= 1) continue
        const v = (1 - d * d) ** 3 * (lamp.strength || 0.9) * 230,
          k = (z * size + x) * 4
        data[k] = Math.min(255, data[k] + v * tint.r)
        data[k + 1] = Math.min(255, data[k + 1] + v * tint.g)
        data[k + 2] = Math.min(255, data[k + 2] + v * tint.b)
        data[k + 3] = Math.max(data[k + 3], Math.round(((lamp.groundY || 0.94) / 48) * 255))
      }
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat)
  texture.minFilter = texture.magFilter = THREE.LinearFilter
  texture.needsUpdate = true
  return texture
}

export function buildNightLighting(world, parent, lamps, uniforms) {
  const bulb = glowInstances(parent, lamps.length, uniforms.night)
  const pool = softPool(parent, lamps.length, uniforms.night)
  lamps.forEach((p, i) => {
    setInstance(bulb, i, p.x, p.y, p.z)
    setInstance(pool, i, p.x, p.groundY + 0.05, p.z, 0, 4.2, 1, 4.2)
  })
  bulb.instanceMatrix.needsUpdate = pool.instanceMatrix.needsUpdate = true
  const texture = irradianceTexture(world, lamps)
  const patched = new Set()
  // The static light field illuminates streets and nearby facades without a light
  // loop per lamp, shadow maps per pole, or an extra full-screen bloom pass.
  parent.traverse((o) => {
    const mat = o.material
    if (!mat?.isMeshStandardMaterial || patched.has(mat)) return
    patched.add(mat)
    const previous = mat.onBeforeCompile.bind(mat),
      key = mat.customProgramCacheKey()
    mat.onBeforeCompile = (shader) => {
      previous(shader)
      shader.uniforms.cityIrradiance = { value: texture }
      shader.uniforms.cityExtent = { value: world.size }
      shader.uniforms.cityNight = uniforms.night
      shader.vertexShader = 'varying vec3 vNightWorld;\n' + shader.vertexShader
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vec4 cityPosition=vec4(position,1.);
        #ifdef USE_INSTANCING
          cityPosition=instanceMatrix*cityPosition;
        #endif
        vNightWorld=(modelMatrix*cityPosition).xyz;`
      )
      shader.fragmentShader =
        'uniform sampler2D cityIrradiance; uniform float cityExtent; uniform float cityNight; varying vec3 vNightWorld;\n' +
        shader.fragmentShader
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        vec4 cityLight=texture2D(cityIrradiance,vNightWorld.xz/cityExtent+.5);
        float verticalFalloff=exp(-abs(vNightWorld.y-cityLight.a*48.)*.55);
        totalEmissiveRadiance+=diffuseColor.rgb*cityLight.rgb*cityNight*verticalFalloff*1.55;`
      )
    }
    mat.customProgramCacheKey = () => key + ':night-field-v1'
    mat.needsUpdate = true
  })
  return { count: lamps.length, dispose: () => texture.dispose() }
}

export function buildCarLights(parent, count, uniforms) {
  const front = glowInstances(parent, count * 2, uniforms.night, '#fff2c9', 0.75)
  const rear = glowInstances(parent, count * 2, uniforms.night, '#ff4a2e', 0.52)
  const beams = softPool(parent, count * 2, uniforms.night, '#fff1bb')
  const point = (p, lateral, along) => ({
    x: p.x + Math.sin(p.yaw) * along + Math.cos(p.yaw) * lateral,
    z: p.z + Math.cos(p.yaw) * along - Math.sin(p.yaw) * lateral
  })
  return {
    update(agents) {
      agents.forEach((a, i) => {
        if (!a.pose) return
        const p = a.pose
        for (let j = 0; j < 2; j++) {
          const side = j ? 1 : -1,
            f = point(p, side * 0.27, 0.72),
            r = point(p, side * 0.28, -0.7)
          setInstance(front, i * 2 + j, f.x, p.y + 0.27, f.z)
          setInstance(rear, i * 2 + j, r.x, p.y + 0.26, r.z)
          const beam = point(p, side * 0.37, 2.2)
          setInstance(beams, i * 2 + j, beam.x, p.y + 0.065, beam.z, p.yaw, 1.6, 1, 4.8)
        }
      })
      for (const mesh of [front, rear, beams]) mesh.instanceMatrix.needsUpdate = true
    }
  }
}
