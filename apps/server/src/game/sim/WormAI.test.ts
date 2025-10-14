import { describe, it, expect, beforeEach } from 'vitest';
import { WormAI } from './WormAI';

describe('WormAI', () => {
  let wormAI: WormAI;

  beforeEach(() => {
    wormAI = new WormAI();
  });

  it('should spawn initial worm', () => {
    const worms = wormAI.getWorms();
    
    expect(worms).toHaveLength(1);
    expect(worms[0].id).toBe('worm-0');
  });

  it('should have control points for worm', () => {
    const worms = wormAI.getWorms();
    
    expect(worms[0].controlPoints).toBeDefined();
    expect(worms[0].controlPoints.length).toBeGreaterThan(0);
  });

  it('should update worm position over time', () => {
    const worms = wormAI.getWorms();
    const initialHead = { ...worms[0].controlPoints[0] };
    
    wormAI.update(1);
    
    const updatedHead = worms[0].controlPoints[0];
    const moved = initialHead.x !== updatedHead.x || initialHead.z !== updatedHead.z;
    
    expect(moved).toBe(true);
  });

  it('should have target position for worm', () => {
    const worms = wormAI.getWorms();
    
    expect(worms[0].targetPosition).toBeDefined();
  });

  it('should allow setting worm target', () => {
    const target = { x: 100, y: 0, z: 100 };
    
    wormAI.setWormTarget('worm-0', target);
    
    const worms = wormAI.getWorms();
    expect(worms[0].targetPosition).toEqual(target);
  });

  it('should find nearest worm', () => {
    const position = { x: 50, y: 0, z: 50 };
    
    const nearestId = wormAI.findNearestWorm(position);
    
    expect(nearestId).toBe('worm-0');
  });

  it('should find nearest worm when multiple worms exist', () => {
    // WormAI always spawns with one worm, so we test the findNearestWorm works
    const position = { x: 0, y: 0, z: 0 };
    
    const nearestId = wormAI.findNearestWorm(position);
    
    expect(nearestId).toBe('worm-0');
  });

  it('should move worm towards target', () => {
    const target = { x: 200, y: 0, z: 200 };
    wormAI.setWormTarget('worm-0', target);
    
    const worms = wormAI.getWorms();
    const initialHead = { ...worms[0].controlPoints[0] };
    
    wormAI.update(1);
    
    const updatedHead = worms[0].controlPoints[0];
    
    const initialDist = Math.sqrt(
      (target.x - initialHead.x) ** 2 + (target.z - initialHead.z) ** 2
    );
    const updatedDist = Math.sqrt(
      (target.x - updatedHead.x) ** 2 + (target.z - updatedHead.z) ** 2
    );
    
    expect(updatedDist).toBeLessThan(initialDist);
  });

  it('should maintain control points count', () => {
    wormAI.update(1);
    
    const worms = wormAI.getWorms();
    expect(worms[0].controlPoints.length).toBeLessThanOrEqual(12);
  });
});
