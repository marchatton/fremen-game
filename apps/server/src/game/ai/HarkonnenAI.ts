import type { Vector3 } from '@fremen/shared';
import { COMBAT_CONSTANTS } from '@fremen/shared';
import { PerceptionModule, type DetectionResult } from './PerceptionModule';
import { TacticsModule } from './TacticsModule';
import { TrooperController } from './TrooperController';

export enum HarkonnenState {
  PATROL = 'PATROL',
  INVESTIGATE = 'INVESTIGATE',
  COMBAT = 'COMBAT',
  RETREAT = 'RETREAT',
  DEAD = 'DEAD',
}

export interface HarkonnenTrooper {
  id: string;
  position: Vector3;
  rotation: number;
  state: HarkonnenState;
  health: number;
  maxHealth: number;
  currentWaypoint: number;
  patrolPath: Vector3[];
  targetPlayerId?: string;
  lastKnownPlayerPosition?: Vector3;
  investigateUntil?: number;
  retreatTarget?: Vector3;
  alertedAt?: number;
  lastFireTime: number;
  outpostId?: string;
}

interface DetectionResult {
  detected: boolean;
  playerId?: string;
  position?: Vector3;
  distance?: number;
}

/**
 * VS4: Harkonnen AI System
 *
 * Manages AI state machine for Harkonnen troopers:
 * - PATROL: Follow waypoint path, scan for players
 * - INVESTIGATE: Move to last known position, search
 * - COMBAT: Engage player, maintain distance, use cover
 * - RETREAT: Low health, move to reinforcement point
 * - DEAD: Corpse state, despawn after timeout
 */
export class HarkonnenAI {
  private troopers: Map<string, HarkonnenTrooper> = new Map();
  private combatHandler?: (attackerId: string, targetId: string, damage: number) => void;
  private readonly controller: TrooperController;
  private readonly perception: PerceptionModule;
  private readonly tactics: TacticsModule;

  // AI Configuration
  private readonly VISION_RANGE = 50; // meters
  private readonly VISION_ANGLE = 90; // degrees (45° each side)
  private readonly HEARING_RANGE = 100; // meters
  private readonly INVESTIGATE_DURATION = 10000; // 10 seconds
  private readonly RETREAT_HEALTH_THRESHOLD = 0.3; // 30%
  private readonly FIRE_RATE = 1000; // 1 shot per second
  private readonly COMBAT_MIN_DISTANCE = 20; // meters
  private readonly COMBAT_MAX_DISTANCE = 40; // meters
  private readonly PATROL_SPEED = 3; // m/s
  private readonly COMBAT_SPEED = 5; // m/s
  private readonly CORPSE_DURATION = 30000; // 30 seconds

  constructor(
    controller?: TrooperController,
    perception?: PerceptionModule,
    tactics?: TacticsModule
  ) {
    this.controller = controller ?? new TrooperController();
    this.perception =
      perception ?? new PerceptionModule(this.VISION_RANGE, this.VISION_ANGLE, this.HEARING_RANGE);
    this.tactics = tactics ?? new TacticsModule(this.controller);
  }

  /**
   * Spawn a new Harkonnen trooper
   */
  spawnTrooper(
    id: string,
    position: Vector3,
    patrolPath: Vector3[],
    outpostId?: string
  ): HarkonnenTrooper {
    const trooper: HarkonnenTrooper = {
      id,
      position: { ...position },
      rotation: 0,
      state: HarkonnenState.PATROL,
      health: 100,
      maxHealth: 100,
      currentWaypoint: 0,
      patrolPath: patrolPath.map(p => ({ ...p })),
      lastFireTime: 0,
      outpostId,
    };

    this.troopers.set(id, trooper);
    console.log(`Spawned Harkonnen trooper ${id} at outpost ${outpostId || 'none'}`);

    return trooper;
  }

  /**
   * Update all troopers
   */
  update(deltaTime: number, players: Array<{ id: string; position: Vector3; state: string }>): void {
    const now = Date.now();

    for (const trooper of this.troopers.values()) {
      if (trooper.state === HarkonnenState.DEAD) {
        // Check for corpse despawn
        if (trooper.alertedAt && now - trooper.alertedAt > this.CORPSE_DURATION) {
          this.troopers.delete(trooper.id);
        }
        continue;
      }

      // Update AI state machine
      this.updateStateMachine(trooper, players, deltaTime, now);
    }
  }

  setCombatHandler(handler: (attackerId: string, targetId: string, damage: number) => void): void {
    this.combatHandler = handler;
  }

  /**
   * AI State Machine
   */
  private updateStateMachine(
    trooper: HarkonnenTrooper,
    players: Array<{ id: string; position: Vector3; state: string }>,
    deltaTime: number,
    now: number
  ): void {
    switch (trooper.state) {
      case HarkonnenState.PATROL:
        this.updatePatrol(trooper, players, deltaTime, now);
        break;
      case HarkonnenState.INVESTIGATE:
        this.updateInvestigate(trooper, players, deltaTime, now);
        break;
      case HarkonnenState.COMBAT:
        this.updateCombat(trooper, players, deltaTime, now);
        break;
      case HarkonnenState.RETREAT:
        this.updateRetreat(trooper, players, deltaTime, now);
        break;
    }
  }

