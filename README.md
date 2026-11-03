# FIELD — WebGL home

Public-deployable Vite + Three homepage.

- Procedural warehouse bay (`src/stage.js`) — walls, beams, floods
- Cool blue-white screen FBO (`src/screenFbo.js`)
- CC0 garage props + controllable Fox (`WASD` + drag look) — see `ATTRIBUTION.md`

## Run

```powershell
cd webgl-home
npm install
npm run dev
```

## Build & deploy

```powershell
npm run build
```

Upload `dist/` to any static host, or deploy to Cloudflare Workers static assets:

```powershell
npm run deploy
```

Cloudflare CI: build `npm run build`, deploy `npx wrangler deploy`（仓库已含 `wrangler.jsonc`，指向 `dist/`）。

Dependencies: `three` (MIT), `vite` / `wrangler` (dev). Google Fonts are loaded from Google CDN in `index.html` — optional; remove the `<link>` tags if you want zero third-party requests.
