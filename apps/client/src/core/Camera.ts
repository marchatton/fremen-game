import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export class CameraController {
  private camera: THREE.PerspectiveCamera;
  private orbitControls: OrbitControls;
  private target: THREE.Vector3 = new THREE.Vector3();
  private smoothedTarget: THREE.Vector3 = new THREE.Vector3();
  private offset: THREE.Vector3 = new THREE.Vector3(0, 5, 10);
  private ridingOffset: THREE.Vector3 = new THREE.Vector3(0, 8, 15);
  private currentOffset: THREE.Vector3 = new THREE.Vector3(0, 5, 10);
  private debugMode = false;
  private isRidingMode = false;
  private targetFov = 75;
  private currentFov = 75;

  constructor(camera: THREE.PerspectiveCamera, domElement: HTMLElement) {
    this.camera = camera;
    this.smoothedTarget.copy(this.target);
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
      this.smoothedTarget.lerp(this.target, Math.min(1, deltaTime * 10));
      
      const targetOffset = this.isRidingMode ? this.ridingOffset : this.offset;
      this.currentOffset.lerp(targetOffset, deltaTime * 3);
      
      const targetPosition = this.smoothedTarget.clone().add(this.currentOffset);
      this.camera.position.lerp(targetPosition, deltaTime * 5);
      this.camera.lookAt(this.smoothedTarget);

      this.currentFov += (this.targetFov - this.currentFov) * deltaTime * 5;
      this.camera.fov = this.currentFov;
      this.camera.updateProjectionMatrix();
    }
  }

  setRidingMode(riding: boolean) {
    this.isRidingMode = riding;
    this.targetFov = riding ? 70 : 75;
  }

  isDebugMode(): boolean {
    return this.debugMode;
  }
}
