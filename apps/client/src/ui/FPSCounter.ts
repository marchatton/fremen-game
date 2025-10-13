export class FPSCounter {
  private element: HTMLDivElement;
  private frames = 0;
  private lastTime = performance.now();
  private fps = 0;

  constructor() {
    this.element = document.createElement('div');
    this.element.style.position = 'fixed';
    this.element.style.top = '10px';
    this.element.style.left = '10px';
    this.element.style.color = '#00ff00';
    this.element.style.fontFamily = 'monospace';
    this.element.style.fontSize = '16px';
    this.element.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    this.element.style.padding = '5px 10px';
    this.element.style.borderRadius = '3px';
    this.element.style.zIndex = '1000';
    this.element.textContent = 'FPS: 0';
    document.body.appendChild(this.element);
  }

  update() {
    this.frames++;
    const currentTime = performance.now();
    const delta = currentTime - this.lastTime;

    if (delta >= 1000) {
      this.fps = Math.round((this.frames * 1000) / delta);
      this.element.textContent = `FPS: ${this.fps}`;
      this.frames = 0;
      this.lastTime = currentTime;
    }
  }

  getFPS(): number {
    return this.fps;
  }

  destroy() {
    this.element.remove();
  }
}
