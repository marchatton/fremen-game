import type { Vector3 } from '@fremen/shared';

export enum WeaponType {
  PLAYER_RIFLE = 'PLAYER_RIFLE',
  HARKONNEN_RIFLE = 'HARKONNEN_RIFLE',
}

export interface WeaponStats {
  damage: number;
  fireRate: number; // milliseconds between shots
  range: number; // meters
  accuracy: number; // 0-1, chance to hit at max range
}

export interface ShootResult {
  hit: boolean;
  damage: number;
  distance: number;
  targetId?: string;
  targetType?: 'player' | 'thumper'; // VS4: Thumper jamming support
}

export interface DamageResult {
  targetId: string;
  damageTaken: number;
  healthRemaining: number;
  killed: boolean;
}

/**
 * VS4: Combat System
 *
 * Handles shooting mechanics, hit detection, and damage calculation
 * for both players and Harkonnen troopers.
 */
export class CombatSystem {
  // Weapon configurations
  private readonly WEAPONS: Record<WeaponType, WeaponStats> = {
    [WeaponType.PLAYER_RIFLE]: {
      damage: 25,
      fireRate: 500, // 2 shots per second
      range: 100,
      accuracy: 0.9, // 90% accuracy at max range
    },
    [WeaponType.HARKONNEN_RIFLE]: {
      damage: 20,
      fireRate: 1000, // 1 shot per second
      range: 80,
      accuracy: 0.85, // 85% accuracy at max range
    },
  };

  /**
   * Get weapon stats
   */
  getWeaponStats(weaponType: WeaponType): WeaponStats {
    return { ...this.WEAPONS[weaponType] };
  }

  /**
   * Calculate hit chance based on distance and accuracy
   */
  calculateHitChance(distance: number, weaponRange: number, baseAccuracy: number): number {
    if (distance > weaponRange) {
      return 0; // Out of range
    }

    // Linear falloff: 100% at close range, baseAccuracy at max range
    const rangeFactor = distance / weaponRange;
    const hitChance = 1 - (rangeFactor * (1 - baseAccuracy));

    return Math.max(0, Math.min(1, hitChance));
  }

  /**
   * Check if shot hits target
   */
  checkHit(
    shooterPos: Vector3,
    targetPos: Vector3,
    weaponType: WeaponType,
    hasLineOfSight: boolean = true
  ): ShootResult {
    const weapon = this.WEAPONS[weaponType];
    const distance = this.calculateDistance(shooterPos, targetPos);

    // Check range
    if (distance > weapon.range) {
      return {
        hit: false,
        damage: 0,
        distance,
      };
    }

    // Check line of sight
    if (!hasLineOfSight) {
      return {
        hit: false,
        damage: 0,
        distance,
      };
    }

    // Calculate hit chance
    const hitChance = this.calculateHitChance(distance, weapon.range, weapon.accuracy);
    const hit = Math.random() < hitChance;

    return {
      hit,
      damage: hit ? weapon.damage : 0,
      distance,
    };
  }

  /**
   * Process player shooting at target
   */
  playerShoot(
    shooterPos: Vector3,
    targetPos: Vector3,
    targetId: string,
    hasLineOfSight: boolean = true
  ): ShootResult {
    const result = this.checkHit(
      shooterPos,
      targetPos,
      WeaponType.PLAYER_RIFLE,
      hasLineOfSight
    );

    return {
      ...result,
      targetId: result.hit ? targetId : undefined,
    };
  }

  /**
   * Process Harkonnen shooting at player
   */
  harkonnenShoot(
    shooterPos: Vector3,
    targetPos: Vector3,
    targetId: string,
    hasLineOfSight: boolean = true
  ): ShootResult {
    const result = this.checkHit(
      shooterPos,
      targetPos,
      WeaponType.HARKONNEN_RIFLE,
      hasLineOfSight
    );

    return {
      ...result,
      targetId: result.hit ? targetId : undefined,
    };
  }

  /**
   * Calculate damage with potential modifiers
   */
  calculateDamage(baseDamage: number, damageModifier: number = 1.0): number {
    return Math.max(0, Math.floor(baseDamage * damageModifier));
  }

  /**
   * Apply damage to target
   */
  applyDamage(currentHealth: number, damage: number, targetId: string): DamageResult {
    const damageTaken = Math.min(damage, currentHealth);
    const healthRemaining = Math.max(0, currentHealth - damage);
    const killed = healthRemaining <= 0;

    return {
      targetId,
      damageTaken,
      healthRemaining,
      killed,
    };
  }

  /**
   * Check if shooter can fire (based on fire rate cooldown)
   */
  canFire(weaponType: WeaponType, lastFireTime: number, currentTime: number): boolean {
    const weapon = this.WEAPONS[weaponType];
    return currentTime - lastFireTime >= weapon.fireRate;
  }

  /**
   * Calculate 3D distance between two positions
   */
  private calculateDistance(pos1: Vector3, pos2: Vector3): number {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    const dz = pos1.z - pos2.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /**
   * Simple line of sight check (stub for terrain collision)
   */
  hasLineOfSight(from: Vector3, to: Vector3): boolean {
    // TODO: Implement proper raycast with terrain collision
    // For now, always return true (same as HarkonnenAI)
    return true;
  }

  /**
   * Get direction vector from shooter to target
   */
  getShootDirection(from: Vector3, to: Vector3): Vector3 {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dz = to.z - from.z;
    const length = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (length === 0) {
      return { x: 0, y: 0, z: 0 };
    }

    return {
      x: dx / length,
      y: dy / length,
      z: dz / length,
    };
  }
}
