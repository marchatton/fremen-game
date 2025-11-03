# VS4 Refactor Planning Brief

## Purpose & Scope
The VS4 PvE combat spec introduces tightly coupled systems – health, hitscan combat, patrol outposts, jamming, and bot backfill – that depend on stable VS3 resource persistence and the existing server tick loop. This brief evaluates the current implementation against the VS3/VS4 milestone requirements and proposes a refactor plan to unblock the remaining deliverables without rewriting working VS3 features. The focus is server-side architecture (authoritative loop, AI, persistence) and documentation alignment.

## Spec Checkpoints
- VS3 requires harvest persistence, water/stillsuit balancing, merchant trade, and death handling with database integration for load/save, tying economy state to player sessions.【F:docs/milestones/VS3-resource-loop.md†L8-L82】
- VS4 extends that base with Harkonnen combat: full AI state machine, health, hitscan combat, thumper jamming, outpost spawns, bot backfill, and harvester assault objective variants, each with explicit behavioral expectations.【F:docs/milestones/VS4-pve-combat.md†L8-L106】

## Current Implementation Findings
- `GameLoop` now delegates simulation to a `SystemRegistry` scheduler that wires physics, water, oasis cooldown maintenance, equipment stat caching, reward tracking, persistence, and the new combat module in deterministic order, replacing the previous monolithic tick method.【F:apps/server/src/game/GameLoop.ts†L36-L278】
- Player lifecycle flows through the injected `PlayerRepository`; joins hydrate from storage, autosave snapshots run every tick, and disconnects unregister with persisted position/resources, satisfying the VS3 persistence requirement.【F:apps/server/src/game/Room.ts†L28-L148】【F:apps/server/src/game/GameLoop.persistence.test.ts†L1-L37】
- `HarkonnenAI` now composes perception, tactics, and movement controllers orchestrated by an `AIManager` that maintains outpost garrisons, pauses bot backfill during thumper jamming, and routes AI fire through the shared combat system.【F:apps/server/src/game/ai/HarkonnenAI.ts†L1-L356】【F:apps/server/src/game/ai/AIManager.ts†L1-L131】【F:apps/server/src/game/OutpostManager.ts†L1-L175】
- World snapshots now include authoritative outpost state so clients can render capture progress, garrison strength, and jamming windows alongside player and worm data.【F:apps/server/src/game/GameLoop.ts†L153-L206】【F:packages/protocol/src/messages.ts†L1-L88】
- Socket handlers expose a dedicated `combat` channel so players can request fire events that the combat system validates and broadcasts alongside the existing state stream.【F:apps/server/src/index.ts†L94-L149】

## Refactor Goals
1. ✅ Decouple the authoritative tick into modular systems registered via `SystemRegistry`, giving physics, economy, combat, and persistence deterministic update slots without bloating `GameLoop`.
2. ✅ Integrate the persistence layer end-to-end so VS3 resource state survives reconnects and autosave snapshots stay fresh for combat penalties and loot rewards.
3. ✅ Promote `HarkonnenAI` into a service composed of perception, tactics, and combat resolution—trooper updates now flow through dedicated modules managed by an `AIManager` and outpost scheduler.【F:apps/server/src/game/ai/HarkonnenAI.ts†L1-L356】【F:apps/server/src/game/ai/AIManager.ts†L1-L131】
4. ✅ Extend the transport layer with explicit combat and AI channels; combat events emit through the shared channel and the state snapshot now carries outpost telemetry for clients.【F:packages/protocol/src/messages.ts†L1-L88】【F:apps/server/src/game/GameLoop.ts†L153-L206】

## Proposed Phased Plan
### Phase 1 – Persistence & Session Restructure
**Status:** ✅ Complete – `Room` hydrates from `PlayerRepository`, `GameLoop` snapshots every tick, and disconnects persist through the autosave manager.
1. Introduce a `PlayerRepository` interface that wraps `loadPlayer`/`savePlayer`/`autoSaveManager`, allowing `Room` to hydrate players asynchronously and update auto-save snapshots from within the tick loop (TDD by stubbing the repository in tests).【F:apps/server/src/game/Room.ts†L28-L148】【F:apps/server/src/db/persistence.ts†L1-L206】
2. Update `Room.addPlayer` to await player resources from the repository and to register/unregister players with the auto-save manager on join/leave, ensuring VS3 persistence obligations are finally met.【F:docs/milestones/VS3-resource-loop.md†L39-L82】
3. Expose persistence hooks from `GameLoop` (`onPlayerStateUpdated`, `onResourcesChanged`) so VS3 systems can feed into autosave without direct DB imports, reducing coupling for later combat death drops.【F:apps/server/src/game/GameLoop.ts†L91-L188】

