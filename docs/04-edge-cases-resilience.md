# Edge Cases & System Resilience

## Player Count Edge Cases

### Scenario: Not Enough Human Players

**Problem**: Game requires 2-4 players for fun experience, but only 1 joins

**Solution: Bot Backfill System**
```typescript
// server/src/bots/botManager.ts
class BotManager {
  private readonly MIN_ENTITIES = 4;
  private readonly MAX_BOTS = 3;
  
  balanceRoom(room: Room): void {
    const humanCount = room.getHumanPlayers().length;
    const currentBotCount = room.getBots().length;
    const totalNeeded = this.MIN_ENTITIES - humanCount;
    
    const botsNeeded = Math.min(
      Math.max(0, totalNeeded),
      this.MAX_BOTS
    );
    
    // Add or remove bots
    if (botsNeeded > currentBotCount) {
      this.spawnBots(room, botsNeeded - currentBotCount);
    } else if (botsNeeded < currentBotCount) {
      this.despawnBots(room, currentBotCount - botsNeeded);
    }
  }
}
```

**Bot Behavior**:
- **Fremen Bots**: Follow nearest human, assist in combat, deploy thumpers on request
- **Harkonnen Bots**: Standard AI behavior (patrol, attack)
- **Difficulty Scaling**: Fewer humans = easier bots (reduced health/accuracy)
- **Never**: Mount worms (reserved for humans), hog resources, block objectives

**Tests**:
- Solo player gets 3 friendly bots
- 2 players get 2 bots
- 4 players get 0 bots
- Bots removed when humans join mid-match

---

### Scenario: Too Many Players in Queue

**Problem**: 20 players queue for 8-player matches

**Solution: Multiple Room Creation**
```typescript
// server/src/matchmaking/queue.ts
class MatchmakingQueue {
  private readonly IDEAL_ROOM_SIZE = 6;
  private readonly MAX_ROOM_SIZE = 8;
  private readonly MIN_ROOM_SIZE = 4;
  
  formMatches(): Room[] {
    const rooms: Room[] = [];
    let remaining = this.queue.length;
    
    while (remaining >= this.MIN_ROOM_SIZE) {
      const roomSize = Math.min(
        this.IDEAL_ROOM_SIZE,
        remaining
      );
      
      rooms.push(this.createRoom(roomSize));
      remaining -= roomSize;
    }
    
    // Remaining players stay in queue
    return rooms;
  }
}
```

**Priorities**:
1. Minimize wait time (<30s average)
2. Balance skill levels within room
3. Prefer full rooms over many partial rooms
4. Backfill in-progress rooms when possible

---

## Disconnection Edge Cases

### Scenario: Player Disconnects While Riding Worm

**Problem**: Rider disappears mid-ride, worm needs graceful handling

**Solution: Safe Spiral & Auto-Dismount**
```typescript
// server/src/game/sim/wormController.ts
class WormController {
  handleRiderDisconnect(riderId: string): void {
    const worm = this.getWormByRider(riderId);
    
    // Enter safe spiral state
    worm.setState('SAFE_SPIRAL');
    worm.setSpiralTimer(10000); // 10 seconds
    
    // Gradual slowdown
    worm.targetSpeed = 5; // m/s
    
    // After timer or rider reconnects
    setTimeout(() => {
      if (!worm.hasRider) {
        this.autoDismount(worm, riderId);
        worm.setState('PATROLLING');
      }
    }, 10000);
  }
  
  autoDismount(worm: Worm, playerId: string): void {
    const safePosition = worm.findSafeDismountPosition();
    const player = this.getPlayer(playerId);
    
    player.position = safePosition;
    player.grantInvulnerability(3000); // 3s
    player.setState('ACTIVE');
  }
}
```

**Behavior**:
- Worm slows and circles for 10s
- If rider reconnects within 10s, resumes control
- Otherwise: Safe dismount with 3s invulnerability
- Worm returns to patrol after 5s cooldown

---

### Scenario: Player Disconnects During Combat

**Problem**: Disappearing during firefight is unfair (to them and opponents)

**Solution: Graceful Combat Disconnect**
```typescript
// server/src/game/sim/combatManager.ts
handleCombatDisconnect(player: Player): void {
  if (player.isInCombat()) {
    // Brief invulnerability to prevent cheap kills
    player.grantInvulnerability(3000); // 3s, max once per 2 mins
    
    // AI takes over if in danger
    if (player.health < 50 || player.isUnderFire()) {
      this.spawnDefensiveBot(player);
    }
    
    // Preserve position/state for reconnect
    this.storePlayerState(player.id, player.getState());
  }
}

spawnDefensiveBot(player: Player): void {
  const bot = new DefensiveBot(player.position);
  bot.behavior = 'RETREAT_TO_COVER';
  bot.duration = 30000; // 30s max
  
  // If player reconnects, bot despawns
  // If bot survives 30s, player respawns at Sietch
}
```

