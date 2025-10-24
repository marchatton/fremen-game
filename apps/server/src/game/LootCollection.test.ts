import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Room } from './Room';
import { GameLoop } from './GameLoop';
import type { RoomPlayer } from './Room';
import { PlayerStateEnum } from '@fremen/shared';
import type { Socket } from 'socket.io';

describe('VS4: Loot Collection Integration', () => {
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
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Proximity-based Collection', () => {
    it('should auto-collect loot when player is within 5m radius', () => {
      // Spawn loot at position
      const lootPosition = { x: 100, y: 0, z: 100 };
      room.spawnLoot(lootPosition, 25);

      const initialSpice = player.resources.spice;

      // Move player close to loot (within 5m)
      player.state.position = { x: 102, y: 0, z: 102 }; // ~2.8m away

      // Trigger game update
      (gameLoop as any).updateGameState(1 / 30);

      // Verify loot was collected
      expect(player.resources.spice).toBe(initialSpice + 25);

      // Verify loot was removed
      const lootDrops = room.getLootDrops();
      expect(lootDrops).toHaveLength(0);
    });

    it('should not collect loot when player is beyond 5m radius', () => {
      // Spawn loot at position
      const lootPosition = { x: 100, y: 0, z: 100 };
      room.spawnLoot(lootPosition, 25);

      const initialSpice = player.resources.spice;

      // Move player far from loot (beyond 5m)
      player.state.position = { x: 110, y: 0, z: 110 }; // ~14.1m away

      // Trigger game update
      (gameLoop as any).updateGameState(1 / 30);

      // Verify loot was NOT collected
      expect(player.resources.spice).toBe(initialSpice);

      // Verify loot still exists
      const lootDrops = room.getLootDrops();
      expect(lootDrops).toHaveLength(1);
    });

    it('should not collect loot when player is dead', () => {
      // Spawn loot at position
      const lootPosition = { x: 100, y: 0, z: 100 };
      room.spawnLoot(lootPosition, 25);

      const initialSpice = player.resources.spice;

      // Move player close to loot
      player.state.position = { x: 102, y: 0, z: 102 };

      // Kill player
      player.state.state = PlayerStateEnum.DEAD;

      // Trigger game update
      (gameLoop as any).updateGameState(1 / 30);

      // Verify loot was NOT collected
      expect(player.resources.spice).toBe(initialSpice);

      // Verify loot still exists
      const lootDrops = room.getLootDrops();
      expect(lootDrops).toHaveLength(1);
    });

    it('should collect exactly at 5m boundary', () => {
      // Spawn loot at position
      const lootPosition = { x: 100, y: 0, z: 100 };
      room.spawnLoot(lootPosition, 25);

      const initialSpice = player.resources.spice;

      // Move player exactly 5m away
      player.state.position = { x: 105, y: 0, z: 100 }; // Exactly 5m on x-axis

      // Trigger game update
      (gameLoop as any).updateGameState(1 / 30);

      // Verify loot was collected (5m is inclusive)
      expect(player.resources.spice).toBe(initialSpice + 25);

      // Verify loot was removed
      const lootDrops = room.getLootDrops();
      expect(lootDrops).toHaveLength(0);
    });

    it('should collect multiple loot drops in range', () => {
      // Spawn multiple loot drops nearby
      room.spawnLoot({ x: 100, y: 0, z: 100 }, 10);
      room.spawnLoot({ x: 102, y: 0, z: 102 }, 15);
      room.spawnLoot({ x: 103, y: 0, z: 103 }, 20);

      const initialSpice = player.resources.spice;

      // Move player to center of loot cluster
      player.state.position = { x: 101, y: 0, z: 101 };

      // Trigger game update
      (gameLoop as any).updateGameState(1 / 30);

      // Verify all loot was collected (10 + 15 + 20 = 45)
      expect(player.resources.spice).toBe(initialSpice + 45);

      // Verify all loot was removed
      const lootDrops = room.getLootDrops();
      expect(lootDrops).toHaveLength(0);
    });

    it('should only collect loot in range from multiple drops', () => {
      // Spawn loot drops at various distances
      room.spawnLoot({ x: 100, y: 0, z: 100 }, 10); // ~4.2m away
      room.spawnLoot({ x: 150, y: 0, z: 150 }, 15); // ~70.7m away

      const initialSpice = player.resources.spice;

      // Move player close to first loot only
      player.state.position = { x: 103, y: 0, z: 103 };

      // Trigger game update
      (gameLoop as any).updateGameState(1 / 30);

      // Verify only nearby loot was collected
      expect(player.resources.spice).toBe(initialSpice + 10);

      // Verify far loot still exists
      const lootDrops = room.getLootDrops();
      expect(lootDrops).toHaveLength(1);
      expect(lootDrops[0].spice).toBe(15);
    });
  });

  describe('Loot Expiration During Gameplay', () => {
    it('should expire loot after 60 seconds', () => {
      // Spawn loot
      room.spawnLoot({ x: 100, y: 0, z: 100 }, 25);

      // Verify loot exists
      let lootDrops = room.getLootDrops();
      expect(lootDrops).toHaveLength(1);

      // Advance time past expiration
      vi.advanceTimersByTime(61000);

      // Trigger game update (calls room.updateLoot())
      (gameLoop as any).updateGameState(1 / 30);

      // Verify loot was removed
      lootDrops = room.getLootDrops();
      expect(lootDrops).toHaveLength(0);
    });

    it('should not expire loot before 60 seconds', () => {
      // Spawn loot
      room.spawnLoot({ x: 100, y: 0, z: 100 }, 25);

      // Advance time but not past expiration
      vi.advanceTimersByTime(59000);

      // Trigger game update
      (gameLoop as any).updateGameState(1 / 30);

      // Verify loot still exists
      const lootDrops = room.getLootDrops();
      expect(lootDrops).toHaveLength(1);
    });
  });

  describe('Full Loot Cycle Integration', () => {
    it('should spawn, persist, and collect loot in full cycle', () => {
      // 1. Spawn Harkonnen
      const harkonnenAI = (gameLoop as any).harkonnenAI;
      harkonnenAI.spawnTrooper('harkonnen-1', { x: 30, y: 0, z: 0 }, []);

      // 2. Kill Harkonnen to spawn loot
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const trooper = harkonnenAI.getTrooper('harkonnen-1')!;
      trooper.health = 25;

      player.state.position = { x: 0, y: 0, z: 0 };
      gameLoop.handlePlayerShoot('player-1', { x: 30, y: 0, z: 0 });

      // Verify loot spawned
      let lootDrops = room.getLootDrops();
      expect(lootDrops).toHaveLength(1);

      const initialSpice = player.resources.spice;

      // 3. Move player to loot
      player.state.position = { x: 30, y: 0, z: 0 };

      // 4. Trigger auto-collection
      (gameLoop as any).updateGameState(1 / 30);

      // 5. Verify collection
      expect(player.resources.spice).toBeGreaterThan(initialSpice);

      // Verify loot removed
      lootDrops = room.getLootDrops();
      expect(lootDrops).toHaveLength(0);
    });

    it('should handle loot expiration if player does not collect', () => {
      // 1. Spawn Harkonnen and kill to spawn loot
      const harkonnenAI = (gameLoop as any).harkonnenAI;
      harkonnenAI.spawnTrooper('harkonnen-1', { x: 30, y: 0, z: 0 }, []);

      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const trooper = harkonnenAI.getTrooper('harkonnen-1')!;
      trooper.health = 25;

      player.state.position = { x: 0, y: 0, z: 0 };
      gameLoop.handlePlayerShoot('player-1', { x: 30, y: 0, z: 0 });

      // Verify loot spawned
      let lootDrops = room.getLootDrops();
      expect(lootDrops).toHaveLength(1);

      const initialSpice = player.resources.spice;

      // 2. Keep player far away and advance time
      player.state.position = { x: 200, y: 0, z: 200 };
      vi.advanceTimersByTime(61000);

      // 3. Trigger game update
      (gameLoop as any).updateGameState(1 / 30);

      // 4. Verify loot expired without collection
      expect(player.resources.spice).toBe(initialSpice); // No change
      lootDrops = room.getLootDrops();
      expect(lootDrops).toHaveLength(0); // Loot expired
    });
  });
});
