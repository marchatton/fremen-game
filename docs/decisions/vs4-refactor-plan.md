# VS4 Refactor Planning Brief

## Purpose & Scope
The VS4 PvE combat spec introduces tightly coupled systems – health, hitscan combat, patrol outposts, jamming, and bot backfill – that depend on stable VS3 resource persistence and the existing server tick loop. This brief evaluates the current implementation against the VS3/VS4 milestone requirements and proposes a refactor plan to unblock the remaining deliverables without rewriting working VS3 features. The focus is server-side architecture (authoritative loop, AI, persistence) and documentation alignment.

## Spec Checkpoints
- VS3 requires harvest persistence, water/stillsuit balancing, merchant trade, and death handling with database integration for load/save, tying economy state to player sessions.【F:docs/milestones/VS3-resource-loop.md†L8-L82】
- VS4 extends that base with Harkonnen combat: full AI state machine, health, hitscan combat, thumper jamming, outpost spawns, bot backfill, and harvester assault objective variants, each with explicit behavioral expectations.【F:docs/milestones/VS4-pve-combat.md†L8-L106】

## Current Implementation Findings
- `GameLoop` owns the entire VS3 stack (physics, water, oasis, equipment, sietch, reward, death) in a single class. There is no hook for VS4 systems, making further expansion difficult and creating implicit coupling between unrelated updates.【F:apps/server/src/game/GameLoop.ts†L15-L199】
- Player session management in `Room` still bootstraps everyone from `STARTING_RESOURCES` and only keeps state in memory; it never calls the Drizzle persistence helpers (`loadPlayer`, `savePlayer`, autosave) despite those utilities existing, so VS3 persistence requirements are unmet and tests would need to mock direct DB calls rather than an injected storage layer.【F:apps/server/src/game/Room.ts†L28-L148】【F:apps/server/src/db/persistence.ts†L1-L206】
- `HarkonnenAI` implements patrol/investigate/combat/retreat transitions but leaves critical VS4 behaviors stubbed: combat firing is a `TODO`, line-of-sight ignores terrain, hearing ignores weapon events, and there is no cover, suppression, coordination, jamming, or outpost integration despite the spec listing them as core deliverables.【F:apps/server/src/game/ai/HarkonnenAI.ts†L212-L318】【F:apps/server/src/game/ai/HarkonnenAI.ts†L351-L414】【F:docs/milestones/VS4-pve-combat.md†L44-L69】
- The Socket.io entry point only routes player movement, worm actions, thumper deployment, and chat; there is no channel for combat inputs, AI broadcasts, or persistence coordination, meaning any new combat system would have to cut through `index.ts` without structure.【F:apps/server/src/index.ts†L70-L170】

## Refactor Goals
1. Decouple the authoritative tick into modular systems that can register update hooks (physics, economy, AI, combat, objectives) to prevent further growth of `GameLoop` and to enable VS4 systems to plug in cleanly.
2. Integrate the persistence layer so VS3 state actually survives reconnects, enabling health/combat penalties and loot rewards to work consistently.
3. Promote `HarkonnenAI` into a service composed of perception, tactical decisions, and combat resolution layers, preparing for cover/backfill/thumper jamming behaviors.
4. Extend the transport layer with explicit combat and AI channels while maintaining existing worm/thumper flows.

## Proposed Phased Plan
### Phase 1 – Persistence & Session Restructure
1. Introduce a `PlayerRepository` interface that wraps `loadPlayer`/`savePlayer`/`autoSaveManager`, allowing `Room` to hydrate players asynchronously and update auto-save snapshots from within the tick loop (TDD by stubbing the repository in tests).【F:apps/server/src/game/Room.ts†L28-L148】【F:apps/server/src/db/persistence.ts†L1-L206】
2. Update `Room.addPlayer` to await player resources from the repository and to register/unregister players with the auto-save manager on join/leave, ensuring VS3 persistence obligations are finally met.【F:docs/milestones/VS3-resource-loop.md†L39-L82】
3. Expose persistence hooks from `GameLoop` (`onPlayerStateUpdated`, `onResourcesChanged`) so VS3 systems can feed into autosave without direct DB imports, reducing coupling for later combat death drops.【F:apps/server/src/game/GameLoop.ts†L91-L188】

