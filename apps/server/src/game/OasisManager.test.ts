import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OasisManager } from './OasisManager.js';
import { ECONOMY_CONSTANTS } from '@fremen/shared';
import type { Vector3, Oasis } from '@fremen/shared';

describe('VS3: Oasis System', () => {
  let manager: OasisManager;

  beforeEach(() => {
    vi.useFakeTimers();
    manager = new OasisManager();
  });

  describe('Oasis Generation', () => {
    it('should generate 3-5 oases', () => {
      const oases = manager.generateOases();

      expect(oases.length).toBeGreaterThanOrEqual(3);
      expect(oases.length).toBeLessThanOrEqual(5);
    });

    it('should generate oases at fixed positions', () => {
      const oases1 = manager.generateOases();
      const oases2 = manager.generateOases();

      // Should regenerate same positions
      expect(oases1.length).toBe(oases2.length);
      expect(oases1[0].position.x).toBe(oases2[0].position.x);
      expect(oases1[0].position.z).toBe(oases2[0].position.z);
    });

    it('should assign unique IDs to each oasis', () => {
      const oases = manager.generateOases();

      const ids = oases.map(o => o.id);
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(oases.length);
    });

    it('should set correct refill amount', () => {
      const oases = manager.generateOases();

      oases.forEach(oasis => {
        expect(oasis.refillAmount).toBe(ECONOMY_CONSTANTS.OASIS_REFILL_AMOUNT);
      });
    });

    it('should set correct cooldown duration', () => {
      const oases = manager.generateOases();

      oases.forEach(oasis => {
        expect(oasis.cooldownDuration).toBe(ECONOMY_CONSTANTS.OASIS_COOLDOWN);
      });
    });

    it('should initialize with empty cooldowns', () => {
      const oases = manager.generateOases();

      oases.forEach(oasis => {
        expect(oasis.activeCooldowns).toEqual({});
      });
    });

    it('should set reasonable radius for each oasis', () => {
      const oases = manager.generateOases();

      oases.forEach(oasis => {
        expect(oasis.radius).toBeGreaterThan(0);
        expect(oasis.radius).toBeLessThanOrEqual(20);
      });
    });
  });

  describe('Water Refill Interaction', () => {
    let oasisId: string;
    let oasisPosition: Vector3;

    beforeEach(() => {
      const oases = manager.generateOases();
      oasisId = oases[0].id;
      oasisPosition = oases[0].position;
    });

    it('should refill water when player is within range', () => {
      const playerPosition: Vector3 = { ...oasisPosition };
      const currentWater = 50;

      const result = manager.refillWater('player1', oasisId, currentWater, playerPosition);

      expect(result.success).toBe(true);
      expect(result.newWater).toBe(currentWater + ECONOMY_CONSTANTS.OASIS_REFILL_AMOUNT);
    });

    it('should clamp water to 100 maximum', () => {
      const playerPosition: Vector3 = { ...oasisPosition };
      const currentWater = 90;

      const result = manager.refillWater('player1', oasisId, currentWater, playerPosition);

      expect(result.success).toBe(true);
      expect(result.newWater).toBe(100); // Clamped from 140
    });

    it('should reject refill when player is too far', () => {
      const oasis = manager.getOasis(oasisId)!;
      const playerPosition: Vector3 = {
        x: oasisPosition.x + oasis.radius + 5,
        y: 0,
        z: oasisPosition.z + oasis.radius + 5,
      };
      const currentWater = 50;

      const result = manager.refillWater('player1', oasisId, currentWater, playerPosition);

      expect(result.success).toBe(false);
      expect(result.newWater).toBe(currentWater); // Unchanged
    });

    it('should allow refill at exactly radius distance (boundary)', () => {
      const oasis = manager.getOasis(oasisId)!;
      const playerPosition: Vector3 = {
        x: oasisPosition.x + oasis.radius,
        y: 0,
        z: oasisPosition.z,
      };
      const currentWater = 50;

      const result = manager.refillWater('player1', oasisId, currentWater, playerPosition);

      expect(result.success).toBe(true);
      expect(result.newWater).toBe(currentWater + ECONOMY_CONSTANTS.OASIS_REFILL_AMOUNT);
    });

    it('should reject refill at radius + 0.1m (boundary)', () => {
      const oasis = manager.getOasis(oasisId)!;
      const playerPosition: Vector3 = {
        x: oasisPosition.x + oasis.radius + 0.1,
        y: 0,
        z: oasisPosition.z,
      };
      const currentWater = 50;

      const result = manager.refillWater('player1', oasisId, currentWater, playerPosition);

      expect(result.success).toBe(false);
      expect(result.newWater).toBe(currentWater);
    });

    it('should reject refill when oasis does not exist', () => {
      const playerPosition: Vector3 = { x: 0, y: 0, z: 0 };
      const currentWater = 50;

      const result = manager.refillWater('player1', 'nonexistent-oasis', currentWater, playerPosition);

      expect(result.success).toBe(false);
      expect(result.newWater).toBe(currentWater);
    });

    it('should still refill when water is already at 100', () => {
      const playerPosition: Vector3 = { ...oasisPosition };
      const currentWater = 100;

      const result = manager.refillWater('player1', oasisId, currentWater, playerPosition);

      expect(result.success).toBe(true);
      expect(result.newWater).toBe(100); // No change but success
    });
  });

  describe('Cooldown System', () => {
    let oasisId: string;
    let oasisPosition: Vector3;

    beforeEach(() => {
      const oases = manager.generateOases();
      oasisId = oases[0].id;
      oasisPosition = oases[0].position;
    });

    it('should set cooldown after successful refill', () => {
      const playerPosition: Vector3 = { ...oasisPosition };

      vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));

      manager.refillWater('player1', oasisId, 50, playerPosition);

      const hasCooldown = manager.checkCooldown('player1', oasisId);

      expect(hasCooldown).toBe(true);
    });

    it('should reject refill when on cooldown', () => {
      const playerPosition: Vector3 = { ...oasisPosition };

      // First refill
      manager.refillWater('player1', oasisId, 50, playerPosition);

      // Try again immediately
      const result = manager.refillWater('player1', oasisId, 60, playerPosition);

      expect(result.success).toBe(false);
      expect(result.newWater).toBe(60); // Unchanged
    });

    it('should allow refill after cooldown expires', () => {
      const playerPosition: Vector3 = { ...oasisPosition };

      vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));

      // First refill
      manager.refillWater('player1', oasisId, 50, playerPosition);

      // Advance time past cooldown
      vi.advanceTimersByTime(ECONOMY_CONSTANTS.OASIS_COOLDOWN + 1000);

      // Try again
      const result = manager.refillWater('player1', oasisId, 50, playerPosition);

      expect(result.success).toBe(true);
      expect(result.newWater).toBe(100); // 50 + 50
    });

    it('should have separate cooldowns per player', () => {
      const playerPosition: Vector3 = { ...oasisPosition };

      // Player 1 refills
      manager.refillWater('player1', oasisId, 50, playerPosition);

      // Player 2 should be able to refill same oasis
      const result = manager.refillWater('player2', oasisId, 50, playerPosition);

      expect(result.success).toBe(true);
      expect(result.newWater).toBe(100);
    });

    it('should have separate cooldowns per oasis', () => {
      const oases = manager.getOases();
      const oasis1 = oases[0];
      const oasis2 = oases[1];

      // Refill at oasis 1
      manager.refillWater('player1', oasis1.id, 50, oasis1.position);

      // Should be able to refill at oasis 2
      const result = manager.refillWater('player1', oasis2.id, 50, oasis2.position);

      expect(result.success).toBe(true);
      expect(result.newWater).toBe(100);
    });

    it('should return cooldown remaining time', () => {
      const playerPosition: Vector3 = { ...oasisPosition };

      vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));

      manager.refillWater('player1', oasisId, 50, playerPosition);

      // Advance 1 minute
      vi.advanceTimersByTime(60000);

      const remaining = manager.getCooldownRemaining('player1', oasisId);

      // Should have ~4 minutes left (5min total - 1min elapsed)
      expect(remaining).toBeGreaterThanOrEqual(240000); // >= 4 min
      expect(remaining).toBeLessThanOrEqual(ECONOMY_CONSTANTS.OASIS_COOLDOWN);
    });

    it('should return 0 when no cooldown active', () => {
      const remaining = manager.getCooldownRemaining('player1', oasisId);

      expect(remaining).toBe(0);
    });

    it('should return 0 when cooldown has expired', () => {
      const playerPosition: Vector3 = { ...oasisPosition };

      manager.refillWater('player1', oasisId, 50, playerPosition);

      // Advance past cooldown
      vi.advanceTimersByTime(ECONOMY_CONSTANTS.OASIS_COOLDOWN + 1000);

      const remaining = manager.getCooldownRemaining('player1', oasisId);

      expect(remaining).toBe(0);
    });
  });

  describe('Query Methods', () => {
    beforeEach(() => {
      manager.generateOases();
    });

    it('should get all oases', () => {
      const oases = manager.getOases();

      expect(oases.length).toBeGreaterThanOrEqual(3);
      expect(oases.length).toBeLessThanOrEqual(5);
      expect(oases[0]).toHaveProperty('id');
      expect(oases[0]).toHaveProperty('position');
      expect(oases[0]).toHaveProperty('refillAmount');
    });

    it('should get specific oasis by ID', () => {
      const oases = manager.getOases();
      const oasisId = oases[0].id;

      const oasis = manager.getOasis(oasisId);

      expect(oasis).toBeDefined();
      expect(oasis!.id).toBe(oasisId);
    });

    it('should return undefined for non-existent oasis', () => {
      const oasis = manager.getOasis('nonexistent-oasis');

      expect(oasis).toBeUndefined();
    });

    it('should get nearest oasis to position', () => {
      const oases = manager.getOases();
      const targetPosition = oases[0].position;

      const nearest = manager.getNearestOasis(targetPosition);

      expect(nearest).toBeDefined();
      expect(nearest!.id).toBe(oases[0].id);
    });

    it('should calculate nearest oasis correctly', () => {
      const testPosition: Vector3 = { x: 0, y: 0, z: 0 };

      const nearest = manager.getNearestOasis(testPosition);

      expect(nearest).toBeDefined();

      // Verify it's actually the nearest
      const oases = manager.getOases();
      const distances = oases.map(oasis => {
        const dx = oasis.position.x - testPosition.x;
        const dz = oasis.position.z - testPosition.z;
        return Math.sqrt(dx * dx + dz * dz);
      });

      const minDistance = Math.min(...distances);
      const dx = nearest!.position.x - testPosition.x;
      const dz = nearest!.position.z - testPosition.z;
      const nearestDistance = Math.sqrt(dx * dx + dz * dz);

      expect(nearestDistance).toBe(minDistance);
    });

    it('should get oases within range', () => {
      const centerPosition: Vector3 = { x: 0, y: 0, z: 0 };
      const range = 200;

      const nearbyOases = manager.getOasesWithinRange(centerPosition, range);

      expect(Array.isArray(nearbyOases)).toBe(true);

      nearbyOases.forEach(oasis => {
        const dx = oasis.position.x - centerPosition.x;
        const dz = oasis.position.z - centerPosition.z;
        const distance = Math.sqrt(dx * dx + dz * dz);

        expect(distance).toBeLessThanOrEqual(range);
      });
    });

    it('should return empty array when no oases in range', () => {
      const farPosition: Vector3 = { x: 10000, y: 0, z: 10000 };
      const range = 10;

      const nearbyOases = manager.getOasesWithinRange(farPosition, range);

      expect(nearbyOases).toEqual([]);
    });
  });

  describe('Cooldown Cleanup', () => {
    let oasisId: string;
    let oasisPosition: Vector3;

    beforeEach(() => {
      const oases = manager.generateOases();
      oasisId = oases[0].id;
      oasisPosition = oases[0].position;
    });

    it('should clean up expired cooldowns', () => {
      const playerPosition: Vector3 = { ...oasisPosition };

      vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));

      // Create cooldown
      manager.refillWater('player1', oasisId, 50, playerPosition);

      // Advance past cooldown
      vi.advanceTimersByTime(ECONOMY_CONSTANTS.OASIS_COOLDOWN + 1000);

      // Trigger cleanup
      manager.cleanupExpiredCooldowns();

      // Check cooldown is gone
      const hasCooldown = manager.checkCooldown('player1', oasisId);

      expect(hasCooldown).toBe(false);
    });

    it('should keep active cooldowns during cleanup', () => {
      const playerPosition: Vector3 = { ...oasisPosition };

      manager.refillWater('player1', oasisId, 50, playerPosition);

      // Advance 1 minute (not expired)
      vi.advanceTimersByTime(60000);

      manager.cleanupExpiredCooldowns();

      const hasCooldown = manager.checkCooldown('player1', oasisId);

      expect(hasCooldown).toBe(true);
    });

    it('should handle cleanup with no cooldowns', () => {
      expect(() => {
        manager.cleanupExpiredCooldowns();
      }).not.toThrow();
    });

    it('should clean up cooldowns across multiple oases', () => {
      const oases = manager.getOases();

      vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));

      // Create cooldowns at all oases
      oases.forEach(oasis => {
        manager.refillWater('player1', oasis.id, 50, oasis.position);
      });

      // Advance past cooldown
      vi.advanceTimersByTime(ECONOMY_CONSTANTS.OASIS_COOLDOWN + 1000);

      manager.cleanupExpiredCooldowns();

      // All cooldowns should be cleared
      oases.forEach(oasis => {
        const hasCooldown = manager.checkCooldown('player1', oasis.id);
        expect(hasCooldown).toBe(false);
      });
    });
  });

  describe('Edge Cases', () => {
    let oasisId: string;
    let oasisPosition: Vector3;

    beforeEach(() => {
      const oases = manager.generateOases();
      oasisId = oases[0].id;
      oasisPosition = oases[0].position;
    });

    it('should handle negative water gracefully', () => {
      const playerPosition: Vector3 = { ...oasisPosition };
      const currentWater = -10;

      const result = manager.refillWater('player1', oasisId, currentWater, playerPosition);

      expect(result.success).toBe(true);
      expect(result.newWater).toBeGreaterThan(0);
    });

    it('should handle water > 100 gracefully', () => {
      const playerPosition: Vector3 = { ...oasisPosition };
      const currentWater = 150;

      const result = manager.refillWater('player1', oasisId, currentWater, playerPosition);

      expect(result.success).toBe(true);
      expect(result.newWater).toBe(100); // Clamped
    });

    it('should handle multiple refills by same player at different oases', () => {
      const oases = manager.getOases();

      let water = 0;
      oases.forEach(oasis => {
        const result = manager.refillWater('player1', oasis.id, water, oasis.position);
        expect(result.success).toBe(true);
        water = result.newWater;
      });

      expect(water).toBe(100); // Eventually maxed out
    });

    it('should handle very large distances', () => {
      const farPosition: Vector3 = {
        x: oasisPosition.x + 1000000,
        y: 0,
        z: oasisPosition.z + 1000000,
      };

      const result = manager.refillWater('player1', oasisId, 50, farPosition);

      expect(result.success).toBe(false);
    });

    it('should handle position at oasis center', () => {
      const playerPosition: Vector3 = { ...oasisPosition };

      const result = manager.refillWater('player1', oasisId, 50, playerPosition);

      expect(result.success).toBe(true);
    });
  });

  describe('Realistic Gameplay Scenarios', () => {
    it('should allow player to visit all oases without cooldown conflicts', () => {
      manager.generateOases();
      const oases = manager.getOases();
      let water = 0;

      oases.forEach(oasis => {
        const result = manager.refillWater('player1', oasis.id, water, oasis.position);
        expect(result.success).toBe(true);
        water = result.newWater;
      });

      // After visiting 4 oases: 0 + 50 + 50 + 50 + 50 = 200, clamped to 100
      expect(water).toBe(100);
    });

    it('should simulate player returning to oasis after cooldown', () => {
      const oases = manager.generateOases();
      const oasis = oases[0];
      const playerPosition: Vector3 = { ...oasis.position };

      vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));

      // First visit
      const result1 = manager.refillWater('player1', oasis.id, 30, playerPosition);
      expect(result1.success).toBe(true);
      expect(result1.newWater).toBe(80);

      // Try to visit again immediately (should fail)
      const result2 = manager.refillWater('player1', oasis.id, 30, playerPosition);
      expect(result2.success).toBe(false);

      // Wait 5 minutes
      vi.advanceTimersByTime(ECONOMY_CONSTANTS.OASIS_COOLDOWN + 1000);

      // Visit again (should succeed)
      const result3 = manager.refillWater('player1', oasis.id, 30, playerPosition);
      expect(result3.success).toBe(true);
      expect(result3.newWater).toBe(80);
    });

    it('should simulate multiple players at same oasis', () => {
      const oases = manager.generateOases();
      const oasis = oases[0];
      const playerPosition: Vector3 = { ...oasis.position };

      const players = ['player1', 'player2', 'player3', 'player4', 'player5'];

      players.forEach(playerId => {
        const result = manager.refillWater(playerId, oasis.id, 50, playerPosition);
        expect(result.success).toBe(true);
        expect(result.newWater).toBe(100);
      });

      // All players should now have cooldowns
      players.forEach(playerId => {
        const hasCooldown = manager.checkCooldown(playerId, oasis.id);
        expect(hasCooldown).toBe(true);
      });
    });

    it('should simulate oasis hopping strategy', () => {
      manager.generateOases();
      const oases = manager.getOases();
      let water = 10; // Low water

      vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));

      // Visit each oasis in sequence
      oases.forEach((oasis, index) => {
        const result = manager.refillWater('player1', oasis.id, water, oasis.position);
        expect(result.success).toBe(true);

        water = result.newWater;

        // After first oasis, water should be refilled
        if (index === 0) {
          expect(water).toBe(60); // 10 + 50
        }
      });

      // Should reach max water
      expect(water).toBe(100);

      // All oases should be on cooldown
      oases.forEach(oasis => {
        const hasCooldown = manager.checkCooldown('player1', oasis.id);
        expect(hasCooldown).toBe(true);
      });
    });
  });
});
