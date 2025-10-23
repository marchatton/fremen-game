import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ObjectiveManager } from './ObjectiveManager';
import { ObjectiveType, ObjectiveStatus, type Vector3 } from '@fremen/shared';

describe('VS2: Objective Manager', () => {
  let objectiveManager: ObjectiveManager;

  beforeEach(() => {
    objectiveManager = new ObjectiveManager();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Objective Spawning', () => {
    it('should spawn shepherd objective at specified location', () => {
      const targetPos: Vector3 = { x: 100, y: 0, z: 100 };

      const objective = objectiveManager.spawnShepherdObjective(targetPos);

      expect(objective).toBeDefined();
      expect(objective.type).toBe(ObjectiveType.SHEPHERD_WORM);
      expect(objective.targetPosition).toEqual(targetPos);
      expect(objective.status).toBe(ObjectiveStatus.ACTIVE);
    });

    it('should assign unique ID to each objective', () => {
      const obj1 = objectiveManager.spawnShepherdObjective({ x: 0, y: 0, z: 0 });
      const obj2 = objectiveManager.spawnShepherdObjective({ x: 10, y: 0, z: 10 });

      expect(obj1.id).not.toBe(obj2.id);
      expect(obj1.id).toMatch(/^[0-9a-f-]{36}$/); // UUID format
    });

    it('should set correct radius (20m)', () => {
      const objective = objectiveManager.spawnShepherdObjective({ x: 0, y: 0, z: 0 });

      expect(objective.radius).toBe(20);
    });

    it('should set correct time limit (180000ms = 3 minutes)', () => {
      const objective = objectiveManager.spawnShepherdObjective({ x: 0, y: 0, z: 0 });

      expect(objective.timeLimit).toBe(180000);
    });

    it('should set expiresAt to current time + timeLimit', () => {
      const now = Date.now();
      vi.setSystemTime(now);

      const objective = objectiveManager.spawnShepherdObjective({ x: 0, y: 0, z: 0 });

      expect(objective.expiresAt).toBe(now + 180000);
    });

    it('should replace previous active objective when spawning new one', () => {
      const obj1 = objectiveManager.spawnShepherdObjective({ x: 0, y: 0, z: 0 });
      const obj2 = objectiveManager.spawnShepherdObjective({ x: 100, y: 0, z: 100 });

      const active = objectiveManager.getActiveObjective();

      expect(active?.id).toBe(obj2.id);
      expect(active?.id).not.toBe(obj1.id);
    });
  });

  describe('Random Objective Spawning', () => {
    it('should spawn objective at random location', () => {
      const objective = objectiveManager.spawnRandomObjective();

      expect(objective).toBeDefined();
      expect(objective.type).toBe(ObjectiveType.SHEPHERD_WORM);
    });

    it('should spawn objectives at varying distances (200-500m from origin)', () => {
      const objectives = [];

      for (let i = 0; i < 10; i++) {
        const obj = objectiveManager.spawnRandomObjective();
        const distance = Math.sqrt(obj.targetPosition.x ** 2 + obj.targetPosition.z ** 2);
        objectives.push(distance);
      }

      // Should have some variety
      const min = Math.min(...objectives);
      const max = Math.max(...objectives);

      expect(min).toBeGreaterThanOrEqual(200);
      expect(max).toBeLessThanOrEqual(500);
      expect(max - min).toBeGreaterThan(50); // Should have decent spread
    });

    it('should spawn objectives in all directions (360°)', () => {
      const angles = [];

      for (let i = 0; i < 20; i++) {
        const obj = objectiveManager.spawnRandomObjective();
        const angle = Math.atan2(obj.targetPosition.z, obj.targetPosition.x);
        angles.push(angle);
      }

      // Should cover multiple quadrants
      const hasPositiveX = angles.some(a => Math.cos(a) > 0);
      const hasNegativeX = angles.some(a => Math.cos(a) < 0);
      const hasPositiveZ = angles.some(a => Math.sin(a) > 0);
      const hasNegativeZ = angles.some(a => Math.sin(a) < 0);

      expect(hasPositiveX).toBe(true);
      expect(hasNegativeX).toBe(true);
      expect(hasPositiveZ).toBe(true);
      expect(hasNegativeZ).toBe(true);
    });

    it('should set y position to 0', () => {
      const objective = objectiveManager.spawnRandomObjective();

      expect(objective.targetPosition.y).toBe(0);
    });
  });

  describe('Objective Completion Detection', () => {
    beforeEach(() => {
      objectiveManager.spawnShepherdObjective({ x: 100, y: 0, z: 100 });
    });

    it('should complete objective when worm is within radius', () => {
      const wormPos: Vector3 = { x: 105, y: 0, z: 105 }; // 5√2 ≈ 7m away

      const completed = objectiveManager.checkObjectiveCompletion(wormPos);

      expect(completed).toBe(true);
      const objective = objectiveManager.getActiveObjective();
      expect(objective?.status).toBe(ObjectiveStatus.COMPLETED);
    });

    it('should not complete objective when worm is outside radius', () => {
      const wormPos: Vector3 = { x: 125, y: 0, z: 125 }; // 25√2 ≈ 35m away

      const completed = objectiveManager.checkObjectiveCompletion(wormPos);

      expect(completed).toBe(false);
      const objective = objectiveManager.getActiveObjective();
      expect(objective?.status).toBe(ObjectiveStatus.ACTIVE);
    });

    it('should complete when worm is at exactly 20m (boundary test)', () => {
      // Position worm at exactly 20m away (radius boundary)
      const wormPos: Vector3 = { x: 100 + 20, y: 0, z: 100 };

      const completed = objectiveManager.checkObjectiveCompletion(wormPos);

      expect(completed).toBe(true);
    });

    it('should not complete when worm is at 20.1m (just outside boundary)', () => {
      const wormPos: Vector3 = { x: 100 + 20.1, y: 0, z: 100 };

      const completed = objectiveManager.checkObjectiveCompletion(wormPos);

      expect(completed).toBe(false);
    });

    it('should complete when worm is at center (0m distance)', () => {
      const wormPos: Vector3 = { x: 100, y: 0, z: 100 };

      const completed = objectiveManager.checkObjectiveCompletion(wormPos);

      expect(completed).toBe(true);
    });

    it('should ignore y-axis distance (only check horizontal distance)', () => {
      const wormPos: Vector3 = { x: 105, y: 1000, z: 105 }; // Very high in air

      const completed = objectiveManager.checkObjectiveCompletion(wormPos);

      expect(completed).toBe(true); // Should still complete (2D distance check)
    });

    it('should not re-complete already completed objective', () => {
      const wormPos: Vector3 = { x: 100, y: 0, z: 100 };

      objectiveManager.checkObjectiveCompletion(wormPos);
      const firstCheck = objectiveManager.checkObjectiveCompletion(wormPos);

      expect(firstCheck).toBe(false); // Already completed
    });

    it('should return false when no active objective exists', () => {
      const emptyManager = new ObjectiveManager();
      // Don't spawn any objective
      (emptyManager as any).activeObjective = null;

      const completed = emptyManager.checkObjectiveCompletion({ x: 0, y: 0, z: 0 });

      expect(completed).toBe(false);
    });

    it('should return false when objective is already failed', () => {
      const objective = objectiveManager.getActiveObjective()!;
      objective.status = ObjectiveStatus.FAILED;

      const completed = objectiveManager.checkObjectiveCompletion({ x: 100, y: 0, z: 100 });

      expect(completed).toBe(false);
    });
  });

  describe('Objective Timer and Expiration', () => {
    it('should fail objective when time limit expires', () => {
      objectiveManager.spawnShepherdObjective({ x: 100, y: 0, z: 100 });

      // Advance time to just before expiration
      vi.advanceTimersByTime(179999);
      objectiveManager.update();

      let objective = objectiveManager.getActiveObjective();
      expect(objective?.status).toBe(ObjectiveStatus.ACTIVE);

      // Advance past expiration
      vi.advanceTimersByTime(2);
      objectiveManager.update();

      objective = objectiveManager.getActiveObjective();
      expect(objective?.status).toBe(ObjectiveStatus.FAILED);
    });

    it('should not fail objective before time limit', () => {
      objectiveManager.spawnShepherdObjective({ x: 100, y: 0, z: 100 });

      vi.advanceTimersByTime(179999); // Just before expiration
      objectiveManager.update();

      const objective = objectiveManager.getActiveObjective();
      expect(objective?.status).toBe(ObjectiveStatus.ACTIVE);
    });

    it('should spawn new objective 5 seconds after failure', () => {
      const obj1 = objectiveManager.spawnShepherdObjective({ x: 100, y: 0, z: 100 });

      // Expire objective
      vi.advanceTimersByTime(180000);
      objectiveManager.update();

      expect(objectiveManager.getActiveObjective()?.status).toBe(ObjectiveStatus.FAILED);

      // Wait 5 seconds
      vi.advanceTimersByTime(5000);

      const objective = objectiveManager.getActiveObjective();
      expect(objective?.id).not.toBe(obj1.id);
      expect(objective?.status).toBe(ObjectiveStatus.ACTIVE);
    });

    it('should not spawn new objective before 5 second delay', () => {
      const obj1 = objectiveManager.spawnShepherdObjective({ x: 100, y: 0, z: 100 });

      // Expire objective
      vi.advanceTimersByTime(180000);
      objectiveManager.update();

      // Wait 4.9 seconds (just before respawn)
      vi.advanceTimersByTime(4900);

      const objective = objectiveManager.getActiveObjective();
      expect(objective?.id).toBe(obj1.id); // Still the failed objective
      expect(objective?.status).toBe(ObjectiveStatus.FAILED);
    });

    it('should not update timer for completed objectives', () => {
      objectiveManager.spawnShepherdObjective({ x: 100, y: 0, z: 100 });
      objectiveManager.checkObjectiveCompletion({ x: 100, y: 0, z: 100 });

      const objective = objectiveManager.getActiveObjective();
      expect(objective?.status).toBe(ObjectiveStatus.COMPLETED);

      // Advance time past expiration
      vi.advanceTimersByTime(200000);
      objectiveManager.update();

      // Should still be completed, not failed
      expect(objective?.status).toBe(ObjectiveStatus.COMPLETED);
    });

    it('should handle multiple update calls without side effects', () => {
      objectiveManager.spawnShepherdObjective({ x: 100, y: 0, z: 100 });

      // Call update many times within same time frame
      for (let i = 0; i < 100; i++) {
        objectiveManager.update();
      }

      const objective = objectiveManager.getActiveObjective();
      expect(objective?.status).toBe(ObjectiveStatus.ACTIVE);
    });
  });

  describe('Objective Lifecycle Integration', () => {
    it('should maintain objective state from spawn to completion', () => {
      const startTime = Date.now();
      vi.setSystemTime(startTime);

      const objective = objectiveManager.spawnShepherdObjective({ x: 100, y: 0, z: 100 });

      // Check initial state
      expect(objective.status).toBe(ObjectiveStatus.ACTIVE);
      expect(objective.expiresAt).toBe(startTime + 180000);

      // Advance time
      vi.advanceTimersByTime(60000); // 1 minute

      // Complete objective
      objectiveManager.checkObjectiveCompletion({ x: 100, y: 0, z: 100 });

      // Check final state
      const active = objectiveManager.getActiveObjective();
      expect(active?.id).toBe(objective.id);
      expect(active?.status).toBe(ObjectiveStatus.COMPLETED);
    });

    it('should maintain objective state from spawn to failure', () => {
      const startTime = Date.now();
      vi.setSystemTime(startTime);

      const objective = objectiveManager.spawnShepherdObjective({ x: 100, y: 0, z: 100 });

      // Let it expire
      vi.advanceTimersByTime(180001);
      objectiveManager.update();

      const active = objectiveManager.getActiveObjective();
      expect(active?.id).toBe(objective.id);
      expect(active?.status).toBe(ObjectiveStatus.FAILED);
    });

    it('should handle rapid spawn-complete-spawn cycles', () => {
      const objectives = [];

      for (let i = 0; i < 10; i++) {
        const obj = objectiveManager.spawnRandomObjective();
        objectives.push(obj.id);

        // Complete immediately
        objectiveManager.checkObjectiveCompletion(obj.targetPosition);
      }

      // All IDs should be unique
      const uniqueIds = new Set(objectives);
      expect(uniqueIds.size).toBe(10);
    });
  });

  describe('Edge Cases and Robustness', () => {
    it('should handle worm position with NaN values', () => {
      objectiveManager.spawnShepherdObjective({ x: 100, y: 0, z: 100 });

      const completed = objectiveManager.checkObjectiveCompletion({ x: NaN, y: 0, z: 0 });

      expect(completed).toBe(false);
    });

    it('should handle worm position with Infinity values', () => {
      objectiveManager.spawnShepherdObjective({ x: 100, y: 0, z: 100 });

      const completed = objectiveManager.checkObjectiveCompletion({
        x: Infinity,
        y: 0,
        z: Infinity
      });

      expect(completed).toBe(false);
    });

    it('should handle objective target with extreme coordinates', () => {
      const farPos: Vector3 = { x: 1e10, y: 0, z: 1e10 };
      const objective = objectiveManager.spawnShepherdObjective(farPos);

      expect(objective.targetPosition).toEqual(farPos);

      // Worm at exact position should complete
      const completed = objectiveManager.checkObjectiveCompletion(farPos);
      expect(completed).toBe(true);
    });

    it('should handle negative coordinate positions', () => {
      const negPos: Vector3 = { x: -500, y: 0, z: -500 };
      const objective = objectiveManager.spawnShepherdObjective(negPos);

      expect(objective.targetPosition).toEqual(negPos);

      const wormPos: Vector3 = { x: -490, y: 0, z: -490 }; // ~14m away
      const completed = objectiveManager.checkObjectiveCompletion(wormPos);
      expect(completed).toBe(true);
    });

    it('should handle zero radius objective (if radius could be customized)', () => {
      const objective = objectiveManager.spawnShepherdObjective({ x: 100, y: 0, z: 100 });
      objective.radius = 0;

      // Only exact position should complete
      const exactMatch = objectiveManager.checkObjectiveCompletion({ x: 100, y: 0, z: 100 });
      expect(exactMatch).toBe(true);

      // Reset status for next check
      objectiveManager.spawnShepherdObjective({ x: 100, y: 0, z: 100 });
      objectiveManager.getActiveObjective()!.radius = 0;

      const nearMatch = objectiveManager.checkObjectiveCompletion({ x: 100.1, y: 0, z: 100 });
      expect(nearMatch).toBe(false);
    });

    it('should handle very large radius objective', () => {
      const objective = objectiveManager.spawnShepherdObjective({ x: 100, y: 0, z: 100 });
      objective.radius = 1000;

      // Far away position should complete
      const farPos: Vector3 = { x: 900, y: 0, z: 100 }; // 800m away
      const completed = objectiveManager.checkObjectiveCompletion(farPos);
      expect(completed).toBe(true);
    });

    it('should handle update() calls with no active objective', () => {
      const emptyManager = new ObjectiveManager();
      (emptyManager as any).activeObjective = null;

      expect(() => {
        emptyManager.update();
      }).not.toThrow();
    });

    it('should handle concurrent completion checks', () => {
      objectiveManager.spawnShepherdObjective({ x: 100, y: 0, z: 100 });

      const results = [];
      for (let i = 0; i < 5; i++) {
        results.push(objectiveManager.checkObjectiveCompletion({ x: 100, y: 0, z: 100 }));
      }

      // Only first check should return true
      expect(results[0]).toBe(true);
      expect(results.slice(1).every(r => r === false)).toBe(true);
    });
  });

  describe('Time Precision', () => {
    it('should use millisecond precision for expiration', () => {
      const startTime = 1000000;
      vi.setSystemTime(startTime);

      const objective = objectiveManager.spawnShepherdObjective({ x: 0, y: 0, z: 0 });

      expect(objective.expiresAt).toBe(startTime + 180000);
    });

    it('should expire at exact millisecond', () => {
      const startTime = Date.now();
      vi.setSystemTime(startTime);

      objectiveManager.spawnShepherdObjective({ x: 0, y: 0, z: 0 });

      // Advance to 1ms before expiration
      vi.setSystemTime(startTime + 179999);
      objectiveManager.update();
      expect(objectiveManager.getActiveObjective()?.status).toBe(ObjectiveStatus.ACTIVE);

      // Advance to exact expiration time
      vi.setSystemTime(startTime + 180000);
      objectiveManager.update();
      expect(objectiveManager.getActiveObjective()?.status).toBe(ObjectiveStatus.FAILED);
    });
  });
});
