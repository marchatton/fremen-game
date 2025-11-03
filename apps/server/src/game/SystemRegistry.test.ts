import { describe, it, expect, vi } from 'vitest';
import type { RoomPlayer } from './Room';
import { SystemRegistry } from './SystemRegistry';

class MockSystem {
  public readonly name: string;
  public readonly hooks: Array<string> = [];
  private readonly order: string[];

  constructor(name: string, order: string[]) {
    this.name = name;
    this.order = order;
  }

  onPlayerJoin(player: RoomPlayer) {
    this.hooks.push(`${this.name}:join:${player.playerId}`);
  }

  onPlayerLeave(playerId: string) {
    this.hooks.push(`${this.name}:leave:${playerId}`);
  }

  update(deltaTime: number) {
    this.hooks.push(`${this.name}:update:${deltaTime}`);
    this.order.push(this.name);
  }
}

describe('SystemRegistry', () => {
  const createPlayer = (id: string): RoomPlayer => ({
    socket: { emit: vi.fn(), on: vi.fn(), disconnect: vi.fn() } as any,
    playerId: id,
    username: `player-${id}`,
    state: {
      id,
      position: { x: 0, y: 0, z: 0 },
      rotation: 0,
      velocity: { x: 0, y: 0, z: 0 },
      state: 'ACTIVE' as any,
    },
    resources: {
      water: 100,
      spice: 0,
      equipment: {},
      stats: {
        objectivesCompleted: 0,
        totalSpiceEarned: 0,
        distanceTraveled: 0,
        deaths: 0,
        wormsRidden: 0,
        outpostsCaptured: 0,
      },
      inventory: [],
    },
    health: 100,
    lastInputSeq: 0,
    connectedAt: Date.now(),
    thumperCount: 3,
  });

  it('updates systems in registration order', () => {
    const order: string[] = [];
    const registry = new SystemRegistry();
    const first = new MockSystem('first', order);
    const second = new MockSystem('second', order);

    registry.registerSystem(first);
    registry.registerSystem(second);

    registry.update(0.5);

    expect(order).toEqual(['first', 'second']);
  });

  it('broadcasts player lifecycle events to registered systems', () => {
    const registry = new SystemRegistry();
    const order: string[] = [];
    const system = new MockSystem('tracker', order);
    registry.registerSystem(system);

    const player = createPlayer('alpha');

    registry.onPlayerJoin(player);
    registry.onPlayerLeave('alpha');

    expect(system.hooks).toEqual([
      'tracker:join:alpha',
      'tracker:leave:alpha',
    ]);
    expect(order).toEqual([]);
  });
});