**Limitations**:
- Invulnerability abuse prevention: Max once per 2 minutes
- Bot despawns on reconnect or after 30s
- No invulnerability if disconnect >3 times in 10 minutes (suspected rage quit)

---

### Scenario: Reconnection Within 5 Minutes

**Problem**: Player wants to rejoin same match after brief disconnect

**Solution: Stateful Reconnection**
```typescript
// server/src/networking/socketServer.ts
handleReconnection(socket: Socket, playerId: string): void {
  const savedState = this.stateCache.get(playerId);
  
  if (savedState && savedState.age < 300000) { // 5 minutes
    const room = this.findRoomById(savedState.roomId);
    
    if (room && room.isActive()) {
      // Restore player to room
      room.addPlayer(socket, savedState);
      
      // Send full state snapshot
      socket.emit('S_WELCOME', {
        playerId,
        roomId: room.id,
        fullState: room.getFullState(),
        yourState: savedState
      });
      
      // Notify others
      room.broadcast('S_PLAYER_RECONNECTED', { playerId });
      
      return;
    }
  }
  
  // Fallback: Join new match
  this.matchmaking.addToQueue(socket, playerId);
}
```

**Cache Strategy**:
- Keep player state in-memory for 5 minutes
- Include: Position, health, water, spice (un-deposited), inventory
- Room must still be active (not ended)
- If room ended, player keeps persistent state (DB) but joins new match

---

## Server Failure Edge Cases

### Scenario: Server Crashes Mid-Match

**Problem**: All players lose progress, frustration ensues

**Solution: Minimal Persistence + Grace Compensation**
```typescript
// server/src/db/saveManager.ts
class SaveManager {
  // Save only durable data, not match state
  async onServerShutdown(): Promise<void> {
    const promises = [];
    
    for (const [playerId, player] of this.activePlayers) {
      promises.push(
        this.savePlayerProfile(playerId, {
          waterLevel: player.water,
          spiceDeposited: player.depositedSpice, // Only deposited spice saved
          inventory: player.inventory,
          lastSafePosition: player.lastSietchVisit,
          stats: player.stats
        })
      );
    }
    
    await Promise.all(promises);
  }
  
  async onPlayerConnect(playerId: string): Promise<void> {
    const profile = await this.loadPlayerProfile(playerId);
    
    // Check for crash flag
    if (profile.wasInMatch && !profile.matchCompleted) {
      // Grant grace compensation
      profile.spice += 50;
      profile.water = 100;
      
      this.sendNotification(playerId, {
        type: 'SERVER_RECOVERY',
        message: 'Sorry for the interruption! Here\'s some compensation.'
      });
    }
  }
}
```

**Strategy**:
- Accept match state loss (simpler than Redis/checkpointing)
- Save persistent data only: Profile, inventory, deposited spice
- Compensate players who were in match: 50 spice + full water
- Flag clears on successful match completion
- Railway auto-restarts server within 30s

**Trade-offs**:
- Pro: Simple, no Redis/state server needed
- Pro: Fast recovery (<30s downtime)
- Con: Lose un-deposited spice from active match
- Con: Rare but frustrating for players

**Future Enhancement (if crashes frequent)**:
- Add Redis for room state snapshots (every 30s)
- Restore rooms after crash
- Requires more infrastructure cost/complexity

---

### Scenario: Database Connection Lost

**Problem**: Server can't save player data, risk of corruption/loss

**Solution: Circuit Breaker + Graceful Degradation**
```typescript
// server/src/db/circuitBreaker.ts
class DatabaseCircuitBreaker {
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private failureCount = 0;
  private readonly FAILURE_THRESHOLD = 5;
  
  async query<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      throw new Error('Circuit breaker OPEN - DB unavailable');
    }
    
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  onFailure(): void {
    this.failureCount++;
    
    if (this.failureCount >= this.FAILURE_THRESHOLD) {
      this.state = 'OPEN';
      logger.error('Circuit breaker OPEN - stopping DB queries');
      
      // Try recovery after 30s
      setTimeout(() => this.attemptRecovery(), 30000);
    }
  }
  
  attemptRecovery(): void {
    this.state = 'HALF_OPEN';
    // Next query will test if DB recovered
  }
}
```

