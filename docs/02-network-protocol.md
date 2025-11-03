# Network Protocol Specification

## Overview
The game uses Socket.io over WebSocket for bidirectional client-server communication. Protocol starts with **JSON** for simplicity and debuggability, with a clear migration path to binary when performance metrics demand it.

## Connection Flow

### 1. Authentication
```typescript
// Client requests JWT token
POST /auth/token
Response: { token: string, playerId: string }

// Client connects with token
const socket = io(SERVER_URL, {
  auth: { token }
});
```

### 2. Server validates token via middleware
```typescript
// server/src/auth/middleware.ts
socket.on('connection', (socket) => {
  const { playerId } = verifyJWT(socket.handshake.auth.token);
  socket.data.playerId = playerId;
});
```

### 3. Welcome handshake
```typescript
// Server → Client
S_WELCOME {
  playerId: string
  serverTime: number
  roomId: string
  players: Player[]          // Current players in room
  entities: Entity[]         // Worms, thumpers, etc.
}
```

## Message Format (JSON)

All messages include base fields:
- `t`: Message type (string constant)
- `seq`: Sequence number (uint16, rolls over at 65535)
- `ts`: Timestamp (milliseconds since epoch)

### Client → Server Messages

#### C_INPUT
Player input with client-side prediction sequence.
```typescript
{
  t: "input",
  seq: 12345,               // Client sequence for reconciliation
  ts: 1234567890,
  mv: [0.5, 1.0],          // Movement vector [x, z] normalized
  jump?: 1,                 // 0 or 1
  look: [45, 0],           // Camera angles [yaw, pitch] in degrees
  action?: {
    type: "thumper" | "mount" | "dismount" | "harvest" | "interact",
    target?: 42             // EntityId if targeting something
  }
}
```

#### C_CHAT
Text message to other players.
```typescript
{
  t: "chat",
  channel: "global" | "team" | "proximity",
  message: string           // Max 200 chars, validated server-side
}
```

#### C_PING
Place a world marker for team.
```typescript
{
  t: "ping",
  position: [x: number, y: number, z: number]
}
```

#### C_REQUEST_MATCH
Join matchmaking queue.
```typescript
{
  t: "request_match",
  mode: "quickplay" | "custom"
}
```

#### C_COMBAT_FIRE
Request the server to fire the currently equipped weapon. The server validates range, cooldowns, and target visibility before applying damage.
```typescript
{
  type: "C_COMBAT_FIRE",
  weaponId: string,
  targetId: string,
  origin?: [x: number, y: number, z: number]
}
```

### Server → Client Messages

#### S_STATE (Main State Update)
Delta state update broadcast at 10-20hz.
```typescript
{
  t: "state",
  seq: 67890,                          // Server sequence
  ts: 1234567890,
  lastProcessedInputSeq: 12340,        // For client reconciliation
  entities: [
    {
      id: 42,
      type: "player" | "worm" | "thumper" | "ai",
      pos?: [x, y, z],                  // Only if changed
      rot?: y,                          // Y-rotation only for most entities
      vel?: [x, y, z],                  // Velocity for interpolation
      anim?: "idle" | "walk" | "run" | "jump",  // Animation state
      health?: 80,
      flags?: 0b00000011,               // Bit flags (mounted, crouched, etc.)
      
      // Worm-specific
      curve?: [[x,y,z], ...],           // 8-12 control points
      wormState?: "patrol" | "attracted" | "ridden",
      
      // Thumper-specific
      active?: true,
      radius?: 150,
      timeLeft?: 45
    }
  ],
  removed?: [12, 34, 56]                // Removed entity IDs
}
```

#### S_COMBAT_EVENT
Authoritative combat events emitted after validation. Clients should play effects/UI feedback based on `event.type`.
```typescript
{
  type: "S_COMBAT_EVENT",
  timestamp: number,
  event:
    | { type: "fire"; attackerId: string; weaponId: string; targetId?: string; origin?: [x, y, z] }
    | { type: "damage"; targetId: string; amount: number; remainingHealth: number; attackerId?: string; source: "player" | "ai" | "environment"; weaponId?: string }
    | { type: "death"; targetId: string; attackerId?: string; position: [x, y, z]; source: "player" | "ai" | "environment" }
    | { type: "respawn"; targetId: string; position: [x, y, z]; health: number }
}
```

#### S_SNAPSHOT (Full State)
Complete state sent every 5 seconds to prevent drift.
```typescript
{
  t: "snapshot",
  seq: 67900,
  ts: 1234567890,
  roomId: string,
  entities: Entity[]                    // Complete entity list
}
```

#### S_EVENT
One-time events (damage, collection, etc.).
```typescript
{
  t: "event",
  eventType: "damage" | "death" | "harvest" | "mount" | "dismount",
  sourceId?: 42,
  targetId?: 43,
  position?: [x, y, z],
  data?: {                              // Event-specific data
    amount?: 25,
    resourceType?: "spice" | "water"
  }
}
```

