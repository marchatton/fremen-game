import type { Vector3 } from '@fremen/shared';
import { SeededRandom } from './utils/SeededRandom';

export interface Outpost {
  id: string;
  position: Vector3;
  trooperIds: string[];
  patrolRadius: number;
  active: boolean;
}

export interface PatrolPath {
  waypoints: Vector3[];
}

/**
 * VS4: Outpost System
 *
 * Manages Harkonnen outposts across the map:
 * - Procedural outpost placement
 * - Trooper spawning at outposts
 * - Patrol path generation around outposts
 */
export class OutpostManager {
  private outposts: Map<string, Outpost> = new Map();
  private rng: SeededRandom;

  // Configuration
  private readonly OUTPOST_COUNT = 6;
  private readonly MIN_DISTANCE_BETWEEN_OUTPOSTS = 200; // meters
  private readonly MIN_DISTANCE_FROM_SIETCH = 300; // meters
  private readonly MIN_DISTANCE_FROM_OASIS = 150; // meters
  private readonly PATROL_RADIUS = 50; // meters around outpost
  private readonly TROOPERS_PER_OUTPOST_MIN = 2;
  private readonly TROOPERS_PER_OUTPOST_MAX = 4;
  private readonly PATROL_WAYPOINTS = 8; // octagon patrol

  private readonly WORLD_SIZE = 1000;
  private readonly SIETCH_POSITION = { x: 0, y: 0, z: 0 };

  constructor(seed: number = 12345) {
    this.rng = new SeededRandom(seed);
  }

  /**
   * Generate outposts across the map
   */
  generateOutposts(oasisPositions: Vector3[] = []): void {
    this.outposts.clear();

    const positions: Vector3[] = [];

    for (let i = 0; i < this.OUTPOST_COUNT; i++) {
      let attempts = 0;
      let validPosition: Vector3 | null = null;

      while (attempts < 100) {
        const candidate: Vector3 = {
          x: (this.rng.next() - 0.5) * this.WORLD_SIZE,
          y: 0,
          z: (this.rng.next() - 0.5) * this.WORLD_SIZE,
        };

        // Check distance from Sietch
        if (this.getDistance(candidate, this.SIETCH_POSITION) < this.MIN_DISTANCE_FROM_SIETCH) {
          attempts++;
          continue;
        }

        // Check distance from oases
        let tooCloseToOasis = false;
        for (const oasis of oasisPositions) {
          if (this.getDistance(candidate, oasis) < this.MIN_DISTANCE_FROM_OASIS) {
            tooCloseToOasis = true;
            break;
          }
        }
        if (tooCloseToOasis) {
          attempts++;
          continue;
        }

        // Check distance from other outposts
        let tooCloseToOutpost = false;
        for (const existing of positions) {
          if (this.getDistance(candidate, existing) < this.MIN_DISTANCE_BETWEEN_OUTPOSTS) {
            tooCloseToOutpost = true;
            break;
          }
        }
        if (tooCloseToOutpost) {
          attempts++;
          continue;
        }

        validPosition = candidate;
        break;
      }

      if (validPosition) {
        const outpostId = `outpost-${i}`;
        positions.push(validPosition);

        this.outposts.set(outpostId, {
          id: outpostId,
          position: validPosition,
          trooperIds: [],
          patrolRadius: this.PATROL_RADIUS,
          active: true,
        });
      }
    }

    console.log(`Generated ${this.outposts.size} Harkonnen outposts`);
  }

  /**
   * Get number of troopers to spawn at outpost
   */
  getTrooperCountForOutpost(outpostId: string): number {
    const min = this.TROOPERS_PER_OUTPOST_MIN;
    const max = this.TROOPERS_PER_OUTPOST_MAX;
    return Math.floor(this.rng.next() * (max - min + 1)) + min;
  }

  /**
   * Generate patrol path around outpost (octagon)
   */
  generatePatrolPath(outpostId: string): PatrolPath {
    const outpost = this.outposts.get(outpostId);
    if (!outpost) {
      return { waypoints: [] };
    }

    const waypoints: Vector3[] = [];
    const angleStep = (Math.PI * 2) / this.PATROL_WAYPOINTS;

    for (let i = 0; i < this.PATROL_WAYPOINTS; i++) {
      const angle = angleStep * i;
      const x = outpost.position.x + Math.cos(angle) * this.PATROL_RADIUS;
      const z = outpost.position.z + Math.sin(angle) * this.PATROL_RADIUS;

      waypoints.push({ x, y: 0, z });
    }

    return { waypoints };
  }

  /**
   * Register trooper to outpost
   */
  addTrooperToOutpost(outpostId: string, trooperId: string): boolean {
    const outpost = this.outposts.get(outpostId);
    if (!outpost) return false;

    if (!outpost.trooperIds.includes(trooperId)) {
      outpost.trooperIds.push(trooperId);
    }

    return true;
  }

  /**
   * Remove trooper from outpost (when killed)
   */
  removeTrooperFromOutpost(outpostId: string, trooperId: string): void {
    const outpost = this.outposts.get(outpostId);
    if (!outpost) return;

    const index = outpost.trooperIds.indexOf(trooperId);
    if (index !== -1) {
      outpost.trooperIds.splice(index, 1);
    }

    // Deactivate outpost if all troopers dead
    if (outpost.trooperIds.length === 0) {
      outpost.active = false;
      console.log(`Outpost ${outpostId} cleared - all troopers eliminated`);
    }
  }

  /**
   * Get all outposts
   */
  getOutposts(): Outpost[] {
    return Array.from(this.outposts.values());
  }

  /**
   * Get active outposts only
   */
  getActiveOutposts(): Outpost[] {
    return Array.from(this.outposts.values()).filter(o => o.active);
  }

  /**
   * Get outpost by ID
   */
  getOutpost(outpostId: string): Outpost | undefined {
    return this.outposts.get(outpostId);
  }

  /**
   * Get nearest outpost to position
   */
  getNearestOutpost(position: Vector3): Outpost | undefined {
    let nearest: Outpost | undefined;
    let minDistance = Infinity;

    for (const outpost of this.outposts.values()) {
      const distance = this.getDistance(position, outpost.position);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = outpost;
      }
    }

    return nearest;
  }

  /**
   * Check if position is near any outpost
   */
  isNearOutpost(position: Vector3, radius: number = 100): boolean {
    for (const outpost of this.outposts.values()) {
      if (this.getDistance(position, outpost.position) < radius) {
        return true;
      }
    }
    return false;
  }

  /**
   * Reactivate outpost (for respawning)
   */
  reactivateOutpost(outpostId: string): boolean {
    const outpost = this.outposts.get(outpostId);
    if (!outpost) return false;

    outpost.active = true;
    outpost.trooperIds = [];
    console.log(`Outpost ${outpostId} reactivated`);

    return true;
  }

  /**
   * Get outpost statistics
   */
  getOutpostStats(): {
    total: number;
    active: number;
    cleared: number;
    totalTroopers: number;
  } {
    const total = this.outposts.size;
    const active = this.getActiveOutposts().length;
    const cleared = total - active;
    const totalTroopers = Array.from(this.outposts.values()).reduce(
      (sum, outpost) => sum + outpost.trooperIds.length,
      0
    );

    return { total, active, cleared, totalTroopers };
  }

  /**
   * Calculate 2D distance between positions
   */
  private getDistance(pos1: Vector3, pos2: Vector3): number {
    const dx = pos1.x - pos2.x;
    const dz = pos1.z - pos2.z;
    return Math.sqrt(dx * dx + dz * dz);
  }
}
