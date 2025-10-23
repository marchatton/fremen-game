import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Room } from './Room';
import { GameLoop } from './GameLoop';
import type { RoomPlayer } from './Room';
import { PlayerStateEnum } from '@fremen/shared';
import type { Socket } from 'socket.io';
import { HarkonnenState } from './ai/HarkonnenAI';

describe('VS4: Player Shooting Integration', () => {
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

  describe('Player Shoot Handler', () => {
    it('should successfully shoot at Harkonnen trooper', () => {
      // Spawn Harkonnen at position
      const harkonnenAI = (gameLoop as any).harkonnenAI;
      harkonnenAI.spawnTrooper('harkonnen-1', { x: 30, y: 0, z: 0 }, []);

      // Mock Math.random to ensure hit
      vi.spyOn(Math, 'random').mockReturnValue(0.5);

      // Player shoots at target position
      const result = gameLoop.handlePlayerShoot('player-1', { x: 30, y: 0, z: 0 });

      expect(result.success).toBe(true);
      expect(result.hit).toBe(true);
      expect(result.damage).toBe(25);
      expect(result.targetId).toBe('harkonnen-1');

      // Verify Harkonnen took damage
      const trooper = harkonnenAI.getTrooper('harkonnen-1');
      expect(trooper!.health).toBe(75);
    });

    it('should miss when shot misses (random roll fails)', () => {
      const harkonnenAI = (gameLoop as any).harkonnenAI;
      harkonnenAI.spawnTrooper('harkonnen-1', { x: 30, y: 0, z: 0 }, []);

      // Mock Math.random to ensure miss
      vi.spyOn(Math, 'random').mockReturnValue(0.99);

      const result = gameLoop.handlePlayerShoot('player-1', { x: 30, y: 0, z: 0 });

      expect(result.success).toBe(true);
      expect(result.hit).toBe(false);
      expect(result.reason).toBe('Shot missed');

      // Verify Harkonnen took no damage
      const trooper = harkonnenAI.getTrooper('harkonnen-1');
      expect(trooper!.health).toBe(100);
    });

    it('should fail when no Harkonnen in target area', () => {
      const harkonnenAI = (gameLoop as any).harkonnenAI;
      harkonnenAI.spawnTrooper('harkonnen-1', { x: 100, y: 0, z: 0 }, []);

      const result = gameLoop.handlePlayerShoot('player-1', { x: 30, y: 0, z: 0 });

      expect(result.success).toBe(true);
      expect(result.hit).toBe(false);
      expect(result.reason).toBe('No target in range');
    });

    it('should respect fire rate cooldown', () => {
      const harkonnenAI = (gameLoop as any).harkonnenAI;
      harkonnenAI.spawnTrooper('harkonnen-1', { x: 30, y: 0, z: 0 }, []);

      vi.spyOn(Math, 'random').mockReturnValue(0.5);

      // First shot should succeed
      const result1 = gameLoop.handlePlayerShoot('player-1', { x: 30, y: 0, z: 0 });
      expect(result1.success).toBe(true);
      expect(result1.hit).toBe(true);

      // Immediate second shot should fail (within 500ms cooldown)
      const result2 = gameLoop.handlePlayerShoot('player-1', { x: 30, y: 0, z: 0 });
      expect(result2.success).toBe(false);
      expect(result2.reason).toBe('Fire rate cooldown');

      // After 500ms, should succeed again
      vi.advanceTimersByTime(500);
      const result3 = gameLoop.handlePlayerShoot('player-1', { x: 30, y: 0, z: 0 });
      expect(result3.success).toBe(true);
      expect(result3.hit).toBe(true);
    });

    it('should fail when player is dead', () => {
      player.state.state = PlayerStateEnum.DEAD;

      const result = gameLoop.handlePlayerShoot('player-1', { x: 30, y: 0, z: 0 });

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Player is dead');
    });

    it('should fail when player not found', () => {
      const result = gameLoop.handlePlayerShoot('nonexistent', { x: 30, y: 0, z: 0 });

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Player not found');
    });

    it('should not shoot dead Harkonnen', () => {
      const harkonnenAI = (gameLoop as any).harkonnenAI;
      const trooper = harkonnenAI.spawnTrooper('harkonnen-1', { x: 30, y: 0, z: 0 }, []);
      trooper.state = HarkonnenState.DEAD;

      const result = gameLoop.handlePlayerShoot('player-1', { x: 30, y: 0, z: 0 });

      expect(result.success).toBe(true);
      expect(result.hit).toBe(false);
      expect(result.reason).toBe('No target in range');
    });

    it('should find nearest Harkonnen to target point', () => {
      const harkonnenAI = (gameLoop as any).harkonnenAI;
      harkonnenAI.spawnTrooper('harkonnen-1', { x: 30, y: 0, z: 0 }, []);
      harkonnenAI.spawnTrooper('harkonnen-2', { x: 32, y: 0, z: 0 }, []); // Slightly farther

      vi.spyOn(Math, 'random').mockReturnValue(0.5);

      // Shoot at position closer to harkonnen-1
      const result = gameLoop.handlePlayerShoot('player-1', { x: 29, y: 0, z: 0 });

      expect(result.success).toBe(true);
      expect(result.hit).toBe(true);
      expect(result.targetId).toBe('harkonnen-1');
    });
  });

  describe('Kill Harkonnen', () => {
    it('should kill Harkonnen with 4 shots', () => {
      const harkonnenAI = (gameLoop as any).harkonnenAI;
      harkonnenAI.spawnTrooper('harkonnen-1', { x: 30, y: 0, z: 0 }, []);

      vi.spyOn(Math, 'random').mockReturnValue(0.5);

      // Fire 4 shots (4 * 25 = 100 damage)
      for (let i = 0; i < 4; i++) {
        vi.advanceTimersByTime(500); // Wait for cooldown
        const result = gameLoop.handlePlayerShoot('player-1', { x: 30, y: 0, z: 0 });
        expect(result.success).toBe(true);
        expect(result.hit).toBe(true);
      }

      // Verify Harkonnen is dead
      const trooper = harkonnenAI.getTrooper('harkonnen-1');
      expect(trooper!.health).toBe(0);
      expect(trooper!.state).toBe(HarkonnenState.DEAD);
    });

    it('should log when Harkonnen is killed', () => {
      const harkonnenAI = (gameLoop as any).harkonnenAI;
      harkonnenAI.spawnTrooper('harkonnen-1', { x: 30, y: 0, z: 0 }, []);

      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const consoleSpy = vi.spyOn(console, 'log');

      // Reduce health to 25, then kill
      const trooper = harkonnenAI.getTrooper('harkonnen-1')!;
      trooper.health = 25;

      const result = gameLoop.handlePlayerShoot('player-1', { x: 30, y: 0, z: 0 });

      expect(result.success).toBe(true);
      expect(result.hit).toBe(true);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Player player-1 killed Harkonnen harkonnen-1')
      );
    });
  });

  describe('Combat Distance', () => {
    it('should hit at close range (high accuracy)', () => {
      const harkonnenAI = (gameLoop as any).harkonnenAI;
      harkonnenAI.spawnTrooper('harkonnen-1', { x: 10, y: 0, z: 0 }, []); // 10m away

      vi.spyOn(Math, 'random').mockReturnValue(0.95); // High roll

      const result = gameLoop.handlePlayerShoot('player-1', { x: 10, y: 0, z: 0 });

      // At 10m, hit chance is ~99%, so 0.95 roll should hit
      expect(result.success).toBe(true);
      expect(result.hit).toBe(true);
    });

    it('should miss at max range with high roll', () => {
      const harkonnenAI = (gameLoop as any).harkonnenAI;
      harkonnenAI.spawnTrooper('harkonnen-1', { x: 100, y: 0, z: 0 }, []); // 100m away (max range)

      vi.spyOn(Math, 'random').mockReturnValue(0.95); // Higher than 90% accuracy

      const result = gameLoop.handlePlayerShoot('player-1', { x: 100, y: 0, z: 0 });

      // At 100m, hit chance is 90%, so 0.95 roll should miss
      expect(result.success).toBe(true);
      expect(result.hit).toBe(false);
    });

    it('should miss beyond max range', () => {
      const harkonnenAI = (gameLoop as any).harkonnenAI;
      harkonnenAI.spawnTrooper('harkonnen-1', { x: 150, y: 0, z: 0 }, []); // 150m away (beyond 100m range)

      vi.spyOn(Math, 'random').mockReturnValue(0.5);

      const result = gameLoop.handlePlayerShoot('player-1', { x: 150, y: 0, z: 0 });

      expect(result.success).toBe(true);
      expect(result.hit).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle multiple Harkonnen at different distances', () => {
      const harkonnenAI = (gameLoop as any).harkonnenAI;
      harkonnenAI.spawnTrooper('close', { x: 30, y: 0, z: 0 }, []);
      harkonnenAI.spawnTrooper('far', { x: 90, y: 0, z: 0 }, []);

      vi.spyOn(Math, 'random').mockReturnValue(0.5);

      // Shoot at close target
      const result1 = gameLoop.handlePlayerShoot('player-1', { x: 30, y: 0, z: 0 });
      expect(result1.targetId).toBe('close');

      vi.advanceTimersByTime(500);

      // Shoot at far target
      const result2 = gameLoop.handlePlayerShoot('player-1', { x: 90, y: 0, z: 0 });
      expect(result2.targetId).toBe('far');
    });

    it('should update lastFireTime even on miss', () => {
      const harkonnenAI = (gameLoop as any).harkonnenAI;
      harkonnenAI.spawnTrooper('harkonnen-1', { x: 30, y: 0, z: 0 }, []);

      vi.spyOn(Math, 'random').mockReturnValue(0.99); // Miss

      const initialFireTime = player.lastFireTime;

      gameLoop.handlePlayerShoot('player-1', { x: 30, y: 0, z: 0 });

      expect(player.lastFireTime).toBeGreaterThan(initialFireTime);
    });

    it('should update lastFireTime even when no target found', () => {
      const initialFireTime = player.lastFireTime;

      gameLoop.handlePlayerShoot('player-1', { x: 30, y: 0, z: 0 });

      expect(player.lastFireTime).toBeGreaterThan(initialFireTime);
    });
  });

  describe('Loot Drops', () => {
    it('should spawn loot when Harkonnen is killed', () => {
      const harkonnenAI = (gameLoop as any).harkonnenAI;
      harkonnenAI.spawnTrooper('harkonnen-1', { x: 30, y: 0, z: 0 }, []);

      vi.spyOn(Math, 'random').mockReturnValue(0.5);

      // Reduce trooper to 25 health
      const trooper = harkonnenAI.getTrooper('harkonnen-1')!;
      trooper.health = 25;

      // Check no loot exists before kill
      let lootDrops = room.getLootDrops();
      expect(lootDrops).toHaveLength(0);

      // Kill the trooper
      const result = gameLoop.handlePlayerShoot('player-1', { x: 30, y: 0, z: 0 });
      expect(result.success).toBe(true);
      expect(result.hit).toBe(true);

      // Verify loot was spawned
      lootDrops = room.getLootDrops();
      expect(lootDrops).toHaveLength(1);
      expect(lootDrops[0].position.x).toBe(30);
      expect(lootDrops[0].position.y).toBe(0);
      expect(lootDrops[0].position.z).toBe(0);
      expect(lootDrops[0].spice).toBeGreaterThanOrEqual(10);
      expect(lootDrops[0].spice).toBeLessThanOrEqual(30);
    });

    it('should not spawn loot when Harkonnen is hit but not killed', () => {
      const harkonnenAI = (gameLoop as any).harkonnenAI;
      harkonnenAI.spawnTrooper('harkonnen-1', { x: 30, y: 0, z: 0 }, []);

      vi.spyOn(Math, 'random').mockReturnValue(0.5);

      // Hit but not kill
      gameLoop.handlePlayerShoot('player-1', { x: 30, y: 0, z: 0 });

      // Verify no loot was spawned
      const lootDrops = room.getLootDrops();
      expect(lootDrops).toHaveLength(0);
    });

    it('should spawn multiple loot drops when killing multiple troopers', () => {
      const harkonnenAI = (gameLoop as any).harkonnenAI;
      harkonnenAI.spawnTrooper('harkonnen-1', { x: 30, y: 0, z: 0 }, []);
      harkonnenAI.spawnTrooper('harkonnen-2', { x: 60, y: 0, z: 0 }, []);

      vi.spyOn(Math, 'random').mockReturnValue(0.5);

      // Set both troopers to low health
      harkonnenAI.getTrooper('harkonnen-1')!.health = 25;
      harkonnenAI.getTrooper('harkonnen-2')!.health = 25;

      // Kill first trooper
      vi.advanceTimersByTime(500);
      gameLoop.handlePlayerShoot('player-1', { x: 30, y: 0, z: 0 });

      // Kill second trooper
      vi.advanceTimersByTime(500);
      gameLoop.handlePlayerShoot('player-1', { x: 60, y: 0, z: 0 });

      // Verify two loot drops were spawned
      const lootDrops = room.getLootDrops();
      expect(lootDrops).toHaveLength(2);
    });

    it('should spawn loot at trooper death position', () => {
      const harkonnenAI = (gameLoop as any).harkonnenAI;
      const deathPosition = { x: 42, y: 0, z: 73 };
      harkonnenAI.spawnTrooper('harkonnen-1', deathPosition, []);

      vi.spyOn(Math, 'random').mockReturnValue(0.5);

      // Set trooper to low health
      const trooper = harkonnenAI.getTrooper('harkonnen-1')!;
      trooper.health = 25;

      // Kill the trooper
      player.state.position = deathPosition; // Move player close to trooper
      gameLoop.handlePlayerShoot('player-1', deathPosition);

      // Verify loot spawned at correct position
      const lootDrops = room.getLootDrops();
      expect(lootDrops).toHaveLength(1);
      expect(lootDrops[0].position).toEqual(deathPosition);
    });
  });
});
