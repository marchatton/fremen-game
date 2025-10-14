import * as THREE from 'three';

export class ObjectiveMarker {
  private group: THREE.Group;
  private beacon: THREE.Mesh;
  private ring: THREE.Mesh;
  private pulseTime = 0;

  constructor(position: THREE.Vector3, radius: number) {
    this.group = new THREE.Group();
    this.group.position.copy(position);

    const beaconGeometry = new THREE.CylinderGeometry(0.5, 0.5, 10, 8);
    const beaconMaterial = new THREE.MeshStandardMaterial({
      color: 0x00ff00,
      emissive: 0x00ff00,
      emissiveIntensity: 0.5,
      flatShading: true,
    });
    this.beacon = new THREE.Mesh(beaconGeometry, beaconMaterial);
    this.beacon.position.y = 5;
    this.group.add(this.beacon);

    const ringGeometry = new THREE.RingGeometry(radius - 1, radius, 32);
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ff00,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.3,
    });
    this.ring = new THREE.Mesh(ringGeometry, ringMaterial);
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.1;
    this.group.add(this.ring);
  }

  update(deltaTime: number) {
    this.pulseTime += deltaTime;
    
    const pulse = (Math.sin(this.pulseTime * 3) + 1) / 2;
    const material = this.beacon.material as THREE.MeshStandardMaterial;
    material.emissiveIntensity = 0.3 + pulse * 0.7;
    
    this.beacon.rotation.y += deltaTime;
  }

  getGroup(): THREE.Group {
    return this.group;
  }

  dispose() {
    this.beacon.geometry.dispose();
    (this.beacon.material as THREE.Material).dispose();
    this.ring.geometry.dispose();
    (this.ring.material as THREE.Material).dispose();
  }
}
