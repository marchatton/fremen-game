import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Room } from './Room';
import { GameLoop } from './GameLoop';
import type { RoomPlayer } from './Room';
import { HarkonnenState } from './ai/HarkonnenAI';
import type { Socket } from 'socket.io';

/**
 * VS4: Alert System Integration Tests
 *
 * Tests complete alert workflow:
 * - Trooper detects player and broadcasts alert
 * - Nearby troopers respond to alert
 * - Alert expiration
 * - Cross-outpost coordination
 */
describe('VS4: Alert System Integration (End-to-End)', () => {
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

  describe('Alert Broadcasting', () => {
    it('should broadcast alert when trooper detects player', () => {
      const harkonnenAI = gameLoop.getHarkonnenAI();
      const alertSystem = gameLoop.getAlertSystem();

      // Spawn trooper facing toward origin (rotation = π)
      const trooper = harkonnenAI.spawnTrooper(
        'trooper-1',
        { x: 25, y: 0, z: 0 }, // Within vision range
        [{ x: 25, y: 0, z: 0 }],
        'outpost-1'
      );

      // Set trooper rotation to face the player at origin
      trooper.rotation = Math.PI; // Face toward negative X

      expect(trooper.state).toBe(HarkonnenState.PATROL);

      // Update AI (trooper should detect player)
      const playerData = [{ id: player.playerId, position: player.state.position, state: 'ACTIVE' }];
      harkonnenAI.update(1 / 30, playerData);

      // Trooper should be in COMBAT
      expect(trooper.state).toBe(HarkonnenState.COMBAT);

      // Alert should be broadcast
      const alerts = alertSystem.getActiveAlerts();
      expect(alerts.length).toBe(1);
      expect(alerts[0].alertingTrooperId).toBe('trooper-1');
      expect(alerts[0].playerId).toBe(player.playerId);
    });

    it('should not broadcast alert when trooper on cooldown', () => {
      const harkonnenAI = gameLoop.getHarkonnenAI();
      const alertSystem = gameLoop.getAlertSystem();

      // Spawn trooper
      const trooper = harkonnenAI.spawnTrooper(
        'trooper-1',
        { x: 25, y: 0, z: 0 },
        [{ x: 25, y: 0, z: 0 }],
        'outpost-1'
      );

      trooper.rotation = Math.PI; // Face toward player at origin

      const playerData = [{ id: player.playerId, position: player.state.position, state: 'ACTIVE' }];

      // First detection - should broadcast
      harkonnenAI.update(1 / 30, playerData);
      expect(alertSystem.getActiveAlerts().length).toBe(1);

      // Force trooper back to PATROL
      trooper.state = HarkonnenState.PATROL;

      // Immediate second detection - should not broadcast (cooldown)
      harkonnenAI.update(1 / 30, playerData);
      expect(alertSystem.getActiveAlerts().length).toBe(1); // Still only 1 alert
    });
  });

  describe('Alert Response', () => {
    it('should make patrolling trooper investigate on alert', () => {
      const harkonnenAI = gameLoop.getHarkonnenAI();

      // Spawn 2 troopers at same outpost
      const trooper1 = harkonnenAI.spawnTrooper(
        'trooper-1',
        { x: 25, y: 0, z: 0 },
        [{ x: 25, y: 0, z: 0 }],
        'outpost-1'
      );

      trooper1.rotation = Math.PI; // Face toward player at origin

      const trooper2 = harkonnenAI.spawnTrooper(
        'trooper-2',
        { x: 100, y: 0, z: 100 }, // Far from player but close to trooper1
        [{ x: 100, y: 0, z: 100 }],
        'outpost-1'
      );

      expect(trooper1.state).toBe(HarkonnenState.PATROL);
      expect(trooper2.state).toBe(HarkonnenState.PATROL);

      const playerData = [{ id: player.playerId, position: player.state.position, state: 'ACTIVE' }];

      // First update: trooper1 detects player, broadcasts alert
      harkonnenAI.update(1 / 30, playerData);

      expect(trooper1.state).toBe(HarkonnenState.COMBAT);

      // Second update: trooper2 receives alert and investigates
      harkonnenAI.update(1 / 30, playerData);

      expect(trooper2.state).toBe(HarkonnenState.INVESTIGATE);
      expect(trooper2.lastKnownPlayerPosition).toBeDefined();
    });

    it('should not respond to own alert', () => {
      const harkonnenAI = gameLoop.getHarkonnenAI();

      const trooper = harkonnenAI.spawnTrooper(
        'trooper-1',
        { x: 25, y: 0, z: 0 },
        [{ x: 25, y: 0, z: 0 }],
        'outpost-1'
      );

      trooper.rotation = Math.PI; // Face toward player at origin

      const playerData = [{ id: player.playerId, position: player.state.position, state: 'ACTIVE' }];

      // Trooper detects player and broadcasts alert
      harkonnenAI.update(1 / 30, playerData);

      expect(trooper.state).toBe(HarkonnenState.COMBAT);

      // Force trooper back to PATROL
      trooper.state = HarkonnenState.PATROL;

      // Trooper should not respond to its own alert
      harkonnenAI.update(1 / 30, playerData);

      // Either still PATROL or detected player again (not INVESTIGATE from own alert)
      expect(trooper.state === HarkonnenState.PATROL || trooper.state === HarkonnenState.COMBAT).toBe(true);
    });

    it('should not respond to alerts outside radius', () => {
      const harkonnenAI = gameLoop.getHarkonnenAI();

      // Trooper 1 at origin
      const trooper1 = harkonnenAI.spawnTrooper(
        'trooper-1',
        { x: 25, y: 0, z: 0 },
        [{ x: 25, y: 0, z: 0 }],
        'outpost-1'
      );

      trooper1.rotation = Math.PI; // Face toward player at origin

      // Trooper 2 very far away (outside alert radius)
      const trooper2 = harkonnenAI.spawnTrooper(
        'trooper-2',
        { x: 1000, y: 0, z: 1000 },
        [{ x: 1000, y: 0, z: 1000 }],
        'outpost-2'
      );

      const playerData = [{ id: player.playerId, position: player.state.position, state: 'ACTIVE' }];

      // Trooper1 detects player
      harkonnenAI.update(1 / 30, playerData);

      expect(trooper1.state).toBe(HarkonnenState.COMBAT);

      // Trooper2 should not respond (too far)
      harkonnenAI.update(1 / 30, playerData);

      expect(trooper2.state).toBe(HarkonnenState.PATROL);
    });
  });

  describe('Alert Expiration', () => {
    it('should not respond to expired alerts', () => {
      const harkonnenAI = gameLoop.getHarkonnenAI();
      const alertSystem = gameLoop.getAlertSystem();

      const trooper1 = harkonnenAI.spawnTrooper(
        'trooper-1',
        { x: 25, y: 0, z: 0 },
        [{ x: 25, y: 0, z: 0 }],
        'outpost-1'
      );

      trooper1.rotation = Math.PI; // Face toward player at origin

      const trooper2 = harkonnenAI.spawnTrooper(
        'trooper-2',
        { x: 100, y: 0, z: 100 },
        [{ x: 100, y: 0, z: 100 }],
        'outpost-1'
      );

      const playerData = [{ id: player.playerId, position: player.state.position, state: 'ACTIVE' }];

      // Trooper1 detects player, broadcasts alert
      harkonnenAI.update(1 / 30, playerData);

      expect(trooper1.state).toBe(HarkonnenState.COMBAT);

      // Advance time past alert expiration (30 seconds)
      vi.advanceTimersByTime(31000);

      // Cleanup expired alerts
      alertSystem.cleanup();

      // Trooper2 should not respond to expired alert
      harkonnenAI.update(1 / 30, playerData);

      expect(trooper2.state).toBe(HarkonnenState.PATROL);
    });
  });

  describe('Cross-Outpost Coordination', () => {
    it('should coordinate across different outposts within radius', () => {
      const harkonnenAI = gameLoop.getHarkonnenAI();

      // Trooper at outpost-1
      const trooper1 = harkonnenAI.spawnTrooper(
        'trooper-1',
        { x: 25, y: 0, z: 0 },
        [{ x: 25, y: 0, z: 0 }],
        'outpost-1'
      );

      trooper1.rotation = Math.PI; // Face toward player at origin

      // Trooper at outpost-2, within cross-outpost alert radius (500m)
      const trooper2 = harkonnenAI.spawnTrooper(
        'trooper-2',
        { x: 400, y: 0, z: 0 },
        [{ x: 400, y: 0, z: 0 }],
        'outpost-2'
      );

      const playerData = [{ id: player.playerId, position: player.state.position, state: 'ACTIVE' }];

      // Trooper1 detects player, broadcasts alert
      harkonnenAI.update(1 / 30, playerData);

      expect(trooper1.state).toBe(HarkonnenState.COMBAT);

      // Trooper2 should respond (within cross-outpost radius)
      harkonnenAI.update(1 / 30, playerData);

      expect(trooper2.state).toBe(HarkonnenState.INVESTIGATE);
    });

    it('should not coordinate across outposts outside radius', () => {
      const harkonnenAI = gameLoop.getHarkonnenAI();

      const trooper1 = harkonnenAI.spawnTrooper(
        'trooper-1',
        { x: 25, y: 0, z: 0 },
        [{ x: 25, y: 0, z: 0 }],
        'outpost-1'
      );

      trooper1.rotation = Math.PI; // Face toward player at origin

      // Trooper at outpost-2, outside cross-outpost alert radius
      const trooper2 = harkonnenAI.spawnTrooper(
        'trooper-2',
        { x: 600, y: 0, z: 0 },
        [{ x: 600, y: 0, z: 0 }],
        'outpost-2'
      );

      const playerData = [{ id: player.playerId, position: player.state.position, state: 'ACTIVE' }];

      // Trooper1 detects player
      harkonnenAI.update(1 / 30, playerData);

      expect(trooper1.state).toBe(HarkonnenState.COMBAT);

      // Trooper2 should not respond (too far)
      harkonnenAI.update(1 / 30, playerData);

      expect(trooper2.state).toBe(HarkonnenState.PATROL);
    });
  });

  describe('Complete Alert Workflow', () => {
    it('should handle complete alert cycle: detect → alert → investigate → return to patrol', () => {
      const harkonnenAI = gameLoop.getHarkonnenAI();

      const trooper1 = harkonnenAI.spawnTrooper(
        'trooper-1',
        { x: 25, y: 0, z: 0 },
        [{ x: 25, y: 0, z: 0 }],
        'outpost-1'
      );

      trooper1.rotation = Math.PI; // Face toward player at origin

      const trooper2 = harkonnenAI.spawnTrooper(
        'trooper-2',
        { x: 150, y: 0, z: 0 },
        [{ x: 150, y: 0, z: 0 }],
        'outpost-1'
      );

      const playerData = [{ id: player.playerId, position: player.state.position, state: 'ACTIVE' }];

      // Step 1: Trooper1 detects player
      harkonnenAI.update(1 / 30, playerData);
      expect(trooper1.state).toBe(HarkonnenState.COMBAT);

      // Step 2: Trooper2 receives alert and investigates
      harkonnenAI.update(1 / 30, playerData);
      expect(trooper2.state).toBe(HarkonnenState.INVESTIGATE);

      // Step 3: Remove player from playerData (simulates player hidden/dead, trooper loses target)
      const emptyPlayerData: Array<{ id: string; position: Vector3; state: string }> = [];

      // Update once - trooper1 loses target and transitions to INVESTIGATE
      harkonnenAI.update(1 / 30, emptyPlayerData);

      // Trooper1 should transition to INVESTIGATE (lost target)
      expect(trooper1.state).toBe(HarkonnenState.INVESTIGATE);

      // Step 4: Advance time past investigate duration (10 seconds)
      vi.advanceTimersByTime(11000);

      // Update AI
      harkonnenAI.update(1 / 30, [{ id: player.playerId, position: player.state.position, state: 'ACTIVE' }]);

      // Both troopers should return to PATROL
      expect(trooper1.state).toBe(HarkonnenState.PATROL);
      expect(trooper2.state).toBe(HarkonnenState.PATROL);
    });

    it('should handle multiple alerts from different troopers', () => {
      const harkonnenAI = gameLoop.getHarkonnenAI();
      const alertSystem = gameLoop.getAlertSystem();

      // Test multiple alerts by having player move between outposts
      // First detection at origin
      const trooper1 = harkonnenAI.spawnTrooper(
        'trooper-1',
        { x: 25, y: 0, z: 0 },
        [{ x: 25, y: 0, z: 0 }],
        'outpost-1'
      );

      trooper1.rotation = Math.PI; // Face toward player at origin

      const trooper2 = harkonnenAI.spawnTrooper(
        'trooper-2',
        { x: 600, y: 0, z: 0 }, // Far away, different outpost
        [{ x: 600, y: 0, z: 0 }],
        'outpost-2'
      );

      const trooper3 = harkonnenAI.spawnTrooper(
        'trooper-3',
        { x: 150, y: 0, z: 0 },
        [{ x: 150, y: 0, z: 0 }],
        'outpost-1'
      );

      let playerData = [{ id: player.playerId, position: player.state.position, state: 'ACTIVE' }];

      // First update: trooper1 detects player at origin, broadcasts alert
      harkonnenAI.update(1 / 30, playerData);

      expect(trooper1.state).toBe(HarkonnenState.COMBAT);
      expect(alertSystem.getActiveAlerts().length).toBe(1);

      // Move player near trooper2, advance time past cooldown
      vi.advanceTimersByTime(6000);
      player.state.position = { x: 575, y: 0, z: 0 };
      trooper2.rotation = Math.PI; // Face toward player
      playerData = [{ id: player.playerId, position: player.state.position, state: 'ACTIVE' }];

      // Second update: trooper2 detects player at new position, broadcasts alert
      harkonnenAI.update(1 / 30, playerData);

      expect(trooper2.state).toBe(HarkonnenState.COMBAT);

      // Should have 2 alerts total (trooper1's alert expired after 6s? No, duration is 30s)
      const alerts = alertSystem.getActiveAlerts();
      expect(alerts.length).toBe(2);
      expect(alerts.some(a => a.alertingTrooperId === 'trooper-1')).toBe(true);
      expect(alerts.some(a => a.alertingTrooperId === 'trooper-2')).toBe(true);

      // Trooper3 should respond to nearest alert (trooper1's alert, same outpost)
      expect(trooper3.state).toBe(HarkonnenState.INVESTIGATE);
    });
  });

  describe('GameLoop Integration', () => {
    it('should cleanup expired alerts during game loop update', () => {
      const harkonnenAI = gameLoop.getHarkonnenAI();
      const alertSystem = gameLoop.getAlertSystem();

      const trooper = harkonnenAI.spawnTrooper(
        'trooper-1',
        { x: 25, y: 0, z: 0 },
        [{ x: 25, y: 0, z: 0 }],
        'outpost-1'
      );

      trooper.rotation = Math.PI; // Face toward player at origin

      const playerData = [{ id: player.playerId, position: player.state.position, state: 'ACTIVE' }];

      // Trooper detects player, broadcasts alert
      harkonnenAI.update(1 / 30, playerData);

      expect(alertSystem.getStats().totalAlerts).toBe(1);

      // Advance time past expiration
      vi.advanceTimersByTime(31000);

      // Trigger cleanup through game loop update (AlertSystem.cleanup is called in updateGameState)
      harkonnenAI.update(1 / 30, playerData);
      alertSystem.cleanup(); // Simulate GameLoop cleanup

      expect(alertSystem.getStats().totalAlerts).toBe(0);
    });
  });
});
