export class RidingHUD {
  private container: HTMLDivElement;
  private speedometer: HTMLDivElement;
  private healthBar: HTMLDivElement;
  private healthFill: HTMLDivElement;

  constructor() {
    this.container = document.createElement('div');
    this.container.style.cssText = `
      position: fixed;
      bottom: 40px;
      left: 50%;
      transform: translateX(-50%);
      display: none;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      font-family: monospace;
      z-index: 1000;
    `;

    this.speedometer = document.createElement('div');
    this.speedometer.style.cssText = `
      background: rgba(0, 0, 0, 0.8);
      color: #00ff00;
      padding: 10px 20px;
      border-radius: 8px;
      font-size: 24px;
      font-weight: bold;
      border: 2px solid #00ff00;
      min-width: 150px;
      text-align: center;
    `;

    this.healthBar = document.createElement('div');
    this.healthBar.style.cssText = `
      background: rgba(0, 0, 0, 0.8);
      width: 300px;
      height: 20px;
      border-radius: 10px;
      border: 2px solid #666;
      overflow: hidden;
    `;

    this.healthFill = document.createElement('div');
    this.healthFill.style.cssText = `
      background: linear-gradient(90deg, #ff4444, #ff8844);
      height: 100%;
      width: 100%;
      transition: width 0.3s ease;
    `;

    this.healthBar.appendChild(this.healthFill);
    this.container.appendChild(this.speedometer);
    this.container.appendChild(this.healthBar);
    document.body.appendChild(this.container);
  }

  show() {
    this.container.style.display = 'flex';
  }

  hide() {
    this.container.style.display = 'none';
  }

  updateSpeed(speed: number) {
    this.speedometer.textContent = `${Math.round(speed)} m/s`;
    
    const intensity = Math.min(speed / 25, 1);
    const r = Math.floor(intensity * 255);
    const g = Math.floor((1 - intensity) * 255);
    this.speedometer.style.color = `rgb(${r}, ${g}, 0)`;
    this.speedometer.style.borderColor = `rgb(${r}, ${g}, 0)`;
  }

  updateHealth(health: number, maxHealth: number) {
    const percent = (health / maxHealth) * 100;
    this.healthFill.style.width = `${percent}%`;
    
    if (percent < 30) {
      this.healthFill.style.background = 'linear-gradient(90deg, #ff0000, #ff4444)';
    } else if (percent < 60) {
      this.healthFill.style.background = 'linear-gradient(90deg, #ff4444, #ff8844)';
    } else {
      this.healthFill.style.background = 'linear-gradient(90deg, #44ff44, #88ff44)';
    }
  }
}
