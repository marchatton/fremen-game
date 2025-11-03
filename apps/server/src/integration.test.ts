import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import { createServer, Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { Room } from './game/Room';
import { GameLoop } from './game/GameLoop';
import { generateToken, verifyToken } from './auth/jwt';
import { InMemoryPlayerRepository } from './game/testing/InMemoryPlayerRepository';

describe('Integration Tests', () => {
  let httpServer: HTTPServer;
  let ioServer: SocketIOServer;
  let room: Room;
  let gameLoop: GameLoop;
  let clientSocket1: ClientSocket;
  let clientSocket2: ClientSocket;
  let repository: InMemoryPlayerRepository;
  const PORT = 3001;

  beforeAll(async () => {
    httpServer = createServer();
    ioServer = new SocketIOServer(httpServer, {
      cors: { origin: '*' },
    });

    repository = new InMemoryPlayerRepository();
    room = new Room('test-room', repository);
    gameLoop = new GameLoop(room, 12345, repository);
    gameLoop.start();

    ioServer.use((socket, next) => {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication required'));
      }

      const payload = verifyToken(token);
      if (!payload) {
        return next(new Error('Invalid token'));
      }

      socket.data.playerId = payload.playerId;
      socket.data.username = payload.username;
      next();
    });

    ioServer.on('connection', async (socket) => {
      const { playerId, username } = socket.data;

      const added = await room.addPlayer(socket, playerId, username);
      if (!added) {
        socket.emit('error', { message: 'Room is full' });
        socket.disconnect();
        return;
      }

      const player = room.getPlayer(playerId);
      if (player) {
        gameLoop.onPlayerJoin(player);
      }
      
      socket.emit('welcome', {
        type: 'S_WELCOME',
        playerId,
        seed: 12345,
        timestamp: Date.now(),
      });

      socket.on('disconnect', async () => {
        await room.removePlayer(playerId);
        gameLoop.onPlayerLeave(playerId);
      });

      socket.on('input', (data) => {
        const player = room.getPlayer(playerId);
        if (player) {
          player.lastInputSeq = data.seq;
          const { movement, rotation } = data;
          
          player.state.velocity = {
            x: movement.right * 10,
            y: 0,
            z: -movement.forward * 10,
          };
          player.state.rotation = rotation;
        }
      });
    });

    await new Promise<void>((resolve) => {
      httpServer.listen(PORT, resolve);
    });
  });

  afterAll(async () => {
    gameLoop.stop();
    ioServer.close();
    httpServer.close();
    
    await new Promise<void>((resolve) => {
      httpServer.once('close', () => resolve());
    });
  });

  beforeEach(() => {
    if (clientSocket1?.connected) clientSocket1.disconnect();
    if (clientSocket2?.connected) clientSocket2.disconnect();
  });

  it('should allow client to connect with valid token', async () => {
    const token = generateToken('player1', 'TestPlayer1');
    
    clientSocket1 = ioClient(`http://localhost:${PORT}`, {
      auth: { token },
    });

    await new Promise<void>((resolve) => {
      clientSocket1.on('welcome', (data) => {
        expect(data.playerId).toBe('player1');
        expect(data.seed).toBe(12345);
        resolve();
      });
    });
  });

  it('should allow two players to connect and see each other', async () => {
    const token1 = generateToken('player1', 'Player1');
    const token2 = generateToken('player2', 'Player2');

    clientSocket1 = ioClient(`http://localhost:${PORT}`, {
      auth: { token: token1 },
    });

    await new Promise<void>((resolve) => {
      clientSocket1.on('welcome', () => resolve());
    });

    clientSocket2 = ioClient(`http://localhost:${PORT}`, {
      auth: { token: token2 },
    });

    await new Promise<void>((resolve) => {
      clientSocket2.on('welcome', () => resolve());
    });

    expect(room.getPlayerCount()).toBe(2);
  });

  it('should process client input and update state', async () => {
    const token = generateToken('player1', 'Player1');
    
    clientSocket1 = ioClient(`http://localhost:${PORT}`, {
      auth: { token },
    });

    await new Promise<void>((resolve) => {
      clientSocket1.on('welcome', () => resolve());
    });

    clientSocket1.emit('input', {
      type: 'C_INPUT',
      seq: 1,
      timestamp: Date.now(),
      movement: { forward: 1, right: 0 },
      rotation: 0,
    });

    await new Promise((resolve) => setTimeout(resolve, 100));

    const player = room.getPlayer('player1');
    expect(player).toBeDefined();
    expect(player?.lastInputSeq).toBe(1);
  });

  it('should handle client disconnection', async () => {
    const token = generateToken('player1', 'Player1');
    
    clientSocket1 = ioClient(`http://localhost:${PORT}`, {
      auth: { token },
    });

    await new Promise<void>((resolve) => {
      clientSocket1.on('welcome', () => resolve());
    });

    expect(room.getPlayerCount()).toBe(1);

    clientSocket1.disconnect();

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(room.getPlayerCount()).toBe(0);
  });
});
