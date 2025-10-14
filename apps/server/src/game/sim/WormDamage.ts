import type { Vector3, WormState } from '@fremen/shared';
import { TerrainGenerator, GAME_CONSTANTS } from '@fremen/shared';

export class WormDamage {
  private terrainGenerator: TerrainGenerator;
  private lastDamagePositions: Map<string, Vector3> = new Map();

  constructor(seed: number) {
    this.terrainGenerator = new TerrainGenerator({ seed });
  }

  checkTerrainDamage(worm: WormState): number {
    if (worm.controlPoints.length === 0) return 0;

    const head = worm.controlPoints[0];
    const terrainHeight = this.terrainGenerator.getHeight(head.x, head.z);
    
    const lastDamage = this.lastDamagePositions.get(worm.id);
    if (lastDamage) {
      const dist = Math.sqrt(
        (head.x - lastDamage.x) ** 2 +
        (head.z - lastDamage.z) ** 2
      );
      
      if (dist < 10) {
        return 0;
      }
    }

    const heightDiff = Math.abs(terrainHeight - head.y);
    if (heightDiff > 5) {
      const damage = 50;
      this.lastDamagePositions.set(worm.id, { ...head });
      console.log(`Worm ${worm.id} hit obstacle: ${damage} damage`);
      return damage;
    }

    return 0;
  }

  applyDamage(worm: WormState, damage: number): boolean {
    worm.health -= damage;
    
    if (worm.health <= 0) {
      worm.health = 0;
      console.log(`Worm ${worm.id} died!`);
      return true;
    }
    
    return false;
  }
}
