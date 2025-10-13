# Network Protocol Documentation

## Overview
This document outlines the network protocol used for client-server communication in the game. The protocol uses Socket.io for WebSocket communication with JSON message format.

## Authentication
1. Client requests a token via POST to `/auth/token`
2. Server generates a JWT containing a unique `playerId`
3. Client includes token in Socket.io connection options: `{ auth: { token } }`
4. Server validates token via middleware before allowing connection

## Message Types

### Client to Server (C_*)

#### C_UPDATE_PLAYER_STATE
Sent by client to update their position and rotation.
```typescript
{
  position: {
    x: number,
    y: number,
    z: number
  },
  rotation: {
    x: number,
    y: number,
    z: number
  }
}
```

### Server to Client (S_*)

#### S_WELCOME
Sent to client on successful connection.
```typescript
{
  playerId: string,
  serverTime: number,
  players: Array<{
    playerId: string,
    position: Vector3,
    rotation: Vector3
  }>
}
```

#### S_PLAYER_JOINED
Broadcast to all clients when a new player joins.
```typescript
{
  playerId: string,
  position: Vector3,
  rotation: Vector3
}
```

#### S_PLAYER_LEFT
Broadcast to all clients when a player leaves.
```typescript
{
  playerId: string
}
```

#### S_GAME_STATE
Broadcast to all clients containing current state of all players.
```typescript
{
  players: Array<{
    playerId: string,
    position: Vector3,
    rotation: Vector3
  }>
}
```

## Update Rates
- Client sends position updates: ~10-20 Hz
- Server broadcasts game state: ~20 Hz
- Server heartbeat: 10s interval, 5s timeout

## Room Management
- Players are automatically assigned to a default room
- Maximum room size: 8 players
- Players can't join when room is full

## Error Handling
- Invalid/missing token: Connection rejected with error message
- Room full: Connection rejected with "Room is full" message
- Connection errors: Client receives error event with message

## Reconnection
- Client can reconnect using the same token
- Server maintains player state during brief disconnections
- Client receives S_WELCOME with current game state on reconnection 