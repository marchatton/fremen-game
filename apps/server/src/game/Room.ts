import type { Socket } from 'socket.io';
import type { PlayerState, ThumperState } from '@fremen/shared';
import { GAME_CONSTANTS, PlayerStateEnum } from '@fremen/shared';
import { v4 as uuidv4 } from 'uuid';

export interface RoomPlayer {
  socket: Socket;
  playerId: string;
  username: string;
  state: PlayerState;
  lastInputSeq: number;
  connectedAt: number;
  thumperCount: number;
}

export class Room {
  private players: Map<string, RoomPlayer> = new Map();
  private disconnectedPlayers: Map<string, { state: PlayerState; disconnectedAt: number }> = new Map();
  private thumpers: Map<string, ThumperState> = new Map();
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
          state: PlayerStateEnum.ACTIVE,
        };

    this.players.set(playerId, {
      socket,
      playerId,
      username,
      state: initialState,
      lastInputSeq: 0,
      connectedAt: Date.now(),
      thumperCount: 3,
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

  deployThumper(playerId: string): boolean {
    const player = this.players.get(playerId);
    if (!player || player.thumperCount <= 0) {
      return false;
    }

    const thumperId = uuidv4();
    const thumper: ThumperState = {
      id: thumperId,
      position: { ...player.state.position },
      active: true,
      expiresAt: Date.now() + GAME_CONSTANTS.THUMPER_DURATION,
    };

    this.thumpers.set(thumperId, thumper);
    player.thumperCount--;
    
    console.log(`Player ${player.username} deployed thumper ${thumperId} at`, thumper.position);
    return true;
  }

  updateThumpers() {
    const now = Date.now();
    
    for (const [id, thumper] of this.thumpers) {
      if (now >= thumper.expiresAt) {
        this.thumpers.delete(id);
        console.log(`Thumper ${id} expired`);
      }
    }
  }

  getThumpers(): ThumperState[] {
    return Array.from(this.thumpers.values());
  }

  getActiveThumpers(): ThumperState[] {
    return Array.from(this.thumpers.values()).filter(t => t.active);
  }
}
