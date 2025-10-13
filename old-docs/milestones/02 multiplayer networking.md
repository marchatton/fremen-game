# Milestone 2: Multiplayer Networking Foundation

## Overview
Establish the core networking infrastructure that will enable multiplayer gameplay, focusing on connection management, state synchronization, and client-server architecture using Socket.io on Node.js runtime.

## Requirements

### 2.1 Server Setup (Node.js/Socket.io)
- Initialize Node.js project (`server/`), install Socket.io. Use TypeScript recommended.
- Configure Socket.io server, basic CORS (allow Vercel domain), heartbeat (`pingInterval`/`pingTimeout`). Listen on `$PORT` for Railway.
- Implement *simple* in-memory room management: map of `roomId` to `Set<socketId>`. Auto-assign players to a default room on connect. Limit room size (e.g., 8 players). *(Logic might live in `server/src/rooms/`)*.
- Implement *basic* JWT auth: Create a simple REST endpoint (e.g., `/auth` in `server/src/auth/`) that generates a JWT containing a unique `playerId` (UUID v4). Client fetches this once. Socket.io middleware validates token presence and basic structure on connection. Store `playerId` mapping to `socketId` server-side. Implement reconnection using the same token.
- Basic server loop (`setInterval` in `server/src/core/` or `server/src/index.ts`, target ~60Hz, ~16ms) logging tick count. This loop will later handle state broadcasting.
- Configure for Railway: Finalize `server/Dockerfile`, health check endpoint (`/health`). Implement basic console logging.

### 2.2 Client-Server Communication
- Client `NetworkManager` class (`client/src/networking/`): handles Socket.io connection (`io(serverUrl, { auth: { token } })`), stores `socket.id` and assigned `playerId`.
- Implement basic event handlers: `connect`, `disconnect`, `reconnect_attempt`, `connect_error`. Log these events clearly client-side. Provide user feedback on connection state changes.
- Define initial message protocol (document this clearly in e.g., `docs/network_protocol.md`):
    - `C_INPUT`: Client -> Server (carries player inputs - *deferred to M4*)
    - `S_WELCOME`: Server -> Client (sent on successful connection, carries assigned `playerId`, current server time, initial world state like list of other players {`playerId`, `position`, `rotation`})
    - `S_PLAYER_JOINED`: Server -> All Clients (broadcast {`playerId`, `position`, `rotation`})
    - `S_PLAYER_LEFT`: Server -> All Clients (broadcast {`playerId`})
    - `S_GAME_STATE`: Server -> All Clients (broadcasts array of {`playerId`, `position`, `rotation`} for all connected players)
- Add basic UI indicator for connection status (Connected/Connecting/Disconnected).
- Use JSON for messages initially.

### 2.3 Player Synchronization (Minimal)
- Client `PlayerManager` (`client/src/entities/` or `client/src/game/`): Stores local player state (`playerId`, `position`, `rotation`). Stores map of remote players (`playerId` -> { `mesh`, `targetPosition`, `targetRotation` }).
- On `S_WELCOME`, store own `playerId`, populate remote players based on initial state.
- On `S_PLAYER_JOINED`, add player representation (e.g., a colored cube) to the scene and remote map. On `S_PLAYER_LEFT`, remove player representation.
- Client: Send local player's intended `position` and `rotation` (just basic updates for now, simulating movement) in the game loop via a *new* `C_UPDATE_PLAYER_STATE` message ~10-20 times/sec.
- Server: On `C_UPDATE_PLAYER_STATE`, update the player's state in the server's map.
- Server: In the main server loop (e.g., ~20Hz), broadcast `S_GAME_STATE` containing the `position` and `rotation` of all players.
- Client: On `S_GAME_STATE`, update the `targetPosition` and `targetRotation` for remote players. In the client's render loop, smoothly interpolate the visual representation (`mesh.position.lerp()`, `mesh.quaternion.slerp()`) towards the target state. Apply interpolation to own player as well (server reconciliation placeholder).

### 2.4 Network Entity System (Placeholder)
- Define concept only: Server assigns unique `playerId`. This ID is the entity ID for players for now.

### 2.5 Network Debugging Tools (Basic)
- Implement simple console logging for all defined network messages (send/receive) on both client and server. Include timestamps.
- Add basic UI buttons to manually disconnect/reconnect client for testing.
- Add a basic UI toggle to show/hide simple debug text displaying own `playerId` and connection status.

## Deliverables
- Functioning Socket.io client-server architecture deployed on Railway.
- Basic player synchronization (position/rotation) between clients with interpolation.
- Basic JWT authentication placeholder.
- Connection management with reconnection attempt logic.
- Minimal network debugging tools (logging, UI buttons).
- Initial Railway deployment configuration finalized.
- DrizzleORM connection setup (table creation deferred to M8).

## Testing and Validation
- Server must handle at least 8 simultaneous players connecting/disconnecting.
- Clients see synchronized cubes moving smoothly via interpolation.
- Reconnection attempts work after manual disconnect.
- Basic JWT validation prevents connection without a token.
- Server logs show connections and state updates.