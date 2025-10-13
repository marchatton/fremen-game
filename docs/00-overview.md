# Fremen's Vengeance - Project Overview

## Vision
A tactical multiplayer game where Fremen squads coordinate to attract, mount, and ride sandworms to complete objectives while managing resources and evading Harkonnen patrols. Built with low-poly procedural aesthetics for performance and charm.

## Core Gameplay Loop
1. **Squad Formation** - Players join 2-4 person squads with distinct roles (Scout, Thumper, Rider, Harvester)
2. **Objective Selection** - Squad chooses mission (Shepherd Worm, Harvest Spice, Capture Beacons)
3. **Thumper Deployment** - Strategic placement attracts worms but also alerts enemies
4. **Worm Riding** - Mount and control worms to reach objectives or attack Harkonnen
5. **Resource Management** - Collect spice, manage water, return to Sietch for rewards
6. **Risk/Reward** - Louder thumpers = faster worms + more danger from patrols

## Tech Stack
- **Client**: Three.js + Vite + TypeScript (deployed on Vercel)
- **Server**: Node.js + Socket.io + TypeScript (deployed on Railway)
- **Database**: DrizzleORM + PostgreSQL
- **Package Manager**: pnpm with workspace monorepo
- **State Sync**: Authoritative server with client prediction/reconciliation (JSON → binary when needed)

## Development Philosophy
- **TDD**: Test-first for core systems (movement, worm AI, state sync, resource validation)
- **Vertical Slices**: Build playable features end-to-end rather than horizontal layers
- **YAGNI**: Start simple (JSON protocol, in-memory state) and add complexity only when metrics demand it
- **Edge-Case Ready**: Plan for low player counts (bots), disconnections, and exploits from day one

## Minimum Viable Product (VS1 + VS2)
- 2-4 players can join a session
- Procedural terrain with basic worm patrol
- Deploy thumpers to attract worms
- Mount, ride, and steer worms
- Basic "shepherd worm to marker" objective
- Reconnection handling
- AI bots fill empty slots

## Development Roadmap (Vertical Slices)
1. **VS1**: Online Sandbox (2-4 weeks) - Movement, terrain, basic worm, thumper attraction
2. **VS2**: Worm Riding Core (4-6 weeks) - Mount/ride/steer mechanics, first playable objective
3. **VS3**: Resource Loop (3-4 weeks) - Spice harvesting, water survival, persistence
4. **VS4**: PvE Combat (4-5 weeks) - Harkonnen AI patrols, combat, thumper jamming
5. **VS5**: Squad Cooperation (3-4 weeks) - Role specialization, team objectives
6. **VS6**: Polish & Scale (4-6 weeks) - Performance optimization, UI/UX, stability

Total estimated timeline: **5-6 months** to polished playtest

## Key Innovations vs. Old Docs
- **Vertical slices** instead of 17 sequential milestones (faster to fun)
- **Squad roles** create natural cooperation and emergent gameplay
- **Bot backfill** ensures viable matches with low player counts
- **Simplified architecture** with shared packages and deterministic server sim
- **JSON-first protocol** with clear migration path to binary only when metrics demand it
- **Edge-case policies** defined upfront (disconnection, griefing, exploits)

## Success Metrics
- **Fun Factor**: Playtesters want "one more round" after 10-15 min session
- **Performance**: Consistent 60fps on mid-spec devices, <150ms perceived input lag
- **Stability**: <1% disconnection rate, <30s reconnection recovery
- **Retention**: 40%+ players return for 2nd session within 48 hours
