import type { Socket } from 'socket.io';
import type { PlayerState } from '@fremen/shared';
import { GAME_CONSTANTS } from '@fremen/shared';

export interface RoomPlayer {
  socket: Socket;
  playerId: string;
  username: string;
  state: PlayerState;
  lastInputSeq: number;
  connectedAt: number;
}

export class Room {
  private players: Map<string, RoomPlayer> = new Map();
  private disconnectedPlayers: Map<string, { state: PlayerState; disconnectedAt: number }> = new Map();
  public roomId: string;

  constructor(roomId: string) {
    this.roomId = roomId;
  }

  addPlayer(socket: Socket, playerId: string, username: string): boolean {
    if (this.players.size >= GAME_CONSTANTS.MAX_PLAYERS) {
      return false;
    }

    const existingDisconnected = this.disconnectedPlayers.get(playerId);
    const initialState: PlayerState = existingDisconnected
      ? existingDisconnected.state
      : {
          id: playerId,
          position: { x: 0, y: 1, z: 0 },
          rotation: 0,
          velocity: { x: 0, y: 0, z: 0 },
        };

    this.players.set(playerId, {
      socket,
      playerId,
      username,
      state: initialState,
      lastInputSeq: 0,
      connectedAt: Date.now(),
    });

    this.disconnectedPlayers.delete(playerId);
    console.log(`Player ${username} (${playerId}) joined room ${this.roomId}`);
    return true;
  }

  removePlayer(playerId: string) {
    const player = this.players.get(playerId);
    if (player) {
      this.disconnectedPlayers.set(playerId, {
        state: player.state,
        disconnectedAt: Date.now(),
      });
      this.players.delete(playerId);
      console.log(`Player ${player.username} (${playerId}) left room ${this.roomId}`);
    }
  }

  getPlayer(playerId: string): RoomPlayer | undefined {
    return this.players.get(playerId);
  }

  getAllPlayers(): RoomPlayer[] {
    return Array.from(this.players.values());
  }

  getPlayerCount(): number {
    return this.players.size;
  }

  updatePlayerState(playerId: string, state: Partial<PlayerState>) {
    const player = this.players.get(playerId);
    if (player) {
      player.state = { ...player.state, ...state };
    }
  }

  cleanupDisconnectedPlayers() {
    const now = Date.now();
    const timeout = 5 * 60 * 1000;
    
    for (const [playerId, data] of this.disconnectedPlayers) {
      if (now - data.disconnectedAt > timeout) {
        this.disconnectedPlayers.delete(playerId);
        console.log(`Cleaned up disconnected player ${playerId}`);
      }
    }
  }
}
