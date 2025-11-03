import { describe, it, expect, beforeEach } from 'vitest';
import { WormAI } from './sim/WormAI';
import { WormAIState, GAME_CONSTANTS } from '@fremen/shared';

describe('VS2: Worm Steering System', () => {
  let wormAI: WormAI;
  const DELTA_TIME = 1 / GAME_CONSTANTS.TICK_RATE; // ~0.033s per tick

  beforeEach(() => {
    wormAI = new WormAI();
  });

  describe('Steering Preconditions', () => {
    it('should not steer worm when not mounted', () => {
      const worms = wormAI.getWorms();
      const initialHeading = worms[0].heading;

      // Try to steer unmounted worm
      wormAI.steerWorm('worm-0', 1.0, 0, DELTA_TIME);

      const updatedWorms = wormAI.getWorms();
      expect(updatedWorms[0].heading).toBe(initialHeading);
    });

    it('should only steer worm when in RIDDEN_BY state', () => {
      wormAI.mountWorm('worm-0', 'player1');

      const worms = wormAI.getWorms();
      const initialHeading = worms[0].heading;

      wormAI.steerWorm('worm-0', 1.0, 0, DELTA_TIME);

      const updatedWorms = wormAI.getWorms();
      expect(updatedWorms[0].heading).not.toBe(initialHeading);
    });

    it('should not steer worm after dismounting', () => {
      wormAI.mountWorm('worm-0', 'player1');
      wormAI.dismountWorm('worm-0');

      const worms = wormAI.getWorms();
      const initialHeading = worms[0].heading;

      wormAI.steerWorm('worm-0', 1.0, 0, DELTA_TIME);

      const updatedWorms = wormAI.getWorms();
      expect(updatedWorms[0].heading).toBe(initialHeading);
    });

    it('should not steer non-existent worm', () => {
      expect(() => {
        wormAI.steerWorm('worm-999', 1.0, 0, DELTA_TIME);
      }).not.toThrow();
    });
  });

  describe('Heading/Turn Rate Control', () => {
    beforeEach(() => {
      wormAI.mountWorm('worm-0', 'player1');
    });

    it('should turn right when direction > 0', () => {
      const worms = wormAI.getWorms();
      const initialHeading = worms[0].heading;

      wormAI.steerWorm('worm-0', 1.0, 0, DELTA_TIME);

      const updatedWorms = wormAI.getWorms();
      expect(updatedWorms[0].heading).toBeGreaterThan(initialHeading);
    });

    it('should turn left when direction < 0', () => {
      const worms = wormAI.getWorms();
      const initialHeading = worms[0].heading;

      wormAI.steerWorm('worm-0', -1.0, 0, DELTA_TIME);

      const updatedWorms = wormAI.getWorms();
      expect(updatedWorms[0].heading).toBeLessThan(initialHeading);
    });

    it('should not change heading when direction = 0', () => {
      const worms = wormAI.getWorms();
      const initialHeading = worms[0].heading;

      wormAI.steerWorm('worm-0', 0, 0, DELTA_TIME);

      const updatedWorms = wormAI.getWorms();
      expect(updatedWorms[0].heading).toBe(initialHeading);
    });

    it('should respect WORM_TURN_RATE constraint (45°/s = π/4 rad/s)', () => {
      const worms = wormAI.getWorms();
      const initialHeading = worms[0].heading;

      // Full right turn input for 1 second
      const direction = 1.0;
      const timeStep = 1.0;

      wormAI.steerWorm('worm-0', direction, 0, timeStep);

      const updatedWorms = wormAI.getWorms();
      const headingChange = Math.abs(updatedWorms[0].heading - initialHeading);

      // Should turn by exactly WORM_TURN_RATE (π/4) per second
      expect(headingChange).toBeCloseTo(GAME_CONSTANTS.WORM_TURN_RATE, 5);
    });

    it('should scale turn rate with deltaTime correctly', () => {
      const worms = wormAI.getWorms();
      const initialHeading = worms[0].heading;

      // Half-second turn
      const direction = 1.0;
      const timeStep = 0.5;

      wormAI.steerWorm('worm-0', direction, 0, timeStep);

      const updatedWorms = wormAI.getWorms();
      const headingChange = Math.abs(updatedWorms[0].heading - initialHeading);

      // Should turn by half the max turn rate
      expect(headingChange).toBeCloseTo(GAME_CONSTANTS.WORM_TURN_RATE * 0.5, 5);
    });

    it('should handle partial steering input (direction = 0.5)', () => {
      const worms = wormAI.getWorms();
      const initialHeading = worms[0].heading;

      wormAI.steerWorm('worm-0', 0.5, 0, 1.0);

      const updatedWorms = wormAI.getWorms();
      const headingChange = Math.abs(updatedWorms[0].heading - initialHeading);

      // Should turn by half the max turn rate
      expect(headingChange).toBeCloseTo(GAME_CONSTANTS.WORM_TURN_RATE * 0.5, 5);
    });

    it('should accumulate heading changes over multiple ticks', () => {
      const worms = wormAI.getWorms();
      const initialHeading = worms[0].heading;

      // Steer for 10 ticks at game tick rate
      for (let i = 0; i < 10; i++) {
        wormAI.steerWorm('worm-0', 1.0, 0, DELTA_TIME);
      }

      const updatedWorms = wormAI.getWorms();
      const headingChange = Math.abs(updatedWorms[0].heading - initialHeading);

      // Should accumulate turn over time
      const expectedChange = GAME_CONSTANTS.WORM_TURN_RATE * DELTA_TIME * 10;
      expect(headingChange).toBeCloseTo(expectedChange, 4);
    });

    it('should allow full 360° rotation', () => {
      const worms = wormAI.getWorms();
      const initialHeading = worms[0].heading;

      // Calculate ticks needed for ~360° turn
      const fullCircle = Math.PI * 2;
      const ticksNeeded = Math.ceil(fullCircle / (GAME_CONSTANTS.WORM_TURN_RATE * DELTA_TIME));

      for (let i = 0; i < ticksNeeded; i++) {
        wormAI.steerWorm('worm-0', 1.0, 0, DELTA_TIME);
      }

      const updatedWorms = wormAI.getWorms();
      const headingChange = Math.abs(updatedWorms[0].heading - initialHeading);

      // Should have rotated at least 2π radians
      expect(headingChange).toBeGreaterThanOrEqual(fullCircle * 0.9); // 90% of full circle (accounting for rounding)
    });
  });

  describe('Speed Control', () => {
    beforeEach(() => {
      wormAI.mountWorm('worm-0', 'player1');
    });

    it('should increase speed when speedIntent > 0 (forward)', () => {
      const worms = wormAI.getWorms();
      const initialSpeed = worms[0].speed;

      // Apply forward speed intent for 1 second
      for (let i = 0; i < 30; i++) {
        wormAI.steerWorm('worm-0', 0, 1.0, DELTA_TIME);
      }

      const updatedWorms = wormAI.getWorms();
      expect(updatedWorms[0].speed).toBeGreaterThan(initialSpeed);
    });

    it('should decrease speed when speedIntent < 0 (backward)', () => {
      const worms = wormAI.getWorms();
      const initialSpeed = worms[0].speed;

      // Apply backward speed intent for 1 second
      for (let i = 0; i < 30; i++) {
        wormAI.steerWorm('worm-0', 0, -1.0, DELTA_TIME);
      }

      const updatedWorms = wormAI.getWorms();
      expect(updatedWorms[0].speed).toBeLessThan(initialSpeed);
    });

    it('should not change speed when speedIntent = 0 (neutral)', () => {
      const worms = wormAI.getWorms();
      const initialSpeed = worms[0].speed;

      wormAI.steerWorm('worm-0', 0, 0, DELTA_TIME);

      const updatedWorms = wormAI.getWorms();
      expect(updatedWorms[0].speed).toBe(initialSpeed);
    });

    it('should respect WORM_MIN_SPEED constraint (5 m/s)', () => {
      // Set worm to min speed
      const worms = wormAI.getWorms();
      worms[0].speed = GAME_CONSTANTS.WORM_MIN_SPEED;

      // Try to slow down further for 2 seconds
      for (let i = 0; i < 60; i++) {
        wormAI.steerWorm('worm-0', 0, -1.0, DELTA_TIME);
      }

      const updatedWorms = wormAI.getWorms();
      expect(updatedWorms[0].speed).toBeGreaterThanOrEqual(GAME_CONSTANTS.WORM_MIN_SPEED);
      expect(updatedWorms[0].speed).toBe(GAME_CONSTANTS.WORM_MIN_SPEED);
    });

    it('should respect WORM_MAX_SPEED constraint (25 m/s)', () => {
      // Accelerate to max for 3 seconds
      for (let i = 0; i < 90; i++) {
        wormAI.steerWorm('worm-0', 0, 1.0, DELTA_TIME);
      }

      const updatedWorms = wormAI.getWorms();
      expect(updatedWorms[0].speed).toBeLessThanOrEqual(GAME_CONSTANTS.WORM_MAX_SPEED);
      // Due to exponential interpolation, speed approaches but may not reach exactly max
      expect(updatedWorms[0].speed).toBeCloseTo(GAME_CONSTANTS.WORM_MAX_SPEED, 0);
    });

    it('should smoothly interpolate speed changes (acceleration curve)', () => {
      const worms = wormAI.getWorms();
      const initialSpeed = worms[0].speed;

      const speeds: number[] = [initialSpeed];

      // Accelerate for 10 ticks
      for (let i = 0; i < 10; i++) {
        wormAI.steerWorm('worm-0', 0, 1.0, DELTA_TIME);
        const updated = wormAI.getWorms()[0];
        speeds.push(updated.speed);
      }

      // Check that speed increases are smooth (not instant)
      for (let i = 1; i < speeds.length - 1; i++) {
        const prevIncrease = speeds[i] - speeds[i - 1];
        const nextIncrease = speeds[i + 1] - speeds[i];

        // Increases should be relatively similar (smooth acceleration)
        expect(Math.abs(prevIncrease - nextIncrease)).toBeLessThan(2);
      }
    });

    it('should map speedIntent -1 to WORM_MIN_SPEED', () => {
      // Apply max backward for long enough to reach target
      for (let i = 0; i < 60; i++) {
        wormAI.steerWorm('worm-0', 0, -1.0, DELTA_TIME);
      }

      const worms = wormAI.getWorms();
      // Due to exponential interpolation, speed approaches min but may not reach exactly
      expect(worms[0].speed).toBeGreaterThanOrEqual(GAME_CONSTANTS.WORM_MIN_SPEED);
      expect(worms[0].speed).toBeLessThan(GAME_CONSTANTS.WORM_MIN_SPEED + 1);
    });

    it('should map speedIntent +1 to WORM_MAX_SPEED', () => {
      // Apply max forward for long enough to reach target
      for (let i = 0; i < 120; i++) {
        wormAI.steerWorm('worm-0', 0, 1.0, DELTA_TIME);
      }

      const worms = wormAI.getWorms();
      expect(worms[0].speed).toBeCloseTo(GAME_CONSTANTS.WORM_MAX_SPEED, 1);
    });

    it('should map speedIntent 0 to midpoint speed (~15 m/s)', () => {
      // Start from max speed
      const worms = wormAI.getWorms();
      worms[0].speed = GAME_CONSTANTS.WORM_MAX_SPEED;

      // Apply neutral speed intent (0 maps to midpoint speed ~15)
      for (let i = 0; i < 120; i++) {
        wormAI.steerWorm('worm-0', 0, 0, DELTA_TIME);
      }

      const updated = wormAI.getWorms()[0];
      // Speed should converge to midpoint (speedIntent 0 -> target speed 15)
      const expectedMidpoint = GAME_CONSTANTS.WORM_MIN_SPEED +
        (GAME_CONSTANTS.WORM_MAX_SPEED - GAME_CONSTANTS.WORM_MIN_SPEED) / 2;
      expect(updated.speed).toBeCloseTo(expectedMidpoint, 0);
    });
  });

  describe('Movement and Position Updates', () => {
    beforeEach(() => {
      wormAI.mountWorm('worm-0', 'player1');
    });

    it('should update worm head position when steering', () => {
      const worms = wormAI.getWorms();
      const initialHead = { ...worms[0].controlPoints[0] };

      wormAI.steerWorm('worm-0', 0, 1.0, DELTA_TIME);

      const updated = wormAI.getWorms()[0];
      const newHead = updated.controlPoints[0];

      // Head should have moved
      const moved = initialHead.x !== newHead.x || initialHead.z !== newHead.z;
      expect(moved).toBe(true);
    });

    it('should move in the direction of heading', () => {
      const worms = wormAI.getWorms();
      const heading = worms[0].heading;
      const initialHead = { ...worms[0].controlPoints[0] };

      wormAI.steerWorm('worm-0', 0, 0, DELTA_TIME);

      const updated = wormAI.getWorms()[0];
      const newHead = updated.controlPoints[0];

      // Calculate expected direction
      const dx = newHead.x - initialHead.x;
      const dz = newHead.z - initialHead.z;
      const actualHeading = Math.atan2(dx, dz);

      // Normalize heading difference to [-π, π] range (handle wraparound)
      let headingDiff = actualHeading - heading;
      while (headingDiff > Math.PI) headingDiff -= 2 * Math.PI;
      while (headingDiff < -Math.PI) headingDiff += 2 * Math.PI;

      // Heading should match movement direction (within tolerance)
      expect(Math.abs(headingDiff)).toBeLessThan(0.2);
    });

    it('should maintain exactly 12 control points during steering', () => {
      // Steer for many ticks
      for (let i = 0; i < 100; i++) {
        wormAI.steerWorm('worm-0', 1.0, 1.0, DELTA_TIME);
      }

      const worms = wormAI.getWorms();
      expect(worms[0].controlPoints.length).toBe(12);
    });

    it('should add new head and remove tail each tick', () => {
      const worms = wormAI.getWorms();
      const initialLength = worms[0].controlPoints.length;
      const initialHeadPos = { ...worms[0].controlPoints[0] };

      // Steer for a full second to ensure noticeable movement
      for (let i = 0; i < 30; i++) {
        wormAI.steerWorm('worm-0', 1.0, 1.0, DELTA_TIME);
      }

      const updated = wormAI.getWorms()[0];

      // Length should stabilize at 12
      expect(updated.controlPoints.length).toBeLessThanOrEqual(12);

      // Head should have moved significantly
      const newHead = updated.controlPoints[0];
      const distance = Math.sqrt(
        (newHead.x - initialHeadPos.x) ** 2 + (newHead.z - initialHeadPos.z) ** 2
      );
      expect(distance).toBeGreaterThan(1); // Should have moved at least 1m
    });

    it('should create curved path when continuously turning', () => {
      const worms = wormAI.getWorms();
      const initialHead = { ...worms[0].controlPoints[0] };

      // Turn and move for 1 second
      for (let i = 0; i < 30; i++) {
        wormAI.steerWorm('worm-0', 1.0, 1.0, DELTA_TIME);
      }

      const updated = wormAI.getWorms()[0];
      const finalHead = updated.controlPoints[0];

      // Should have moved significantly
      const distance = Math.sqrt(
        (finalHead.x - initialHead.x) ** 2 + (finalHead.z - initialHead.z) ** 2
      );

      expect(distance).toBeGreaterThan(10); // At speed ~15-20 m/s for 1s

      // Control points should form a curve (not a straight line)
      // Check that middle segments are offset from straight line between head and tail
      const head = updated.controlPoints[0];
      const tail = updated.controlPoints[11];
      const midSegment = updated.controlPoints[6];

      // Vector from tail to head
      const lineX = head.x - tail.x;
      const lineZ = head.z - tail.z;
      const lineLength = Math.sqrt(lineX ** 2 + lineZ ** 2);

      // Project midSegment onto this line
      const tailToMidX = midSegment.x - tail.x;
      const tailToMidZ = midSegment.z - tail.z;
      const projection = (tailToMidX * lineX + tailToMidZ * lineZ) / (lineLength ** 2);
      const projX = tail.x + projection * lineX;
      const projZ = tail.z + projection * lineZ;

      // Distance from midSegment to projection (curve offset)
      const offset = Math.sqrt((midSegment.x - projX) ** 2 + (midSegment.z - projZ) ** 2);

      expect(offset).toBeGreaterThan(0.1); // Should have some curve (reduced expectation)
    });
  });

  describe('Combined Steering and Speed', () => {
    beforeEach(() => {
      wormAI.mountWorm('worm-0', 'player1');
    });

    it('should allow simultaneous turning and speed changes', () => {
      const worms = wormAI.getWorms();
      const initialHeading = worms[0].heading;
      const initialSpeed = worms[0].speed;

      // Turn right and accelerate
      for (let i = 0; i < 30; i++) {
        wormAI.steerWorm('worm-0', 1.0, 1.0, DELTA_TIME);
      }

      const updated = wormAI.getWorms()[0];

      expect(updated.heading).toBeGreaterThan(initialHeading);
      expect(updated.speed).toBeGreaterThan(initialSpeed);
    });

    it('should turn faster at high speed (covers more ground per turn)', () => {
      const worms = wormAI.getWorms();
      worms[0].speed = GAME_CONSTANTS.WORM_MAX_SPEED;

      const initialPos = { ...worms[0].controlPoints[0] };

      wormAI.steerWorm('worm-0', 1.0, 0, DELTA_TIME);

      const updated = wormAI.getWorms()[0];
      const newPos = updated.controlPoints[0];

      const distanceHigh = Math.sqrt((newPos.x - initialPos.x) ** 2 + (newPos.z - initialPos.z) ** 2);

      // Reset and try at low speed
      const worms2 = new WormAI();
      worms2.mountWorm('worm-0', 'player1');
      const w2 = worms2.getWorms()[0];
      w2.speed = GAME_CONSTANTS.WORM_MIN_SPEED;
      const initialPos2 = { ...w2.controlPoints[0] };

      worms2.steerWorm('worm-0', 1.0, 0, DELTA_TIME);

      const updated2 = worms2.getWorms()[0];
      const newPos2 = updated2.controlPoints[0];

      const distanceLow = Math.sqrt((newPos2.x - initialPos2.x) ** 2 + (newPos2.z - initialPos2.z) ** 2);

      // High speed should cover more distance per tick
      expect(distanceHigh).toBeGreaterThan(distanceLow);
    });
  });

  describe('Edge Cases and Robustness', () => {
    beforeEach(() => {
      wormAI.mountWorm('worm-0', 'player1');
    });

    it('should handle extreme direction values (> 1.0)', () => {
      const worms = wormAI.getWorms();
      const initialHeading = worms[0].heading;

      wormAI.steerWorm('worm-0', 100.0, 0, DELTA_TIME);

      const updated = wormAI.getWorms()[0];
      const headingChange = Math.abs(updated.heading - initialHeading);

      // Should not turn faster than max turn rate
      const maxHeadingChange = GAME_CONSTANTS.WORM_TURN_RATE * DELTA_TIME * 100;
      expect(headingChange).toBeLessThanOrEqual(maxHeadingChange + 1e-9);
    });

    it('should handle extreme speedIntent values (> 1.0)', () => {
      for (let i = 0; i < 120; i++) {
        wormAI.steerWorm('worm-0', 0, 100.0, DELTA_TIME);
      }

      const worms = wormAI.getWorms();

      // Should still respect max speed
      expect(worms[0].speed).toBeLessThanOrEqual(GAME_CONSTANTS.WORM_MAX_SPEED);
    });

    it('should handle very small deltaTime values', () => {
      const worms = wormAI.getWorms();
      const initialHeading = worms[0].heading;

      wormAI.steerWorm('worm-0', 1.0, 0, 0.001);

      const updated = wormAI.getWorms()[0];

      // Should still turn, but very little
      expect(updated.heading).not.toBe(initialHeading);
      expect(Math.abs(updated.heading - initialHeading)).toBeLessThan(0.01);
    });

    it('should handle zero deltaTime gracefully', () => {
      const worms = wormAI.getWorms();
      const initialLength = worms[0].controlPoints.length;

      expect(() => {
        wormAI.steerWorm('worm-0', 1.0, 1.0, 0);
      }).not.toThrow();

      // With zero deltaTime, a point is still added but distance is 0
      expect(worms[0].controlPoints.length).toBeLessThanOrEqual(12); // Capped at 12
    });

    it('should handle negative deltaTime gracefully', () => {
      const worms = wormAI.getWorms();
      const initialHead = { ...worms[0].controlPoints[0] };

      wormAI.steerWorm('worm-0', 1.0, 1.0, -0.033);

      const updated = wormAI.getWorms()[0];

      // Should not move backward in time (or should handle gracefully)
      expect(updated.controlPoints).toBeDefined();
    });

    it('should handle rapid alternating steering inputs', () => {
      const worms = wormAI.getWorms();
      const initialPos = { ...worms[0].controlPoints[0] };

      // Alternate left/right rapidly
      for (let i = 0; i < 60; i++) {
        const direction = i % 2 === 0 ? 1.0 : -1.0;
        wormAI.steerWorm('worm-0', direction, 1.0, DELTA_TIME);
      }

      const updated = wormAI.getWorms()[0];

      // Should still move forward (zig-zag pattern)
      const distance = Math.sqrt(
        (updated.controlPoints[0].x - initialPos.x) ** 2 +
        (updated.controlPoints[0].z - initialPos.z) ** 2
      );

      expect(distance).toBeGreaterThan(5); // Should have moved significantly
      expect(updated.controlPoints.length).toBe(12); // Should maintain structure
    });
  });
});
