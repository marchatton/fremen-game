# Gameplay Mechanics Deep Dive

## Core Gameplay Loop (5-15 Minutes)

```
Squad Formation → Choose Objective → Deploy Thumper → 
Attract Worm → Mount & Ride → Complete Objective → 
Return to Sietch → Spend Rewards → Repeat
```

## Worm Mechanics

### Worm Behavior States
1. **PATROLLING** (Default)
   - Random waypoint selection in valid terrain
   - Speed: 10-15 m/s
   - Detection radius: 200m for vibrations
   - Ignores players unless thumper active

2. **APPROACHING_THUMPER** (Attracted)
   - Moves toward strongest vibration source
   - Slows to 5 m/s when within 20m
   - Enters mountable state for 10-15 seconds
   - Multiple thumpers: Goes to strongest signal

3. **RIDDEN_BY** (Player Control)
   - Player controls heading and speed
   - Speed range: 5-25 m/s
   - Turn rate: Max 45°/second
   - Ignores thumpers while ridden

4. **AGITATED** (Threatened)
   - Takes damage or stuck in terrain
   - Bucks rider if health <30%
   - Erratic movement, hard to steer
   - Returns to patrol after 30s calm

### Worm Physics
- **Spline-Based Movement**: Uses CatmullRom curve with 8-12 control points
- **Segment Count**: 12-16 segments depending on worm size
- **Collision**: Head segment checks terrain, body follows
- **Undulation**: Sine wave perpendicular to movement direction
- **Terrain Interaction**: Stays on surface, can "jump" small dunes

### Mounting System
```typescript
// Mounting conditions
const canMount = 
  worm.state === "APPROACHING_THUMPER" &&
  distance(player, worm.head) < 5 &&
  !player.isMounted &&
  !worm.hasRider;

// Mounting sequence
1. Player presses E near mountable worm
2. Server validates conditions
3. Player enters 1s mounting animation
4. Player position parented to worm segment[2]
5. Camera transitions to riding mode (0.5s lerp)
6. Worm enters RIDDEN_BY state
7. Controls switch to worm steering
```

### Steering Controls
- **WASD/Left Stick**: Direction input (normalized vector)
- **W/S**: Accelerate/decelerate (±5 m/s per second)
- **A/D**: Turn left/right (heading adjustment)
- **Space**: Boost (1.5x speed for 3s, 30s cooldown)
- **E**: Dismount (safe eject to side)

## Thumper Mechanics

### Thumper Types
1. **Small Thumper** (20 spice)
   - Vibration radius: 100m
   - Duration: 60 seconds
   - Attracts 1 worm

2. **Medium Thumper** (50 spice)
   - Vibration radius: 200m
   - Duration: 120 seconds
   - Attracts 2-3 worms
   - Louder (alerts AI within 150m)

3. **Large Thumper** (100 spice, VS5+)
   - Vibration radius: 400m
   - Duration: 180 seconds
   - Attracts all nearby worms
   - Very loud (alerts all AI in region)

### Thumper Placement
- **Valid Zones**: Open sand, not in Sietch or outposts
- **Minimum Spacing**: 50m from other thumpers
- **Placement Preview**: Ghost model shows radius before deploy
- **Activation Delay**: 3 seconds after placement
- **Deactivation**: Expires or destroyed by AI jammer

### Vibration Propagation
```typescript
// Vibration strength calculation
const strength = thumper.basePower * 
  (1 - distance / thumper.radius) * 
  terrainModifier;

// Worm attraction priority
const priority = strength - 
  (currentDistance * 0.1) + 
  (isPlayerNearby ? 20 : 0);
```

## Resource Systems

### Water Management
```typescript
// Water consumption rates (per minute)
const waterConsumption = {
  idle: 0.5,
  walking: 1.0,
  running: 2.0,
  combat: 1.5,
  riding: 0.2, // Stillsuit efficiency
  sietch: 0    // Safe zone
};

// Stillsuit modifiers
const stillsuitModifier = {
  none: 1.0,
  basic: 0.75,    // -25%
  improved: 0.5,  // -50%
  advanced: 0.25  // -75%
};

// Final consumption
waterLoss = baseRate * stillsuitModifier * environmentModifier;
```

### Thirst Effects
| Water Level | Effects | Visual |
|-------------|---------|--------|
| 100-50 | None | Normal |
| 50-25 | -10% movement speed | Yellow tint |
| 25-10 | -25% speed, -10% accuracy | Orange tint, pulse |
| <10 | -50% speed, -1 HP/s | Red, heavy vignette |

### Spice Economy
```typescript
// Spice sources
const spiceSources = {
  smallNode: 50,
  mediumNode: 100,
  largeNode: 250,
  shepherdObjective: 50,
  harvesterAssault: 150,
  teamObjective: 100 // Split among squad
};

// Spice costs
const spiceCosts = {
  smallThumper: 20,
  mediumThumper: 50,
  basicStillsuit: 50,
  improvedStillsuit: 200,
  advancedStillsuit: 500,
  weapon: 100,
  cosmetics: 50-500
};
```

## Combat System

### Player Weapons
1. **Maula Pistol** (Starting weapon)
   - Damage: 25 HP
   - Rate: 1 shot/second
   - Magazine: 6 shots
   - Reload: 2 seconds
   - Range: Effective <50m

2. **Crysknife** (Melee, unlocked)
   - Damage: 50 HP
   - Rate: 2 slashes/second
   - Range: 2m
   - Special: Silent kills (no AI alert)

