import { createNoise2D } from 'simplex-noise';

export interface TerrainConfig {
  seed: number;
  scale: number;
  octaves: number;
  persistence: number;
  lacunarity: number;
  amplitude: number;
}

export const DEFAULT_TERRAIN_CONFIG: TerrainConfig = {
  seed: 12345,
  scale: 0.01,
  octaves: 4,
  persistence: 0.5,
  lacunarity: 2.0,
  amplitude: 20,
};

export class TerrainGenerator {
  private noise2D: ReturnType<typeof createNoise2D>;
  private config: TerrainConfig;

  constructor(config: Partial<TerrainConfig> = {}) {
    this.config = { ...DEFAULT_TERRAIN_CONFIG, ...config };
    
    const alea = (seed: number) => {
      let s = seed;
      return () => {
        s = Math.imul(s ^ (s >>> 16), 0x85ebca6b);
        s = Math.imul(s ^ (s >>> 13), 0xc2b2ae35);
        return ((s ^= s >>> 16) >>> 0) / 4294967296;
      };
    };

    this.noise2D = createNoise2D(alea(this.config.seed));
  }

  getHeight(x: number, z: number): number {
    let height = 0;
    let frequency = this.config.scale;
    let amplitude = this.config.amplitude;

    for (let i = 0; i < this.config.octaves; i++) {
      const nx = x * frequency;
      const nz = z * frequency;
      height += this.noise2D(nx, nz) * amplitude;

      frequency *= this.config.lacunarity;
      amplitude *= this.config.persistence;
    }

    return height;
  }

  generateHeightmap(
    startX: number,
    startZ: number,
    width: number,
    height: number,
    resolution: number
  ): number[] {
    const heightmap: number[] = [];
    
    for (let z = 0; z < height; z++) {
      for (let x = 0; x < width; x++) {
        const worldX = startX + x * resolution;
        const worldZ = startZ + z * resolution;
        heightmap.push(this.getHeight(worldX, worldZ));
      }
    }

    return heightmap;
  }
}
