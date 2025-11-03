import { VS4_CONSTANTS, type Vector3 } from '@fremen/shared';
import type { GameSystem } from '../SystemRegistry';
import type { Room } from '../Room';
import type { CombatSystem } from '../CombatSystem';
import type { OutpostManager } from '../OutpostManager';
import { HarkonnenAI, HarkonnenState, type HarkonnenTrooper } from './HarkonnenAI';

interface AIManagerOptions {
  now?: () => number;
}

export class AIManager implements GameSystem {
  private readonly ai: HarkonnenAI;
  private readonly trooperAssignments = new Map<string, string>();
  private readonly backfillTimers = new Map<string, number>();
  private spawnCounter = 0;
  private readonly now: () => number;

  constructor(
    private readonly room: Room,
    private readonly combatSystem: CombatSystem,
    private readonly outpostManager: OutpostManager,
    options: AIManagerOptions = {}
  ) {
    this.now = options.now ?? (() => Date.now());
    this.ai = new HarkonnenAI();
    this.ai.setCombatHandler((attackerId, targetId, damage) => {
      this.combatSystem.handleAIFire(attackerId, targetId, damage);
    });

    for (const outpost of this.outpostManager.getOutposts()) {
      for (let i = 0; i < VS4_CONSTANTS.OUTPOST_MIN_GARRISON; i++) {
        this.spawnTrooper(outpost.id, outpost.position);
      }
    }
  }

  update(deltaTime: number): void {
    const players = this.room.getAllPlayers().map(player => ({
      id: player.playerId,
      position: player.state.position,
      state: player.state.state,
    }));

    this.ai.update(deltaTime, players);
    this.cleanupAssignments();

    for (const outpost of this.outpostManager.getOutposts()) {
      this.ensureBackfill(outpost.id, outpost.position);
    }
  }

  getTroopersForOutpost(outpostId: string): HarkonnenTrooper[] {
    const troopers: HarkonnenTrooper[] = [];
    for (const [trooperId, assignedOutpost] of this.trooperAssignments) {
      if (assignedOutpost !== outpostId) continue;
      const trooper = this.ai.getTrooper(trooperId);
      if (trooper && trooper.state !== HarkonnenState.DEAD) {
        troopers.push(trooper);
      }
    }
    return troopers;
  }

  markTrooperDefeated(trooperId: string): void {
    const outpostId = this.trooperAssignments.get(trooperId);
    if (!outpostId) {
      return;
    }
    this.ai.removeTrooper(trooperId);
    this.trooperAssignments.delete(trooperId);
    this.backfillTimers.set(outpostId, this.now());
  }

  onOutpostFactionChange(outpostId: string, faction: 'harkonnen' | 'fremen'): void {
    if (faction === 'fremen') {
      for (const [trooperId, assigned] of Array.from(this.trooperAssignments.entries())) {
        if (assigned === outpostId) {
          this.ai.removeTrooper(trooperId);
          this.trooperAssignments.delete(trooperId);
        }
      }
      this.backfillTimers.delete(outpostId);
    } else {
      this.backfillTimers.set(outpostId, this.now());
    }
  }

  private cleanupAssignments(): void {
    for (const [trooperId, outpostId] of Array.from(this.trooperAssignments.entries())) {
      const trooper = this.ai.getTrooper(trooperId);
      if (!trooper) {
        this.trooperAssignments.delete(trooperId);
        this.backfillTimers.set(outpostId, this.now());
        continue;
      }

      if (trooper.state === HarkonnenState.DEAD) {
        this.trooperAssignments.delete(trooperId);
        this.backfillTimers.set(outpostId, this.now());
      }
    }
  }

  private ensureBackfill(outpostId: string, position: Vector3): void {
    const troopers = this.getTroopersForOutpost(outpostId);
    const outpost = this.outpostManager.getOutpost(outpostId);
    const isJammed = this.outpostManager.isJammed(outpostId);

    if (!outpost || outpost.controllingFaction !== 'harkonnen') {
      return;
    }

    if (isJammed) {
      return;
    }

    if (troopers.length >= VS4_CONSTANTS.OUTPOST_MIN_GARRISON) {
      return;
    }

    const lastBackfill = this.backfillTimers.get(outpostId) ?? 0;
    if (this.now() - lastBackfill < VS4_CONSTANTS.BOT_BACKFILL_DELAY * 1000) {
      return;
    }

    this.spawnTrooper(outpostId, position);
    this.backfillTimers.set(outpostId, this.now());
  }

  private spawnTrooper(outpostId: string, center: Vector3): void {
    const patrolPath = this.createPatrolPath(center);
    const spawnOffset = patrolPath[0] ?? center;
    const trooperId = `trooper-${++this.spawnCounter}`;
    const trooper = this.ai.spawnTrooper(trooperId, { ...spawnOffset }, patrolPath, outpostId);
    this.trooperAssignments.set(trooper.id, outpostId);
  }

  private createPatrolPath(center: Vector3): Vector3[] {
    const radius = VS4_CONSTANTS.OUTPOST_CAPTURE_RADIUS + 10;
    return [
      { x: center.x + radius, y: center.y, z: center.z },
      { x: center.x, y: center.y, z: center.z + radius },
      { x: center.x - radius, y: center.y, z: center.z },
      { x: center.x, y: center.y, z: center.z - radius },
    ];
  }
}
