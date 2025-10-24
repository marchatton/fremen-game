import type { Vector3 } from '@fremen/shared';
import { CombatSystem, WeaponType, type ShootResult } from '../CombatSystem';
import type { AlertSystem } from '../AlertSystem';

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
  targetThumperId?: string; // VS4: Thumper jamming target
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
  private combatSystem: CombatSystem;
  private shotsFired: ShootResult[] = [];
  private alertSystem?: AlertSystem;

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

  constructor() {
    this.combatSystem = new CombatSystem();
  }

  /**
   * Set alert system for coordination
   */
  setAlertSystem(alertSystem: AlertSystem): void {
    this.alertSystem = alertSystem;
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
  update(
    deltaTime: number,
    players: Array<{ id: string; position: Vector3; state: string }>,
    thumpers?: Array<{ id: string; position: Vector3; active: boolean }>
  ): void {
    const now = Date.now();

    // Clear shots from previous update
    this.shotsFired = [];

    for (const trooper of this.troopers.values()) {
      if (trooper.state === HarkonnenState.DEAD) {
        // Check for corpse despawn
        if (trooper.alertedAt && now - trooper.alertedAt > this.CORPSE_DURATION) {
          this.troopers.delete(trooper.id);
        }
        continue;
      }

      // Update AI state machine
      this.updateStateMachine(trooper, players, thumpers || [], deltaTime, now);
    }
  }

  /**
   * AI State Machine
   */
  private updateStateMachine(
    trooper: HarkonnenTrooper,
    players: Array<{ id: string; position: Vector3; state: string }>,
    thumpers: Array<{ id: string; position: Vector3; active: boolean }>,
    deltaTime: number,
    now: number
  ): void {
    switch (trooper.state) {
      case HarkonnenState.PATROL:
        this.updatePatrol(trooper, players, thumpers, deltaTime, now);
        break;
      case HarkonnenState.INVESTIGATE:
        this.updateInvestigate(trooper, players, deltaTime, now);
        break;
      case HarkonnenState.COMBAT:
        this.updateCombat(trooper, players, thumpers, deltaTime, now);
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
    thumpers: Array<{ id: string; position: Vector3; active: boolean }>,
    deltaTime: number,
    now: number
  ): void {
    // Check for alerts from other troopers
    if (this.alertSystem) {
      const alerts = this.alertSystem.getAlertsForTrooper(
        trooper.id,
        trooper.position,
        trooper.outpostId
      );

      if (alerts.length > 0) {
        // Respond to nearest alert
        const nearestAlert = alerts[0];
        trooper.state = HarkonnenState.INVESTIGATE;
        trooper.lastKnownPlayerPosition = nearestAlert.position;
        trooper.investigateUntil = now + this.INVESTIGATE_DURATION;
        console.log(`Trooper ${trooper.id} responding to alert from ${nearestAlert.alertingTrooperId}, INVESTIGATING`);
        return;
      }
    }

    // Check for player detection
    const detection = this.detectPlayers(trooper, players);
    if (detection.detected) {
      trooper.state = HarkonnenState.COMBAT;
      trooper.targetPlayerId = detection.playerId;
      trooper.lastKnownPlayerPosition = detection.position;
      trooper.alertedAt = now;

      // Broadcast alert to nearby troopers
      if (this.alertSystem && detection.playerId && detection.position) {
        this.alertSystem.broadcastAlert(
          trooper.id,
          detection.playerId,
          detection.position,
          trooper.outpostId
        );
      }

      console.log(`Trooper ${trooper.id} detected player ${detection.playerId}, entering COMBAT`);
      return;
    }

    // VS4: Check for active thumpers (lower priority than players)
    const thumperDetection = this.detectThumpers(trooper, thumpers);
    if (thumperDetection.detected && thumperDetection.thumperId) {
      trooper.state = HarkonnenState.COMBAT;
      trooper.targetThumperId = thumperDetection.thumperId;
      trooper.lastKnownPlayerPosition = thumperDetection.position;
      console.log(`Trooper ${trooper.id} detected thumper ${thumperDetection.thumperId}, engaging`);
      return;
    }

    // Move along patrol path
    if (trooper.patrolPath.length === 0) return;

    const target = trooper.patrolPath[trooper.currentWaypoint];
    const distance = this.getDistance(trooper.position, target);

    if (distance < 2) {
      // Reached waypoint, move to next
      trooper.currentWaypoint = (trooper.currentWaypoint + 1) % trooper.patrolPath.length;
    } else {
      // Move towards waypoint
      this.moveTowards(trooper, target, this.PATROL_SPEED, deltaTime);
    }
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
    // Check if investigation time expired
    if (trooper.investigateUntil && now > trooper.investigateUntil) {
      trooper.state = HarkonnenState.PATROL;
      trooper.investigateUntil = undefined;
      trooper.lastKnownPlayerPosition = undefined;
      console.log(`Trooper ${trooper.id} investigation complete, returning to PATROL`);
      return;
    }

    // Check for player detection
    const detection = this.detectPlayers(trooper, players);
    if (detection.detected) {
      trooper.state = HarkonnenState.COMBAT;
      trooper.targetPlayerId = detection.playerId;
      trooper.lastKnownPlayerPosition = detection.position;

      // Broadcast alert to nearby troopers
      if (this.alertSystem && detection.playerId && detection.position) {
        this.alertSystem.broadcastAlert(
          trooper.id,
          detection.playerId,
          detection.position,
          trooper.outpostId
        );
      }

      console.log(`Trooper ${trooper.id} re-acquired target, entering COMBAT`);
      return;
    }

    // Move to last known position
    if (trooper.lastKnownPlayerPosition) {
      const distance = this.getDistance(trooper.position, trooper.lastKnownPlayerPosition);
      if (distance < 2) {
        // Reached search area, wait for investigation timer
        if (!trooper.investigateUntil) {
          trooper.investigateUntil = now + this.INVESTIGATE_DURATION;
        }
      } else {
        this.moveTowards(trooper, trooper.lastKnownPlayerPosition, this.COMBAT_SPEED, deltaTime);
      }
    }
  }

  /**
   * COMBAT state: Engage player or thumper, maintain distance
   */
  private updateCombat(
    trooper: HarkonnenTrooper,
    players: Array<{ id: string; position: Vector3; state: string }>,
    thumpers: Array<{ id: string; position: Vector3; active: boolean }>,
    deltaTime: number,
    now: number
  ): void {
    // Check health for retreat
    if (trooper.health < trooper.maxHealth * this.RETREAT_HEALTH_THRESHOLD) {
      trooper.state = HarkonnenState.RETREAT;
      trooper.retreatTarget = this.findRetreatPosition(trooper);
      console.log(`Trooper ${trooper.id} health low, RETREATING`);
      return;
    }

    // VS4: Handle thumper target
    if (trooper.targetThumperId) {
      const thumper = thumpers.find(t => t.id === trooper.targetThumperId && t.active);
      if (!thumper) {
        // Thumper destroyed or inactive, return to patrol
        trooper.state = HarkonnenState.PATROL;
        trooper.targetThumperId = undefined;
        trooper.lastKnownPlayerPosition = undefined;
        console.log(`Trooper ${trooper.id} thumper destroyed, returning to PATROL`);
        return;
      }

      const distance = this.getDistance(trooper.position, thumper.position);

      // Move toward thumper if too far
      if (distance > this.COMBAT_MAX_DISTANCE) {
        this.moveTowards(trooper, thumper.position, this.COMBAT_SPEED, deltaTime);
      }

      // Fire at thumper if in range and fire rate allows
      if (distance <= this.COMBAT_MAX_DISTANCE && now - trooper.lastFireTime > this.FIRE_RATE) {
        this.fireAtThumper(trooper, thumper.position, thumper.id, now);
      }

      // Face thumper
      this.faceTowards(trooper, thumper.position);
      return;
    }

    // Handle player target
    const target = players.find(p => p.id === trooper.targetPlayerId);
    if (!target) {
      // Target lost, investigate
      trooper.state = HarkonnenState.INVESTIGATE;
      trooper.investigateUntil = now + this.INVESTIGATE_DURATION;
      console.log(`Trooper ${trooper.id} lost target, INVESTIGATING`);
      return;
    }

    // Check line of sight
    const hasLOS = this.hasLineOfSight(trooper.position, target.position);
    if (hasLOS) {
      trooper.lastKnownPlayerPosition = { ...target.position };
    }

    const distance = this.getDistance(trooper.position, target.position);

    // Maintain optimal combat distance
    if (distance < this.COMBAT_MIN_DISTANCE) {
      // Too close, back up
      const retreatPos = this.getRetreatVector(trooper.position, target.position, 5);
      this.moveTowards(trooper, retreatPos, this.COMBAT_SPEED, deltaTime);
    } else if (distance > this.COMBAT_MAX_DISTANCE) {
      // Too far, advance
      this.moveTowards(trooper, target.position, this.COMBAT_SPEED, deltaTime);
    }

    // Fire at player if LOS and fire rate allows
    if (hasLOS && now - trooper.lastFireTime > this.FIRE_RATE) {
      this.fireAtPlayer(trooper, target.position, target.id, now);
    }

    // Face target
    this.faceTowards(trooper, target.position);
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
    if (!trooper.retreatTarget) {
      trooper.retreatTarget = this.findRetreatPosition(trooper);
    }

    const distance = this.getDistance(trooper.position, trooper.retreatTarget);

    if (distance < 5) {
      // Reached retreat point, return to patrol
      trooper.state = HarkonnenState.PATROL;
      trooper.retreatTarget = undefined;
      trooper.targetPlayerId = undefined;
      console.log(`Trooper ${trooper.id} retreat complete, returning to PATROL`);
    } else {
      this.moveTowards(trooper, trooper.retreatTarget, this.COMBAT_SPEED, deltaTime);
    }
  }

  /**
   * Detect players within vision cone and hearing range
   */
  private detectPlayers(
    trooper: HarkonnenTrooper,
    players: Array<{ id: string; position: Vector3; state: string }>
  ): DetectionResult {
    for (const player of players) {
      if (player.state === 'DEAD') continue;

      const distance = this.getDistance(trooper.position, player.position);

      // Check hearing range (omnidirectional)
      if (distance <= this.HEARING_RANGE) {
        // Simplified: detect any player within hearing range
        // In full implementation, would check for gunshots/thumpers
      }

      // Check vision range and cone
      if (distance <= this.VISION_RANGE) {
        const angleToPlayer = this.getAngle(trooper.position, player.position);
        const angleDiff = Math.abs(this.normalizeAngle(angleToPlayer - trooper.rotation));

        if (angleDiff <= (this.VISION_ANGLE * Math.PI / 180) / 2) {
          // Within vision cone, check line of sight
          if (this.hasLineOfSight(trooper.position, player.position)) {
            return {
              detected: true,
              playerId: player.id,
              position: player.position,
              distance,
            };
          }
        }
      }
    }

    return { detected: false };
  }

  /**
   * VS4: Detect active thumpers within range
   */
  private detectThumpers(
    trooper: HarkonnenTrooper,
    thumpers: Array<{ id: string; position: Vector3; active: boolean }>
  ): { detected: boolean; thumperId?: string; position?: Vector3; distance?: number } {
    const THUMPER_DETECTION_RANGE = 100; // meters

    for (const thumper of thumpers) {
      if (!thumper.active) continue;

      const distance = this.getDistance(trooper.position, thumper.position);

      if (distance <= THUMPER_DETECTION_RANGE) {
        // Thumpers are noisy and easily detectable (no vision cone check)
        return {
          detected: true,
          thumperId: thumper.id,
          position: thumper.position,
          distance,
        };
      }
    }

    return { detected: false };
  }

  /**
   * Apply damage to trooper
   * Returns { killed: boolean, position?: Vector3 } - position is where loot should spawn
   */
  applyDamage(trooperId: string, damage: number): { killed: boolean; position?: Vector3 } {
    const trooper = this.troopers.get(trooperId);
    if (!trooper || trooper.state === HarkonnenState.DEAD) {
      return { killed: false };
    }

    trooper.health = Math.max(0, trooper.health - damage);

    if (trooper.health <= 0) {
      trooper.state = HarkonnenState.DEAD;
      trooper.alertedAt = Date.now();
      console.log(`Trooper ${trooperId} killed`);
      return { killed: true, position: { ...trooper.position } }; // Return position for loot spawn
    }

    return { killed: false };
  }

  /**
   * Fire at player using combat system
   */
  private fireAtPlayer(trooper: HarkonnenTrooper, targetPos: Vector3, targetId: string, now: number): void {
    trooper.lastFireTime = now;

    const hasLOS = this.hasLineOfSight(trooper.position, targetPos);
    const shootResult = this.combatSystem.harkonnenShoot(
      trooper.position,
      targetPos,
      targetId,
      hasLOS
    );

    // Store shot result for GameLoop to process
    if (shootResult.hit) {
      this.shotsFired.push(shootResult);
      console.log(`Trooper ${trooper.id} hit ${targetId} for ${shootResult.damage} damage`);
    } else {
      console.log(`Trooper ${trooper.id} fired at ${targetId} but missed`);
    }
  }

  /**
   * VS4: Fire at thumper (always hits, no LOS check needed for stationary target)
   */
  private fireAtThumper(trooper: HarkonnenTrooper, targetPos: Vector3, thumperId: string, now: number): void {
    trooper.lastFireTime = now;

    // Thumpers are stationary and easy targets - always hit
    const damage = 20; // Same damage as player shots
    const distance = this.getDistance(trooper.position, targetPos);

    // Store result with thumper ID for GameLoop to process
    this.shotsFired.push({
      hit: true,
      targetId: thumperId,
      targetType: 'thumper',
      damage,
      distance,
    });

    console.log(`Trooper ${trooper.id} hit thumper ${thumperId} for ${damage} damage`);
  }

  /**
   * Move towards target position
   */
  private moveTowards(trooper: HarkonnenTrooper, target: Vector3, speed: number, deltaTime: number): void {
    const dx = target.x - trooper.position.x;
    const dz = target.z - trooper.position.z;
    const distance = Math.sqrt(dx * dx + dz * dz);

    if (distance > 0) {
      const moveDistance = speed * deltaTime;
      const ratio = Math.min(moveDistance / distance, 1);
      trooper.position.x += dx * ratio;
      trooper.position.z += dz * ratio;
    }
  }

  /**
   * Face towards target
   */
  private faceTowards(trooper: HarkonnenTrooper, target: Vector3): void {
    trooper.rotation = this.getAngle(trooper.position, target);
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
   * Get retreat vector (opposite direction from threat)
   */
  private getRetreatVector(from: Vector3, threat: Vector3, distance: number): Vector3 {
    const dx = from.x - threat.x;
    const dz = from.z - threat.z;
    const length = Math.sqrt(dx * dx + dz * dz);

    if (length === 0) return { ...from, y: 0 };

    return {
      x: from.x + (dx / length) * distance,
      y: 0,
      z: from.z + (dz / length) * distance,
    };
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

  /**
   * Get shots fired this update (for GameLoop to apply damage)
   */
  getShotsFired(): ShootResult[] {
    return [...this.shotsFired];
  }
}
