import * as THREE from 'three';
import { TerrainGenerator, GAME_CONSTANTS } from '@fremen/shared';
import { TerrainChunk } from './TerrainChunk';

export class TerrainManager {
  private chunks = new Map<string, TerrainChunk>();
  private generator: TerrainGenerator;
  private scene: THREE.Scene;
  private chunkSize = GAME_CONSTANTS.TERRAIN_CHUNK_SIZE;
  private renderDistance = 3;

  constructor(scene: THREE.Scene, seed: number) {
    this.scene = scene;
    this.generator = new TerrainGenerator({ seed });
  }

  update(playerX: number, playerZ: number) {
    const playerChunkX = Math.floor(playerX / this.chunkSize);
    const playerChunkZ = Math.floor(playerZ / this.chunkSize);

    const visibleChunks = new Set<string>();

    for (let x = playerChunkX - this.renderDistance; x <= playerChunkX + this.renderDistance; x++) {
      for (let z = playerChunkZ - this.renderDistance; z <= playerChunkZ + this.renderDistance; z++) {
        const key = `${x},${z}`;
        visibleChunks.add(key);

        if (!this.chunks.has(key)) {
          this.loadChunk(x, z);
        }
      }
    }

    for (const [key, chunk] of this.chunks) {
      if (!visibleChunks.has(key)) {
        this.unloadChunk(key, chunk);
      }
    }
  }

  private loadChunk(chunkX: number, chunkZ: number) {
    const key = `${chunkX},${chunkZ}`;
    const chunk = new TerrainChunk(chunkX, chunkZ, this.chunkSize, this.generator);
    this.chunks.set(key, chunk);
    this.scene.add(chunk.getMesh());
  }

  private unloadChunk(key: string, chunk: TerrainChunk) {
    this.scene.remove(chunk.getMesh());
    chunk.dispose();
    this.chunks.delete(key);
  }

  getHeightAt(x: number, z: number): number {
    const chunkX = Math.floor(x / this.chunkSize);
    const chunkZ = Math.floor(z / this.chunkSize);
    const key = `${chunkX},${chunkZ}`;
    
    const chunk = this.chunks.get(key);
    if (!chunk) return 0;

    const localX = x - chunkX * this.chunkSize;
    const localZ = z - chunkZ * this.chunkSize;
    return chunk.getHeightAt(localX, localZ);
  }

  getGenerator(): TerrainGenerator {
    return this.generator;
  }
}
