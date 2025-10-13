# Milestone 00: Milestone Overview

## Overview
This document provides a high-level overview of all project milestones, focusing on low-poly procedural generation, performance optimization, and iterative development. Refer to individual milestone documents for detailed requirements.

## Tech Stack
- **Frontend:** Three.js (latest stable), Vite (TypeScript template `vanilla-ts`)
- **Assets:** Procedurally generated low-poly models (Target: Characters 150-300 polys, Objects 50-200 polys, Worm Segments 100-150 polys)
- **Visual Style:** Toon/cell-shaded rendering, vertex colors primarily, Dune-inspired UI/UX (Unturned/Fortnite aesthetic)
- **Audio:** Web Audio API for positional sound effects
- **Client Hosting:** Vercel (CI/CD integrated)
- **Backend:** Node.js runtime (TypeScript recommended), Socket.io for WebSockets
- **Server Hosting:** Railway (Dockerized, CI/CD integrated)
- **Database:** DrizzleORM (PostgreSQL recommended on Railway) for player state, inventory, mission progress, etc.
- **State Sync:** Authoritative server with client prediction, interpolation, reconciliation, delta compression (Fortnite-inspired hybrid model)
- **Target Structure:** Follows a `client/` and `server/` monorepo structure. Key client directories might include `core`, `components`, `entities`, `networking`, `lowpoly`, `terrain`, `physics`, `shaders`, `materials`. Key server directories might include `core`, `auth`, `networking`, `rooms`, `types`. (See M1 for initial setup).

## Development Phases

*(Goal: Each milestone should result in a demonstrable, testable integration point.)*
*(the names of the files wont't match perfectly but the numbering system will follow)*

### Foundation Phase (M1-M3)
1.  **Core Three.js Low-Poly Engine:** Basic rendering, asset loading, procedural mesh foundation, input, camera. *Test Goal: Render basic scene.* 
2.  **Multiplayer Networking Foundation:** Socket.io client/server, connection, basic state sync (position/rotation), JWT auth placeholder. *Test Goal: Multiple clients see synchronized cubes.*
3.  **Low-Poly Procedural Terrain:** Chunked terrain, heightmap generation, basic LOD, server-side collision. *Test Goal: Players collide with terrain surface.*

### Core Gameplay Phase (M4-M8)
4.  **Low-Poly Character System:** Fremen character model/animation, networked controller (prediction/reconciliation), basic water survival. *Test Goal: Responsive character movement/animation, basic survival.*
5.  **Low-Poly Sandworm System:** Procedural worm model, fluid spline animation, basic AI (patrol), network sync. *Test Goal: Worms patrol smoothly.*
6.  **Thumper and Worm Attraction System:** Deployable thumpers, vibration mechanic, worm AI responds to thumpers. *Test Goal: Thumpers attract worms.*
7.  **Worm Riding Mechanics:** Basic mounting, steering control, dismounting. *Test Goal: Player can mount and steer a worm.*
8.  **Resource System Implementation:** Water refinement, basic spice collection, placeholder equipment slots, DrizzleORM persistence. *Test Goal: Resources deplete/replenish, state persists.*

### Multiplayer Experience Phase (M9-M12)
9.  **Player Interaction and Communication:** Text/voice chat (basic implementation), emotes, ping/marker system. *Test Goal: Players can communicate via chat/pings.*
10. **Harkonnen Enemy Implementation:** Basic Harkonnen AI (patrol, combat), low-poly models, network sync. *Test Goal: Players encounter basic hostile AI.*
11. **Mission and Objective System:** Mission framework, basic objective types (e.g., collect, eliminate), UI tracking, rewards placeholder. *Test Goal: Players can accept/complete simple missions.*
12. **Environmental Variety and Weather:** Basic biome differences, dynamic weather effects (sandstorm), day/night cycle visuals/impact. *Test Goal: World feels more dynamic.*

### Polish and Infrastructure Phase (M13-M17)
13. **Sietch Settlements and Social Hubs:** Basic Sietch layout, NPC placeholders, basic services (trading placeholder). *Test Goal: Players can enter a social hub.*
14. **Performance Optimization and Scaling:** Implement core optimizations (LOD, culling, network compression), profiling tools. *Test Goal: Measurable performance improvements.*
15. **UI/UX Finalization:** Apply Dune aesthetic (fonts, colors, layout) to all UI, core accessibility. *Test Goal: UI is visually consistent and accessible.*
16. **Server Infrastructure and Scaling:** Railway deployment optimization, basic load balancing/scaling setup, monitoring. *Test Goal: Server handles increased load.*
17. **Final Integration and Testing:** End-to-end testing, bug fixing, balancing, deployment prep. *Test Goal: Stable, balanced, launch-ready build.*

## Key Simplifications
1.  **Low-Poly Assets:** Prioritize procedural generation over imported models. Focus on distinctive silhouettes and vertex coloring. Sandworms get slightly higher detail for fluid motion.
2.  **Performance:** Target 60fps on mid-spec. Minimal bones, efficient LOD, object pooling/instancing, optimized shaders.
3.  **Network:** Implement robust prediction/reconciliation. Use efficient serialization (binary preferred eventually), delta compression, interest management, and tiered update rates.
4.  **Physics:** Gameplay-focused, not hyper-realistic. Simple collisions, defined surface types, server authority with reconciliation.

## Development Approach
- **Iterative & Testable:** Each milestone builds upon the last and must be testable, ideally with an integration test simulating player interaction.
- **Simplicity First:** Implement the simplest version that meets core requirements first, then enhance. Question complexity.
- **Performance Aware:** Integrate performance monitoring early (M1). Address bottlenecks proactively (M14).
- **Security Minded:** Server validates all critical actions. Sanitize inputs. Rate limit.
- **Troubleshooting:** Follow structured approach (Hypothesize, Prioritize, Diagnose, Simplify/Test, Fix & Verify, Prevent & Document).
