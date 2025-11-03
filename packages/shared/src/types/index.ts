export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export enum PlayerStateEnum {
  ACTIVE = 'ACTIVE',
  RIDING = 'RIDING',
  DEAD = 'DEAD',
}

export enum WormAIState {
  PATROLLING = 'PATROLLING',
  APPROACHING_THUMPER = 'APPROACHING_THUMPER',
  RIDDEN_BY = 'RIDDEN_BY',
  SAFE_SPIRAL = 'SAFE_SPIRAL',
}

export interface PlayerState {
  id: string;
  position: Vector3;
  rotation: number;
  velocity: Vector3;
  state: PlayerStateEnum;
  ridingWormId?: string;
}

export interface WormState {
  id: string;
  controlPoints: Vector3[];
  targetPosition?: Vector3;
  speed: number;
  aiState: WormAIState;
  riderId?: string;
  health: number;
  heading: number;
}

export interface ThumperState {
  id: string;
  position: Vector3;
  active: boolean;
  expiresAt: number;
}

export type DamageSource = 'player' | 'ai' | 'environment';

export interface HealthState {
  current: number;
  max: number;
  regenRate: number;
}

export type Faction = 'harkonnen' | 'fremen';

export interface OutpostState {
  id: string;
  position: Vector3;
  radius: number;
  controllingFaction: Faction;
  captureProgress: number;
  captureTarget: number;
  garrisonSize: number;
  jammedUntil?: number;
}
