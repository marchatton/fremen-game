# AGENTS.md (Merged Lite)

**Purpose:** Lean, repo-specific guardrails for Codex. Be precise; skip agent meta. Defaults for this repo: **pnpm** workspaces, Vite + Three.js client, Socket.io Node server, TypeScript (strict), Vitest, DrizzleORM + PostgreSQL (VS3+).

---

## 0) Engineering Principles

- **TDD**: write or update a failing test (Vitest) before gameplay/state fixes.
- **KISS**: favour simple deterministic server logic and lightweight client visuals.
- **YAGNI**: ship only what the current milestone needs (JSON protocol, in-memory state unless persistence is required).
- **DRY**: put shared types/constants in `packages/shared` or `packages/protocol`; keep client/server copies in sync through those packages.

## 1) Project Profile & Non-negotiables

- **Monorepo:** pnpm workspaces (`apps/*`, `packages/*`)
- **Client:** `apps/client` — Vite + Three.js + TypeScript, HUD via HTML overlays
- **Server:** `apps/server` — Node.js + Socket.io + TypeScript (tsx watcher), authoritative game loop @30 Hz
- **Shared packages:** `@fremen/shared` (constants, types, terrain), `@fremen/protocol` (message schemas), `@fremen/config` (ESLint/TS configs)
- **Database:** DrizzleORM + PostgreSQL (VS3 resource loop). Treat as planned but optional; wrap writes in transactions
- **Networking:** JSON protocol with reconciliation; all messages defined in `packages/protocol`
- **Testing:** Vitest across server/shared (unit + integration); client tests to live under `apps/client/src/tests`
- **Docs:** Core references in `docs/00-overview.md`, `docs/01-architecture.md`, `docs/04-edge-cases-resilience.md`, milestone specs

---

## 2) Structure & Security Boundaries

**Repo top-level**

```
/
  apps/
    client/            # Vite + Three.js frontend
    server/            # Socket.io authoritative server
  packages/
    shared/            # shared types/constants/terrain utilities
    protocol/          # network message contracts & helpers
    config/            # eslint + tsconfig bases
  docs/                # design + milestone documentation
  old-docs/            # legacy planning (read-only)
```

**Client (`apps/client/src`)**

```
core/           # Renderer, camera, input, prediction
entities/       # Player, Worm, Thumper visuals
networking/     # NetworkManager, reconciliation
terrain/        # TerrainManager, chunk loading
ui/             # HUD, chat, prompts (DOM overlays)
```

**Server (`apps/server/src`)**

```
auth/           # JWT helpers
 game/
   GameLoop.ts       # fixed tick loop (30 Hz)
   Room.ts           # session management & thumpers
   sim/              # deterministic systems (Physics, WormAI, WormDamage)
   ObjectiveManager.ts
 db/             # Drizzle schema/config/persistence (VS3)
integration.test.ts  # server integration tests
```

**Critical Rules**

- Server remains the single authority; never apply client-side state changes without server validation.
- Keep shared schema/types in `packages/shared`/`packages/protocol`; avoid ad hoc type copies in client/server code.
- Broadcasts must include `lastProcessedInputSeq`; reconciliation logic expects it.
- Wrap resource persistence in transactions; Drizzle helpers live in `apps/server/src/db`.
- When adding protocol messages or entities, follow the documented steps (update shared types, server logic, client visuals, tests, docs).
- Audit interest-management and broadcast frequency changes against `docs/02-network-protocol.md` and capture deltas in the protocol docs whenever thresholds shift.
- Keep resilience/edge-case handling aligned with `docs/04-edge-cases-resilience.md`; update that doc when disconnect/bot/backfill behaviour changes.

---

## 3) Do / Don’t (Repo-specific)

**Do**

- Use **pnpm** with workspace filters (`pnpm --filter @fremen/* ...`).
- Consult milestone docs before new systems; keep documentation updated alongside code.
- Extend simulation/gameplay via `sim/` modules to preserve determinism.
- Add or update Vitest suites (server + shared) for game loop, worm AI, resource logic.
- Reuse `TerrainGenerator` + constants from `@fremen/shared`; avoid duplicating math in client/server.
- Document any protocol/schema changes in `docs/02-network-protocol.md` and regenerate diagrams if needed.
- Note manual playtest expectations by updating `TESTING.md` whenever sandbox steps change (e.g. new HUD flow or riding controls).
- Update `docs/04-edge-cases-resilience.md` when altering disconnect handling, bot policies, or anti-cheat flows.

**Don’t**

- Introduce new runtime deps without confirming cross-workspace impact (client bundle size & server perf).
- Hardcode duplicate message shapes in client/server; import from `@fremen/protocol` instead.
- Bypass persistence helpers when VS3 systems are active (use `persistence.ts`, transactions, autosave manager).
- Commit migrations or schema edits without aligning Drizzle config + `.env.example`.

---

## 4) Commands (pnpm)

```bash
# Install
pnpm install

# Dev (both client + server)
pnpm run dev
pnpm run dev:client
pnpm run dev:server
pnpm --filter @fremen/client dev
pnpm --filter @fremen/server dev

# Build
pnpm run build            # all workspaces
pnpm --filter @fremen/client build
pnpm --filter @fremen/server build

# Tests
pnpm test                 # all workspaces
pnpm --filter @fremen/server test
pnpm --filter @fremen/shared test

# Lint / Typecheck
pnpm run lint
pnpm run typecheck
pnpm --filter @fremen/client lint
pnpm --filter @fremen/server typecheck
```

**Root `package.json` scripts**

```json
{
  "scripts": {
    "build": "pnpm --parallel build",
    "dev": "pnpm --parallel --filter @fremen/server --filter @fremen/client dev",
    "dev:server": "pnpm --filter @fremen/server dev",
    "dev:client": "pnpm --filter @fremen/client dev",
    "test": "pnpm --parallel test",
    "lint": "pnpm --parallel lint",
    "typecheck": "pnpm --parallel typecheck"
  }
}
```

---

## 5) Git & Hooks (concise)

- **Commits:** Conventional style encouraged (`feat(server): ...`, `fix(protocol): ...`, `docs(milestone): ...`).
- **Hooks:** No Husky configured yet. Before pushing run `pnpm run lint`, `pnpm run typecheck`, `pnpm test` manually.
- Keep gameplay changes small & reviewable; include docs/tests in same commit when practical.

---

## 6) Lint / Format / Scan

- **ESLint:** shared flat config in `packages/config/eslint.config.js`; run via `pnpm run lint` or workspace filters.
- **TypeScript:** strict configs per workspace (extends `packages/config/tsconfig.base.json`).
- **Formatting:** rely on ESLint + editor formatting; no repo-wide Prettier yet—match existing style.
- **Static analysis:** `pnpm run typecheck` across workspaces; add Vitest coverage for complex logic.

---

## 7) Testing (minimal but effective)

- **Server:** Vitest suites for `game/` systems (GameLoop, WormAI, Mount/Dismount, RateLimiter). Add deterministic tests for new simulation logic or resource rules.
- **Shared:** Terrain generator + utility tests live in `packages/shared`; extend when changing constants/math.
- **Client:** Future Three.js/unit tests reside in `apps/client/src/tests`; at minimum run manual HMR session per `TESTING.md` when touching rendering/input.
- **Rule:** bug → failing test → fix → green. Keep integration tests fast (<5 s) and deterministic (no randomness without seeding).
