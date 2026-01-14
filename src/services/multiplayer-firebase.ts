import { database, ref, set, onValue, remove, push, onChildAdded } from './firebase';
import type { InputState } from '../engine/GameEngine';
import type { CharacterData, MapData } from '../types/game';

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
  onGameStateSync?: (state: unknown) => void; // For receiving game state from host
}

// Generate a short room code
const generateRoomCode = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
};

export class MultiplayerFirebaseService {
  private roomCode: string = '';
  private isHost: boolean = false;
  private callbacks: MultiplayerCallbacks | null = null;
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private unsubscribers: (() => void)[] = [];
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private pendingCandidates: RTCIceCandidateInit[] = []; // Queue for ICE candidates
  private remoteDescriptionSet: boolean = false;

  private readonly rtcConfig: RTCConfiguration = {
    iceServers: [
      // STUN servers (for discovering public IP)
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      // Free TURN servers from Open Relay Project (relay traffic when direct fails)
      {
        urls: 'turn:openrelay.metered.ca:80',
        username: 'openrelayproject',
        credential: 'openrelayproject',
      },
      {
        urls: 'turn:openrelay.metered.ca:443',
        username: 'openrelayproject',
        credential: 'openrelayproject',
      },
      {
        urls: 'turn:openrelay.metered.ca:443?transport=tcp',
        username: 'openrelayproject',
        credential: 'openrelayproject',
      },
    ],
    iceCandidatePoolSize: 10,
  };

  setCallbacks(callbacks: MultiplayerCallbacks) {
    this.callbacks = callbacks;
  }

