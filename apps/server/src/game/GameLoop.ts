import { GAME_CONSTANTS } from '@fremen/shared';
import type { Room } from './Room';
import { Physics } from './sim/Physics';
import { WormAI } from './sim/WormAI';

export class GameLoop {
  private room: Room;
  private physics: Physics;
  private wormAI: WormAI;
  private tickCount = 0;
  private lastTickTime = Date.now();
  private intervalId?: NodeJS.Timeout;

  constructor(room: Room, seed: number) {
    this.room = room;
    this.physics = new Physics(seed);
    this.wormAI = new WormAI();
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
      if (!this.physics.validatePlayerSpeed(player.state.velocity)) {
        console.warn(`Speed hack detected for player ${player.playerId}`);
        player.state.velocity = this.physics.clampVelocity(player.state.velocity);
      }

      player.state.position = this.physics.validatePlayerPosition(
        player.state.position,
        player.state.velocity,
        deltaTime
      );
    }

    this.wormAI.update(deltaTime);
    
    this.room.updateThumpers();
    
    const activeThumpers = this.room.getActiveThumpers();
    for (const thumper of activeThumpers) {
      const nearestWormId = this.wormAI.findNearestWorm(thumper.position);
      if (nearestWormId) {
        this.wormAI.setWormTarget(nearestWormId, thumper.position);
      }
    }
  }

  private broadcastState() {
    const players = this.room.getAllPlayers();
    const worms = this.wormAI.getWorms();
    const thumpers = this.room.getThumpers();
    
    for (const player of players) {
      const stateMessage = {
        type: 'S_STATE',
        timestamp: Date.now(),
        lastProcessedInputSeq: player.lastInputSeq,
        players: players.map(p => p.state),
        worms,
        thumpers,
      };
      
      player.socket.emit('state', stateMessage);
    }
  }
}
