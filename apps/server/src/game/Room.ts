import type { Socket } from 'socket.io';
import type { PlayerState, ThumperState, PlayerResources, LootDrop } from '@fremen/shared';
import { GAME_CONSTANTS, PlayerStateEnum, STARTING_RESOURCES } from '@fremen/shared';
import { v4 as uuidv4 } from 'uuid';

export interface RoomPlayer {
  socket: Socket;
  playerId: string;
  username: string;
  state: PlayerState;
  resources: PlayerResources;
  health: number;
  lastInputSeq: number;
  connectedAt: number;
  thumperCount: number;
  lastFireTime: number; // VS4: Track shooting cooldown
}

export class Room {
  private players: Map<string, RoomPlayer> = new Map();
  private disconnectedPlayers: Map<string, { state: PlayerState; disconnectedAt: number }> = new Map();
  private thumpers: Map<string, ThumperState> = new Map();
  private lootDrops: Map<string, LootDrop> = new Map(); // VS4: Loot drops
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
      resources: {
        water: STARTING_RESOURCES.water!,
        spice: STARTING_RESOURCES.spice!,
        equipment: STARTING_RESOURCES.equipment!,
        stats: { ...STARTING_RESOURCES.stats! },
        inventory: STARTING_RESOURCES.inventory ? [...STARTING_RESOURCES.inventory] : [],
      },
      health: 100,
      lastInputSeq: 0,
      connectedAt: Date.now(),
      thumperCount: 3,
      lastFireTime: 0,
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
      health: 100, // VS4: Thumper starts with full health
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

  /**
   * VS4: Damage a thumper
   * Returns true if thumper was damaged, false if thumper doesn't exist
   */
  damageThumper(thumperId: string, damage: number): boolean {
    const thumper = this.thumpers.get(thumperId);
    if (!thumper) {
      return false;
    }

    thumper.health -= damage;

    if (thumper.health <= 0) {
      thumper.health = 0;
      thumper.active = false;
      console.log(`Thumper ${thumperId} destroyed`);
    }

    return true;
  }

  /**
   * VS4: Get a specific thumper
   */
  getThumper(thumperId: string): ThumperState | undefined {
    return this.thumpers.get(thumperId);
  }

  /**
   * VS4: Spawn loot drop at position
   */
  spawnLoot(position: { x: number; y: number; z: number }, spice: number): LootDrop {
    const lootId = uuidv4();
    const loot: LootDrop = {
      id: lootId,
      position: { ...position },
      spice,
      expiresAt: Date.now() + 60000, // 60 seconds
    };

    this.lootDrops.set(lootId, loot);
    console.log(`Loot spawned at (${position.x.toFixed(0)}, ${position.z.toFixed(0)}): ${spice} spice`);
    return loot;
  }

  /**
   * VS4: Collect loot drop
   */
  collectLoot(lootId: string, playerId: string): number {
    const loot = this.lootDrops.get(lootId);
    if (!loot) {
      return 0;
    }

    const player = this.players.get(playerId);
    if (!player) {
      return 0;
    }

    // Add spice to player
    player.resources.spice += loot.spice;

    // Remove loot
    this.lootDrops.delete(lootId);
    console.log(`Player ${player.username} collected ${loot.spice} spice from loot`);

    return loot.spice;
  }

  /**
   * VS4: Update loot drops (remove expired)
   */
  updateLoot() {
    const now = Date.now();
    const expired: string[] = [];

    for (const [id, loot] of this.lootDrops) {
      if (now >= loot.expiresAt) {
        expired.push(id);
      }
    }

    for (const id of expired) {
      this.lootDrops.delete(id);
      console.log(`Loot ${id} expired`);
    }
  }

  /**
   * VS4: Get all loot drops
   */
  getLootDrops(): LootDrop[] {
    return Array.from(this.lootDrops.values());
  }

  /**
   * VS4: Get loot drop by ID
   */
  getLootDrop(lootId: string): LootDrop | undefined {
    return this.lootDrops.get(lootId);
  }
}
