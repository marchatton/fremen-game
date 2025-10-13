# Milestone 10: Harkonnen Enemy Implementation

## Overview
Create basic Harkonnen enemies with distinct low-poly models, animations, and fundamental AI behaviors (patrol, detect, attack). Implement basic combat loop (ranged attack). *(AI behavior trees and logic could reside in `server/src/core/ai/` or `server/src/entities/ai/`)*.

## Requirements

### 10.1 Low-Poly Enemy Design
- Models: Create 1-2 basic Harkonnen enemy types (e.g., Trooper) using `LowPolyMeshFactory` (target 150-300 polys). Distinct visual style from Fremen characters. Use vertex colors.
- Animation: Rig model with minimal bones (12-15). Create core animations: Idle, Walk, Run, Aim/Fire Ranged, Take Damage, Death. Use `AnimationMixer`.
- Rendering: Implement basic LOD (2 levels).

### 10.2 Enemy AI System (Server-Side)
- AI Core: Use simple state machine (Patrol, Investigate, Attack). Store state per AI entity.
- Patrol: Define simple patrol paths (list of Vector3 waypoints). AI moves between waypoints.
- Perception: Implement basic vision cone checks (dot product, distance, simple raycast for occlusion) and hearing radius check.
- Alert States: `Idle/Patrol` -> `Suspicious` (move to investigate last known source) -> `Combat` (target acquired).
- Optimization: Server activates full AI logic only for enemies within range of any player (e.g., 150m). Basic position updates for distant AI.

### 10.3 Combat System (Basic Ranged)
- Targeting: In `Combat` state, AI selects closest visible player as target.
- Ranged Attack: AI attempts to maintain optimal distance (e.g., 20-40m). Perform periodic line-of-sight check. If LOS exists, enter "Aim/Fire" animation state for short duration (e.g., 1s).
- Hit Calculation (Server-Side): When AI "fires", simulate hitscan projectile. Check collision with player capsule. Simple accuracy model (chance based on distance).
- Damage: If hit, send `C_PLAYER_TAKE_DAMAGE { amount }` to client. Client applies damage (requires basic health system). Play feedback.
- Player Combat: Allow players to fire back (basic raycast). Send `C_ATTACK_AI { aiId, damage }` to server. Server validates hit, reduces AI health. If health <= 0, switch AI to `Death` state, then despawn.

### 10.4 Stealth Mechanics (Basic Detection)
- Detection: AI uses perception system (10.2). Detection level increases based on player visibility, movement speed, noise.
- Awareness: If detection level crosses threshold, AI enters `Suspicious` or `Combat` state. Client needs basic UI indicator for player's own detection level.

### 10.5 Harkonnen Structures and Outposts (Placeholders)
- Place small groups of Harkonnen AI at predefined coordinates. Use basic cube/block structures as placeholders for cover.

### Network Sync
- Server broadcasts AI state (`id`, `position`, `rotation`, `velocity`, `health`, `animationState`, `targetPlayerId` if any) for active AI in `S_GAME_STATE` or `S_AI_STATE`. Client uses interpolation for smooth visual movement and animation.

## Deliverables
- 1-2 types of low-poly Harkonnen AI models with basic animations.
- Server-side AI with Patrol, Investigate, Combat states.
- Basic perception system (vision/hearing).
- Basic ranged combat implementation (AI attacks player, player attacks AI).
- Basic stealth detection mechanic and UI indicator.
- Network synchronization of AI state and basic combat events.

## Testing and Validation
- Harkonnen AI patrols predefined paths.
- AI detects players based on simple vision/sound checks and enters combat state.
- AI performs basic ranged attacks dealing damage to players.
- Players can damage and defeat AI.
- AI state is synchronized across clients.
- Basic player stealth indicator works.