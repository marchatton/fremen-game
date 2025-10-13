import * as THREE from 'three';

export class Player {
  private mesh: THREE.Mesh;
  private velocity: THREE.Vector3 = new THREE.Vector3();
  public id: string;

  constructor(id: string, color = 0x4a90e2) {
    this.id = id;
    
    const geometry = new THREE.CapsuleGeometry(0.5, 1.5, 4, 8);
    const material = new THREE.MeshStandardMaterial({
      color,
      flatShading: true,
    });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.castShadow = true;
  }

  getMesh(): THREE.Mesh {
    return this.mesh;
  }

  getPosition(): THREE.Vector3 {
    return this.mesh.position;
  }

  setPosition(x: number, y: number, z: number) {
    this.mesh.position.set(x, y, z);
  }

  setRotation(y: number) {
    this.mesh.rotation.y = y;
  }

  getVelocity(): THREE.Vector3 {
    return this.velocity;
  }

  setVelocity(velocity: THREE.Vector3) {
    this.velocity.copy(velocity);
  }

  update(deltaTime: number) {
    this.mesh.position.add(this.velocity.clone().multiplyScalar(deltaTime));
  }
}
