import { useEffect, useRef, useState } from 'react'
import {
  Compass,
  Map,
  Navigation2,
  Sun,
  CloudRain,
  Snowflake,
  Shuffle,
  RotateCcw,
  Move,
  Orbit,
  ZoomIn,
  ZoomOut,
  Camera,
  Pause,
  Play,
  Settings2,
  X,
  ChevronRight,
  Building2,
  TreePine,
  Route,
  ArrowUpRight,
  ChevronDown
} from 'lucide-react'
import { IMPLEMENTATIONS, normalizeImplementation, loadImplementation } from './implementations.js'
import { normalizeSize } from './city/world.js'
import './App.css'

const initialSeed = new URLSearchParams(window.location.search).get('seed') || 'SHIO-2048'
const initialSize = normalizeSize(new URLSearchParams(window.location.search).get('size'))
const initialImplementation = normalizeImplementation(
  new URLSearchParams(window.location.search).get('model')
)
const clock = (t) =>
  `${String(Math.floor(t)).padStart(2, '0')}:${String(Math.floor((t % 1) * 60)).padStart(2, '0')}`
function IconButton({ label, children, active, ...props }) {
  return (
    <button
      type="button"
      className={`icon-button ${active ? 'active' : ''}`}
      aria-label={label}
      title={label}
      aria-pressed={active}
      {...props}
    >
      {children}
    </button>
  )
}