### Hit Detection
```typescript
// Server-side lag compensation
function validateHit(
  shooter: Player,
  target: Entity,
  hitPosition: Vector3,
  shotTimestamp: number
): boolean {
  // Rewind target position by RTT
  const compensatedPosition = rewindEntityPosition(
    target,
    Date.now() - shotTimestamp,
    MAX_COMPENSATION_MS
  );
  
  // Raycast from shooter to hit position
  const ray = new Ray(shooter.position, hitPosition);
  
  // Check if hit within tolerance
  return ray.distanceToPoint(compensatedPosition) < HIT_TOLERANCE;
}
```

### AI Combat
- **Detection**: 90° vision cone, 50m range, hearing radius 30m
- **Accuracy**: Distance-based (30% at 20m, 10% at 40m)
- **Behavior**: Take cover, flank, call backup
- **Weakness**: Predictable patrol patterns, vulnerable to stealth

## Objective Types

### 1. Shepherd Worm
- **Goal**: Guide worm to marked location
- **Distance**: 300-500m from start
- **Time Limit**: 5 minutes
- **Reward**: 50 spice, 25 water
- **Failure**: No penalty, new objective spawns

### 2. Harvester Assault (VS4+)
- **Goal**: Destroy Harkonnen harvester
- **Health**: 500 HP
- **Defenders**: 4-6 AI troopers
- **Time Limit**: 10 minutes
- **Reward**: 150 spice, 50 water, equipment unlock
- **Failure**: Harvester escapes, cooldown 10 minutes

### 3. Beacon Activation (VS5+)
- **Goal**: Activate 3 beacons simultaneously
- **Mechanics**: 30s channel per beacon (interruptible)
- **Requirement**: All 3 active within 60s window
- **Coordination**: Requires 3-4 players split up
- **Reward**: 300 spice (split), sandstorm ability
- **Failure**: Must restart, 5-minute cooldown

### 4. Convoy Escort (VS5+)
- **Goal**: Protect 3 AI vehicles for 5 minutes
- **Success Condition**: 2+ vehicles survive
- **Threats**: 2 ambush points with 8 AI total
- **Reward**: 400 spice (split), rare equipment
- **Failure**: <2 vehicles survive, no reward

## Squad Roles (VS5+)

### Scout
- **Strengths**: +20% movement, enhanced minimap, stealth bonus
- **Weaknesses**: -20% combat damage
- **Abilities**: Mark targets, binoculars, silent movement
- **Playstyle**: Reconnaissance, flanking, objective spotting

### Thumper Specialist
- **Strengths**: 3 thumpers (vs 1), +50% vibration radius, boost signal
- **Weaknesses**: -10% movement speed (carrying equipment)
- **Abilities**: Signal boost (2x strength, 30s), instant deploy
- **Playstyle**: Worm attraction, area control, support

### Rider
- **Strengths**: -50% mount time, +1 passenger, better steering
- **Weaknesses**: Dismount stun (-2s recovery)
- **Abilities**: Emergency dismount, worm boost (short speed burst)
- **Playstyle**: Transportation, worm control, mobility

### Harvester
- **Strengths**: 2x harvest speed, 2x carry capacity
- **Weaknesses**: -10% movement speed (carrying resources)
- **Abilities**: Scan for spice (reveal nodes in 100m), deposit at any outpost
- **Playstyle**: Resource gathering, economy support

## Progression Systems

### Player Levels
```typescript
// XP sources
const xpGains = {
  objectiveComplete: 100,
  aiKill: 10,
  spiceHarvested: 1, // per unit
  distanceTraveled: 0.1, // per meter
  teamBonus: 1.1 // 10% bonus if in formation
};

// Level benefits
const levelRewards = {
  5: { unlock: "Crysknife" },
  10: { unlock: "Medium Thumper" },
  15: { unlock: "Improved Stillsuit" },
  20: { unlock: "Advanced Stillsuit" },
  25: { unlock: "Cosmetic Pack 1" }
};
```

### Unlockables
- **Equipment**: Better stillsuits, weapons, thumpers
- **Cosmetics**: Character skins, worm skins, emotes
- **Abilities**: Role-specific skills (unlock tree later)

## Environmental Mechanics

### Day/Night Cycle (VS3+)
- **Duration**: 24 real minutes = 24 game hours
- **Day Effects**: +50% water consumption, better visibility
- **Night Effects**: -50% water consumption, reduced AI detection range
- **Transition**: Dawn/dusk last 2 minutes each

### Weather: Sandstorms (VS3+)
- **Frequency**: Random, 10-20% of time
- **Effects**: -50% visibility, -25% movement speed, noise masks vibrations
- **Duration**: 2-5 minutes
- **Gameplay**: High-risk spice collection during storms

### Biomes (VS3+)
1. **Dune Sea**: Standard terrain, moderate spice
2. **Rocky Waste**: Harder navigation, more cover, AI outposts
3. **Salt Flats**: Fast travel, low cover, rare mega-nodes

## Social Features

### Clans (VS5+)
- **Creation**: 1000 spice cost, choose name/tag
- **Membership**: Max 20 players
- **Benefits**: Shared bank, clan hall, cosmetics, leaderboards
- **Activities**: Clan objectives (weekly), tournaments

### Communication
- **Text Chat**: Global, Team, Proximity (30m)
- **Voice Chat**: Squad (always), Proximity (50m, opt-in)
- **Ping System**: Enemy, Loot, Rally, Danger (contextual)
- **Emotes**: 12 unlockable (wave, point, dance, etc.)
