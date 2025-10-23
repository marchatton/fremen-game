import { ThirstLevel, WATER_DEPLETION_RATES, THIRST_EFFECTS, ThirstEffect } from '@fremen/shared';
import type { PlayerState } from '@fremen/shared';
import { PlayerStateEnum } from '@fremen/shared';

type ActivityType = 'IDLE' | 'WALKING' | 'RUNNING' | 'RIDING_WORM';

/**
 * VS3: Water Survival System
 *
 * Manages water depletion based on player activity, thirst effects,
 * and death by dehydration.
 */
export class WaterSystem {
  // Speed thresholds for activity detection (m/s)
  private readonly IDLE_THRESHOLD = 0.5;
  private readonly WALK_THRESHOLD = 6.0;

  /**
   * Calculate water depletion based on player activity
   *
   * @param currentWater - Current water level (0-100)
   * @param player - Player state
   * @param deltaTime - Time elapsed in seconds
   * @param stillsuitReduction - Water reduction percentage from stillsuit (0-1)
   * @returns New water level clamped to 0-100
   */
  calculateWaterDepletion(
    currentWater: number,
    player: PlayerState,
    deltaTime: number,
    stillsuitReduction: number = 0
  ): number {
    // Dead players don't lose water
    if (player.state === PlayerStateEnum.DEAD) {
      return currentWater;
    }

    // Handle edge cases
    if (deltaTime <= 0) {
      return Math.min(100, Math.max(0, currentWater));
    }

    // Detect player activity
    const activity = this.detectActivity(player);

    // Get base depletion rate (per minute)
    const baseRate = this.getDepletionRate(activity);

    // Apply stillsuit reduction
    const effectiveRate = baseRate * (1 - Math.min(1, Math.max(0, stillsuitReduction)));

    // Calculate depletion for this time period
    // deltaTime is in seconds, rate is per minute
    const depletionAmount = effectiveRate * (deltaTime / 60);

    // Apply depletion and clamp to bounds
    const newWater = currentWater - depletionAmount;

    return Math.min(100, Math.max(0, newWater));
  }

  /**
   * Detect player activity based on state and velocity
   */
  detectActivity(player: PlayerState): ActivityType {
    // Priority 1: Check if riding worm
    if (player.state === PlayerStateEnum.RIDING) {
      return 'RIDING_WORM';
    }

    // Priority 2: Check velocity
    const velocity = player.velocity;
    const speed = Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z);

    if (speed < this.IDLE_THRESHOLD) {
      return 'IDLE';
    } else if (speed < this.WALK_THRESHOLD) {
      return 'WALKING';
    } else {
      return 'RUNNING';
    }
  }

  /**
   * Get depletion rate for activity type
   */
  private getDepletionRate(activity: ActivityType): number {
    switch (activity) {
      case 'IDLE':
        return WATER_DEPLETION_RATES.IDLE;
      case 'WALKING':
        return WATER_DEPLETION_RATES.WALKING;
      case 'RUNNING':
        return WATER_DEPLETION_RATES.RUNNING;
      case 'RIDING_WORM':
        return WATER_DEPLETION_RATES.RIDING_WORM;
    }
  }

  /**
   * Get thirst level based on water amount
   */
  getThirstLevel(water: number): ThirstLevel {
    if (water >= 50) {
      return ThirstLevel.HYDRATED;
    } else if (water >= 25) {
      return ThirstLevel.MILD;
    } else if (water >= 10) {
      return ThirstLevel.MODERATE;
    } else {
      return ThirstLevel.SEVERE;
    }
  }

  /**
   * Get thirst effects for current water level
   */
  getThirstEffects(water: number): ThirstEffect {
    const level = this.getThirstLevel(water);
    return THIRST_EFFECTS[level];
  }

  /**
   * Check if player should die from dehydration
   */
  checkDeathByDehydration(water: number): boolean {
    return water <= 0;
  }

  /**
   * Apply thirst effects to player speed
   * Returns modified speed multiplier
   */
  applyThirstEffectToSpeed(water: number, baseSpeed: number): number {
    const effect = this.getThirstEffects(water);
    return baseSpeed * effect.speedPenalty;
  }

  /**
   * Calculate health drain for current water level
   * Returns HP to drain per second
   */
  calculateHealthDrain(water: number): number {
    const effect = this.getThirstEffects(water);
    return effect.healthDrain;
  }
}
