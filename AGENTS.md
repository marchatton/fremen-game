# AGENTS.md - Fremen Game Development Guide

## Quick Reference

**Project**: Tactical multiplayer sandworm riding game (Dune-themed)  
**Tech Stack**: Three.js + Node.js + Socket.io + TypeScript + DrizzleORM + PostgreSQL  
**Package Manager**: pnpm (monorepo with workspaces)  
**Development Phase**: Pre-VS1 (Documentation complete, implementation starting)

## Commands

### Development
- **Build**: `pnpm run build` (single package) or `pnpm run --parallel build` (all packages)
- **Dev**: `pnpm run dev` (starts client with HMR + server with nodemon)
- **Test**: `pnpm test` (runs all tests across workspaces)
- **Test Single**: `pnpm --filter @fremen/client test` (test specific package)
- **Lint**: `pnpm run lint`
- **Typecheck**: `pnpm run typecheck`

### Workspace-Specific
```bash
# Run command in specific workspace
pnpm --filter @fremen/client <command>
pnpm --filter @fremen/server <command>
pnpm --filter @fremen/protocol <command>

# Add dependency to workspace
pnpm --filter @fremen/client add three
pnpm --filter @fremen/server add socket.io
```

## Architecture Overview

### Monorepo Structure
```
apps/
  client/          # Three.js + Vite frontend
  server/          # Node.js + Socket.io backend
packages/
  shared/          # Types, constants, utilities
  protocol/        # Network message schemas (C_*, S_*)
  config/          # Shared tsconfig/eslint
```

### Key Systems
- **Client Prediction**: Buffer 200ms inputs, predict locally, reconcile on server update
- **Server Authority**: Fixed 30-60hz tick loop, validates all inputs, broadcasts 10-20hz
- **Interest Management**: 32m×32m grid, only send entities within 300m of player
- **State Sync**: JSON initially → binary when >50 kbps/player or tick CPU >60%
- **Bot Backfill**: Always fill to 4 entities (humans + bots) to ensure viable matches

### Network Protocol
- **C_INPUT**: Client → Server (movement, actions) with sequence numbers
- **S_STATE**: Server → Client (delta updates, 10-20hz) with `lastProcessedInputSeq` for reconciliation
- **S_SNAPSHOT**: Full state every 5 seconds to prevent drift
- **S_EVENT**: One-time events (damage, collection, etc.)

See [docs/05-diagrams.md](docs/05-diagrams.md) for visual references.

## Code Style & Principles

### Philosophy (SOLID, DRY, KISS, YAGNI)
- **TDD**: Test-first for core logic (state sync, worm AI, resource validation, network protocol)
- **SOLID**: Single responsibility, open/closed, dependency inversion
- **DRY**: Business rules have one source of truth (define in `packages/shared`, use everywhere)
- **KISS**: Simplest solution first (JSON protocol, in-memory state, no Redis initially)
- **YAGNI**: Skip features until metrics prove necessity (binary protocol, advanced scaling, etc.)

### TypeScript
- **Strict mode**: Enabled across all packages
- **No `any`**: Use `unknown` and narrow with type guards
- **Shared types**: Define in `packages/shared/src/types/`, import everywhere
- **Protocol types**: Define in `packages/protocol/src/messages.ts`

### Testing Strategy
```typescript
// Unit tests: Pure functions, deterministic
describe('TerrainGenerator', () => {
  it('generates same terrain from same seed', () => {
    const terrain1 = generateTerrain(SEED);
    const terrain2 = generateTerrain(SEED);
    expect(terrain1).toEqual(terrain2);
  });
});

// Integration tests: Client-server interaction
describe('Worm Attraction', () => {
  it('worm moves toward thumper', async () => {
    const server = await startTestServer();
    const client = await connectTestClient();
    await client.deployThumper([10, 0, 10]);
    await wait(2000);
    const worm = server.getWorm(0);
    expect(worm.target).toBeCloseTo([10, 0, 10]);
  });
});
```

### Low-Poly Art Style
- **Polygon Targets**: Characters 150-300, Objects 50-200, Worm segments 100-150
- **Vertex Colors**: Primary coloring method (avoid textures where possible)
- **LOD Levels**: Minimum 2 levels (full detail <50m, simplified >50m)
- **Procedural Generation**: Use `LowPolyMeshFactory` in `apps/client/src/lowpoly/`

### Performance Targets
- **Client**: 60fps on GTX 1060 / RX 580 with 20 visible entities
- **Server**: 30-60hz tick stable with 8 players per room
- **Network**: <30 kbps/player (JSON), <20 kbps/player (binary)
- **Latency**: Playable at 150ms RTT with prediction/reconciliation

## Directory Conventions

