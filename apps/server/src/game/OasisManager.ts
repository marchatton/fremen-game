import { Oasis, ECONOMY_CONSTANTS } from '@fremen/shared';
import type { Vector3 } from '@fremen/shared';

interface RefillResult {
  success: boolean;
  newWater: number;
  message?: string;
}

/**
 * VS3: Oasis System
 *
 * Manages fixed oasis locations for water refill,
 * per-player per-oasis cooldown system.
 */
export class OasisManager {
  private oases: Map<string, Oasis> = new Map();

  // Fixed oasis locations (world coordinates)
  private readonly OASIS_LOCATIONS: Array<{ x: number; z: number; radius: number }> = [
    { x: 200, z: 200, radius: 15 },
    { x: -200, z: 200, radius: 12 },
    { x: 200, z: -200, radius: 10 },
    { x: -200, z: -200, radius: 15 },
  ];

  /**
   * Generate fixed oases at predetermined locations
   */
  generateOases(): Oasis[] {
    this.oases.clear();

    const oases: Oasis[] = [];

    this.OASIS_LOCATIONS.forEach((location, index) => {
      const oasis: Oasis = {
        id: `oasis-${index}`,
        position: { x: location.x, y: 0, z: location.z },
        radius: location.radius,
        refillAmount: ECONOMY_CONSTANTS.OASIS_REFILL_AMOUNT,
        cooldownDuration: ECONOMY_CONSTANTS.OASIS_COOLDOWN,
        activeCooldowns: {},
      };

      oases.push(oasis);
      this.oases.set(oasis.id, oasis);
    });

    console.log(`Generated ${oases.length} oases at fixed locations`);

    return oases;
  }

  /**
   * Refill player's water at an oasis
   * Returns new water level if successful
   */
  refillWater(
    playerId: string,
    oasisId: string,
    currentWater: number,
    playerPosition: Vector3
  ): RefillResult {
    const oasis = this.oases.get(oasisId);

    // Validation
    if (!oasis) {
      console.warn(`Cannot refill: Oasis ${oasisId} not found`);
      return { success: false, newWater: currentWater, message: 'Oasis not found' };
    }

    // Check distance
    const distance = Math.sqrt(
      Math.pow(playerPosition.x - oasis.position.x, 2) +
      Math.pow(playerPosition.z - oasis.position.z, 2)
    );

    if (distance > oasis.radius) {
      console.warn(`Cannot refill: Player too far from oasis (${distance.toFixed(1)}m > ${oasis.radius}m)`);
      return { success: false, newWater: currentWater, message: 'Too far from oasis' };
    }

    // Check cooldown
    if (this.checkCooldown(playerId, oasisId)) {
      const remaining = this.getCooldownRemaining(playerId, oasisId);
      console.warn(`Cannot refill: Player ${playerId} on cooldown at ${oasisId} (${Math.ceil(remaining / 1000)}s remaining)`);
      return { success: false, newWater: currentWater, message: 'Oasis on cooldown' };
    }

    // Calculate new water (clamp to 0-100)
    const newWater = Math.min(100, Math.max(0, currentWater + oasis.refillAmount));

    // Set cooldown
    this.setCooldown(playerId, oasisId);

    console.log(`Player ${playerId} refilled water at ${oasisId}: ${currentWater} → ${newWater}`);

    return { success: true, newWater };
  }

  /**
   * Check if player has active cooldown at oasis
   */
  checkCooldown(playerId: string, oasisId: string): boolean {
    const oasis = this.oases.get(oasisId);
    if (!oasis) return false;

    const cooldownEnd = oasis.activeCooldowns[playerId];
    if (!cooldownEnd) return false;

    const now = Date.now();
    return now < cooldownEnd;
  }

  /**
   * Get remaining cooldown time in milliseconds
   * Returns 0 if no cooldown active
   */
  getCooldownRemaining(playerId: string, oasisId: string): number {
    const oasis = this.oases.get(oasisId);
    if (!oasis) return 0;

    const cooldownEnd = oasis.activeCooldowns[playerId];
    if (!cooldownEnd) return 0;

    const now = Date.now();
    const remaining = cooldownEnd - now;

    return Math.max(0, remaining);
  }

  /**
   * Set cooldown for player at oasis
   */
  private setCooldown(playerId: string, oasisId: string): void {
    const oasis = this.oases.get(oasisId);
    if (!oasis) return;

    const now = Date.now();
    const cooldownEnd = now + oasis.cooldownDuration;

    oasis.activeCooldowns[playerId] = cooldownEnd;
  }

  /**
   * Clean up expired cooldowns (call periodically to prevent memory bloat)
   */
  cleanupExpiredCooldowns(): void {
    const now = Date.now();

    for (const oasis of this.oases.values()) {
      const playerIds = Object.keys(oasis.activeCooldowns);

      for (const playerId of playerIds) {
        const cooldownEnd = oasis.activeCooldowns[playerId];

        if (now >= cooldownEnd) {
          delete oasis.activeCooldowns[playerId];
        }
      }
    }
  }

  /**
   * Get all oases
   */
  getOases(): Oasis[] {
    return Array.from(this.oases.values());
  }

  /**
   * Get specific oasis by ID
   */
  getOasis(oasisId: string): Oasis | undefined {
    return this.oases.get(oasisId);
  }

  /**
   * Get nearest oasis to a position
   */
  getNearestOasis(position: Vector3): Oasis | undefined {
    let nearest: Oasis | undefined;
    let minDistance = Infinity;

    for (const oasis of this.oases.values()) {
      const dx = oasis.position.x - position.x;
      const dz = oasis.position.z - position.z;
      const distance = Math.sqrt(dx * dx + dz * dz);

      if (distance < minDistance) {
        minDistance = distance;
        nearest = oasis;
      }
    }

    return nearest;
  }

  /**
   * Get oases within range of a position
   */
  getOasesWithinRange(position: Vector3, range: number): Oasis[] {
    const oases: Oasis[] = [];

    for (const oasis of this.oases.values()) {
      const dx = oasis.position.x - position.x;
      const dz = oasis.position.z - position.z;
      const distance = Math.sqrt(dx * dx + dz * dz);

      if (distance <= range) {
        oases.push(oasis);
      }
    }

    return oases;
  }

  /**
   * Check if player can refill at any nearby oasis
   */
  getAvailableNearbyOasis(playerId: string, position: Vector3, searchRadius: number): Oasis | undefined {
    const nearbyOases = this.getOasesWithinRange(position, searchRadius);

    for (const oasis of nearbyOases) {
      // Check if within oasis radius
      const dx = oasis.position.x - position.x;
      const dz = oasis.position.z - position.z;
      const distance = Math.sqrt(dx * dx + dz * dz);

      if (distance <= oasis.radius && !this.checkCooldown(playerId, oasis.id)) {
        return oasis;
      }
    }

    return undefined;
  }
}
