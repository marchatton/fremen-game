import { GAME_CONSTANTS, PlayerStateEnum, ECONOMY_CONSTANTS } from '@fremen/shared';
import type { EquipmentStats, Vector3 } from '@fremen/shared';
import type { CombatEventMessage } from '@fremen/protocol';
import type { Room, RoomPlayer } from './Room';
import { Physics } from './sim/Physics';
import { WormAI } from './sim/WormAI';
import { WormDamage } from './sim/WormDamage';
import { ObjectiveManager } from './ObjectiveManager';
import { SpiceManager } from './SpiceManager';
import { WaterSystem } from './WaterSystem';
import { OasisManager } from './OasisManager';
import { EquipmentManager } from './EquipmentManager';
import { SietchManager } from './SietchManager';
import { RewardManager } from './RewardManager';
import { DeathManager } from './DeathManager';
import type { PlayerRepository } from './PlayerRepository';
import { SystemRegistry } from './SystemRegistry';
import type { GameSystem } from './SystemRegistry';
import { CombatSystem } from './CombatSystem';
import { OutpostManager } from './OutpostManager';
import { AIManager } from './ai/AIManager';

export class GameLoop {
  private room: Room;
  private physics: Physics;
  private wormAI: WormAI;
  private wormDamage: WormDamage;
  private objectiveManager: ObjectiveManager;

  // VS3 Systems
  private spiceManager: SpiceManager;
  private waterSystem: WaterSystem;
  private oasisManager: OasisManager;
  private equipmentManager: EquipmentManager;
  private sietchManager: SietchManager;
  private rewardManager: RewardManager;
  private deathManager: DeathManager;
  private registry: SystemRegistry;
  private combatSystem: CombatSystem;
  private outpostManager: OutpostManager;
  private aiManager: AIManager;
  private equipmentStatsCache = new Map<string, EquipmentStats>();
  private lastPositions = new Map<string, { x: number; z: number }>();

  private tickCount = 0;
  private lastTickTime = Date.now();
  private intervalId?: NodeJS.Timeout;
  private persistence?: PlayerRepository;

