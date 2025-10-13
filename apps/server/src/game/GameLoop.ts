import { GAME_CONSTANTS } from '@fremen/shared';
import type { Room } from './Room';

export class GameLoop {
  private room: Room;
  private tickCount = 0;
  private lastTickTime = Date.now();
  private intervalId?: NodeJS.Timeout;

  constructor(room: Room) {
    this.room = room;
  }

  start() {
    const tickInterval = 1000 / GAME_CONSTANTS.TICK_RATE;
    this.intervalId = setInterval(() => this.tick(), tickInterval);
    console.log(`Game loop started at ${GAME_CONSTANTS.TICK_RATE}hz`);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
      console.log('Game loop stopped');
    }
  }

  private tick() {
    this.tickCount++;
    const now = Date.now();
    const deltaTime = (now - this.lastTickTime) / 1000;
    this.lastTickTime = now;

    this.updateGameState(deltaTime);
    this.broadcastState();

    if (this.tickCount % GAME_CONSTANTS.TICK_RATE === 0) {
      console.log(`Tick ${this.tickCount} - Players: ${this.room.getPlayerCount()}`);
    }

    if (this.tickCount % (GAME_CONSTANTS.TICK_RATE * 60) === 0) {
      this.room.cleanupDisconnectedPlayers();
    }
  }

  private updateGameState(deltaTime: number) {
    const players = this.room.getAllPlayers();
    
    for (const player of players) {
      player.state.position.x += player.state.velocity.x * deltaTime;
      player.state.position.y += player.state.velocity.y * deltaTime;
      player.state.position.z += player.state.velocity.z * deltaTime;
    }
  }

  private broadcastState() {
    const players = this.room.getAllPlayers();
    
    const stateMessage = {
      type: 'S_STATE',
      timestamp: Date.now(),
      players: players.map(p => p.state),
      worms: [],
      thumpers: [],
    };

    for (const player of players) {
      player.socket.emit('state', stateMessage);
    }
  }
}
