export class InputManager {
  private keys: Map<string, boolean> = new Map();
  private mouseX = 0;
  private mouseY = 0;
  private mouseDeltaX = 0;
  private mouseDeltaY = 0;
  private isPointerLocked = false;
  private thumperRequested = false;
  private mountRequested = false;

  constructor() {
    this.setupEventListeners();
  }

  private setupEventListeners() {
    window.addEventListener('keydown', (e) => {
      this.keys.set(e.code, true);
      
      if (e.code === 'KeyE') {
        if (!this.thumperRequested && !this.mountRequested) {
          this.mountRequested = true;
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys.set(e.code, false);
    });

    window.addEventListener('mousemove', (e) => {
      if (this.isPointerLocked) {
        this.mouseDeltaX = e.movementX;
        this.mouseDeltaY = e.movementY;
      }
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
    });

    document.addEventListener('pointerlockchange', () => {
      this.isPointerLocked = document.pointerLockElement !== null;
    });

    window.addEventListener('click', () => {
      if (!this.isPointerLocked && document.body.requestPointerLock) {
        document.body.requestPointerLock();
      }
    });
  }

  isKeyPressed(code: string): boolean {
    return this.keys.get(code) || false;
  }

  getMovement(): { forward: number; right: number } {
    let forward = 0;
    let right = 0;

    if (this.isKeyPressed('KeyW')) forward += 1;
    if (this.isKeyPressed('KeyS')) forward -= 1;
    if (this.isKeyPressed('KeyD')) right += 1;
    if (this.isKeyPressed('KeyA')) right -= 1;

    return { forward, right };
  }

  getMouseDelta(): { x: number; y: number } {
    const delta = { x: this.mouseDeltaX, y: this.mouseDeltaY };
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;
    return delta;
  }

  getMousePosition(): { x: number; y: number } {
    return { x: this.mouseX, y: this.mouseY };
  }

  isPointerLockActive(): boolean {
    return this.isPointerLocked;
  }

  shouldDeployThumper(): boolean {
    if (this.thumperRequested) {
      this.thumperRequested = false;
      return true;
    }
    return false;
  }

  shouldMount(): boolean {
    if (this.mountRequested) {
      this.mountRequested = false;
      return true;
    }
    return false;
  }

  resetMountRequest() {
    this.mountRequested = false;
  }

  setThumperRequest(value: boolean) {
    this.thumperRequested = value;
  }
}