  /**
   * PATROL state: Follow waypoint path, scan for players
   */
  private updatePatrol(
    trooper: HarkonnenTrooper,
    players: Array<{ id: string; position: Vector3; state: string }>,
    deltaTime: number,
    now: number
  ): void {
    const detection = this.detectPlayers(trooper, players);
    this.tactics.patrol(trooper, detection, deltaTime, now);
  }

  /**
   * INVESTIGATE state: Move to last known position, search
   */
  private updateInvestigate(
    trooper: HarkonnenTrooper,
    players: Array<{ id: string; position: Vector3; state: string }>,
    deltaTime: number,
    now: number
  ): void {
    const detection = this.detectPlayers(trooper, players);
    this.tactics.investigate(trooper, detection, deltaTime, now);
  }

  /**
   * COMBAT state: Engage player, maintain distance
   */
  private updateCombat(
    trooper: HarkonnenTrooper,
    players: Array<{ id: string; position: Vector3; state: string }>,
    deltaTime: number,
    now: number
  ): void {
    this.tactics.combat(
      trooper,
      players,
      deltaTime,
      now,
      (from, to) => this.hasLineOfSight(from, to),
      (a, b) => this.getDistance(a, b),
      (actor, targetPos, timestamp) => this.fireAtPlayer(actor, targetPos, timestamp)
    );
  }

  /**
   * RETREAT state: Move to reinforcement point
   */
  private updateRetreat(
    trooper: HarkonnenTrooper,
    players: Array<{ id: string; position: Vector3; state: string }>,
    deltaTime: number,
    now: number
  ): void {
    this.tactics.retreat(trooper, deltaTime, () => this.findRetreatPosition(trooper));
  }

  /**
   * Detect players within vision cone and hearing range
   */
  private detectPlayers(
    trooper: HarkonnenTrooper,
    players: Array<{ id: string; position: Vector3; state: string }>
  ): DetectionResult {
    return this.perception.detect(
      trooper,
      players,
      (from, to) => this.hasLineOfSight(from, to),
      (a, b) => this.getDistance(a, b),
      (from, to) => this.getAngle(from, to),
      angle => this.normalizeAngle(angle)
    );
  }

  /**
   * Apply damage to trooper
   */
  applyDamage(trooperId: string, damage: number): boolean {
    const trooper = this.troopers.get(trooperId);
    if (!trooper || trooper.state === HarkonnenState.DEAD) return false;

    trooper.health = Math.max(0, trooper.health - damage);

    if (trooper.health <= 0) {
      trooper.state = HarkonnenState.DEAD;
      trooper.alertedAt = Date.now();
      console.log(`Trooper ${trooperId} killed`);
      return true; // Trooper died
    }

    return false;
  }

  /**
   * Fire at player (stub for combat system integration)
   */
  private fireAtPlayer(trooper: HarkonnenTrooper, targetPos: Vector3, now: number): void {
    trooper.lastFireTime = now;
    if (trooper.targetPlayerId) {
      this.combatHandler?.(trooper.id, trooper.targetPlayerId, COMBAT_CONSTANTS.AI_BASE_DAMAGE);
    }
    console.log(`Trooper ${trooper.id} fired at target`);
  }

  /**
   * Get angle from position to target
   */
  private getAngle(from: Vector3, to: Vector3): number {
    return Math.atan2(to.z - from.z, to.x - from.x);
  }

  /**
   * Normalize angle to -π to π range
   */
  private normalizeAngle(angle: number): number {
    while (angle > Math.PI) angle -= 2 * Math.PI;
    while (angle < -Math.PI) angle += 2 * Math.PI;
    return angle;
  }

  /**
   * Calculate distance between two positions
   */
  private getDistance(pos1: Vector3, pos2: Vector3): number {
    const dx = pos1.x - pos2.x;
    const dz = pos1.z - pos2.z;
    return Math.sqrt(dx * dx + dz * dz);
  }

  /**
   * Check line of sight (simplified - no terrain collision)
   */
  private hasLineOfSight(from: Vector3, to: Vector3): boolean {
    // TODO: Implement proper raycast with terrain collision
    return true;
  }

  /**
   * Find retreat position (back to spawn/outpost)
   */
  private findRetreatPosition(trooper: HarkonnenTrooper): Vector3 {
    // Default: retreat to first waypoint (spawn point)
    if (trooper.patrolPath.length > 0) {
      return { ...trooper.patrolPath[0] };
    }
    return { ...trooper.position };
  }

  /**
   * Get all troopers
   */
  getTroopers(): HarkonnenTrooper[] {
    return Array.from(this.troopers.values());
  }

  /**
   * Get trooper by ID
   */
  getTrooper(id: string): HarkonnenTrooper | undefined {
    return this.troopers.get(id);
  }

  /**
   * Remove trooper
   */
  removeTrooper(id: string): void {
    this.troopers.delete(id);
  }

  /**
   * Get troopers in combat with specific player
   */
  getTroopersTargeting(playerId: string): HarkonnenTrooper[] {
    return Array.from(this.troopers.values()).filter(
      t => t.targetPlayerId === playerId && t.state === HarkonnenState.COMBAT
    );
  }
}
