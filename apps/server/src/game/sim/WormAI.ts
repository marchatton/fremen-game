import type { Vector3, WormState } from '@fremen/shared';
import { WormAIState, GAME_CONSTANTS } from '@fremen/shared';

export class WormAI {
  private worms: Map<string, WormState> = new Map();
  private patrolTargets: Map<string, Vector3> = new Map();

  constructor() {
    this.spawnWorm('worm-0', { x: 50, y: 0, z: 50 });
  }

  private spawnWorm(id: string, startPosition: Vector3) {
    const initialHeading = Math.random() * Math.PI * 2;
    const worm: WormState = {
      id,
      controlPoints: this.generateInitialControlPoints(startPosition),
      speed: 15,
      aiState: WormAIState.PATROLLING,
      health: GAME_CONSTANTS.WORM_INITIAL_HEALTH,
      heading: initialHeading,
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
      if (worm.aiState === WormAIState.RIDDEN_BY) {
        continue;
      }

      const target = worm.targetPosition || this.patrolTargets.get(wormId);
      if (!target) continue;

      const head = worm.controlPoints[0];
      const dx = target.x - head.x;
      const dz = target.z - head.z;
      const distanceToTarget = Math.sqrt(dx * dx + dz * dz);

      if (worm.aiState === WormAIState.APPROACHING_THUMPER) {
        if (distanceToTarget < GAME_CONSTANTS.WORM_APPROACH_SLOW_DISTANCE) {
          worm.speed = Math.max(GAME_CONSTANTS.WORM_MIN_SPEED, worm.speed * 0.95);
        }
        
        if (distanceToTarget < 5) {
          worm.speed = GAME_CONSTANTS.WORM_MIN_SPEED;
        }
      } else {
        if (distanceToTarget < 20) {
          this.setRandomPatrolTarget(wormId);
          worm.aiState = WormAIState.PATROLLING;
          continue;
        }
      }

      const dirX = dx / distanceToTarget;
      const dirZ = dz / distanceToTarget;

      worm.heading = Math.atan2(dirX, dirZ);

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
    if (worm && worm.aiState !== WormAIState.RIDDEN_BY) {
      worm.targetPosition = target;
      worm.aiState = WormAIState.APPROACHING_THUMPER;
      this.patrolTargets.set(wormId, target);
    }
  }

  mountWorm(wormId: string, playerId: string): boolean {
    const worm = this.worms.get(wormId);
    if (!worm || worm.aiState === WormAIState.RIDDEN_BY) {
      return false;
    }

    worm.aiState = WormAIState.RIDDEN_BY;
    worm.riderId = playerId;
    worm.speed = 15;
    console.log(`Player ${playerId} mounted worm ${wormId}`);
    return true;
  }

  dismountWorm(wormId: string): boolean {
    const worm = this.worms.get(wormId);
    if (!worm) return false;

    worm.aiState = WormAIState.PATROLLING;
    worm.riderId = undefined;
    this.setRandomPatrolTarget(wormId);
    console.log(`Worm ${wormId} dismounted, returning to patrol`);
    return true;
  }

  getWorm(wormId: string): WormState | undefined {
    return this.worms.get(wormId);
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
