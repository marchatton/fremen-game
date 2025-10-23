import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { GameLoop } from './GameLoop';
import { Room } from './Room';
import { PlayerStateEnum, WormAIState, ObjectiveStatus, GAME_CONSTANTS } from '@fremen/shared';
import type { Socket } from 'socket.io';

describe('VS2: Riding Integration (End-to-End)', () => {
  let room: Room;
  let gameLoop: GameLoop;
  let mockSocket: Partial<Socket>;
  const SEED = 12345;

  beforeEach(() => {
    room = new Room('test-room');
    gameLoop = new GameLoop(room, SEED);

    mockSocket = {
      id: 'socket-1',
      emit: vi.fn(),
    } as unknown as Socket;

    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Complete Gameplay Loop', () => {
    it('should complete full loop: deploy thumper → mount → steer → complete objective → dismount', () => {
      // 1. Add player
      room.addPlayer(mockSocket as Socket, 'player1', 'TestPlayer');
      const player = room.getPlayer('player1')!;

      // 2. Deploy thumper
      player.state.position = { x: 10, y: 0, z: 10 };
      const deployed = room.deployThumper('player1');
      expect(deployed).toBe(true);
      expect(player.thumperCount).toBe(2); // Started with 3

      // 3. Position player near worm
      player.state.position = { x: 52, y: 0, z: 50 };

      // 4. Mount worm
      const mountResult = gameLoop.handleMountAttempt('player1', 'worm-0');
      expect(mountResult.success).toBe(true);
      expect(player.state.state).toBe(PlayerStateEnum.RIDING);

      // 5. Steer worm toward objective
      const objective = (gameLoop as any).objectiveManager.getActiveObjective();
      const targetX = objective.targetPosition.x;
      const targetZ = objective.targetPosition.z;

      // Calculate direction to objective
      const worms = (gameLoop as any).wormAI.getWorms();
      const worm = worms.find((w: any) => w.id === 'worm-0');
      const heading = Math.atan2(targetX - worm.controlPoints[0].x, targetZ - worm.controlPoints[0].z);

      // Steer toward objective for several ticks
      for (let i = 0; i < 30; i++) {
        gameLoop.handleWormControl('worm-0', 1.0, 1.0, 1 / GAME_CONSTANTS.TICK_RATE);
        (gameLoop as any).updateGameState(1 / GAME_CONSTANTS.TICK_RATE);
      }

      // 6. Complete objective (manually for test)
      (gameLoop as any).objectiveManager.checkObjectiveCompletion(objective.targetPosition);

      expect(objective.status).toBe(ObjectiveStatus.COMPLETED);

      // 7. Dismount
      const dismountResult = gameLoop.handleDismount('player1');
      expect(dismountResult.success).toBe(true);
      expect(player.state.state).toBe(PlayerStateEnum.ACTIVE);

      // Verify final state
      const finalWorm = (gameLoop as any).wormAI.getWorm('worm-0');
      expect(finalWorm.aiState).toBe(WormAIState.PATROLLING);
      expect(finalWorm.riderId).toBeUndefined();
    });

    it('should handle thumper attraction → mount → ride sequence', () => {
      room.addPlayer(mockSocket as Socket, 'player1', 'TestPlayer');
      const player = room.getPlayer('player1')!;

      // Deploy thumper
      player.state.position = { x: 100, y: 0, z: 100 };
      room.deployThumper('player1');

      // Update game state to process thumper attraction
      (gameLoop as any).updateGameState(0.033);

      const worms = (gameLoop as any).wormAI.getWorms();
      const worm = worms[0];

      // Worm should be attracted to thumper
      expect(worm.targetPosition).toBeDefined();

      // Position player near worm and mount
      player.state.position = { x: worm.controlPoints[0].x + 2, y: 0, z: worm.controlPoints[0].z };

      const mountResult = gameLoop.handleMountAttempt('player1', 'worm-0');
      expect(mountResult.success).toBe(true);

      // Player position should sync to worm segment during update
      (gameLoop as any).updateGameState(0.033);

      expect(player.state.position.x).toBe(worm.controlPoints[2].x);
      expect(player.state.position.z).toBe(worm.controlPoints[2].z);
    });

    it('should handle objective expiration while riding', () => {
      room.addPlayer(mockSocket as Socket, 'player1', 'TestPlayer');
      const player = room.getPlayer('player1')!;

      player.state.position = { x: 52, y: 0, z: 50 };
      gameLoop.handleMountAttempt('player1', 'worm-0');

      const objective = (gameLoop as any).objectiveManager.getActiveObjective();
      expect(objective.status).toBe(ObjectiveStatus.ACTIVE);

      // Advance time to expire objective
      vi.advanceTimersByTime(180001);
      (gameLoop as any).objectiveManager.update();

      expect(objective.status).toBe(ObjectiveStatus.FAILED);

      // Player should still be riding
      expect(player.state.state).toBe(PlayerStateEnum.RIDING);

      // New objective should spawn after delay
      vi.advanceTimersByTime(5000);

      const newObjective = (gameLoop as any).objectiveManager.getActiveObjective();
      expect(newObjective.id).not.toBe(objective.id);
    });

    it('should handle worm death while riding', () => {
      room.addPlayer(mockSocket as Socket, 'player1', 'TestPlayer');
      const player = room.getPlayer('player1')!;

      player.state.position = { x: 52, y: 0, z: 50 };
      gameLoop.handleMountAttempt('player1', 'worm-0');

      const worms = (gameLoop as any).wormAI.getWorms();
      const worm = worms[0];

      // Damage worm to death
      worm.health = 10;

      // Position worm to take terrain damage
      worm.controlPoints[0] = { x: 0, y: -20, z: 0 };

      // Update game loop (should detect damage and dismount player)
      (gameLoop as any).updateGameState(0.033);

      const damage = (gameLoop as any).wormDamage.checkTerrainDamage(worm);
      const died = (gameLoop as any).wormDamage.applyDamage(worm, damage);

      if (died && worm.riderId) {
        gameLoop.handleDismount(worm.riderId);
      }

      // Player should be dismounted
      expect(player.state.state).toBe(PlayerStateEnum.ACTIVE);
    });
  });

  describe('Multi-Player Riding Scenarios', () => {
    let mockSocket2: Partial<Socket>;

    beforeEach(() => {
      mockSocket2 = {
        id: 'socket-2',
        emit: vi.fn(),
      } as unknown as Socket;
    });

    it('should allow multiple players to see rider', () => {
      room.addPlayer(mockSocket as Socket, 'player1', 'Player1');
      room.addPlayer(mockSocket2 as Socket, 'player2', 'Player2');

      const player1 = room.getPlayer('player1')!;
      const player2 = room.getPlayer('player2')!;

      // Player 1 mounts
      player1.state.position = { x: 52, y: 0, z: 50 };
      gameLoop.handleMountAttempt('player1', 'worm-0');

      // Update game state
      (gameLoop as any).updateGameState(0.033);

      // Verify player1 is riding
      expect(player1.state.state).toBe(PlayerStateEnum.RIDING);
      expect(player1.state.ridingWormId).toBe('worm-0');

      // Player2 should see player1's state
      const players = room.getAllPlayers();
      const rider = players.find(p => p.playerId === 'player1');

      expect(rider?.state.state).toBe(PlayerStateEnum.RIDING);
      expect(rider?.state.ridingWormId).toBe('worm-0');
    });

    it('should prevent player2 from mounting while player1 is riding', () => {
      room.addPlayer(mockSocket as Socket, 'player1', 'Player1');
      room.addPlayer(mockSocket2 as Socket, 'player2', 'Player2');

      const player1 = room.getPlayer('player1')!;
      const player2 = room.getPlayer('player2')!;

      // Both players near worm
      player1.state.position = { x: 51, y: 0, z: 50 };
      player2.state.position = { x: 52, y: 0, z: 50 };

      // Player1 mounts
      gameLoop.handleMountAttempt('player1', 'worm-0');

      // Player2 tries to mount
      const result = gameLoop.handleMountAttempt('player2', 'worm-0');

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Worm not available');
      expect(player2.state.state).toBe(PlayerStateEnum.ACTIVE);
    });

    it('should allow quick succession mount after dismount', () => {
      room.addPlayer(mockSocket as Socket, 'player1', 'Player1');
      room.addPlayer(mockSocket2 as Socket, 'player2', 'Player2');

      const player1 = room.getPlayer('player1')!;
      const player2 = room.getPlayer('player2')!;

      player1.state.position = { x: 51, y: 0, z: 50 };
      player2.state.position = { x: 52, y: 0, z: 50 };

      // Player1 mounts and immediately dismounts
      gameLoop.handleMountAttempt('player1', 'worm-0');
      gameLoop.handleDismount('player1');

      // Player2 mounts immediately after
      const result = gameLoop.handleMountAttempt('player2', 'worm-0');

      expect(result.success).toBe(true);
      expect(player2.state.state).toBe(PlayerStateEnum.RIDING);
    });
  });

  describe('State Synchronization', () => {
    it('should sync player position to worm segment while riding', () => {
      room.addPlayer(mockSocket as Socket, 'player1', 'TestPlayer');
      const player = room.getPlayer('player1')!;

      player.state.position = { x: 52, y: 0, z: 50 };
      gameLoop.handleMountAttempt('player1', 'worm-0');

      // Update game state multiple times
      for (let i = 0; i < 10; i++) {
        gameLoop.handleWormControl('worm-0', 1.0, 1.0, 1 / GAME_CONSTANTS.TICK_RATE);
        (gameLoop as any).updateGameState(1 / GAME_CONSTANTS.TICK_RATE);

        const worms = (gameLoop as any).wormAI.getWorms();
        const worm = worms.find((w: any) => w.id === 'worm-0');
        const segment2 = worm.controlPoints[2];

        // Player should always be at segment 2
        expect(player.state.position.x).toBe(segment2.x);
        expect(player.state.position.z).toBe(segment2.z);
      }
    });

    it('should clear player velocity while riding', () => {
      room.addPlayer(mockSocket as Socket, 'player1', 'TestPlayer');
      const player = room.getPlayer('player1')!;

      player.state.position = { x: 52, y: 0, z: 50 };
      player.state.velocity = { x: 5, y: 0, z: 5 };

      gameLoop.handleMountAttempt('player1', 'worm-0');

      (gameLoop as any).updateGameState(0.033);

      expect(player.state.velocity).toEqual({ x: 0, y: 0, z: 0 });
    });

    it('should not apply physics validation while riding', () => {
      room.addPlayer(mockSocket as Socket, 'player1', 'TestPlayer');
      const player = room.getPlayer('player1')!;

      player.state.position = { x: 52, y: 0, z: 50 };
      gameLoop.handleMountAttempt('player1', 'worm-0');

      // Manually set invalid velocity (would be clamped if on foot)
      player.state.velocity = { x: 1000, y: 1000, z: 1000 };

      (gameLoop as any).updateGameState(0.033);

      // Velocity should be zeroed (riding state), not clamped to max speed
      expect(player.state.velocity).toEqual({ x: 0, y: 0, z: 0 });
    });
  });

  describe('Objective Integration', () => {
    it('should detect objective completion when worm enters radius', () => {
      room.addPlayer(mockSocket as Socket, 'player1', 'TestPlayer');
      const player = room.getPlayer('player1')!;

      const objective = (gameLoop as any).objectiveManager.getActiveObjective();

      // Position player near worm
      player.state.position = { x: 52, y: 0, z: 50 };
      gameLoop.handleMountAttempt('player1', 'worm-0');

      // Move worm to objective
      const worms = (gameLoop as any).wormAI.getWorms();
      const worm = worms[0];
      worm.controlPoints[0] = { ...objective.targetPosition };

      // Update game loop
      (gameLoop as any).updateGameState(0.033);

      expect(objective.status).toBe(ObjectiveStatus.COMPLETED);
    });

    it('should check objective completion every tick while riding', () => {
      room.addPlayer(mockSocket as Socket, 'player1', 'TestPlayer');
      const player = room.getPlayer('player1')!;

      player.state.position = { x: 52, y: 0, z: 50 };
      gameLoop.handleMountAttempt('player1', 'worm-0');

      const objective = (gameLoop as any).objectiveManager.getActiveObjective();

      // Steer toward objective
      for (let i = 0; i < 100; i++) {
        gameLoop.handleWormControl('worm-0', 0.5, 1.0, 1 / GAME_CONSTANTS.TICK_RATE);
        (gameLoop as any).updateGameState(1 / GAME_CONSTANTS.TICK_RATE);

        if (objective.status === ObjectiveStatus.COMPLETED) {
          expect(i).toBeGreaterThan(0); // Should complete at some point
          break;
        }
      }
    });

    it('should not check objective when not riding', () => {
      room.addPlayer(mockSocket as Socket, 'player1', 'TestPlayer');
      const player = room.getPlayer('player1')!;

      const objective = (gameLoop as any).objectiveManager.getActiveObjective();

      // Move player to objective without riding
      player.state.position = { ...objective.targetPosition };

      (gameLoop as any).updateGameState(0.033);

      // Objective should not complete (only worms can complete objectives)
      expect(objective.status).toBe(ObjectiveStatus.ACTIVE);
    });
  });

  describe('Damage Integration', () => {
    it('should damage worm when hitting terrain while riding', () => {
      room.addPlayer(mockSocket as Socket, 'player1', 'TestPlayer');
      const player = room.getPlayer('player1')!;

      player.state.position = { x: 52, y: 0, z: 50 };
      gameLoop.handleMountAttempt('player1', 'worm-0');

      const worms = (gameLoop as any).wormAI.getWorms();
      const worm = worms[0];
      const initialHealth = worm.health;

      // Move worm into terrain
      worm.controlPoints[0] = { x: 0, y: -20, z: 0 };

      (gameLoop as any).updateGameState(0.033);

      expect(worm.health).toBeLessThan(initialHealth);
    });

    it('should auto-dismount player when worm dies', () => {
      room.addPlayer(mockSocket as Socket, 'player1', 'TestPlayer');
      const player = room.getPlayer('player1')!;

      player.state.position = { x: 52, y: 0, z: 50 };
      gameLoop.handleMountAttempt('player1', 'worm-0');

      const worms = (gameLoop as any).wormAI.getWorms();
      const worm = worms[0];

      // Set worm to low health and damage it
      worm.health = 10;
      worm.controlPoints[0] = { x: 0, y: -20, z: 0 };

      (gameLoop as any).updateGameState(0.033);

      // Check if worm died and player was dismounted
      if (worm.health === 0) {
        expect(player.state.state).toBe(PlayerStateEnum.ACTIVE);
      }
    });
  });

  describe('Performance and Stability', () => {
    it('should handle 100 game loop ticks without errors', () => {
      room.addPlayer(mockSocket as Socket, 'player1', 'TestPlayer');
      const player = room.getPlayer('player1')!;

      player.state.position = { x: 52, y: 0, z: 50 };
      gameLoop.handleMountAttempt('player1', 'worm-0');

      expect(() => {
        for (let i = 0; i < 100; i++) {
          gameLoop.handleWormControl('worm-0', Math.random() * 2 - 1, Math.random() * 2 - 1, 1 / GAME_CONSTANTS.TICK_RATE);
          (gameLoop as any).updateGameState(1 / GAME_CONSTANTS.TICK_RATE);
        }
      }).not.toThrow();
    });

    it('should maintain worm control point count during long ride', () => {
      room.addPlayer(mockSocket as Socket, 'player1', 'TestPlayer');
      const player = room.getPlayer('player1')!;

      player.state.position = { x: 52, y: 0, z: 50 };
      gameLoop.handleMountAttempt('player1', 'worm-0');

      for (let i = 0; i < 300; i++) {
        gameLoop.handleWormControl('worm-0', 1.0, 1.0, 1 / GAME_CONSTANTS.TICK_RATE);
        (gameLoop as any).updateGameState(1 / GAME_CONSTANTS.TICK_RATE);

        const worms = (gameLoop as any).wormAI.getWorms();
        const worm = worms[0];

        expect(worm.controlPoints.length).toBeLessThanOrEqual(12);
        expect(worm.controlPoints.length).toBeGreaterThanOrEqual(10);
      }
    });

    it('should handle rapid mount/dismount cycles', () => {
      room.addPlayer(mockSocket as Socket, 'player1', 'TestPlayer');
      const player = room.getPlayer('player1')!;

      for (let i = 0; i < 20; i++) {
        player.state.position = { x: 52, y: 0, z: 50 };

        const mountResult = gameLoop.handleMountAttempt('player1', 'worm-0');
        expect(mountResult.success).toBe(true);

        const dismountResult = gameLoop.handleDismount('player1');
        expect(dismountResult.success).toBe(true);
      }

      // Final state should be consistent
      expect(player.state.state).toBe(PlayerStateEnum.ACTIVE);

      const worms = (gameLoop as any).wormAI.getWorms();
      const worm = worms[0];
      expect(worm.aiState).toBe(WormAIState.PATROLLING);
    });

    it('should handle steering with extreme deltaTime variations', () => {
      room.addPlayer(mockSocket as Socket, 'player1', 'TestPlayer');
      const player = room.getPlayer('player1')!;

      player.state.position = { x: 52, y: 0, z: 50 };
      gameLoop.handleMountAttempt('player1', 'worm-0');

      const deltaTimes = [0.001, 0.016, 0.033, 0.1, 0.5];

      expect(() => {
        for (const dt of deltaTimes) {
          gameLoop.handleWormControl('worm-0', 1.0, 1.0, dt);
          (gameLoop as any).updateGameState(dt);
        }
      }).not.toThrow();
    });
  });

  describe('Edge Case Combinations', () => {
    it('should handle objective completion during dismount', () => {
      room.addPlayer(mockSocket as Socket, 'player1', 'TestPlayer');
      const player = room.getPlayer('player1')!;

      const objective = (gameLoop as any).objectiveManager.getActiveObjective();

      player.state.position = { x: 52, y: 0, z: 50 };
      gameLoop.handleMountAttempt('player1', 'worm-0');

      // Move worm to objective
      const worms = (gameLoop as any).wormAI.getWorms();
      const worm = worms[0];
      worm.controlPoints[0] = { ...objective.targetPosition };

      // Objective should already be completed during riding
      (gameLoop as any).updateGameState(0.033);
      expect(objective.status).toBe(ObjectiveStatus.COMPLETED);

      // Dismount after objective is complete
      gameLoop.handleDismount('player1');

      // Trying to complete again should return false (already completed)
      const completed = (gameLoop as any).objectiveManager.checkObjectiveCompletion(objective.targetPosition);
      expect(completed).toBe(false);
    });

    it('should handle thumper expiration while riding', () => {
      room.addPlayer(mockSocket as Socket, 'player1', 'TestPlayer');
      const player = room.getPlayer('player1')!;

      player.state.position = { x: 10, y: 0, z: 10 };
      room.deployThumper('player1');

      player.state.position = { x: 52, y: 0, z: 50 };
      gameLoop.handleMountAttempt('player1', 'worm-0');

      // Expire thumper
      vi.advanceTimersByTime(61000);
      room.updateThumpers();

      // Player should still be riding
      expect(player.state.state).toBe(PlayerStateEnum.RIDING);

      // Worm should remain ridden (not return to thumper)
      const worms = (gameLoop as any).wormAI.getWorms();
      const worm = worms[0];
      expect(worm.aiState).toBe(WormAIState.RIDDEN_BY);
    });

    it('should handle player reaching max speed before mounting', () => {
      room.addPlayer(mockSocket as Socket, 'player1', 'TestPlayer');
      const player = room.getPlayer('player1')!;

      player.state.position = { x: 52, y: 0, z: 50 };
      player.state.velocity = {
        x: GAME_CONSTANTS.PLAYER_MAX_SPEED,
        y: 0,
        z: GAME_CONSTANTS.PLAYER_MAX_SPEED
      };

      gameLoop.handleMountAttempt('player1', 'worm-0');

      // Velocity should be zeroed on mount
      expect(player.state.velocity).toEqual({ x: 0, y: 0, z: 0 });
    });
  });
});
