# VS3: Resource Loop

**Duration**: 3-4 weeks  
**Goal**: Add persistent economy with spice harvesting, water survival, and rewards

## Deliverables

### 1. Spice Harvesting System
- [ ] Procedural spice node placement (seed-based, 1 node per 100m² in viable zones)
- [ ] Spice node states: Active (glowing), Depleted (grey), Respawning (pulsing)
- [ ] Harvest interaction: approach node, hold E for 3s, collect spice
- [ ] Server validation: distance check, node has supply, harvest rate limits
- [ ] Node depletion: 100 units → 0, respawn after 10 minutes
- [ ] HUD: Spice count, nearby node indicator (compass marker)

**Tests**: Nodes spawn deterministically, harvest validated, respawn timer works

### 2. Water Survival Mechanics
- [ ] Water level (0-100) decreases based on activity
  - Idle: -0.5/minute
  - Walking: -1/minute
  - Running: -2/minute
  - Riding worm: -0.2/minute (stillsuit efficient)
- [ ] Thirst stages: Mild (<50): -10% speed, Moderate (<25): -25% speed + blur VFX, Severe (<10): -1 HP/second
- [ ] Oasis zones: marked on map, interact to refill (+50 water), 5min cooldown per oasis
- [ ] HUD: Water bar with color coding (blue→yellow→red)

**Tests**: Water depletes at correct rates, thirst effects apply, oasis refills work

### 3. Stillsuit Equipment
- [ ] Equipment slots: Head, Body (stillsuit), Feet
- [ ] Stillsuit tiers: Basic (-25% water loss), Improved (-50%), Advanced (-75%)
- [ ] Acquire via: Tutorial gives Basic, purchase at Sietch with spice
- [ ] Equip UI: Simple inventory screen, drag-and-drop or click to equip
- [ ] Server validates equipment effects in water calculation

**Tests**: Stillsuits reduce water loss correctly, equip/unequip persists

### 4. Database Persistence (DrizzleORM)
- [ ] Schema: `players` table (id, username, water, spice, equipment, last_position)
- [ ] On connect: Load player state from DB
- [ ] On disconnect: Save current state
- [ ] Periodic auto-save: Every 5 minutes while connected
- [ ] Transactions for spice/water changes (prevent duplication exploits)

**Tests**: State persists across sessions, concurrent updates don't corrupt data

### 5. Sietch Hub (Basic)
- [ ] Single Sietch location (safe zone, no PvE)
- [ ] NPC Merchant: Buy/sell stillsuits, thumpers
- [ ] Trade UI: Item list, prices in spice, buy/sell buttons
- [ ] Placeholder: 3 items (Basic Stillsuit: 50 spice, Thumper: 20 spice, Improved Stillsuit: 200 spice)
- [ ] Fast travel: Respawn at Sietch on death or manual return (/sietch command)

**Tests**: Merchant trades validate spice balance, items appear in inventory

### 6. Reward System
- [ ] Objective completion rewards: Shepherd Worm → 50 spice + 25 water
- [ ] Display reward notification on completion
- [ ] Track player stats: Objectives completed, total spice earned, distance traveled
- [ ] Stats UI: Simple panel showing career stats

**Tests**: Rewards granted correctly, stats persist

### 7. Economy Balancing
- [ ] Initial balancing pass:
  - Starting gear: Basic Stillsuit, 1 Thumper, 100 water
  - First objective takes ~10 min, rewards 50 spice
  - Improved Stillsuit costs 200 spice (~4 objectives)
  - Death penalty: Lose 20% of carried spice (incentive to deposit)
- [ ] Playtesting feedback loop for adjustments

**Tests**: Progression feels achievable, not grindy

### 8. Death & Respawn
- [ ] Death conditions: Water reaches 0, fall damage, worm death (if no invulnerability)
- [ ] On death: Drop 20% spice at location, respawn at Sietch
- [ ] Death VFX: Fade to black, respawn animation
- [ ] Corpse marker: Temporary marker at death location (2min), can retrieve dropped spice

**Tests**: Death handled correctly, spice recovery works, no exploits

## Success Criteria
- ✅ Spice/water economy creates meaningful choices
- ✅ Players motivated to return to Sietch with rewards
- ✅ Stillsuit progression feels rewarding
- ✅ State persists reliably (no data loss on 100 test sessions)
- ✅ Death penalty balances risk/reward

## Next Milestone
**VS4: PvE Combat** - Add Harkonnen AI patrols and combat loop
