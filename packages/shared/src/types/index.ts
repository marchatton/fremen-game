export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface PlayerState {
  id: string;
  position: Vector3;
  rotation: number;
  velocity: Vector3;
}

export interface WormState {
  id: string;
  controlPoints: Vector3[];
  targetPosition?: Vector3;
  speed: number;
}

export interface ThumperState {
  id: string;
  position: Vector3;
  active: boolean;
  expiresAt: number;
}
