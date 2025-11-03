import type { Vector3 } from '@fremen/shared';
import { HarkonnenState, type HarkonnenTrooper } from './HarkonnenAI';
import type { DetectionResult } from './PerceptionModule';
import { TrooperController } from './TrooperController';

export class TacticsModule {
  constructor(private readonly controller = new TrooperController()) {}

  patrol(
    trooper: HarkonnenTrooper,
    detection: DetectionResult,
    deltaTime: number,
    now: number
  ): void {
    if (detection.detected && detection.playerId && detection.position) {
      trooper.state = HarkonnenState.COMBAT;
      trooper.targetPlayerId = detection.playerId;
      trooper.lastKnownPlayerPosition = detection.position;
      trooper.alertedAt = now;
      return;
    }

    if (trooper.patrolPath.length === 0) {
      return;
    }

    const target = trooper.patrolPath[trooper.currentWaypoint];
    const dx = target.x - trooper.position.x;
    const dz = target.z - trooper.position.z;
    const distance = Math.sqrt(dx * dx + dz * dz);

    if (distance < 2) {
      trooper.currentWaypoint = (trooper.currentWaypoint + 1) % trooper.patrolPath.length;
    } else {
      this.controller.moveTowards(trooper, target, 3, deltaTime);
    }
  }

  investigate(
    trooper: HarkonnenTrooper,
    detection: DetectionResult,
    deltaTime: number,
    now: number
  ): void {
    if (trooper.investigateUntil && now > trooper.investigateUntil) {
      trooper.state = HarkonnenState.PATROL;
      trooper.investigateUntil = undefined;
      trooper.lastKnownPlayerPosition = undefined;
      return;
    }

    if (detection.detected && detection.playerId && detection.position) {
      trooper.state = HarkonnenState.COMBAT;
      trooper.targetPlayerId = detection.playerId;
      trooper.lastKnownPlayerPosition = detection.position;
      return;
    }

    if (trooper.lastKnownPlayerPosition) {
      this.controller.moveTowards(trooper, trooper.lastKnownPlayerPosition, 4, deltaTime);
    }
  }

  combat(
    trooper: HarkonnenTrooper,
    players: Array<{ id: string; position: Vector3; state: string }>,
    deltaTime: number,
    now: number,
    hasLineOfSight: (from: Vector3, to: Vector3) => boolean,
    getDistance: (a: Vector3, b: Vector3) => number,
    fire: (trooper: HarkonnenTrooper, targetPos: Vector3, now: number) => void
  ): void {
    if (trooper.health < trooper.maxHealth * 0.3) {
      trooper.state = HarkonnenState.RETREAT;
      return;
    }

    const target = players.find(p => p.id === trooper.targetPlayerId);
    if (!target) {
      trooper.state = HarkonnenState.INVESTIGATE;
      trooper.investigateUntil = now + 10000;
      return;
    }

    const hasLOS = hasLineOfSight(trooper.position, target.position);
    if (hasLOS) {
      trooper.lastKnownPlayerPosition = { ...target.position };
    }

    this.controller.maintainCombatSpacing(
      trooper,
      target.position,
      20,
      40,
      5,
      deltaTime
    );

    if (hasLOS && now - trooper.lastFireTime > 1000) {
      fire(trooper, target.position, now);
    }

    this.controller.faceTowards(trooper, target.position);
  }

  retreat(
    trooper: HarkonnenTrooper,
    deltaTime: number,
    getRetreatPosition: () => Vector3
  ): void {
    if (!trooper.retreatTarget) {
      trooper.retreatTarget = getRetreatPosition();
    }

    const target = trooper.retreatTarget;
    const dx = target.x - trooper.position.x;
    const dz = target.z - trooper.position.z;
    const distance = Math.sqrt(dx * dx + dz * dz);

    if (distance < 5) {
      trooper.state = HarkonnenState.PATROL;
      trooper.retreatTarget = undefined;
      trooper.targetPlayerId = undefined;
    } else {
      this.controller.moveTowards(trooper, target, 5, deltaTime);
    }
  }
}