### Phase 2 – System Scheduler Extraction
**Status:** ✅ Complete – `SystemRegistry` orders physics, worm AI, water, combat, rewards, oasis cleanup, and persistence hooks per tick.
1. Replace `GameLoop`’s hard-coded update sequence with a pluggable scheduler (e.g., `SystemRegistry` storing `{id, update}` callbacks) and migrate physics, water, reward, objective, worm AI/damage into discrete system classes that conform to a shared interface. Preserve existing behavior via regression tests around tick ordering.【F:apps/server/src/game/GameLoop.ts†L91-L199】
2. Introduce lifecycle hooks (`onPlayerJoin`, `onPlayerLeave`) in the scheduler so future systems (combat, AI, bots) can initialize state when players connect without editing `Room` directly.
3. Ensure broadcasting remains centralized (one system responsible for serializing world snapshots) to avoid duplicated Socket.io emissions when VS4 combat states are added.【F:apps/server/src/index.ts†L70-L170】

### Phase 3 – Combat & Health Foundation
**Status:** ✅ Complete – Combat schemas, regeneration rules, and AI fire flows are covered by unit tests and the new VS4 integration suite.
1. ✅ Define shared combat schemas (weapons, damage events) in `@fremen/protocol`, create a `CombatSystem` module that maintains player/AI health, applies regeneration, and emits hit/death events consistent with the VS4 health spec.【F:packages/protocol/src/messages.ts†L1-L70】【F:apps/server/src/game/CombatSystem.ts†L1-L170】
2. ✅ Move the stubbed firing logic out of `HarkonnenAI` into the combat system; inject a combat facade into the AI so state transitions remain deterministic while damage, accuracy curves, and lag compensation live in a dedicated module.【F:apps/server/src/game/ai/HarkonnenAI.ts†L21-L383】
3. ✅ Update Socket handlers to accept player fire commands and feed them through the combat system (validating sequences, performing rewind when lag compensation is implemented).【F:apps/server/src/index.ts†L112-L149】
4. ✅ Add Vitest coverage for combat edge cases (regen cooldown, simultaneous kills, death/resurrection) and AI fire verification before wiring client UI, preserving the TDD guideline.【F:apps/server/src/game/OutpostIntegration.test.ts†L1-L142】

### Phase 4 – AI Extensions & Outpost Coordination
**Status:** ✅ Complete – Troopers now patrol seeded outposts, respect thumper jamming, and backfill via the modular AI scheduler.
1. Split `HarkonnenAI` into perception (LOS/hearing), tactical planner, and controller modules to support deterministic squad behaviour.【F:apps/server/src/game/ai/PerceptionModule.ts†L1-L45】【F:apps/server/src/game/ai/TacticsModule.ts†L1-L86】【F:apps/server/src/game/ai/HarkonnenAI.ts†L1-L356】
2. Add an `AIManager` system that updates troopers each tick, requests combat resolution via the combat system, and publishes AI-driven events for mixed sessions.【F:apps/server/src/game/ai/AIManager.ts†L1-L131】【F:apps/server/src/game/OutpostIntegration.test.ts†L101-L142】
3. Build an outpost module responsible for seeding patrol paths, coordinating reinforcements, managing capture timers, and pausing bot backfill when jammed.【F:apps/server/src/game/OutpostManager.ts†L1-L175】
4. Document thumper jamming and bot backfill behaviour through the shared constants so the combat/AI pipeline reflects the VS4 spec.【F:packages/shared/src/constants/vs4.ts†L1-L10】

## Testing & Documentation Strategy
- Maintain and extend the existing Vitest suites by adding scheduler/combat/AI integration tests that mirror spec scenarios before implementing runtime code (red-green-refactor).【F:apps/server/src/game/ai/HarkonnenAI.test.ts†L5-L688】
- Document the new system scheduler and persistence lifecycle in `docs/01-architecture.md` and update VS4 milestone checklists as pieces move from planned to complete to keep documentation trustworthy.【F:docs/milestones/VS4-pve-combat.md†L8-L106】

## Risks & Dependencies
- Requires careful migration to avoid regressing VS3 systems; prioritize regression tests for water depletion, rewards, and death before refactoring the loop.【F:apps/server/src/game/GameLoop.ts†L126-L199】
- Persistence integration depends on database availability; provide fallbacks/mocks so tests remain deterministic (the current utilities already guard against DB failures but need plumbing).【F:apps/server/src/db/persistence.ts†L1-L206】
- Combat protocol changes will impact the client; coordinate with `apps/client` once server interfaces are defined to avoid drift.
