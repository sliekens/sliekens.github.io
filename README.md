# Palace of Nerdy Collections

A walkable 3D museum of my GitHub activity, served as a fully static site at
[sliekens.github.io](https://sliekens.github.io/).

Built with [Three.js](https://threejs.org/), TypeScript, and Vite — no backend,
no frameworks, no tokens in the browser.

## The floor plan

```text
                Repository Gallery (north)
                pedestals + crystals sized by stars,
                colored by language
                          |
Contribution Garden —— Rotunda —— Activity Timeline (east)
(west)                    |        recent public events
walkable heatmap of       |        as wall tablets
the past year         About (south)
                      bio, links, oldest artifact
```

- **Rotunda** — avatar hologram, headline stats (repos, stars, followers, contributions).
- **Repository Gallery** — top repositories as exhibits. Crystal size = stars, color = primary language. A featured repo gets the dais at the far end.
- **Contribution Garden** — every day of the past 53 weeks as a glowing tile in a sunken pit; hover any tile to inspect that day. Streak and busiest-day stats on the walls.
- **Activity Timeline** — the most recent public events as tablets, newest first.
- **About** — bio, profile links, and the oldest public repository, excavated for display.

Everything glowing is clickable: the camera glides to the exhibit and an
in-world panel shows details with links out to GitHub. Repos with GitHub Pages
get an embedded **live demo** iframe. There is also an accessible 2D **list
view** (`L`) with filtering, which doubles as the no-WebGL fallback.

## Controls

| Input | Action |
| --- | --- |
| `WASD` / arrows | walk |
| mouse | look (click the canvas to grab the cursor) |
| click | inspect the exhibit under the cursor/crosshair |
| `Shift` | run |
| `1`–`5` | teleport between rooms |
| `H` | visitor guide |
| `L` | list view |
| `Esc` | release cursor / close panels |

On touch devices: left half of the screen moves, right half looks, tap to
inspect.

## How the data works

```text
GitHub Actions (daily cron + every push)
  └─ scripts/fetch-github-data.ts   ← GITHUB_TOKEN (workflow default)
       ├─ REST: profile, repos, public events
       ├─ GraphQL: contribution calendar, pinned repos
       └─ writes public/data/github.json
            └─ static site fetches it at runtime
                 └─ + a tokenless freshness fetch of recent public
                     events on page load (silently skipped if rate-limited)
```

No token ever ships to the browser. The committed `github.json` snapshot keeps
local dev and forks working offline; CI regenerates it on every build. If the
fetch fails mid-build (rate limits), the previous snapshot is kept so deploys
never break.

## Development

```powershell
npm install
npm run dev          # vite dev server
npm run fetch-data   # refresh public/data/github.json (optional: $env:GITHUB_TOKEN = (gh auth token))
npm run build        # typecheck + production build into dist/
npm run preview      # serve the production build
```

Without a token, `fetch-data` still works against the public API but
approximates the contribution calendar from recent events.

In dev builds, `window.__museum` exposes `{ controls, camera, world, teleport, select }`
for driving the camera from the console.

## Deploying

1. Push to `main`.
2. In the repo settings, set **Pages → Build and deployment → Source** to
   **GitHub Actions** (one-time setup).
3. `.github/workflows/deploy.yml` builds and deploys, and a daily cron keeps
   the exhibits fresh.

## Adapting it for your own profile

Change `GITHUB_USER` in [src/config.ts](src/config.ts), delete
`public/data/github.json`, run `npm run fetch-data`, and you have your own
palace.

## Performance notes

- All static architecture is merged into a handful of draw calls
  (`GeometryBatcher`); the contribution heatmap is a single `InstancedMesh`.
- No shadow maps — lighting is emissive trim + a few point lights + an
  environment map, with UnrealBloom for the glow.
- Bloom and pixel ratio drop automatically if the frame rate sags (or toggle
  `FX` in the top bar). `prefers-reduced-motion` disables head bob, idle
  animations, and camera glides.
