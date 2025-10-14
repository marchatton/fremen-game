import { describe, it, expect } from 'vitest';
import { Physics } from './Physics';

describe('Physics', () => {
  const physics = new Physics(12345);

  it('should validate player position against terrain', () => {
    const position = { x: 0, y: -10, z: 0 };
    const velocity = { x: 0, y: 0, z: 0 };
    
    const validated = physics.validatePlayerPosition(position, velocity, 0.016);
    
    expect(validated.y).toBeGreaterThanOrEqual(1);
  });

  it('should clamp player to terrain height', () => {
    const position = { x: 10, y: -100, z: 10 };
    const velocity = { x: 0, y: 0, z: 0 };
    
    const validated = physics.validatePlayerPosition(position, velocity, 0.016);
    const terrainHeight = physics.getTerrainHeight(10, 10);
    
    expect(validated.y).toBe(terrainHeight + 1);
  });

  it('should detect speed hack', () => {
    const velocity = { x: 100, y: 0, z: 100 };
    
    const isValid = physics.validatePlayerSpeed(velocity);
    
    expect(isValid).toBe(false);
  });

  it('should allow valid speeds', () => {
    const velocity = { x: 5, y: 0, z: 5 };
    
    const isValid = physics.validatePlayerSpeed(velocity);
    
    expect(isValid).toBe(true);
  });

  it('should clamp excessive velocity', () => {
    const velocity = { x: 100, y: 50, z: 100 };
    
    const clamped = physics.clampVelocity(velocity);
    const speed = Math.sqrt(clamped.x ** 2 + clamped.y ** 2 + clamped.z ** 2);
    
    expect(speed).toBeLessThanOrEqual(10);
  });

  it('should return terrain height for any position', () => {
    const height = physics.getTerrainHeight(0, 0);
    
    expect(typeof height).toBe('number');
    expect(isNaN(height)).toBe(false);
  });

  it('should have consistent terrain across instances with same seed', () => {
    const physics1 = new Physics(12345);
    const physics2 = new Physics(12345);
    
    const height1 = physics1.getTerrainHeight(50, 50);
    const height2 = physics2.getTerrainHeight(50, 50);
    
    expect(height1).toBe(height2);
  });
});
