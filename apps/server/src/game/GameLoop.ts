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

  handleMountAttempt(playerId: string, wormId: string): { success: boolean; reason?: string } {
    const player = this.room.getPlayer(playerId);
    if (!player) {
      return { success: false, reason: 'Player not found' };
    }

    if (player.state.state === PlayerStateEnum.RIDING) {
      return { success: false, reason: 'Already mounted' };
    }

    const worm = this.wormAI.getWorm(wormId);
    if (!worm) {
      return { success: false, reason: 'Worm not found' };
    }

    const head = worm.controlPoints[0];
    const distance = Math.sqrt(
      (player.state.position.x - head.x) ** 2 +
      (player.state.position.z - head.z) ** 2
    );

    if (distance > GAME_CONSTANTS.WORM_MOUNT_DISTANCE) {
      return { success: false, reason: 'Too far from worm' };
    }

    const mounted = this.wormAI.mountWorm(wormId, playerId);
    if (!mounted) {
      return { success: false, reason: 'Worm not available' };
    }

    player.state.state = PlayerStateEnum.RIDING;
    player.state.ridingWormId = wormId;
    player.state.velocity = { x: 0, y: 0, z: 0 };

    return { success: true };
  }

  handleDismount(playerId: string): { success: boolean; reason?: string } {
    const player = this.room.getPlayer(playerId);
    if (!player) {
      return { success: false, reason: 'Player not found' };
    }

    if (player.state.state !== PlayerStateEnum.RIDING || !player.state.ridingWormId) {
      return { success: false, reason: 'Not mounted' };
    }

    const worm = this.wormAI.getWorm(player.state.ridingWormId);
    if (worm) {
      const head = worm.controlPoints[0];
      player.state.position = {
        x: head.x + 3,
        y: head.y + 1,
        z: head.z,
      };
    }

    this.wormAI.dismountWorm(player.state.ridingWormId);
    player.state.state = PlayerStateEnum.ACTIVE;
    player.state.ridingWormId = undefined;

    return { success: true };
  }
}
