import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export class CameraController {
  private camera: THREE.PerspectiveCamera;
  private orbitControls: OrbitControls;
  private target: THREE.Vector3 = new THREE.Vector3();
  private offset: THREE.Vector3 = new THREE.Vector3(0, 5, 10);
  private debugMode = true;

  constructor(camera: THREE.PerspectiveCamera, domElement: HTMLElement) {
    this.camera = camera;
    this.orbitControls = new OrbitControls(camera, domElement);
    this.orbitControls.enableDamping = true;
    this.orbitControls.dampingFactor = 0.05;
    this.orbitControls.minDistance = 3;
    this.orbitControls.maxDistance = 50;
    this.orbitControls.maxPolarAngle = Math.PI / 2 - 0.1;

    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyC') {
        this.toggleDebugMode();
      }
    });
  }

  toggleDebugMode() {
    this.debugMode = !this.debugMode;
    this.orbitControls.enabled = this.debugMode;
    console.log(`Camera debug mode: ${this.debugMode ? 'ON' : 'OFF'}`);
  }

  setTarget(position: THREE.Vector3) {
    this.target.copy(position);
  }

  update(deltaTime: number) {
    if (this.debugMode) {
      this.orbitControls.update();
    } else {
      const targetPosition = this.target.clone().add(this.offset);
      this.camera.position.lerp(targetPosition, deltaTime * 5);
      this.camera.lookAt(this.target);
    }
  }

  isDebugMode(): boolean {
    return this.debugMode;
  }
}
