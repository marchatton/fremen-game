export class InteractionPrompt {
  private element: HTMLDivElement;
  private visible = false;

  constructor() {
    this.element = document.createElement('div');
    this.element.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 15px 30px;
      border-radius: 8px;
      font-family: monospace;
      font-size: 18px;
      font-weight: bold;
      display: none;
      z-index: 999;
      border: 2px solid #4a90e2;
    `;
    document.body.appendChild(this.element);
  }

  show(message: string) {
    this.element.textContent = message;
    this.element.style.display = 'block';
    this.visible = true;
  }

  hide() {
    this.element.style.display = 'none';
    this.visible = false;
  }

  isVisible(): boolean {
    return this.visible;
  }
}
