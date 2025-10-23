import { ECONOMY_CONSTANTS, PlayerStats } from '@fremen/shared';

interface RewardResult {
  success: boolean;
  spice: number;
  water: number;
}

/**
 * VS3: Reward System
 *
 * Manages objective completion rewards, player stat tracking,
 * and reward calculations for achievements.
 */
export class RewardManager {
  /**
   * Grant rewards for completing an objective
   */
  grantObjectiveReward(currentSpice: number, currentWater: number): RewardResult {
    // Ensure non-negative values
    const safeSpice = Math.max(0, currentSpice);
    const safeWater = Math.max(0, currentWater);

    // Add rewards
    const newSpice = safeSpice + ECONOMY_CONSTANTS.OBJECTIVE_REWARD_SPICE;
    const newWater = Math.min(100, safeWater + ECONOMY_CONSTANTS.OBJECTIVE_REWARD_WATER);

    console.log(`Objective completed: +${ECONOMY_CONSTANTS.OBJECTIVE_REWARD_SPICE} spice, +${ECONOMY_CONSTANTS.OBJECTIVE_REWARD_WATER} water`);

    return {
      success: true,
      spice: newSpice,
      water: newWater,
    };
  }

  /**
   * Update player stats after objective completion
   */
  updateObjectiveStats(stats: PlayerStats, spiceEarned: number): PlayerStats {
    return {
      ...stats,
      objectivesCompleted: stats.objectivesCompleted + 1,
      totalSpiceEarned: stats.totalSpiceEarned + spiceEarned,
    };
  }

  /**
   * Add distance traveled to player stats
   */
  addDistanceTraveled(stats: PlayerStats, distance: number): PlayerStats {
    return {
      ...stats,
      distanceTraveled: stats.distanceTraveled + distance,
    };
  }

  /**
   * Increment death counter
   */
  incrementDeaths(stats: PlayerStats): PlayerStats {
    return {
      ...stats,
      deaths: stats.deaths + 1,
    };
  }

  /**
   * Increment worms ridden counter
   */
  incrementWormsRidden(stats: PlayerStats): PlayerStats {
    return {
      ...stats,
      wormsRidden: stats.wormsRidden + 1,
    };
  }

  /**
   * Calculate total spice reward for multiple objectives
   */
  calculateTotalSpiceReward(objectivesCompleted: number): number {
    return objectivesCompleted * ECONOMY_CONSTANTS.OBJECTIVE_REWARD_SPICE;
  }

  /**
   * Calculate total water reward for multiple objectives
   */
  calculateTotalWaterReward(objectivesCompleted: number): number {
    return objectivesCompleted * ECONOMY_CONSTANTS.OBJECTIVE_REWARD_WATER;
  }
}
