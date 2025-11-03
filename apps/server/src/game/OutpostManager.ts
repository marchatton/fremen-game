import type { Room } from './Room';
import type { GameSystem } from './SystemRegistry';
import {
  VS4_CONSTANTS,
  PlayerStateEnum,
  type Vector3,
  type ThumperState,
  type Faction,
  type OutpostState,
} from '@fremen/shared';

interface OutpostDefinition {
  id: string;
  position: Vector3;
  radius: number;
}

interface OutpostRecord extends OutpostState {
  capturingPlayers: Set<string>;
}

type RewardPlayerFn = (playerId: string) => void;
type ThumperProvider = () => ThumperState[];
type GarrisonProvider = (outpostId: string) => number;
type FactionChangeHandler = (outpostId: string, faction: Faction) => void;
type TimestampFn = () => number;

export class OutpostManager implements GameSystem {
  private readonly outposts = new Map<string, OutpostRecord>();
  private garrisonProvider?: GarrisonProvider;
  private factionChangeHandler?: FactionChangeHandler;
  private readonly jammedByThumpers = new Set<string>();

  constructor(
    private readonly room: Room,
    private readonly rewardPlayer: RewardPlayerFn,
    private readonly getThumpers: ThumperProvider,
    private readonly now: TimestampFn = () => Date.now()
  ) {
    const definitions: OutpostDefinition[] = [
      { id: 'outpost-alpha', position: { x: 150, y: 0, z: 200 }, radius: VS4_CONSTANTS.OUTPOST_CAPTURE_RADIUS },
      { id: 'outpost-beta', position: { x: -220, y: 0, z: -120 }, radius: VS4_CONSTANTS.OUTPOST_CAPTURE_RADIUS },
    ];

    for (const definition of definitions) {
      this.outposts.set(definition.id, {
        ...definition,
        controllingFaction: 'harkonnen',
        captureProgress: 0,
        captureTarget: VS4_CONSTANTS.OUTPOST_CAPTURE_TIME,
        garrisonSize: VS4_CONSTANTS.OUTPOST_MIN_GARRISON,
        capturingPlayers: new Set(),
      });
    }
  }

  setGarrisonProvider(provider: GarrisonProvider): void {
    this.garrisonProvider = provider;
  }

  setFactionChangeHandler(handler: FactionChangeHandler): void {
    this.factionChangeHandler = handler;
  }

  update(deltaTime: number): void {
    const players = this.room.getAllPlayers();
    const thumpers = this.getThumpers();
    const now = this.now();

    const activeThumpers = new Set(
      thumpers.filter(thumper => thumper.active).map(thumper => thumper.id)
    );
    for (const thumperId of Array.from(this.jammedByThumpers)) {
      if (!activeThumpers.has(thumperId)) {
        this.jammedByThumpers.delete(thumperId);
      }
    }

    for (const outpost of this.outposts.values()) {
      if (outpost.jammedUntil && now >= outpost.jammedUntil) {
        outpost.jammedUntil = undefined;
      }

      for (const thumper of thumpers) {
        if (!thumper.active) continue;
        const distance = this.getDistance(thumper.position, outpost.position);
        if (distance > VS4_CONSTANTS.THUMPER_JAM_RADIUS) continue;
        if (this.jammedByThumpers.has(thumper.id)) continue;

        this.jammedByThumpers.add(thumper.id);
        outpost.jammedUntil = now + VS4_CONSTANTS.THUMPER_JAM_DURATION;
      }

      const garrison = this.garrisonProvider?.(outpost.id) ?? 0;
      outpost.garrisonSize = garrison;

      const playersInRadius = players.filter(player => {
        const distance = this.getDistance(player.state.position, outpost.position);
        return distance <= outpost.radius && player.state.state !== PlayerStateEnum.DEAD;
      });

      if (playersInRadius.length > 0 && garrison === 0 && outpost.controllingFaction !== 'fremen') {
        outpost.captureProgress = Math.min(
          outpost.captureTarget,
          outpost.captureProgress + deltaTime
        );
        outpost.capturingPlayers = new Set(playersInRadius.map(p => p.playerId));
      } else {
        outpost.captureProgress = Math.max(
          0,
          outpost.captureProgress - VS4_CONSTANTS.OUTPOST_DECAY_RATE * deltaTime
        );
        if (playersInRadius.length === 0 || garrison > 0) {
          outpost.capturingPlayers.clear();
        }
      }

      if (outpost.captureProgress >= outpost.captureTarget && outpost.controllingFaction !== 'fremen') {
        outpost.controllingFaction = 'fremen';
        outpost.captureProgress = outpost.captureTarget;
        for (const playerId of outpost.capturingPlayers) {
          this.rewardPlayer(playerId);
        }
        outpost.capturingPlayers.clear();
        this.factionChangeHandler?.(outpost.id, 'fremen');
      }

      if (
        outpost.controllingFaction === 'fremen' &&
        garrison >= VS4_CONSTANTS.OUTPOST_MIN_GARRISON &&
        playersInRadius.length === 0 &&
        outpost.captureProgress === 0
      ) {
        outpost.controllingFaction = 'harkonnen';
        outpost.capturingPlayers.clear();
        this.factionChangeHandler?.(outpost.id, 'harkonnen');
      }
    }
  }

  getOutposts(): OutpostState[] {
    return Array.from(this.outposts.values()).map(outpost => ({
      id: outpost.id,
      position: { ...outpost.position },
      radius: outpost.radius,
      controllingFaction: outpost.controllingFaction,
      captureProgress: outpost.captureProgress,
      captureTarget: outpost.captureTarget,
      garrisonSize: outpost.garrisonSize,
      jammedUntil: outpost.jammedUntil,
    }));
  }

  getOutpost(outpostId: string): OutpostState | undefined {
    const outpost = this.outposts.get(outpostId);
    if (!outpost) {
      return undefined;
    }

    return {
      id: outpost.id,
      position: { ...outpost.position },
      radius: outpost.radius,
      controllingFaction: outpost.controllingFaction,
      captureProgress: outpost.captureProgress,
      captureTarget: outpost.captureTarget,
      garrisonSize: outpost.garrisonSize,
      jammedUntil: outpost.jammedUntil,
    };
  }

  isJammed(outpostId: string): boolean {
    const outpost = this.outposts.get(outpostId);
    if (!outpost || !outpost.jammedUntil) {
      return false;
    }
    return this.now() < outpost.jammedUntil;
  }

  private getDistance(a: Vector3, b: Vector3): number {
    const dx = a.x - b.x;
    const dz = a.z - b.z;
    return Math.sqrt(dx * dx + dz * dz);
  }
}
