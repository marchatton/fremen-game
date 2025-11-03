import { describe, it, expect, beforeEach } from 'vitest';
import { RewardManager } from './RewardManager.js';
import { ECONOMY_CONSTANTS } from '@fremen/shared';
import type { PlayerStats } from '@fremen/shared';

describe('VS3: Reward System', () => {
  let manager: RewardManager;

  beforeEach(() => {
    manager = new RewardManager();
  });

  describe('Objective Completion Rewards', () => {
    it('should grant spice reward for objective completion', () => {
      const currentSpice = 50;
      const currentWater = 50;

      const result = manager.grantObjectiveReward(currentSpice, currentWater);

      expect(result.success).toBe(true);
      expect(result.spice).toBe(currentSpice + ECONOMY_CONSTANTS.OBJECTIVE_REWARD_SPICE);
    });

    it('should grant water reward for objective completion', () => {
      const currentSpice = 50;
      const currentWater = 50;

      const result = manager.grantObjectiveReward(currentSpice, currentWater);

      expect(result.success).toBe(true);
      expect(result.water).toBe(currentWater + ECONOMY_CONSTANTS.OBJECTIVE_REWARD_WATER);
    });

    it('should clamp water to 100 maximum', () => {
      const result = manager.grantObjectiveReward(0, 90);

      expect(result.success).toBe(true);
      expect(result.water).toBe(100); // Clamped from 115
    });

    it('should handle water at 0', () => {
      const result = manager.grantObjectiveReward(0, 0);

      expect(result.success).toBe(true);
      expect(result.water).toBe(ECONOMY_CONSTANTS.OBJECTIVE_REWARD_WATER);
    });

    it('should handle spice at 0', () => {
      const result = manager.grantObjectiveReward(0, 50);

      expect(result.success).toBe(true);
      expect(result.spice).toBe(ECONOMY_CONSTANTS.OBJECTIVE_REWARD_SPICE);
    });
  });

  describe('Stat Tracking', () => {
    let stats: PlayerStats;

    beforeEach(() => {
      stats = {
        objectivesCompleted: 0,
        totalSpiceEarned: 0,
        distanceTraveled: 0,
        deaths: 0,
        wormsRidden: 0,
        outpostsCaptured: 0,
      };
    });

    it('should increment objectives completed', () => {
      const newStats = manager.updateObjectiveStats(stats, ECONOMY_CONSTANTS.OBJECTIVE_REWARD_SPICE);

      expect(newStats.objectivesCompleted).toBe(1);
    });

    it('should accumulate total spice earned', () => {
      const newStats = manager.updateObjectiveStats(stats, 50);

      expect(newStats.totalSpiceEarned).toBe(50);
    });

    it('should track multiple objectives', () => {
      let currentStats = stats;

      for (let i = 0; i < 5; i++) {
        currentStats = manager.updateObjectiveStats(currentStats, 50);
      }

      expect(currentStats.objectivesCompleted).toBe(5);
      expect(currentStats.totalSpiceEarned).toBe(250);
    });

    it('should preserve other stats', () => {
      stats.deaths = 3;
      stats.wormsRidden = 10;

      const newStats = manager.updateObjectiveStats(stats, 50);

      expect(newStats.deaths).toBe(3);
      expect(newStats.wormsRidden).toBe(10);
    });
  });

  describe('Distance Tracking', () => {
    let stats: PlayerStats;

    beforeEach(() => {
      stats = {
        objectivesCompleted: 0,
        totalSpiceEarned: 0,
        distanceTraveled: 0,
        deaths: 0,
        wormsRidden: 0,
        outpostsCaptured: 0,
      };
    });

    it('should add distance traveled', () => {
      const newStats = manager.addDistanceTraveled(stats, 100);

      expect(newStats.distanceTraveled).toBe(100);
    });

    it('should accumulate distance', () => {
      let currentStats = stats;

      currentStats = manager.addDistanceTraveled(currentStats, 100);
      currentStats = manager.addDistanceTraveled(currentStats, 50);

      expect(currentStats.distanceTraveled).toBe(150);
    });

    it('should handle fractional distances', () => {
      const newStats = manager.addDistanceTraveled(stats, 12.5);

      expect(newStats.distanceTraveled).toBeCloseTo(12.5, 2);
    });
  });

  describe('Death Tracking', () => {
    let stats: PlayerStats;

    beforeEach(() => {
      stats = {
        objectivesCompleted: 0,
        totalSpiceEarned: 0,
        distanceTraveled: 0,
        deaths: 0,
        wormsRidden: 0,
        outpostsCaptured: 0,
      };
    });

    it('should increment deaths', () => {
      const newStats = manager.incrementDeaths(stats);

      expect(newStats.deaths).toBe(1);
    });

    it('should track multiple deaths', () => {
      let currentStats = stats;

      for (let i = 0; i < 5; i++) {
        currentStats = manager.incrementDeaths(currentStats);
      }

      expect(currentStats.deaths).toBe(5);
    });
  });

  describe('Worm Riding Tracking', () => {
    let stats: PlayerStats;

    beforeEach(() => {
      stats = {
        objectivesCompleted: 0,
        totalSpiceEarned: 0,
        distanceTraveled: 0,
        deaths: 0,
        wormsRidden: 0,
        outpostsCaptured: 0,
      };
    });

    it('should increment worms ridden', () => {
      const newStats = manager.incrementWormsRidden(stats);

      expect(newStats.wormsRidden).toBe(1);
    });

    it('should track multiple worms', () => {
      let currentStats = stats;

      for (let i = 0; i < 10; i++) {
        currentStats = manager.incrementWormsRidden(currentStats);
      }

      expect(currentStats.wormsRidden).toBe(10);
    });
  });

  describe('Reward Calculations', () => {
    it('should calculate total rewards for session', () => {
      const objectivesCompleted = 5;

      const totalSpice = manager.calculateTotalSpiceReward(objectivesCompleted);
      const totalWater = manager.calculateTotalWaterReward(objectivesCompleted);

      expect(totalSpice).toBe(objectivesCompleted * ECONOMY_CONSTANTS.OBJECTIVE_REWARD_SPICE);
      expect(totalWater).toBe(objectivesCompleted * ECONOMY_CONSTANTS.OBJECTIVE_REWARD_WATER);
    });

    it('should handle 0 objectives', () => {
      const totalSpice = manager.calculateTotalSpiceReward(0);
      const totalWater = manager.calculateTotalWaterReward(0);

      expect(totalSpice).toBe(0);
      expect(totalWater).toBe(0);
    });

    it('should handle large numbers', () => {
      const totalSpice = manager.calculateTotalSpiceReward(100);

      expect(totalSpice).toBe(5000); // 100 * 50
    });
  });

  describe('Edge Cases', () => {
    it('should handle negative water gracefully', () => {
      const result = manager.grantObjectiveReward(0, -10);

      expect(result.success).toBe(true);
      expect(result.water).toBeGreaterThanOrEqual(0);
    });

    it('should handle negative spice gracefully', () => {
      const result = manager.grantObjectiveReward(-10, 50);

      expect(result.success).toBe(true);
      expect(result.spice).toBeGreaterThanOrEqual(0);
    });

    it('should handle very large spice values', () => {
      const result = manager.grantObjectiveReward(999999, 50);

      expect(result.success).toBe(true);
      expect(result.spice).toBeGreaterThan(999999);
    });

    it('should handle 0 distance traveled', () => {
      const stats: PlayerStats = {
        objectivesCompleted: 0,
        totalSpiceEarned: 0,
        distanceTraveled: 0,
        deaths: 0,
        wormsRidden: 0,
        outpostsCaptured: 0,
      };

      const newStats = manager.addDistanceTraveled(stats, 0);

      expect(newStats.distanceTraveled).toBe(0);
    });
  });

  describe('Realistic Gameplay Scenarios', () => {
    it('should simulate player completing first objective', () => {
      const spice = 0;
      const water = 100;
      const stats: PlayerStats = {
        objectivesCompleted: 0,
        totalSpiceEarned: 0,
        distanceTraveled: 0,
        deaths: 0,
        wormsRidden: 0,
        outpostsCaptured: 0,
      };

      // Grant reward
      const rewardResult = manager.grantObjectiveReward(spice, water);
      const newStats = manager.updateObjectiveStats(stats, ECONOMY_CONSTANTS.OBJECTIVE_REWARD_SPICE);

      expect(rewardResult.spice).toBe(50);
      expect(rewardResult.water).toBe(100); // Clamped
      expect(newStats.objectivesCompleted).toBe(1);
      expect(newStats.totalSpiceEarned).toBe(50);
    });

    it('should simulate player completing 10 objectives in session', () => {
      let spice = 0;
      let water = 50;
      let stats: PlayerStats = {
        objectivesCompleted: 0,
        totalSpiceEarned: 0,
        distanceTraveled: 500,
        deaths: 1,
        wormsRidden: 5,
        outpostsCaptured: 0,
      };

      for (let i = 0; i < 10; i++) {
        const reward = manager.grantObjectiveReward(spice, water);
        spice = reward.spice;
        water = reward.water;
        stats = manager.updateObjectiveStats(stats, ECONOMY_CONSTANTS.OBJECTIVE_REWARD_SPICE);
      }

      expect(spice).toBe(500); // 10 * 50
      expect(water).toBe(100); // Clamped
      expect(stats.objectivesCompleted).toBe(10);
      expect(stats.totalSpiceEarned).toBe(500);
      expect(stats.distanceTraveled).toBe(500); // Preserved
      expect(stats.deaths).toBe(1); // Preserved
    });

    it('should track player career progression', () => {
      let stats: PlayerStats = {
        objectivesCompleted: 0,
        totalSpiceEarned: 0,
        distanceTraveled: 0,
        deaths: 0,
        wormsRidden: 0,
        outpostsCaptured: 0,
      };

      // Session 1: 5 objectives, 3 worms ridden, 1000m traveled, 0 deaths
      for (let i = 0; i < 5; i++) {
        stats = manager.updateObjectiveStats(stats, 50);
      }
      for (let i = 0; i < 3; i++) {
        stats = manager.incrementWormsRidden(stats);
      }
      stats = manager.addDistanceTraveled(stats, 1000);

      // Session 2: 3 objectives, 2 worms ridden, 500m traveled, 1 death
      for (let i = 0; i < 3; i++) {
        stats = manager.updateObjectiveStats(stats, 50);
      }
      for (let i = 0; i < 2; i++) {
        stats = manager.incrementWormsRidden(stats);
      }
      stats = manager.addDistanceTraveled(stats, 500);
      stats = manager.incrementDeaths(stats);

      expect(stats.objectivesCompleted).toBe(8);
      expect(stats.totalSpiceEarned).toBe(400); // 8 * 50
      expect(stats.wormsRidden).toBe(5);
      expect(stats.distanceTraveled).toBeCloseTo(1500, 0);
      expect(stats.deaths).toBe(1);
    });
  });
});
