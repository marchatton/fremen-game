import { STARTING_RESOURCES, type PlayerResources, type Vector3 } from '@fremen/shared';
import type { PlayerRepository, PlayerSnapshotUpdate } from '../PlayerRepository';

function materializeTemplate(): PlayerResources {
  return {
    water: STARTING_RESOURCES.water ?? 100,
    spice: STARTING_RESOURCES.spice ?? 0,
    equipment: { ...(STARTING_RESOURCES.equipment ?? {}) },
    stats: { ...(STARTING_RESOURCES.stats ?? {}) },
    inventory: STARTING_RESOURCES.inventory ? [...STARTING_RESOURCES.inventory] : [],
  };
}

function cloneResources(resources: PlayerResources): PlayerResources {
  return {
    water: resources.water,
    spice: resources.spice,
    equipment: { ...resources.equipment },
    stats: { ...resources.stats },
    inventory: resources.inventory ? [...resources.inventory] : [],
  };
}

export class InMemoryPlayerRepository implements PlayerRepository {
  private store = new Map<string, PlayerResources>();
  private lastSnapshots = new Map<string, PlayerSnapshotUpdate>();

  constructor(private readonly template: PlayerResources = materializeTemplate()) {}

  async load(playerId: string): Promise<PlayerResources> {
    const existing = this.store.get(playerId);
    if (existing) {
      return cloneResources(existing);
    }

    const created = cloneResources(this.template);
    this.store.set(playerId, created);
    return cloneResources(created);
  }

  register(playerId: string, initial: PlayerResources, _position: Vector3): void {
    this.store.set(playerId, cloneResources(initial));
  }

  updateSnapshot(playerId: string, update: PlayerSnapshotUpdate): void {
    const current = this.store.get(playerId) ?? cloneResources(this.template);
    const merged: PlayerResources = {
      ...current,
      ...update.resources,
      equipment: update.resources?.equipment ? { ...update.resources.equipment } : current.equipment,
      stats: update.resources?.stats ? { ...update.resources.stats } : current.stats,
      inventory: update.resources?.inventory ? [...update.resources.inventory] : current.inventory,
    };

    this.store.set(playerId, merged);
    this.lastSnapshots.set(playerId, {
      ...update,
      resources: cloneResources(merged),
    });
  }

  async unregister(playerId: string, finalState: PlayerSnapshotUpdate): Promise<void> {
    const current = this.store.get(playerId) ?? cloneResources(this.template);
    const merged: PlayerResources = {
      ...current,
      ...finalState.resources,
      equipment: finalState.resources?.equipment ? { ...finalState.resources.equipment } : current.equipment,
      stats: finalState.resources?.stats ? { ...finalState.resources.stats } : current.stats,
      inventory: finalState.resources?.inventory ? [...finalState.resources.inventory] : current.inventory,
    };

    this.store.set(playerId, merged);
    this.lastSnapshots.set(playerId, finalState);
  }

  getSnapshot(playerId: string): PlayerSnapshotUpdate | undefined {
    return this.lastSnapshots.get(playerId);
  }
}
