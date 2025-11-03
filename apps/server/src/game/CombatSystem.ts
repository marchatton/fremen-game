import { COMBAT_CONSTANTS, PlayerStateEnum } from '@fremen/shared';
import type { DamageSource } from '@fremen/shared';
import type { CombatEventMessage } from '@fremen/protocol';
import type { Room } from './Room';
import type { RoomPlayer } from './Room';
import type { GameSystem } from './SystemRegistry';
import type { DeathManager } from './DeathManager';
import type { Vector3 } from '@fremen/shared';

interface PlayerFirePayload {
  weaponId: string;
  targetId: string;
  damage?: number;
  origin?: Vector3;
}

interface CombatSystemOptions {
  deathManager?: DeathManager;
  onPersistenceSnapshot?(player: RoomPlayer): void;
}

export class CombatSystem implements GameSystem {
  private readonly listeners: Array<(event: CombatEventMessage) => void> = [];

  constructor(
    private readonly room: Room,
    private readonly options: CombatSystemOptions = {}
  ) {}

  onPlayerJoin(player: RoomPlayer): void {
    const maxHealth = this.getMaxHealth(player);
    player.health = Math.min(player.health ?? maxHealth, maxHealth);
  }

  onPlayerLeave(_playerId: string): void {
    // No-op for now; placeholder for future combat bookkeeping.
  }

  update(deltaTime: number): void {
    const players = this.room.getAllPlayers();

    for (const player of players) {
      if (player.state.state === PlayerStateEnum.DEAD) {
        continue;
      }

      // Skip regeneration while the player is critically dehydrated so
      // environmental damage from thirst can take effect.
      if (player.resources.water <= 10) {
        continue;
      }

      const maxHealth = this.getMaxHealth(player);
      if (player.health < maxHealth) {
        player.health = Math.min(
          maxHealth,
          player.health + COMBAT_CONSTANTS.PLAYER_REGEN_PER_SECOND * deltaTime
        );
      }
    }
  }

  onEvent(listener: (event: CombatEventMessage) => void): void {
    this.listeners.push(listener);
  }

  handlePlayerFire(attackerId: string, payload: PlayerFirePayload): boolean {
    const attacker = this.room.getPlayer(attackerId);
    const target = this.room.getPlayer(payload.targetId);

    if (!attacker || !target) {
      return false;
    }

    const damage = payload.damage ?? COMBAT_CONSTANTS.AI_BASE_DAMAGE;

    this.emit({
      type: 'fire',
      attackerId,
      weaponId: payload.weaponId,
      targetId: payload.targetId,
      origin: payload.origin,
    });

    this.applyDamage(target, damage, 'player', attackerId, payload.weaponId);
    return true;
  }

  handleAIFire(attackerId: string, targetId: string, damage = COMBAT_CONSTANTS.AI_BASE_DAMAGE): void {
    const target = this.room.getPlayer(targetId);
    if (!target) {
      return;
    }

    this.emit({
      type: 'fire',
      attackerId,
      weaponId: 'ai-hitscan',
      targetId,
    });

    this.applyDamage(target, damage, 'ai', attackerId, 'ai-hitscan');
  }

  applyDamageByEnvironment(targetId: string, amount: number): void {
    const target = this.room.getPlayer(targetId);
    if (!target) {
      return;
    }

    this.applyDamage(target, amount, 'environment');
  }

  private getMaxHealth(player: RoomPlayer): number {
    const base = COMBAT_CONSTANTS.PLAYER_MAX_HEALTH;
    const equipment = player.resources.equipment;
    let bonus = 0;

    for (const slot of ['head', 'body', 'feet'] as const) {
      const item = equipment[slot];
      if (item?.stats.healthBoost) {
        bonus += item.stats.healthBoost;
      }
    }

    return base + bonus;
  }

  private applyDamage(
    target: RoomPlayer,
    amount: number,
    source: DamageSource,
    attackerId?: string,
    weaponId?: string
  ): void {
    if (amount <= 0) {
      return;
    }

    const maxHealth = this.getMaxHealth(target);
    target.health = Math.max(0, target.health - amount);

    this.emit({
      type: 'damage',
      targetId: target.playerId,
      amount,
      remainingHealth: target.health,
      attackerId,
      source,
      weaponId,
    });

    if (target.health <= 0) {
      this.handleDeath(target, source, attackerId);
    } else {
      target.health = Math.min(target.health, maxHealth);
      this.options.onPersistenceSnapshot?.(target);
    }
  }

  private handleDeath(target: RoomPlayer, source: DamageSource, attackerId?: string): void {
    const deathPosition = { ...target.state.position };
    const deathManager = this.options.deathManager;

    if (deathManager) {
      const result = deathManager.processDeath(
        target.playerId,
        deathPosition,
        target.resources.spice,
        target.resources.stats
      );

      target.state.state = PlayerStateEnum.DEAD;
      target.resources.spice = result.spiceRemaining;
      target.resources.stats = result.newStats;
      target.state.position = { ...result.respawnPosition };
      target.resources.water = result.respawnWater;
      target.health = result.respawnHealth;
      target.state.state = PlayerStateEnum.ACTIVE;

      this.emit({
        type: 'death',
        targetId: target.playerId,
        attackerId,
        position: deathPosition,
        source,
      });

      this.emit({
        type: 'respawn',
        targetId: target.playerId,
        position: { ...result.respawnPosition },
        health: result.respawnHealth,
      });
    } else {
      target.health = this.getMaxHealth(target);
      this.emit({
        type: 'death',
        targetId: target.playerId,
        attackerId,
        position: deathPosition,
        source,
      });
    }

    this.options.onPersistenceSnapshot?.(target);
  }

  private emit(event: CombatEventMessage): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}
