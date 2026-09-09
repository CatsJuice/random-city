# City Atlas

A procedural city generator with rivers, mountains, roads, bridges, buildings, and vegetation. Explore miniature cities with animated traffic, pedestrians, and boats, day-night cycles, and sunny, rainy, or snowy weather.

Generate reproducible cities from seeds, adjust map size and density, and pan, rotate, or zoom the 3D view. A legacy Canvas renderer is also included.

## Tech Stack

- React 19, JavaScript, and Vite 8
- Three.js / WebGL, with Canvas 2D for the legacy renderer
- Web Workers and PathFinding.js for generation and navigation
- CSS, Lucide icons, and Kenney CC0 models
- ESLint, the Node.js test runner, and Playwright

## Development

Use Node.js 24 and npm.

```sh
git clone https://github.com/CatsJuice/random-city.git
cd random-city
npm ci
npm run dev
```

Open the local URL printed by Vite.

Build and preview:

```sh
npm run build
npm run preview
```

Run checks:

```sh
npm run lint
npm test
```
