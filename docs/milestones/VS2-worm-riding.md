# VS2: Worm Riding Core (MVP)

**Duration**: 4-6 weeks  
**Goal**: Implement complete worm riding mechanics and first playable objective loop

## Overview
This is the **core gameplay milestone**. Players can mount a worm attracted by thumpers, steer it across the desert, and complete a simple "shepherd worm to marker" objective. This must feel fun and rewarding - the entire game's appeal depends on this experience.

## Deliverables

### 1. Worm Mounting System
- [x] Worm AI state: `PATROLLING` → `APPROACHING_THUMPER` (slows near active thumper)
- [x] Client detects mountable worm (within 5m, state = `APPROACHING_THUMPER`)
- [x] Interaction prompt UI: "Press E to Mount"
- [x] `C_INPUT` with `action: { type: "mount", target: wormId }`
- [x] Server validation: distance, worm state, player not already mounted
- [x] Server sets player state: `RIDING { wormId }`, worm state: `RIDDEN_BY { playerId }`
- [x] Client attaches player model to worm's 2nd segment
- [ ] Camera switches to "worm riding" mode (follow behind, slightly elevated)

**Tests**: Player can mount worm within window, rejected if too far or wrong state ✅

### 2. Worm Steering Controls
- [x] New input mode when `player.state === RIDING`
- [x] WASD/analog stick controls worm direction intent
- [x] `C_INPUT` includes `wormControl: { direction, speedIntent }`
- [x] Server updates worm spline target based on player input
- [x] Constrain turn rate (max 45°/second)
- [x] Constrain speed (min 5 m/s, max 25 m/s)
- [x] W/S adjusts speed, A/D adjusts heading
- [ ] Camera follows worm's heading smoothly

**Tests**: Worm responds to steering within 100ms, constrained to realistic movement ✅

### 3. Advanced Worm Animation
- [ ] Procedural segment undulation (sine wave perpendicular to movement)
- [ ] Head "look ahead" toward target direction
- [ ] Tail follows with slight lag for whip effect
- [ ] Dust particle trail spawns at segment positions
- [ ] Sound: rumble intensity based on speed
- [ ] Camera shake effect proportional to worm speed

**Tests**: Worm looks fluid at all speeds, particles/sound match movement

### 4. Dismounting System
- [x] "Press E to Dismount" prompt while riding
- [x] `C_INPUT` with `action: { type: "dismount" }`
- [x] Server ejects player 3m to worm's right side
- [ ] Player gets 2s invulnerability after dismount
- [x] Worm returns to `PATROLLING` state after 5s cooldown
- [ ] Safe dismount zones: avoid cliffs, water
- [ ] Emergency dismount on worm death or stuck

**Tests**: Player dismounts safely, invulnerability works, worm becomes available again (partial ✅)

### 5. Worm Health & Danger
- [ ] Worm has health (1000 HP)
- [ ] Terrain obstacles damage worm (rocks: 50 HP/collision)
- [ ] Out-of-bounds zones (marked on map) force dismount
- [ ] Worm death: explosion VFX, rider ejected with damage
- [ ] Worm respawns at random location after 2 minutes

**Tests**: Worm takes damage from obstacles, death handled gracefully

### 6. First Objective: Shepherd Worm
- [x] Server spawns objective marker at random valid location
- [x] Objective type: "Shepherd worm to marker within 3 minutes"
- [x] UI: Waypoint showing marker location, distance, time remaining
- [x] Detection radius: 20m from marker center
- [x] Success: All riders get reward notification
- [x] Failure: Timer expires, no penalty, new objective spawns

**Tests**: Objective completes when worm reaches marker, timer enforced ✅

### 7. Character Animations
- [ ] Refine character model (150-300 polys)
- [ ] Rig with minimal skeleton (12 bones)
- [ ] Animations: Idle, Walk, Run, Jump, Mounted Idle, Mounted Lean (L/R)
- [ ] Animation blending (200ms crossfade)
- [ ] Sync animation state in `S_STATE` (1 byte enum)
- [ ] Riding animations respond to worm turn direction

**Tests**: Animations play correctly, blend smoothly, sync across clients

### 8. Third-Person Camera
- [ ] Camera follows player/worm with spring arm
- [ ] Collision detection (raycast from target to camera)
- [ ] Smooth FOV changes (narrow when mounted, wider on foot)
- [ ] Vertical offset: higher when riding worm
- [ ] Mouse/touch controls: orbit around player
- [ ] Smooth transitions between foot/mounted modes

**Tests**: Camera doesn't clip terrain, smooth transitions, controllable

### 9. Enhanced Prediction/Reconciliation
- [ ] Worm steering uses custom prediction (heading/speed only)
- [ ] Server sends worm control points + target heading/speed
- [ ] Client predicts curve generation between updates
- [ ] Smooth correction: minor (<2m) uses slerp, major (>5m) snaps
- [ ] Mounted player position derived from worm segment (no separate prediction)

**Tests**: Worm control feels responsive, corrections barely noticeable at 150ms RTT

### 10. UI/UX Polish
- [ ] HUD: Speed indicator while riding
- [ ] HUD: Worm health bar (when mounted)
- [ ] HUD: Objective tracker with waypoint arrow
- [ ] HUD: Timer for timed objectives
- [ ] Interaction prompts: "Press E to Mount/Dismount"
- [ ] Visual feedback: thumper placement preview (ghost model)
- [ ] Sound: Mount/dismount effects, worm roar on successful mount

