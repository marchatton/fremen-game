import type { RoomPlayer } from './Room';

export interface GameSystem {
  onPlayerJoin?(player: RoomPlayer): void;
  onPlayerLeave?(playerId: string): void;
  update?(deltaTime: number): void;
}

export class SystemRegistry {
  private systems: GameSystem[] = [];

  registerSystem(system: GameSystem): void {
    this.systems.push(system);
  }

  onPlayerJoin(player: RoomPlayer): void {
    for (const system of this.systems) {
      system.onPlayerJoin?.(player);
    }
  }

  onPlayerLeave(playerId: string): void {
    for (const system of this.systems) {
      system.onPlayerLeave?.(playerId);
    }
  }

  update(deltaTime: number): void {
    for (const system of this.systems) {
      system.update?.(deltaTime);
    }
  }
}
