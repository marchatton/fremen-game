import { describe, it, expect, vi } from 'vitest';
import { GameLoop } from './GameLoop';
import { Room } from './Room';
import type { PlayerRepository } from './PlayerRepository';
import type { Socket } from 'socket.io';
import { STARTING_RESOURCES } from '@fremen/shared';

const createMockSocket = (): Socket => ({
  emit: vi.fn(),
  on: vi.fn(),
  disconnect: vi.fn(),
  id: 'socket-1',
} as unknown as Socket);

describe('GameLoop persistence integration', () => {
  it('queues persistence snapshot on tick', async () => {
    const baseResources = {
      water: STARTING_RESOURCES.water ?? 100,
      spice: STARTING_RESOURCES.spice ?? 0,
      equipment: { ...(STARTING_RESOURCES.equipment ?? {}) },
      stats: { ...(STARTING_RESOURCES.stats ?? {}) },
      inventory: STARTING_RESOURCES.inventory ? [...STARTING_RESOURCES.inventory] : [],
    };

    const repository: PlayerRepository = {
      load: vi.fn().mockResolvedValue(baseResources),
      register: vi.fn(),
      updateSnapshot: vi.fn(),
      unregister: vi.fn().mockResolvedValue(),
    };

    const room = new Room('test', repository);
    const gameLoop = new GameLoop(room, 12345, repository);

    await room.addPlayer(createMockSocket(), 'player1', 'Test');
    const player = room.getPlayer('player1');
    if (player) {
      gameLoop.onPlayerJoin(player);
    }
    (gameLoop as any).tick();

    expect(repository.updateSnapshot).toHaveBeenCalledWith(
      'player1',
      expect.objectContaining({
        position: expect.objectContaining({ x: expect.any(Number) }),
        resources: expect.objectContaining({ water: expect.any(Number) }),
      })
    );
  });
});