  async createRoom(existingCode?: string): Promise<string> {
    this.isHost = true;
    this.roomCode = existingCode || generateRoomCode();
    this.pendingCandidates = [];
    this.remoteDescriptionSet = false;

    try {
      this.callbacks?.onStatusChange('connecting');

      // Create the room in Firebase
      const roomRef = ref(database, `rooms/${this.roomCode}`);
      await set(roomRef, {
        created: Date.now(),
        host: true,
      });

      // Set up WebRTC
      this.peerConnection = new RTCPeerConnection(this.rtcConfig);

      // Track connection state
      this.peerConnection.onconnectionstatechange = () => {
        console.log('Connection state:', this.peerConnection?.connectionState);
        if (this.peerConnection?.connectionState === 'connected') {
          this.callbacks?.onStatusChange('connected');
        } else if (this.peerConnection?.connectionState === 'failed') {
          this.callbacks?.onError('Connection failed');
          this.callbacks?.onStatusChange('error');
        }
      };

      this.peerConnection.oniceconnectionstatechange = () => {
        console.log('ICE connection state:', this.peerConnection?.iceConnectionState);
      };

      // Create data channel for game input
      this.dataChannel = this.peerConnection.createDataChannel('gameInput', {
        ordered: true, // Ensure order for reliability
      });
      this.setupDataChannel();

      // Collect all ICE candidates first, then send
      const iceCandidates: RTCIceCandidateInit[] = [];

      this.peerConnection.onicecandidate = async (event) => {
        if (event.candidate) {
          console.log('Host ICE candidate:', event.candidate.candidate);
          iceCandidates.push(event.candidate.toJSON());
          // Send immediately
          const candidatesRef = ref(database, `rooms/${this.roomCode}/hostCandidates`);
          await push(candidatesRef, event.candidate.toJSON());
        }
      };

      this.peerConnection.onicegatheringstatechange = () => {
        console.log('ICE gathering state:', this.peerConnection?.iceGatheringState);
      };

      // Create offer
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);

      // Store offer in Firebase
      await set(ref(database, `rooms/${this.roomCode}/offer`), {
        type: offer.type,
        sdp: offer.sdp,
      });

      this.callbacks?.onStatusChange('waiting');

      // Listen for answer
      const answerRef = ref(database, `rooms/${this.roomCode}/answer`);
      const unsubAnswer = onValue(answerRef, async (snapshot) => {
        const answer = snapshot.val();
        if (answer && this.peerConnection) {
          const signalingState = this.peerConnection.signalingState;
          console.log('Received answer, signaling state:', signalingState);
          if (signalingState === 'have-local-offer') {
            try {
              await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
              console.log('Remote description set successfully');
              this.remoteDescriptionSet = true;

              // Process any pending ICE candidates
              console.log(`Processing ${this.pendingCandidates.length} pending ICE candidates`);
              for (const candidate of this.pendingCandidates) {
                try {
                  await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
                  console.log('Added pending ICE candidate');
                } catch (e) {
                  console.error('Error adding pending ICE candidate:', e);
                }
              }
              this.pendingCandidates = [];
            } catch (e) {
              console.error('Error setting remote description:', e);
            }
          }
        }
      });
      this.unsubscribers.push(() => unsubAnswer());

      // Listen for guest ICE candidates
      const guestCandidatesRef = ref(database, `rooms/${this.roomCode}/guestCandidates`);
      const unsubCandidates = onChildAdded(guestCandidatesRef, async (snapshot) => {
        const candidate = snapshot.val();
        if (candidate && this.peerConnection) {
          // Queue candidates if remote description not set yet
          if (!this.remoteDescriptionSet) {
            console.log('Queueing ICE candidate (remote description not set)');
            this.pendingCandidates.push(candidate);
            return;
          }
          try {
            await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
            console.log('Added ICE candidate directly');
          } catch (e) {
            console.error('Error adding ICE candidate:', e);
          }
        }
      });
      this.unsubscribers.push(() => unsubCandidates());

      // Listen for guest data (character, ready status)
      this.listenForGuestData();

      return this.roomCode;
    } catch (error) {
      console.error('Error creating room:', error);
      this.callbacks?.onError('Failed to create room');
      this.callbacks?.onStatusChange('error');
      throw error;
    }
  }

  async joinRoom(code: string): Promise<void> {
    this.isHost = false;
    this.roomCode = code.toUpperCase();
    this.pendingCandidates = [];
    this.remoteDescriptionSet = false;

    try {
      this.callbacks?.onStatusChange('connecting');

      // Check if room exists
      const roomRef = ref(database, `rooms/${this.roomCode}`);

      return new Promise((resolve, reject) => {
        const unsubRoom = onValue(roomRef, async (snapshot) => {
          const room = snapshot.val();

          if (!room) {
            unsubRoom();
            this.callbacks?.onError('Room not found');
            this.callbacks?.onStatusChange('error');
            reject(new Error('Room not found'));
            return;
          }

          if (!room.offer) {
            // Wait for offer
            return;
          }

          // Only process once
          unsubRoom();

          try {
            // Set up WebRTC
            this.peerConnection = new RTCPeerConnection(this.rtcConfig);

            // Track connection state
            this.peerConnection.onconnectionstatechange = () => {
              console.log('Guest connection state:', this.peerConnection?.connectionState);
              if (this.peerConnection?.connectionState === 'connected') {
                this.callbacks?.onStatusChange('connected');
              } else if (this.peerConnection?.connectionState === 'failed') {
                this.callbacks?.onError('Connection failed');
                this.callbacks?.onStatusChange('error');
              }
            };

            this.peerConnection.oniceconnectionstatechange = () => {
              console.log('Guest ICE connection state:', this.peerConnection?.iceConnectionState);
            };

            // Handle incoming data channel
            this.peerConnection.ondatachannel = (event) => {
              console.log('Received data channel');
              this.dataChannel = event.channel;
              this.setupDataChannel();
            };

            // Handle ICE candidates
            this.peerConnection.onicecandidate = async (event) => {
              if (event.candidate) {
                console.log('Guest ICE candidate:', event.candidate.candidate);
                const candidatesRef = ref(database, `rooms/${this.roomCode}/guestCandidates`);
                await push(candidatesRef, event.candidate.toJSON());
              }
            };

            // Set remote description (offer)
            await this.peerConnection.setRemoteDescription(
              new RTCSessionDescription(room.offer)
            );
            this.remoteDescriptionSet = true;
            console.log('Guest: Remote description set');

            // Create answer
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);

            // Store answer in Firebase
            await set(ref(database, `rooms/${this.roomCode}/answer`), {
              type: answer.type,
              sdp: answer.sdp,
            });

            // Listen for host ICE candidates
            const hostCandidatesRef = ref(database, `rooms/${this.roomCode}/hostCandidates`);
            const unsubCandidates = onChildAdded(hostCandidatesRef, async (snapshot) => {
              const candidate = snapshot.val();
              if (candidate && this.peerConnection) {
                try {
                  await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
                } catch (e) {
                  console.error('Error adding ICE candidate:', e);
                }
              }
            });
            this.unsubscribers.push(() => unsubCandidates());

            // Listen for host data
            this.listenForHostData();

            resolve();
          } catch (error) {
            console.error('Error joining room:', error);
            this.callbacks?.onError('Failed to join room');
            this.callbacks?.onStatusChange('error');
            reject(error);
          }
        }, (error) => {
          console.error('Firebase error:', error);
          this.callbacks?.onError('Connection error');
          this.callbacks?.onStatusChange('error');
          reject(error);
        });

        this.unsubscribers.push(() => unsubRoom());

        // Timeout
        setTimeout(() => {
          if (this.callbacks) {
            // Still connecting after timeout
          }
        }, 15000);
      });
    } catch (error) {
      console.error('Error joining room:', error);
      this.callbacks?.onError('Failed to join room');
      this.callbacks?.onStatusChange('error');
      throw error;
    }
  }

  private setupDataChannel() {
    if (!this.dataChannel) return;

    console.log('Setting up data channel, current state:', this.dataChannel.readyState);

    this.dataChannel.onopen = () => {
      console.log('Data channel opened!');
      this.callbacks?.onStatusChange('connected');
      this.startPingPong();
    };

    this.dataChannel.onclose = () => {
      console.log('Data channel closed');
      // Only report disconnection if we were previously connected
      if (this.peerConnection?.connectionState !== 'connected') {
        this.callbacks?.onStatusChange('disconnected');
      }
      this.stopPingPong();
    };

    this.dataChannel.onerror = (event) => {
      console.error('Data channel error:', event);
    };

    this.dataChannel.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this.handleMessage(message);
      } catch (e) {
        console.error('Error parsing message:', e);
      }
    };

    // If already open, trigger the callback
    if (this.dataChannel.readyState === 'open') {
      console.log('Data channel already open');
      this.callbacks?.onStatusChange('connected');
      this.startPingPong();
    }
  }

  private handleMessage(message: { type: string; [key: string]: unknown }) {
    switch (message.type) {
      case 'input':
        this.callbacks?.onRemoteInput(
          message.frame as number,
          message.input as InputState
        );
        break;
      case 'gameState':
        this.callbacks?.onGameStateSync?.(message.state as unknown);
        break;
      case 'ping':
        this.sendDirect({ type: 'pong', timestamp: message.timestamp });
        break;
      case 'pong':
        const latency = Date.now() - (message.timestamp as number);
        this.callbacks?.onLatencyUpdate(latency);
        break;
    }
  }

  private listenForGuestData() {
    // Listen for guest character selection
    const guestCharRef = ref(database, `rooms/${this.roomCode}/guestCharacter`);
    const unsubChar = onValue(guestCharRef, (snapshot) => {
      const character = snapshot.val();
      if (character) {
        this.callbacks?.onRemoteCharacter(character);
      }
    });
    this.unsubscribers.push(() => unsubChar());

    // Listen for guest ready status
    const guestReadyRef = ref(database, `rooms/${this.roomCode}/guestReady`);
    const unsubReady = onValue(guestReadyRef, (snapshot) => {
      if (snapshot.val() === true) {
        this.callbacks?.onRemoteReady();
      }
    });
    this.unsubscribers.push(() => unsubReady());
  }

  private listenForHostData() {
    // Listen for host character selection
    const hostCharRef = ref(database, `rooms/${this.roomCode}/hostCharacter`);
    const unsubChar = onValue(hostCharRef, (snapshot) => {
      const character = snapshot.val();
      if (character) {
        this.callbacks?.onRemoteCharacter(character);
      }
    });
    this.unsubscribers.push(() => unsubChar());

    // Listen for host map selection
    const mapRef = ref(database, `rooms/${this.roomCode}/map`);
    const unsubMap = onValue(mapRef, (snapshot) => {
      const map = snapshot.val();
      if (map) {
        this.callbacks?.onRemoteMap(map);
      }
    });
    this.unsubscribers.push(() => unsubMap());

    // Listen for host ready status
    const hostReadyRef = ref(database, `rooms/${this.roomCode}/hostReady`);
    const unsubReady = onValue(hostReadyRef, (snapshot) => {
      if (snapshot.val() === true) {
        this.callbacks?.onRemoteReady();
      }
    });
    this.unsubscribers.push(() => unsubReady());

    // Listen for game start
    const startRef = ref(database, `rooms/${this.roomCode}/gameStarted`);
    const unsubStart = onValue(startRef, (snapshot) => {
      if (snapshot.val() === true) {
        this.callbacks?.onGameStart();
      }
    });
    this.unsubscribers.push(() => unsubStart());
  }

  private startPingPong() {
    this.pingInterval = setInterval(() => {
      this.sendDirect({ type: 'ping', timestamp: Date.now() });
    }, 2000);
  }

  private stopPingPong() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  // Send via data channel (fast, for game input)
  private sendDirect(message: object) {
    if (this.dataChannel?.readyState === 'open') {
      this.dataChannel.send(JSON.stringify(message));
    }
  }

  // Send input (via fast data channel)
  sendInput(frame: number, input: InputState) {
    this.sendDirect({ type: 'input', frame, input });
  }

  // Send game state (host only, for state sync)
  sendGameState(state: unknown) {
    if (this.isHost) {
      this.sendDirect({ type: 'gameState', state });
    }
  }

  // Send character selection (via Firebase for reliability)
  async sendCharacter(character: CharacterData) {
    const key = this.isHost ? 'hostCharacter' : 'guestCharacter';
    await set(ref(database, `rooms/${this.roomCode}/${key}`), character);
  }

  // Send map selection (host only, via Firebase)
  async sendMap(map: MapData) {
    if (this.isHost) {
      await set(ref(database, `rooms/${this.roomCode}/map`), map);
    }
  }

  // Send ready status
  async sendReady() {
    const key = this.isHost ? 'hostReady' : 'guestReady';
    await set(ref(database, `rooms/${this.roomCode}/${key}`), true);
  }

  // Start game (host only)
  async sendGameStart() {
    if (this.isHost) {
      await set(ref(database, `rooms/${this.roomCode}/gameStarted`), true);
    }
  }

  getRoomCode(): string {
    return this.roomCode;
  }

  getIsHost(): boolean {
    return this.isHost;
  }

  isConnected(): boolean {
    return this.dataChannel?.readyState === 'open';
  }

  // Wait for WebRTC connection to be established
  waitForConnection(timeoutMs: number = 15000): Promise<boolean> {
    return new Promise((resolve) => {
      // Already connected
      if (this.isConnected()) {
        console.log('Already connected');
        resolve(true);
        return;
      }

      const startTime = Date.now();

      const checkConnection = () => {
        if (this.isConnected()) {
          console.log('WebRTC connection established');
          resolve(true);
          return;
        }

        if (Date.now() - startTime > timeoutMs) {
          console.error('WebRTC connection timeout');
          resolve(false);
          return;
        }

        // Check again in 100ms
        setTimeout(checkConnection, 100);
      };

      checkConnection();
    });
  }

  async disconnect() {
    this.stopPingPong();

    // Unsubscribe from all Firebase listeners
    this.unsubscribers.forEach((unsub) => unsub());
    this.unsubscribers = [];

    // Close WebRTC
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    // Clean up Firebase room (if host)
    if (this.isHost && this.roomCode) {
      try {
        await remove(ref(database, `rooms/${this.roomCode}`));
      } catch (e) {
        console.error('Error cleaning up room:', e);
      }
    }

    this.roomCode = '';
    this.isHost = false;
    this.pendingCandidates = [];
    this.remoteDescriptionSet = false;
    this.callbacks?.onStatusChange('disconnected');
  }
}

// Singleton instance
export const multiplayerService = new MultiplayerFirebaseService();
