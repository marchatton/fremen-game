# Milestone 9: Player Interaction and Communication

## Overview
Implement foundational systems for players to communicate and coordinate: text chat, basic voice chat hooks, emotes, and a world ping system.

## Requirements

### 9.1 Text Chat System
- Channels: Implement server logic and client UI for Global, Team (based on server-assigned team ID), and Proximity (e.g., 30m radius check server-side) channels. Client sends `C_SEND_CHAT { channel, message }`. Server validates message length/rate, determines recipients based on channel/player positions, and broadcasts `S_RECEIVE_CHAT { senderId, senderName, channel, message }`.
- UI: Simple chat box UI (HTML overlay recommended, logic in `client/src/components/chat/`). Display messages with sender name/channel indication. Basic scrollback (e.g., last 50 messages). Use Dune UI guidelines (M15).
- Security: Implement basic server-side rate limiting (e.g., max 1 message per 2 seconds per player). Basic profanity filter (simple keyword list) optional for now.
- Network: Send messages as simple JSON. Consider basic batching if >5 messages/sec needed server-wide.

### 9.2 Voice Communication (Framework & Proximity)
- Integration: Research and choose a WebRTC library suitable for peer-to-peer or SFU approach. Set up basic client-side microphone access (`getUserMedia`).
- Proximity Logic: Server tracks player positions. Client sends `C_REQUEST_VOICE_PEERS`. Server responds `S_VOICE_PEERS { nearbyPlayerIds[] }`. Client attempts direct WebRTC P2P connections with nearby peers for voice streaming.
- UI: Simple icons indicating who is currently speaking. Basic mute toggle for own mic.

### 9.3 Player Emotes and Gestures (Basic Set)
- Selection: Implement simple keybinds (e.g., numpad keys) to trigger 3-5 basic emotes (Wave, Point, Yes, No).
- Animation: Use existing character animation system (M4). Trigger corresponding animation state on local character immediately.
- Networking: Client sends `C_PLAY_EMOTE { emoteId }` (use simple enum/byte). Server broadcasts `S_PLAYER_EMOTED { playerId, emoteId }` to nearby players. Clients receiving this trigger the animation on the remote character model.

### 9.4 Ping and Marker System (World Ping Only)
- Input: Keybind (e.g., middle mouse click) triggers ping. Client performs raycast against terrain/objects. Send `C_PLACE_PING { position }` to server.
- Logic: Server validates position, stores ping {`id`, `ownerId`, `position`, `creationTime`}. Broadcast `S_PING_PLACED { id, ownerId, position }` to teammates within visibility range (e.g., 200m). Server removes ping after timeout (e.g., 10s). Broadcast `S_PING_REMOVED { id }`.
- Visuals: Client renders simple visual effect (e.g., pulsing marker + sound effect) at ping location based on `S_PING_PLACED` / `S_PING_REMOVED`. Use Dune UI style.

### 9.5 Cooperative Interactions (Minimal Assist)
- Water Sharing Placeholder: Implement interaction (`C_INTERACT_PLAYER { targetPlayerId }`) when aiming at another player nearby. Server validates, checks if target player water < 50% and interacting player water > 25%. If so, transfer small amount (e.g., 10 units), update states, send notification `S_RESOURCE_TRANSFER { fromId, toId, resource, amount }`.

## Deliverables
- Basic text chat system (Global, Team, Proximity).
- Basic proximity voice chat framework (WebRTC P2P or SFU setup).
- 3-5 basic emotes synchronized over network.
- World ping system visible to nearby teammates.
- Basic player-to-player water sharing interaction.
- Server-side validation for chat rate limits.

## Testing and Validation
- Players can send/receive text messages in global/proximity channels.
- Basic proximity voice chat establishes connection (verify via logs/speaking indicators).
- Players can trigger basic emotes visible to others nearby.
- Players can place world pings visible to nearby teammates.
- Basic water sharing interaction functions.
- Chat rate limiting prevents spam.
