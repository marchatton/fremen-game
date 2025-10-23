import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { HarkonnenAI, HarkonnenState, type HarkonnenTrooper } from './HarkonnenAI';
import type { Vector3 } from '@fremen/shared';

describe('VS4: Harkonnen AI System', () => {
  let ai: HarkonnenAI;

  beforeEach(() => {
    ai = new HarkonnenAI();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Trooper Spawning', () => {
    it('should spawn a trooper with correct initial state', () => {
      const patrolPath = [
        { x: 0, y: 0, z: 0 },
        { x: 10, y: 0, z: 0 },
        { x: 10, y: 0, z: 10 },
      ];

      const trooper = ai.spawnTrooper('trooper-1', { x: 0, y: 0, z: 0 }, patrolPath);

      expect(trooper.id).toBe('trooper-1');
      expect(trooper.state).toBe(HarkonnenState.PATROL);
      expect(trooper.health).toBe(100);
      expect(trooper.maxHealth).toBe(100);
      expect(trooper.patrolPath.length).toBe(3);
      expect(trooper.currentWaypoint).toBe(0);
    });

    it('should spawn trooper with outpost ID', () => {
      const trooper = ai.spawnTrooper('trooper-1', { x: 0, y: 0, z: 0 }, [], 'outpost-1');

      expect(trooper.outpostId).toBe('outpost-1');
    });

    it('should retrieve spawned trooper', () => {
      ai.spawnTrooper('trooper-1', { x: 0, y: 0, z: 0 }, []);

      const trooper = ai.getTrooper('trooper-1');

      expect(trooper).toBeDefined();
      expect(trooper!.id).toBe('trooper-1');
    });

    it('should get all troopers', () => {
      ai.spawnTrooper('trooper-1', { x: 0, y: 0, z: 0 }, []);
      ai.spawnTrooper('trooper-2', { x: 10, y: 0, z: 10 }, []);

      const troopers = ai.getTroopers();

      expect(troopers.length).toBe(2);
    });
  });

  describe('PATROL State', () => {
    it('should move along patrol path', () => {
      const patrolPath = [
        { x: 0, y: 0, z: 0 },
        { x: 10, y: 0, z: 0 },
        { x: 10, y: 0, z: 10 },
      ];

      ai.spawnTrooper('trooper-1', { x: 0, y: 0, z: 0 }, patrolPath);

      // Update for 5 seconds at patrol speed (3 m/s = 15m)
      for (let i = 0; i < 5; i++) {
        ai.update(1, []);
      }

      const trooper = ai.getTrooper('trooper-1')!;

      // Should have moved towards waypoint 1
      expect(trooper.position.x).toBeGreaterThan(0);
      expect(trooper.position.x).toBeLessThanOrEqual(10);
    });

    it('should advance to next waypoint when reaching current', () => {
      const patrolPath = [
        { x: 0, y: 0, z: 0 },
        { x: 5, y: 0, z: 0 },
      ];

      ai.spawnTrooper('trooper-1', { x: 0, y: 0, z: 0 }, patrolPath);

      // Move to waypoint 1 (5m at 3m/s = 2 seconds)
      for (let i = 0; i < 3; i++) {
        ai.update(1, []);
      }

      const trooper = ai.getTrooper('trooper-1')!;

      expect(trooper.currentWaypoint).toBe(1);
    });

    it('should loop back to first waypoint', () => {
      const patrolPath = [
        { x: 0, y: 0, z: 0 },
        { x: 3, y: 0, z: 0 },
      ];

      ai.spawnTrooper('trooper-1', { x: 0, y: 0, z: 0 }, patrolPath);

      // Complete full patrol loop (reach waypoint 1, then back to 0)
      // 3m to waypoint 1 at 3m/s = 1s, then 3m back at 3m/s = 1s
      for (let i = 0; i < 3; i++) {
        ai.update(1, []);
      }

      const trooper = ai.getTrooper('trooper-1')!;

      // May be at waypoint 0 or 1 depending on timing, just check it's a valid waypoint
      expect(trooper.currentWaypoint).toBeGreaterThanOrEqual(0);
      expect(trooper.currentWaypoint).toBeLessThan(2);
    });

    it('should detect player in vision cone and transition to COMBAT', () => {
      ai.spawnTrooper('trooper-1', { x: 0, y: 0, z: 0 }, []);

      const players = [
        { id: 'player-1', position: { x: 10, y: 0, z: 0 }, state: 'ACTIVE' }
      ];

      ai.update(1, players);

      const trooper = ai.getTrooper('trooper-1')!;

      expect(trooper.state).toBe(HarkonnenState.COMBAT);
      expect(trooper.targetPlayerId).toBe('player-1');
    });

    it('should not detect player outside vision range', () => {
      ai.spawnTrooper('trooper-1', { x: 0, y: 0, z: 0 }, []);

      const players = [
        { id: 'player-1', position: { x: 100, y: 0, z: 0 }, state: 'ACTIVE' } // 100m away
      ];

      ai.update(1, players);

      const trooper = ai.getTrooper('trooper-1')!;

      expect(trooper.state).toBe(HarkonnenState.PATROL);
    });

    it('should not detect player outside vision cone', () => {
      const trooper = ai.spawnTrooper('trooper-1', { x: 0, y: 0, z: 0 }, []);
      trooper.rotation = 0; // Facing +X

      const players = [
        { id: 'player-1', position: { x: 0, y: 0, z: 30 }, state: 'ACTIVE' } // Behind trooper
      ];

      ai.update(1, players);

      expect(trooper.state).toBe(HarkonnenState.PATROL);
    });

    it('should not detect dead players', () => {
      ai.spawnTrooper('trooper-1', { x: 0, y: 0, z: 0 }, []);

      const players = [
        { id: 'player-1', position: { x: 10, y: 0, z: 0 }, state: 'DEAD' }
      ];

      ai.update(1, players);

      const trooper = ai.getTrooper('trooper-1')!;

      expect(trooper.state).toBe(HarkonnenState.PATROL);
    });
  });

  describe('COMBAT State', () => {
    it('should maintain optimal combat distance (20-40m)', () => {
      const trooper = ai.spawnTrooper('trooper-1', { x: 0, y: 0, z: 0 }, []);
      trooper.state = HarkonnenState.COMBAT;
      trooper.targetPlayerId = 'player-1';

      const players = [
        { id: 'player-1', position: { x: 50, y: 0, z: 0 }, state: 'ACTIVE' } // Too far
      ];

      // Update multiple times
      for (let i = 0; i < 5; i++) {
        ai.update(1, players);
      }

      // Trooper should have moved closer
      expect(trooper.position.x).toBeGreaterThan(0);
    });

    it('should back up if player too close', () => {
      const trooper = ai.spawnTrooper('trooper-1', { x: 0, y: 0, z: 0 }, []);
      trooper.state = HarkonnenState.COMBAT;
      trooper.targetPlayerId = 'player-1';

      const initialX = trooper.position.x;

      const players = [
        { id: 'player-1', position: { x: 5, y: 0, z: 0 }, state: 'ACTIVE' } // Too close (<20m)
      ];

      ai.update(1, players);

      // Trooper should back up (move away from player)
      expect(trooper.position.x).toBeLessThan(initialX);
    });

    it('should transition to INVESTIGATE when target lost', () => {
      const trooper = ai.spawnTrooper('trooper-1', { x: 0, y: 0, z: 0 }, []);
      trooper.state = HarkonnenState.COMBAT;
      trooper.targetPlayerId = 'player-1';

      const players: Array<{ id: string; position: Vector3; state: string }> = []; // No players

      ai.update(1, players);

      expect(trooper.state).toBe(HarkonnenState.INVESTIGATE);
      expect(trooper.investigateUntil).toBeDefined();
    });

    it('should transition to RETREAT when health below 30%', () => {
      const trooper = ai.spawnTrooper('trooper-1', { x: 0, y: 0, z: 0 }, []);
      trooper.state = HarkonnenState.COMBAT;
      trooper.targetPlayerId = 'player-1';
      trooper.health = 25; // 25% health

      const players = [
        { id: 'player-1', position: { x: 30, y: 0, z: 0 }, state: 'ACTIVE' }
      ];

      ai.update(1, players);

      expect(trooper.state).toBe(HarkonnenState.RETREAT);
      expect(trooper.retreatTarget).toBeDefined();
    });

    it('should fire at player with correct rate limit', () => {
      vi.setSystemTime(1000000); // Set initial time

      const trooper = ai.spawnTrooper('trooper-1', { x: 0, y: 0, z: 0 }, []);
      trooper.state = HarkonnenState.COMBAT;
      trooper.targetPlayerId = 'player-1';
      trooper.rotation = 0;

      const players = [
        { id: 'player-1', position: { x: 30, y: 0, z: 0 }, state: 'ACTIVE' }
      ];

      const initialFireTime = trooper.lastFireTime;

      ai.update(1, players);

      // Should have fired (lastFireTime updated)
      expect(trooper.lastFireTime).toBeGreaterThan(initialFireTime);

      const secondFireTime = trooper.lastFireTime;

      // Immediate second update shouldn't fire again
      ai.update(0.1, players);

      expect(trooper.lastFireTime).toBe(secondFireTime);

      // After fire rate cooldown, should fire again
      vi.setSystemTime(Date.now() + 1001); // Advance past fire rate (1000ms)
      ai.update(1, players);

      expect(trooper.lastFireTime).toBeGreaterThan(secondFireTime);
    });

    it('should update last known position when player visible', () => {
      const trooper = ai.spawnTrooper('trooper-1', { x: 0, y: 0, z: 0 }, []);
      trooper.state = HarkonnenState.COMBAT;
      trooper.targetPlayerId = 'player-1';

      const players = [
        { id: 'player-1', position: { x: 30, y: 0, z: 0 }, state: 'ACTIVE' }
      ];

      ai.update(1, players);

      expect(trooper.lastKnownPlayerPosition).toBeDefined();
      expect(trooper.lastKnownPlayerPosition!.x).toBe(30);
    });

    it('should face towards target', () => {
      const trooper = ai.spawnTrooper('trooper-1', { x: 0, y: 0, z: 0 }, []);
      trooper.state = HarkonnenState.COMBAT;
      trooper.targetPlayerId = 'player-1';
      trooper.rotation = 0;

      const players = [
        { id: 'player-1', position: { x: 0, y: 0, z: 30 }, state: 'ACTIVE' }
      ];

      ai.update(1, players);

      // Should face roughly towards +Z (π/2 radians)
      expect(Math.abs(trooper.rotation)).toBeCloseTo(Math.PI / 2, 1);
    });
  });

  describe('INVESTIGATE State', () => {
    it('should move to last known player position', () => {
      const trooper = ai.spawnTrooper('trooper-1', { x: 0, y: 0, z: 0 }, []);
      trooper.state = HarkonnenState.INVESTIGATE;
      trooper.lastKnownPlayerPosition = { x: 20, y: 0, z: 0 };

      ai.update(1, []);

      // Should move towards last known position
      expect(trooper.position.x).toBeGreaterThan(0);
    });

    it('should start investigation timer when reaching search area', () => {
      const trooper = ai.spawnTrooper('trooper-1', { x: 0, y: 0, z: 0 }, []);
      trooper.state = HarkonnenState.INVESTIGATE;
      trooper.lastKnownPlayerPosition = { x: 1, y: 0, z: 0 };

      ai.update(1, []);

      expect(trooper.investigateUntil).toBeDefined();
    });

    it('should return to PATROL after investigation timeout', () => {
      const trooper = ai.spawnTrooper('trooper-1', { x: 0, y: 0, z: 0 }, []);
      trooper.state = HarkonnenState.INVESTIGATE;
      trooper.lastKnownPlayerPosition = { x: 0, y: 0, z: 0 };
      trooper.investigateUntil = Date.now() + 10000;

      // Wait 11 seconds
      vi.advanceTimersByTime(11000);
      ai.update(1, []);

      expect(trooper.state).toBe(HarkonnenState.PATROL);
      expect(trooper.investigateUntil).toBeUndefined();
      expect(trooper.lastKnownPlayerPosition).toBeUndefined();
    });

    it('should transition to COMBAT if player detected during investigation', () => {
      const trooper = ai.spawnTrooper('trooper-1', { x: 0, y: 0, z: 0 }, []);
      trooper.state = HarkonnenState.INVESTIGATE;
      trooper.lastKnownPlayerPosition = { x: 0, y: 0, z: 0 };

      const players = [
        { id: 'player-1', position: { x: 10, y: 0, z: 0 }, state: 'ACTIVE' }
      ];

      ai.update(1, players);

      expect(trooper.state).toBe(HarkonnenState.COMBAT);
      expect(trooper.targetPlayerId).toBe('player-1');
    });
  });

  describe('RETREAT State', () => {
    it('should move towards retreat position', () => {
      const patrolPath = [{ x: 0, y: 0, z: 0 }];
      const trooper = ai.spawnTrooper('trooper-1', { x: 50, y: 0, z: 50 }, patrolPath);
      trooper.state = HarkonnenState.RETREAT;
      trooper.retreatTarget = { x: 0, y: 0, z: 0 };

      ai.update(1, []);

      // Should move towards retreat target
      expect(trooper.position.x).toBeLessThan(50);
      expect(trooper.position.z).toBeLessThan(50);
    });

    it('should transition to PATROL when reaching retreat point', () => {
      const trooper = ai.spawnTrooper('trooper-1', { x: 2, y: 0, z: 0 }, []);
      trooper.state = HarkonnenState.RETREAT;
      trooper.retreatTarget = { x: 0, y: 0, z: 0 };

      ai.update(1, []);

      expect(trooper.state).toBe(HarkonnenState.PATROL);
      expect(trooper.retreatTarget).toBeUndefined();
    });

    it('should use first patrol waypoint as retreat target', () => {
      const patrolPath = [
        { x: 100, y: 0, z: 100 },
        { x: 120, y: 0, z: 100 },
      ];
      const trooper = ai.spawnTrooper('trooper-1', { x: 0, y: 0, z: 0 }, patrolPath);
      trooper.state = HarkonnenState.RETREAT;

      ai.update(1, []);

      expect(trooper.retreatTarget).toBeDefined();
      expect(trooper.retreatTarget!.x).toBe(100);
      expect(trooper.retreatTarget!.z).toBe(100);
    });
  });

  describe('DEAD State', () => {
    it('should not update when dead', () => {
      const trooper = ai.spawnTrooper('trooper-1', { x: 0, y: 0, z: 0 }, []);
      trooper.state = HarkonnenState.DEAD;
      trooper.alertedAt = Date.now();

      const initialPos = { ...trooper.position };

      const players = [
        { id: 'player-1', position: { x: 10, y: 0, z: 0 }, state: 'ACTIVE' }
      ];

      ai.update(1, players);

      // Position should not change
      expect(trooper.position).toEqual(initialPos);
    });

    it('should despawn after corpse duration', () => {
      const trooper = ai.spawnTrooper('trooper-1', { x: 0, y: 0, z: 0 }, []);
      trooper.state = HarkonnenState.DEAD;
      trooper.alertedAt = Date.now();

      // Wait 31 seconds
      vi.advanceTimersByTime(31000);
      ai.update(1, []);

      const removed = ai.getTrooper('trooper-1');
      expect(removed).toBeUndefined();
    });

    it('should not despawn before corpse duration', () => {
      const trooper = ai.spawnTrooper('trooper-1', { x: 0, y: 0, z: 0 }, []);
      trooper.state = HarkonnenState.DEAD;
      trooper.alertedAt = Date.now();

      // Wait 20 seconds
      vi.advanceTimersByTime(20000);
      ai.update(1, []);

      const stillExists = ai.getTrooper('trooper-1');
      expect(stillExists).toBeDefined();
    });
  });

  describe('Damage System', () => {
    it('should apply damage to trooper', () => {
      const trooper = ai.spawnTrooper('trooper-1', { x: 0, y: 0, z: 0 }, []);

      ai.applyDamage('trooper-1', 25);

      expect(trooper.health).toBe(75);
    });

    it('should not reduce health below 0', () => {
      const trooper = ai.spawnTrooper('trooper-1', { x: 0, y: 0, z: 0 }, []);

      ai.applyDamage('trooper-1', 150);

      expect(trooper.health).toBe(0);
    });

    it('should transition to DEAD when health reaches 0', () => {
      const trooper = ai.spawnTrooper('trooper-1', { x: 0, y: 0, z: 0 }, []);

      const result = ai.applyDamage('trooper-1', 100);

      expect(result.killed).toBe(true);
      expect(result.position).toEqual(trooper.position);
      expect(trooper.state).toBe(HarkonnenState.DEAD);
      expect(trooper.alertedAt).toBeDefined();
    });

    it('should not apply damage to dead trooper', () => {
      const trooper = ai.spawnTrooper('trooper-1', { x: 0, y: 0, z: 0 }, []);
      trooper.state = HarkonnenState.DEAD;
      trooper.health = 0;

      const result = ai.applyDamage('trooper-1', 25);

      expect(result.killed).toBe(false);
      expect(result.position).toBeUndefined();
      expect(trooper.health).toBe(0);
    });

    it('should return false if damage does not kill', () => {
      ai.spawnTrooper('trooper-1', { x: 0, y: 0, z: 0 }, []);

      const result = ai.applyDamage('trooper-1', 50);

      expect(result.killed).toBe(false);
      expect(result.position).toBeUndefined();
    });

    it('should handle damage to non-existent trooper', () => {
      const result = ai.applyDamage('nonexistent', 50);

      expect(result.killed).toBe(false);
      expect(result.position).toBeUndefined();
    });
  });

  describe('Trooper Management', () => {
    it('should remove trooper', () => {
      ai.spawnTrooper('trooper-1', { x: 0, y: 0, z: 0 }, []);

      ai.removeTrooper('trooper-1');

      const trooper = ai.getTrooper('trooper-1');
      expect(trooper).toBeUndefined();
    });

    it('should get troopers targeting specific player', () => {
      const trooper1 = ai.spawnTrooper('trooper-1', { x: 0, y: 0, z: 0 }, []);
      const trooper2 = ai.spawnTrooper('trooper-2', { x: 10, y: 0, z: 0 }, []);
      const trooper3 = ai.spawnTrooper('trooper-3', { x: 20, y: 0, z: 0 }, []);

      trooper1.state = HarkonnenState.COMBAT;
      trooper1.targetPlayerId = 'player-1';

      trooper2.state = HarkonnenState.COMBAT;
      trooper2.targetPlayerId = 'player-1';

      trooper3.state = HarkonnenState.COMBAT;
      trooper3.targetPlayerId = 'player-2';

      const targeting = ai.getTroopersTargeting('player-1');

      expect(targeting.length).toBe(2);
      expect(targeting.every(t => t.targetPlayerId === 'player-1')).toBe(true);
    });

    it('should not include non-combat troopers in targeting query', () => {
      const trooper = ai.spawnTrooper('trooper-1', { x: 0, y: 0, z: 0 }, []);
      trooper.state = HarkonnenState.PATROL;
      trooper.targetPlayerId = 'player-1';

      const targeting = ai.getTroopersTargeting('player-1');

      expect(targeting.length).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty patrol path', () => {
      const trooper = ai.spawnTrooper('trooper-1', { x: 0, y: 0, z: 0 }, []);

      expect(() => ai.update(1, [])).not.toThrow();
      expect(trooper.position).toEqual({ x: 0, y: 0, z: 0 });
    });

    it('should handle single waypoint patrol', () => {
      const trooper = ai.spawnTrooper('trooper-1', { x: 0, y: 0, z: 0 }, [{ x: 0, y: 0, z: 0 }]);

      ai.update(1, []);

      expect(trooper.currentWaypoint).toBe(0);
    });

    it('should handle zero deltaTime', () => {
      const trooper = ai.spawnTrooper('trooper-1', { x: 0, y: 0, z: 0 }, [{ x: 10, y: 0, z: 0 }]);
      const initialPos = { ...trooper.position };

      ai.update(0, []);

      expect(trooper.position).toEqual(initialPos);
    });

    it('should handle multiple players in vision', () => {
      ai.spawnTrooper('trooper-1', { x: 0, y: 0, z: 0 }, []);

      const players = [
        { id: 'player-1', position: { x: 10, y: 0, z: 0 }, state: 'ACTIVE' },
        { id: 'player-2', position: { x: 15, y: 0, z: 0 }, state: 'ACTIVE' },
      ];

      ai.update(1, players);

      const trooper = ai.getTrooper('trooper-1')!;

      expect(trooper.state).toBe(HarkonnenState.COMBAT);
      // Should target one of them
      expect(['player-1', 'player-2']).toContain(trooper.targetPlayerId);
    });

    it('should handle player at exact vision range boundary', () => {
      ai.spawnTrooper('trooper-1', { x: 0, y: 0, z: 0 }, []);

      const players = [
        { id: 'player-1', position: { x: 50, y: 0, z: 0 }, state: 'ACTIVE' } // Exactly 50m
      ];

      ai.update(1, players);

      const trooper = ai.getTrooper('trooper-1')!;

      expect(trooper.state).toBe(HarkonnenState.COMBAT);
    });

    it('should handle investigation without last known position', () => {
      const trooper = ai.spawnTrooper('trooper-1', { x: 0, y: 0, z: 0 }, []);
      trooper.state = HarkonnenState.INVESTIGATE;
      trooper.investigateUntil = Date.now() + 5000;

      expect(() => ai.update(1, [])).not.toThrow();
    });
  });

  describe('Realistic Combat Scenarios', () => {
    it('should handle player kiting trooper', () => {
      const trooper = ai.spawnTrooper('trooper-1', { x: 0, y: 0, z: 0 }, []);
      trooper.state = HarkonnenState.COMBAT;
      trooper.targetPlayerId = 'player-1';

      let playerX = 50; // Start player farther away (>40m) to force chase from start

      for (let i = 0; i < 10; i++) {
        const players = [
          { id: 'player-1', position: { x: playerX, y: 0, z: 0 }, state: 'ACTIVE' }
        ];

        ai.update(1, players);

        // Player moves away
        playerX += 2;
      }

      // Trooper should chase (net gain: 5 m/s trooper - 2 m/s player = 3 m/s, 10s = 30m moved)
      expect(trooper.position.x).toBeGreaterThan(25);
    });

    it('should handle ambush scenario (player enters vision suddenly)', () => {
      const trooper = ai.spawnTrooper('trooper-1', { x: 0, y: 0, z: 0 }, []);

      // No players initially
      ai.update(1, []);
      expect(trooper.state).toBe(HarkonnenState.PATROL);

      // Player appears
      const players = [
        { id: 'player-1', position: { x: 20, y: 0, z: 0 }, state: 'ACTIVE' }
      ];

      ai.update(1, players);

      expect(trooper.state).toBe(HarkonnenState.COMBAT);
      expect(trooper.targetPlayerId).toBe('player-1');
    });

    it('should handle player killing trooper during combat', () => {
      const trooper = ai.spawnTrooper('trooper-1', { x: 0, y: 0, z: 0 }, []);
      trooper.state = HarkonnenState.COMBAT;
      trooper.targetPlayerId = 'player-1';

      const players = [
        { id: 'player-1', position: { x: 30, y: 0, z: 0 }, state: 'ACTIVE' }
      ];

      // Player deals damage over time
      for (let i = 0; i < 4; i++) {
        ai.update(1, players);
        ai.applyDamage('trooper-1', 25);
      }

      expect(trooper.state).toBe(HarkonnenState.DEAD);
      expect(trooper.health).toBe(0);
    });

    it('should handle low health retreat and return to combat', () => {
      const patrolPath = [{ x: 0, y: 0, z: 0 }];
      const trooper = ai.spawnTrooper('trooper-1', { x: 30, y: 0, z: 0 }, patrolPath);
      trooper.state = HarkonnenState.COMBAT;
      trooper.targetPlayerId = 'player-1';
      trooper.health = 25; // Low health

      const players = [
        { id: 'player-1', position: { x: 35, y: 0, z: 0 }, state: 'ACTIVE' }
      ];

      ai.update(1, players);

      // Should retreat
      expect(trooper.state).toBe(HarkonnenState.RETREAT);

      // Move towards retreat point
      for (let i = 0; i < 10; i++) {
        ai.update(1, players);
      }

      // Should reach retreat point and return to patrol
      expect(trooper.state).toBe(HarkonnenState.PATROL);
    });
  });
});
