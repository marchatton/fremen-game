import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { DeathManager } from './DeathManager.js';
import type { Vector3, PlayerStats } from '@fremen/shared';

describe('VS3: Death & Respawn System', () => {
  let manager: DeathManager;

  beforeEach(() => {
    manager = new DeathManager();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Death Detection', () => {
    it('should detect death when water reaches 0', () => {
      const isDead = manager.checkDeath(0);

      expect(isDead).toBe(true);
    });

    it('should detect death when water is negative', () => {
      const isDead = manager.checkDeath(-10);

      expect(isDead).toBe(true);
    });

    it('should not detect death when water is above 0', () => {
      const isDead = manager.checkDeath(1);

      expect(isDead).toBe(false);
    });

    it('should not detect death at full water', () => {
      const isDead = manager.checkDeath(100);

      expect(isDead).toBe(false);
    });
  });

  describe('Spice Penalty', () => {
    it('should calculate 20% spice penalty', () => {
      const penalty = manager.calculateSpicePenalty(100);

      expect(penalty).toBe(20);
    });

    it('should round down spice penalty', () => {
      const penalty = manager.calculateSpicePenalty(105);

      expect(penalty).toBe(21); // 20% of 105 = 21
    });

    it('should handle 0 spice', () => {
      const penalty = manager.calculateSpicePenalty(0);

      expect(penalty).toBe(0);
    });

    it('should handle small spice amounts', () => {
      const penalty = manager.calculateSpicePenalty(3);

      expect(penalty).toBe(0); // 20% of 3 = 0.6, floored to 0
    });

    it('should handle large spice amounts', () => {
      const penalty = manager.calculateSpicePenalty(10000);

      expect(penalty).toBe(2000);
    });
  });

  describe('Corpse Marker Creation', () => {
    it('should create corpse marker at death location', () => {
      const deathPosition: Vector3 = { x: 100, y: 0, z: 200 };
      const playerId = 'player-1';
      const spiceDrop = 50;

      const corpseId = manager.createCorpseMarker(playerId, deathPosition, spiceDrop);

      expect(corpseId).toBeDefined();
      expect(typeof corpseId).toBe('string');
    });

    it('should store corpse with correct spice amount', () => {
      const corpseId = manager.createCorpseMarker('player-1', { x: 0, y: 0, z: 0 }, 75);

      const corpse = manager.getCorpseMarker(corpseId);

      expect(corpse).toBeDefined();
      expect(corpse!.spiceAmount).toBe(75);
    });

    it('should store corpse with correct position', () => {
      const position: Vector3 = { x: 123, y: 0, z: 456 };
      const corpseId = manager.createCorpseMarker('player-1', position, 50);

      const corpse = manager.getCorpseMarker(corpseId);

      expect(corpse!.position).toEqual(position);
    });

    it('should store corpse with player ID', () => {
      const corpseId = manager.createCorpseMarker('player-abc', { x: 0, y: 0, z: 0 }, 50);

      const corpse = manager.getCorpseMarker(corpseId);

      expect(corpse!.playerId).toBe('player-abc');
    });

    it('should create multiple corpse markers', () => {
      const corpse1 = manager.createCorpseMarker('player-1', { x: 0, y: 0, z: 0 }, 50);
      const corpse2 = manager.createCorpseMarker('player-2', { x: 100, y: 0, z: 100 }, 30);

      expect(corpse1).not.toBe(corpse2);
      expect(manager.getCorpseMarker(corpse1)).toBeDefined();
      expect(manager.getCorpseMarker(corpse2)).toBeDefined();
    });
  });

  describe('Corpse Expiration', () => {
    it('should expire corpse after 2 minutes', () => {
      const corpseId = manager.createCorpseMarker('player-1', { x: 0, y: 0, z: 0 }, 50);

      // Advance time by 2 minutes
      vi.advanceTimersByTime(2 * 60 * 1000);

      const corpse = manager.getCorpseMarker(corpseId);

      expect(corpse).toBeUndefined();
    });

    it('should not expire corpse before 2 minutes', () => {
      const corpseId = manager.createCorpseMarker('player-1', { x: 0, y: 0, z: 0 }, 50);

      // Advance time by 1 minute
      vi.advanceTimersByTime(1 * 60 * 1000);

      const corpse = manager.getCorpseMarker(corpseId);

      expect(corpse).toBeDefined();
    });

    it('should expire corpse at exactly 2 minutes', () => {
      const corpseId = manager.createCorpseMarker('player-1', { x: 0, y: 0, z: 0 }, 50);

      vi.advanceTimersByTime(2 * 60 * 1000);

      const corpse = manager.getCorpseMarker(corpseId);

      expect(corpse).toBeUndefined();
    });

    it('should clean up expired corpses independently', () => {
      const corpse1 = manager.createCorpseMarker('player-1', { x: 0, y: 0, z: 0 }, 50);

      vi.advanceTimersByTime(1 * 60 * 1000); // 1 minute

      const corpse2 = manager.createCorpseMarker('player-2', { x: 100, y: 0, z: 100 }, 30);

      vi.advanceTimersByTime(1 * 60 * 1000); // Another minute (total 2 for corpse1, 1 for corpse2)

      expect(manager.getCorpseMarker(corpse1)).toBeUndefined();
      expect(manager.getCorpseMarker(corpse2)).toBeDefined();
    });
  });

  describe('Corpse Recovery', () => {
    it('should allow player to recover their corpse', () => {
      const playerId = 'player-1';
      const corpseId = manager.createCorpseMarker(playerId, { x: 100, y: 0, z: 100 }, 50);
      const playerPosition: Vector3 = { x: 100, y: 0, z: 100 };

      const result = manager.recoverCorpse(playerId, corpseId, playerPosition);

      expect(result.success).toBe(true);
      expect(result.spiceRecovered).toBe(50);
    });

    it('should remove corpse after recovery', () => {
      const playerId = 'player-1';
      const corpseId = manager.createCorpseMarker(playerId, { x: 100, y: 0, z: 100 }, 50);

      manager.recoverCorpse(playerId, corpseId, { x: 100, y: 0, z: 100 });

      const corpse = manager.getCorpseMarker(corpseId);
      expect(corpse).toBeUndefined();
    });

    it('should reject recovery when corpse does not exist', () => {
      const result = manager.recoverCorpse('player-1', 'nonexistent-corpse', { x: 0, y: 0, z: 0 });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should reject recovery from different player', () => {
      const corpseId = manager.createCorpseMarker('player-1', { x: 100, y: 0, z: 100 }, 50);

      const result = manager.recoverCorpse('player-2', corpseId, { x: 100, y: 0, z: 100 });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not your corpse');
    });

    it('should reject recovery when too far away', () => {
      const corpseId = manager.createCorpseMarker('player-1', { x: 0, y: 0, z: 0 }, 50);
      const farPosition: Vector3 = { x: 100, y: 0, z: 100 };

      const result = manager.recoverCorpse('player-1', corpseId, farPosition);

      expect(result.success).toBe(false);
      expect(result.error).toContain('too far');
    });

    it('should allow recovery within 5m range', () => {
      const corpseId = manager.createCorpseMarker('player-1', { x: 0, y: 0, z: 0 }, 50);
      const nearPosition: Vector3 = { x: 4, y: 0, z: 0 };

      const result = manager.recoverCorpse('player-1', corpseId, nearPosition);

      expect(result.success).toBe(true);
    });

    it('should handle recovery at exact 5m boundary', () => {
      const corpseId = manager.createCorpseMarker('player-1', { x: 0, y: 0, z: 0 }, 50);
      const boundaryPosition: Vector3 = { x: 3, y: 0, z: 4 }; // 3-4-5 triangle = 5m

      const result = manager.recoverCorpse('player-1', corpseId, boundaryPosition);

      expect(result.success).toBe(true);
    });
  });

  describe('Respawn System', () => {
    it('should respawn player at Sietch', () => {
      const respawnData = manager.getRespawnData();

      expect(respawnData.position).toEqual({ x: 0, y: 0, z: 0 });
    });

    it('should respawn with 50 water', () => {
      const respawnData = manager.getRespawnData();

      expect(respawnData.water).toBe(50);
    });

    it('should respawn with 100 health', () => {
      const respawnData = manager.getRespawnData();

      expect(respawnData.health).toBe(100);
    });
  });

  describe('Process Death', () => {
    it('should handle complete death process', () => {
      const playerId = 'player-1';
      const deathPosition: Vector3 = { x: 100, y: 0, z: 200 };
      const spice = 100;
      const stats: PlayerStats = {
        objectivesCompleted: 5,
        totalSpiceEarned: 500,
        distanceTraveled: 1000,
        deaths: 2,
        wormsRidden: 3,
        outpostsCaptured: 0,
      };

      const result = manager.processDeath(playerId, deathPosition, spice, stats);

      expect(result.corpseId).toBeDefined();
      expect(result.spiceLost).toBe(20); // 20% of 100
      expect(result.spiceRemaining).toBe(80);
      expect(result.respawnPosition).toEqual({ x: 0, y: 0, z: 0 });
      expect(result.respawnWater).toBe(50);
      expect(result.respawnHealth).toBe(100);
      expect(result.newStats.deaths).toBe(3);
    });

    it('should create corpse marker during death process', () => {
      const result = manager.processDeath('player-1', { x: 100, y: 0, z: 100 }, 100, {
        objectivesCompleted: 0,
        totalSpiceEarned: 0,
        distanceTraveled: 0,
        deaths: 0,
        wormsRidden: 0,
        outpostsCaptured: 0,
      });

      const corpse = manager.getCorpseMarker(result.corpseId);

      expect(corpse).toBeDefined();
      expect(corpse!.spiceAmount).toBe(20);
    });

    it('should increment death stat', () => {
      const stats: PlayerStats = {
        objectivesCompleted: 0,
        totalSpiceEarned: 0,
        distanceTraveled: 0,
        deaths: 5,
        wormsRidden: 0,
        outpostsCaptured: 0,
      };

      const result = manager.processDeath('player-1', { x: 0, y: 0, z: 0 }, 0, stats);

      expect(result.newStats.deaths).toBe(6);
    });

    it('should preserve other stats', () => {
      const stats: PlayerStats = {
        objectivesCompleted: 10,
        totalSpiceEarned: 500,
        distanceTraveled: 2000,
        deaths: 2,
        wormsRidden: 8,
        outpostsCaptured: 0,
      };

      const result = manager.processDeath('player-1', { x: 0, y: 0, z: 0 }, 0, stats);

      expect(result.newStats.objectivesCompleted).toBe(10);
      expect(result.newStats.totalSpiceEarned).toBe(500);
      expect(result.newStats.distanceTraveled).toBe(2000);
      expect(result.newStats.wormsRidden).toBe(8);
    });
  });

  describe('Corpse Query Methods', () => {
    it('should get all active corpses', () => {
      manager.createCorpseMarker('player-1', { x: 0, y: 0, z: 0 }, 50);
      manager.createCorpseMarker('player-2', { x: 100, y: 0, z: 100 }, 30);

      const corpses = manager.getAllActiveCorpses();

      expect(corpses.length).toBe(2);
    });

    it('should get corpses for specific player', () => {
      manager.createCorpseMarker('player-1', { x: 0, y: 0, z: 0 }, 50);
      manager.createCorpseMarker('player-1', { x: 100, y: 0, z: 100 }, 30);
      manager.createCorpseMarker('player-2', { x: 200, y: 0, z: 200 }, 20);

      const corpses = manager.getPlayerCorpses('player-1');

      expect(corpses.length).toBe(2);
      expect(corpses.every(c => c.playerId === 'player-1')).toBe(true);
    });

    it('should return empty array when no corpses exist', () => {
      const corpses = manager.getAllActiveCorpses();

      expect(corpses).toEqual([]);
    });

    it('should return empty array when player has no corpses', () => {
      manager.createCorpseMarker('player-1', { x: 0, y: 0, z: 0 }, 50);

      const corpses = manager.getPlayerCorpses('player-2');

      expect(corpses).toEqual([]);
    });
  });

  describe('Edge Cases', () => {
    it('should handle death with 0 spice', () => {
      const result = manager.processDeath('player-1', { x: 0, y: 0, z: 0 }, 0, {
        objectivesCompleted: 0,
        totalSpiceEarned: 0,
        distanceTraveled: 0,
        deaths: 0,
        wormsRidden: 0,
        outpostsCaptured: 0,
      });

      expect(result.spiceLost).toBe(0);
      expect(result.spiceRemaining).toBe(0);
    });

    it('should handle negative water in death check', () => {
      const isDead = manager.checkDeath(-100);

      expect(isDead).toBe(true);
    });

    it('should handle very large spice amounts', () => {
      const penalty = manager.calculateSpicePenalty(999999);

      expect(penalty).toBe(199999); // 20% rounded down
    });

    it('should handle corpse recovery with 0 spice', () => {
      const corpseId = manager.createCorpseMarker('player-1', { x: 0, y: 0, z: 0 }, 0);

      const result = manager.recoverCorpse('player-1', corpseId, { x: 0, y: 0, z: 0 });

      expect(result.success).toBe(true);
      expect(result.spiceRecovered).toBe(0);
    });
  });

  describe('Realistic Gameplay Scenarios', () => {
    it('should simulate player dying in desert and respawning', () => {
      const playerId = 'player-1';
      const deathPosition: Vector3 = { x: 500, y: 0, z: 300 };
      const spice = 200;
      const stats: PlayerStats = {
        objectivesCompleted: 10,
        totalSpiceEarned: 500,
        distanceTraveled: 2000,
        deaths: 0,
        wormsRidden: 5,
        outpostsCaptured: 0,
      };

      // Player dies
      const deathResult = manager.processDeath(playerId, deathPosition, spice, stats);

      expect(deathResult.spiceLost).toBe(40); // 20% of 200
      expect(deathResult.spiceRemaining).toBe(160);
      expect(deathResult.newStats.deaths).toBe(1);

      // Player respawns at Sietch
      expect(deathResult.respawnPosition).toEqual({ x: 0, y: 0, z: 0 });
      expect(deathResult.respawnWater).toBe(50);
      expect(deathResult.respawnHealth).toBe(100);

      // Corpse exists
      const corpse = manager.getCorpseMarker(deathResult.corpseId);
      expect(corpse).toBeDefined();
      expect(corpse!.spiceAmount).toBe(40);
    });

    it('should simulate player recovering their corpse', () => {
      const playerId = 'player-1';
      let spice = 100;

      // Player dies
      const deathResult = manager.processDeath(playerId, { x: 300, y: 0, z: 400 }, spice, {
        objectivesCompleted: 0,
        totalSpiceEarned: 0,
        distanceTraveled: 0,
        deaths: 0,
        wormsRidden: 0,
        outpostsCaptured: 0,
      });

      spice = deathResult.spiceRemaining; // 80

      // Player travels back to corpse
      const recoveryResult = manager.recoverCorpse(playerId, deathResult.corpseId, { x: 300, y: 0, z: 400 });

      expect(recoveryResult.success).toBe(true);
      expect(recoveryResult.spiceRecovered).toBe(20);

      // Player now has full spice back
      spice += recoveryResult.spiceRecovered!;
      expect(spice).toBe(100);
    });

    it('should simulate corpse expiring before recovery', () => {
      const playerId = 'player-1';

      // Player dies
      const deathResult = manager.processDeath(playerId, { x: 300, y: 0, z: 400 }, 100, {
        objectivesCompleted: 0,
        totalSpiceEarned: 0,
        distanceTraveled: 0,
        deaths: 0,
        wormsRidden: 0,
        outpostsCaptured: 0,
      });

      // Time passes (3 minutes)
      vi.advanceTimersByTime(3 * 60 * 1000);

      // Player tries to recover but corpse is gone
      const recoveryResult = manager.recoverCorpse(playerId, deathResult.corpseId, { x: 300, y: 0, z: 400 });

      expect(recoveryResult.success).toBe(false);
      expect(recoveryResult.error).toContain('not found');
    });

    it('should simulate multiple deaths creating multiple corpses', () => {
      const playerId = 'player-1';
      let stats: PlayerStats = {
        objectivesCompleted: 0,
        totalSpiceEarned: 0,
        distanceTraveled: 0,
        deaths: 0,
        wormsRidden: 0,
        outpostsCaptured: 0,
      };

      // First death
      const death1 = manager.processDeath(playerId, { x: 100, y: 0, z: 100 }, 100, stats);
      stats = death1.newStats;

      vi.advanceTimersByTime(30 * 1000); // 30 seconds

      // Second death
      const death2 = manager.processDeath(playerId, { x: 200, y: 0, z: 200 }, 80, stats);
      stats = death2.newStats;

      // Both corpses exist
      expect(manager.getCorpseMarker(death1.corpseId)).toBeDefined();
      expect(manager.getCorpseMarker(death2.corpseId)).toBeDefined();

      // Death count is 2
      expect(stats.deaths).toBe(2);

      // Player has 2 corpses
      const playerCorpses = manager.getPlayerCorpses(playerId);
      expect(playerCorpses.length).toBe(2);
    });
  });
});