### Phase 2 – System Scheduler Extraction
1. Replace `GameLoop`’s hard-coded update sequence with a pluggable scheduler (e.g., `SystemRegistry` storing `{id, update}` callbacks) and migrate physics, water, reward, objective, worm AI/damage into discrete system classes that conform to a shared interface. Preserve existing behavior via regression tests around tick ordering.【F:apps/server/src/game/GameLoop.ts†L91-L199】
2. Introduce lifecycle hooks (`onPlayerJoin`, `onPlayerLeave`) in the scheduler so future systems (combat, AI, bots) can initialize state when players connect without editing `Room` directly.
3. Ensure broadcasting remains centralized (one system responsible for serializing world snapshots) to avoid duplicated Socket.io emissions when VS4 combat states are added.【F:apps/server/src/index.ts†L70-L170】

### Phase 3 – Combat & Health Foundation
1. Define shared combat schemas (weapons, damage events) in `@fremen/protocol`, create a `CombatSystem` module that maintains player/AI health, applies regeneration, and emits hit/death events consistent with the VS4 health spec.【F:docs/milestones/VS4-pve-combat.md†L26-L42】
2. Move the stubbed firing logic out of `HarkonnenAI` into the combat system; inject a combat facade into the AI so state transitions remain deterministic while damage, accuracy curves, and lag compensation live in a dedicated module.【F:apps/server/src/game/ai/HarkonnenAI.ts†L351-L358】
3. Update Socket handlers to accept player fire commands and feed them through the combat system (validating sequences, performing rewind when lag compensation is implemented).【F:apps/server/src/index.ts†L93-L142】
4. Add Vitest coverage for combat edge cases (regen cooldown, simultaneous kills, death/resurrection) before wiring client messages, preserving the TDD guideline.

### Phase 4 – AI Extensions & Outpost Coordination
1. Split `HarkonnenAI` into perception (LOS/hearing), tactical planner (cover points, flanking, backup), and controller (movement execution). Introduce data structures for cover nodes/outpost definitions to support the VS4 outpost spec.【F:docs/milestones/VS4-pve-combat.md†L44-L69】【F:apps/server/src/game/ai/HarkonnenAI.ts†L293-L414】
2. Add an `AIManager` system that updates troopers each tick, requests combat resolution via the combat system, and publishes AI state snapshots to clients.
3. Build an outpost module responsible for seeding patrol paths, coordinating reinforcements, and scheduling respawns per VS4 deliverables.【F:docs/milestones/VS4-pve-combat.md†L62-L93】
4. Plan follow-up work (future doc) for thumper jamming and bot backfill once combat scaffolding is stable; both can hang off the AI/Combat systems rather than `GameLoop` directly.

## Testing & Documentation Strategy
- Maintain and extend the existing Vitest suites by adding scheduler/combat/AI integration tests that mirror spec scenarios before implementing runtime code (red-green-refactor).【F:apps/server/src/game/ai/HarkonnenAI.test.ts†L5-L688】
- Document the new system scheduler and persistence lifecycle in `docs/01-architecture.md` and update VS4 milestone checklists as pieces move from planned to complete to keep documentation trustworthy.【F:docs/milestones/VS4-pve-combat.md†L8-L106】

## Risks & Dependencies
- Requires careful migration to avoid regressing VS3 systems; prioritize regression tests for water depletion, rewards, and death before refactoring the loop.【F:apps/server/src/game/GameLoop.ts†L126-L199】
- Persistence integration depends on database availability; provide fallbacks/mocks so tests remain deterministic (the current utilities already guard against DB failures but need plumbing).【F:apps/server/src/db/persistence.ts†L1-L206】
- Combat protocol changes will impact the client; coordinate with `apps/client` once server interfaces are defined to avoid drift.
