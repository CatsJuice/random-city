import { useEffect, useMemo, useRef, useState } from 'react'
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
  ChevronDown,
  Languages
} from 'lucide-react'
import { IMPLEMENTATIONS, normalizeImplementation, loadImplementation } from './implementations.js'
import { normalizeSize } from './city/world.js'
import { LANGUAGES, LANGUAGE_KEY, messages, getInitialLocale, cityNameFor } from './i18n.js'
import './App.css'

const initialSeed = new URLSearchParams(window.location.search).get('seed') || 'SHIO-2048'
const initialSize = normalizeSize(new URLSearchParams(window.location.search).get('size'))
const initialImplementation = normalizeImplementation(
  new URLSearchParams(window.location.search).get('model')
)
const clock = (t) =>
  `${String(Math.floor(t)).padStart(2, '0')}:${String(Math.floor((t % 1) * 60)).padStart(2, '0')}`
function IconButton({ label, children, active, className = '', ...props }) {
  return (
    <button
      type="button"
      className={`icon-button ${active ? 'active' : ''} ${className}`}
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
  const [locale, setLocale] = useState(getInitialLocale)
  const text = messages[locale]
  const numbers = useMemo(() => new Intl.NumberFormat(locale), [locale])
  const percent = useMemo(() => new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 }), [locale])
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
  const [draft, setDraft] = useState(initialSeed),
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
  const cityName = cityNameFor(locale, stats?.terrainName)
  useEffect(() => {
    document.documentElement.lang = locale
    try { localStorage.setItem(LANGUAGE_KEY, locale) } catch { /* Language switching also works without storage. */ }
  }, [locale])
  useEffect(() => {
    document.title = cityName
  }, [cityName])
  useEffect(() => {
    container.current?.querySelector('canvas')?.setAttribute('aria-label', legacy ? text.canvas2d : text.canvas3d)
  }, [legacy, progress, text.canvas2d, text.canvas3d])
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
        <h1 className="city-title">
          <a href={import.meta.env.BASE_URL}>{cityName}</a>
        </h1>
        <div className="header-actions">
          <div className="model-picker">
            <select
              aria-label={text.model}
              title={text.switchModel}
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
            aria-label={text.anotherCity}
            title={text.anotherCity}
            onClick={shuffle}
            disabled={progress < 1 && !error}
          >
            <Shuffle size={15} />
            <span>{text.anotherCity}</span>
          </button>
          <IconButton
            className="settings-button"
            label={panel ? text.collapseSettings : text.settings}
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
            aria-label={text.github}
            title={text.githubTitle}
          >
            <svg width="21" height="21" aria-hidden="true" focusable="false">
              <use href={`${import.meta.env.BASE_URL}icons.svg#github-icon`} />
            </svg>
          </a>
        </div>
      </header>
      {panel && (
        <aside className="inspector" aria-label={text.settings}>
          <div className="inspector-heading">
            <span>{text.notebook}</span>
            <IconButton label={text.closeSettings} onClick={() => setPanel(false)}>
              <X size={16} />
            </IconButton>
          </div>
          <div className="language-field">
            <label htmlFor="language"><Languages size={15} aria-hidden="true" />{text.language}</label>
            <div className="language-picker">
              <select id="language" value={locale} onChange={(e) => setLocale(e.target.value)}>
                {LANGUAGES.map(([id, name]) => <option key={id} value={id} lang={id}>{name}</option>)}
              </select>
              <ChevronDown size={14} aria-hidden="true" />
            </div>
          </div>
          <section className="inspector-section">
            <div className="section-title">
              <span>{text.now}</span>
              <span className="micro-label">{text.localTime}</span>
            </div>
            <div className="clock-row">
              <div className="clock">
                {clock(time)}
                <span>{time >= 6 && time < 18 ? text.day : text.night}</span>
              </div>
              <IconButton
                label={paused ? text.resume : text.pause}
                active={paused}
                onClick={() => config('paused', !paused, setPaused)}
              >
                {paused ? <Play size={17} /> : <Pause size={17} />}
              </IconButton>
            </div>
            <input
              className="time-range"
              aria-label={text.cityTime}
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
              <span>{text.speed}</span>
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
              <span>{text.weather}</span>
              <span className="micro-label">{text.atmosphere}</span>
            </div>
            <div className="weather-options">
              {[
                ['sun', Sun],
                ['rain', CloudRain],
                ['snow', Snowflake]
              ].map(([key, Icon]) => (
                <button
                  key={key}
                  className={weather === key ? 'selected' : ''}
                  aria-pressed={weather === key}
                  aria-label={text[`${key}Label`]}
                  onClick={() => config('weather', key, setWeather)}
                >
                  <Icon size={21} strokeWidth={1.4} />
                  <span>{text[key]}</span>
                </button>
              ))}
            </div>
          </section>
          <section className="inspector-section city-form">
            <div className="section-title">
              <span>{text.generation}</span>
              <span className="micro-label">{text.generationLabel}</span>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                generate()
              }}
            >
              <label htmlFor="seed">{text.seed}</label>
              <div className="seed-field">
                <input
                  id="seed"
                  value={draft}
                  maxLength={40}
                  onChange={(e) => setDraft(e.target.value)}
                />
                <IconButton
                  label={text.random}
                  onClick={shuffle}
                  disabled={progress < 1 && !error}
                >
                  <Shuffle size={15} />
                </IconButton>
              </div>
              {!legacy && (
                <>
                  <div className="density-label">
                    <label htmlFor="density">{text.density}</label>
                    <span>{percent.format(density)}</span>
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
                    <label htmlFor="map-size">{text.size}</label>
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
                    <span>{text.standard}</span>
                    <span>{text.large}</span>
                    <span>{text.vast}</span>
                  </div>
                </>
              )}
              <button className="apply-button" type="submit" disabled={progress < 1 && !error}>
                <span>{text.generate}</span>
                <ChevronRight size={16} />
              </button>
            </form>
          </section>
          {stats && (
            <section className="city-census">
              <div>
                <Building2 size={16} />
                <b>{numbers.format(stats.buildings)}</b>
                <span>{text.buildings}</span>
              </div>
              <div>
                <TreePine size={16} />
                <b>{numbers.format(stats.trees)}</b>
                <span>{text.trees}</span>
              </div>
              <div>
                <Route size={16} />
                <b>{numbers.format(stats.bridges)}</b>
                <span>{text.bridges}</span>
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
              {text.credit}
              <ArrowUpRight size={12} />
            </a>
          )}
        </aside>
      )}
      <nav className="view-tools" aria-label={text.viewControls}>
        {!legacy && (
          <>
            <IconButton label={text.overhead} onClick={() => city.current?.overview()}>
              <Map size={18} />
            </IconButton>
            <IconButton
              label={text.orbit}
              active={mode === 'orbit'}
              onClick={() => config('mode', 'orbit', setMode)}
            >
              <Orbit size={19} />
            </IconButton>
          </>
        )}
        <IconButton
          label={text.pan}
          active={legacy || mode === 'pan'}
          onClick={() => {
            if (!legacy) config('mode', 'pan', setMode)
          }}
        >
          <Move size={18} />
        </IconButton>
        <span className="toolbar-divider" />
        <IconButton label={text.zoomIn} onClick={() => city.current?.zoom(1.2)}>
          <ZoomIn size={19} />
        </IconButton>
        <IconButton label={text.zoomOut} onClick={() => city.current?.zoom(1 / 1.2)}>
          <ZoomOut size={19} />
        </IconButton>
        <IconButton label={text.reset} onClick={() => city.current?.reset()}>
          <RotateCcw size={17} />
        </IconButton>
        <span className="toolbar-divider" />
        {!legacy && (
          <IconButton
            label={text.autoOrbit}
            active={autoRotate}
            onClick={() => config('autoRotate', !autoRotate, setAutoRotate)}
          >
            <Compass size={18} />
          </IconButton>
        )}
        <IconButton
          label={text.export}
          onClick={() => city.current?.screenshot()}
          disabled={progress < 1}
        >
          <Camera size={18} />
        </IconButton>
      </nav>
      <div className="world-status">
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
                ? text.loading2d
                : progress < 0.28
                  ? text.loadingPlan
                  : progress < 0.64
                    ? text.loadingModels
                    : progress < 0.9
                      ? text.loadingTerrain
                      : text.loadingLights}
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
          <h2>{text.loadError}</h2>
          <p>{error}</p>
          <button onClick={() => generate()}>{text.retry}</button>
        </div>
      )}
    </main>
  )
}
