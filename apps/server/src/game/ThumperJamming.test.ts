import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Room } from './Room';
import { GameLoop } from './GameLoop';
import type { RoomPlayer } from './Room';
import { HarkonnenState } from './ai/HarkonnenAI';
import type { Socket } from 'socket.io';

describe('VS4: Thumper Jamming Integration', () => {
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

  describe('Full Thumper Jamming Cycle', () => {
    it('should stop targeting thumper when it becomes inactive', () => {
      // Deploy thumper
      room.deployThumper('player-1');
      const thumpers = room.getThumpers();
      const thumperId = thumpers[0].id;

      // Spawn Harkonnen
      const harkonnenAI = (gameLoop as any).harkonnenAI;
      const trooper = harkonnenAI.spawnTrooper('harkonnen-1', { x: 50, y: 0, z: 0 }, []);
      trooper.heading = Math.PI;

      // Trooper targets thumper
      (gameLoop as any).updateGameState(1);
      expect(trooper.targetThumperId).toBe(thumperId);

      // Manually disable thumper
      room.damageThumper(thumperId, 100);
      expect(thumpers[0].active).toBe(false);

      // Update again - trooper should clear target
      (gameLoop as any).updateGameState(1);
      expect(trooper.targetThumperId).toBeUndefined();
    });

    it('should continue targeting player if already in COMBAT state', () => {
      // Deploy thumper
      room.deployThumper('player-1');
      const thumpers = room.getThumpers();

      // Spawn Harkonnen
      const harkonnenAI = (gameLoop as any).harkonnenAI;
      const trooper = harkonnenAI.spawnTrooper('harkonnen-1', { x: 30, y: 0, z: 0 }, []);
      trooper.heading = Math.PI;
      trooper.state = HarkonnenState.COMBAT;
      trooper.targetPlayerId = 'player-1';

      // Player nearby
      player.state.position = { x: 35, y: 0, z: 0 };

      // Update - trooper should keep targeting player despite thumper presence
      (gameLoop as any).updateGameState(1);

      expect(trooper.targetPlayerId).toBe('player-1');
      expect(trooper.targetThumperId).toBeUndefined();
      expect(trooper.state).toBe(HarkonnenState.COMBAT);
    });
  });

  describe('Thumper Damage Integration', () => {
    it('should take 5 hits to destroy thumper with Harkonnen rifle', () => {
      // Deploy thumper
      room.deployThumper('player-1');
      const thumpers = room.getThumpers();
      const thumperId = thumpers[0].id;

      // Apply 5 shots of 20 damage each
      room.damageThumper(thumperId, 20);
      expect(thumpers[0].health).toBe(80);
      expect(thumpers[0].active).toBe(true);

      room.damageThumper(thumperId, 20);
      expect(thumpers[0].health).toBe(60);
      expect(thumpers[0].active).toBe(true);

      room.damageThumper(thumperId, 20);
      expect(thumpers[0].health).toBe(40);
      expect(thumpers[0].active).toBe(true);

      room.damageThumper(thumperId, 20);
      expect(thumpers[0].health).toBe(20);
      expect(thumpers[0].active).toBe(true);

      room.damageThumper(thumperId, 20);
      expect(thumpers[0].health).toBe(0);
      expect(thumpers[0].active).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should not target thumper beyond vision range', () => {
      // Deploy thumper far away
      player.state.position = { x: 0, y: 0, z: 500 };
      room.deployThumper('player-1');

      // Spawn Harkonnen at origin
      const harkonnenAI = (gameLoop as any).harkonnenAI;
      const trooper = harkonnenAI.spawnTrooper('harkonnen-1', { x: 0, y: 0, z: 0 }, []);
      trooper.heading = 0;

      // Update - should not target distant thumper (beyond 300m)
      (gameLoop as any).updateGameState(1);
      expect(trooper.targetThumperId).toBeUndefined();
    });

    it('should handle thumper expiration while being targeted', () => {
      // Deploy thumper
      room.deployThumper('player-1');
      const thumpers = room.getThumpers();
      const thumperId = thumpers[0].id;

      // Spawn Harkonnen
      const harkonnenAI = (gameLoop as any).harkonnenAI;
      const trooper = harkonnenAI.spawnTrooper('harkonnen-1', { x: 50, y: 0, z: 0 }, []);
      trooper.heading = Math.PI;

      // Trooper targets thumper
      (gameLoop as any).updateGameState(1);
      expect(trooper.targetThumperId).toBe(thumperId);

      // Advance time to expire thumper
      vi.advanceTimersByTime(61000);
      room.updateThumpers();

      expect(room.getThumpers()).toHaveLength(0);

      // Update - trooper should clear target (thumper no longer exists)
      (gameLoop as any).updateGameState(1);
      expect(trooper.targetThumperId).toBeUndefined();
    });
  });
});
