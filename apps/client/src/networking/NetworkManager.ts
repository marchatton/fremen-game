import { io, Socket } from 'socket.io-client';
import type { S_WELCOME, S_STATE } from '@fremen/protocol';

export class NetworkManager {
  private socket: Socket | null = null;
  private serverUrl: string;
  private token: string | null = null;
  private inputSeq = 0;
  private connected = false;
  private onWelcomeCallback?: (data: S_WELCOME) => void;
  private onStateCallback?: (data: S_STATE) => void;

  constructor(serverUrl: string) {
    this.serverUrl = serverUrl;
  }

  async fetchToken(): Promise<string> {
    const response = await fetch(`${this.serverUrl}/auth/token`);
    const data = await response.json();
    return data.token;
  }

  async connect(): Promise<void> {
    if (this.connected) {
      console.warn('Already connected');
      return;
    }

    if (!this.token) {
      this.token = await this.fetchToken();
    }

    return new Promise((resolve, reject) => {
      this.socket = io(this.serverUrl, {
        auth: { token: this.token },
      });

      this.socket.on('connect', () => {
        this.connected = true;
        console.log('Connected to server');
        resolve();
      });

      this.socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        reject(error);
      });

      this.socket.on('welcome', (data: S_WELCOME) => {
        console.log('Received welcome:', data);
        if (this.onWelcomeCallback) {
          this.onWelcomeCallback(data);
        }
      });

      this.socket.on('state', (data: S_STATE) => {
        if (this.onStateCallback) {
          this.onStateCallback(data);
        }
      });

      this.socket.on('disconnect', () => {
        this.connected = false;
        console.log('Disconnected from server');
        this.attemptReconnect();
      });

      this.socket.on('error', (error) => {
        console.error('Server error:', error);
      });
    });
  }

  private attemptReconnect() {
    console.log('Attempting to reconnect...');
    setTimeout(() => {
      if (!this.connected) {
        this.connect().catch(console.error);
      }
    }, 2000);
  }

  sendInput(movement: { forward: number; right: number }, rotation: number, deployThumper = false): number {
    if (!this.socket || !this.connected) return this.inputSeq;

    this.inputSeq++;
    const inputMessage = {
      type: 'C_INPUT' as const,
      seq: this.inputSeq,
      timestamp: Date.now(),
      movement,
      rotation,
      action: deployThumper ? { type: 'deployThumper' as const } : undefined,
    };

    this.socket.emit('input', inputMessage);
    return this.inputSeq;
  }

  onWelcome(callback: (data: S_WELCOME) => void) {
    this.onWelcomeCallback = callback;
  }

  onState(callback: (data: S_STATE) => void) {
    this.onStateCallback = callback;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
    }
  }

  isConnected(): boolean {
    return this.connected;
  }
}