**Graceful Degradation**:
1. **Circuit Open**: Stop all DB writes, keep game running
2. **In-Memory Only**: Queue writes, retain in-memory for 10 minutes
3. **Player Warning**: "Saving disabled - progress may be lost"
4. **Recovery**: When circuit closes, flush queued writes
5. **Fallback**: If >10min, kick players gracefully with compensation

---

## Exploits & Security Edge Cases

### Scenario: Resource Duplication Exploit

**Problem**: Player tries to duplicate spice via disconnect timing

**Solution: Idempotency + Transactions**
```typescript
// server/src/game/sim/resourceManager.ts
class ResourceManager {
  private pendingActions = new Map<string, Set<string>>();
  
  async harvestSpice(
    playerId: string,
    nodeId: string,
    actionId: string // Client-generated UUID
  ): Promise<boolean> {
    // Check idempotency
    if (this.hasProcessed(playerId, actionId)) {
      return false; // Already processed
    }
    
    // Validate
    const node = this.getNode(nodeId);
    const player = this.getPlayer(playerId);
    
    if (!node.hasSupply() || distance(player, node) > 5) {
      return false;
    }
    
    // Transactional update
    await this.db.transaction(async (tx) => {
      await tx.update('spice_nodes')
        .set({ supply: node.supply - 50 })
        .where({ id: nodeId });
      
      await tx.update('players')
        .set({ spice: player.spice + 50 })
        .where({ id: playerId });
    });
    
    // Mark as processed
    this.markProcessed(playerId, actionId);
    
    return true;
  }
}
```

**Protection Layers**:
1. **Action IDs**: Client sends UUID per action, server deduplicates
2. **Transactions**: Database-level atomicity
3. **Rate Limits**: Max 10 harvest actions per minute
4. **Server Authority**: Client can't set own spice value

---

### Scenario: Speed Hacking

**Problem**: Player modifies client to move faster

**Solution: Server-Side Movement Validation**
```typescript
// server/src/game/sim/movementValidator.ts
class MovementValidator {
  private readonly MAX_SPEED = 10; // m/s on foot
  private readonly MAX_WORM_SPEED = 25; // m/s on worm
  private readonly TELEPORT_THRESHOLD = 50; // m
  
  validateMovement(
    player: Player,
    newPosition: Vector3,
    dt: number
  ): ValidationResult {
    const distance = player.position.distanceTo(newPosition);
    const speed = distance / dt;
    
    const maxSpeed = player.isRiding 
      ? this.MAX_WORM_SPEED 
      : this.MAX_SPEED;
    
    // Check speed hack
    if (speed > maxSpeed * 1.5) { // 50% tolerance for latency
      logger.warn(`Speed hack detected: ${player.id}, ${speed} m/s`);
      return {
        valid: false,
        correctedPosition: player.position // Reject movement
      };
    }
    
    // Check teleport hack
    if (distance > this.TELEPORT_THRESHOLD) {
      logger.warn(`Teleport detected: ${player.id}, ${distance}m`);
      return {
        valid: false,
        correctedPosition: player.position
      };
    }
    
    // Check terrain clipping
    const terrainHeight = this.terrain.getHeightAt(newPosition.x, newPosition.z);
    if (newPosition.y < terrainHeight - 1) {
      logger.warn(`Clipping detected: ${player.id}`);
      newPosition.y = terrainHeight;
    }
    
    return { valid: true, correctedPosition: newPosition };
  }
}
```

**Detection & Response**:
- **First offense**: Silent correction (player snaps back)
- **3 offenses in 5 min**: Kick from match
- **5+ offenses**: Temporary ban (24 hours)
- **Persistent**: Permanent ban + IP flag

---

### Scenario: Griefing via Thumper Spam

**Problem**: Player deploys thumpers to troll teammates

**Solution: Cooldowns + Limits**
```typescript
// server/src/game/sim/thumperManager.ts
class ThumperManager {
  private readonly MAX_ACTIVE_PER_PLAYER = 2;
  private readonly MIN_SPACING = 50; // meters
  private readonly DEPLOY_COOLDOWN = 30000; // 30 seconds
  
  deployThumper(
    player: Player,
    position: Vector3
  ): DeployResult {
    // Check cooldown
    if (player.thumperCooldown > Date.now()) {
      return { success: false, reason: 'COOLDOWN' };
    }
    
    // Check active count
    const activeThumpers = this.getPlayerThumpers(player.id);
    if (activeThumpers.length >= this.MAX_ACTIVE_PER_PLAYER) {
      return { success: false, reason: 'MAX_ACTIVE' };
    }
    
    // Check spacing
    for (const thumper of this.allThumpers.values()) {
      if (thumper.position.distanceTo(position) < this.MIN_SPACING) {
        return { success: false, reason: 'TOO_CLOSE' };
      }
    }
    
    // Check protected zones (Sietch, etc.)
    if (this.isProtectedZone(position)) {
      return { success: false, reason: 'PROTECTED_ZONE' };
    }
    
    // Deploy
    this.createThumper(player, position);
    player.thumperCooldown = Date.now() + this.DEPLOY_COOLDOWN;
    
    return { success: true };
  }
}
```

