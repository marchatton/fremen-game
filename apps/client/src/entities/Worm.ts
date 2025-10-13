import * as THREE from 'three';
import type { WormState } from '@fremen/shared';

export class Worm {
  private segments: THREE.Mesh[] = [];
  private group: THREE.Group;
  public id: string;

  constructor(id: string) {
    this.id = id;
    this.group = new THREE.Group();
    this.createSegments();
  }

  private createSegments() {
    const segmentCount = 10;
    
    for (let i = 0; i < segmentCount; i++) {
      const radius = 2 - (i * 0.1);
      const height = 3;
      
      const geometry = new THREE.CylinderGeometry(radius, radius * 0.9, height, 8);
      const material = new THREE.MeshStandardMaterial({
        color: 0xd4a574,
        flatShading: true,
        roughness: 0.8,
      });
      
      const segment = new THREE.Mesh(geometry, material);
      segment.castShadow = true;
      this.segments.push(segment);
      this.group.add(segment);
    }
  }

  updateFromState(state: WormState) {
    if (state.controlPoints.length < this.segments.length) {
      return;
    }

    for (let i = 0; i < this.segments.length; i++) {
      const point = state.controlPoints[i];
      this.segments[i].position.set(point.x, point.y + 1.5, point.z);

      if (i > 0) {
        const prevPoint = state.controlPoints[i - 1];
        const dx = point.x - prevPoint.x;
        const dz = point.z - prevPoint.z;
        const angle = Math.atan2(dx, dz);
        this.segments[i].rotation.y = angle;
      }
    }
  }

  getGroup(): THREE.Group {
    return this.group;
  }

  dispose() {
    for (const segment of this.segments) {
      segment.geometry.dispose();
      (segment.material as THREE.Material).dispose();
    }
  }
}
