import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Room } from './Room';
import { GameLoop } from './GameLoop';
import type { RoomPlayer } from './Room';
import type { Socket } from 'socket.io';

/**
 * VS4: Outpost System Integration Tests
 *
 * Tests the complete integration of OutpostManager with:
 * - GameLoop initialization
 * - HarkonnenAI trooper spawning
 * - CombatSystem for clearing outposts
 * - Player shooting mechanics
 */
describe('VS4: Outpost Integration (End-to-End)', () => {
  let room: Room;
  let gameLoop: GameLoop;
  let player: RoomPlayer;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1000000);

    room = new Room('test-room');
    gameLoop = new GameLoop(room, 12345);

    const mockSocket = {
      emit: vi.fn(),
      on: vi.fn(),
      id: 'socket-1',
    } as unknown as Socket;

    room.addPlayer(mockSocket, 'player-1', 'TestPlayer');
    player = room.getPlayer('player-1')!;
    player.state.position = { x: 0, y: 0, z: 0 };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Outpost Initialization', () => {
    it('should generate outposts at GameLoop creation', () => {
      const outposts = gameLoop.getOutpostManager().getOutposts();

      expect(outposts.length).toBe(6);
      expect(outposts.every(o => o.active)).toBe(true);
    });

    it('should spawn Harkonnen troopers at all outposts', () => {
      const stats = gameLoop.getOutpostManager().getOutpostStats();

      // Should have 2-4 troopers per outpost
      expect(stats.totalTroopers).toBeGreaterThanOrEqual(12); // 6 outposts * 2 min
      expect(stats.totalTroopers).toBeLessThanOrEqual(24); // 6 outposts * 4 max
    });

    it('should register troopers to their outposts', () => {
      const outposts = gameLoop.getOutpostManager().getOutposts();

      for (const outpost of outposts) {
        expect(outpost.trooperIds.length).toBeGreaterThanOrEqual(2);
        expect(outpost.trooperIds.length).toBeLessThanOrEqual(4);

        // Verify troopers exist in HarkonnenAI
        for (const trooperId of outpost.trooperIds) {
          const trooper = gameLoop.getHarkonnenAI().getTrooper(trooperId);
          expect(trooper).toBeDefined();
          expect(trooper!.outpostId).toBe(outpost.id);
        }
      }
    });

    it('should generate patrol paths for each outpost', () => {
      const outposts = gameLoop.getOutpostManager().getOutposts();

      for (const outpost of outposts) {
        const path = gameLoop.getOutpostManager().generatePatrolPath(outpost.id);

        expect(path.waypoints.length).toBe(8);

        // Verify waypoints are at correct radius
        for (const waypoint of path.waypoints) {
          const dx = waypoint.x - outpost.position.x;
          const dz = waypoint.z - outpost.position.z;
          const distance = Math.sqrt(dx * dx + dz * dz);

          expect(distance).toBeCloseTo(50, 1);
        }
      }
    });

    it('should place outposts with minimum spacing from Sietch', () => {
      const outposts = gameLoop.getOutpostManager().getOutposts();
      const sietchPos = { x: 0, y: 0, z: 0 };

      for (const outpost of outposts) {
        const dx = outpost.position.x - sietchPos.x;
        const dz = outpost.position.z - sietchPos.z;
        const distance = Math.sqrt(dx * dx + dz * dz);

        expect(distance).toBeGreaterThanOrEqual(300);
      }
    });

    it('should place outposts with minimum spacing from oases', () => {
      const outposts = gameLoop.getOutpostManager().getOutposts();
      const oases = gameLoop.getOasisManager().getOases();

      for (const outpost of outposts) {
        for (const oasis of oases) {
          const dx = outpost.position.x - oasis.position.x;
          const dz = outpost.position.z - oasis.position.z;
          const distance = Math.sqrt(dx * dx + dz * dz);

          expect(distance).toBeGreaterThanOrEqual(150);
        }
      }
    });
  });

  describe('Complete Outpost Clearing', () => {
    it('should clear outpost when all troopers killed', () => {
      // Mock Math.random to ensure hits
      vi.spyOn(Math, 'random').mockReturnValue(0.5);

      // Get first outpost
      const outpost = gameLoop.getOutpostManager().getOutposts()[0];
      const trooperIds = [...outpost.trooperIds];
      const initialTrooperCount = trooperIds.length;

      expect(outpost.active).toBe(true);

      // Position player near outpost
      player.state.position = { ...outpost.position };

      // Kill all troopers
      for (const trooperId of trooperIds) {
        const trooper = gameLoop.getHarkonnenAI().getTrooper(trooperId);
        if (!trooper) continue;

        // Keep shooting until dead (may take multiple shots - 25 damage per hit, 100 health = 4 hits)
        let attempts = 0;
        while (attempts < 10 && gameLoop.getHarkonnenAI().getTrooper(trooperId)) {
          vi.setSystemTime(Date.now() + 600); // Advance past fire rate cooldown (500ms)
          gameLoop.handlePlayerShoot('player-1', trooper.position);
          attempts++;
        }
      }

      // Outpost should now be cleared
      expect(outpost.active).toBe(false);
      expect(outpost.trooperIds.length).toBe(0);
    });

    it('should update stats when outpost is cleared', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);

      const initialStats = gameLoop.getOutpostManager().getOutpostStats();
      expect(initialStats.active).toBe(6);
      expect(initialStats.cleared).toBe(0);

      // Clear one outpost
      const outpost = gameLoop.getOutpostManager().getOutposts()[0];
      const trooperIds = [...outpost.trooperIds];

      player.state.position = { ...outpost.position };

      for (const trooperId of trooperIds) {
        const trooper = gameLoop.getHarkonnenAI().getTrooper(trooperId);
        if (!trooper) continue;

        let attempts = 0;
        while (attempts < 10 && gameLoop.getHarkonnenAI().getTrooper(trooperId)) {
          vi.setSystemTime(Date.now() + 600);
          gameLoop.handlePlayerShoot('player-1', trooper.position);
          attempts++;
        }
      }

      const finalStats = gameLoop.getOutpostManager().getOutpostStats();
      expect(finalStats.active).toBe(5);
      expect(finalStats.cleared).toBe(1);
    });

    it('should keep outpost active when only some troopers killed', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);

      const outpost = gameLoop.getOutpostManager().getOutposts()[0];
      const initialTrooperCount = outpost.trooperIds.length;

      if (initialTrooperCount < 2) {
        // Skip test if outpost has only one trooper
        return;
      }

      player.state.position = { ...outpost.position };

      // Kill one trooper (note: due to troopers spawning at same position, we might kill any one of them)
      const trooperIdToKill = outpost.trooperIds[0];
      let attempts = 0;
      while (attempts < 10 && gameLoop.getHarkonnenAI().getTrooper(trooperIdToKill)) {
        const trooper = gameLoop.getHarkonnenAI().getTrooper(trooperIdToKill);
        if (!trooper) break;

        vi.setSystemTime(Date.now() + 600);
        gameLoop.handlePlayerShoot('player-1', trooper.position);
        attempts++;
      }

      // Outpost should still be active and have at least one trooper
      expect(outpost.active).toBe(true);
      expect(outpost.trooperIds.length).toBeGreaterThan(0);
      expect(outpost.trooperIds.length).toBeLessThan(initialTrooperCount);
    });
  });

  describe('Multiple Outpost Scenarios', () => {
    it('should track cleared vs active outposts independently', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);

      const outposts = gameLoop.getOutpostManager().getOutposts();

      // Clear first 2 outposts
      for (let i = 0; i < 2; i++) {
        const outpost = outposts[i];
        const trooperIds = [...outpost.trooperIds];

        player.state.position = { ...outpost.position };

        for (const trooperId of trooperIds) {
          const trooper = gameLoop.getHarkonnenAI().getTrooper(trooperId);
          if (!trooper) continue;

          let attempts = 0;
          while (attempts < 10 && gameLoop.getHarkonnenAI().getTrooper(trooperId)) {
            vi.setSystemTime(Date.now() + 600);
            gameLoop.handlePlayerShoot('player-1', trooper.position);
            attempts++;
          }
        }
      }

      const stats = gameLoop.getOutpostManager().getOutpostStats();
      expect(stats.total).toBe(6);
      expect(stats.active).toBe(4);
      expect(stats.cleared).toBe(2);
    });

    it('should handle partial clearing of multiple outposts', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);

      const outposts = gameLoop.getOutpostManager().getOutposts();
      const initialTotalTroopers = gameLoop.getOutpostManager().getOutpostStats().totalTroopers;

      // Kill one trooper from first outpost
      const outpost1 = outposts[0];
      if (outpost1.trooperIds.length > 0) {
        const trooper1Id = outpost1.trooperIds[0];
        player.state.position = { ...outpost1.position };

        let attempts = 0;
        while (attempts < 10 && gameLoop.getHarkonnenAI().getTrooper(trooper1Id)) {
          const trooper = gameLoop.getHarkonnenAI().getTrooper(trooper1Id);
          if (!trooper) break;

          vi.setSystemTime(Date.now() + 600);
          gameLoop.handlePlayerShoot('player-1', trooper.position);
          attempts++;
        }
      }

      // Kill one trooper from second outpost
      const outpost2 = outposts[1];
      if (outpost2.trooperIds.length > 0) {
        const trooper2Id = outpost2.trooperIds[0];
        player.state.position = { ...outpost2.position };

        let attempts = 0;
        while (attempts < 10 && gameLoop.getHarkonnenAI().getTrooper(trooper2Id)) {
          const trooper = gameLoop.getHarkonnenAI().getTrooper(trooper2Id);
          if (!trooper) break;

          vi.setSystemTime(Date.now() + 600);
          gameLoop.handlePlayerShoot('player-1', trooper.position);
          attempts++;
        }
      }

      const stats = gameLoop.getOutpostManager().getOutpostStats();

      // Total troopers should be reduced (we killed at least 1, possibly more due to proximity)
      expect(stats.totalTroopers).toBeLessThan(initialTotalTroopers);
      expect(stats.totalTroopers).toBeGreaterThan(0);

      // At least one outpost should still be active
      expect(stats.active).toBeGreaterThan(0);
    });
  });

  describe('Patrol Path Integration', () => {
    it('should assign patrol paths to spawned troopers', () => {
      const outposts = gameLoop.getOutpostManager().getOutposts();

      for (const outpost of outposts) {
        const path = gameLoop.getOutpostManager().generatePatrolPath(outpost.id);

        // Each trooper at this outpost should have patrol waypoints
        for (const trooperId of outpost.trooperIds) {
          const trooper = gameLoop.getHarkonnenAI().getTrooper(trooperId);

          expect(trooper).toBeDefined();
          expect(trooper!.patrolPath.length).toBe(8);

          // Verify waypoints match outpost patrol path
          for (let i = 0; i < 8; i++) {
            expect(trooper!.patrolPath[i].x).toBeCloseTo(path.waypoints[i].x, 5);
            expect(trooper!.patrolPath[i].z).toBeCloseTo(path.waypoints[i].z, 5);
          }
        }
      }
    });

    it('should spawn troopers at their outpost position', () => {
      const outposts = gameLoop.getOutpostManager().getOutposts();

      for (const outpost of outposts) {
        for (const trooperId of outpost.trooperIds) {
          const trooper = gameLoop.getHarkonnenAI().getTrooper(trooperId);

          expect(trooper).toBeDefined();

          // Trooper should spawn at outpost position
          expect(trooper!.position.x).toBe(outpost.position.x);
          expect(trooper!.position.z).toBe(outpost.position.z);
        }
      }
    });
  });

  describe('Realistic Gameplay Scenarios', () => {
    it('should simulate player clearing an outpost over time', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);

      const outpost = gameLoop.getOutpostManager().getOutposts()[0];
      const initialTrooperCount = outpost.trooperIds.length;

      // Position player at outpost to ensure all troopers are in range
      player.state.position = { ...outpost.position };

      // Kill all troopers at this outpost
      const trooperIds = [...outpost.trooperIds];

      for (const trooperId of trooperIds) {
        let attempts = 0;
        while (attempts < 10 && gameLoop.getHarkonnenAI().getTrooper(trooperId)) {
          const trooper = gameLoop.getHarkonnenAI().getTrooper(trooperId);
          if (!trooper) break;

          vi.setSystemTime(Date.now() + 600);
          gameLoop.handlePlayerShoot('player-1', trooper.position);
          attempts++;
        }
      }

      // All troopers should be dead and outpost should be cleared
      expect(outpost.active).toBe(false);
      expect(outpost.trooperIds.length).toBe(0);
    });

    it('should support querying nearest outpost to player', () => {
      const nearestOutpost = gameLoop.getOutpostManager().getNearestOutpost(player.state.position);

      expect(nearestOutpost).toBeDefined();

      // Verify it's actually the nearest
      const outposts = gameLoop.getOutpostManager().getOutposts();
      const distances = outposts.map(o => {
        const dx = o.position.x - player.state.position.x;
        const dz = o.position.z - player.state.position.z;
        return Math.sqrt(dx * dx + dz * dz);
      });

      const minDistance = Math.min(...distances);
      const nearestDistance = Math.sqrt(
        Math.pow(nearestOutpost!.position.x - player.state.position.x, 2) +
          Math.pow(nearestOutpost!.position.z - player.state.position.z, 2)
      );

      expect(nearestDistance).toBe(minDistance);
    });

    it('should detect when player is near an outpost', () => {
      const outpost = gameLoop.getOutpostManager().getOutposts()[0];

      // Position player close to outpost
      player.state.position = {
        x: outpost.position.x + 50,
        y: 0,
        z: outpost.position.z,
      };

      expect(gameLoop.getOutpostManager().isNearOutpost(player.state.position, 100)).toBe(true);

      // Position player far from any outpost
      player.state.position = {
        x: 10000,
        y: 0,
        z: 10000,
      };

      expect(gameLoop.getOutpostManager().isNearOutpost(player.state.position, 100)).toBe(false);
    });
  });

  describe('Deterministic Behavior', () => {
    it('should generate same outposts with same seed', () => {
      const room2 = new Room('test-room-2');
      const gameLoop2 = new GameLoop(room2, 12345); // Same seed

      const outposts1 = gameLoop.getOutpostManager().getOutposts();
      const outposts2 = gameLoop2.getOutpostManager().getOutposts();

      expect(outposts1.length).toBe(outposts2.length);

      for (let i = 0; i < outposts1.length; i++) {
        expect(outposts1[i].position.x).toBeCloseTo(outposts2[i].position.x, 5);
        expect(outposts1[i].position.z).toBeCloseTo(outposts2[i].position.z, 5);
        expect(outposts1[i].trooperIds.length).toBe(outposts2[i].trooperIds.length);
      }
    });

    it('should generate different outposts with different seeds', () => {
      const room2 = new Room('test-room-2');
      const gameLoop2 = new GameLoop(room2, 99999); // Different seed

      const outposts1 = gameLoop.getOutpostManager().getOutposts();
      const outposts2 = gameLoop2.getOutpostManager().getOutposts();

      // Should have at least one different position
      let differentPositions = 0;

      for (let i = 0; i < Math.min(outposts1.length, outposts2.length); i++) {
        if (
          Math.abs(outposts1[i].position.x - outposts2[i].position.x) > 1 ||
          Math.abs(outposts1[i].position.z - outposts2[i].position.z) > 1
        ) {
          differentPositions++;
        }
      }

      expect(differentPositions).toBeGreaterThan(0);
    });
  });
});
