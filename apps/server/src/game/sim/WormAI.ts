import type { Vector3, WormState } from '@fremen/shared';

export class WormAI {
  private worms: Map<string, WormState> = new Map();
  private patrolTargets: Map<string, Vector3> = new Map();

  constructor() {
    this.spawnWorm('worm-0', { x: 50, y: 0, z: 50 });
  }

  private spawnWorm(id: string, startPosition: Vector3) {
    const worm: WormState = {
      id,
      controlPoints: this.generateInitialControlPoints(startPosition),
      speed: 15,
    };
    this.worms.set(id, worm);
    this.setRandomPatrolTarget(id);
  }

  private generateInitialControlPoints(start: Vector3): Vector3[] {
    const points: Vector3[] = [];
    const segmentCount = 10;
    
    for (let i = 0; i < segmentCount; i++) {
      points.push({
        x: start.x - i * 3,
        y: start.y,
        z: start.z,
      });
    }
    
    return points;
  }

  private setRandomPatrolTarget(wormId: string) {
    const angle = Math.random() * Math.PI * 2;
    const distance = 100 + Math.random() * 200;
    
    const worm = this.worms.get(wormId);
    if (!worm) return;

    const head = worm.controlPoints[0];
    const target: Vector3 = {
      x: head.x + Math.cos(angle) * distance,
      y: 0,
      z: head.z + Math.sin(angle) * distance,
    };

    this.patrolTargets.set(wormId, target);
    worm.targetPosition = target;
  }

  update(deltaTime: number) {
    for (const [wormId, worm] of this.worms) {
      const target = this.patrolTargets.get(wormId);
      if (!target) continue;

      const head = worm.controlPoints[0];
      const dx = target.x - head.x;
      const dz = target.z - head.z;
      const distanceToTarget = Math.sqrt(dx * dx + dz * dz);

      if (distanceToTarget < 20) {
        this.setRandomPatrolTarget(wormId);
        continue;
      }

      const dirX = dx / distanceToTarget;
      const dirZ = dz / distanceToTarget;

      const newHead: Vector3 = {
        x: head.x + dirX * worm.speed * deltaTime,
        y: 0,
        z: head.z + dirZ * worm.speed * deltaTime,
      };

      worm.controlPoints.unshift(newHead);
      
      if (worm.controlPoints.length > 12) {
        worm.controlPoints.pop();
      }
    }
  }

  getWorms(): WormState[] {
    return Array.from(this.worms.values());
  }

  setWormTarget(wormId: string, target: Vector3) {
    const worm = this.worms.get(wormId);
    if (worm) {
      worm.targetPosition = target;
      this.patrolTargets.set(wormId, target);
    }
  }

  findNearestWorm(position: Vector3): string | null {
    let nearestId: string | null = null;
    let nearestDist = Infinity;

    for (const [id, worm] of this.worms) {
      const head = worm.controlPoints[0];
      const dx = head.x - position.x;
      const dz = head.z - position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist < nearestDist) {
        nearestDist = dist;
        nearestId = id;
      }
    }

    return nearestId;
  }
}
