import type { Vector3 } from './index.js';

export enum ObjectiveType {
  SHEPHERD_WORM = 'SHEPHERD_WORM',
}

export enum ObjectiveStatus {
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export interface Objective {
  id: string;
  type: ObjectiveType;
  targetPosition: Vector3;
  radius: number;
  timeLimit: number;
  expiresAt: number;
  status: ObjectiveStatus;
}
