import type { Vector3 } from '@fremen/shared';

interface InputSnapshot {
  seq: number;
  movement: { forward: number; right: number };
  rotation: number;
  timestamp: number;
  predictedPosition: Vector3;
}

export class PredictionManager {
  private inputHistory: InputSnapshot[] = [];
  private maxHistoryTime = 200;

  addInput(
    seq: number,
    movement: { forward: number; right: number },
    rotation: number,
    predictedPosition: Vector3
  ) {
    const timestamp = Date.now();
    
    this.inputHistory.push({
      seq,
      movement,
      rotation,
      timestamp,
      predictedPosition: { ...predictedPosition },
    });

    this.cleanOldInputs(timestamp);
  }

  private cleanOldInputs(currentTime: number) {
    this.inputHistory = this.inputHistory.filter(
      (input) => currentTime - input.timestamp <= this.maxHistoryTime
    );
  }

  reconcile(
    serverPosition: Vector3,
    lastProcessedSeq: number,
    currentPosition: Vector3,
    speed: number,
    deltaTime: number
  ): Vector3 {
    const unprocessed = this.inputHistory.filter((input) => input.seq > lastProcessedSeq);

    const error = Math.sqrt(
      (serverPosition.x - currentPosition.x) ** 2 +
      (serverPosition.y - currentPosition.y) ** 2 +
      (serverPosition.z - currentPosition.z) ** 2
    );

    if (error > 1) {
      console.warn(`Large position correction: ${error.toFixed(2)}m`);
    }

    if (error < 0.5) {
      return {
        x: currentPosition.x + (serverPosition.x - currentPosition.x) * 0.1,
        y: serverPosition.y,
        z: currentPosition.z + (serverPosition.z - currentPosition.z) * 0.1,
      };
    }

    let reconciledPosition = { ...serverPosition };

    for (const input of unprocessed) {
      const dx = input.movement.right * speed * deltaTime;
      const dz = -input.movement.forward * speed * deltaTime;

      const cos = Math.cos(input.rotation);
      const sin = Math.sin(input.rotation);
      
      reconciledPosition.x += dx * cos - dz * sin;
      reconciledPosition.z += dx * sin + dz * cos;
    }

    this.inputHistory = this.inputHistory.filter((input) => input.seq > lastProcessedSeq);

    return reconciledPosition;
  }
}
