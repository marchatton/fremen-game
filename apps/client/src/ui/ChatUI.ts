export class ChatUI {
  private container: HTMLDivElement;
  private input: HTMLInputElement;
  private messages: HTMLDivElement;
  private isVisible = false;
  private onSendCallback?: (message: string) => void;

  constructor() {
    this.container = document.createElement('div');
    this.container.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 20px;
      width: 400px;
      display: none;
      flex-direction: column;
      gap: 10px;
      font-family: monospace;
      z-index: 1000;
    `;

    this.messages = document.createElement('div');
    this.messages.style.cssText = `
      background: rgba(0, 0, 0, 0.7);
      padding: 10px;
      border-radius: 5px;
      max-height: 200px;
      overflow-y: auto;
      color: white;
      font-size: 14px;
    `;

    this.input = document.createElement('input');
    this.input.type = 'text';
    this.input.placeholder = 'Type message... (Enter to send, Esc to close)';
    this.input.maxLength = 200;
    this.input.style.cssText = `
      padding: 8px;
      border: none;
      border-radius: 5px;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      font-size: 14px;
      outline: none;
    `;

    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && this.input.value.trim()) {
        if (this.onSendCallback) {
          this.onSendCallback(this.input.value.trim());
        }
        this.input.value = '';
        this.hide();
        e.preventDefault();
      } else if (e.key === 'Escape') {
        this.hide();
        e.preventDefault();
      }
    });

    this.container.appendChild(this.messages);
    this.container.appendChild(this.input);
    document.body.appendChild(this.container);

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !this.isVisible && document.pointerLockElement) {
        this.show();
        e.preventDefault();
      }
    });
  }

  show() {
    this.isVisible = true;
    this.container.style.display = 'flex';
    this.input.focus();
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
  }

  hide() {
    this.isVisible = false;
    this.container.style.display = 'none';
    this.input.blur();
  }

  addMessage(playerName: string, message: string) {
    const messageEl = document.createElement('div');
    messageEl.style.cssText = 'margin-bottom: 5px;';
    messageEl.innerHTML = `<span style="color: #4a90e2">${this.escapeHtml(playerName)}:</span> ${this.escapeHtml(message)}`;
    
    this.messages.appendChild(messageEl);
    this.messages.scrollTop = this.messages.scrollHeight;

    if (this.messages.children.length > 50) {
      this.messages.removeChild(this.messages.firstChild!);
    }
  }

  onSend(callback: (message: string) => void) {
    this.onSendCallback = callback;
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
