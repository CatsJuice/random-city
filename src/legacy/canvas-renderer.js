import { createCity, drawCity, getDefaultScale } from '../cityEngine.js'

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

// Keep the archived drawing engine intact; adapt only its lifecycle and controls.
export function createLegacyCity(container, options, events = {}) {
  const state = { time: 10.5, weather: 'sun', paused: false, speed: 1, ...options }
  const canvas = document.createElement('canvas')
  canvas.setAttribute('role', 'img')
  canvas.setAttribute('aria-label', 'GPT-5.5 纯绘制城市')
  canvas.style.cursor = 'grab'
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('浏览器无法创建 Canvas 2D 绘图上下文')
  container.append(canvas)

  const viewport = { scale: 1, offsetX: 0, offsetY: 0 }
  const listeners = new AbortController()
  const pointers = new Map()
  let city,
    width = 1,
    height = 1,
    dpr = 1,
    baseScale = 1,
    ready = false,
    disposed = false,
    dirty = true,
    elapsedSeconds = 0,
    frame = 0,
    sampleFrames = 0,
    animationFrame,
    generationFrame,
    gesture
  let lastTick = performance.now(),
    lastDraw = 0,
    lastNotify = lastTick

  function resize() {
    width = Math.max(1, container.clientWidth)
    height = Math.max(1, container.clientHeight)
    dpr = Math.min(window.devicePixelRatio || 1, 1.5)
    const zoom = viewport.scale / baseScale
    if (city) {
      baseScale = Math.min(getDefaultScale(city, width, height), height / (city.size * 0.64 + 400))
      viewport.scale = baseScale * zoom
    }
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
    dirty = true
    if (ready) draw()
  }

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    drawCity(ctx, city, viewport, {
      width,
      height,
      weather: state.weather === 'sun' ? 'sunny' : state.weather,
      timeHours: state.time,
      elapsedSeconds
    })
    dirty = false
    frame++
    sampleFrames++
  }

  function animate(now) {
    if (disposed) return
    const dt = Math.min(0.25, Math.max(0, (now - lastTick) / 1000))
    lastTick = now
    if (ready && !document.hidden) {
      if (!state.paused) {
        elapsedSeconds += dt
        state.time = (state.time + dt * 0.025 * state.speed) % 24
      }
      // The original renderer redraws every facade; cap work at 30 frames/second.
      if (dirty || (!state.paused && now - lastDraw >= 1000 / 30)) {
        try {
          draw()
          lastDraw = now
        } catch (error) {
          ready = false
          events.onError?.(error.message)
        }
      }
      if (now - lastNotify >= 1000) {
        events.onTime?.(state.time)
        events.onPerformance?.({ fps: Math.round((sampleFrames * 1000) / (now - lastNotify)) })
        sampleFrames = 0
        lastNotify = now
      }
    }
    animationFrame = requestAnimationFrame(animate)
  }

  function reset() {
    viewport.scale = baseScale
    viewport.offsetX = 0
    viewport.offsetY = 0
    dirty = true
  }

  function rebuild(seed) {
    if (disposed) return
    cancelAnimationFrame(generationFrame)
    ready = false
    events.onLoading?.(0.15)
    generationFrame = requestAnimationFrame(() => {
      if (disposed) return
      try {
        city = createCity(seed)
        state.seed = seed
        elapsedSeconds = 0
        resize()
        reset()
        draw()
        ready = true
        lastTick = performance.now()
        events.onTime?.(state.time)
        events.onBearing?.(0)
        events.onReady?.({ ...city.stats, terrainName: '城市罗盘' })
        events.onLoading?.(1)
      } catch (error) {
        events.onError?.(error.message)
      }
    })
  }

  function zoomAt(factor, x = width / 2, y = height / 2) {
    if (!ready) return
    const oldScale = viewport.scale
    viewport.scale = clamp(oldScale * factor, baseScale * 0.45, baseScale * 6)
    viewport.offsetX += (x - width / 2) * (1 / viewport.scale - 1 / oldScale)
    viewport.offsetY += (y - height / 2) * (1 / viewport.scale - 1 / oldScale)
    dirty = true
  }

  function point(event) {
    const rect = canvas.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  function measureGesture() {
    const points = [...pointers.values()]
    if (!points.length) return null
    const [a, b = a] = points
    return {
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,
      distance: Math.hypot(b.x - a.x, b.y - a.y)
    }
  }

  function pointerDown(event) {
    if (!ready || (event.pointerType === 'mouse' && ![0, 2].includes(event.button))) return
    event.preventDefault()
    pointers.set(event.pointerId, point(event))
    canvas.setPointerCapture(event.pointerId)
    gesture = measureGesture()
    canvas.style.cursor = 'grabbing'
  }

  function pointerMove(event) {
    if (!pointers.has(event.pointerId)) return
    pointers.set(event.pointerId, point(event))
    const next = measureGesture()
    viewport.offsetX += (next.x - gesture.x) / viewport.scale
    viewport.offsetY += (next.y - gesture.y) / viewport.scale
    if (gesture.distance > 0 && next.distance > 0)
      zoomAt(next.distance / gesture.distance, next.x, next.y)
    gesture = next
    dirty = true
  }

  function pointerUp(event) {
    pointers.delete(event.pointerId)
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId)
    gesture = measureGesture()
    canvas.style.cursor = pointers.size ? 'grabbing' : 'grab'
  }

  for (const [type, handler] of Object.entries({
    pointerdown: pointerDown,
    pointermove: pointerMove,
    pointerup: pointerUp,
    pointercancel: pointerUp,
    lostpointercapture: pointerUp,
    contextmenu: (event) => event.preventDefault(),
    wheel: (event) => {
      event.preventDefault()
      const p = point(event)
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? height : 1)
      zoomAt(Math.exp(-clamp(delta, -500, 500) * 0.0015), p.x, p.y)
    }
  })) {
    canvas.addEventListener(type, handler, { passive: false, signal: listeners.signal })
  }

  const observer = new ResizeObserver(resize)
  observer.observe(container)
  document.addEventListener(
    'visibilitychange',
    () => { lastTick = performance.now() },
    { signal: listeners.signal }
  )
  resize()
  animationFrame = requestAnimationFrame(animate)

  const api = {
    rebuild,
    set(config) {
      if (disposed) return
      Object.assign(state, config)
      if (config.time !== undefined) events.onTime?.(state.time)
      lastTick = performance.now()
      dirty = true
    },
    reset,
    zoom: zoomAt,
    screenshot() {
      if (!ready) return
      draw()
      const a = document.createElement('a')
      a.download = `city-gpt-5.5-${city.seed}.png`
      a.href = canvas.toDataURL('image/png')
      a.click()
    },
    inspect() {
      return {
        ready,
        implementation: 'gpt-5.5',
        renderer: 'canvas-2d',
        source: 'src/cityEngine.js',
        seed: city?.seed,
        world: city,
        state: { ...state },
        elapsedSeconds,
        camera: {
          projection: 'isometric',
          offset: [viewport.offsetX, viewport.offsetY],
          zoom: viewport.scale / baseScale,
          scale: viewport.scale
        },
        render: { frame },
        memory: { textures: 0, geometries: 0 }
      }
    },
    dispose() {
      disposed = true
      ready = false
      cancelAnimationFrame(animationFrame)
      cancelAnimationFrame(generationFrame)
      observer.disconnect()
      listeners.abort()
      pointers.clear()
      canvas.remove()
      canvas.width = canvas.height = 1
      city = null
      if (window.__CITY__ === api) delete window.__CITY__
    }
  }
  if (import.meta.env.DEV) window.__CITY__ = api
  rebuild(options.seed)
  return api
}
