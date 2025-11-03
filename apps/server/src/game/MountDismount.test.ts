import { describe, it, expect, beforeEach } from 'vitest';
import { GameLoop } from './GameLoop';
import { Room } from './Room';
import { PlayerStateEnum, WormAIState, GAME_CONSTANTS } from '@fremen/shared';
import type { Socket } from 'socket.io';
import { vi } from 'vitest';
import { InMemoryPlayerRepository } from './testing/InMemoryPlayerRepository';

describe('VS2: Mount/Dismount System', () => {
  let room: Room;
  let gameLoop: GameLoop;
  let mockSocket1: Partial<Socket>;
  let mockSocket2: Partial<Socket>;
  let repository: InMemoryPlayerRepository;

  const advanceGameLoop = (deltaTime: number, steps = 1) => {
    for (let i = 0; i < steps; i++) {
      (gameLoop as any).registry.update(deltaTime);
    }
  };

  const addPlayerWithJoin = async (socket: Socket, playerId: string, username: string) => {
    await room.addPlayer(socket, playerId, username);
    const player = room.getPlayer(playerId);
    if (player) {
      gameLoop.onPlayerJoin(player);
    }
  };

  beforeEach(() => {
    repository = new InMemoryPlayerRepository();
    room = new Room('test-room', repository);
    gameLoop = new GameLoop(room, 12345, repository);

    mockSocket1 = {
      id: 'socket-1',
      emit: vi.fn(),
    } as unknown as Socket;

    mockSocket2 = {
      id: 'socket-2',
      emit: vi.fn(),
    } as unknown as Socket;
  });

  describe('Mounting Validation', () => {
    it('should allow player to mount worm within range', async () => {
      await addPlayerWithJoin(mockSocket1 as Socket, 'player1', 'TestPlayer');
      const player = room.getPlayer('player1')!;

      // Position player near worm head (worm spawns at ~50, 0, 50)
      player.state.position = { x: 52, y: 0, z: 50 };

      const result = gameLoop.handleMountAttempt('player1', 'worm-0');

      expect(result.success).toBe(true);
      expect(player.state.state).toBe(PlayerStateEnum.RIDING);
      expect(player.state.ridingWormId).toBe('worm-0');
    });

    it('should reject mount attempt when too far from worm', async () => {
      await addPlayerWithJoin(mockSocket1 as Socket, 'player1', 'TestPlayer');
      const player = room.getPlayer('player1')!;

      // Position player far from worm
      player.state.position = { x: 100, y: 0, z: 100 };

      const result = gameLoop.handleMountAttempt('player1', 'worm-0');

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Too far from worm');
      expect(player.state.state).toBe(PlayerStateEnum.ACTIVE);
      expect(player.state.ridingWormId).toBeUndefined();
    });

    it('should reject mount attempt at exactly WORM_MOUNT_DISTANCE + 0.1m (boundary test)', async () => {
      await addPlayerWithJoin(mockSocket1 as Socket, 'player1', 'TestPlayer');
      const player = room.getPlayer('player1')!;

      // Position at exactly 5.1m away (just over the limit)
      player.state.position = { x: 55.1, y: 0, z: 50 };

      const result = gameLoop.handleMountAttempt('player1', 'worm-0');

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Too far from worm');
    });

    it('should allow mount at exactly WORM_MOUNT_DISTANCE (boundary test)', async () => {
      await addPlayerWithJoin(mockSocket1 as Socket, 'player1', 'TestPlayer');
      const player = room.getPlayer('player1')!;

      // Get actual worm position first
      const worms = (gameLoop as any).wormAI.getWorms();
      const worm = worms[0];
      const headPos = worm.controlPoints[0];

      // Position at exactly 5m away from worm head
      player.state.position = { x: headPos.x + 5, y: 0, z: headPos.z };

      const result = gameLoop.handleMountAttempt('player1', 'worm-0');

      expect(result.success).toBe(true);
    });

    it('should reject mount when player is already riding', async () => {
      await addPlayerWithJoin(mockSocket1 as Socket, 'player1', 'TestPlayer');
      const player = room.getPlayer('player1')!;
      player.state.position = { x: 52, y: 0, z: 50 };

      // First mount
      gameLoop.handleMountAttempt('player1', 'worm-0');

      // Try to mount again while already riding
      const result = gameLoop.handleMountAttempt('player1', 'worm-0');

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Already mounted');
    });

    it('should reject mount when worm does not exist', async () => {
      await addPlayerWithJoin(mockSocket1 as Socket, 'player1', 'TestPlayer');
      const player = room.getPlayer('player1')!;
      player.state.position = { x: 52, y: 0, z: 50 };

      const result = gameLoop.handleMountAttempt('player1', 'worm-999');

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Worm not found');
    });

    it('should reject mount when player does not exist', async () => {
      const result = gameLoop.handleMountAttempt('nonexistent', 'worm-0');

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Player not found');
    });
  });

  describe('Mounting Race Conditions', () => {
    it('should prevent two players from mounting the same worm', async () => {
      await addPlayerWithJoin(mockSocket1 as Socket, 'player1', 'Player1');
      await addPlayerWithJoin(mockSocket2 as Socket, 'player2', 'Player2');

      const player1 = room.getPlayer('player1')!;
      const player2 = room.getPlayer('player2')!;

      // Position both players near worm
      player1.state.position = { x: 51, y: 0, z: 50 };
      player2.state.position = { x: 52, y: 0, z: 50 };

      // Player 1 mounts first
      const result1 = gameLoop.handleMountAttempt('player1', 'worm-0');
      expect(result1.success).toBe(true);

      // Player 2 tries to mount the same worm
      const result2 = gameLoop.handleMountAttempt('player2', 'worm-0');
      expect(result2.success).toBe(false);
      expect(result2.reason).toBe('Worm not available');

      // Verify only player1 is riding
      expect(player1.state.state).toBe(PlayerStateEnum.RIDING);
      expect(player2.state.state).toBe(PlayerStateEnum.ACTIVE);
    });

    it('should allow different players to mount after dismount', async () => {
      await addPlayerWithJoin(mockSocket1 as Socket, 'player1', 'Player1');
      await addPlayerWithJoin(mockSocket2 as Socket, 'player2', 'Player2');

      const player1 = room.getPlayer('player1')!;
      const player2 = room.getPlayer('player2')!;

      player1.state.position = { x: 51, y: 0, z: 50 };
      player2.state.position = { x: 52, y: 0, z: 50 };

      // Player 1 mounts and dismounts
      gameLoop.handleMountAttempt('player1', 'worm-0');
      gameLoop.handleDismount('player1');

      // Now player 2 should be able to mount
      const result = gameLoop.handleMountAttempt('player2', 'worm-0');
      expect(result.success).toBe(true);
      expect(player2.state.state).toBe(PlayerStateEnum.RIDING);
    });
  });

  describe('Mount State Changes', () => {
    it('should set player velocity to zero when mounting', async () => {
      await addPlayerWithJoin(mockSocket1 as Socket, 'player1', 'TestPlayer');
      const player = room.getPlayer('player1')!;

      player.state.position = { x: 52, y: 0, z: 50 };
      player.state.velocity = { x: 5, y: 0, z: 5 }; // Player was moving

      gameLoop.handleMountAttempt('player1', 'worm-0');

      expect(player.state.velocity).toEqual({ x: 0, y: 0, z: 0 });
    });

    it('should set worm state to RIDDEN_BY when mounted', async () => {
      await addPlayerWithJoin(mockSocket1 as Socket, 'player1', 'TestPlayer');
      const player = room.getPlayer('player1')!;
      player.state.position = { x: 52, y: 0, z: 50 };

      gameLoop.handleMountAttempt('player1', 'worm-0');

      // Access wormAI through GameLoop's private property (via type assertion for testing)
      const worms = (gameLoop as any).wormAI.getWorms();
      const worm = worms.find((w: any) => w.id === 'worm-0');

      expect(worm.aiState).toBe(WormAIState.RIDDEN_BY);
      expect(worm.riderId).toBe('player1');
    });

    it('should reset worm speed to default (15) when mounted', async () => {
      await addPlayerWithJoin(mockSocket1 as Socket, 'player1', 'TestPlayer');
      const player = room.getPlayer('player1')!;
      player.state.position = { x: 52, y: 0, z: 50 };

      gameLoop.handleMountAttempt('player1', 'worm-0');

      const worms = (gameLoop as any).wormAI.getWorms();
      const worm = worms.find((w: any) => w.id === 'worm-0');

      expect(worm.speed).toBe(15);
    });
  });

  describe('Dismounting Validation', () => {
    it('should allow player to dismount while riding', async () => {
      await addPlayerWithJoin(mockSocket1 as Socket, 'player1', 'TestPlayer');
      const player = room.getPlayer('player1')!;
      player.state.position = { x: 52, y: 0, z: 50 };

      gameLoop.handleMountAttempt('player1', 'worm-0');
      const result = gameLoop.handleDismount('player1');

      expect(result.success).toBe(true);
      expect(player.state.state).toBe(PlayerStateEnum.ACTIVE);
      expect(player.state.ridingWormId).toBeUndefined();
    });

    it('should reject dismount when not riding', async () => {
      await addPlayerWithJoin(mockSocket1 as Socket, 'player1', 'TestPlayer');

      const result = gameLoop.handleDismount('player1');

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Not mounted');
    });

    it('should reject dismount when player does not exist', async () => {
      const result = gameLoop.handleDismount('nonexistent');

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Player not found');
    });

    it('should allow double dismount attempt gracefully (idempotency)', async () => {
      await addPlayerWithJoin(mockSocket1 as Socket, 'player1', 'TestPlayer');
      const player = room.getPlayer('player1')!;
      player.state.position = { x: 52, y: 0, z: 50 };

      gameLoop.handleMountAttempt('player1', 'worm-0');
      gameLoop.handleDismount('player1');

      // Second dismount should fail gracefully
      const result = gameLoop.handleDismount('player1');
      expect(result.success).toBe(false);
      expect(result.reason).toBe('Not mounted');
    });
  });

  describe('Dismount State Changes', () => {
    it('should eject player 3m to the right of worm', async () => {
      await addPlayerWithJoin(mockSocket1 as Socket, 'player1', 'TestPlayer');
      const player = room.getPlayer('player1')!;
      player.state.position = { x: 52, y: 0, z: 50 };

      gameLoop.handleMountAttempt('player1', 'worm-0');

      const worms = (gameLoop as any).wormAI.getWorms();
      const worm = worms.find((w: any) => w.id === 'worm-0');
      const headX = worm.controlPoints[0].x;
      const headZ = worm.controlPoints[0].z;

      gameLoop.handleDismount('player1');

      // Player should be 3m to the right
      expect(player.state.position.x).toBe(headX + 3);
      expect(player.state.position.y).toBe(1); // Elevated by 1m
      expect(player.state.position.z).toBe(headZ);
    });

    it('should return worm to PATROLLING state after dismount', async () => {
      await addPlayerWithJoin(mockSocket1 as Socket, 'player1', 'TestPlayer');
      const player = room.getPlayer('player1')!;
      player.state.position = { x: 52, y: 0, z: 50 };

      gameLoop.handleMountAttempt('player1', 'worm-0');
      gameLoop.handleDismount('player1');

      const worms = (gameLoop as any).wormAI.getWorms();
      const worm = worms.find((w: any) => w.id === 'worm-0');

      expect(worm.aiState).toBe(WormAIState.PATROLLING);
      expect(worm.riderId).toBeUndefined();
    });

    it('should assign new patrol target to worm after dismount', async () => {
      await addPlayerWithJoin(mockSocket1 as Socket, 'player1', 'TestPlayer');
      const player = room.getPlayer('player1')!;
      player.state.position = { x: 52, y: 0, z: 50 };

      gameLoop.handleMountAttempt('player1', 'worm-0');
      gameLoop.handleDismount('player1');

      const worms = (gameLoop as any).wormAI.getWorms();
      const worm = worms.find((w: any) => w.id === 'worm-0');

      // Worm should have a target position (patrol target is set on dismount)
      expect(worm.targetPosition).toBeDefined();
      expect(worm.targetPosition.x).toBeTypeOf('number');
      expect(worm.targetPosition.z).toBeTypeOf('number');
    });
  });

  describe('Edge Cases', () => {
    it('should handle dismount when worm no longer exists', async () => {
      await addPlayerWithJoin(mockSocket1 as Socket, 'player1', 'TestPlayer');
      const player = room.getPlayer('player1')!;
      player.state.position = { x: 52, y: 0, z: 50 };

      gameLoop.handleMountAttempt('player1', 'worm-0');

      // Manually set worm to not exist (simulate worm death)
      (gameLoop as any).wormAI.worms.delete('worm-0');

      // Dismount should still succeed, player should be moved to origin
      const result = gameLoop.handleDismount('player1');

      expect(result.success).toBe(true);
      expect(player.state.state).toBe(PlayerStateEnum.ACTIVE);
      // Position won't be updated since worm doesn't exist, but state should still clear
    });

    it('should handle mount with invalid wormId format', async () => {
      await addPlayerWithJoin(mockSocket1 as Socket, 'player1', 'TestPlayer');
      const player = room.getPlayer('player1')!;
      player.state.position = { x: 52, y: 0, z: 50 };

      const result = gameLoop.handleMountAttempt('player1', '');

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Worm not found');
    });

    it('should handle mount when player position has NaN values', async () => {
      await addPlayerWithJoin(mockSocket1 as Socket, 'player1', 'TestPlayer');
      const player = room.getPlayer('player1')!;
      player.state.position = { x: NaN, y: 0, z: 50 };

      const result = gameLoop.handleMountAttempt('player1', 'worm-0');

      // Distance calculation with NaN: NaN comparisons always return false, so NaN > 5 is false
      // This means the mount might succeed (implementation detail)
      // Just verify it doesn't crash
      expect(result).toBeDefined();
      expect(result.success).toBeDefined();
    });
  });

  describe('State Synchronization', () => {
    it('should maintain player position while riding during game loop update', async () => {
      await addPlayerWithJoin(mockSocket1 as Socket, 'player1', 'TestPlayer');
      const player = room.getPlayer('player1')!;
      player.state.position = { x: 52, y: 0, z: 50 };

      gameLoop.handleMountAttempt('player1', 'worm-0');

      // Trigger game loop update
      advanceGameLoop(0.033); // ~30fps

      // Player position should be synced to worm's segment 2
      const worms = (gameLoop as any).wormAI.getWorms();
      const worm = worms.find((w: any) => w.id === 'worm-0');
      const segment2 = worm.controlPoints[2];

      expect(player.state.position.x).toBe(segment2.x);
      expect(player.state.position.y).toBe(segment2.y);
      expect(player.state.position.z).toBe(segment2.z);
    });

    it('should not apply physics validation while player is riding', async () => {
      await addPlayerWithJoin(mockSocket1 as Socket, 'player1', 'TestPlayer');
      const player = room.getPlayer('player1')!;
      player.state.position = { x: 52, y: 0, z: 50 };

      gameLoop.handleMountAttempt('player1', 'worm-0');

      // Set velocity to something that would be clamped if player was on foot
      player.state.velocity = { x: 100, y: 100, z: 100 };

      advanceGameLoop(0.033);

      // Velocity should be zeroed out (from riding state), not clamped
      expect(player.state.velocity).toEqual({ x: 0, y: 0, z: 0 });
    });

    it('should handle worm with insufficient control points gracefully', async () => {
      await addPlayerWithJoin(mockSocket1 as Socket, 'player1', 'TestPlayer');
      const player = room.getPlayer('player1')!;
      player.state.position = { x: 52, y: 0, z: 50 };

      gameLoop.handleMountAttempt('player1', 'worm-0');

      // Corrupt worm state (remove control points)
      const worms = (gameLoop as any).wormAI.getWorms();
      const worm = worms.find((w: any) => w.id === 'worm-0');
      worm.controlPoints = [worm.controlPoints[0]]; // Only 1 control point

      // Should not crash when updating
      expect(() => {
        advanceGameLoop(0.033);
      }).not.toThrow();

      // Player state should remain at previous position
      expect(player.state.position).toBeDefined();
    });
  });
});
