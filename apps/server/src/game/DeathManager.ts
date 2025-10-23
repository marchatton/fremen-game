import type { Vector3, PlayerStats } from '@fremen/shared';

interface CorpseMarker {
  id: string;
  playerId: string;
  position: Vector3;
  spiceAmount: number;
  createdAt: number;
  expiresAt: number;
}

interface RecoveryResult {
  success: boolean;
  spiceRecovered?: number;
  error?: string;
}

interface RespawnData {
  position: Vector3;
  water: number;
  health: number;
}

interface DeathResult {
  corpseId: string;
  spiceLost: number;
  spiceRemaining: number;
  respawnPosition: Vector3;
  respawnWater: number;
  respawnHealth: number;
  newStats: PlayerStats;
}

/**
 * VS3: Death & Respawn System
 *
 * Manages death detection, spice penalties, corpse markers,
 * corpse expiration, recovery, and respawn mechanics.
 */
export class DeathManager {
  private corpses: Map<string, CorpseMarker> = new Map();
  private expirationTimers: Map<string, NodeJS.Timeout> = new Map();

  // Constants
  private readonly SPICE_PENALTY_PERCENT = 0.2; // 20% penalty
  private readonly CORPSE_DURATION_MS = 2 * 60 * 1000; // 2 minutes
  private readonly RECOVERY_DISTANCE = 5; // 5m
  private readonly SIETCH_POSITION: Vector3 = { x: 0, y: 0, z: 0 };
  private readonly RESPAWN_WATER = 50;
  private readonly RESPAWN_HEALTH = 100;

  /**
   * Check if player is dead based on water level
   */
  checkDeath(water: number): boolean {
    return water <= 0;
  }

  /**
   * Calculate spice penalty (20% of current spice, floored)
   */
  calculateSpicePenalty(spice: number): number {
    return Math.floor(spice * this.SPICE_PENALTY_PERCENT);
  }

  /**
   * Create corpse marker at death location
   */
  createCorpseMarker(playerId: string, position: Vector3, spiceDrop: number): string {
    const corpseId = `corpse-${playerId}-${Date.now()}-${Math.random()}`;
    const now = Date.now();

    const corpse: CorpseMarker = {
      id: corpseId,
      playerId,
      position: { ...position },
      spiceAmount: spiceDrop,
      createdAt: now,
      expiresAt: now + this.CORPSE_DURATION_MS,
    };

    this.corpses.set(corpseId, corpse);

    // Set up expiration timer
    const timer = setTimeout(() => {
      this.removeCorpse(corpseId);
    }, this.CORPSE_DURATION_MS);

    this.expirationTimers.set(corpseId, timer);

    console.log(`Corpse marker created: ${corpseId} with ${spiceDrop} spice`);

    return corpseId;
  }

  /**
   * Get corpse marker by ID
   */
  getCorpseMarker(corpseId: string): CorpseMarker | undefined {
    const corpse = this.corpses.get(corpseId);

    // Check if expired
    if (corpse && Date.now() >= corpse.expiresAt) {
      this.removeCorpse(corpseId);
      return undefined;
    }

    return corpse;
  }

  /**
   * Recover corpse and retrieve spice
   */
  recoverCorpse(
    playerId: string,
    corpseId: string,
    playerPosition: Vector3
  ): RecoveryResult {
    const corpse = this.getCorpseMarker(corpseId);

    // Check if corpse exists
    if (!corpse) {
      return {
        success: false,
        error: 'Corpse not found or expired',
      };
    }

    // Check ownership
    if (corpse.playerId !== playerId) {
      return {
        success: false,
        error: 'This is not your corpse',
      };
    }

    // Check distance
    const distance = this.calculateDistance(playerPosition, corpse.position);
    if (distance > this.RECOVERY_DISTANCE) {
      return {
        success: false,
        error: `too far from corpse (${distance.toFixed(1)}m > ${this.RECOVERY_DISTANCE}m)`,
      };
    }

    // Recover spice
    const spiceRecovered = corpse.spiceAmount;

    // Remove corpse
    this.removeCorpse(corpseId);

    console.log(`Player ${playerId} recovered corpse ${corpseId}: +${spiceRecovered} spice`);

    return {
      success: true,
      spiceRecovered,
    };
  }

  /**
   * Get respawn data
   */
  getRespawnData(): RespawnData {
    return {
      position: { ...this.SIETCH_POSITION },
      water: this.RESPAWN_WATER,
      health: this.RESPAWN_HEALTH,
    };
  }

  /**
   * Process complete death sequence
   */
  processDeath(
    playerId: string,
    deathPosition: Vector3,
    spice: number,
    stats: PlayerStats
  ): DeathResult {
    // Calculate penalty
    const spiceLost = this.calculateSpicePenalty(spice);
    const spiceRemaining = spice - spiceLost;

    // Create corpse marker
    const corpseId = this.createCorpseMarker(playerId, deathPosition, spiceLost);

    // Update stats
    const newStats: PlayerStats = {
      ...stats,
      deaths: stats.deaths + 1,
    };

    // Get respawn data
    const respawnData = this.getRespawnData();

    console.log(
      `Player ${playerId} died at (${deathPosition.x}, ${deathPosition.z}). Lost ${spiceLost} spice. Respawning at Sietch.`
    );

    return {
      corpseId,
      spiceLost,
      spiceRemaining,
      respawnPosition: respawnData.position,
      respawnWater: respawnData.water,
      respawnHealth: respawnData.health,
      newStats,
    };
  }

  /**
   * Get all active (non-expired) corpses
   */
  getAllActiveCorpses(): CorpseMarker[] {
    const now = Date.now();
    const activeCorpses: CorpseMarker[] = [];

    for (const [corpseId, corpse] of this.corpses.entries()) {
      if (now < corpse.expiresAt) {
        activeCorpses.push(corpse);
      } else {
        // Clean up expired
        this.removeCorpse(corpseId);
      }
    }

    return activeCorpses;
  }

  /**
   * Get all corpses for a specific player
   */
  getPlayerCorpses(playerId: string): CorpseMarker[] {
    return this.getAllActiveCorpses().filter(corpse => corpse.playerId === playerId);
  }

  /**
   * Calculate distance between two positions
   */
  private calculateDistance(pos1: Vector3, pos2: Vector3): number {
    const dx = pos1.x - pos2.x;
    const dz = pos1.z - pos2.z;
    return Math.sqrt(dx * dx + dz * dz);
  }

  /**
   * Remove corpse and clear timer
   */
  private removeCorpse(corpseId: string): void {
    this.corpses.delete(corpseId);

    const timer = this.expirationTimers.get(corpseId);
    if (timer) {
      clearTimeout(timer);
      this.expirationTimers.delete(corpseId);
    }
  }
}