  constructor(room: Room, seed: number, persistence?: PlayerRepository) {
    this.room = room;
    this.physics = new Physics(seed);
    this.wormAI = new WormAI();
    this.wormDamage = new WormDamage(seed);
    this.objectiveManager = new ObjectiveManager();
    this.objectiveManager.spawnRandomObjective();

    // Initialize VS3 systems
    this.spiceManager = new SpiceManager(seed);
    this.waterSystem = new WaterSystem();
    this.oasisManager = new OasisManager();
    this.equipmentManager = new EquipmentManager();
    this.sietchManager = new SietchManager();
    this.rewardManager = new RewardManager();
    this.deathManager = new DeathManager();
    this.persistence = persistence;

    // Generate world content
    this.spiceManager.generateNodes();
    this.oasisManager.generateOases();

    this.registry = new SystemRegistry();
    this.combatSystem = new CombatSystem(this.room, {
      deathManager: this.deathManager,
      onPersistenceSnapshot: player => this.queuePersistenceUpdate(player),
    });

    this.combatSystem.onEvent(event => this.broadcastCombatEvent(event));

    this.outpostManager = new OutpostManager(
      this.room,
      playerId => this.rewardOutpostCapture(playerId),
      () => this.room.getActiveThumpers()
    );

    this.aiManager = new AIManager(this.room, this.combatSystem, this.outpostManager);

    this.outpostManager.setGarrisonProvider(
      outpostId => this.aiManager.getTroopersForOutpost(outpostId).length
    );
    this.outpostManager.setFactionChangeHandler((outpostId, faction) => {
      this.aiManager.onOutpostFactionChange(outpostId, faction);
    });

    this.registry.registerSystem(this.combatSystem);
    this.registry.registerSystem(this.outpostManager);
    this.registry.registerSystem(this.aiManager);
    this.registry.registerSystem(this.createEquipmentSystem());
    this.registry.registerSystem(this.createWormSystem());
    this.registry.registerSystem(this.createPhysicsSystem());
    this.registry.registerSystem(this.createWaterSystem());
    this.registry.registerSystem(this.createRewardSystem());
    this.registry.registerSystem(this.createSpiceSystem());
    this.registry.registerSystem(this.createOasisSystem());
    this.registry.registerSystem(this.createPersistenceSystem());
    this.registry.registerSystem(this.createHousekeepingSystem());

    console.log('VS3 systems initialized');
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

  onPlayerJoin(player: RoomPlayer): void {
    this.registry.onPlayerJoin(player);
    this.lastPositions.set(player.playerId, {
      x: player.state.position.x,
      z: player.state.position.z,
    });
  }

  onPlayerLeave(playerId: string): void {
    this.registry.onPlayerLeave(playerId);
    this.lastPositions.delete(playerId);
    this.equipmentStatsCache.delete(playerId);
  }

  private tick() {
    this.tickCount++;
    const now = Date.now();
    const deltaTime = (now - this.lastTickTime) / 1000;
    this.lastTickTime = now;

    this.registry.update(deltaTime);
    this.broadcastState();

    if (this.tickCount % GAME_CONSTANTS.TICK_RATE === 0) {
      console.log(`Tick ${this.tickCount} - Players: ${this.room.getPlayerCount()}`);
    }
  }

  private broadcastCombatEvent(event: CombatEventMessage): void {
    const payload = {
      type: 'S_COMBAT_EVENT' as const,
      event,
      timestamp: Date.now(),
    };

    for (const player of this.room.getAllPlayers()) {
      player.socket.emit('combat', payload);
    }
  }

  private broadcastState() {
    const players = this.room.getAllPlayers();
    const worms = this.wormAI.getWorms();
    const thumpers = this.room.getThumpers();
    const objective = this.objectiveManager.getActiveObjective();
    const outposts = this.outpostManager.getOutposts();

    for (const player of players) {
      const stateMessage = {
        type: 'S_STATE',
        timestamp: Date.now(),
        lastProcessedInputSeq: player.lastInputSeq,
        players: players.map(p => p.state),
        worms,
        thumpers,
        outposts,
        objective: objective ? {
          id: objective.id,
          type: objective.type,
          targetPosition: objective.targetPosition,
          radius: objective.radius,
          timeRemaining: Math.max(0, objective.expiresAt - Date.now()),
          status: objective.status,
        } : undefined,
      };
      
      player.socket.emit('state', stateMessage);
    }
  }

  private createEquipmentSystem(): GameSystem {
    return {
      onPlayerJoin: (player: RoomPlayer) => {
        const stats = this.equipmentManager.calculateTotalStats(player.resources.equipment);
        this.equipmentStatsCache.set(player.playerId, stats);
      },
      onPlayerLeave: (playerId: string) => {
        this.equipmentStatsCache.delete(playerId);
      },
      update: () => {
        for (const player of this.room.getAllPlayers()) {
          const stats = this.equipmentManager.calculateTotalStats(player.resources.equipment);
          this.equipmentStatsCache.set(player.playerId, stats);
        }
      },
    };
  }

  private createWormSystem(): GameSystem {
    return {
      update: (deltaTime: number) => {
        this.wormAI.update(deltaTime);
        this.room.updateThumpers();

        const activeThumpers = this.room.getActiveThumpers();
        for (const thumper of activeThumpers) {
          const nearestWormId = this.wormAI.findNearestWorm(thumper.position);
          if (nearestWormId) {
            this.wormAI.setWormTarget(nearestWormId, thumper.position);
          }
        }

        this.objectiveManager.update();

        const worms = this.wormAI.getWorms();
        for (const worm of worms) {
          if (worm.aiState === 'RIDDEN_BY' && worm.controlPoints.length > 0) {
            const completed = this.objectiveManager.checkObjectiveCompletion(worm.controlPoints[0]);
            if (completed && worm.riderId) {
              this.grantObjectiveReward(worm.riderId);
            }
          }

          const damage = this.wormDamage.checkTerrainDamage(worm);
          if (damage > 0) {
            const died = this.wormDamage.applyDamage(worm, damage);
            if (died && worm.riderId) {
              this.handleDismount(worm.riderId);
              console.log(`Worm ${worm.id} died, ejecting rider`);
            }
          }
        }
      },
    };
  }

  private createPhysicsSystem(): GameSystem {
    return {
      update: (deltaTime: number) => {
        for (const player of this.room.getAllPlayers()) {
          if (player.state.state === PlayerStateEnum.RIDING && player.state.ridingWormId) {
            const worm = this.wormAI.getWorm(player.state.ridingWormId);
            if (worm && worm.controlPoints.length >= 3) {
              const segment = worm.controlPoints[2];
              player.state.position = { ...segment };
              player.state.velocity = { x: 0, y: 0, z: 0 };
            }
          } else {
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
        }
      },
    };
  }

  private createWaterSystem(): GameSystem {
    return {
      update: (deltaTime: number) => {
        for (const player of this.room.getAllPlayers()) {
          if (player.state.state === PlayerStateEnum.DEAD) {
            continue;
          }

          const stats = this.equipmentStatsCache.get(player.playerId);
          const waterReduction = stats?.waterReduction ?? this.equipmentManager.calculateWaterReduction(player.resources.equipment);

          player.resources.water = this.waterSystem.calculateWaterDepletion(
            player.resources.water,
            player.state,
            deltaTime,
            waterReduction
          );

          const effect = this.waterSystem.getThirstEffects(player.resources.water);
          if (effect.healthDrain > 0) {
            this.combatSystem.applyDamageByEnvironment(
              player.playerId,
              effect.healthDrain * deltaTime
            );
          }

          if (this.deathManager.checkDeath(player.resources.water)) {
            this.combatSystem.applyDamageByEnvironment(
              player.playerId,
              Math.max(player.health, 1)
            );
          }
        }
      },
    };
  }

  private createRewardSystem(): GameSystem {
    return {
      update: () => {
        for (const player of this.room.getAllPlayers()) {
          const prev = this.lastPositions.get(player.playerId);
          if (prev && player.state.state !== PlayerStateEnum.DEAD) {
            const distance = Math.sqrt(
              Math.pow(player.state.position.x - prev.x, 2) +
              Math.pow(player.state.position.z - prev.z, 2)
            );
            player.resources.stats = this.rewardManager.addDistanceTraveled(
              player.resources.stats,
              distance
            );
          }

          this.lastPositions.set(player.playerId, {
            x: player.state.position.x,
            z: player.state.position.z,
          });
        }
      },
    };
  }

  private createSpiceSystem(): GameSystem {
    return {
      update: (deltaTime: number) => {
        this.spiceManager.update(deltaTime);
      },
    };
  }

  private createOasisSystem(): GameSystem {
    let accumulator = 0;
    return {
      update: (deltaTime: number) => {
        accumulator += deltaTime;
        if (accumulator >= 1) {
          this.oasisManager.cleanupExpiredCooldowns();
          accumulator = 0;
        }
      },
    };
  }

  private createPersistenceSystem(): GameSystem {
    return {
      update: () => {
        for (const player of this.room.getAllPlayers()) {
          this.queuePersistenceUpdate(player);
        }
      },
    };
  }

  private createHousekeepingSystem(): GameSystem {
    return {
      update: () => {
        if (this.tickCount % (GAME_CONSTANTS.TICK_RATE * 60) === 0) {
          this.room.cleanupDisconnectedPlayers();
        }
      },
    };
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

    // VS3: Track worms ridden stat
    player.resources.stats = this.rewardManager.incrementWormsRidden(player.resources.stats);
    this.queuePersistenceUpdate(player);

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
    this.queuePersistenceUpdate(player);

    return { success: true };
  }

  handleWormControl(wormId: string, direction: number, speedIntent: number) {
    const deltaTime = 1 / GAME_CONSTANTS.TICK_RATE;
    this.wormAI.steerWorm(wormId, direction, speedIntent, deltaTime);
  }

  handlePlayerFire(playerId: string, payload: { weaponId: string; targetId: string; damage?: number; origin?: Vector3 }): boolean {
    return this.combatSystem.handlePlayerFire(playerId, payload);
  }

  /**
   * VS3: Grant objective reward
   */
  private grantObjectiveReward(playerId: string): void {
    const player = this.room.getPlayer(playerId);
    if (!player) return;

    const rewardResult = this.rewardManager.grantObjectiveReward(
      player.resources.spice,
      player.resources.water
    );

    player.resources.spice = rewardResult.spice;
    player.resources.water = rewardResult.water;
    player.resources.stats = this.rewardManager.updateObjectiveStats(
      player.resources.stats,
      ECONOMY_CONSTANTS.OBJECTIVE_REWARD_SPICE
    );
    this.queuePersistenceUpdate(player);

    console.log(`Player ${playerId} completed objective: +${ECONOMY_CONSTANTS.OBJECTIVE_REWARD_SPICE} spice, +${ECONOMY_CONSTANTS.OBJECTIVE_REWARD_WATER} water`);
  }

  private rewardOutpostCapture(playerId: string): void {
    const player = this.room.getPlayer(playerId);
    if (!player) {
      return;
    }

    const reward = this.rewardManager.grantOutpostReward(
      player.resources.spice,
      player.resources.water
    );

    const spiceDelta = reward.spice - player.resources.spice;
    const waterDelta = reward.water - player.resources.water;

    player.resources.spice = reward.spice;
    player.resources.water = reward.water;
    player.resources.stats = this.rewardManager.recordOutpostCapture(player.resources.stats);
    this.queuePersistenceUpdate(player);

    console.log(
      `Player ${playerId} captured outpost: +${spiceDelta} spice, +${waterDelta} water`
    );
  }

  private queuePersistenceUpdate(player: RoomPlayer): void {
    this.persistence?.updateSnapshot(player.playerId, {
      position: { ...player.state.position },
      resources: {
        water: player.resources.water,
        spice: player.resources.spice,
        equipment: { ...player.resources.equipment },
        stats: { ...player.resources.stats },
        inventory: player.resources.inventory ? [...player.resources.inventory] : [],
      },
    });
  }
}
