import { TerrainGenerator, GAME_CONSTANTS } from '@fremen/shared';
import type { Vector3 } from '@fremen/shared';

export class Physics {
  private terrainGenerator: TerrainGenerator;

  constructor(seed: number) {
    this.terrainGenerator = new TerrainGenerator({ seed });
  }

  validatePlayerPosition(position: Vector3, velocity: Vector3, deltaTime: number): Vector3 {
    const newPosition = {
      x: position.x + velocity.x * deltaTime,
      y: position.y + velocity.y * deltaTime,
      z: position.z + velocity.z * deltaTime,
    };

    const terrainHeight = this.terrainGenerator.getHeight(newPosition.x, newPosition.z);
    newPosition.y = Math.max(newPosition.y, terrainHeight + 1);

    return newPosition;
  }

  validatePlayerSpeed(velocity: Vector3): boolean {
    const speed = Math.sqrt(velocity.x ** 2 + velocity.y ** 2 + velocity.z ** 2);
    return speed <= GAME_CONSTANTS.PLAYER_MAX_SPEED * 1.1;
  }

  clampVelocity(velocity: Vector3): Vector3 {
    const speed = Math.sqrt(velocity.x ** 2 + velocity.y ** 2 + velocity.z ** 2);
    if (speed > GAME_CONSTANTS.PLAYER_MAX_SPEED) {
      const scale = GAME_CONSTANTS.PLAYER_MAX_SPEED / speed;
      return {
        x: velocity.x * scale,
        y: velocity.y * scale,
        z: velocity.z * scale,
      };
    }
    return velocity;
  }

  getTerrainHeight(x: number, z: number): number {
    return this.terrainGenerator.getHeight(x, z);
  }
}
