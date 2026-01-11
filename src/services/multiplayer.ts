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

  // Create a room as host with retry logic
  async createRoom(retryCount = 0): Promise<string> {
    const MAX_RETRIES = 3;
    this.isHost = true;
    this.roomCode = generateRoomCode();

    return new Promise((resolve, reject) => {
      this.callbacks?.onStatusChange('connecting');

      // Create peer with room code as ID
      const peerId = `fighter-${this.roomCode}`;

      // Use multiple PeerJS servers for reliability
      const peerConfig = {
        debug: 1,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
          ]
        }
      };

      this.peer = new Peer(peerId, peerConfig);

      // Timeout for connection
      const timeout = setTimeout(() => {
        if (this.peer && !this.peer.open) {
          this.peer.destroy();
          if (retryCount < MAX_RETRIES) {
            console.log(`Retrying connection (${retryCount + 1}/${MAX_RETRIES})...`);
            this.roomCode = generateRoomCode(); // Generate new code for retry
            this.createRoom(retryCount + 1).then(resolve).catch(reject);
          } else {
            this.callbacks?.onError('Could not connect to server. Please try again.');
            this.callbacks?.onStatusChange('error');
            reject(new Error('Connection timeout after retries'));
          }
        }
      }, 10000);

      this.peer.on('open', () => {
        clearTimeout(timeout);
        this.callbacks?.onStatusChange('waiting');
        resolve(this.roomCode);
      });

      this.peer.on('connection', (conn) => {
        this.connection = conn;
        this.setupConnection();
      });

      this.peer.on('error', (err) => {
        clearTimeout(timeout);
        console.error('Peer error:', err);

        // Retry on certain errors
        if (retryCount < MAX_RETRIES && (err.type === 'network' || err.type === 'server-error' || err.type === 'socket-error')) {
          console.log(`Retrying after error (${retryCount + 1}/${MAX_RETRIES})...`);
          this.roomCode = generateRoomCode();
          setTimeout(() => {
            this.createRoom(retryCount + 1).then(resolve).catch(reject);
          }, 1000);
        } else {
          this.callbacks?.onError(err.message || 'Connection error');
          this.callbacks?.onStatusChange('error');
          reject(err);
        }
      });

      this.peer.on('disconnected', () => {
        // Try to reconnect
        if (this.peer && !this.peer.destroyed) {
          this.peer.reconnect();
        } else {
          this.callbacks?.onStatusChange('disconnected');
        }
      });
    });
  }

  // Join a room as guest with retry logic
  async joinRoom(code: string, retryCount = 0): Promise<void> {
    const MAX_RETRIES = 3;
    this.isHost = false;
    this.roomCode = code.toUpperCase();

    return new Promise((resolve, reject) => {
      this.callbacks?.onStatusChange('connecting');

      // Use same config for reliability
      const peerConfig = {
        debug: 1,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
          ]
        }
      };

      // Create peer with random ID
      this.peer = new Peer(peerConfig);

      let connectionTimeout: ReturnType<typeof setTimeout>;

      this.peer.on('open', () => {
        // Connect to host
        const hostId = `fighter-${this.roomCode}`;
        this.connection = this.peer!.connect(hostId, {
          reliable: true,
        });

        connectionTimeout = setTimeout(() => {
          if (!this.connection?.open) {
            if (retryCount < MAX_RETRIES) {
              console.log(`Retrying join (${retryCount + 1}/${MAX_RETRIES})...`);
              this.peer?.destroy();
              setTimeout(() => {
                this.joinRoom(code, retryCount + 1).then(resolve).catch(reject);
              }, 1000);
            } else {
              this.callbacks?.onError('Connection timeout. Make sure the room code is correct.');
              this.callbacks?.onStatusChange('error');
              reject(new Error('Connection timeout'));
            }
          }
        }, 10000);

        this.connection.on('open', () => {
          clearTimeout(connectionTimeout);
          this.setupConnection();
          resolve();
        });

        this.connection.on('error', (err) => {
          clearTimeout(connectionTimeout);
          console.error('Connection error:', err);
          this.callbacks?.onError('Failed to connect to room');
          this.callbacks?.onStatusChange('error');
          reject(err);
        });
      });

      this.peer.on('error', (err) => {
        console.error('Peer error:', err);
        if (err.type === 'peer-unavailable') {
          this.callbacks?.onError('Room not found. Check the code and try again.');
        } else if (retryCount < MAX_RETRIES && (err.type === 'network' || err.type === 'server-error' || err.type === 'socket-error')) {
          console.log(`Retrying after error (${retryCount + 1}/${MAX_RETRIES})...`);
          setTimeout(() => {
            this.joinRoom(code, retryCount + 1).then(resolve).catch(reject);
          }, 1000);
          return;
        } else {
          this.callbacks?.onError(err.message || 'Connection error');
        }
        this.callbacks?.onStatusChange('error');
        reject(err);
      });

      this.peer.on('disconnected', () => {
        if (this.peer && !this.peer.destroyed) {
          this.peer.reconnect();
        }
      });
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
