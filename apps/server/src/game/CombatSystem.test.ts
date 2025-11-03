import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Socket } from 'socket.io';
import { CombatSystem } from './CombatSystem';
import { Room } from './Room';
import { InMemoryPlayerRepository } from './testing/InMemoryPlayerRepository';
import { COMBAT_CONSTANTS } from '@fremen/shared';

const createMockSocket = (): Socket => ({
  emit: vi.fn(),
  on: vi.fn(),
  disconnect: vi.fn(),
} as unknown as Socket);

describe('CombatSystem', () => {
  let repository: InMemoryPlayerRepository;
  let room: Room;
  let combat: CombatSystem;

  beforeEach(async () => {
    repository = new InMemoryPlayerRepository();
    room = new Room('test-room', repository);
    combat = new CombatSystem(room);

    await room.addPlayer(createMockSocket(), 'attacker', 'Attacker');
    await room.addPlayer(createMockSocket(), 'target', 'Target');

    const attacker = room.getPlayer('attacker');
    const target = room.getPlayer('target');
    expect(attacker).toBeDefined();
    expect(target).toBeDefined();

    combat.onPlayerJoin(attacker!);
    combat.onPlayerJoin(target!);
  });

  it('regenerates health for active players up to the configured maximum', () => {
    const player = room.getPlayer('target')!;
    player.health = 40;

    combat.update(2); // 2 seconds of regen

    expect(player.health).toBe(40 + COMBAT_CONSTANTS.PLAYER_REGEN_PER_SECOND * 2);
  });

  it('applies weapon fire damage and emits combat events', () => {
    const events: any[] = [];
    combat.onEvent(event => events.push(event));

    const target = room.getPlayer('target')!;
    target.health = 50;

    combat.handlePlayerFire('attacker', {
      weaponId: 'crysknife',
      targetId: 'target',
      damage: 40,
    });

    expect(events.map(e => e.type)).toContain('fire');
    expect(events).toContainEqual(
      expect.objectContaining({
        type: 'damage',
        targetId: 'target',
        amount: 40,
        remainingHealth: 10,
      })
    );
    expect(target.health).toBe(10);
  });

  it('emits death events when damage reduces health below zero', () => {
    const events: any[] = [];
    combat.onEvent(event => events.push(event));

    const target = room.getPlayer('target')!;
    target.health = 15;

    combat.handlePlayerFire('attacker', {
      weaponId: 'crysknife',
      targetId: 'target',
      damage: 30,
    });

    expect(events.map(e => e.type)).toEqual(['fire', 'damage', 'death']);
    const death = events.find(e => e.type === 'death');
    expect(death).toMatchObject({ targetId: 'target', attackerId: 'attacker' });
    expect(target.health).toBe(COMBAT_CONSTANTS.PLAYER_MAX_HEALTH);
  });
});
