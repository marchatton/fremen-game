import { describe, it, expect, beforeEach } from 'vitest';
import { WaterSystem } from './WaterSystem.js';
import { ThirstLevel, WATER_DEPLETION_RATES, THIRST_EFFECTS } from '@fremen/shared';
import type { PlayerState, Vector3 } from '@fremen/shared';
import { PlayerStateEnum } from '@fremen/shared';

describe('VS3: Water Survival System', () => {
  let waterSystem: WaterSystem;

  beforeEach(() => {
    waterSystem = new WaterSystem();
  });

  describe('Water Depletion - Idle', () => {
    it('should deplete water at idle rate when not moving', () => {
      const player: PlayerState = {
        id: 'player1',
        position: { x: 0, y: 0, z: 0 },
        rotation: 0,
        velocity: { x: 0, y: 0, z: 0 },
        state: PlayerStateEnum.ACTIVE,
      };

      const currentWater = 100;
      const deltaTime = 60; // 1 minute in seconds

      const newWater = waterSystem.calculateWaterDepletion(currentWater, player, deltaTime);

      // IDLE: -0.5/minute * 1 minute = -0.5
      expect(newWater).toBeCloseTo(99.5, 2);
    });

    it('should deplete correct amount over multiple minutes', () => {
      const player: PlayerState = {
        id: 'player1',
        position: { x: 0, y: 0, z: 0 },
        rotation: 0,
        velocity: { x: 0, y: 0, z: 0 },
        state: PlayerStateEnum.ACTIVE,
      };

      const deltaTime = 60 * 5; // 5 minutes

      const newWater = waterSystem.calculateWaterDepletion(100, player, deltaTime);

      // IDLE: -0.5/min * 5 min = -2.5
      expect(newWater).toBeCloseTo(97.5, 2);
    });

    it('should handle fractional seconds correctly', () => {
      const player: PlayerState = {
        id: 'player1',
        position: { x: 0, y: 0, z: 0 },
        rotation: 0,
        velocity: { x: 0, y: 0, z: 0 },
        state: PlayerStateEnum.ACTIVE,
      };

      const deltaTime = 1 / 30; // One game tick at 30Hz

      const newWater = waterSystem.calculateWaterDepletion(100, player, deltaTime);

      // IDLE: -0.5/min * (1/30 / 60) = -0.000277...
      expect(newWater).toBeLessThan(100);
      expect(newWater).toBeGreaterThan(99.99);
    });
  });

  describe('Water Depletion - Walking', () => {
    it('should deplete water at walking rate when moving slowly', () => {
      const player: PlayerState = {
        id: 'player1',
        position: { x: 0, y: 0, z: 0 },
        rotation: 0,
        velocity: { x: 2, y: 0, z: 0 }, // Walking speed
        state: PlayerStateEnum.ACTIVE,
      };

      const deltaTime = 60; // 1 minute

      const newWater = waterSystem.calculateWaterDepletion(100, player, deltaTime);

      // WALKING: -1.0/minute * 1 minute = -1.0
      expect(newWater).toBeCloseTo(99.0, 2);
    });

    it('should detect walking speed correctly', () => {
      const player: PlayerState = {
        id: 'player1',
        position: { x: 0, y: 0, z: 0 },
        rotation: 0,
        velocity: { x: 3, y: 0, z: 0 },
        state: PlayerStateEnum.ACTIVE,
      };

      const activity = waterSystem.detectActivity(player);

      expect(activity).toBe('WALKING');
    });
  });

  describe('Water Depletion - Running', () => {
    it('should deplete water at running rate when moving fast', () => {
      const player: PlayerState = {
        id: 'player1',
        position: { x: 0, y: 0, z: 0 },
        rotation: 0,
        velocity: { x: 8, y: 0, z: 0 }, // Running speed
        state: PlayerStateEnum.ACTIVE,
      };

      const deltaTime = 60; // 1 minute

      const newWater = waterSystem.calculateWaterDepletion(100, player, deltaTime);

      // RUNNING: -2.0/minute * 1 minute = -2.0
      expect(newWater).toBeCloseTo(98.0, 2);
    });

    it('should detect running speed correctly', () => {
      const player: PlayerState = {
        id: 'player1',
        position: { x: 0, y: 0, z: 0 },
        rotation: 0,
        velocity: { x: 7, y: 0, z: 5 }, // Running diagonally
        state: PlayerStateEnum.ACTIVE,
      };

      const activity = waterSystem.detectActivity(player);

      expect(activity).toBe('RUNNING');
    });
  });

  describe('Water Depletion - Riding Worm', () => {
    it('should deplete water at riding rate when on worm', () => {
      const player: PlayerState = {
        id: 'player1',
        position: { x: 0, y: 0, z: 0 },
        rotation: 0,
        velocity: { x: 15, y: 0, z: 0 }, // Fast but on worm
        state: PlayerStateEnum.RIDING,
        ridingWormId: 'worm-0',
      };

      const deltaTime = 60; // 1 minute

      const newWater = waterSystem.calculateWaterDepletion(100, player, deltaTime);

      // RIDING_WORM: -0.2/minute * 1 minute = -0.2
      expect(newWater).toBeCloseTo(99.8, 2);
    });

    it('should use riding rate regardless of velocity when RIDING state', () => {
      const player: PlayerState = {
        id: 'player1',
        position: { x: 0, y: 0, z: 0 },
        rotation: 0,
        velocity: { x: 25, y: 0, z: 0 }, // Very fast
        state: PlayerStateEnum.RIDING,
        ridingWormId: 'worm-0',
      };

      const activity = waterSystem.detectActivity(player);

      expect(activity).toBe('RIDING_WORM');
    });
  });

  describe('Stillsuit Water Reduction', () => {
    it('should apply basic stillsuit reduction (25%)', () => {
      const player: PlayerState = {
        id: 'player1',
        position: { x: 0, y: 0, z: 0 },
        rotation: 0,
        velocity: { x: 2, y: 0, z: 0 },
        state: PlayerStateEnum.ACTIVE,
      };

      const deltaTime = 60; // 1 minute
      const stillsuitReduction = 0.25;

      const newWater = waterSystem.calculateWaterDepletion(100, player, deltaTime, stillsuitReduction);

      // WALKING: -1.0/min * 1 min = -1.0
      // With 25% reduction: -1.0 * (1 - 0.25) = -0.75
      expect(newWater).toBeCloseTo(99.25, 2);
    });

    it('should apply improved stillsuit reduction (50%)', () => {
      const player: PlayerState = {
        id: 'player1',
        position: { x: 0, y: 0, z: 0 },
        rotation: 0,
        velocity: { x: 8, y: 0, z: 0 },
        state: PlayerStateEnum.ACTIVE,
      };

      const deltaTime = 60; // 1 minute
      const stillsuitReduction = 0.50;

      const newWater = waterSystem.calculateWaterDepletion(100, player, deltaTime, stillsuitReduction);

      // RUNNING: -2.0/min * 1 min = -2.0
      // With 50% reduction: -2.0 * (1 - 0.50) = -1.0
      expect(newWater).toBeCloseTo(99.0, 2);
    });

    it('should apply advanced stillsuit reduction (75%)', () => {
      const player: PlayerState = {
        id: 'player1',
        position: { x: 0, y: 0, z: 0 },
        rotation: 0,
        velocity: { x: 8, y: 0, z: 0 },
        state: PlayerStateEnum.ACTIVE,
      };

      const deltaTime = 60; // 1 minute
      const stillsuitReduction = 0.75;

      const newWater = waterSystem.calculateWaterDepletion(100, player, deltaTime, stillsuitReduction);

      // RUNNING: -2.0/min * 1 min = -2.0
      // With 75% reduction: -2.0 * (1 - 0.75) = -0.5
      expect(newWater).toBeCloseTo(99.5, 2);
    });

    it('should handle no stillsuit (0% reduction)', () => {
      const player: PlayerState = {
        id: 'player1',
        position: { x: 0, y: 0, z: 0 },
        rotation: 0,
        velocity: { x: 2, y: 0, z: 0 },
        state: PlayerStateEnum.ACTIVE,
      };

      const deltaTime = 60;

      const newWater = waterSystem.calculateWaterDepletion(100, player, deltaTime, 0);

      // WALKING: -1.0/min, no reduction
      expect(newWater).toBeCloseTo(99.0, 2);
    });
  });

  describe('Thirst Level Calculation', () => {
    it('should return HYDRATED when water is 100', () => {
      const level = waterSystem.getThirstLevel(100);
      expect(level).toBe(ThirstLevel.HYDRATED);
    });

    it('should return HYDRATED when water is 51', () => {
      const level = waterSystem.getThirstLevel(51);
      expect(level).toBe(ThirstLevel.HYDRATED);
    });

    it('should return HYDRATED at boundary (50)', () => {
      const level = waterSystem.getThirstLevel(50);
      expect(level).toBe(ThirstLevel.HYDRATED);
    });

    it('should return MILD when water is 49', () => {
      const level = waterSystem.getThirstLevel(49);
      expect(level).toBe(ThirstLevel.MILD);
    });

    it('should return MILD when water is 26', () => {
      const level = waterSystem.getThirstLevel(26);
      expect(level).toBe(ThirstLevel.MILD);
    });

    it('should return MILD at boundary (25)', () => {
      const level = waterSystem.getThirstLevel(25);
      expect(level).toBe(ThirstLevel.MILD);
    });

    it('should return MODERATE when water is 24', () => {
      const level = waterSystem.getThirstLevel(24);
      expect(level).toBe(ThirstLevel.MODERATE);
    });

    it('should return MODERATE when water is 11', () => {
      const level = waterSystem.getThirstLevel(11);
      expect(level).toBe(ThirstLevel.MODERATE);
    });

    it('should return MODERATE at boundary (10)', () => {
      const level = waterSystem.getThirstLevel(10);
      expect(level).toBe(ThirstLevel.MODERATE);
    });

    it('should return SEVERE when water is 9', () => {
      const level = waterSystem.getThirstLevel(9);
      expect(level).toBe(ThirstLevel.SEVERE);
    });

    it('should return SEVERE when water is 1', () => {
      const level = waterSystem.getThirstLevel(1);
      expect(level).toBe(ThirstLevel.SEVERE);
    });

    it('should return SEVERE when water is 0', () => {
      const level = waterSystem.getThirstLevel(0);
      expect(level).toBe(ThirstLevel.SEVERE);
    });
  });

  describe('Thirst Effects - Speed Penalty', () => {
    it('should return no speed penalty when HYDRATED', () => {
      const effect = waterSystem.getThirstEffects(75);

      expect(effect.speedPenalty).toBe(1.0);
    });

    it('should return 10% speed penalty when MILD', () => {
      const effect = waterSystem.getThirstEffects(40);

      expect(effect.speedPenalty).toBe(0.9);
    });

    it('should return 25% speed penalty when MODERATE', () => {
      const effect = waterSystem.getThirstEffects(15);

      expect(effect.speedPenalty).toBe(0.75);
    });

    it('should return 50% speed penalty when SEVERE', () => {
      const effect = waterSystem.getThirstEffects(5);

      expect(effect.speedPenalty).toBe(0.5);
    });
  });

  describe('Thirst Effects - Health Drain', () => {
    it('should return no health drain when HYDRATED', () => {
      const effect = waterSystem.getThirstEffects(75);

      expect(effect.healthDrain).toBe(0);
    });

    it('should return no health drain when MILD', () => {
      const effect = waterSystem.getThirstEffects(40);

      expect(effect.healthDrain).toBe(0);
    });

    it('should return no health drain when MODERATE', () => {
      const effect = waterSystem.getThirstEffects(15);

      expect(effect.healthDrain).toBe(0);
    });

    it('should return 1 HP/s health drain when SEVERE', () => {
      const effect = waterSystem.getThirstEffects(5);

      expect(effect.healthDrain).toBe(1);
    });
  });

  describe('Death by Dehydration', () => {
    it('should detect death when water reaches 0', () => {
      const isDead = waterSystem.checkDeathByDehydration(0);

      expect(isDead).toBe(true);
    });

    it('should not detect death when water is above 0', () => {
      const isDead = waterSystem.checkDeathByDehydration(0.1);

      expect(isDead).toBe(false);
    });

    it('should not detect death when water is exactly 1', () => {
      const isDead = waterSystem.checkDeathByDehydration(1);

      expect(isDead).toBe(false);
    });

    it('should detect death when water is negative (edge case)', () => {
      const isDead = waterSystem.checkDeathByDehydration(-1);

      expect(isDead).toBe(true);
    });
  });

  describe('Water Bounds', () => {
    it('should clamp water to 0 minimum', () => {
      const player: PlayerState = {
        id: 'player1',
        position: { x: 0, y: 0, z: 0 },
        rotation: 0,
        velocity: { x: 8, y: 0, z: 0 },
        state: PlayerStateEnum.ACTIVE,
      };

      const deltaTime = 10000; // Extreme time

      const newWater = waterSystem.calculateWaterDepletion(5, player, deltaTime);

      expect(newWater).toBe(0);
      expect(newWater).toBeGreaterThanOrEqual(0);
    });

    it('should clamp water to 100 maximum', () => {
      const player: PlayerState = {
        id: 'player1',
        position: { x: 0, y: 0, z: 0 },
        rotation: 0,
        velocity: { x: 0, y: 0, z: 0 },
        state: PlayerStateEnum.ACTIVE,
      };

      // Start above 100 (shouldn't happen, but test bounds)
      const newWater = waterSystem.calculateWaterDepletion(150, player, 0);

      expect(newWater).toBe(100);
    });
  });

  describe('Activity Detection', () => {
    it('should detect idle when velocity is zero', () => {
      const player: PlayerState = {
        id: 'player1',
        position: { x: 0, y: 0, z: 0 },
        rotation: 0,
        velocity: { x: 0, y: 0, z: 0 },
        state: PlayerStateEnum.ACTIVE,
      };

      const activity = waterSystem.detectActivity(player);

      expect(activity).toBe('IDLE');
    });

    it('should detect idle when velocity is very small', () => {
      const player: PlayerState = {
        id: 'player1',
        position: { x: 0, y: 0, z: 0 },
        rotation: 0,
        velocity: { x: 0.1, y: 0, z: 0.1 },
        state: PlayerStateEnum.ACTIVE,
      };

      const activity = waterSystem.detectActivity(player);

      expect(activity).toBe('IDLE');
    });

    it('should prioritize RIDING state over velocity', () => {
      const player: PlayerState = {
        id: 'player1',
        position: { x: 0, y: 0, z: 0 },
        rotation: 0,
        velocity: { x: 100, y: 0, z: 0 }, // Very fast
        state: PlayerStateEnum.RIDING,
        ridingWormId: 'worm-0',
      };

      const activity = waterSystem.detectActivity(player);

      expect(activity).toBe('RIDING_WORM');
    });

    it('should calculate velocity magnitude correctly', () => {
      const player: PlayerState = {
        id: 'player1',
        position: { x: 0, y: 0, z: 0 },
        rotation: 0,
        velocity: { x: 3, y: 0, z: 4 }, // 3-4-5 triangle, magnitude = 5
        state: PlayerStateEnum.ACTIVE,
      };

      const activity = waterSystem.detectActivity(player);

      expect(activity).toBe('WALKING'); // 5 m/s is walking speed
    });
  });

  describe('Edge Cases', () => {
    it('should handle dead player state', () => {
      const player: PlayerState = {
        id: 'player1',
        position: { x: 0, y: 0, z: 0 },
        rotation: 0,
        velocity: { x: 0, y: 0, z: 0 },
        state: PlayerStateEnum.DEAD,
      };

      const newWater = waterSystem.calculateWaterDepletion(50, player, 60);

      // Dead players don't lose water
      expect(newWater).toBe(50);
    });

    it('should handle negative deltaTime gracefully', () => {
      const player: PlayerState = {
        id: 'player1',
        position: { x: 0, y: 0, z: 0 },
        rotation: 0,
        velocity: { x: 0, y: 0, z: 0 },
        state: PlayerStateEnum.ACTIVE,
      };

      const newWater = waterSystem.calculateWaterDepletion(50, player, -60);

      // Should not increase water
      expect(newWater).toBeLessThanOrEqual(50);
    });

    it('should handle very large stillsuit reduction gracefully', () => {
      const player: PlayerState = {
        id: 'player1',
        position: { x: 0, y: 0, z: 0 },
        rotation: 0,
        velocity: { x: 2, y: 0, z: 0 },
        state: PlayerStateEnum.ACTIVE,
      };

      const newWater = waterSystem.calculateWaterDepletion(100, player, 60, 1.5); // 150% reduction

      // Should not increase water beyond starting point
      expect(newWater).toBeLessThanOrEqual(100);
    });

    it('should handle zero deltaTime', () => {
      const player: PlayerState = {
        id: 'player1',
        position: { x: 0, y: 0, z: 0 },
        rotation: 0,
        velocity: { x: 2, y: 0, z: 0 },
        state: PlayerStateEnum.ACTIVE,
      };

      const newWater = waterSystem.calculateWaterDepletion(50, player, 0);

      expect(newWater).toBe(50);
    });

    it('should handle extreme velocity values', () => {
      const player: PlayerState = {
        id: 'player1',
        position: { x: 0, y: 0, z: 0 },
        rotation: 0,
        velocity: { x: 1000, y: 0, z: 0 },
        state: PlayerStateEnum.ACTIVE,
      };

      const activity = waterSystem.detectActivity(player);

      // Should still be detected as running (highest non-riding rate)
      expect(activity).toBe('RUNNING');
    });
  });

  describe('Realistic Gameplay Scenarios', () => {
    it('should simulate player surviving 30 minutes idle', () => {
      const player: PlayerState = {
        id: 'player1',
        position: { x: 0, y: 0, z: 0 },
        rotation: 0,
        velocity: { x: 0, y: 0, z: 0 },
        state: PlayerStateEnum.ACTIVE,
      };

      let water = 100;
      const deltaTime = 60; // 1 minute per tick

      for (let i = 0; i < 30; i++) {
        water = waterSystem.calculateWaterDepletion(water, player, deltaTime);
      }

      // IDLE: -0.5/min * 30 min = -15
      expect(water).toBeCloseTo(85, 1);
      expect(waterSystem.checkDeathByDehydration(water)).toBe(false);
    });

    it('should simulate player dying from running without water', () => {
      const player: PlayerState = {
        id: 'player1',
        position: { x: 0, y: 0, z: 0 },
        rotation: 0,
        velocity: { x: 8, y: 0, z: 0 },
        state: PlayerStateEnum.ACTIVE,
      };

      let water = 100;
      const deltaTime = 60; // 1 minute per tick

      // Run for 50 minutes (should deplete 100 water)
      for (let i = 0; i < 50; i++) {
        water = waterSystem.calculateWaterDepletion(water, player, deltaTime);
      }

      // RUNNING: -2.0/min * 50 min = -100
      expect(water).toBe(0);
      expect(waterSystem.checkDeathByDehydration(water)).toBe(true);
    });

    it('should simulate advanced stillsuit extending survival', () => {
      const player: PlayerState = {
        id: 'player1',
        position: { x: 0, y: 0, z: 0 },
        rotation: 0,
        velocity: { x: 8, y: 0, z: 0 },
        state: PlayerStateEnum.ACTIVE,
      };

      let water = 100;
      const deltaTime = 60;
      const stillsuitReduction = 0.75; // Advanced stillsuit

      // Run for 50 minutes with advanced stillsuit
      for (let i = 0; i < 50; i++) {
        water = waterSystem.calculateWaterDepletion(water, player, deltaTime, stillsuitReduction);
      }

      // RUNNING: -2.0/min * 50 min = -100
      // With 75% reduction: -100 * 0.25 = -25
      expect(water).toBeCloseTo(75, 1);
      expect(waterSystem.checkDeathByDehydration(water)).toBe(false);
    });

    it('should simulate worm riding being very efficient', () => {
      const player: PlayerState = {
        id: 'player1',
        position: { x: 0, y: 0, z: 0 },
        rotation: 0,
        velocity: { x: 20, y: 0, z: 0 },
        state: PlayerStateEnum.RIDING,
        ridingWormId: 'worm-0',
      };

      let water = 100;
      const deltaTime = 60;

      // Ride worm for 100 minutes
      for (let i = 0; i < 100; i++) {
        water = waterSystem.calculateWaterDepletion(water, player, deltaTime);
      }

      // RIDING_WORM: -0.2/min * 100 min = -20
      expect(water).toBeCloseTo(80, 1);
      expect(waterSystem.checkDeathByDehydration(water)).toBe(false);
    });
  });
});
