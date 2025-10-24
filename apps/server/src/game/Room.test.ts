import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Room } from './Room';
import type { Socket } from 'socket.io';

describe('Room', () => {
  let room: Room;
  let mockSocket: Partial<Socket>;

  beforeEach(() => {
    room = new Room('test-room');
    mockSocket = {
      id: 'socket-123',
      emit: vi.fn(),
    } as unknown as Socket;
  });

  it('should create room with correct id', () => {
    expect(room.roomId).toBe('test-room');
  });

  it('should add player to room', () => {
    const result = room.addPlayer(mockSocket as Socket, 'player1', 'TestPlayer');
    
    expect(result).toBe(true);
    expect(room.getPlayerCount()).toBe(1);
  });

  it('should not exceed max players', () => {
    for (let i = 0; i < 4; i++) {
      const socket = { ...mockSocket, id: `socket-${i}` } as Socket;
      room.addPlayer(socket, `player${i}`, `Player${i}`);
    }
    
    const socket5 = { ...mockSocket, id: 'socket-5' } as Socket;
    const result = room.addPlayer(socket5, 'player5', 'Player5');
    
    expect(result).toBe(false);
    expect(room.getPlayerCount()).toBe(4);
  });

  it('should remove player from room', () => {
    room.addPlayer(mockSocket as Socket, 'player1', 'TestPlayer');
    room.removePlayer('player1');
    
    expect(room.getPlayerCount()).toBe(0);
  });

  it('should get player by id', () => {
    room.addPlayer(mockSocket as Socket, 'player1', 'TestPlayer');
    const player = room.getPlayer('player1');
    
    expect(player).toBeDefined();
    expect(player?.playerId).toBe('player1');
    expect(player?.username).toBe('TestPlayer');
  });

  it('should return all players', () => {
    const socket1 = { ...mockSocket, id: 'socket-1' } as Socket;
    const socket2 = { ...mockSocket, id: 'socket-2' } as Socket;
    
    room.addPlayer(socket1, 'player1', 'Player1');
    room.addPlayer(socket2, 'player2', 'Player2');
    
    const players = room.getAllPlayers();
    expect(players).toHaveLength(2);
  });

  it('should deploy thumper when player has inventory', () => {
    room.addPlayer(mockSocket as Socket, 'player1', 'TestPlayer');
    const player = room.getPlayer('player1');
    
    expect(player?.thumperCount).toBe(3);
    
    const result = room.deployThumper('player1');
    expect(result).toBe(true);
    expect(player?.thumperCount).toBe(2);
  });

  it('should not deploy thumper when inventory is empty', () => {
    room.addPlayer(mockSocket as Socket, 'player1', 'TestPlayer');
    const player = room.getPlayer('player1');
    
    if (player) {
      player.thumperCount = 0;
    }
    
    const result = room.deployThumper('player1');
    expect(result).toBe(false);
  });

  it('should track active thumpers', () => {
    room.addPlayer(mockSocket as Socket, 'player1', 'TestPlayer');
    room.deployThumper('player1');
    
    const thumpers = room.getThumpers();
    expect(thumpers).toHaveLength(1);
    expect(thumpers[0].active).toBe(true);
  });

  it('should expire thumpers after duration', () => {
    vi.useFakeTimers();
    
    room.addPlayer(mockSocket as Socket, 'player1', 'TestPlayer');
    room.deployThumper('player1');
    
    vi.advanceTimersByTime(61000);
    room.updateThumpers();
    
    const thumpers = room.getThumpers();
    expect(thumpers).toHaveLength(0);
    
    vi.useRealTimers();
  });

  it('should restore player state on reconnect', () => {
    const socket1 = { ...mockSocket, id: 'socket-1' } as Socket;
    room.addPlayer(socket1, 'player1', 'TestPlayer');

    const player = room.getPlayer('player1');
    if (player) {
      player.state.position = { x: 100, y: 0, z: 100 };
    }

    room.removePlayer('player1');

    const socket2 = { ...mockSocket, id: 'socket-2' } as Socket;
    room.addPlayer(socket2, 'player1', 'TestPlayer');

    const restoredPlayer = room.getPlayer('player1');
    expect(restoredPlayer?.state.position.x).toBe(100);
  });

  // VS4: Thumper Damage Tests
  describe('Thumper Damage', () => {
    it('should damage thumper and reduce health', () => {
      room.addPlayer(mockSocket as Socket, 'player1', 'TestPlayer');
      room.deployThumper('player1');

      const thumpers = room.getThumpers();
      const thumperId = thumpers[0].id;

      const result = room.damageThumper(thumperId, 25);

      expect(result).toBe(true);
      expect(thumpers[0].health).toBe(75);
      expect(thumpers[0].active).toBe(true);
    });

    it('should disable thumper when health reaches 0', () => {
      room.addPlayer(mockSocket as Socket, 'player1', 'TestPlayer');
      room.deployThumper('player1');

      const thumpers = room.getThumpers();
      const thumperId = thumpers[0].id;

      const result = room.damageThumper(thumperId, 100);

      expect(result).toBe(true);
      expect(thumpers[0].health).toBe(0);
      expect(thumpers[0].active).toBe(false);
    });

    it('should not reduce health below 0', () => {
      room.addPlayer(mockSocket as Socket, 'player1', 'TestPlayer');
      room.deployThumper('player1');

      const thumpers = room.getThumpers();
      const thumperId = thumpers[0].id;

      room.damageThumper(thumperId, 150);

      expect(thumpers[0].health).toBe(0);
    });

    it('should return false for non-existent thumper', () => {
      const result = room.damageThumper('invalid-id', 25);

      expect(result).toBe(false);
    });

    it('should get specific thumper by id', () => {
      room.addPlayer(mockSocket as Socket, 'player1', 'TestPlayer');
      room.deployThumper('player1');

      const thumpers = room.getThumpers();
      const thumperId = thumpers[0].id;

      const thumper = room.getThumper(thumperId);

      expect(thumper).toBeDefined();
      expect(thumper?.id).toBe(thumperId);
      expect(thumper?.health).toBe(100);
    });

    it('should return undefined for non-existent thumper', () => {
      const thumper = room.getThumper('invalid-id');

      expect(thumper).toBeUndefined();
    });

    it('should handle multiple damage applications', () => {
      room.addPlayer(mockSocket as Socket, 'player1', 'TestPlayer');
      room.deployThumper('player1');

      const thumpers = room.getThumpers();
      const thumperId = thumpers[0].id;

      // Damage multiple times (5 shots of 20 damage each = 100)
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

  // VS4: Loot Drop Tests
  describe('Loot Drops', () => {
    it('should spawn loot at position', () => {
      const position = { x: 100, y: 0, z: 100 };
      const loot = room.spawnLoot(position, 25);

      expect(loot).toBeDefined();
      expect(loot.position).toEqual(position);
      expect(loot.spice).toBe(25);
      expect(loot.expiresAt).toBeGreaterThan(Date.now());

      const lootDrops = room.getLootDrops();
      expect(lootDrops).toHaveLength(1);
      expect(lootDrops[0].id).toBe(loot.id);
    });

    it('should collect loot and add spice to player', () => {
      room.addPlayer(mockSocket as Socket, 'player1', 'TestPlayer');
      const player = room.getPlayer('player1');
      const initialSpice = player!.resources.spice;

      const loot = room.spawnLoot({ x: 100, y: 0, z: 100 }, 25);
      const collected = room.collectLoot(loot.id, 'player1');

      expect(collected).toBe(25);
      expect(player!.resources.spice).toBe(initialSpice + 25);

      // Loot should be removed after collection
      const lootDrops = room.getLootDrops();
      expect(lootDrops).toHaveLength(0);
    });

    it('should not collect loot with invalid loot id', () => {
      room.addPlayer(mockSocket as Socket, 'player1', 'TestPlayer');
      const collected = room.collectLoot('invalid-id', 'player1');

      expect(collected).toBe(0);
    });

    it('should not collect loot with invalid player id', () => {
      const loot = room.spawnLoot({ x: 100, y: 0, z: 100 }, 25);
      const collected = room.collectLoot(loot.id, 'invalid-player');

      expect(collected).toBe(0);

      // Loot should still exist
      const lootDrops = room.getLootDrops();
      expect(lootDrops).toHaveLength(1);
    });

    it('should expire old loot drops', () => {
      vi.useFakeTimers();

      room.spawnLoot({ x: 100, y: 0, z: 100 }, 25);

      let lootDrops = room.getLootDrops();
      expect(lootDrops).toHaveLength(1);

      // Advance time past expiration (60 seconds)
      vi.advanceTimersByTime(61000);
      room.updateLoot();

      lootDrops = room.getLootDrops();
      expect(lootDrops).toHaveLength(0);

      vi.useRealTimers();
    });

    it('should not expire loot before expiration time', () => {
      vi.useFakeTimers();

      room.spawnLoot({ x: 100, y: 0, z: 100 }, 25);

      // Advance time but not past expiration (59 seconds)
      vi.advanceTimersByTime(59000);
      room.updateLoot();

      const lootDrops = room.getLootDrops();
      expect(lootDrops).toHaveLength(1);

      vi.useRealTimers();
    });

    it('should get loot drop by id', () => {
      const loot = room.spawnLoot({ x: 100, y: 0, z: 100 }, 25);
      const retrieved = room.getLootDrop(loot.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(loot.id);
      expect(retrieved?.spice).toBe(25);
    });

    it('should return undefined for invalid loot id', () => {
      const retrieved = room.getLootDrop('invalid-id');
      expect(retrieved).toBeUndefined();
    });

    it('should handle multiple loot drops', () => {
      room.spawnLoot({ x: 100, y: 0, z: 100 }, 10);
      room.spawnLoot({ x: 200, y: 0, z: 200 }, 20);
      room.spawnLoot({ x: 300, y: 0, z: 300 }, 30);

      const lootDrops = room.getLootDrops();
      expect(lootDrops).toHaveLength(3);

      const totalSpice = lootDrops.reduce((sum, loot) => sum + loot.spice, 0);
      expect(totalSpice).toBe(60);
    });
  });
});
