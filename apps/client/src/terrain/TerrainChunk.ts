import * as THREE from 'three';
import { TerrainGenerator } from '@fremen/shared';

export class TerrainChunk {
  private mesh: THREE.Mesh;
  public chunkX: number;
  public chunkZ: number;
  public size: number;
  private heightmap: number[] = [];

  constructor(
    chunkX: number,
    chunkZ: number,
    size: number,
    generator: TerrainGenerator,
    lod = 0
  ) {
    this.chunkX = chunkX;
    this.chunkZ = chunkZ;
    this.size = size;

    const worldX = chunkX * size;
    const worldZ = chunkZ * size;

    const segments = lod === 0 ? 32 : 16;
    const resolution = size / segments;

    this.heightmap = generator.generateHeightmap(
      worldX,
      worldZ,
      segments + 1,
      segments + 1,
      resolution
    );

    const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
    const positionAttribute = geometry.getAttribute('position');

    for (let i = 0; i < positionAttribute.count; i++) {
      const height = this.heightmap[i];
      positionAttribute.setZ(i, height);
    }

    geometry.computeVertexNormals();

    const colors = new Float32Array(positionAttribute.count * 3);
    for (let i = 0; i < positionAttribute.count; i++) {
      const height = this.heightmap[i];
      const normalizedHeight = (height + 10) / 30;
      
      const sandLight = new THREE.Color(0xe8c896);
      const sandDark = new THREE.Color(0xb89968);
      const color = sandLight.lerp(sandDark, normalizedHeight);
      
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      flatShading: true,
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.position.set(worldX + size / 2, 0, worldZ + size / 2);
    this.mesh.receiveShadow = true;
  }

  getMesh(): THREE.Mesh {
    return this.mesh;
  }

  getHeightAt(localX: number, localZ: number): number {
    const segments = Math.sqrt(this.heightmap.length) - 1;
    const x = Math.floor((localX / this.size) * segments);
    const z = Math.floor((localZ / this.size) * segments);
    const index = z * (segments + 1) + x;
    return this.heightmap[index] || 0;
  }

  dispose() {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
