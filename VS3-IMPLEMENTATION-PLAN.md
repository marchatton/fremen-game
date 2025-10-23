# VS3: Resource Loop - Implementation Plan

**Status**: In Progress
**Started**: October 2025
**Target Duration**: 3-4 weeks (compressed to 1-2 focused sessions)

## Overview

VS3 adds the progression layer that makes VS2 meaningful: spice rewards, water survival, equipment progression, and persistence.

## Implementation Strategy

### Phase 1: Foundation (Database & Persistence) 🔨
**Goal**: Set up persistent storage infrastructure

1. **Add Dependencies**
   - drizzle-orm (ORM)
   - drizzle-kit (migrations)
   - postgres (driver)
   - dotenv (env config)

2. **Database Schema** (`apps/server/src/db/schema.ts`)
   ```typescript
   players {
     id: string (primary key)
     username: string
     water: number (0-100)
     spice: number
     equipment: json { head, body, feet }
     stats: json { objectivesCompleted, totalSpice, distanceTraveled }
     lastPosition: json { x, y, z }
     createdAt: timestamp
     updatedAt: timestamp
   }
   ```

3. **Persistence Layer** (`apps/server/src/db/persistence.ts`)
   - `loadPlayer(playerId)`: Load from DB or create new
   - `savePlayer(player)`: Upsert player state
   - `autoSave()`: Periodic save every 5 minutes
   - Connection pooling
   - Transaction support

### Phase 2: Resource Systems (Spice & Water) 💧
**Goal**: Core economy mechanics

4. **Spice Harvesting** (`apps/server/src/game/SpiceManager.ts`)
   - Procedural node generation (seed-based)
   - Node states: Active, Depleted, Respawning
   - Harvest interaction (3s hold, distance validation)
   - Respawn timer (10 minutes)
   - Network sync

5. **Water Survival** (`apps/server/src/game/WaterSystem.ts`)
   - Depletion rates by activity:
     - Idle: -0.5/min
     - Walking: -1/min
     - Running: -2/min
     - Riding: -0.2/min (stillsuit bonus)
   - Thirst effects:
     - <50: -10% movement speed
     - <25: -25% speed + VFX
     - <10: -1 HP/second
   - Death at 0 water

6. **Oasis System** (`apps/server/src/game/OasisManager.ts`)
   - Fixed oasis locations
   - Refill interaction (+50 water)
   - 5min cooldown per oasis
   - Server validation

### Phase 3: Equipment & Progression 🎒
**Goal**: Meaningful progression system

7. **Equipment System** (`apps/server/src/game/EquipmentManager.ts`)
   - Equipment slots: `{ head, body, feet }`
   - Stillsuit tiers:
     - Basic: -25% water loss (50 spice)
     - Improved: -50% water loss (200 spice)
     - Advanced: -75% water loss (500 spice)
   - Equip/unequip validation
   - Stat calculation

8. **Sietch Hub** (`apps/server/src/game/Sietch.ts`)
   - Safe zone location (no damage)
   - NPC Merchant trades:
     - Basic Stillsuit: 50 spice
     - Thumper: 20 spice
     - Improved Stillsuit: 200 spice
   - Buy/sell validation
   - Trade logging

9. **Reward System** (`apps/server/src/game/RewardManager.ts`)
   - Objective completion rewards:
     - Shepherd Worm: 50 spice + 25 water
   - Reward notifications
   - Stat tracking:
     - objectivesCompleted
     - totalSpiceEarned
     - distanceTraveled

### Phase 4: Death & Respawn ☠️
**Goal**: Risk/reward balance

10. **Death System** (`apps/server/src/game/DeathManager.ts`)
    - Death conditions:
      - Water = 0
      - Health = 0 (fall damage, worm death)
    - Death penalties:
      - Drop 20% carried spice at location
      - Respawn at Sietch
    - Corpse markers (2min duration)
    - Corpse recovery interaction

### Phase 5: Type Definitions & Integration 🔗
**Goal**: Type-safe implementation

