# State Synchronization Architecture (Updated)
## Dune: Fremen's Vengeance Multiplayer

This document details the simplified architecture and approaches for synchronizing game state between the server and clients in our multiplayer implementation, taking inspiration from Fortnite's efficient client-server model.

## Core Architecture

### Authoritative Server Model

Our game uses an authoritative server model where:

-   The server (running in `server/`) maintains the single source of truth for game state.
-   All critical game actions (movement, combat, resource collection) are validated server-side (logic primarily in `server/src/core/` and `server/src/entities/`).
-   Clients (`client/`) send inputs to the server rather than directly manipulating game state.
-   The server processes inputs, updates the game state, and broadcasts the results via Socket.io (handled in `server/src/networking/`).

┌─────────┐         ┌─────────┐         ┌─────────┐
│ Client 1 │         │  Server │         │ Client 2 │
└────┬────┘         └────┬────┘         └────┬────┘
│    Input/Actions  │                    │
│ ───────────────► │                    │
│   (client/src/..)|                    │
│                   │                    │
│                   │  Process & Validate│
│                   │ ◄─(server/src/..)─►│
│                   │                    │
│    State Updates  │   State Updates    │
│ ◄─────────────── │ ───────────────►   │
│                   │                    │


### Fortnite-Inspired Client-Side Prediction

To create responsive gameplay despite network latency:

1.  **Optimistic Client Prediction**:
    * Clients (`client/src/physics/`, `client/src/game/`) immediately apply inputs locally (movement, interactions).
    * Game simulates the expected outcome without waiting for server confirmation.
    * Creates responsive feel similar to Fortnite despite network latency.
    * Applies buffered input with timestamp for replay capability (200ms prediction buffer).

2.  **Smart Server Reconciliation**:
    * Server processes the input and sends authoritative state back (10-20 updates/second).
    * Client (`client/src/networking/`) compares predicted state with server state and evaluates discrepancy.
    * If difference is minor (<0.5m), client smoothly interpolates to correct position over 100-200ms.
    * If difference is major (>0.5m), client teleports to correct position with visual effect.
    * For special cases like sandworm riding, uses custom reconciliation logic with visual smoothing.

3.  **Fixed Timestep Simulation**:
    * Both client and server run physics at the same fixed timestep (e.g., 60 updates/second) (logic in `client/src/physics/` and `server/src/core/physics/`).
    * Server runs authoritative simulation prioritizing security.
    * Client runs prediction at high frequency for smooth visuals.
    * Synchronization timestamp included in all messages for error correction.

## Network Optimization Techniques

### Delta Compression

Instead of sending full state updates, we transmit only the differences:

-   Server (in `server/src/networking/` or `core/`) sends only what changed since the last acknowledged state.
-   Clients apply these deltas to their local state.
-   Periodic full state snapshots (every 5 seconds) to prevent drift.
-   Binary format for efficient transmission (target 12-16 bytes per entity update).

### Interest Management

Clients only receive updates for entities they need to know about:

-   Server (`server/src/core/` or `networking/`) determines entity relevance based on distance/importance.
-   Players receive updates only for entities in their view radius (high priority: 0-100m, medium: 100-300m, low: 300m+).
-   Server manages a grid-based visibility system (e.g., 32×32m cells).
-   Dynamic priority based on distance and importance.
-   Critical events (combat, explosions) have larger broadcast radius and higher priority.

### Entity Interpolation

For smooth visualization of other players and entities:

-   Server sends entity positions at fixed intervals (e.g., 10-20 updates/second).
-   Client (`client/src/game/` or `entities/`) interpolates between received positions for smooth rendering.
-   Balances network traffic against visual smoothness.
-   Special handling for rapid changes of direction (rotation prediction).

## Data Structures & Message Types

### Entity Component System

Our entity representation follows a simplified component-based approach:

-   Entities are identified by unique numeric IDs (e.g., 16-bit or 32-bit).
-   Components store specific aspects of entity state (position, health, etc.). *(Defined potentially in `client/src/types/` and `server/src/types/`)*.
-   Only modified components are transmitted in updates.
-   Fixed schema for each entity type for efficient parsing.

### Message Protocol

Our Socket.io implementation uses these primary message types: *(Actual definitions might live in `server/src/types/` or a shared types package)*.

1.  **Input Messages** (Client → Server):
    ```typescript
    // Example Structure (actual format TBD, likely binary)
    interface ClientInput {
      type: "input";
      sequence: number; // Sequential ID for tracking (e.g., uint16)
      timestamp: number; // Client timestamp
      actions: {
        movement: { x: number; y: number; z: number }; // Normalized vector
        jump: boolean;
        interactionTarget?: number; // Entity ID for interaction
      };
    }
    ```