#### S_CHAT
Broadcast chat message.
```typescript
{
  t: "chat",
  senderId: string,
  senderName: string,
  channel: "global" | "team" | "proximity",
  message: string
}
```

#### S_PING_PLACED / S_PING_REMOVED
World marker events.
```typescript
{
  t: "ping_placed",
  id: 789,
  ownerId: string,
  position: [x, y, z],
  ttl: 10000                            // Time to live in ms
}

{
  t: "ping_removed",
  id: 789
}
```

## Update Rates & Timing

### Server Tick Loop
- **Simulation**: 30-60hz fixed timestep (33ms or 16ms)
- **Broadcast**: 10-20hz (50-100ms)
- **Full Snapshot**: Every 5 seconds

### Client Input Sending
- **Rate**: 10-20hz (50-100ms)
- **Buffer**: Store last 200ms of inputs for reconciliation

### Heartbeat
- **Interval**: 10 seconds
- **Timeout**: 5 seconds (3 missed heartbeats = disconnect)

## Reconnection Policy

### Client Disconnection
1. Server keeps player state in-memory for **5 minutes**
2. Player can reconnect with same JWT
3. Server sends `S_WELCOME` with current state
4. Client performs full reconciliation

### Graceful Handling
- **Riding Worm**: Worm enters "safe spiral" for 10s, then auto-dismount with invulnerability
- **In Combat**: 3s invulnerability on disconnect (max once per 2 minutes)
- **Resources**: State persisted to DB on disconnect

## Interest Management

### Visibility Regions
- **Grid Size**: 32m × 32m cells
- **Player Radius**: 100m high-priority, 300m medium-priority
- **Update Frequency**: 
  - High-priority (0-100m): Every tick
  - Medium-priority (100-300m): Every 3rd tick
  - Beyond 300m: Not sent

### Priority System
1. **Critical**: Own player state, mounted worm
2. **High**: Nearby players, active combat, thumpers
3. **Medium**: Distant worms, environmental objects
4. **Low**: Static scenery (sent once, then only on change)

## Anti-Cheat & Validation

### Server-Side Validation
All client inputs validated:
- **Movement speed**: Max 10 m/s on foot, 25 m/s on worm
- **Position**: Must be on terrain, no clipping
- **Action rate limits**: Max 10 actions/second
- **Resource changes**: Only server can modify

### Lag Compensation
- Server stores last 150ms of entity positions
- Hit detection rewinds to client's timestamp (within limits)
- Validates results against physics

## Error Handling

### Connection Errors
```typescript
socket.on('connect_error', (error) => {
  // Display to user: "Connection failed"
  // Attempt reconnect with exponential backoff
});
```

### Message Validation Errors
Server rejects invalid messages and logs:
- Malformed JSON
- Missing required fields
- Out-of-range values
- Rate limit exceeded

Client receives:
```typescript
{
  t: "error",
  code: "INVALID_INPUT" | "RATE_LIMIT" | "NOT_AUTHORIZED",
  message: string
}
```

## Binary Protocol Migration (Future)

### When to Switch
Migrate from JSON to binary when:
- Bandwidth >50 kbps/player sustained, OR
- Server tick CPU >60%

### Binary Format Design
```typescript
// Component bitmask (1 byte)
const HAS_POSITION = 0b00000001;
const HAS_ROTATION = 0b00000010;
const HAS_VELOCITY = 0b00000100;
const HAS_HEALTH = 0b00001000;

// Entity update (variable length)
[
  entityId: uint16,
  components: uint8,              // Bitmask
  ...componentData                // Variable based on bitmask
]

// Position (6 bytes): x, y, z as int16 (world * 100)
// Rotation (1 byte): y-rotation as uint8 (0-255 = 0-360°)
// Velocity (6 bytes): similar to position
// Health (1 byte): uint8 (0-255)
```

### Benefits of Binary
- **Bandwidth**: 50-70% reduction
- **CPU**: 20-30% less serialization overhead
- **Precision**: Controlled quantization

### Trade-offs
- **Complexity**: Harder to debug
- **Compatibility**: Version mismatch risks
- **Development time**: 1-2 weeks to implement + test

## Room Management

### Room Lifecycle
1. **Creation**: Server creates room on first player join
2. **Capacity**: 4-8 players + bot backfill to minimum 4
3. **Start Conditions**: Match starts when 2+ human players ready
4. **End Conditions**: All humans leave OR 30min timeout

### Room States
```typescript
type RoomState = 
  | "waiting"      // <2 human players
  | "starting"     // Countdown (10s)
  | "active"       // Match in progress
  | "ending";      // Victory condition met (10s grace)
```

## Message Size Guidelines

### Target Sizes (JSON)
- `C_INPUT`: ~100 bytes
- `S_STATE` (delta): ~500-2000 bytes (depends on entity count)
- `S_SNAPSHOT` (full): ~5000-15000 bytes
- `S_EVENT`: ~50-200 bytes

### Compression
- Enable Socket.io compression for messages >1KB
- Server-side gzip for large snapshots
- Binary protocol for sustained high traffic
