import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { CombatSystem, WeaponType } from './CombatSystem';
import type { Vector3 } from '@fremen/shared';

describe('VS4: Combat System', () => {
  let combat: CombatSystem;

  beforeEach(() => {
    combat = new CombatSystem();
    vi.spyOn(Math, 'random');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Weapon Stats', () => {
    it('should return player rifle stats', () => {
      const stats = combat.getWeaponStats(WeaponType.PLAYER_RIFLE);

      expect(stats.damage).toBe(25);
      expect(stats.fireRate).toBe(500);
      expect(stats.range).toBe(100);
      expect(stats.accuracy).toBe(0.9);
    });

    it('should return Harkonnen rifle stats', () => {
      const stats = combat.getWeaponStats(WeaponType.HARKONNEN_RIFLE);

      expect(stats.damage).toBe(20);
      expect(stats.fireRate).toBe(1000);
      expect(stats.range).toBe(80);
      expect(stats.accuracy).toBe(0.85);
    });

    it('should return a copy of weapon stats (not reference)', () => {
      const stats1 = combat.getWeaponStats(WeaponType.PLAYER_RIFLE);
      const stats2 = combat.getWeaponStats(WeaponType.PLAYER_RIFLE);

      stats1.damage = 999;

      expect(stats2.damage).toBe(25);
    });
  });

  describe('Hit Chance Calculation', () => {
    it('should return 100% hit chance at point blank', () => {
      const hitChance = combat.calculateHitChance(0, 100, 0.9);

      expect(hitChance).toBe(1.0);
    });

    it('should return base accuracy at max range', () => {
      const hitChance = combat.calculateHitChance(100, 100, 0.9);

      expect(hitChance).toBe(0.9);
    });

    it('should return 0% hit chance beyond max range', () => {
      const hitChance = combat.calculateHitChance(150, 100, 0.9);

      expect(hitChance).toBe(0);
    });

    it('should have linear falloff between close and max range', () => {
      const hitChance50 = combat.calculateHitChance(50, 100, 0.9);

      // At 50% range: 1 - (0.5 * 0.1) = 0.95
      expect(hitChance50).toBe(0.95);
    });

    it('should handle 100% accuracy weapons', () => {
      const hitChance = combat.calculateHitChance(100, 100, 1.0);

      expect(hitChance).toBe(1.0);
    });

    it('should clamp hit chance to 0-1 range', () => {
      const lowChance = combat.calculateHitChance(200, 100, 0.9);
      const highChance = combat.calculateHitChance(0, 100, 1.5);

      expect(lowChance).toBeGreaterThanOrEqual(0);
      expect(lowChance).toBeLessThanOrEqual(1);
      expect(highChance).toBeGreaterThanOrEqual(0);
      expect(highChance).toBeLessThanOrEqual(1);
    });
  });

  describe('Hit Detection', () => {
    const shooterPos: Vector3 = { x: 0, y: 0, z: 0 };
    const targetPos: Vector3 = { x: 50, y: 0, z: 0 };

    it('should miss when target out of range', () => {
      const farTarget: Vector3 = { x: 200, y: 0, z: 0 };

      const result = combat.checkHit(shooterPos, farTarget, WeaponType.PLAYER_RIFLE);

      expect(result.hit).toBe(false);
      expect(result.damage).toBe(0);
      expect(result.distance).toBe(200);
    });

    it('should miss when no line of sight', () => {
      const result = combat.checkHit(shooterPos, targetPos, WeaponType.PLAYER_RIFLE, false);

      expect(result.hit).toBe(false);
      expect(result.damage).toBe(0);
    });

    it('should hit when random roll succeeds', () => {
      (Math.random as any).mockReturnValue(0.5); // 50% roll

      const result = combat.checkHit(shooterPos, targetPos, WeaponType.PLAYER_RIFLE);

      expect(result.hit).toBe(true);
      expect(result.damage).toBe(25);
    });

    it('should miss when random roll fails', () => {
      (Math.random as any).mockReturnValue(0.99); // 99% roll (above hit chance)

      const result = combat.checkHit(shooterPos, targetPos, WeaponType.PLAYER_RIFLE);

      expect(result.hit).toBe(false);
      expect(result.damage).toBe(0);
    });

    it('should calculate correct distance', () => {
      const result = combat.checkHit(shooterPos, targetPos, WeaponType.PLAYER_RIFLE);

      expect(result.distance).toBe(50);
    });

    it('should calculate 3D distance correctly', () => {
      const target3D: Vector3 = { x: 30, y: 40, z: 0 };

      const result = combat.checkHit(shooterPos, target3D, WeaponType.PLAYER_RIFLE);

      expect(result.distance).toBe(50); // 3-4-5 triangle
    });
  });

  describe('Player Shooting', () => {
    const shooterPos: Vector3 = { x: 0, y: 0, z: 0 };
    const targetPos: Vector3 = { x: 30, y: 0, z: 0 };

    it('should successfully shoot at Harkonnen', () => {
      (Math.random as any).mockReturnValue(0.5);

      const result = combat.playerShoot(shooterPos, targetPos, 'harkonnen-1');

      expect(result.hit).toBe(true);
      expect(result.damage).toBe(25);
      expect(result.targetId).toBe('harkonnen-1');
      expect(result.distance).toBe(30);
    });

    it('should not include targetId on miss', () => {
      (Math.random as any).mockReturnValue(0.99);

      const result = combat.playerShoot(shooterPos, targetPos, 'harkonnen-1');

      expect(result.hit).toBe(false);
      expect(result.targetId).toBeUndefined();
    });

    it('should use player rifle stats', () => {
      const farTarget: Vector3 = { x: 150, y: 0, z: 0 };

      const result = combat.playerShoot(shooterPos, farTarget, 'harkonnen-1');

      // Beyond player rifle range (100m)
      expect(result.hit).toBe(false);
    });
  });

  describe('Harkonnen Shooting', () => {
    const shooterPos: Vector3 = { x: 0, y: 0, z: 0 };
    const targetPos: Vector3 = { x: 30, y: 0, z: 0 };

    it('should successfully shoot at player', () => {
      (Math.random as any).mockReturnValue(0.5);

      const result = combat.harkonnenShoot(shooterPos, targetPos, 'player-1');

      expect(result.hit).toBe(true);
      expect(result.damage).toBe(20);
      expect(result.targetId).toBe('player-1');
      expect(result.distance).toBe(30);
    });

    it('should not include targetId on miss', () => {
      (Math.random as any).mockReturnValue(0.99);

      const result = combat.harkonnenShoot(shooterPos, targetPos, 'player-1');

      expect(result.hit).toBe(false);
      expect(result.targetId).toBeUndefined();
    });

    it('should use Harkonnen rifle stats', () => {
      const farTarget: Vector3 = { x: 90, y: 0, z: 0 };

      const result = combat.harkonnenShoot(shooterPos, farTarget, 'player-1');

      // Beyond Harkonnen rifle range (80m)
      expect(result.hit).toBe(false);
    });
  });

  describe('Damage Calculation', () => {
    it('should calculate base damage', () => {
      const damage = combat.calculateDamage(25, 1.0);

      expect(damage).toBe(25);
    });

    it('should apply damage modifier', () => {
      const damage = combat.calculateDamage(25, 2.0);

      expect(damage).toBe(50);
    });

    it('should reduce damage with modifier < 1', () => {
      const damage = combat.calculateDamage(25, 0.5);

      expect(damage).toBe(12);
    });

    it('should floor damage to integer', () => {
      const damage = combat.calculateDamage(25, 0.6);

      expect(damage).toBe(15);
    });

    it('should not allow negative damage', () => {
      const damage = combat.calculateDamage(25, -1.0);

      expect(damage).toBe(0);
    });
  });

  describe('Damage Application', () => {
    it('should apply damage to target', () => {
      const result = combat.applyDamage(100, 25, 'target-1');

      expect(result.targetId).toBe('target-1');
      expect(result.damageTaken).toBe(25);
      expect(result.healthRemaining).toBe(75);
      expect(result.killed).toBe(false);
    });

    it('should kill target when health reaches 0', () => {
      const result = combat.applyDamage(25, 25, 'target-1');

      expect(result.healthRemaining).toBe(0);
      expect(result.killed).toBe(true);
    });

    it('should kill target when damage exceeds health', () => {
      const result = combat.applyDamage(25, 50, 'target-1');

      expect(result.damageTaken).toBe(25); // Only took remaining health
      expect(result.healthRemaining).toBe(0);
      expect(result.killed).toBe(true);
    });

    it('should not reduce health below 0', () => {
      const result = combat.applyDamage(10, 100, 'target-1');

      expect(result.healthRemaining).toBe(0);
    });

    it('should handle zero damage', () => {
      const result = combat.applyDamage(100, 0, 'target-1');

      expect(result.damageTaken).toBe(0);
      expect(result.healthRemaining).toBe(100);
      expect(result.killed).toBe(false);
    });
  });

  describe('Fire Rate Cooldown', () => {
    it('should allow fire when cooldown elapsed (player)', () => {
      const canFire = combat.canFire(WeaponType.PLAYER_RIFLE, 1000, 1600);

      expect(canFire).toBe(true); // 600ms > 500ms fire rate
    });

    it('should prevent fire when cooldown not elapsed (player)', () => {
      const canFire = combat.canFire(WeaponType.PLAYER_RIFLE, 1000, 1400);

      expect(canFire).toBe(false); // 400ms < 500ms fire rate
    });

    it('should allow fire when cooldown elapsed (Harkonnen)', () => {
      const canFire = combat.canFire(WeaponType.HARKONNEN_RIFLE, 1000, 2100);

      expect(canFire).toBe(true); // 1100ms > 1000ms fire rate
    });

    it('should prevent fire when cooldown not elapsed (Harkonnen)', () => {
      const canFire = combat.canFire(WeaponType.HARKONNEN_RIFLE, 1000, 1900);

      expect(canFire).toBe(false); // 900ms < 1000ms fire rate
    });

    it('should allow fire at exact cooldown time', () => {
      const canFire = combat.canFire(WeaponType.PLAYER_RIFLE, 1000, 1500);

      expect(canFire).toBe(true); // 500ms == 500ms fire rate
    });
  });

  describe('Line of Sight', () => {
    it('should return true for clear line of sight', () => {
      const from: Vector3 = { x: 0, y: 0, z: 0 };
      const to: Vector3 = { x: 50, y: 0, z: 0 };

      const hasLOS = combat.hasLineOfSight(from, to);

      expect(hasLOS).toBe(true);
    });

    it('should handle vertical line of sight', () => {
      const from: Vector3 = { x: 0, y: 0, z: 0 };
      const to: Vector3 = { x: 0, y: 50, z: 0 };

      const hasLOS = combat.hasLineOfSight(from, to);

      expect(hasLOS).toBe(true); // TODO: Will check terrain in future
    });
  });

  describe('Shoot Direction', () => {
    it('should calculate direction vector to target', () => {
      const from: Vector3 = { x: 0, y: 0, z: 0 };
      const to: Vector3 = { x: 10, y: 0, z: 0 };

      const direction = combat.getShootDirection(from, to);

      expect(direction.x).toBe(1);
      expect(direction.y).toBe(0);
      expect(direction.z).toBe(0);
    });

    it('should normalize direction vector', () => {
      const from: Vector3 = { x: 0, y: 0, z: 0 };
      const to: Vector3 = { x: 3, y: 4, z: 0 };

      const direction = combat.getShootDirection(from, to);

      expect(direction.x).toBe(0.6);
      expect(direction.y).toBe(0.8);
      expect(direction.z).toBe(0);
    });

    it('should handle 3D direction vectors', () => {
      const from: Vector3 = { x: 0, y: 0, z: 0 };
      const to: Vector3 = { x: 1, y: 1, z: 1 };

      const direction = combat.getShootDirection(from, to);
      const length = Math.sqrt(
        direction.x * direction.x +
        direction.y * direction.y +
        direction.z * direction.z
      );

      expect(length).toBeCloseTo(1, 5); // Normalized
    });

    it('should handle zero vector (same position)', () => {
      const from: Vector3 = { x: 0, y: 0, z: 0 };
      const to: Vector3 = { x: 0, y: 0, z: 0 };

      const direction = combat.getShootDirection(from, to);

      expect(direction.x).toBe(0);
      expect(direction.y).toBe(0);
      expect(direction.z).toBe(0);
    });

    it('should handle negative directions', () => {
      const from: Vector3 = { x: 10, y: 0, z: 0 };
      const to: Vector3 = { x: 0, y: 0, z: 0 };

      const direction = combat.getShootDirection(from, to);

      expect(direction.x).toBe(-1);
      expect(direction.y).toBe(0);
      expect(direction.z).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle shooting at same position', () => {
      const pos: Vector3 = { x: 0, y: 0, z: 0 };
      (Math.random as any).mockReturnValue(0.5);

      const result = combat.playerShoot(pos, pos, 'target-1');

      expect(result.distance).toBe(0);
      expect(result.hit).toBe(true); // Point blank
    });

    it('should handle very small distances', () => {
      const from: Vector3 = { x: 0, y: 0, z: 0 };
      const to: Vector3 = { x: 0.1, y: 0, z: 0 };
      (Math.random as any).mockReturnValue(0.5);

      const result = combat.playerShoot(from, to, 'target-1');

      expect(result.distance).toBeCloseTo(0.1, 2);
      expect(result.hit).toBe(true);
    });

    it('should handle very large distances', () => {
      const from: Vector3 = { x: 0, y: 0, z: 0 };
      const to: Vector3 = { x: 10000, y: 0, z: 0 };

      const result = combat.playerShoot(from, to, 'target-1');

      expect(result.hit).toBe(false);
      expect(result.distance).toBe(10000);
    });

    it('should handle negative coordinates', () => {
      const from: Vector3 = { x: -50, y: -50, z: -50 };
      const to: Vector3 = { x: -20, y: -50, z: -50 };

      const result = combat.checkHit(from, to, WeaponType.PLAYER_RIFLE);

      expect(result.distance).toBe(30);
    });

    it('should handle zero health target', () => {
      const result = combat.applyDamage(0, 25, 'target-1');

      expect(result.damageTaken).toBe(0);
      expect(result.healthRemaining).toBe(0);
      expect(result.killed).toBe(true);
    });

    it('should handle very high health target', () => {
      const result = combat.applyDamage(100000, 25, 'target-1');

      expect(result.damageTaken).toBe(25);
      expect(result.healthRemaining).toBe(99975);
      expect(result.killed).toBe(false);
    });
  });

  describe('Realistic Combat Scenarios', () => {
    it('should simulate player killing Harkonnen in 4 shots', () => {
      let harkonnenHealth = 100;
      const shooterPos: Vector3 = { x: 0, y: 0, z: 0 };
      const targetPos: Vector3 = { x: 30, y: 0, z: 0 };

      (Math.random as any).mockReturnValue(0.5); // Always hit

      for (let i = 0; i < 4; i++) {
        const shootResult = combat.playerShoot(shooterPos, targetPos, 'harkonnen-1');
        if (shootResult.hit) {
          const damageResult = combat.applyDamage(harkonnenHealth, shootResult.damage, 'harkonnen-1');
          harkonnenHealth = damageResult.healthRemaining;
        }
      }

      expect(harkonnenHealth).toBe(0); // 4 * 25 = 100
    });

    it('should simulate Harkonnen killing player in 5 shots', () => {
      let playerHealth = 100;
      const shooterPos: Vector3 = { x: 0, y: 0, z: 0 };
      const targetPos: Vector3 = { x: 30, y: 0, z: 0 };

      (Math.random as any).mockReturnValue(0.5); // Always hit

      for (let i = 0; i < 5; i++) {
        const shootResult = combat.harkonnenShoot(shooterPos, targetPos, 'player-1');
        if (shootResult.hit) {
          const damageResult = combat.applyDamage(playerHealth, shootResult.damage, 'player-1');
          playerHealth = damageResult.healthRemaining;
        }
      }

      expect(playerHealth).toBe(0); // 5 * 20 = 100
    });

    it('should simulate firefight with varying hit rates', () => {
      let playerHealth = 100;
      let harkonnenHealth = 100;
      const playerPos: Vector3 = { x: 0, y: 0, z: 0 };
      const harkonnenPos: Vector3 = { x: 50, y: 0, z: 0 };

      const rolls = [0.2, 0.9, 0.3, 0.8, 0.4, 0.7, 0.5, 0.6]; // Alternating hits/misses

      for (let i = 0; i < 4; i++) {
        // Player shoots
        (Math.random as any).mockReturnValue(rolls[i * 2]);
        const playerShot = combat.playerShoot(playerPos, harkonnenPos, 'harkonnen-1');
        if (playerShot.hit) {
          const result = combat.applyDamage(harkonnenHealth, playerShot.damage, 'harkonnen-1');
          harkonnenHealth = result.healthRemaining;
        }

        // Harkonnen shoots back
        (Math.random as any).mockReturnValue(rolls[i * 2 + 1]);
        const harkonnenShot = combat.harkonnenShoot(harkonnenPos, playerPos, 'player-1');
        if (harkonnenShot.hit) {
          const result = combat.applyDamage(playerHealth, harkonnenShot.damage, 'player-1');
          playerHealth = result.healthRemaining;
        }
      }

      // At 50m: Player hit chance = 0.95, Harkonnen hit chance = 0.90625
      // All rolls below hit chance, so all 4 shots from each side hit
      // Player hits 4 times: 4 * 25 = 100 damage (Harkonnen killed)
      // Harkonnen hits 4 times: 4 * 20 = 80 damage
      expect(harkonnenHealth).toBe(0);
      expect(playerHealth).toBe(20);
    });

    it('should prevent firing during cooldown period', () => {
      let currentTime = 1000;
      const lastFireTime = 1000;

      // Try to fire immediately (should fail)
      let canFire = combat.canFire(WeaponType.PLAYER_RIFLE, lastFireTime, currentTime);
      expect(canFire).toBe(false);

      // Advance time by 500ms (should succeed)
      currentTime += 500;
      canFire = combat.canFire(WeaponType.PLAYER_RIFLE, lastFireTime, currentTime);
      expect(canFire).toBe(true);
    });
  });
});
