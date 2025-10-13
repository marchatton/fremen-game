import * as THREE from 'three';
import type { ThumperState } from '@fremen/shared';

export class Thumper {
  private mesh: THREE.Mesh;
  private pulseGroup: THREE.Group;
  public id: string;
  private pulseTime = 0;

  constructor(id: string, position: THREE.Vector3) {
    this.id = id;
    this.pulseGroup = new THREE.Group();

    const baseGeometry = new THREE.CylinderGeometry(0.3, 0.4, 1, 8);
    const baseMaterial = new THREE.MeshStandardMaterial({
      color: 0x666666,
      flatShading: true,
      metalness: 0.6,
    });
    this.mesh = new THREE.Mesh(baseGeometry, baseMaterial);
    this.mesh.position.copy(position);
    this.mesh.castShadow = true;

    const topGeometry = new THREE.ConeGeometry(0.2, 0.4, 6);
    const topMaterial = new THREE.MeshStandardMaterial({
      color: 0xff4444,
      flatShading: true,
      emissive: 0xff0000,
      emissiveIntensity: 0.3,
    });
    const top = new THREE.Mesh(topGeometry, topMaterial);
    top.position.y = 0.7;
    this.mesh.add(top);

    this.pulseGroup.add(this.mesh);
  }

  update(deltaTime: number, state: ThumperState) {
    if (!state.active) return;

    this.pulseTime += deltaTime * 2;
    
    const scale = 1 + Math.sin(this.pulseTime * 2) * 0.1;
    this.mesh.scale.set(scale, 1, scale);

    const emissive = (Math.sin(this.pulseTime * 2) + 1) * 0.5;
    const top = this.mesh.children[0] as THREE.Mesh;
    if (top?.material) {
      (top.material as THREE.MeshStandardMaterial).emissiveIntensity = emissive * 0.8;
    }
  }

  getGroup(): THREE.Group {
    return this.pulseGroup;
  }

  dispose() {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
    
    const top = this.mesh.children[0] as THREE.Mesh;
    if (top) {
      top.geometry.dispose();
      (top.material as THREE.Material).dispose();
    }
  }
}
