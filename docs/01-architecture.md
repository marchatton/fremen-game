# Architecture & Codebase Structure

## Monorepo Layout (pnpm Workspaces)

```
fremen-game/
├── apps/
│   ├── client/          # Three.js + Vite frontend
│   │   ├── src/
│   │   │   ├── core/        # Engine (Renderer, Camera, InputManager)
│   │   │   ├── entities/    # Player, Worm, Thumper, AI
│   │   │   ├── networking/  # NetworkManager, prediction/reconciliation
│   │   │   ├── lowpoly/     # LowPolyMeshFactory, procedural generation
│   │   │   ├── terrain/     # Chunk management, heightmap
│   │   │   ├── materials/   # MaterialManager, vertex colors
│   │   │   ├── shaders/     # GLSL (terrain, toon)
│   │   │   ├── physics/     # Client-side prediction physics
│   │   │   ├── ui/          # HUD, menus, chat (HTML/CSS overlay)
│   │   │   └── tests/       # Unit/integration tests
│   │   ├── public/
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   └── package.json
│   │
│   └── server/          # Node.js + Socket.io backend
│       ├── src/
│       │   ├── game/
│       │   │   ├── loop.ts          # Authoritative fixed-tick loop (30-60hz)
│       │   │   ├── room.ts          # Room/session management
│       │   │   ├── sim/             # Pure simulation systems (movement, worm AI, combat)
│       │   │   └── interest.ts      # Interest management grid
│       │   ├── networking/
│       │   │   ├── socketServer.ts  # Socket.io setup, handlers
│       │   │   ├── messageRouter.ts # Route C_* messages to handlers
│       │   │   └── stateSync.ts     # Delta compression, broadcast logic
│       │   ├── auth/
│       │   │   ├── jwt.ts           # JWT generation/validation
│       │   │   └── middleware.ts    # Socket.io auth middleware
│       │   ├── db/
│       │   │   ├── schema.ts        # DrizzleORM schema
│       │   │   ├── migrations/      # Database migrations
│       │   │   └── queries.ts       # Common queries
│       │   ├── bots/
│       │   │   ├── botManager.ts    # Spawn/despawn bot logic
│       │   │   └── botAI.ts         # Simple FSM for Fremen/Harkonnen bots
│       │   ├── matchmaking/
│       │   │   └── queue.ts         # Simple FIFO queue, room assignment
│       │   ├── types/               # Server-specific types
│       │   ├── tests/               # Unit/integration tests
│       │   └── index.ts             # Entry point
│       ├── Dockerfile
│       └── package.json
│
├── packages/
│   ├── shared/              # Shared types and constants
│   │   ├── src/
│   │   │   ├── types/           # Position, Rotation, EntityId, Component types
│   │   │   ├── constants.ts     # Game constants (tick rate, max players)
│   │   │   └── utils.ts         # Small shared helpers
│   │   └── package.json
│   │
│   ├── protocol/            # Network message schemas
│   │   ├── src/
│   │   │   ├── messages.ts      # C_* and S_* message type definitions
│   │   │   ├── encoder.ts       # JSON serialization (future: binary)
│   │   │   └── validator.ts     # Optional Zod schemas for validation
│   │   └── package.json
│   │
│   └── config/              # Shared tooling configs
│       ├── eslint.config.js
│       ├── tsconfig.base.json
│       └── package.json
│
├── pnpm-workspace.yaml
├── package.json
├── AGENTS.md
└── docs/
```

## Core Architectural Principles

### 1. Deterministic Server Simulation
- Server runs authoritative fixed-timestep loop (30-60hz)
- Pure simulation functions in `server/src/game/sim/` with no I/O
- All inputs enqueued, processed in batch, state updated
- Results broadcast to clients at lower rate (10-20hz)

```typescript
// server/src/game/loop.ts
const TICK_MS = 33; // 30hz
let lastTick = Date.now();

setInterval(() => {
  const now = Date.now();
  let dt = now - lastTick;
  
  while (dt >= TICK_MS) {
    room.processInputQueue();
    room.simulate(TICK_MS / 1000);
    if (room.shouldBroadcast()) {
      room.broadcastDeltas();
    }
    dt -= TICK_MS;
    lastTick += TICK_MS;
  }
}, 4); // High-frequency check, processes accumulated ticks
```

### 2. Client Prediction & Reconciliation
- Client buffers inputs (200ms) with sequence numbers
- Immediately applies inputs locally for responsive feel
- On server update, discards acknowledged inputs and replays remaining
- Minor errors (<0.1m) smoothed via lerp, major errors teleport with VFX

