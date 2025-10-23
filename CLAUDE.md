# CLAUDE.md (Merged Lite)

**Purpose:** Lean, repo-specific guardrails for Claude Code. Keep instructions tight; surface only what the agent must honor. Defaults for this repo: **pnpm** workspaces, Vite + Three.js client, Socket.io Node server, TypeScript (strict), Vitest, DrizzleORM + PostgreSQL (VS3+).

**Claude-critical overlays:**
- Keep `.claude/settings.json` allowlisting `Edit`, vetted `Bash(...)`, and trusted MCP servers.
- Start sessions by reading the relevant docs (`docs/01-architecture.md`, milestone briefs) and diff targets before edits/tests.
- Always plan (think step-by-step) before modifying code or running commands.
- Use `/clear` between tasks; maintain scratchpads for long TODOs or calculations.
- Gate automation with tests or scripts: e.g. `claude -p "run pnpm test" --output-format stream-json` followed by result verification.

---

## 0) Engineering Principles

* **TDD**: add a failing Vitest (server/shared) or client test before fixes/features.
* **KISS**: prefer deterministic, easily simulated systems; keep client visuals simple.
* **YAGNI**: stay within the current milestone scope (JSON protocol, in-memory loop until VS3 persistence).
* **DRY**: rely on `@fremen/shared` + `@fremen/protocol` for constants/types instead of duplicating shapes.

## 1) Project Profile & Non-negotiables

* **Monorepo:** pnpm workspaces (`apps/*`, `packages/*`)
* **Client:** `apps/client` — Vite + Three.js + TypeScript
* **Server:** `apps/server` — Node.js + Socket.io + TypeScript (tsx watcher)
* **Shared packages:** `@fremen/shared` (constants, terrain, enums), `@fremen/protocol` (message contracts), `@fremen/config`
* **Persistence:** DrizzleORM + PostgreSQL introduced in VS3 (schema + persistence helpers ready but optional until resources ship)
* **Networking:** JSON messages with reconciliation (`S_STATE` + `lastProcessedInputSeq`), interest management planned
* **Testing:** Vitest for unit/integration (server + shared); client coverage TBD but expected
* **Docs:** treat milestone docs as single source of truth; update when behavior changes

---

## 2) Structure & Security Boundaries

**Repo top-level**

```
/
  apps/
    client/            # Three.js/Vite frontend
    server/            # Socket.io authoritative backend
  packages/
    shared/            # shared types/constants/utilities
    protocol/          # network message schemas/helpers
    config/            # eslint + tsconfig bases
  docs/                # architecture, protocol, gameplay, milestones
```

**Client (`apps/client/src`)**

```
core/           # renderer, camera, input, prediction
entities/       # Player, Worm, Thumper visuals
networking/     # NetworkManager, reconciliation, HUD hooks
terrain/        # TerrainManager & procedural chunks
ui/             # HUD, chat, prompts (DOM overlays)
```

**Server (`apps/server/src`)**

```
auth/           # JWT helpers
 db/            # Drizzle schema/config/persistence (VS3)
 game/
   GameLoop.ts       # 30 Hz tick
   Room.ts           # session + thumpers
   sim/              # deterministic systems (Physics, WormAI, WormDamage)
   ObjectiveManager.ts
 integration.test.ts
```

**Critical Rules**

* Server owns authority; clients never mutate world state directly.
* Import message/types from `@fremen/shared` / `@fremen/protocol`; no bespoke shapes.
* Reconcile inputs using `lastProcessedInputSeq`; keep broadcast payloads compatible with client expectations.
* When persistence is involved, use `db/persistence.ts` helpers (transactions, autosave manager) and update `.env.example`.
* Protocol or gameplay changes must be mirrored in docs (`docs/02-network-protocol.md`, milestone summaries).
* Reflect interest-management or tick-rate adjustments in the protocol docs so other agents stay aligned with bandwidth/CPU targets.

---

## 3) Do / Don't (Repo-specific)

**Do**

* Use **pnpm** with filters (`pnpm --filter @fremen/server ...`).
* Extend game logic inside `game/sim` modules to preserve determinism.
* Add/update Vitest suites for worm AI, mount/dismount, objective flow, resource systems.
* Keep shared constants single-sourced in `packages/shared/src/constants`.
* Run manual sandbox checks per `TESTING.md` when touching client render/input loops.
* Amend `TESTING.md` when procedural changes alter the sandbox walkthrough (new objectives, UI prompts, etc.).

**Don't**

* Introduce dependencies that break Vite bundling or inflate client footprint without review.
* Duplicate protocol definitions or mutate message shapes locally.
* Commit DB schema tweaks without Drizzle migration + env alignment.
* Skip docs/tests when adjusting milestone-critical behaviour.

---

## 4) Commands (pnpm)

```bash
# Install
pnpm install

# Dev
pnpm run dev                  # client + server
pnpm run dev:client           # Vite only
pnpm run dev:server           # Socket.io server

# Workspace shortcuts
pnpm --filter @fremen/client dev
pnpm --filter @fremen/server dev
pnpm --filter @fremen/server test
pnpm --filter @fremen/shared test

# Build / Type / Lint
pnpm run build
pnpm run typecheck
pnpm run lint

# Tests
pnpm test                     # all workspaces
```

Use Claude shell commands sparingly and prefer `pnpm --filter ...` rather than manual `cd`.

---

## 5) Git & Hooks (concise)

* **Commits:** Conventional style recommended (`feat(client): ...`, `fix(server): ...`).
* **Hooks:** None configured; run `pnpm run lint`, `pnpm run typecheck`, `pnpm test` before pushing.
* Keep gameplay/doc/test changes in the same commit when feasible for clarity.

---

## 6) Lint / Format / Scan

* **ESLint:** base config in `packages/config/eslint.config.js`; call via `pnpm run lint` or workspace filters.
* **TypeScript:** strict settings from `packages/config/tsconfig.base.json`; ensure `pnpm run typecheck` passes.
* **Formatting:** follow existing style (no project-wide Prettier). Clean up TODO code/comments when possible.
* **Static analysis:** rely on Vitest + lint/typecheck; interest grid/bot logic should be validated with deterministic tests.

---

## 7) Testing (minimal but effective)

* **Server:** Vitest suites cover GameLoop, Room, mount/dismount, worm steering/damage. Extend when modifying simulation or resource logic.
* **Shared:** Terrain generator + resource constants should stay deterministic; update tests alongside changes.
* **Client:** Manual sandbox walkthrough per `TESTING.md`; add unit/integration tests under `apps/client/src/tests` when client logic grows.
* **Rule:** bug → failing test → fix → green. Keep tests fast (<5 s) and seeded when randomness is involved.