export default function App() {
  const container = useRef(null),
    city = useRef(null)
  const options = useRef({
    seed: initialSeed,
    density: 0.84,
    size: initialSize,
    time: 10.5,
    weather: 'sun',
    mode: 'orbit',
    autoRotate: false,
    speed: 1,
    paused: window.matchMedia('(prefers-reduced-motion: reduce)').matches
  })
  const [implementation, setImplementation] = useState(initialImplementation)
  const legacy = implementation === 'gpt-5.5'
  const [seed, setSeed] = useState(initialSeed),
    [draft, setDraft] = useState(initialSeed),
    [density, setDensity] = useState(0.84),
    [size, setSize] = useState(initialSize)
  const [panel, setPanel] = useState(false),
    [progress, setProgress] = useState(0),
    [error, setError] = useState('')
  const [stats, setStats] = useState(null),
    [perf, setPerf] = useState(null),
    [time, setTime] = useState(10.5),
    [bearing, setBearing] = useState(0)
  const [weather, setWeather] = useState('sun'),
    [paused, setPaused] = useState(
      () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ),
    [speed, setSpeed] = useState(1),
    [mode, setMode] = useState('orbit'),
    [autoRotate, setAutoRotate] = useState(false)
  useEffect(() => {
    let active = true,
      api
    async function mount() {
      try {
        const createCity = await loadImplementation(implementation)
        if (!active) return
        api = createCity(
          container.current,
          { ...options.current },
          {
            onLoading: (p) => {
              if (active) setProgress(p)
            },
            onReady: (s) => {
              if (active) setStats(s)
            },
            onTime: (t) => {
              if (active) {
                options.current.time = t
                setTime(t)
              }
            },
            onBearing: (b) => {
              if (active) setBearing(b)
            },
            onPerformance: (p) => {
              if (active) setPerf(p)
            },
            onError: (e) => {
              if (active) setError(e)
            }
          }
        )
        api.set({ ...options.current })
        city.current = api
      } catch (e) {
        if (active) setError(e.message)
      }
    }
    mount()
    return () => {
      active = false
      api?.dispose()
      city.current = null
    }
  }, [implementation])
  const config = (key, value, setter) => {
    setter(value)
    options.current[key] = value
    city.current?.set({ [key]: value })
  }
  function changeImplementation(value) {
    const next = normalizeImplementation(value)
    if (next === implementation) return
    setProgress(0)
    setStats(null)
    setPerf(null)
    setError('')
    const url = new URL(window.location.href)
    url.searchParams.set('model', next)
    window.history.replaceState({}, '', url)
    setImplementation(next)
  }
  function generate(value = draft) {
    value = value.trim().slice(0, 40) || 'SHIO-2048'
    setDraft(value)
    setSeed(value)
    setError('')
    setProgress(0)
    const url = new URL(window.location.href)
    url.searchParams.set('seed', value)
    url.searchParams.set('size', size)
    window.history.replaceState({}, '', url)
    Object.assign(options.current, { seed: value, density, size })
    city.current?.rebuild(value, density, size)
  }
  const shuffle = () => generate(`SHIO-${Math.floor(Math.random() * 900000 + 100000)}`)
  return (
    <main
      data-implementation={implementation}
      className={`atlas ${panel ? 'panel-open' : ''} ${time < 6 || time > 18 ? 'night' : ''}`}
    >
      <div className="city-stage" ref={container} />
      <header className="topbar">
        <a className="brand" href={import.meta.env.BASE_URL} aria-label="汐湾城市罗盘">
          <span className="brand-mark">
            <Compass size={25} strokeWidth={1.5} />
          </span>
          <span>
            <h1>汐湾</h1>
            <span className="brand-caption">CITY ATLAS</span>
          </span>
        </a>
        <div className="topbar-center">
          <span className={`live-dot ${paused ? 'paused' : ''}`} />
          <span>一座正在生活的城市</span>
        </div>
        <div className="header-actions">
          <div className="model-picker">
            <select
              aria-label="实现模型"
              title="切换实现模型"
              value={implementation}
              onChange={(e) => changeImplementation(e.target.value)}
            >
              {IMPLEMENTATIONS.map(({ id, label }) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
            <ChevronDown size={14} aria-hidden="true" />
          </div>
          <button
            className="generate-button"
            aria-label="另一座城市"
            title="另一座城市"
            onClick={shuffle}
            disabled={progress < 1 && !error}
          >
            <Shuffle size={15} />
            <span>另一座城市</span>
          </button>
          <IconButton
            label={panel ? '收起设置' : '城市设置'}
            active={panel}
            onClick={() => setPanel(!panel)}
          >
            <Settings2 size={19} />
          </IconButton>
          <a
            className="icon-button github-link"
            href="https://github.com/CatsJuice/random-city"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub 仓库"
            title="在 GitHub 查看源码"
          >
            <svg width="21" height="21" aria-hidden="true" focusable="false">
              <use href={`${import.meta.env.BASE_URL}icons.svg#github-icon`} />
            </svg>
          </a>
        </div>
      </header>
      <div className="location-tag">
        <span className="eyebrow">THE COASTAL COLLECTION</span>
        <div>
          <h2>{stats?.terrainName || '城市罗盘'}</h2>
          <span className="edition">NO. {seed.replace('SHIO-', '')}</span>
        </div>
      </div>
      {panel && (
        <aside className="inspector" aria-label="城市设置">
          <div className="inspector-heading">
            <span>城市手记</span>
            <IconButton label="关闭设置" onClick={() => setPanel(false)}>
              <X size={16} />
            </IconButton>
          </div>
          <section className="inspector-section">
            <div className="section-title">
              <span>此刻</span>
              <span className="micro-label">LOCAL TIME</span>
            </div>
            <div className="clock-row">
              <div className="clock">
                {clock(time)}
                <span>{time >= 6 && time < 18 ? '白昼' : '夜晚'}</span>
              </div>
              <IconButton
                label={paused ? '继续模拟' : '暂停模拟'}
                active={paused}
                onClick={() => config('paused', !paused, setPaused)}
              >
                {paused ? <Play size={17} /> : <Pause size={17} />}
              </IconButton>
            </div>
            <input
              className="time-range"
              aria-label="城市时间"
              type="range"
              min="0"
              max="23.99"
              step="0.05"
              value={time}
              onChange={(e) => config('time', Number(e.target.value), setTime)}
            />
            <div className="range-labels">
              <span>00:00</span>
              <span>12:00</span>
              <span>24:00</span>
            </div>
            <div className="speed-row">
              <span>时间流速</span>
              <div className="speed-control">
                {[1, 5, 20].map((s) => (
                  <button
                    key={s}
                    className={s === speed ? 'selected' : ''}
                    aria-pressed={s === speed}
                    onClick={() => config('speed', s, setSpeed)}
                  >
                    {s}×
                  </button>
                ))}
              </div>
            </div>
          </section>
          <section className="inspector-section">
            <div className="section-title">
              <span>天气</span>
              <span className="micro-label">ATMOSPHERE</span>
            </div>
            <div className="weather-options">
              {[
                ['sun', Sun, '晴'],
                ['rain', CloudRain, '雨'],
                ['snow', Snowflake, '雪']
              ].map(([key, Icon, label]) => (
                <button
                  key={key}
                  className={weather === key ? 'selected' : ''}
                  aria-pressed={weather === key}
                  aria-label={`${label}天`}
                  onClick={() => config('weather', key, setWeather)}
                >
                  <Icon size={21} strokeWidth={1.4} />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </section>
          <section className="inspector-section city-form">
            <div className="section-title">
              <span>城市基因</span>
              <span className="micro-label">GENERATION</span>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                generate()
              }}
            >
              <label htmlFor="seed">地图种子</label>
              <div className="seed-field">
                <input
                  id="seed"
                  value={draft}
                  maxLength={40}
                  onChange={(e) => setDraft(e.target.value)}
                />
                <IconButton
                  label="随机生成城市"
                  onClick={shuffle}
                  disabled={progress < 1 && !error}
                >
                  <Shuffle size={15} />
                </IconButton>
              </div>
              {!legacy && (
                <>
                  <div className="density-label">
                    <label htmlFor="density">建筑密度</label>
                    <span>{Math.round(density * 100)}%</span>
                  </div>
                  <input
                    id="density"
                    type="range"
                    min="0.4"
                    max="1"
                    step="0.05"
                    value={density}
                    onChange={(e) => setDensity(Number(e.target.value))}
                  />
                  <div className="density-label">
                    <label htmlFor="map-size">罗盘尺寸</label>
                    <span>
                      {size} × {size}
                    </span>
                  </div>
                  <input
                    id="map-size"
                    type="range"
                    min="120"
                    max="240"
                    step="60"
                    value={size}
                    onChange={(e) => setSize(Number(e.target.value))}
                  />
                  <div className="range-labels">
                    <span>标准</span>
                    <span>大型</span>
                    <span>广域</span>
                  </div>
                </>
              )}
              <button className="apply-button" type="submit" disabled={progress < 1 && !error}>
                <span>生成城市</span>
                <ChevronRight size={16} />
              </button>
            </form>
          </section>
          {stats && (
            <section className="city-census">
              <div>
                <Building2 size={16} />
                <b>{stats.buildings}</b>
                <span>建筑</span>
              </div>
              <div>
                <TreePine size={16} />
                <b>{stats.trees}</b>
                <span>树木</span>
              </div>
              <div>
                <Route size={16} />
                <b>{stats.bridges}</b>
                <span>桥梁</span>
              </div>
            </section>
          )}
          {!legacy && (
            <a
              className="asset-credit"
              href="https://kenney.nl/assets"
              target="_blank"
              rel="noreferrer"
            >
              3D assets by Kenney · CC0
              <ArrowUpRight size={12} />
            </a>
          )}
        </aside>
      )}
      <nav className="view-tools" aria-label="视角控制">
        {!legacy && (
          <>
            <IconButton label="俯视地图" onClick={() => city.current?.overview()}>
              <Map size={18} />
            </IconButton>
            <IconButton
              label="旋转视角"
              active={mode === 'orbit'}
              onClick={() => config('mode', 'orbit', setMode)}
            >
              <Orbit size={19} />
            </IconButton>
          </>
        )}
        <IconButton
          label="平移视角"
          active={legacy || mode === 'pan'}
          onClick={() => {
            if (!legacy) config('mode', 'pan', setMode)
          }}
        >
          <Move size={18} />
        </IconButton>
        <span className="toolbar-divider" />
        <IconButton label="放大" onClick={() => city.current?.zoom(1.2)}>
          <ZoomIn size={19} />
        </IconButton>
        <IconButton label="缩小" onClick={() => city.current?.zoom(1 / 1.2)}>
          <ZoomOut size={19} />
        </IconButton>
        <IconButton label="回到全景" onClick={() => city.current?.reset()}>
          <RotateCcw size={17} />
        </IconButton>
        <span className="toolbar-divider" />
        {!legacy && (
          <IconButton
            label="自动环绕"
            active={autoRotate}
            onClick={() => config('autoRotate', !autoRotate, setAutoRotate)}
          >
            <Compass size={18} />
          </IconButton>
        )}
        <IconButton
          label="导出城市图片"
          onClick={() => city.current?.screenshot()}
          disabled={progress < 1}
        >
          <Camera size={18} />
        </IconButton>
      </nav>
      <div className="world-status">
        <span className="status-dot" />
        {stats ? (
          <span>
            {stats.people} 位居民 · {stats.cars} 辆车
          </span>
        ) : (
          <span>城市构建中</span>
        )}
        <span className="fps">{perf?.fps || '--'} FPS</span>
      </div>
      {!legacy && (
        <div className="compass-label" style={{ transform: `rotate(${bearing}deg)` }}>
          <span>N</span>
          <Navigation2 size={25} strokeWidth={1} />
        </div>
      )}
      {progress < 1 && !error && (
        <div className="loading-screen" role="status">
          <div className="loading-content">
            <Compass size={34} strokeWidth={1} />
            <h2>
              {legacy
                ? '绘制城市与街巷'
                : progress < 0.28
                  ? '规划地形与航线'
                  : progress < 0.64
                    ? '装载城市模型'
                    : progress < 0.9
                      ? '构建山川与街巷'
                      : '准备夜景与光影'}
            </h2>
            <div className="loading-track">
              <div style={{ width: `${progress * 100}%` }} />
            </div>
            <span>{Math.round(progress * 100)}%</span>
          </div>
        </div>
      )}
      {error && (
        <div className="error-screen" role="alert">
          <h2>城市未能完成加载</h2>
          <p>{error}</p>
          <button onClick={() => generate()}>重新加载</button>
        </div>
      )}
    </main>
  )
}