**Additional Protections**:
- **Vote Kick**: 3/4 squad votes can kick griefer
- **Report System**: Flag for manual review
- **Reputation**: Repeated kicks lower matchmaking priority

---

## Network Edge Cases

### Scenario: High Latency (300ms+)

**Problem**: Game feels unplayable, inputs delayed

**Solution: Adaptive Prediction & Feedback**
```typescript
// apps/client/src/networking/adaptivePredictor.ts
class AdaptivePredictorConfig {
  updateBasedOnLatency(rtt: number): void {
    if (rtt > 300) {
      // High latency mode
      this.predictionBuffer = 500; // ms
      this.smoothingWindow = 300;
      this.showLatencyWarning = true;
      this.reducedBroadcastRate = true; // Server sends 10hz instead of 20hz
    } else if (rtt > 150) {
      // Medium latency
      this.predictionBuffer = 300;
      this.smoothingWindow = 200;
    } else {
      // Low latency
      this.predictionBuffer = 200;
      this.smoothingWindow = 100;
    }
  }
}
```

**User Experience**:
- Display latency indicator (green <100ms, yellow 100-200ms, red >200ms)
- Widen smoothing window (less snapping)
- Reduce server broadcast frequency to save bandwidth
- Suggest region change if sustained high latency

---

### Scenario: Packet Loss (5%+)

**Problem**: Missing updates cause jittery movement

**Solution: Redundant Inputs + Interpolation**
```typescript
// packages/protocol/src/messages.ts
type ClientInput = {
  t: "input",
  seq: number,
  ts: number,
  mv: [number, number],
  lastInputs?: ClientInput[] // Last 3-5 inputs included
};

// Server processes most recent un-acked input
// Client resends inputs until acked
```

**Interpolation**:
- Client extrapolates entity positions if no update received
- Use last known velocity/heading
- Max extrapolation: 500ms before showing "connection lost"

---

## Matchmaking Edge Cases

### Scenario: Skill Mismatch

**Problem**: Level 1 matched with Level 25 players

**Solution: Hidden MMR + Soft Limits**
```typescript
// server/src/matchmaking/mmr.ts
class MMRSystem {
  private readonly INITIAL_MMR = 1000;
  private readonly SEARCH_RANGE_START = 100;
  private readonly SEARCH_RANGE_GROWTH = 50; // per 10s
  
  findMatch(player: Player): Room | null {
    const searchTime = Date.now() - player.queueJoinTime;
    const searchRange = this.SEARCH_RANGE_START + 
      (searchTime / 10000) * this.SEARCH_RANGE_GROWTH;
    
    // Find room with MMR within expanding range
    for (const room of this.availableRooms) {
      const avgMMR = room.getAverageMMR();
      
      if (Math.abs(player.mmr - avgMMR) <= searchRange) {
        return room;
      }
    }
    
    // After 60s, widen dramatically to ensure match
    if (searchTime > 60000) {
      return this.availableRooms[0] || this.createNewRoom();
    }
    
    return null;
  }
}
```

**Balancing**:
- Prioritize skill match first 30s
- Expand range gradually
- After 60s, any match (prevent indefinite queue)
- New players get bot-heavy matches (easier)

---

## Summary: Edge Case Priority

### Critical (Must Handle)
✅ Not enough players → Bot backfill  
✅ Disconnect while riding worm → Safe dismount  
✅ Resource duplication → Idempotency + transactions  
✅ Speed hacking → Server validation  
✅ Server crash → Grace compensation  

### Important (Handle Soon)
⭐ High latency → Adaptive prediction  
⭐ Packet loss → Redundant inputs  
⭐ Skill mismatch → MMR system  
⭐ Database failure → Circuit breaker  

### Nice to Have (Post-Launch)
💡 Advanced anti-cheat (behavioral analysis)  
💡 Redis state backup (room recovery)  
💡 Cross-region matchmaking  
💡 Reconnect to different room (if original ended)
