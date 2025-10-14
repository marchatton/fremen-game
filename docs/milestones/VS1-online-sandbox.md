# VS1: Online Sandbox (MVP-0)

**Duration**: 2-4 weeks  
**Goal**: Establish networked foundation with basic player movement, terrain, worm presence, and thumper attraction

## Overview
Create the minimal viable multiplayer experience: players can join a server, see each other move across procedural terrain, observe a patrolling sandworm, and deploy a thumper that attracts the worm. This validates core networking and sets up the gameplay foundation.

## Deliverables

### 1. Monorepo Setup
- [x] Initialize pnpm workspace with `apps/client`, `apps/server`, `packages/shared`, `packages/protocol`
- [x] Configure TypeScript strict mode across all packages
- [x] Set up ESLint with shared config
- [x] Create basic CI pipeline (GitHub Actions): lint + typecheck on PR

**Tests**: `pnpm install` runs cleanly, `pnpm run --parallel build` succeeds ✅

### 2. Client Foundation
- [x] Vite + Three.js project setup in `apps/client`
- [x] Basic WebGL renderer with FPS counter
- [x] PerspectiveCamera with OrbitControls for debugging
- [x] Simple InputManager capturing WASD + mouse
- [x] Basic low-poly character placeholder (colored capsule, 50 polys)

**Tests**: Client runs at 60fps with debug camera ✅

### 3. Server Foundation
- [x] Node.js + Socket.io server in `apps/server`
- [x] JWT authentication endpoint `/auth/token`
- [x] Socket.io auth middleware validating JWT
- [x] Basic Room class managing connected players
- [x] Fixed timestep game loop (30hz) logging tick count

**Tests**: Server accepts 4 simultaneous connections, validates JWT rejection ✅

### 4. Basic Networking
- [x] Define `C_INPUT`, `S_WELCOME`, `S_STATE` in `packages/protocol`
- [x] Client NetworkManager connects with JWT
- [x] Server processes `C_INPUT` and broadcasts `S_STATE`
- [x] Connection/disconnection handlers with logging
- [x] Reconnection logic (5min in-memory state)

**Tests**: 2 clients connect, see each other's placeholder characters, one disconnects/reconnects ✅

### 5. Procedural Terrain
- [x] Seed-based Simplex noise heightmap generator in `packages/shared`
- [x] Client chunk system (32m × 32m chunks)
- [x] Basic vertex coloring (sand yellow/brown)
- [x] Simple LOD (2 levels: 800 polys, 400 polys)
- [x] Server stores heightmap for collision

**Tests**: Deterministic terrain generates from seed, chunks load/unload around player ✅

### 6. Server-Side Physics
- [x] Server validates player position against heightmap
- [x] Clamp player Y to terrain height + offset
- [x] Send corrected position in `S_STATE`
- [x] Basic anti-cheat: movement speed validation (max 10 m/s)

**Tests**: Player stays on terrain surface, speed hack detected and corrected ✅

### 7. Client Prediction V0
- [x] Client predicts movement locally
- [x] Buffer last 200ms of inputs with sequence numbers
- [x] Simple reconciliation: lerp to server position if error <0.5m
- [x] Log large corrections (>1m)

**Tests**: Movement feels responsive <100ms with 100ms simulated latency ✅

### 8. Basic Sandworm
- [x] Procedural worm model (10 segments, 1200 polys total)
- [x] CatmullRomCurve3-based spline movement
- [x] Server-side patrol AI: pick random target, move along curve
- [x] Send 8-12 control points in `S_STATE`
- [x] Client interpolates curve and positions segments

**Tests**: Worm patrols smoothly, visible to all clients, synchronized ✅

### 9. Thumper Attraction
- [x] Basic thumper model (200 polys, vertex colors)
- [x] Server command `/giveThumper` adds thumper to inventory (players start with 3)
- [x] Client sends `C_INPUT` with `action: { type: "deployThumper" }`
- [x] Server validates, spawns thumper entity
- [x] Server worm AI: detect thumper vibration, move toward it
- [x] Client shows thumper with pulsing animation when active

