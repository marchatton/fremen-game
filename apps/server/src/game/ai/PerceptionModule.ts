import type { Vector3 } from '@fremen/shared';
import type { HarkonnenTrooper } from './HarkonnenAI';

export interface DetectionResult {
  detected: boolean;
  playerId?: string;
  position?: Vector3;
  distance?: number;
}

export class PerceptionModule {
  constructor(
    private readonly visionRange = 50,
    private readonly visionAngle = 90,
    private readonly hearingRange = 100
  ) {}

  detect(
    trooper: HarkonnenTrooper,
    players: Array<{ id: string; position: Vector3; state: string }>,
    hasLineOfSight: (from: Vector3, to: Vector3) => boolean,
    getDistance: (a: Vector3, b: Vector3) => number,
    getAngle: (from: Vector3, to: Vector3) => number,
    normalizeAngle: (angle: number) => number
  ): DetectionResult {
    for (const player of players) {
      if (player.state === 'DEAD') {
        continue;
      }

      const distance = getDistance(trooper.position, player.position);

      if (distance <= this.hearingRange) {
        return {
          detected: true,
          playerId: player.id,
          position: player.position,
          distance,
        };
      }

      if (distance > this.visionRange) {
        continue;
      }

      const angleToPlayer = getAngle(trooper.position, player.position);
      const angleDiff = Math.abs(normalizeAngle(angleToPlayer - trooper.rotation));
      const halfCone = (this.visionAngle * Math.PI) / 180 / 2;

      if (angleDiff <= halfCone && hasLineOfSight(trooper.position, player.position)) {
        return {
          detected: true,
          playerId: player.id,
          position: player.position,
          distance,
        };
      }
    }

    return { detected: false };
  }
}
