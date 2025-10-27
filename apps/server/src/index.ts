import { Server } from 'socket.io';
import { createServer } from 'http';
import express from 'express';
import cors from 'cors';
import { GAME_CONSTANTS } from '@fremen/shared';
import { generateToken, verifyToken } from './auth/jwt';
import { Room } from './game/Room';
import { GameLoop } from './game/GameLoop';
import { RateLimiter } from './game/RateLimiter';
import { createDbPlayerRepository } from './game/PlayerRepository';

const PORT = process.env.PORT || 3000;

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
});

console.log('Fremen Game - Server Starting');
console.log('Game Constants:', GAME_CONSTANTS);

app.get('/', (req, res) => {
  res.json({
    name: 'Fremen Game Server',
    version: '0.1.0',
    status: 'running',
    players: mainRoom.getPlayerCount(),
    endpoints: {
      auth: '/auth/token',
      websocket: 'ws://localhost:3000',
    },
    client: 'http://localhost:5173',
  });
});

app.get('/auth/token', (req, res) => {
  const token = generateToken();
  res.json({ token });
});

const WORLD_SEED = 12345;
const playerRepository = createDbPlayerRepository();
const mainRoom = new Room('main', playerRepository);
const gameLoop = new GameLoop(mainRoom, WORLD_SEED, playerRepository);
const chatRateLimiter = new RateLimiter();

gameLoop.start();

io.use((socket, next) => {
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

io.on('connection', async (socket) => {
  const { playerId, username } = socket.data;
  console.log(`Client connected: ${username} (${playerId})`);

  const added = await mainRoom.addPlayer(socket, playerId, username);
  if (!added) {
    socket.emit('error', { message: 'Room is full' });
    socket.disconnect();
    return;
  }

  socket.emit('welcome', {
    type: 'S_WELCOME',
    playerId,
    seed: WORLD_SEED,
    timestamp: Date.now(),
  });

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${username} (${playerId})`);
    void mainRoom.removePlayer(playerId);
  });

  socket.on('input', (data) => {
    let player = mainRoom.getPlayer(playerId);
    if (!player) return;

    player.lastInputSeq = data.seq;

    if (data.action?.type === 'deployThumper') {
      const deployed = mainRoom.deployThumper(playerId);
      if (deployed) {
        socket.emit('thumperDeployed', { success: true });
      } else {
        socket.emit('thumperDeployed', { success: false, reason: 'No thumpers available' });
      }
      return;
    }

    if (data.action?.type === 'mount' && data.action.target) {
      const result = gameLoop.handleMountAttempt(playerId, data.action.target);
      socket.emit('mountResult', result);
      return;
    }

    if (data.action?.type === 'dismount') {
      const result = gameLoop.handleDismount(playerId);
      socket.emit('dismountResult', result);
      return;
    }

    if (data.wormControl && player.state.ridingWormId) {
      gameLoop.handleWormControl(
        player.state.ridingWormId,
        data.wormControl.direction,
        data.wormControl.speedIntent
      );
    } else {
      const { movement, rotation } = data;
      const speed = GAME_CONSTANTS.PLAYER_MAX_SPEED;
      
      const velocity = {
        x: movement.right * speed,
        y: 0,
        z: -movement.forward * speed,
      };

      mainRoom.updatePlayerState(playerId, {
        velocity,
        rotation,
      });
    }
  });

  socket.on('chat', (data) => {
    const player = mainRoom.getPlayer(playerId);
    if (!player) return;

    if (!chatRateLimiter.check(playerId, 1, 2000)) {
      socket.emit('error', { message: 'Chat rate limit exceeded' });
      return;
    }

    if (!data.message || data.message.length > 200) {
      return;
    }

    const chatMessage = {
      type: 'S_CHAT',
      playerId,
      playerName: username,
      message: data.message,
      timestamp: Date.now(),
    };

    for (const p of mainRoom.getAllPlayers()) {
      p.socket.emit('chat', chatMessage);
    }

    console.log(`Chat from ${username}: ${data.message}`);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
