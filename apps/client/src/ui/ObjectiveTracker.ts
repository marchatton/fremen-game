import type { Vector3 } from '@fremen/shared';

export class ObjectiveTracker {
  private container: HTMLDivElement;
  private title: HTMLDivElement;
  private distance: HTMLDivElement;
  private timer: HTMLDivElement;

  constructor() {
    this.container = document.createElement('div');
    this.container.style.cssText = `
      position: fixed;
      top: 80px;
      right: 20px;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 15px;
      border-radius: 8px;
      font-family: monospace;
      font-size: 14px;
      min-width: 250px;
      display: none;
      z-index: 1000;
      border-left: 4px solid #4a90e2;
    `;

    this.title = document.createElement('div');
    this.title.style.cssText = 'font-weight: bold; margin-bottom: 10px; color: #4a90e2;';
    
    this.distance = document.createElement('div');
    this.distance.style.cssText = 'margin-bottom: 5px;';
    
    this.timer = document.createElement('div');
    this.timer.style.cssText = 'color: #ffaa00;';

    this.container.appendChild(this.title);
    this.container.appendChild(this.distance);
    this.container.appendChild(this.timer);
    document.body.appendChild(this.container);
  }

  update(objective: any, playerPosition: Vector3) {
    if (!objective || objective.status !== 'ACTIVE') {
      this.container.style.display = 'none';
      return;
    }

    this.container.style.display = 'block';
    this.title.textContent = 'Objective: Shepherd Worm to Marker';

    const dx = objective.targetPosition.x - playerPosition.x;
    const dz = objective.targetPosition.z - playerPosition.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    this.distance.textContent = `Distance: ${Math.round(dist)}m`;

    const timeSeconds = Math.ceil(objective.timeRemaining / 1000);
    const minutes = Math.floor(timeSeconds / 60);
    const seconds = timeSeconds % 60;
    this.timer.textContent = `Time: ${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  showCompletion() {
    this.container.style.display = 'block';
    this.container.style.borderColor = '#00ff00';
    this.title.textContent = '✓ Objective Complete!';
    this.title.style.color = '#00ff00';
    this.distance.textContent = '';
    this.timer.textContent = '';

    setTimeout(() => {
      this.container.style.display = 'none';
      this.container.style.borderColor = '#4a90e2';
      this.title.style.color = '#4a90e2';
    }, 5000);
  }
}