**Tests**: Deployed thumper attracts nearby worm, worm changes path, thumper expires after 60s ✅

### 10. Basic Communication
- [x] Text chat system (global channel only)
- [x] `C_CHAT` / `S_CHAT` messages
- [x] Simple HTML overlay chat UI
- [x] Basic rate limiting (1 message/2 seconds)

**Tests**: Players send/receive chat messages, rate limit blocks spam ✅

### 11. Interest Management V0
- [x] Server 32m × 32m grid (implemented in InterestManager)
- [x] Track which entities in which cells
- [ ] Only broadcast entities within 300m of player (not integrated yet - all entities broadcast)
- [ ] Full snapshot every 5 seconds (not implemented)

**Tests**: Client only receives nearby entity updates, bandwidth measured <30 kbps/player (⚠️ Basic implementation, optimization deferred)

## Technical Requirements

### Performance Targets
- **Client FPS**: 60fps on mid-spec (GTX 1060, i5)
- **Server Tick**: 30hz stable with 8 players
- **Bandwidth**: <30 kbps per player
- **Latency Handling**: Playable at 150ms RTT

### Testing Strategy
```typescript
// Integration test example
describe('VS1: Online Sandbox', () => {
  it('should allow 2 players to connect and see each other', async () => {
    const server = await startTestServer();
    const client1 = await connectTestClient();
    const client2 = await connectTestClient();
    
    await client1.move([1, 0]);
    await wait(100); // Allow network round-trip
    
    const entities = client2.getVisibleEntities();
    expect(entities).toContainPlayer(client1.playerId);
    expect(entities[0].position.x).toBeCloseTo(1, 0.5);
  });
  
  it('should attract worm to thumper', async () => {
    const server = await startTestServer();
    const client = await connectTestClient();
    
    const wormBefore = server.getWorm(0);
    await client.deployThumper([10, 0, 10]);
    await wait(2000); // Worm AI update
    
    const wormAfter = server.getWorm(0);
    expect(wormAfter.targetPosition).toBeCloseTo([10, 0, 10]);
  });
});
```

### Network Simulation Testing
- Test with 50ms, 100ms, 150ms latency
- Test with 1%, 3% packet loss
- Verify prediction/reconciliation smoothness

## Dependencies & Setup

### Required Packages
```json
// apps/client/package.json
{
  "dependencies": {
    "three": "^0.160.0",
    "@types/three": "^0.160.0",
    "socket.io-client": "^4.7.0",
    "simplex-noise": "^4.0.1"
  }
}

// apps/server/package.json
{
  "dependencies": {
    "socket.io": "^4.7.0",
    "jsonwebtoken": "^9.0.2",
    "uuid": "^9.0.1"
  }
}
```

### Environment Variables
```bash
# apps/client/.env
VITE_SERVER_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3000

# apps/server/.env
PORT=3000
JWT_SECRET=your-secret-key
NODE_ENV=development
```

## Success Criteria

### Must Have
- ✅ 2-4 players can connect simultaneously
- ✅ Players see each other move in real-time with <150ms perceived lag
- ✅ Procedural terrain renders and players stay on surface
- ✅ One worm patrols and all clients see synchronized movement
- ✅ Deployed thumper attracts worm visibly
- ✅ Reconnection works within 5 minutes
- ✅ Basic chat functions

### Nice to Have
- ⭐ Debug UI showing ping, tick rate, entity count
- ⭐ Simple performance profiler overlay
- ⭐ Network stats (bandwidth, packet loss)

## Known Limitations
- No persistence yet (state lost on server restart)
- Single room only (no matchmaking)
- No bot backfill yet
- JSON protocol only (binary deferred)
- Basic prediction (no advanced smoothing)

## Next Milestone
**VS2: Worm Riding Core** - Add mounting, steering, and first objective