11. **Shared Types** (`packages/shared/src/types/resources.ts`)
    ```typescript
    interface PlayerResources {
      water: number;
      spice: number;
      equipment: Equipment;
      stats: PlayerStats;
    }

    interface Equipment {
      head?: EquipmentItem;
      body?: EquipmentItem;
      feet?: EquipmentItem;
    }

    enum EquipmentTier {
      BASIC = 'BASIC',
      IMPROVED = 'IMPROVED',
      ADVANCED = 'ADVANCED'
    }

    interface SpiceNode {
      id: string;
      position: Vector3;
      supply: number;
      state: 'ACTIVE' | 'DEPLETED' | 'RESPAWNING';
      respawnAt?: number;
    }

    interface Oasis {
      id: string;
      position: Vector3;
      cooldowns: Map<string, number>; // playerId -> cooldownEndTime
    }
    ```

12. **Network Protocol** (`packages/protocol/`)
    - `C_HARVEST_SPICE`: Client requests harvest
    - `C_REFILL_WATER`: Client requests water refill
    - `C_EQUIP_ITEM`: Client equips item
    - `C_TRADE`: Client initiates trade
    - `S_RESOURCES`: Server syncs resources
    - `S_SPICE_NODES`: Server syncs node states
    - `S_REWARD`: Server sends reward notification

### Phase 6: Testing 🧪
**Goal**: Comprehensive test coverage

13. **Test Files**
    - `SpiceManager.test.ts`: Node spawning, harvesting, respawn
    - `WaterSystem.test.ts`: Depletion rates, thirst effects
    - `EquipmentManager.test.ts`: Equip/unequip, stat calculation
    - `Persistence.test.ts`: Save/load, transactions
    - `Sietch.test.ts`: Trading, validation
    - `DeathManager.test.ts`: Death conditions, penalties, recovery
    - `ResourceIntegration.test.ts`: End-to-end flow

### Phase 7: Economy Balancing ⚖️
**Goal**: Fun progression curve

14. **Initial Balance**
    - Starting resources:
      - 100 water
      - 0 spice
      - Basic Stillsuit
      - 3 Thumpers
    - Objective rewards: 50 spice + 25 water
    - Time to first upgrade: ~4 objectives (~40 minutes)
    - Death penalty: 20% carried spice

15. **Playtest Metrics**
    - Water survival duration (target: 30+ min for new player)
    - Spice earn rate (target: 50/10min with objectives)
    - Death frequency (target: <1 per 30min for skilled player)
    - Progression feel (survey: fun vs. grindy)

## Implementation Order

```
Day 1-2: Foundation
├── Add dependencies
├── Database schema
├── Persistence layer
└── Basic save/load tests

Day 3-4: Resources
├── Spice harvesting
├── Water survival
├── Oasis system
└── Resource tests

Day 5-6: Progression
├── Equipment system
├── Sietch hub
├── Reward system
└── Integration tests

Day 7: Death & Polish
├── Death/respawn
├── Economy balancing
├── End-to-end tests
└── Documentation updates
```

## Success Metrics

### Technical
- ✅ 100% test pass rate
- ✅ No data loss in 100 connect/disconnect cycles
- ✅ Transaction safety (no duplication exploits)
- ✅ <50ms DB query latency (p95)

### Gameplay
- ✅ Water creates tension without frustration
- ✅ Spice rewards feel meaningful
- ✅ Stillsuit progression feels rewarding
- ✅ Death penalty balances risk/reward
- ✅ Economy enables 1-hour gameplay loop

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| PostgreSQL not installed | Provide Docker setup OR use SQLite for dev |
| Database migrations break | Version schema, test migrations |
| Resource balance too grindy | Rapid iteration with config file |
| Death penalty too harsh | Playtest early, adjust % |
| Transaction race conditions | Use DB-level locking, test concurrency |

## Environment Setup Required

```bash
# Add to .env
DATABASE_URL="postgresql://user:pass@localhost:5432/fremen"
DB_HOST="localhost"
DB_PORT="5432"
DB_NAME="fremen"
DB_USER="user"
DB_PASSWORD="pass"
```

## Dependencies to Add

```json
{
  "dependencies": {
    "drizzle-orm": "^0.30.0",
    "postgres": "^3.4.0",
    "dotenv": "^16.4.0"
  },
  "devDependencies": {
    "drizzle-kit": "^0.20.0"
  }
}
```

## Database Commands

```bash
# Generate migrations
pnpm drizzle-kit generate:pg

# Push schema (dev)
pnpm drizzle-kit push:pg

# Run migrations (prod)
pnpm drizzle-kit migrate
```

---

**Next Steps**: Review plan → Setup database → Implement Phase 1
