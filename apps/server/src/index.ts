import { Server } from 'socket.io';
import { createServer } from 'http';
import { GAME_CONSTANTS } from '@fremen/shared';

const PORT = process.env.PORT || 3000;

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
});

console.log('Fremen Game - Server Starting');
console.log('Game Constants:', GAME_CONSTANTS);

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

let tickCount = 0;
const tickInterval = 1000 / GAME_CONSTANTS.TICK_RATE;

setInterval(() => {
  tickCount++;
  if (tickCount % GAME_CONSTANTS.TICK_RATE === 0) {
    console.log(`Server tick: ${tickCount} (${GAME_CONSTANTS.TICK_RATE}hz)`);
  }
}, tickInterval);

httpServer.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
