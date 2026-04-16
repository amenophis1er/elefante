---
id: 21
title: "CLI: elefante serve — local web dashboard"
status: planned
labels: [ui, cli, v0.3]
created: 2026-04-15
priority: medium
supersedes: [0020-web-dashboard]
---

Visual dashboard for browsing, searching, and managing vault memories. Runs as a local HTTP server started explicitly via `elefante serve`.

## Motivation

The CLI and MCP tools cover agent workflows well, but humans sometimes want to browse memories visually — scan by type, read rendered markdown, spot stale entries, bulk-manage. The GitHub file browser works but isn't purpose-built. A local dashboard fills this gap without adding complexity to the MCP server.

## UX

### Starting the dashboard

```
elefante serve              # random port, opens browser
elefante serve -p 3333      # fixed port
elefante serve --no-open    # don't auto-open browser
npx elefante-mcp serve      # works without global install
```

Output on startup:

```
Elefante dashboard
http://localhost:54321?token=a8f3c9...
Press Ctrl+C to stop.
```

### Security model

- Bind to `127.0.0.1` only — no network exposure
- Generate a random token on each startup (crypto.randomUUID)
- Every request must include `?token=` or `Authorization: Bearer` header
- No token → 401. No exceptions.
- Token is printed at startup and included in the auto-opened URL
- No persistent sessions, no cookies, no user accounts

### The MCP server is not involved

`elefante serve` is a standalone process. It reads and writes the vault directly using the same `memory.ts`, `indexer.ts`, and `vault.ts` modules. The MCP server stays stdio-only with zero HTTP surface.

Both can run concurrently — they share the same Git-backed vault. Writes from either side are picked up by the other on next sync/cache invalidation.

## Dashboard features

### Memory list (home)
- Table/card view of all memories
- Filter by type (user, feedback, project, reference), profile, tags
- Sort by updated, created, importance
- Search bar (reuses trigram + keyword engine from indexer.ts)
- Search result highlighting

### Memory detail
- Rendered markdown body
- Metadata sidebar: type, profile, tags, importance, timestamps
- Edit button → inline editor with live preview
- Delete with confirmation

### Vault overview
- Memory count by type (bar/pie chart)
- Memory count by profile
- Most accessed memories
- Recently updated timeline
- Sync status (clean/dirty, last commit, ahead/behind remote)

## Stack

| Layer | Choice | Why |
|-------|--------|-----|
| UI framework | React 19 | Lightweight, fast to build |
| Styling | Tailwind CSS 4 | Utility-first, no CSS files to manage |
| Build tool | Vite | Fast dev, clean production builds |
| HTTP server | Node built-in `http` | Zero dependencies, serve static + API |
| API format | JSON REST | Simple, standard |
| Bundling | Pre-built into `dist/dashboard/` | No Vite runtime needed in production |

## Distribution: bundled in npm package

The built dashboard ships inside the npm package — no CDN, no external hosting, no build step at runtime. Same pattern as tools like `verdaccio` or `pgweb`.

**Build pipeline:**
```
npm run build           → tsc (server + CLI → dist/)
npm run build:dashboard → vite build (React app → dist/dashboard/)
npm publish             → ships both dist/ and dist/dashboard/
```

**At runtime:** `elefante serve` (or `npx elefante-mcp serve`) serves static files directly from the package's `dist/dashboard/` directory. No Vite, no compilation, no network fetch.

**Package size impact:** A React + Tailwind app builds to ~200-400KB gzipped. Acceptable for a CLI tool.

**package.json `files` field** must include `dist/dashboard/` so it's included in the tarball.

## API endpoints

All require valid token. Reuse existing module functions directly.

```
GET    /api/memories          → listMemories(filters)
GET    /api/memories/:id      → readMemory(id)
POST   /api/memories          → createMemory(body)
PUT    /api/memories/:id      → updateMemory(id, body)
DELETE /api/memories/:id      → deleteMemory(id)
GET    /api/search?q=         → search(query, filters)
GET    /api/status            → vault.getStatus()
POST   /api/sync              → vault.pull() + vault.push()
GET    /api/profiles          → list known profiles
```

Static files served from `dist/dashboard/` for all non-`/api` routes (SPA fallback).

## Project structure

```
src/
├── server.ts               # HTTP server, token auth, routing
├── dashboard/
│   ├── index.html
│   ├── main.tsx
│   ├── App.tsx
│   ├── components/
│   │   ├── MemoryList.tsx
│   │   ├── MemoryDetail.tsx
│   │   ├── MemoryEditor.tsx
│   │   ├── SearchBar.tsx
│   │   ├── Filters.tsx
│   │   └── VaultOverview.tsx
│   └── lib/
│       └── api.ts           # fetch wrapper with token
├── cli.ts                   # add `serve` command
└── ...existing files
```

Vite config builds `src/dashboard/` → `dist/dashboard/`.

## Files to modify

- `src/cli.ts` — Add `serve` command with `--port` and `--no-open` options
- `src/server.ts` — New file: HTTP server, token middleware, API routes, static file serving
- `src/dashboard/**` — New files: React app
- `package.json` — Add Vite, React, Tailwind as devDependencies; add `build:dashboard` script
- `vite.config.ts` — New file for dashboard build config
- `tsconfig.json` — Include JSX transform for dashboard sources

## Implementation phases

### Phase 1 — Server + API (no UI)
- `elefante serve` starts HTTP server with token auth
- All REST endpoints working
- Testable with curl

### Phase 2 — Read-only dashboard
- Memory list with filters and search
- Memory detail with rendered markdown
- Vault overview stats

### Phase 3 — Write operations
- Create/edit/delete from the UI
- Sync button
- Optimistic updates

## Edge cases

- **Port conflict**: If requested port is busy, fail with a clear message (don't silently pick another)
- **Vault not initialized**: Show a friendly "run `elefante init` first" page instead of crashing
- **Concurrent MCP writes**: Dashboard reads stale data until next list/search call — acceptable for a local tool
- **Large vaults**: Paginate memory list (default 50 per page)
- **Token in URL**: Browsers save this in history — acceptable for localhost, but document it

## Testing

- Unit tests for server.ts: token validation, route matching, error responses
- Integration test: start server, hit API endpoints, verify CRUD
- E2E: Playwright test for core flows (list → detail → edit → save)
- Verify dashboard builds cleanly and serves from dist/
