import { Objective, ObjectiveType, ObjectiveStatus, Vector3 } from '@fremen/shared';
import { v4 as uuidv4 } from 'uuid';

export class ObjectiveManager {
  private activeObjective: Objective | null = null;

  spawnShepherdObjective(targetPosition: Vector3): Objective {
    const objective: Objective = {
      id: uuidv4(),
      type: ObjectiveType.SHEPHERD_WORM,
      targetPosition,
      radius: 20,
      timeLimit: 180000,
      expiresAt: Date.now() + 180000,
      status: ObjectiveStatus.ACTIVE,
    };

    this.activeObjective = objective;
    console.log(`Spawned shepherd objective at`, targetPosition);
    return objective;
  }

  spawnRandomObjective(): Objective {
    const angle = Math.random() * Math.PI * 2;
    const distance = 200 + Math.random() * 300;
    
    const targetPosition: Vector3 = {
      x: Math.cos(angle) * distance,
      y: 0,
      z: Math.sin(angle) * distance,
    };

    return this.spawnShepherdObjective(targetPosition);
  }

  checkObjectiveCompletion(wormPosition: Vector3): boolean {
    if (!this.activeObjective || this.activeObjective.status !== ObjectiveStatus.ACTIVE) {
      return false;
    }

    const dx = wormPosition.x - this.activeObjective.targetPosition.x;
    const dz = wormPosition.z - this.activeObjective.targetPosition.z;
    const distance = Math.sqrt(dx * dx + dz * dz);

    if (distance <= this.activeObjective.radius) {
      this.activeObjective.status = ObjectiveStatus.COMPLETED;
      console.log(`Objective ${this.activeObjective.id} completed!`);
      return true;
    }

    return false;
  }

  update() {
    if (this.activeObjective && this.activeObjective.status === ObjectiveStatus.ACTIVE) {
      if (Date.now() >= this.activeObjective.expiresAt) {
        this.activeObjective.status = ObjectiveStatus.FAILED;
        console.log(`Objective ${this.activeObjective.id} failed (timeout)`);
        
        setTimeout(() => {
          this.spawnRandomObjective();
        }, 5000);
      }
    }
  }

  getActiveObjective(): Objective | null {
    return this.activeObjective;
  }
}
