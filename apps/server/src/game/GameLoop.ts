import { GAME_CONSTANTS, PlayerStateEnum, ECONOMY_CONSTANTS } from '@fremen/shared';
import type { Room } from './Room';
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
import { CombatSystem, WeaponType } from './CombatSystem';
import { HarkonnenAI, HarkonnenState } from './ai/HarkonnenAI';
import { OutpostManager } from './OutpostManager';
import { AlertSystem } from './AlertSystem';

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

  // VS4 Systems
  private combatSystem: CombatSystem;
  private harkonnenAI: HarkonnenAI;
  private outpostManager: OutpostManager;
  private alertSystem: AlertSystem;

  private tickCount = 0;
  private lastTickTime = Date.now();
  private intervalId?: NodeJS.Timeout;

  constructor(room: Room, seed: number) {
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

    // Generate world content
    this.spiceManager.generateNodes();
    this.oasisManager.generateOases();

    console.log('VS3 systems initialized');

    // Initialize VS4 systems
    this.combatSystem = new CombatSystem();
    this.harkonnenAI = new HarkonnenAI();
    this.outpostManager = new OutpostManager(seed);
    this.alertSystem = new AlertSystem();

    // Connect alert system to AI
    this.harkonnenAI.setAlertSystem(this.alertSystem);

    // Generate outposts and spawn Harkonnen
    const oasisPositions = this.oasisManager.getOases().map(o => o.position);
    this.outpostManager.generateOutposts(oasisPositions);
    this.spawnHarkonnenAtOutposts();

    console.log('VS4 systems initialized');
  }

  /**
   * VS4: Spawn Harkonnen troopers at all outposts
   */
  private spawnHarkonnenAtOutposts(): void {
    const outposts = this.outpostManager.getOutposts();

    for (const outpost of outposts) {
      const trooperCount = this.outpostManager.getTrooperCountForOutpost(outpost.id);
      const patrolPath = this.outpostManager.generatePatrolPath(outpost.id);

      for (let i = 0; i < trooperCount; i++) {
        const trooperId = `${outpost.id}-trooper-${i}`;

        this.harkonnenAI.spawnTrooper(
          trooperId,
          outpost.position,
          patrolPath.waypoints,
          outpost.id
        );

        this.outpostManager.addTrooperToOutpost(outpost.id, trooperId);
      }
    }

    const stats = this.outpostManager.getOutpostStats();
    console.log(`Spawned ${stats.totalTroopers} Harkonnen troopers across ${stats.total} outposts`);
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

    this.wormAI.update(deltaTime);

    // Track previous positions for distance calculation
    const previousPositions = new Map<string, {x: number, z: number}>();

    for (const player of players) {
      // Store previous position
      previousPositions.set(player.playerId, {
        x: player.state.position.x,
        z: player.state.position.z,
      });

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

      // VS3: Water depletion
      if (player.state.state !== PlayerStateEnum.DEAD) {
        const waterReduction = this.equipmentManager.calculateWaterReduction(player.resources.equipment);
        player.resources.water = this.waterSystem.calculateWaterDepletion(
          player.resources.water,
          player.state,
          deltaTime,
          waterReduction
        );

        // Apply thirst effects
        const effect = this.waterSystem.getThirstEffects(player.resources.water);

        // Apply health drain
        if (effect.healthDrain > 0) {
          player.health -= effect.healthDrain * deltaTime;
          player.health = Math.max(0, player.health);
        }

        // Check for death
        if (this.deathManager.checkDeath(player.resources.water) || player.health <= 0) {
          this.handlePlayerDeath(player.playerId);
        }
      }

      // VS3: Track distance traveled
      const prevPos = previousPositions.get(player.playerId);
      if (prevPos && player.state.state !== PlayerStateEnum.DEAD) {
        const distance = Math.sqrt(
          Math.pow(player.state.position.x - prevPos.x, 2) +
          Math.pow(player.state.position.z - prevPos.z, 2)
        );
        player.resources.stats = this.rewardManager.addDistanceTraveled(
          player.resources.stats,
          distance
        );
      }

      // VS4: Auto-collect nearby loot drops
      if (player.state.state !== PlayerStateEnum.DEAD) {
        const lootDrops = this.room.getLootDrops();
        for (const loot of lootDrops) {
          const lootDistance = Math.sqrt(
            Math.pow(player.state.position.x - loot.position.x, 2) +
            Math.pow(player.state.position.z - loot.position.z, 2)
          );

          // Auto-collect within 5m radius
          if (lootDistance <= 5) {
            const collected = this.room.collectLoot(loot.id, player.playerId);
            if (collected > 0) {
              console.log(`Player ${player.username} auto-collected ${collected} spice`);
            }
          }
        }
      }
    }

    // VS3: Update spice harvesting
    this.spiceManager.update(deltaTime);

    // VS4: Update thumpers and loot drops
    this.room.updateThumpers();
    this.room.updateLoot();
    
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

        // VS3: Grant reward to rider on objective completion
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

    // VS4: Update Harkonnen AI
    const playerData = players.map(p => ({
      id: p.playerId,
      position: p.state.position,
      state: p.state.state,
    }));
    const thumperData = this.room.getActiveThumpers().map(t => ({
      id: t.id,
      position: t.position,
      active: t.active,
    }));
    this.harkonnenAI.update(deltaTime, playerData, thumperData);

    // VS4: Cleanup expired alerts
    this.alertSystem.cleanup();

    // VS4: Apply Harkonnen damage to players and thumpers
    const shots = this.harkonnenAI.getShotsFired();
    for (const shot of shots) {
      if (shot.hit && shot.targetId) {
        // Check if target is a thumper
        if (shot.targetType === 'thumper') {
          this.room.damageThumper(shot.targetId, shot.damage);
        } else {
          // Target is a player
          const player = this.room.getPlayer(shot.targetId);
          if (player && player.state.state !== PlayerStateEnum.DEAD) {
            const damageResult = this.combatSystem.applyDamage(
              player.health,
              shot.damage,
              shot.targetId
            );

            player.health = damageResult.healthRemaining;

            if (damageResult.killed) {
              this.handlePlayerDeath(player.playerId);
            }
          }
        }
      }
    }
  }

  private broadcastState() {
    const players = this.room.getAllPlayers();
    const worms = this.wormAI.getWorms();
    const thumpers = this.room.getThumpers();
    const lootDrops = this.room.getLootDrops(); // VS4: Loot drops
    const objective = this.objectiveManager.getActiveObjective();

    for (const player of players) {
      const stateMessage = {
        type: 'S_STATE',
        timestamp: Date.now(),
        lastProcessedInputSeq: player.lastInputSeq,
        players: players.map(p => p.state),
        worms,
        thumpers,
        lootDrops, // VS4: Include loot drops in state
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

  handleWormControl(wormId: string, direction: number, speedIntent: number) {
    const deltaTime = 1 / GAME_CONSTANTS.TICK_RATE;
    this.wormAI.steerWorm(wormId, direction, speedIntent, deltaTime);
  }

  /**
   * VS4: Handle player shooting at Harkonnen
   */
  handlePlayerShoot(playerId: string, targetPosition: { x: number; y: number; z: number }): { success: boolean; hit: boolean; damage?: number; targetId?: string; reason?: string } {
    const player = this.room.getPlayer(playerId);
    if (!player) {
      return { success: false, hit: false, reason: 'Player not found' };
    }

    if (player.state.state === PlayerStateEnum.DEAD) {
      return { success: false, hit: false, reason: 'Player is dead' };
    }

    const now = Date.now();

    // Check fire rate cooldown
    const canFire = this.combatSystem.canFire(
      WeaponType.PLAYER_RIFLE,
      player.lastFireTime,
      now
    );

    if (!canFire) {
      return { success: false, hit: false, reason: 'Fire rate cooldown' };
    }

    // Find nearest Harkonnen in line of fire
    const troopers = this.harkonnenAI.getTroopers();
    let nearestTrooper: { id: string; position: { x: number; y: number; z: number }; distance: number } | null = null;
    let minDistance = Infinity;

    for (const trooper of troopers) {
      if (trooper.state === HarkonnenState.DEAD) continue;

      const distance = Math.sqrt(
        (trooper.position.x - targetPosition.x) ** 2 +
        (trooper.position.y - targetPosition.y) ** 2 +
        (trooper.position.z - targetPosition.z) ** 2
      );

      if (distance < 5 && distance < minDistance) { // Within 5m of target point
        minDistance = distance;
        nearestTrooper = { id: trooper.id, position: trooper.position, distance };
      }
    }

    if (!nearestTrooper) {
      player.lastFireTime = now;
      return { success: true, hit: false, reason: 'No target in range' };
    }

    // Shoot at nearest trooper
    const shootResult = this.combatSystem.playerShoot(
      player.state.position,
      nearestTrooper.position,
      nearestTrooper.id,
      true // TODO: proper line of sight check
    );

    player.lastFireTime = now;

    if (shootResult.hit && shootResult.targetId) {
      // Apply damage to Harkonnen
      const damageResult = this.harkonnenAI.applyDamage(shootResult.targetId, shootResult.damage);

      // VS4: Remove trooper from outpost when killed and spawn loot
      if (damageResult.killed && damageResult.position) {
        const trooper = this.harkonnenAI.getTrooper(shootResult.targetId);
        if (trooper && trooper.outpostId) {
          this.outpostManager.removeTrooperFromOutpost(trooper.outpostId, shootResult.targetId);
        }

        // VS4: Spawn loot drop at trooper death position
        const spiceAmount = Math.floor(Math.random() * 21) + 10; // 10-30 spice
        this.room.spawnLoot(damageResult.position, spiceAmount);
      }

      console.log(`Player ${playerId} ${damageResult.killed ? 'killed' : 'hit'} Harkonnen ${shootResult.targetId} for ${shootResult.damage} damage`);

      return {
        success: true,
        hit: true,
        damage: shootResult.damage,
        targetId: shootResult.targetId,
      };
    }

    return { success: true, hit: false, reason: 'Shot missed' };
  }

  /**
   * VS3: Handle player death
   */
  private handlePlayerDeath(playerId: string): void {
    const player = this.room.getPlayer(playerId);
    if (!player) return;

    // Process death
    const deathResult = this.deathManager.processDeath(
      playerId,
      player.state.position,
      player.resources.spice,
      player.resources.stats
    );

    // Update player state
    player.state.state = PlayerStateEnum.DEAD;
    player.state.position = { ...deathResult.respawnPosition };
    player.resources.water = deathResult.respawnWater;
    player.resources.spice = deathResult.spiceRemaining;
    player.resources.stats = deathResult.newStats;
    player.health = deathResult.respawnHealth;

    // Reset to active state (respawn)
    player.state.state = PlayerStateEnum.ACTIVE;

    console.log(`Player ${playerId} died and respawned at Sietch`);
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

    console.log(`Player ${playerId} completed objective: +${ECONOMY_CONSTANTS.OBJECTIVE_REWARD_SPICE} spice, +${ECONOMY_CONSTANTS.OBJECTIVE_REWARD_WATER} water`);
  }

  /**
   * Public accessors for testing
   */
  getOutpostManager(): OutpostManager {
    return this.outpostManager;
  }

  getHarkonnenAI(): HarkonnenAI {
    return this.harkonnenAI;
  }

  getOasisManager(): OasisManager {
    return this.oasisManager;
  }

  getAlertSystem(): AlertSystem {
    return this.alertSystem;
  }
}
