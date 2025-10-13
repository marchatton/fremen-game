# VS4: PvE Combat

**Duration**: 4-5 weeks  
**Goal**: Add Harkonnen AI enemies, combat loop, and bot backfill system

## Deliverables

### 1. Harkonnen AI Models & Animation
- [ ] Low-poly Harkonnen Trooper model (200-300 polys, distinct from Fremen)
- [ ] Animations: Idle, Walk, Run, Aim, Fire, Take Damage, Death
- [ ] Vertex colors: dark grey/black armor, red accents
- [ ] LOD: 2 levels (full detail <50m, simplified >50m)

**Tests**: Model renders correctly, animations blend smoothly

### 2. AI State Machine
- [ ] States: `PATROL`, `INVESTIGATE`, `COMBAT`, `RETREAT`, `DEAD`
- [ ] Patrol: Follow waypoint path, vision cone detection (90°, 50m range)
- [ ] Investigate: Move to last known player position, search for 10s
- [ ] Combat: Engage player, maintain 20-40m distance, take cover
- [ ] Retreat: Health <30%, move to reinforcement point
- [ ] Perception: Vision + hearing (gunshots, thumpers attract within 100m)

**Tests**: AI transitions between states correctly, detection works at various ranges

### 3. Combat System (Hitscan)
- [ ] Player weapon: Maula pistol (low-poly, 100 polys)
- [ ] Fire rate: 1 shot/second, reload 2s after 6 shots
- [ ] Hitscan raycast from player camera, validate server-side
- [ ] Lag compensation: Server rewinds entity positions by RTT (max 200ms)
- [ ] Damage: Player 25 HP/shot, AI 50 HP/shot
- [ ] AI accuracy: 30% at 20m, 10% at 40m (difficulty tunable)

**Tests**: Hits register correctly with latency, AI accuracy within tolerance

### 4. Health System
- [ ] Player health: 100 HP, regenerates 1 HP/s after 5s without damage
- [ ] AI health: Trooper 100 HP
- [ ] Damage feedback: Screen flash (red), hit indicator, sound
- [ ] Death: Player respawns at Sietch, AI corpse stays for 30s then despawns

**Tests**: Health synced across clients, regeneration works, death handled

### 5. AI Combat Behavior
- [ ] Prioritize closest visible player
- [ ] Use cover: raycast to find nearby cover points, move to optimal position
- [ ] Suppression: Fire at player last known position even without LOS
- [ ] Flanking: If 2+ AI, coordinate to surround player
- [ ] Call for backup: If health <50%, nearby AI join combat (100m radius)

**Tests**: AI uses cover, flanks effectively, backup arrives

### 6. Thumper Jamming Mechanic
- [ ] Harkonnen AI can deploy "Jammer" (30s channel)
- [ ] Jammer disables active thumpers within 50m radius
- [ ] Visual: Red pulse effect from jammer, thumper stops animating
- [ ] Destroy jammer: Deal 50 damage, AI drops jammer
- [ ] Adds risk: Must defend thumpers or worm won't stay

**Tests**: Jammer disables thumpers, destroying it reactivates thumpers

### 7. Harkonnen Outposts
- [ ] Procedurally place 3-5 outposts per map (seed-based)
- [ ] Outpost: 4-6 AI troopers, simple structures (cubes/walls for cover)
- [ ] Capture mechanic: Defeat all AI, stand in zone 10s to capture
- [ ] Reward: 100 spice, unlocks fast travel to outpost
- [ ] Respawn: Outpost re-garrisoned after 30 minutes

**Tests**: Outposts spawn, capture works, fast travel enabled

### 8. Bot Backfill System
- [ ] Fremen bot AI: Simple follow/assist behavior
  - Follow nearest human player
  - Shoot at player's target
  - Deploy thumper when commanded (chat: "thumper here")
  - Don't mount worms (leave for human)
- [ ] Harkonnen bots: Use same AI as PvE enemies
- [ ] Matchmaking: Always fill to 4 total entities (humans + bots)
- [ ] Bot difficulty scales with player count (fewer humans = easier bots)

**Tests**: Bots join when <4 players, assist in combat, don't grief

### 9. Objective: Harvester Assault
- [ ] New objective type: Destroy Harkonnen harvester
- [ ] Harvester: Large vehicle at spice-rich location, 500 HP
- [ ] Guarded by 4-6 AI troopers
- [ ] Completion reward: 150 spice, 50 water, unlocks higher-tier gear
- [ ] Time limit: 10 minutes
- [ ] Can use worm to ram harvester (200 damage, risky)

**Tests**: Harvester spawns, AI defends, worm ram works, objective completes

### 10. Difficulty Tuning
- [ ] Easy mode (tutorial): AI 50 HP, 15% accuracy, slow reaction
- [ ] Normal mode: AI 100 HP, 30% accuracy, 1s reaction time
- [ ] Hard mode: AI 150 HP, 45% accuracy, 0.5s reaction time
- [ ] Adaptive difficulty: Adjust based on player performance (kill/death ratio)

**Tests**: Difficulty levels feel distinct, adaptive tuning works

## Success Criteria
- ✅ Combat feels fair and responsive
- ✅ AI poses challenge but is beatable
- ✅ Bot backfill makes solo play viable
- ✅ Thumper jamming adds strategic layer
- ✅ Harvester assault objective completable in 5-8 minutes

## Next Milestone
**VS5: Squad Cooperation** - Role specialization and team objectives
