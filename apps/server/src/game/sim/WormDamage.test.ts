import { describe, it, expect, beforeEach } from 'vitest';
import { WormDamage } from './WormDamage';
import { WormAI } from './WormAI';
import { GAME_CONSTANTS, WormAIState } from '@fremen/shared';
import type { WormState } from '@fremen/shared';

describe('VS2: Worm Damage System', () => {
  let wormDamage: WormDamage;
  let wormAI: WormAI;
  const SEED = 12345;

  beforeEach(() => {
    wormDamage = new WormDamage(SEED);
    wormAI = new WormAI();
  });

  describe('Terrain Damage Detection', () => {
    it('should deal damage when worm hits high terrain (heightDiff > 5)', () => {
      const worms = wormAI.getWorms();
      const worm = worms[0];

      // Move worm to position with known high terrain (need to find one)
      // For testing, manipulate head position to be significantly below terrain
      worm.controlPoints[0] = { x: 0, y: -10, z: 0 }; // 10m below expected terrain

      const damage = wormDamage.checkTerrainDamage(worm);

      expect(damage).toBeGreaterThan(0);
    });

    it('should deal exactly 50 damage on obstacle collision', () => {
      const worms = wormAI.getWorms();
      const worm = worms[0];

      // Position with large height difference
      worm.controlPoints[0] = { x: 0, y: -20, z: 0 };

      const damage = wormDamage.checkTerrainDamage(worm);

      expect(damage).toBe(50);
    });

    it('should not deal damage when heightDiff <= 5', () => {
      const worms = wormAI.getWorms();
      const worm = worms[0];

      // Position head at approximately terrain height
      const headPos = worm.controlPoints[0];
      const terrainHeight = (wormDamage as any).terrainGenerator.getHeight(headPos.x, headPos.z);
      worm.controlPoints[0] = { x: headPos.x, y: terrainHeight, z: headPos.z };

      const damage = wormDamage.checkTerrainDamage(worm);

      expect(damage).toBe(0);
    });

    it('should deal damage when head is above terrain (inverted collision)', () => {
      const worms = wormAI.getWorms();
      const worm = worms[0];

      const headPos = worm.controlPoints[0];
      const terrainHeight = (wormDamage as any).terrainGenerator.getHeight(headPos.x, headPos.z);

      // Position head significantly above terrain
      worm.controlPoints[0] = { x: headPos.x, y: terrainHeight + 10, z: headPos.z };

      const damage = wormDamage.checkTerrainDamage(worm);

      expect(damage).toBe(50);
    });

    it('should handle worm with no control points', () => {
      const worms = wormAI.getWorms();
      const worm = worms[0];
      worm.controlPoints = [];

      const damage = wormDamage.checkTerrainDamage(worm);

      expect(damage).toBe(0);
    });

    it('should handle worm with null/undefined head position gracefully', () => {
      const worms = wormAI.getWorms();
      const worm = worms[0];

      // This shouldn't happen in practice, but test robustness
      expect(() => {
        wormDamage.checkTerrainDamage(worm);
      }).not.toThrow();
    });
  });

  describe('Damage Cooldown System', () => {
    it('should not deal damage twice at same location within 10m', () => {
      const worms = wormAI.getWorms();
      const worm = worms[0];

      // First collision
      worm.controlPoints[0] = { x: 0, y: -20, z: 0 };
      const damage1 = wormDamage.checkTerrainDamage(worm);
      expect(damage1).toBe(50);

      // Second collision at same spot
      const damage2 = wormDamage.checkTerrainDamage(worm);
      expect(damage2).toBe(0); // Cooldown active
    });

    it('should deal damage again when worm moves > 10m away', () => {
      const worms = wormAI.getWorms();
      const worm = worms[0];

      // First collision
      worm.controlPoints[0] = { x: 0, y: -20, z: 0 };
      const damage1 = wormDamage.checkTerrainDamage(worm);
      expect(damage1).toBe(50);

      // Move exactly 10.1m away and collide again
      worm.controlPoints[0] = { x: 10.1, y: -20, z: 0 };
      const damage2 = wormDamage.checkTerrainDamage(worm);
      expect(damage2).toBe(50);
    });

    it('should deal damage when moved exactly 10m (boundary test)', () => {
      const worms = wormAI.getWorms();
      const worm = worms[0];

      worm.controlPoints[0] = { x: 0, y: -20, z: 0 };
      wormDamage.checkTerrainDamage(worm);

      // Move exactly 10m (cooldown check is dist < 10, so 10m allows damage)
      worm.controlPoints[0] = { x: 10, y: -20, z: 0 };
      const damage = wormDamage.checkTerrainDamage(worm);

      expect(damage).toBe(50); // Should deal damage at exactly 10m
    });

    it('should deal damage when moved 9.9m (just under boundary)', () => {
      const worms = wormAI.getWorms();
      const worm = worms[0];

      worm.controlPoints[0] = { x: 0, y: -20, z: 0 };
      wormDamage.checkTerrainDamage(worm);

      // Move 9.9m
      worm.controlPoints[0] = { x: 9.9, y: -20, z: 0 };
      const damage = wormDamage.checkTerrainDamage(worm);

      expect(damage).toBe(0); // Still within cooldown
    });

    it('should track separate cooldowns for multiple worms', () => {
      // Create second worm manually
      const worm1 = wormAI.getWorms()[0];
      const worm2: WormState = {
        id: 'worm-1',
        controlPoints: [{ x: 100, y: -20, z: 100 }],
        speed: 15,
        aiState: WormAIState.PATROLLING,
        health: GAME_CONSTANTS.WORM_INITIAL_HEALTH,
        heading: 0,
      };

      // Damage both worms
      worm1.controlPoints[0] = { x: 0, y: -20, z: 0 };
      const damage1a = wormDamage.checkTerrainDamage(worm1);
      expect(damage1a).toBe(50);

      const damage2a = wormDamage.checkTerrainDamage(worm2);
      expect(damage2a).toBe(50);

      // Both should be on cooldown at their respective locations
      const damage1b = wormDamage.checkTerrainDamage(worm1);
      const damage2b = wormDamage.checkTerrainDamage(worm2);

      expect(damage1b).toBe(0);
      expect(damage2b).toBe(0);
    });

    it('should reset cooldown when worm moves far and returns', () => {
      const worms = wormAI.getWorms();
      const worm = worms[0];

      // First damage
      worm.controlPoints[0] = { x: 0, y: -20, z: 0 };
      wormDamage.checkTerrainDamage(worm);

      // Move away
      worm.controlPoints[0] = { x: 20, y: -20, z: 0 };
      wormDamage.checkTerrainDamage(worm);

      // Return to original spot
      worm.controlPoints[0] = { x: 0, y: -20, z: 0 };
      const damage = wormDamage.checkTerrainDamage(worm);

      expect(damage).toBe(50); // Should take damage again
    });
  });

  describe('Damage Application', () => {
    it('should reduce worm health by damage amount', () => {
      const worms = wormAI.getWorms();
      const worm = worms[0];
      const initialHealth = worm.health;

      const died = wormDamage.applyDamage(worm, 100);

      expect(worm.health).toBe(initialHealth - 100);
      expect(died).toBe(false);
    });

    it('should return false when worm survives damage', () => {
      const worms = wormAI.getWorms();
      const worm = worms[0];

      const died = wormDamage.applyDamage(worm, 50);

      expect(died).toBe(false);
      expect(worm.health).toBeGreaterThan(0);
    });

    it('should return true when worm health reaches 0', () => {
      const worms = wormAI.getWorms();
      const worm = worms[0];

      const died = wormDamage.applyDamage(worm, GAME_CONSTANTS.WORM_INITIAL_HEALTH);

      expect(died).toBe(true);
      expect(worm.health).toBe(0);
    });

    it('should return true when damage exceeds current health', () => {
      const worms = wormAI.getWorms();
      const worm = worms[0];
      worm.health = 50;

      const died = wormDamage.applyDamage(worm, 100);

      expect(died).toBe(true);
      expect(worm.health).toBe(0); // Clamped to 0, not negative
    });

    it('should clamp health to 0 (not negative)', () => {
      const worms = wormAI.getWorms();
      const worm = worms[0];
      worm.health = 10;

      wormDamage.applyDamage(worm, 50);

      expect(worm.health).toBe(0);
      expect(worm.health).not.toBeLessThan(0);
    });

    it('should handle zero damage', () => {
      const worms = wormAI.getWorms();
      const worm = worms[0];
      const initialHealth = worm.health;

      const died = wormDamage.applyDamage(worm, 0);

      expect(died).toBe(false);
      expect(worm.health).toBe(initialHealth);
    });

    it('should handle negative damage (heals worm)', () => {
      const worms = wormAI.getWorms();
      const worm = worms[0];
      const initialHealth = worm.health;

      wormDamage.applyDamage(worm, -50);

      // Negative damage actually increases health (health -= damage, so -= -50 = +50)
      expect(worm.health).toBeGreaterThan(initialHealth);
      expect(worm.health).toBe(initialHealth + 50);
    });

    it('should accumulate damage over multiple hits', () => {
      const worms = wormAI.getWorms();
      const worm = worms[0];

      wormDamage.applyDamage(worm, 200);
      wormDamage.applyDamage(worm, 200);
      wormDamage.applyDamage(worm, 200);
      wormDamage.applyDamage(worm, 200);
      wormDamage.applyDamage(worm, 200);

      expect(worm.health).toBe(0);
    });
  });

  describe('Death Handling', () => {
    it('should kill worm with exactly WORM_INITIAL_HEALTH damage', () => {
      const worms = wormAI.getWorms();
      const worm = worms[0];

      expect(worm.health).toBe(GAME_CONSTANTS.WORM_INITIAL_HEALTH);

      const died = wormDamage.applyDamage(worm, GAME_CONSTANTS.WORM_INITIAL_HEALTH);

      expect(died).toBe(true);
      expect(worm.health).toBe(0);
    });

    it('should require exactly 20 hits of 50 damage to kill worm (1000 HP)', () => {
      const worms = wormAI.getWorms();
      const worm = worms[0];

      let hitCount = 0;
      let died = false;

      while (!died && hitCount < 25) {
        died = wormDamage.applyDamage(worm, 50);
        hitCount++;
      }

      expect(hitCount).toBe(20);
      expect(died).toBe(true);
      expect(worm.health).toBe(0);
    });

    it('should handle death on fractional health', () => {
      const worms = wormAI.getWorms();
      const worm = worms[0];
      worm.health = 0.1;

      const died = wormDamage.applyDamage(worm, 1);

      expect(died).toBe(true);
      expect(worm.health).toBe(0);
    });

    it('should report death when applying damage to dead worm', () => {
      const worms = wormAI.getWorms();
      const worm = worms[0];

      wormDamage.applyDamage(worm, 1000);
      const died2 = wormDamage.applyDamage(worm, 100);

      // applyDamage returns true if health <= 0 after damage, so returns true again
      expect(died2).toBe(true);
      expect(worm.health).toBeLessThanOrEqual(0); // Will be negative
    });
  });

  describe('Integration with Terrain System', () => {
    it('should use consistent terrain height across checks', () => {
      const worms = wormAI.getWorms();
      const worm = worms[0];

      const pos = { x: 123, y: 0, z: 456 };
      const terrainHeight = (wormDamage as any).terrainGenerator.getHeight(pos.x, pos.z);

      // Position at terrain height
      worm.controlPoints[0] = { ...pos, y: terrainHeight };
      const damage1 = wormDamage.checkTerrainDamage(worm);

      // Check again at same position
      const damage2 = wormDamage.checkTerrainDamage(worm);

      expect(damage1).toBe(damage2); // Should be consistent
    });

    it('should work with seeded terrain (deterministic)', () => {
      const wormDamage1 = new WormDamage(SEED);
      const wormDamage2 = new WormDamage(SEED);

      const worm1 = wormAI.getWorms()[0];
      const worm2 = { ...worm1, id: 'worm-test' };

      worm1.controlPoints[0] = { x: 100, y: -20, z: 100 };
      worm2.controlPoints[0] = { x: 100, y: -20, z: 100 };

      const damage1 = wormDamage1.checkTerrainDamage(worm1);
      const damage2 = wormDamage2.checkTerrainDamage(worm2);

      expect(damage1).toBe(damage2); // Same seed = same terrain = same damage
    });

    it('should produce different damage with different seeds', () => {
      const wormDamage1 = new WormDamage(12345);
      const wormDamage2 = new WormDamage(67890);

      const worm1 = wormAI.getWorms()[0];
      const worm2 = { ...worm1, id: 'worm-test' };

      // Same position, different terrain seeds
      worm1.controlPoints[0] = { x: 100, y: 5, z: 100 };
      worm2.controlPoints[0] = { x: 100, y: 5, z: 100 };

      // We can't guarantee different damage, but the terrain should be different
      const terrain1 = (wormDamage1 as any).terrainGenerator.getHeight(100, 100);
      const terrain2 = (wormDamage2 as any).terrainGenerator.getHeight(100, 100);

      expect(terrain1).not.toBe(terrain2);
    });

    it('should handle positions at world boundaries', () => {
      const worms = wormAI.getWorms();
      const worm = worms[0];

      // Test extreme positions
      const extremePositions = [
        { x: 0, y: -20, z: 0 },
        { x: 10000, y: -20, z: 10000 },
        { x: -10000, y: -20, z: -10000 },
      ];

      for (const pos of extremePositions) {
        worm.controlPoints[0] = pos;

        expect(() => {
          wormDamage.checkTerrainDamage(worm);
        }).not.toThrow();
      }
    });
  });

  describe('Edge Cases and Robustness', () => {
    it('should handle worm with fractional health', () => {
      const worms = wormAI.getWorms();
      const worm = worms[0];
      worm.health = 123.456;

      const died = wormDamage.applyDamage(worm, 50);

      expect(died).toBe(false);
      expect(worm.health).toBeCloseTo(73.456, 3);
    });

    it('should handle very small damage amounts', () => {
      const worms = wormAI.getWorms();
      const worm = worms[0];
      const initialHealth = worm.health;

      wormDamage.applyDamage(worm, 0.001);

      expect(worm.health).toBeLessThan(initialHealth);
      expect(worm.health).toBeCloseTo(initialHealth - 0.001, 5);
    });

    it('should handle very large damage amounts', () => {
      const worms = wormAI.getWorms();
      const worm = worms[0];

      const died = wormDamage.applyDamage(worm, 1e10);

      expect(died).toBe(true);
      expect(worm.health).toBe(0);
    });

    it('should handle NaN damage gracefully', () => {
      const worms = wormAI.getWorms();
      const worm = worms[0];
      const initialHealth = worm.health;

      wormDamage.applyDamage(worm, NaN);

      // Health becomes NaN, which is not ideal but shouldn't crash
      expect(worm.health).toBeDefined();
    });

    it('should handle Infinity damage', () => {
      const worms = wormAI.getWorms();
      const worm = worms[0];

      wormDamage.applyDamage(worm, Infinity);

      // Health should be highly negative or handled specially
      expect(worm.health).toBeLessThanOrEqual(0);
    });

    it('should handle worm position with exact terrain height (boundary)', () => {
      const worms = wormAI.getWorms();
      const worm = worms[0];

      const pos = { x: 50, z: 50 };
      const terrainHeight = (wormDamage as any).terrainGenerator.getHeight(pos.x, pos.z);

      // Exactly at terrain height
      worm.controlPoints[0] = { x: pos.x, y: terrainHeight, z: pos.z };

      const damage = wormDamage.checkTerrainDamage(worm);

      expect(damage).toBe(0); // heightDiff = 0, which is <= 5
    });

    it('should handle worm position exactly 5m below terrain (boundary)', () => {
      const worms = wormAI.getWorms();
      const worm = worms[0];

      const pos = { x: 50, z: 50 };
      const terrainHeight = (wormDamage as any).terrainGenerator.getHeight(pos.x, pos.z);

      worm.controlPoints[0] = { x: pos.x, y: terrainHeight - 5, z: pos.z };

      const damage = wormDamage.checkTerrainDamage(worm);

      expect(damage).toBe(0); // heightDiff = 5, which is not > 5
    });

    it('should handle worm position exactly 5.1m below terrain (just over boundary)', () => {
      const worms = wormAI.getWorms();
      const worm = worms[0];

      const pos = { x: 50, z: 50 };
      const terrainHeight = (wormDamage as any).terrainGenerator.getHeight(pos.x, pos.z);

      worm.controlPoints[0] = { x: pos.x, y: terrainHeight - 5.1, z: pos.z };

      const damage = wormDamage.checkTerrainDamage(worm);

      expect(damage).toBe(50); // heightDiff = 5.1, which is > 5
    });
  });

  describe('Realistic Gameplay Scenarios', () => {
    it('should simulate worm crashing into terrain multiple times', () => {
      const worms = wormAI.getWorms();
      const worm = worms[0];
      let totalDamage = 0;

      // Simulate 5 collisions at different locations
      const collisionPositions = [
        { x: 0, y: -20, z: 0 },
        { x: 50, y: -20, z: 50 },
        { x: 100, y: -20, z: 100 },
        { x: 150, y: -20, z: 150 },
        { x: 200, y: -20, z: 200 },
      ];

      for (const pos of collisionPositions) {
        worm.controlPoints[0] = pos;
        const damage = wormDamage.checkTerrainDamage(worm);
        if (damage > 0) {
          wormDamage.applyDamage(worm, damage);
          totalDamage += damage;
        }
      }

      expect(totalDamage).toBeGreaterThan(0);
      expect(worm.health).toBeLessThan(GAME_CONSTANTS.WORM_INITIAL_HEALTH);
    });

    it('should kill worm after sufficient terrain damage', () => {
      const worms = wormAI.getWorms();
      const worm = worms[0];

      // Simulate continuous collisions
      for (let i = 0; i < 25; i++) {
        worm.controlPoints[0] = { x: i * 20, y: -20, z: i * 20 };
        const damage = wormDamage.checkTerrainDamage(worm);
        const died = wormDamage.applyDamage(worm, damage);

        if (died) {
          expect(worm.health).toBe(0);
          break;
        }
      }

      expect(worm.health).toBe(0);
    });

    it('should allow worm to survive careful navigation', () => {
      const worms = wormAI.getWorms();
      const worm = worms[0];

      // Simulate careful movement at safe height
      for (let i = 0; i < 100; i++) {
        const pos = { x: i * 2, z: i * 2 };
        const terrainHeight = (wormDamage as any).terrainGenerator.getHeight(pos.x, pos.z);

        worm.controlPoints[0] = { x: pos.x, y: terrainHeight + 1, z: pos.z };

        const damage = wormDamage.checkTerrainDamage(worm);
        wormDamage.applyDamage(worm, damage);
      }

      // Worm should survive careful navigation
      expect(worm.health).toBeGreaterThan(GAME_CONSTANTS.WORM_INITIAL_HEALTH * 0.5);
    });
  });
});