2.  **State Updates** (Server → Client):
    ```typescript
    // Example Structure (actual format TBD, likely binary)
    interface ServerStateUpdate {
      type: "state_update";
      timestamp: number; // Server timestamp
      lastProcessedInputSequence: number; // For reconciliation
      entities: {
        [entityId: number]: { // Entity ID
          position?: { x: number; y: number; z: number };
          rotationY?: number; // Y-rotation only for players
          animationState?: number; // Animation state ID (e.g., uint8)
          flags?: number; // Bit flags for states (e.g., uint8)
          // Worm specific:
          controlPoints?: Array<[number, number, number]>;
          wormState?: number;
          wormTargetId?: number;
          // ... other component deltas
        };
      };
      removedEntityIds?: number[];
    }
    ```

3.  **Event Messages** (Server → Client):
    ```typescript
    // Example Structure (actual format TBD, likely binary)
    interface GameEvent {
      type: "event";
      eventType: string; // e.g., "explosion", "damage_dealt", "resource_collected"
      position?: { x: number; y: number; z: number };
      // ... other event specific data (radius, damage, amount, targetId, etc.)
    }
    ```

## Special Considerations for Game Elements

### Fluid Worm Movement Synchronization

Sandworms require special handling due to their size and importance:

-   Server controls core worm behavior (`server/src/core/ai/` or `entities/`).
-   Efficient curve-based representation for networking (8-12 control points).
-   Advanced procedural animation applied client-side (`client/src/entities/worm/`) based on received data.
-   Dynamic segment interpolation for smooth movement between updates.
-   Priority updates for worms near players (target 20 updates/second when nearby).
-   Predictable movement patterns for better client prediction.
-   Custom importance buffer to ensure worm updates are prioritized.

### Physics Synchronization

For physics interactions (`client/src/physics/`, `server/src/core/physics/`):

-   Server is authoritative for critical physics interactions.
-   Use simplified physics models focusing on gameplay relevance.
-   Client handles decorative physics locally.
-   Tolerance thresholds (e.g., 0.5m position, 0.1 rad rotation) to prevent jitter.
-   Special handling for fast-moving objects with position extrapolation.

### Resource Management

For spice collection and water management (`server/src/core/`):

-   Server validates all resource acquisition.
-   Immediate client-side feedback with clear "pending" state (if needed).
-   Rollback mechanisms for denied resource actions (handled via authoritative state updates).
-   Optimistic updates with server verification for responsive UI.

## Failure Handling & Recovery

### Disconnection Recovery

When players disconnect and reconnect:

-   Server preserves player state (in memory briefly, persisted in DB via `server/src/db/`) for a short period (e.g., 5 minutes).
-   Send complete state snapshot on reconnection.
-   Allow players to rejoin in-progress games/rooms (`server/src/rooms/`).
-   Grace period protection during reconnection.

### Anti-Cheat Measures

To ensure fair play (`server/src/core/`, `security/` helpers):

-   Validate player movement speed and physics constraints.
-   Monitor for impossible action sequences.
-   Rate limit actions.
-   Implement server authority for all meaningful game outcomes.

## Implementation Guide

### Step 1: Basic Movement Synchronization
-   Implement client input capture and prediction (`client/src/core/InputManager.ts`, `client/src/physics/`).
-   Create server validation of movement inputs (`server/src/core/`).
-   Develop basic reconciliation for position correction (`client/src/networking/`).
-   Test with artificial latency.

### Step 2: Entity Management
-   Create entity creation/deletion over network (`server/src/core/`, `client/src/game/`).
-   Implement component-based state updates (`server/src/networking/`, `client/src/networking/`).
-   Add interpolation for smooth movement (`client/src/entities/`).
-   Test with multiple entities.

### Step 3: Interest Management
-   Implement server-side visibility/relevance system (`server/src/core/`).
-   Create priority-based update system.
-   Add distance-based update frequency scaling.
-   Test with many entities.

### Step 4: Special Cases
-   Add worm-specific networking code (`server/src/networking/`, `client/src/networking/`).
-   Implement resource and interaction synchronization (`server/src/core/`, `client/src/game/`).
-   Create combat and damage validation (`server/src/core/`).
-   Test all special cases with multiple clients.

This architecture focuses on the core elements needed for a responsive multiplayer experience while reducing implementation complexity and network bandwidth.
