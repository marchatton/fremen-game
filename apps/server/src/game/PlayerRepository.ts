import type { PlayerResources, Vector3 } from '@fremen/shared';
import { autoSaveManager, loadPlayer, savePlayer } from '../db/persistence';

export interface PlayerSnapshotUpdate {
  resources?: Partial<PlayerResources>;
  position?: Vector3;
}

export interface PlayerRepository {
  load(playerId: string, username: string): Promise<PlayerResources>;
  register(playerId: string, initial: PlayerResources, position: Vector3): void;
  updateSnapshot(playerId: string, update: PlayerSnapshotUpdate): void;
  unregister(playerId: string, finalState: PlayerSnapshotUpdate): Promise<void>;
}

export class DbPlayerRepository implements PlayerRepository {
  constructor(private readonly autosave = autoSaveManager) {
    this.autosave.start();
  }

  async load(playerId: string, username: string): Promise<PlayerResources> {
    return loadPlayer(playerId, username);
  }

  register(playerId: string, initial: PlayerResources, position: Vector3): void {
    this.autosave.registerPlayer(playerId);
    this.autosave.updatePlayerState(playerId, initial, position);
  }

  updateSnapshot(playerId: string, update: PlayerSnapshotUpdate): void {
    this.autosave.updatePlayerState(playerId, update.resources ?? {}, update.position);
  }

  async unregister(playerId: string, finalState: PlayerSnapshotUpdate): Promise<void> {
    if (finalState.resources) {
      await savePlayer(playerId, finalState.resources, finalState.position);
    }
    this.autosave.unregisterPlayer(playerId);
  }
}

export class NoopPlayerRepository implements PlayerRepository {
  async load(): Promise<PlayerResources> {
    throw new Error('NoopPlayerRepository cannot load players');
  }

  register(): void {}

  updateSnapshot(): void {}

  async unregister(): Promise<void> {}
}

export function createDbPlayerRepository(): PlayerRepository {
  return new DbPlayerRepository();
}