**Tests**: All UI elements visible and functional, sounds play correctly

### 11. Tutorial Flow
- [ ] First-time player tutorial: 5 steps with UI prompts
  1. "Move with WASD"
  2. "Deploy thumper at highlighted location"
  3. "Wait for worm to approach"
  4. "Mount the worm when prompted"
  5. "Steer to the marker"
- [ ] Skippable for returning players
- [ ] Tutorial state tracked per player (localStorage)

**Tests**: Tutorial guides new player through full loop in <3 minutes

## Technical Requirements

### Performance Targets
- **Client FPS**: 60fps stable with worm riding
- **Worm Segments**: 12-16 segments, 100-150 polys each
- **Network**: Worm control points <200 bytes per update
- **Prediction Buffer**: 200ms for worm control inputs
- **Camera Smoothness**: No jitter or clipping

### Worm Spline Optimization
```typescript
// Server: Simplify curve to N control points
class WormController {
  private curve: CatmullRomCurve3;
  private targetHeading: number;
  private targetSpeed: number;
  
  update(dt: number, steeringInput: Vector2) {
    // Update target heading based on input
    this.targetHeading += steeringInput.x * TURN_RATE * dt;
    
    // Update target speed
    this.targetSpeed = clamp(
      this.targetSpeed + steeringInput.y * ACCEL_RATE * dt,
      MIN_SPEED,
      MAX_SPEED
    );
    
    // Move worm head forward
    const headPos = this.curve.getPointAt(0);
    const newHeadPos = headPos.add(
      new Vector3(
        Math.cos(this.targetHeading),
        0,
        Math.sin(this.targetHeading)
      ).multiplyScalar(this.targetSpeed * dt)
    );
    
    // Rebuild curve with new head, keep tail
    this.updateCurvePoints(newHeadPos);
  }
  
  getNetworkData(): number[][] {
    // Send 8-12 control points
    return this.curve.points.filter((p, i) => i % 2 === 0)
      .map(p => [p.x, p.y, p.z]);
  }
}
```

### Testing Strategy
```typescript
describe('VS2: Worm Riding', () => {
  it('should allow player to mount worm near thumper', async () => {
    const server = await startTestServer();
    const client = await connectTestClient();
    
    await client.deployThumper([10, 0, 10]);
    await waitForWormApproach(2000);
    
    const mountResult = await client.attemptMount();
    expect(mountResult.success).toBe(true);
    expect(client.state).toBe('RIDING');
  });
  
  it('should steer worm toward input direction', async () => {
    const server = await startTestServer();
    const client = await connectTestClient();
    
    await client.mountWorm();
    const initialHeading = server.getWorm(0).heading;
    
    await client.sendInput({ wormControl: { direction: [1, 0] } });
    await wait(1000);
    
    const newHeading = server.getWorm(0).heading;
    expect(newHeading).toBeGreaterThan(initialHeading);
  });
  
  it('should complete shepherd objective', async () => {
    const server = await startTestServer();
    const client = await connectTestClient();
    
    server.spawnObjective('shepherd', [100, 0, 100]);
    await client.mountAndSteerTo([100, 0, 100]);
    
    const objective = server.getActiveObjective();
    expect(objective.status).toBe('COMPLETED');
  });
});
```

## Success Criteria

### Must Have
- ✅ Players can mount worms with <5s average time from thumper deploy
- ✅ Worm steering feels responsive and fun (playtester feedback >7/10)
- ✅ Camera doesn't make players motion sick (smooth, predictable)
- ✅ Shepherd objective completable by new player in <5 minutes
- ✅ Worm movement synchronized across clients with <200ms perceived lag
- ✅ No critical bugs (crashes, softlocks, stuck states)

### Nice to Have
- ⭐ Skill expression: experienced players steer more efficiently
- ⭐ "Worm surfing" - small jumps over sand dunes feel satisfying
- ⭐ Dynamic camera angles during sharp turns
- ⭐ Worm "personality" - each worm behaves slightly differently

## Fun Factor Checklist
This is the **core loop** - it MUST be fun or the game fails. Test with playtesters:

- [ ] Does mounting the worm feel rewarding? (anticipation → payoff)
- [ ] Does steering feel responsive but not twitchy?
- [ ] Is there a sense of power/speed while riding?
- [ ] Do players want to "try that again" after completing objective?
- [ ] Are there "wow" moments? (close calls, perfect turns, etc.)

**Iterate on feel until 8/10 playtesters rate it 7+/10 for fun**

## Known Limitations
- Single objective type (shepherd only)
- No cooperative riding (multi-rider deferred to VS5)
- No combat while riding (PvE deferred to VS4)
- No worm abilities (terrain manipulation, etc.)

## Risk Mitigation
- **Risk**: Worm control feels "floaty" or unresponsive
  - Mitigation: Early prototype with rapid iteration, external playtest at week 2
- **Risk**: Network lag makes riding feel bad
  - Mitigation: Aggressive client prediction, test at 150ms+ latency
- **Risk**: Camera motion sickness
  - Mitigation: Smooth acceleration, FOV options, fixed camera mode option

## Next Milestone
**VS3: Resource Loop** - Add spice harvesting, water survival, and persistence
