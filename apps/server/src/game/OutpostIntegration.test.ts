import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Socket } from 'socket.io';
import { GameLoop } from './GameLoop';
import { Room } from './Room';
import { InMemoryPlayerRepository } from './testing/InMemoryPlayerRepository';
import { GAME_CONSTANTS, VS4_CONSTANTS } from '@fremen/shared';
import type { CombatEventMessage } from '@fremen/protocol';

describe('VS4: Outpost & AI integration', () => {
  let room: Room;
  let gameLoop: GameLoop;
  let repository: InMemoryPlayerRepository;
  let mockSocket: Partial<Socket>;
  let addPlayerWithJoin: (socket: Socket, playerId: string, username: string) => Promise<void>;

  const SEED = 1337;

  const advanceSeconds = (seconds: number) => {
    const steps = Math.ceil(seconds * GAME_CONSTANTS.TICK_RATE);
    for (let i = 0; i < steps; i++) {
      (gameLoop as any).registry.update(1 / GAME_CONSTANTS.TICK_RATE);
      vi.advanceTimersByTime(1000 / GAME_CONSTANTS.TICK_RATE);
    }
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    repository = new InMemoryPlayerRepository();
    room = new Room('ai-room', repository);
    gameLoop = new GameLoop(room, SEED, repository);

    addPlayerWithJoin = async (socket: Socket, playerId: string, username: string) => {
      await room.addPlayer(socket, playerId, username);
      const player = room.getPlayer(playerId);
      if (player) {
        gameLoop.onPlayerJoin(player);
      }
    };

    mockSocket = {
      id: 'socket-1',
      emit: vi.fn(),
    } as unknown as Socket;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('grants rewards when a Fremen squad captures an outpost', async () => {
    await addPlayerWithJoin(mockSocket as Socket, 'player1', 'FremenHero');
    const player = room.getPlayer('player1')!;

    const outpostManager = (gameLoop as any).outpostManager;
    const aiManager = (gameLoop as any).aiManager;
    const [initialOutpost] = outpostManager.getOutposts();
    const outpostId = initialOutpost.id;

    // Clear the Harkonnen garrison and jam the outpost so reinforcements do not spawn
    const existingTroopers = aiManager.getTroopersForOutpost(outpostId);
    existingTroopers.forEach((trooper: any) => aiManager.markTrooperDefeated(trooper.id));

    player.state.position = { ...initialOutpost.position };
    expect(room.deployThumper('player1')).toBe(true);

    const initialSpice = player.resources.spice;
    const initialWater = player.resources.water;

    advanceSeconds(VS4_CONSTANTS.OUTPOST_CAPTURE_TIME + 1);

    const capturedOutpost = outpostManager.getOutpost(outpostId)!;
    expect(capturedOutpost.controllingFaction).toBe('fremen');
    expect(player.resources.spice).toBeGreaterThan(initialSpice);
    // Allow a small tolerance for thirst decay ticks that can run immediately after capture.
    expect(player.resources.water).toBeGreaterThanOrEqual(initialWater - 1);
  });

  it('pauses bot backfill while an outpost is jammed by a thumper', async () => {
    await addPlayerWithJoin(mockSocket as Socket, 'player1', 'Saboteur');
    const player = room.getPlayer('player1')!;

    const outpostManager = (gameLoop as any).outpostManager;
    const aiManager = (gameLoop as any).aiManager;
    const [outpost] = outpostManager.getOutposts();

    advanceSeconds(1);

    let troopers = aiManager.getTroopersForOutpost(outpost.id);
    expect(troopers.length).toBeGreaterThanOrEqual(VS4_CONSTANTS.OUTPOST_MIN_GARRISON);

    // Eliminate one trooper and ensure backfill occurs when not jammed
    aiManager.markTrooperDefeated(troopers[0].id);
    advanceSeconds(VS4_CONSTANTS.BOT_BACKFILL_DELAY + 1);
    troopers = aiManager.getTroopersForOutpost(outpost.id);
    expect(troopers.length).toBeGreaterThanOrEqual(VS4_CONSTANTS.OUTPOST_MIN_GARRISON);

    // Deploy a thumper to jam the outpost
    player.state.position = { ...outpost.position };
    const deployed = room.deployThumper('player1');
    expect(deployed).toBe(true);

    // Remove another trooper and confirm no backfill while jammed
    aiManager.markTrooperDefeated(troopers[0].id);
    advanceSeconds(VS4_CONSTANTS.BOT_BACKFILL_DELAY + 1);
    troopers = aiManager.getTroopersForOutpost(outpost.id);
    expect(troopers.length).toBeLessThan(VS4_CONSTANTS.OUTPOST_MIN_GARRISON);

    // Let the jam expire and ensure backfill resumes
    vi.advanceTimersByTime(VS4_CONSTANTS.THUMPER_JAM_DURATION + 1000);

    let attempts = 0;
    do {
      advanceSeconds(1);
      troopers = aiManager.getTroopersForOutpost(outpost.id);
      attempts++;
    } while (attempts < 10 && troopers.length < VS4_CONSTANTS.OUTPOST_MIN_GARRISON);

    expect(troopers.length).toBeGreaterThanOrEqual(VS4_CONSTANTS.OUTPOST_MIN_GARRISON);
  });

  it('routes AI combat through the shared combat system during mixed sessions', async () => {
    await addPlayerWithJoin(mockSocket as Socket, 'player1', 'Defender');
    const player = room.getPlayer('player1')!;

    const outpostManager = (gameLoop as any).outpostManager;
    const aiManager = (gameLoop as any).aiManager;
    const combatSystem = (gameLoop as any).combatSystem;

    const [outpost] = outpostManager.getOutposts();
    advanceSeconds(1);

    const trooper = aiManager.getTroopersForOutpost(outpost.id)[0];
    player.state.position = {
      x: trooper.position.x + 5,
      y: trooper.position.y,
      z: trooper.position.z + 5,
    };

    const events: CombatEventMessage[] = [];
    combatSystem.onEvent((event: CombatEventMessage) => {
      events.push(event);
    });

    advanceSeconds(5);

    expect(events.some(evt => evt.type === 'fire' && evt.attackerId === trooper.id)).toBe(true);
    expect(events.some(evt => evt.type === 'damage' && evt.targetId === player.playerId)).toBe(true);
  });
});
