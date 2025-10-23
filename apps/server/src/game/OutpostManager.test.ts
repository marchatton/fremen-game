import { describe, it, expect, beforeEach } from 'vitest';
import { OutpostManager } from './OutpostManager';
import type { Vector3 } from '@fremen/shared';

describe('VS4: Outpost System', () => {
  let manager: OutpostManager;

  beforeEach(() => {
    manager = new OutpostManager(12345);
  });

  describe('Outpost Generation', () => {
    it('should generate 6 outposts by default', () => {
      manager.generateOutposts();

      const outposts = manager.getOutposts();
      expect(outposts.length).toBe(6);
    });

    it('should place outposts with unique IDs', () => {
      manager.generateOutposts();

      const outposts = manager.getOutposts();
      const ids = outposts.map(o => o.id);
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should initialize outposts as active', () => {
      manager.generateOutposts();

      const outposts = manager.getOutposts();
      expect(outposts.every(o => o.active)).toBe(true);
    });

    it('should initialize outposts with empty trooper lists', () => {
      manager.generateOutposts();

      const outposts = manager.getOutposts();
      expect(outposts.every(o => o.trooperIds.length === 0)).toBe(true);
    });

    it('should set patrol radius for each outpost', () => {
      manager.generateOutposts();

      const outposts = manager.getOutposts();
      expect(outposts.every(o => o.patrolRadius === 50)).toBe(true);
    });

    it('should maintain minimum distance between outposts', () => {
      manager.generateOutposts();

      const outposts = manager.getOutposts();
      const minDistance = 200;

      for (let i = 0; i < outposts.length; i++) {
        for (let j = i + 1; j < outposts.length; j++) {
          const distance = getDistance(outposts[i].position, outposts[j].position);
          expect(distance).toBeGreaterThanOrEqual(minDistance);
        }
      }
    });

    it('should maintain minimum distance from Sietch', () => {
      manager.generateOutposts();

      const outposts = manager.getOutposts();
      const sietchPos = { x: 0, y: 0, z: 0 };
      const minDistance = 300;

      for (const outpost of outposts) {
        const distance = getDistance(outpost.position, sietchPos);
        expect(distance).toBeGreaterThanOrEqual(minDistance);
      }
    });

    it('should maintain minimum distance from oases', () => {
      const oases: Vector3[] = [
        { x: 100, y: 0, z: 100 },
        { x: -150, y: 0, z: 200 },
      ];

      manager.generateOutposts(oases);

      const outposts = manager.getOutposts();
      const minDistance = 150;

      for (const outpost of outposts) {
        for (const oasis of oases) {
          const distance = getDistance(outpost.position, oasis);
          expect(distance).toBeGreaterThanOrEqual(minDistance);
        }
      }
    });

    it('should use seeded random for deterministic placement', () => {
      const manager1 = new OutpostManager(99999);
      const manager2 = new OutpostManager(99999);

      manager1.generateOutposts();
      manager2.generateOutposts();

      const outposts1 = manager1.getOutposts();
      const outposts2 = manager2.getOutposts();

      expect(outposts1.length).toBe(outposts2.length);
      for (let i = 0; i < outposts1.length; i++) {
        expect(outposts1[i].position.x).toBeCloseTo(outposts2[i].position.x, 5);
        expect(outposts1[i].position.z).toBeCloseTo(outposts2[i].position.z, 5);
      }
    });
  });

  describe('Trooper Count', () => {
    it('should return trooper count between 2 and 4', () => {
      manager.generateOutposts();

      const outposts = manager.getOutposts();
      for (const outpost of outposts) {
        const count = manager.getTrooperCountForOutpost(outpost.id);
        expect(count).toBeGreaterThanOrEqual(2);
        expect(count).toBeLessThanOrEqual(4);
      }
    });

    it('should use seeded random for deterministic counts', () => {
      const manager1 = new OutpostManager(55555);
      const manager2 = new OutpostManager(55555);

      manager1.generateOutposts();
      manager2.generateOutposts();

      const outposts1 = manager1.getOutposts();
      const outposts2 = manager2.getOutposts();

      for (let i = 0; i < outposts1.length; i++) {
        const count1 = manager1.getTrooperCountForOutpost(outposts1[i].id);
        const count2 = manager2.getTrooperCountForOutpost(outposts2[i].id);
        expect(count1).toBe(count2);
      }
    });
  });

  describe('Patrol Path Generation', () => {
    it('should generate 8-waypoint patrol path', () => {
      manager.generateOutposts();

      const outpost = manager.getOutposts()[0];
      const path = manager.generatePatrolPath(outpost.id);

      expect(path.waypoints.length).toBe(8);
    });

    it('should place waypoints in octagon around outpost', () => {
      manager.generateOutposts();

      const outpost = manager.getOutposts()[0];
      const path = manager.generatePatrolPath(outpost.id);

      const radius = 50;

      for (const waypoint of path.waypoints) {
        const distance = getDistance(waypoint, outpost.position);
        expect(distance).toBeCloseTo(radius, 1);
      }
    });

    it('should distribute waypoints evenly around circle', () => {
      manager.generateOutposts();

      const outpost = manager.getOutposts()[0];
      const path = manager.generatePatrolPath(outpost.id);

      const expectedAngleStep = (Math.PI * 2) / 8;

      for (let i = 0; i < path.waypoints.length; i++) {
        const wp = path.waypoints[i];
        const dx = wp.x - outpost.position.x;
        const dz = wp.z - outpost.position.z;
        const angle = Math.atan2(dz, dx);
        const expectedAngle = expectedAngleStep * i;

        // Normalize angles to 0-2π range
        const normalizedAngle = angle < 0 ? angle + Math.PI * 2 : angle;
        const normalizedExpected = expectedAngle;

        expect(normalizedAngle).toBeCloseTo(normalizedExpected, 1);
      }
    });

    it('should set waypoint Y to 0', () => {
      manager.generateOutposts();

      const outpost = manager.getOutposts()[0];
      const path = manager.generatePatrolPath(outpost.id);

      expect(path.waypoints.every(wp => wp.y === 0)).toBe(true);
    });

    it('should return empty path for non-existent outpost', () => {
      const path = manager.generatePatrolPath('nonexistent');

      expect(path.waypoints.length).toBe(0);
    });
  });

  describe('Trooper Management', () => {
    beforeEach(() => {
      manager.generateOutposts();
    });

    it('should add trooper to outpost', () => {
      const outpost = manager.getOutposts()[0];

      const result = manager.addTrooperToOutpost(outpost.id, 'trooper-1');

      expect(result).toBe(true);
      expect(outpost.trooperIds).toContain('trooper-1');
    });

    it('should not add duplicate trooper', () => {
      const outpost = manager.getOutposts()[0];

      manager.addTrooperToOutpost(outpost.id, 'trooper-1');
      manager.addTrooperToOutpost(outpost.id, 'trooper-1');

      expect(outpost.trooperIds.length).toBe(1);
    });

    it('should add multiple troopers to outpost', () => {
      const outpost = manager.getOutposts()[0];

      manager.addTrooperToOutpost(outpost.id, 'trooper-1');
      manager.addTrooperToOutpost(outpost.id, 'trooper-2');
      manager.addTrooperToOutpost(outpost.id, 'trooper-3');

      expect(outpost.trooperIds.length).toBe(3);
    });

    it('should return false when adding to non-existent outpost', () => {
      const result = manager.addTrooperToOutpost('nonexistent', 'trooper-1');

      expect(result).toBe(false);
    });

    it('should remove trooper from outpost', () => {
      const outpost = manager.getOutposts()[0];

      manager.addTrooperToOutpost(outpost.id, 'trooper-1');
      manager.removeTrooperFromOutpost(outpost.id, 'trooper-1');

      expect(outpost.trooperIds).not.toContain('trooper-1');
    });

    it('should deactivate outpost when all troopers removed', () => {
      const outpost = manager.getOutposts()[0];

      manager.addTrooperToOutpost(outpost.id, 'trooper-1');
      manager.addTrooperToOutpost(outpost.id, 'trooper-2');

      manager.removeTrooperFromOutpost(outpost.id, 'trooper-1');
      expect(outpost.active).toBe(true);

      manager.removeTrooperFromOutpost(outpost.id, 'trooper-2');
      expect(outpost.active).toBe(false);
    });

    it('should handle removing non-existent trooper', () => {
      const outpost = manager.getOutposts()[0];

      manager.removeTrooperFromOutpost(outpost.id, 'nonexistent');

      expect(outpost.trooperIds.length).toBe(0);
    });

    it('should handle removing from non-existent outpost', () => {
      expect(() => manager.removeTrooperFromOutpost('nonexistent', 'trooper-1')).not.toThrow();
    });
  });

  describe('Outpost Queries', () => {
    beforeEach(() => {
      manager.generateOutposts();
    });

    it('should get outpost by ID', () => {
      const outposts = manager.getOutposts();
      const firstId = outposts[0].id;

      const outpost = manager.getOutpost(firstId);

      expect(outpost).toBeDefined();
      expect(outpost!.id).toBe(firstId);
    });

    it('should return undefined for non-existent outpost', () => {
      const outpost = manager.getOutpost('nonexistent');

      expect(outpost).toBeUndefined();
    });

    it('should get all active outposts', () => {
      const active = manager.getActiveOutposts();

      expect(active.length).toBe(6);
      expect(active.every(o => o.active)).toBe(true);
    });

    it('should exclude inactive outposts from active list', () => {
      const outpost = manager.getOutposts()[0];
      outpost.active = false;

      const active = manager.getActiveOutposts();

      expect(active.length).toBe(5);
      expect(active.every(o => o.id !== outpost.id)).toBe(true);
    });

    it('should find nearest outpost to position', () => {
      const targetPos: Vector3 = { x: 0, y: 0, z: 0 };

      const nearest = manager.getNearestOutpost(targetPos);

      expect(nearest).toBeDefined();

      // Verify it's actually the nearest
      const outposts = manager.getOutposts();
      const distances = outposts.map(o => getDistance(o.position, targetPos));
      const minDistance = Math.min(...distances);
      const nearestDistance = getDistance(nearest!.position, targetPos);

      expect(nearestDistance).toBe(minDistance);
    });

    it('should check if position is near outpost', () => {
      const outpost = manager.getOutposts()[0];

      // Position within 100m
      const nearPos: Vector3 = {
        x: outpost.position.x + 50,
        y: 0,
        z: outpost.position.z,
      };

      expect(manager.isNearOutpost(nearPos, 100)).toBe(true);
    });

    it('should return false when position not near any outpost', () => {
      const farPos: Vector3 = { x: 10000, y: 0, z: 10000 };

      expect(manager.isNearOutpost(farPos, 100)).toBe(false);
    });
  });

  describe('Outpost Lifecycle', () => {
    beforeEach(() => {
      manager.generateOutposts();
    });

    it('should reactivate cleared outpost', () => {
      const outpost = manager.getOutposts()[0];

      manager.addTrooperToOutpost(outpost.id, 'trooper-1');
      manager.removeTrooperFromOutpost(outpost.id, 'trooper-1');

      expect(outpost.active).toBe(false);

      const result = manager.reactivateOutpost(outpost.id);

      expect(result).toBe(true);
      expect(outpost.active).toBe(true);
      expect(outpost.trooperIds.length).toBe(0);
    });

    it('should return false when reactivating non-existent outpost', () => {
      const result = manager.reactivateOutpost('nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('Statistics', () => {
    beforeEach(() => {
      manager.generateOutposts();
    });

    it('should return correct outpost statistics', () => {
      const stats = manager.getOutpostStats();

      expect(stats.total).toBe(6);
      expect(stats.active).toBe(6);
      expect(stats.cleared).toBe(0);
      expect(stats.totalTroopers).toBe(0);
    });

    it('should track trooper count across all outposts', () => {
      const outposts = manager.getOutposts();

      manager.addTrooperToOutpost(outposts[0].id, 'trooper-1');
      manager.addTrooperToOutpost(outposts[0].id, 'trooper-2');
      manager.addTrooperToOutpost(outposts[1].id, 'trooper-3');

      const stats = manager.getOutpostStats();

      expect(stats.totalTroopers).toBe(3);
    });

    it('should track cleared outposts', () => {
      const outpost = manager.getOutposts()[0];

      manager.addTrooperToOutpost(outpost.id, 'trooper-1');
      manager.removeTrooperFromOutpost(outpost.id, 'trooper-1');

      const stats = manager.getOutpostStats();

      expect(stats.active).toBe(5);
      expect(stats.cleared).toBe(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle generation with no oases', () => {
      manager.generateOutposts([]);

      const outposts = manager.getOutposts();
      expect(outposts.length).toBe(6);
    });

    it('should handle generation with many oases', () => {
      const oases: Vector3[] = Array.from({ length: 20 }, (_, i) => ({
        x: (i % 5) * 200 - 400,
        y: 0,
        z: Math.floor(i / 5) * 200 - 400,
      }));

      manager.generateOutposts(oases);

      // Should still generate outposts, may be less than 6 due to constraints
      const outposts = manager.getOutposts();
      expect(outposts.length).toBeGreaterThan(0);
    });

    it('should handle multiple generate calls', () => {
      manager.generateOutposts();
      const firstCount = manager.getOutposts().length;

      manager.generateOutposts();
      const secondCount = manager.getOutposts().length;

      expect(secondCount).toBe(firstCount);
    });

    it('should use different seed for different results', () => {
      const manager1 = new OutpostManager(11111);
      const manager2 = new OutpostManager(22222);

      manager1.generateOutposts();
      manager2.generateOutposts();

      const outposts1 = manager1.getOutposts();
      const outposts2 = manager2.getOutposts();

      // Positions should be different (with high probability)
      let differentPositions = 0;
      for (let i = 0; i < Math.min(outposts1.length, outposts2.length); i++) {
        if (
          Math.abs(outposts1[i].position.x - outposts2[i].position.x) > 1 ||
          Math.abs(outposts1[i].position.z - outposts2[i].position.z) > 1
        ) {
          differentPositions++;
        }
      }

      expect(differentPositions).toBeGreaterThan(0);
    });
  });
});

// Helper function
function getDistance(pos1: Vector3, pos2: Vector3): number {
  const dx = pos1.x - pos2.x;
  const dz = pos1.z - pos2.z;
  return Math.sqrt(dx * dx + dz * dz);
}
