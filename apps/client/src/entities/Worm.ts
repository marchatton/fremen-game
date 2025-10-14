import * as THREE from 'three';
import type { WormState } from '@fremen/shared';

export class Worm {
  private segments: THREE.Mesh[] = [];
  private group: THREE.Group;
  public id: string;
  private animationTime = 0;

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

  updateFromState(state: WormState, deltaTime = 0.016) {
    if (state.controlPoints.length < this.segments.length) {
      return;
    }

    this.animationTime += deltaTime * state.speed * 0.5;

    for (let i = 0; i < this.segments.length; i++) {
      const point = state.controlPoints[i];
      
      const undulationOffset = Math.sin(this.animationTime - i * 0.3) * 0.3;
      
      this.segments[i].position.set(
        point.x,
        point.y + 1.5 + undulationOffset,
        point.z
      );

      if (i > 0) {
        const prevPoint = state.controlPoints[i - 1];
        const dx = point.x - prevPoint.x;
        const dz = point.z - prevPoint.z;
        const angle = Math.atan2(dx, dz);
        this.segments[i].rotation.y = angle;
        
        const tiltAngle = undulationOffset * 0.2;
        this.segments[i].rotation.z = tiltAngle;
      }
    }

    if (state.controlPoints.length > 0 && state.heading !== undefined) {
      this.segments[0].rotation.y = state.heading;
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