### Client (`apps/client/src/`)
```
core/           # Renderer, Camera, InputManager, AssetManager
entities/       # Player, Worm, Thumper, AI (visual representations)
networking/     # NetworkManager, prediction, reconciliation
lowpoly/        # LowPolyMeshFactory, procedural generation
terrain/        # Chunk management, heightmap, LOD
materials/      # MaterialManager, shader setup
shaders/        # GLSL vertex/fragment shaders
physics/        # Client-side prediction physics
ui/             # HUD, menus, chat (HTML/CSS overlay)
tests/          # Unit/integration tests
```

### Server (`apps/server/src/`)
```
game/
  loop.ts       # Fixed timestep game loop (30-60hz)
  room.ts       # Room/session management
  sim/          # Pure simulation systems (movement, worm AI, combat)
  interest.ts   # Interest management grid
networking/
  socketServer.ts    # Socket.io setup
  messageRouter.ts   # Route C_* messages to handlers
  stateSync.ts       # Delta compression, broadcast logic
auth/           # JWT generation/validation, middleware
db/             # DrizzleORM schema, migrations, queries
bots/           # Bot AI, backfill logic
matchmaking/    # Queue management, room assignment
tests/          # Unit/integration tests
```

## Security & Validation

- **Server Authority**: ALL game state changes validated server-side
- **Input Validation**: Check distance, speed, physics constraints on every C_INPUT
- **Idempotency**: Use action IDs (client-generated UUID) to prevent duplicate resource operations
- **Transactions**: Wrap all resource changes in DB transactions
- **Rate Limits**: Max 10 actions/second per player, 1 chat message/2 seconds
- **Anti-Cheat**: Log speed hacks, teleports, clipping; kick after 3 offenses in 5 minutes

## Common Patterns

### Adding a New Entity Type
1. Define in `packages/shared/src/types/entity.ts`
2. Add server-side simulation in `apps/server/src/game/sim/`
3. Add client-side rendering in `apps/client/src/entities/`
4. Update `S_STATE` message to include new entity data
5. Add tests for spawning, updating, removing

### Adding a New Network Message
1. Define type in `packages/protocol/src/messages.ts`
2. Add handler in `apps/server/src/networking/messageRouter.ts`
3. Emit from client in `apps/client/src/networking/NetworkManager.ts`
4. Add validation tests
5. Document in `docs/02-network-protocol.md`

### Adding a New Objective Type
1. Define in `packages/shared/src/types/objective.ts`
2. Add server-side logic in `apps/server/src/game/sim/objectiveManager.ts`
3. Add client-side UI in `apps/client/src/ui/ObjectiveTracker.ts`
4. Add completion validation and reward distribution
5. Add tests for success/failure conditions

## Documentation

**Always consult these docs before implementing major features**:

1. **[00-overview.md](docs/00-overview.md)** - Vision, MVP, success metrics
2. **[01-architecture.md](docs/01-architecture.md)** - Monorepo, state sync, persistence strategy
3. **[02-network-protocol.md](docs/02-network-protocol.md)** - Message schemas, timing, interest management
4. **[03-gameplay-mechanics.md](docs/03-gameplay-mechanics.md)** - Worm behavior, combat, resources
5. **[04-edge-cases-resilience.md](docs/04-edge-cases-resilience.md)** - Bot backfill, disconnects, exploits
6. **[05-diagrams.md](docs/05-diagrams.md)** - Visual architecture (data flow, timing, packages)
7. **[milestones/](docs/milestones/)** - VS1-VS6 detailed requirements

## Current Milestone: Pre-VS1

**Next Steps** (in order):
1. Set up pnpm workspace (`pnpm-workspace.yaml`)
2. Create `packages/shared`, `packages/protocol`, `packages/config`
3. Initialize `apps/client` (Vite + Three.js + TypeScript)
4. Initialize `apps/server` (Node.js + Socket.io + TypeScript)
5. Set up ESLint/TypeScript configs
6. Implement basic CI pipeline (GitHub Actions)

See [docs/milestones/VS1-online-sandbox.md](docs/milestones/VS1-online-sandbox.md) for VS1 detailed checklist.

## When to Ask for Help

- **Architecture decisions**: Consult docs first, then ask human if unclear
- **Performance issues**: Profile first, share metrics, discuss optimization
- **Edge cases not covered**: Check [docs/04-edge-cases-resilience.md](docs/04-edge-cases-resilience.md), then ask
- **Testing strategy**: Follow patterns in milestone docs
- **Protocol changes**: Document in `docs/02-network-protocol.md` and update [docs/05-diagrams.md](docs/05-diagrams.md)

## Remember

- **Build vertically** (end-to-end features) not horizontally (layers across all features)
- **Test first** for core systems (movement, state sync, combat, resources)
- **Start simple** (JSON, in-memory) and add complexity only when metrics demand it
- **Bot backfill** ensures game is playable even with low player count
- **Fun first** - VS2 (worm riding) must be engaging or the game fails