```typescript
// apps/client/src/networking/reconciliation.ts
function reconcile(serverState: State, lastProcessedSeq: number) {
  discardInputsUpTo(lastProcessedSeq);
  
  const error = distance(localState.position, serverState.position);
  
  if (error < SMOOTH_THRESHOLD) {
    smoothTo(serverState, 100); // 100ms lerp
  } else {
    snapWithEffect(serverState);
  }
  
  reapplyPendingInputs();
}
```

### 3. Interest Management
- Server divides world into grid cells (32m × 32m)
- Each player has visibility region (100m radius)
- Only send entity updates for visible cells
- Full snapshot every 5 seconds to prevent drift

```typescript
// server/src/game/interest.ts
class InterestGrid {
  private grid: Map<string, Set<EntityId>>;
  private cellSize = 32;
  
  getVisibleEntities(player: Player): EntityId[] {
    const cells = this.getCellsInRadius(player.position, 100);
    return cells.flatMap(cell => Array.from(this.grid.get(cell) || []));
  }
}
```

### 4. Shared Protocol Package
- Single source of truth for message schemas
- Start with JSON, migrate to binary only when metrics demand
- All messages include: `type`, `seq` (sequence), `ts` (timestamp)
- Server messages include `lastProcessedInputSeq` for reconciliation

```typescript
// packages/protocol/src/messages.ts
export type ClientInput = {
  t: "input";
  seq: number;        // uint16 rollover
  ts: number;         // client ms
  mv: [number, number]; // movement vector [x, z]
  jump?: 0 | 1;
  action?: {
    type: "thumper" | "mount" | "dismount" | "harvest";
    target?: number;  // EntityId
  };
};

export type ServerUpdate = {
  t: "state";
  seq: number;
  ts: number;
  lastProcessedInputSeq: number;
  entities: EntityUpdate[];
  removed?: number[];
};
```

### 5. Persistence Strategy (Minimal)
- **DO persist**: Player profiles, inventory, cosmetics, last safe position
- **DON'T persist**: Active match state (keep in-memory)
- Use DrizzleORM transactions for resource changes
- One-writer pattern: only server modifies DB, never clients

```typescript
// server/src/db/schema.ts
export const players = pgTable('players', {
  id: uuid('id').primaryKey(),
  username: text('username').notNull(),
  waterLevel: integer('water_level').default(100),
  spiceAmount: integer('spice_amount').default(0),
  inventory: jsonb('inventory').default('{}'),
  lastPosition: jsonb('last_position'),
  createdAt: timestamp('created_at').defaultNow(),
});
```

## Testing Strategy

### Unit Tests (High Coverage)
- Pure simulation functions: movement, worm spline, thumper attraction
- Deterministic terrain generation with fixed seeds
- Resource validation logic
- Message encoding/decoding

### Integration Tests (Key Flows)
- Headless server + two headless clients
- Scripted inputs with artificial latency/jitter
- Test: connect → move → mount worm → complete objective → disconnect

### Network Simulation Helpers
```typescript
// packages/shared/src/test-helpers/networkSim.ts
export class NetworkSimulator {
  dropPercent: number = 0;
  jitterMs: number = 0;
  reorder: boolean = false;
  
  send(message: Message, delay: number = 50) {
    if (Math.random() < this.dropPercent) return;
    const actualDelay = delay + (Math.random() - 0.5) * this.jitterMs;
    setTimeout(() => this.deliver(message), actualDelay);
  }
}
```

## Build & Development Commands

```bash
# Install dependencies
pnpm install

# Development mode (all workspaces with HMR)
pnpm run dev

# Build all (parallel)
pnpm run --parallel build

# Run tests
pnpm test

# Run specific workspace
pnpm --filter @fremen/client dev
pnpm --filter @fremen/server start

# Type checking
pnpm run typecheck

# Linting
pnpm run lint
```

## Migration Path: JSON → Binary Protocol

**Start with JSON** (simple, debuggable):
- Use when: <50 kbps/player sustained
- Monitor: bandwidth per player, tick CPU usage

**Switch to Binary** when:
- Bandwidth >50 kbps/player sustained, OR
- Tick CPU >60% on target hardware

**Binary Implementation** (packages/protocol/src/encoder.ts):
- Component bitmasks (what changed)
- Varint encoding for positions/rotations
- Shared entity schema dictionary
- Delta-only updates with periodic full snapshots

## Deployment

### Client (Vercel)
- Automatic deployments from `main` branch
- Environment: `VITE_SERVER_URL`, `VITE_WS_URL`
- Edge network for global CDN

### Server (Railway)
- Dockerized deployment
- Environment: `DATABASE_URL`, `JWT_SECRET`, `PORT`
- Health check endpoint: `/health`
- Auto-restart on crash

### Database (Railway PostgreSQL)
- Automated backups (daily)
- Connection pooling configured in DrizzleORM
- Indexes on: `players.id`, `player_missions.player_id`
