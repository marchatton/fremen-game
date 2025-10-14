import type { Vector3, PlayerState, WormState, ThumperState } from '@fremen/shared';

export interface C_INPUT {
  type: 'C_INPUT';
  seq: number;
  timestamp: number;
  movement: {
    forward: number;
    right: number;
  };
  rotation: number;
  action?: {
    type: 'deployThumper' | 'mount' | 'dismount';
    target?: string;
  };
  wormControl?: {
    direction: number;
    speedIntent: number;
  };
}

export interface S_WELCOME {
  type: 'S_WELCOME';
  playerId: string;
  seed: number;
  timestamp: number;
}

export interface S_STATE {
  type: 'S_STATE';
  timestamp: number;
  lastProcessedInputSeq?: number;
  players: PlayerState[];
  worms: WormState[];
  thumpers: ThumperState[];
  objective?: {
    id: string;
    type: string;
    targetPosition: Vector3;
    radius: number;
    timeRemaining: number;
    status: string;
  };
}

export interface S_SNAPSHOT {
  type: 'S_SNAPSHOT';
  timestamp: number;
  players: PlayerState[];
  worms: WormState[];
  thumpers: ThumperState[];
}

export interface C_CHAT {
  type: 'C_CHAT';
  message: string;
}

export interface S_CHAT {
  type: 'S_CHAT';
  playerId: string;
  playerName: string;
  message: string;
  timestamp: number;
}

export interface S_EVENT {
  type: 'S_EVENT';
  eventType: 'damage' | 'collection' | 'worm_mounted';
  data: unknown;
}

export type ClientMessage = C_INPUT | C_CHAT;
export type ServerMessage = S_WELCOME | S_STATE | S_SNAPSHOT | S_CHAT | S_EVENT;
