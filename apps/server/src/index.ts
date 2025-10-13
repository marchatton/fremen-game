import { Server } from 'socket.io';
import { createServer } from 'http';
import express from 'express';
import { GAME_CONSTANTS } from '@fremen/shared';
import { generateToken, verifyToken } from './auth/jwt';
import { Room } from './game/Room';
import { GameLoop } from './game/GameLoop';

const PORT = process.env.PORT || 3000;

const app = express();
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

app.get('/auth/token', (req, res) => {
  const token = generateToken();
  res.json({ token });
});

const WORLD_SEED = 12345;
const mainRoom = new Room('main');
const gameLoop = new GameLoop(mainRoom, WORLD_SEED);
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

io.on('connection', (socket) => {
  const { playerId, username } = socket.data;
  console.log(`Client connected: ${username} (${playerId})`);

  const added = mainRoom.addPlayer(socket, playerId, username);
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
    mainRoom.removePlayer(playerId);
  });

  socket.on('input', (data) => {
    const player = mainRoom.getPlayer(playerId);
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
  });
});

httpServer.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
