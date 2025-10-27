import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Socket } from 'socket.io';
import { Room } from './Room';
import { InMemoryPlayerRepository } from './testing/InMemoryPlayerRepository';

describe('Room', () => {
  let room: Room;
  let mockSocket: Partial<Socket>;
  let repository: InMemoryPlayerRepository;

  beforeEach(() => {
    repository = new InMemoryPlayerRepository();
    room = new Room('test-room', repository);
    mockSocket = {
      id: 'socket-123',
      emit: vi.fn(),
    } as unknown as Socket;
  });

  it('should create room with correct id', () => {
    expect(room.roomId).toBe('test-room');
  });

  it('should add player to room', async () => {
    const result = await room.addPlayer(mockSocket as Socket, 'player1', 'TestPlayer');

    expect(result).toBe(true);
    expect(room.getPlayerCount()).toBe(1);
  });

  it('should invoke repository registration when player joins', async () => {
    const spy = vi.spyOn(repository, 'register');
    await room.addPlayer(mockSocket as Socket, 'player1', 'TestPlayer');

    expect(spy).toHaveBeenCalledWith(
      'player1',
      expect.objectContaining({ water: expect.any(Number) }),
      expect.objectContaining({ x: expect.any(Number) })
    );
  });

  it('should not exceed max players', async () => {
    for (let i = 0; i < 4; i++) {
      const socket = { ...mockSocket, id: `socket-${i}` } as Socket;
      await room.addPlayer(socket, `player${i}`, `Player${i}`);
    }

    const socket5 = { ...mockSocket, id: 'socket-5' } as Socket;
    const result = await room.addPlayer(socket5, 'player5', 'Player5');

    expect(result).toBe(false);
    expect(room.getPlayerCount()).toBe(4);
  });

  it('should remove player from room', async () => {
    await room.addPlayer(mockSocket as Socket, 'player1', 'TestPlayer');
    await room.removePlayer('player1');

    expect(room.getPlayerCount()).toBe(0);
  });

  it('should get player by id', async () => {
    await room.addPlayer(mockSocket as Socket, 'player1', 'TestPlayer');
    const player = room.getPlayer('player1');

    expect(player).toBeDefined();
    expect(player?.playerId).toBe('player1');
    expect(player?.username).toBe('TestPlayer');
  });

  it('should return all players', async () => {
    const socket1 = { ...mockSocket, id: 'socket-1' } as Socket;
    const socket2 = { ...mockSocket, id: 'socket-2' } as Socket;

    await room.addPlayer(socket1, 'player1', 'Player1');
    await room.addPlayer(socket2, 'player2', 'Player2');

    const players = room.getAllPlayers();
    expect(players).toHaveLength(2);
  });

  it('should deploy thumper when player has inventory', async () => {
    await room.addPlayer(mockSocket as Socket, 'player1', 'TestPlayer');
    const player = room.getPlayer('player1');

    expect(player?.thumperCount).toBe(3);

    const result = room.deployThumper('player1');
    expect(result).toBe(true);
    expect(player?.thumperCount).toBe(2);
  });

  it('should not deploy thumper when inventory is empty', async () => {
    await room.addPlayer(mockSocket as Socket, 'player1', 'TestPlayer');
    const player = room.getPlayer('player1');

    if (player) {
      player.thumperCount = 0;
    }

    const result = room.deployThumper('player1');
    expect(result).toBe(false);
  });

  it('should track active thumpers', async () => {
    await room.addPlayer(mockSocket as Socket, 'player1', 'TestPlayer');
    room.deployThumper('player1');

    const thumpers = room.getThumpers();
    expect(thumpers).toHaveLength(1);
    expect(thumpers[0].active).toBe(true);
  });

  it('should expire thumpers after duration', async () => {
    vi.useFakeTimers();

    await room.addPlayer(mockSocket as Socket, 'player1', 'TestPlayer');
    room.deployThumper('player1');

    vi.advanceTimersByTime(61000);
    room.updateThumpers();

    const thumpers = room.getThumpers();
    expect(thumpers).toHaveLength(0);

    vi.useRealTimers();
  });

  it('should restore player state on reconnect', async () => {
    const socket1 = { ...mockSocket, id: 'socket-1' } as Socket;
    await room.addPlayer(socket1, 'player1', 'TestPlayer');

    const player = room.getPlayer('player1');
    if (player) {
      player.state.position = { x: 100, y: 0, z: 100 };
    }

    await room.removePlayer('player1');

    const socket2 = { ...mockSocket, id: 'socket-2' } as Socket;
    await room.addPlayer(socket2, 'player1', 'TestPlayer');

    const restoredPlayer = room.getPlayer('player1');
    expect(restoredPlayer?.state.position.x).toBe(100);
  });

  it('should unregister player from repository on removal', async () => {
    const unregisterSpy = vi.spyOn(repository, 'unregister');

    await room.addPlayer(mockSocket as Socket, 'player1', 'TestPlayer');
    await room.removePlayer('player1');

    expect(unregisterSpy).toHaveBeenCalledWith(
      'player1',
      expect.objectContaining({
        position: expect.objectContaining({ x: expect.any(Number) }),
        resources: expect.objectContaining({ water: expect.any(Number) }),
      })
    );
  });
});
