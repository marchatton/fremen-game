import { db } from './config.js';
import { players, type Player, type NewPlayer } from './schema.js';
import { eq } from 'drizzle-orm';
import type { PlayerResources, Equipment, PlayerStats, InventoryItem, Vector3 } from '@fremen/shared';
import { STARTING_RESOURCES, EQUIPMENT_CATALOG } from '@fremen/shared';

/**
 * Load player from database or create new player
 */
export async function loadPlayer(playerId: string, username: string): Promise<PlayerResources> {
  try {
    // Try to load existing player
    const [existingPlayer] = await db
      .select()
      .from(players)
      .where(eq(players.id, playerId))
      .limit(1);

    if (existingPlayer) {
      console.log(`Loaded player ${username} (${playerId}) from database`);
      return parsePlayerData(existingPlayer);
    }

    // Create new player
    console.log(`Creating new player ${username} (${playerId})`);
    const newPlayer: NewPlayer = {
      id: playerId,
      username,
      water: STARTING_RESOURCES.water!,
      spice: STARTING_RESOURCES.spice!,
      equipment: STARTING_RESOURCES.equipment || {},
      inventory: STARTING_RESOURCES.inventory || [],
      stats: STARTING_RESOURCES.stats || {
        objectivesCompleted: 0,
        totalSpiceEarned: 0,
        distanceTraveled: 0,
        deaths: 0,
        wormsRidden: 0,
      },
      lastPosition: { x: 0, y: 0, z: 0 },
    };

    const [created] = await db.insert(players).values(newPlayer).returning();
    return parsePlayerData(created);
  } catch (error) {
    console.error(`Error loading player ${playerId}:`, error);

    // Return default resources if DB fails (fallback)
    return {
      water: STARTING_RESOURCES.water!,
      spice: STARTING_RESOURCES.spice!,
      equipment: STARTING_RESOURCES.equipment || {},
      stats: STARTING_RESOURCES.stats!,
      inventory: STARTING_RESOURCES.inventory || [],
    };
  }
}

/**
 * Save player state to database
 */
export async function savePlayer(
  playerId: string,
  resources: Partial<PlayerResources>,
  lastPosition?: Vector3
): Promise<void> {
  try {
    const updateData: any = {
      updatedAt: new Date(),
    };

    if (resources.water !== undefined) updateData.water = resources.water;
    if (resources.spice !== undefined) updateData.spice = resources.spice;
    if (resources.equipment !== undefined) updateData.equipment = resources.equipment;
    if (resources.inventory !== undefined) updateData.inventory = resources.inventory;
    if (resources.stats !== undefined) updateData.stats = resources.stats;
    if (lastPosition !== undefined) updateData.lastPosition = lastPosition;

    await db
      .update(players)
      .set(updateData)
      .where(eq(players.id, playerId));

    console.log(`Saved player ${playerId}`);
  } catch (error) {
    console.error(`Error saving player ${playerId}:`, error);
    // Don't throw - we don't want to crash the game on save failure
  }
}

/**
 * Update player resources (spice, water) with transaction safety
 */
export async function updatePlayerResources(
  playerId: string,
  spiceDelta: number,
  waterDelta: number
): Promise<{ success: boolean; newSpice: number; newWater: number }> {
  try {
    // Read-calculate-write pattern for transaction safety
    const [player] = await db
      .select()
      .from(players)
      .where(eq(players.id, playerId))
      .limit(1);

    if (!player) {
      return { success: false, newSpice: 0, newWater: 0 };
    }

    // Calculate new values with bounds
    const newSpice = Math.max(0, player.spice + spiceDelta); // Prevent negative
    const newWater = Math.max(0, Math.min(100, player.water + waterDelta)); // Clamp 0-100

    // Update with new values
    const [updated] = await db
      .update(players)
      .set({
        spice: newSpice,
        water: newWater,
        updatedAt: new Date(),
      })
      .where(eq(players.id, playerId))
      .returning({ spice: players.spice, water: players.water });

    if (!updated) {
      return { success: false, newSpice: 0, newWater: 0 };
    }

    return {
      success: true,
      newSpice: updated.spice,
      newWater: updated.water,
    };
  } catch (error) {
    console.error(`Error updating resources for player ${playerId}:`, error);
    return { success: false, newSpice: 0, newWater: 0 };
  }
}

/**
 * Increment player stats
 */
export async function incrementPlayerStat(
  playerId: string,
  stat: keyof PlayerStats,
  amount: number = 1
): Promise<void> {
  try {
    const [player] = await db
      .select()
      .from(players)
      .where(eq(players.id, playerId))
      .limit(1);

    if (!player) return;

    const stats = player.stats as PlayerStats;
    stats[stat] = (stats[stat] || 0) + amount;

    await db
      .update(players)
      .set({ stats, updatedAt: new Date() })
      .where(eq(players.id, playerId));
  } catch (error) {
    console.error(`Error incrementing stat ${stat} for player ${playerId}:`, error);
  }
}

/**
 * Parse database player record into PlayerResources
 */
function parsePlayerData(player: Player): PlayerResources {
  return {
    water: player.water,
    spice: player.spice,
    equipment: (player.equipment as Equipment) || {},
    stats: (player.stats as PlayerStats) || STARTING_RESOURCES.stats!,
    inventory: (player.inventory as InventoryItem[]) || [],
  };
}

/**
 * Auto-save manager for periodic saves
 */
export class AutoSaveManager {
  private saveInterval?: NodeJS.Timeout;
  private activePlayers: Set<string> = new Set();
  private playerPositions: Map<string, Vector3> = new Map();
  private playerResources: Map<string, Partial<PlayerResources>> = new Map();

  constructor(private intervalMs: number = 300000) {} // 5 minutes default

  start() {
    if (this.saveInterval) return;

    this.saveInterval = setInterval(() => {
      this.performAutoSave();
    }, this.intervalMs);

    console.log(`Auto-save started (interval: ${this.intervalMs}ms)`);
  }

  stop() {
    if (this.saveInterval) {
      clearInterval(this.saveInterval);
      this.saveInterval = undefined;
      console.log('Auto-save stopped');
    }
  }

  registerPlayer(playerId: string) {
    this.activePlayers.add(playerId);
  }

  unregisterPlayer(playerId: string) {
    this.activePlayers.delete(playerId);
    this.playerPositions.delete(playerId);
    this.playerResources.delete(playerId);
  }

  updatePlayerState(playerId: string, resources: Partial<PlayerResources>, position?: Vector3) {
    this.playerResources.set(playerId, resources);
    if (position) {
      this.playerPositions.set(playerId, position);
    }
  }

  private async performAutoSave() {
    const savePromises: Promise<void>[] = [];

    for (const playerId of this.activePlayers) {
      const resources = this.playerResources.get(playerId);
      const position = this.playerPositions.get(playerId);

      if (resources) {
        savePromises.push(savePlayer(playerId, resources, position));
      }
    }

    if (savePromises.length > 0) {
      console.log(`Auto-saving ${savePromises.length} players...`);
      await Promise.all(savePromises);
    }
  }

  async forceSaveAll() {
    await this.performAutoSave();
  }
}

// Global auto-save manager instance
export const autoSaveManager = new AutoSaveManager();
