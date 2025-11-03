import type { Vector3 } from '@fremen/shared';
import type { HarkonnenTrooper } from './HarkonnenAI';

export class TrooperController {
  moveTowards(trooper: HarkonnenTrooper, target: Vector3, speed: number, deltaTime: number): void {
    const dx = target.x - trooper.position.x;
    const dz = target.z - trooper.position.z;
    const distance = Math.sqrt(dx * dx + dz * dz);

    if (distance === 0) {
      return;
    }

    const moveDistance = speed * deltaTime;
    const ratio = Math.min(1, moveDistance / distance);
    trooper.position.x += dx * ratio;
    trooper.position.z += dz * ratio;
  }

  faceTowards(trooper: HarkonnenTrooper, target: Vector3): void {
    const angle = Math.atan2(target.x - trooper.position.x, target.z - trooper.position.z);
    trooper.rotation = angle;
  }

  maintainCombatSpacing(
    trooper: HarkonnenTrooper,
    target: Vector3,
    minDistance: number,
    maxDistance: number,
    speed: number,
    deltaTime: number
  ): void {
    const dx = target.x - trooper.position.x;
    const dz = target.z - trooper.position.z;
    const distance = Math.sqrt(dx * dx + dz * dz);

    if (distance < minDistance) {
      const retreat = this.getRetreatVector(trooper.position, target, minDistance - distance);
      this.moveTowards(trooper, retreat, speed, deltaTime);
    } else if (distance > maxDistance) {
      this.moveTowards(trooper, target, speed, deltaTime);
    }
  }

  getRetreatVector(origin: Vector3, threat: Vector3, buffer: number): Vector3 {
    const dx = origin.x - threat.x;
    const dz = origin.z - threat.z;
    const length = Math.sqrt(dx * dx + dz * dz) || 1;
    const normX = dx / length;
    const normZ = dz / length;
    return {
      x: origin.x + normX * buffer,
      y: origin.y,
      z: origin.z + normZ * buffer,
    };
  }
}
