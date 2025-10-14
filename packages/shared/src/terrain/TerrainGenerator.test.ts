import { describe, it, expect } from 'vitest';
import { TerrainGenerator, DEFAULT_TERRAIN_CONFIG } from './TerrainGenerator';

describe('TerrainGenerator', () => {
  it('should generate deterministic terrain from same seed', () => {
    const gen1 = new TerrainGenerator({ seed: 12345 });
    const gen2 = new TerrainGenerator({ seed: 12345 });

    const height1 = gen1.getHeight(10, 20);
    const height2 = gen2.getHeight(10, 20);

    expect(height1).toBe(height2);
  });

  it('should generate different terrain from different seeds', () => {
    const gen1 = new TerrainGenerator({ seed: 12345 });
    const gen2 = new TerrainGenerator({ seed: 54321 });

    const height1 = gen1.getHeight(10, 20);
    const height2 = gen2.getHeight(10, 20);

    expect(height1).not.toBe(height2);
  });

  it('should return a number for any coordinate', () => {
    const gen = new TerrainGenerator({ seed: 12345 });
    
    const height = gen.getHeight(0, 0);
    expect(typeof height).toBe('number');
    expect(isNaN(height)).toBe(false);
  });

  it('should generate heightmap with correct dimensions', () => {
    const gen = new TerrainGenerator({ seed: 12345 });
    const width = 10;
    const height = 10;
    
    const heightmap = gen.generateHeightmap(0, 0, width, height, 1);
    
    expect(heightmap).toHaveLength(width * height);
  });

  it('should generate continuous terrain (smooth transitions)', () => {
    const gen = new TerrainGenerator({ seed: 12345 });
    
    const h1 = gen.getHeight(0, 0);
    const h2 = gen.getHeight(0.1, 0);
    
    const diff = Math.abs(h1 - h2);
    expect(diff).toBeLessThan(5);
  });

  it('should use default config when not provided', () => {
    const gen = new TerrainGenerator();
    const height = gen.getHeight(0, 0);
    
    expect(typeof height).toBe('number');
    expect(isNaN(height)).toBe(false);
  });

  it('should respect amplitude parameter', () => {
    const smallAmp = new TerrainGenerator({ seed: 12345, amplitude: 5 });
    const largeAmp = new TerrainGenerator({ seed: 12345, amplitude: 50 });
    
    const height1 = smallAmp.getHeight(10, 10);
    const height2 = largeAmp.getHeight(10, 10);
    
    expect(Math.abs(height2)).toBeGreaterThan(Math.abs(height1));
  });
});
