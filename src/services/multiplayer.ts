import Peer from 'peerjs';
import type { DataConnection } from 'peerjs';
import type { InputState } from '../engine/GameEngine';
import type { CharacterData, MapData } from '../types/game';

// Message types for P2P communication
export type MultiplayerMessage =
  | { type: 'input'; frame: number; input: InputState }
  | { type: 'character-select'; character: CharacterData }
  | { type: 'map-select'; map: MapData }
  | { type: 'ready' }
  | { type: 'start-game' }
  | { type: 'ping'; timestamp: number }
  | { type: 'pong'; timestamp: number };

export type ConnectionStatus = 'disconnected' | 'connecting' | 'waiting' | 'connected' | 'error';

export interface MultiplayerCallbacks {
  onStatusChange: (status: ConnectionStatus) => void;
  onRemoteInput: (frame: number, input: InputState) => void;
  onRemoteCharacter: (character: CharacterData) => void;
  onRemoteMap: (map: MapData) => void;
  onRemoteReady: () => void;
  onGameStart: () => void;
  onError: (error: string) => void;
  onLatencyUpdate: (latency: number) => void;
}

// Generate a short room code
const generateRoomCode = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed ambiguous chars
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
};

export class MultiplayerService {
  private peer: Peer | null = null;
  private connection: DataConnection | null = null;
  private callbacks: MultiplayerCallbacks | null = null;
  private roomCode: string = '';
  private isHost: boolean = false;
  private pingInterval: ReturnType<typeof setInterval> | null = null;

  // Initialize callbacks
  setCallbacks(callbacks: MultiplayerCallbacks) {
    this.callbacks = callbacks;
  }

  // Create a room as host
  async createRoom(): Promise<string> {
    this.isHost = true;
    this.roomCode = generateRoomCode();

    return new Promise((resolve, reject) => {
      this.callbacks?.onStatusChange('connecting');

      // Create peer with room code as ID
      const peerId = `fighter-${this.roomCode}`;
      this.peer = new Peer(peerId, {
        debug: 1,
      });

      this.peer.on('open', () => {
        this.callbacks?.onStatusChange('waiting');
        resolve(this.roomCode);
      });

      this.peer.on('connection', (conn) => {
        this.connection = conn;
        this.setupConnection();
      });

      this.peer.on('error', (err) => {
        console.error('Peer error:', err);
        this.callbacks?.onError(err.message || 'Connection error');
        this.callbacks?.onStatusChange('error');
        reject(err);
      });

      this.peer.on('disconnected', () => {
        this.callbacks?.onStatusChange('disconnected');
      });
    });
  }

  // Join a room as guest
  async joinRoom(code: string): Promise<void> {
    this.isHost = false;
    this.roomCode = code.toUpperCase();

    return new Promise((resolve, reject) => {
      this.callbacks?.onStatusChange('connecting');

      // Create peer with random ID
      this.peer = new Peer({
        debug: 1,
      });

      this.peer.on('open', () => {
        // Connect to host
        const hostId = `fighter-${this.roomCode}`;
        this.connection = this.peer!.connect(hostId, {
          reliable: true,
        });

        this.connection.on('open', () => {
          this.setupConnection();
          resolve();
        });

        this.connection.on('error', (err) => {
          console.error('Connection error:', err);
          this.callbacks?.onError('Failed to connect to room');
          this.callbacks?.onStatusChange('error');
          reject(err);
        });
      });

      this.peer.on('error', (err) => {
        console.error('Peer error:', err);
        if (err.type === 'peer-unavailable') {
          this.callbacks?.onError('Room not found');
        } else {
          this.callbacks?.onError(err.message || 'Connection error');
        }
        this.callbacks?.onStatusChange('error');
        reject(err);
      });

      // Timeout for connection
      setTimeout(() => {
        if (!this.connection?.open) {
          this.callbacks?.onError('Connection timeout');
          this.callbacks?.onStatusChange('error');
          reject(new Error('Connection timeout'));
        }
      }, 10000);
    });
  }

  private setupConnection() {
    if (!this.connection) return;

    this.connection.on('open', () => {
      this.callbacks?.onStatusChange('connected');
      this.startPingPong();
    });

    this.connection.on('data', (data) => {
      this.handleMessage(data as MultiplayerMessage);
    });

    this.connection.on('close', () => {
      this.callbacks?.onStatusChange('disconnected');
      this.stopPingPong();
    });

    this.connection.on('error', (err) => {
      console.error('Connection error:', err);
      this.callbacks?.onError('Connection lost');
      this.callbacks?.onStatusChange('error');
    });

    // If already open (host side), trigger connected
    if (this.connection.open) {
      this.callbacks?.onStatusChange('connected');
      this.startPingPong();
    }
  }

  private handleMessage(message: MultiplayerMessage) {
    switch (message.type) {
      case 'input':
        this.callbacks?.onRemoteInput(message.frame, message.input);
        break;
      case 'character-select':
        this.callbacks?.onRemoteCharacter(message.character);
        break;
      case 'map-select':
        this.callbacks?.onRemoteMap(message.map);
        break;
      case 'ready':
        this.callbacks?.onRemoteReady();
        break;
      case 'start-game':
        this.callbacks?.onGameStart();
        break;
      case 'ping':
        this.send({ type: 'pong', timestamp: message.timestamp });
        break;
      case 'pong':
        const latency = Date.now() - message.timestamp;
        this.callbacks?.onLatencyUpdate(latency);
        break;
    }
  }

  private startPingPong() {
    this.pingInterval = setInterval(() => {
      this.send({ type: 'ping', timestamp: Date.now() });
    }, 2000);
  }

  private stopPingPong() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  // Send a message to the remote peer
  send(message: MultiplayerMessage) {
    if (this.connection?.open) {
      this.connection.send(message);
    }
  }

  // Send input state
  sendInput(frame: number, input: InputState) {
    this.send({ type: 'input', frame, input });
  }

  // Send character selection
  sendCharacter(character: CharacterData) {
    this.send({ type: 'character-select', character });
  }

  // Send map selection
  sendMap(map: MapData) {
    this.send({ type: 'map-select', map });
  }

  // Send ready status
  sendReady() {
    this.send({ type: 'ready' });
  }

  // Send game start (host only)
  sendGameStart() {
    if (this.isHost) {
      this.send({ type: 'start-game' });
    }
  }

  // Getters
  getRoomCode(): string {
    return this.roomCode;
  }

  getIsHost(): boolean {
    return this.isHost;
  }

  isConnected(): boolean {
    return this.connection?.open ?? false;
  }

  // Disconnect and cleanup
  disconnect() {
    this.stopPingPong();

    if (this.connection) {
      this.connection.close();
      this.connection = null;
    }

    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }

    this.roomCode = '';
    this.isHost = false;
    this.callbacks?.onStatusChange('disconnected');
  }
}

// Singleton instance
export const multiplayerService = new MultiplayerService();
