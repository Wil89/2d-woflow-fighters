import { useState, useEffect, useCallback, useRef } from 'react';
import type { CharacterData, MapData } from '../types/game';
import { characters, maps } from '../data/gameData';
import { multiplayerService, type ConnectionStatus } from '../services/multiplayer-firebase';

interface OnlineLobbyProps {
  onGameStart: (
    character: CharacterData,
    opponent: CharacterData,
    map: MapData,
    isHost: boolean,
    roomCode: string
  ) => void;
  onBack: () => void;
}

type LobbyPhase = 'menu' | 'creating' | 'joining' | 'lobby';

export const OnlineLobby = ({ onGameStart, onBack }: OnlineLobbyProps) => {
  const [phase, setPhase] = useState<LobbyPhase>('menu');
  const [roomCode, setRoomCode] = useState('');
  const [inputCode, setInputCode] = useState('');
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [error, setError] = useState<string | null>(null);
  const [latency, setLatency] = useState<number | null>(null);

  // Character/map selection state
  const [myCharacter, setMyCharacter] = useState<CharacterData>(characters[0]);
  const [opponentCharacter, setOpponentCharacter] = useState<CharacterData | null>(null);
  const [selectedMap, setSelectedMap] = useState<MapData>(maps[0]);
  const [isReady, setIsReady] = useState(false);
  const [opponentReady, setOpponentReady] = useState(false);

  // Track if we're transitioning to game (don't disconnect in that case)
  const isStartingGameRef = useRef(false);

  const isHost = multiplayerService.getIsHost();

  // Setup multiplayer callbacks - only on mount
  useEffect(() => {
    multiplayerService.setCallbacks({
      onStatusChange: setStatus,
      onRemoteInput: () => {}, // Not used in lobby
      onRemoteCharacter: (char) => setOpponentCharacter(char),
      onRemoteMap: (map) => setSelectedMap(map),
      onRemoteReady: () => setOpponentReady(true),
      onGameStart: () => {
        // Will be handled by startGameRef
      },
      onError: setError,
      onLatencyUpdate: setLatency,
    });

    return () => {
      // Only disconnect if we're NOT transitioning to the game
      if (!isStartingGameRef.current) {
        multiplayerService.disconnect();
      }
    };
  }, []); // Empty deps - only run once on mount

  // Handle game start with current state values
  useEffect(() => {
    const handleGameStartCallback = () => {
      if (opponentCharacter) {
        isStartingGameRef.current = true; // Don't disconnect when unmounting
        onGameStart(
          myCharacter,
          opponentCharacter,
          selectedMap,
          multiplayerService.getIsHost(),
          multiplayerService.getRoomCode()
        );
      }
    };

    multiplayerService.setCallbacks({
      onStatusChange: setStatus,
      onRemoteInput: () => {},
      onRemoteCharacter: (char) => setOpponentCharacter(char),
      onRemoteMap: (map) => setSelectedMap(map),
      onRemoteReady: () => setOpponentReady(true),
      onGameStart: handleGameStartCallback,
      onError: setError,
      onLatencyUpdate: setLatency,
    });
  }, [myCharacter, opponentCharacter, selectedMap, onGameStart]);

  // Send character selection when it changes
  useEffect(() => {
    if (status === 'connected') {
      multiplayerService.sendCharacter(myCharacter);
    }
  }, [myCharacter, status]);

  // Send map selection when host changes it
  useEffect(() => {
    if (status === 'connected' && isHost) {
      multiplayerService.sendMap(selectedMap);
    }
  }, [selectedMap, status, isHost]);

  const handleCreateRoom = async () => {
    setPhase('creating');
    setError(null);
    try {
      const code = await multiplayerService.createRoom();
      setRoomCode(code);
      setPhase('lobby');
    } catch (err) {
      setError('Failed to create room');
      setPhase('menu');
    }
  };

  const handleJoinRoom = async () => {
    if (inputCode.length !== 6) {
      setError('Please enter a 6-character room code');
      return;
    }
    setPhase('joining');
    setError(null);
    try {
      await multiplayerService.joinRoom(inputCode);
      setRoomCode(inputCode.toUpperCase());
      setPhase('lobby');
    } catch (err) {
      setError('Failed to join room');
      setPhase('menu');
    }
  };

  const handleReady = useCallback(() => {
    setIsReady(true);
    multiplayerService.sendReady();
  }, []);

  const handleStartGame = useCallback(() => {
    if (isHost && isReady && opponentReady && opponentCharacter) {
      isStartingGameRef.current = true; // Don't disconnect when unmounting
      multiplayerService.sendGameStart();
      onGameStart(myCharacter, opponentCharacter, selectedMap, true, roomCode);
    }
  }, [isHost, isReady, opponentReady, opponentCharacter, myCharacter, selectedMap, roomCode, onGameStart]);

  const handleBackToMenu = () => {
    multiplayerService.disconnect();
    setPhase('menu');
    setRoomCode('');
    setInputCode('');
    setError(null);
    setIsReady(false);
    setOpponentReady(false);
    setOpponentCharacter(null);
  };

  // Render menu phase
  if (phase === 'menu') {
    return (
      <div className="online-lobby">
        <div className="lobby-header">
          <button className="back-button" onClick={onBack}>← BACK</button>
          <h1>ONLINE PvP</h1>
        </div>

        <div className="lobby-content menu-phase">
          <button className="lobby-option create" onClick={handleCreateRoom}>
            <span className="option-icon">🏠</span>
            <h2>CREATE ROOM</h2>
            <p>Host a game and invite a friend</p>
          </button>

          <div className="lobby-option join">
            <span className="option-icon">🚪</span>
            <h2>JOIN ROOM</h2>
            <p>Enter a room code to join</p>
            <input
              type="text"
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value.toUpperCase().slice(0, 6))}
              placeholder="ENTER CODE"
              maxLength={6}
            />
            <button className="join-button" onClick={handleJoinRoom}>
              JOIN
            </button>
          </div>

          {error && <div className="error-message">{error}</div>}
        </div>

        <style>{lobbyStyles}</style>
      </div>
    );
  }

  // Render creating/joining phase
  if (phase === 'creating' || phase === 'joining') {
    return (
      <div className="online-lobby">
        <div className="lobby-header">
          <h1>ONLINE PvP</h1>
        </div>

        <div className="lobby-content connecting-phase">
          <div className="connecting-spinner"></div>
          <p>{phase === 'creating' ? 'Creating room...' : 'Joining room...'}</p>
        </div>

        <style>{lobbyStyles}</style>
      </div>
    );
  }

  // Render lobby phase
  return (
    <div className="online-lobby">
      <div className="lobby-header">
        <button className="back-button" onClick={handleBackToMenu}>← LEAVE</button>
        <h1>GAME LOBBY</h1>
        <div className="room-code">
          Room: <span>{roomCode}</span>
        </div>
      </div>

      <div className="lobby-content lobby-phase">
        {/* Connection status */}
        <div className="connection-status">
          <span className={`status-indicator ${status}`}></span>
          <span className="status-text">
            {status === 'waiting' && 'Waiting for opponent...'}
            {status === 'connected' && `Connected${latency ? ` (${latency}ms)` : ''}`}
            {status === 'disconnected' && 'Disconnected'}
            {status === 'error' && 'Connection error'}
          </span>
        </div>

        {/* Player cards */}
        <div className="player-cards">
          <div className="player-card">
            <h3>{isHost ? 'HOST (YOU)' : 'YOU'}</h3>
            <div
              className="player-avatar"
              style={{
                background: `linear-gradient(135deg, ${myCharacter.color}, ${myCharacter.secondaryColor})`,
              }}
            >
              <img src={myCharacter.faceImage} alt={myCharacter.name} />
            </div>
            <p className="player-name">{myCharacter.name}</p>
            <div className={`ready-badge ${isReady ? 'ready' : ''}`}>
              {isReady ? 'READY!' : 'NOT READY'}
            </div>
          </div>

          <div className="vs-divider">VS</div>

          <div className="player-card">
            <h3>{isHost ? 'OPPONENT' : 'HOST'}</h3>
            {opponentCharacter ? (
              <>
                <div
                  className="player-avatar"
                  style={{
                    background: `linear-gradient(135deg, ${opponentCharacter.color}, ${opponentCharacter.secondaryColor})`,
                  }}
                >
                  <img src={opponentCharacter.faceImage} alt={opponentCharacter.name} />
                </div>
                <p className="player-name">{opponentCharacter.name}</p>
                <div className={`ready-badge ${opponentReady ? 'ready' : ''}`}>
                  {opponentReady ? 'READY!' : 'NOT READY'}
                </div>
              </>
            ) : (
              <>
                <div className="player-avatar waiting">?</div>
                <p className="player-name">Waiting...</p>
              </>
            )}
          </div>
        </div>

        {/* Character selection */}
        <div className="character-select-mini">
          <h3>SELECT YOUR FIGHTER</h3>
          <div className="character-grid-mini">
            {characters.map((char) => (
              <button
                key={char.id}
                className={`char-btn ${myCharacter.id === char.id ? 'selected' : ''}`}
                onClick={() => setMyCharacter(char)}
                disabled={isReady}
              >
                <img src={char.faceImage} alt={char.name} />
              </button>
            ))}
          </div>
        </div>

        {/* Map selection (host only) */}
        {isHost && (
          <div className="map-select-mini">
            <h3>SELECT MAP</h3>
            <div className="map-grid-mini">
              {maps.map((m) => (
                <button
                  key={m.id}
                  className={`map-btn ${selectedMap.id === m.id ? 'selected' : ''}`}
                  onClick={() => setSelectedMap(m)}
                  disabled={isReady}
                >
                  {m.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {!isHost && (
          <div className="map-display">
            <h3>MAP: {selectedMap.name}</h3>
          </div>
        )}

        {/* Action buttons */}
        <div className="lobby-actions">
          {!isReady && status === 'connected' && (
            <button className="action-button ready-button" onClick={handleReady}>
              READY!
            </button>
          )}
          {isHost && isReady && opponentReady && (
            <button className="action-button start-button" onClick={handleStartGame}>
              START GAME!
            </button>
          )}
          {isReady && !opponentReady && (
            <p className="waiting-text">Waiting for opponent to ready up...</p>
          )}
          {!isHost && isReady && opponentReady && (
            <p className="waiting-text">Waiting for host to start...</p>
          )}
        </div>

        {error && <div className="error-message">{error}</div>}
      </div>

      <style>{lobbyStyles}</style>
    </div>
  );
};

const lobbyStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');

  .online-lobby {
    min-height: 100vh;
    height: auto;
    background: #0a0a15;
    padding: 2rem 2rem 3rem;
    display: block;
    font-family: 'Press Start 2P', monospace;
    position: relative;
    overflow: visible;
  }

  .online-lobby::before {
    content: '';
    position: fixed;
    inset: 0;
    background:
      radial-gradient(ellipse at 50% 50%, rgba(255, 102, 170, 0.1) 0%, transparent 50%);
    pointer-events: none;
    z-index: 0;
  }

  .online-lobby::after {
    content: '';
    position: fixed;
    inset: 0;
    background: repeating-linear-gradient(
      0deg,
      transparent,
      transparent 2px,
      rgba(0, 0, 0, 0.3) 2px,
      rgba(0, 0, 0, 0.3) 4px
    );
    opacity: 0.3;
    pointer-events: none;
    z-index: 100;
  }

  .lobby-header {
    display: flex;
    align-items: center;
    gap: 2rem;
    margin-bottom: 2rem;
    position: relative;
    z-index: 1;
  }

  .back-button {
    padding: 0.6rem 1rem;
    font-family: 'Press Start 2P', monospace;
    font-size: 0.7rem;
    color: #fff;
    background: linear-gradient(180deg, #333 0%, #111 100%);
    border: 3px solid #555;
    cursor: pointer;
    transition: all 0.1s;
  }

  .back-button:hover {
    background: linear-gradient(180deg, #444 0%, #222 100%);
    border-color: #777;
  }

  .lobby-header h1 {
    font-size: 1.8rem;
    color: #FF66AA;
    text-shadow:
      3px 3px 0 #993366,
      6px 6px 0 #000;
    flex: 1;
    text-align: center;
    margin: 0;
  }

  .room-code {
    font-size: 0.7rem;
    color: #888;
    padding: 0.5rem 1rem;
    background: linear-gradient(180deg, #1a1a2e 0%, #0d0d1a 100%);
    border: 3px solid #ffcc00;
  }

  .room-code span {
    font-size: 1rem;
    color: #ffcc00;
    letter-spacing: 0.2em;
    text-shadow: 0 0 10px #ffcc00;
  }

  .lobby-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.5rem;
    padding: 1rem 1rem 2rem;
    position: relative;
    z-index: 1;
  }

  .menu-phase {
    flex-direction: row;
    justify-content: center;
    gap: 2rem;
    flex-wrap: wrap;
  }

  .lobby-option {
    width: 320px;
    padding: 1.5rem;
    background: linear-gradient(180deg, #1a1a2e 0%, #0d0d1a 100%);
    border: 4px solid #333;
    text-align: center;
    transition: all 0.2s;
  }

  .lobby-option.create {
    cursor: pointer;
  }

  .lobby-option.create:hover {
    border-color: #FF66AA;
    box-shadow: 0 0 30px rgba(255, 102, 170, 0.4);
    transform: translateY(-5px);
  }

  .lobby-option .option-icon {
    font-size: 3rem;
    display: block;
    margin-bottom: 1rem;
    filter: drop-shadow(0 4px 8px rgba(0,0,0,0.5));
  }

  .lobby-option h2 {
    font-size: 1rem;
    color: #FF66AA;
    margin: 0 0 0.8rem 0;
    text-shadow: 2px 2px 0 #000;
  }

  .lobby-option p {
    font-size: 0.5rem;
    color: #888;
    margin: 0 0 1rem 0;
    line-height: 1.6;
  }

  .lobby-option input {
    width: 100%;
    padding: 0.8rem;
    font-family: 'Press Start 2P', monospace;
    font-size: 1rem;
    text-align: center;
    letter-spacing: 0.3em;
    background: #000;
    border: 3px solid #555;
    color: #ffcc00;
    margin-bottom: 1rem;
    text-shadow: 0 0 5px #ffcc00;
  }

  .lobby-option input::placeholder {
    color: #444;
    letter-spacing: 0.1em;
    text-shadow: none;
  }

  .lobby-option input:focus {
    outline: none;
    border-color: #ffcc00;
    box-shadow: 0 0 15px rgba(255, 204, 0, 0.3);
  }

  .join-button {
    width: 100%;
    padding: 0.8rem;
    font-family: 'Press Start 2P', monospace;
    font-size: 0.8rem;
    color: #000;
    background: linear-gradient(180deg, #FF66AA 0%, #CC3388 100%);
    border: 4px solid #fff;
    cursor: pointer;
    transition: all 0.1s;
    box-shadow: 4px 4px 0 #000;
  }

  .join-button:hover {
    transform: translateY(-2px);
    box-shadow: 6px 6px 0 #000;
    background: linear-gradient(180deg, #FF88BB 0%, #DD4499 100%);
  }

  .join-button:active {
    transform: translateY(2px);
    box-shadow: 2px 2px 0 #000;
  }

  .connecting-phase {
    justify-content: center;
  }

  .connecting-phase p {
    font-size: 0.8rem;
    color: #FF66AA;
    animation: blink 1s step-end infinite;
  }

  .connecting-spinner {
    width: 60px;
    height: 60px;
    border: 6px solid #333;
    border-top-color: #FF66AA;
    border-radius: 0;
    animation: spin 1s linear infinite;
    box-shadow: 0 0 20px rgba(255, 102, 170, 0.3);
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  @keyframes blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  .connection-status {
    display: flex;
    align-items: center;
    gap: 0.8rem;
    padding: 0.5rem 1.5rem;
    background: linear-gradient(180deg, #1a1a2e 0%, #0d0d1a 100%);
    border: 3px solid #333;
  }

  .status-indicator {
    width: 12px;
    height: 12px;
    background: #666;
    box-shadow: inset 0 0 5px #000;
  }

  .status-indicator.waiting {
    background: #FFAA00;
    box-shadow: 0 0 10px #FFAA00;
    animation: pulse 1s infinite;
  }

  .status-indicator.connected {
    background: #44BB44;
    box-shadow: 0 0 10px #44BB44;
  }

  .status-indicator.error {
    background: #FF4444;
    box-shadow: 0 0 10px #FF4444;
  }

  .status-text {
    font-size: 0.6rem;
    color: #fff;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  .player-cards {
    display: flex;
    align-items: center;
    gap: 1.5rem;
    flex-wrap: wrap;
    justify-content: center;
  }

  .player-card {
    width: 220px;
    padding: 1.2rem;
    background: linear-gradient(180deg, #1a1a2e 0%, #0d0d1a 100%);
    border: 4px solid #333;
    text-align: center;
    transition: all 0.2s;
  }

  .player-card h3 {
    font-size: 0.6rem;
    color: #ffcc00;
    margin: 0 0 1rem 0;
    text-shadow: 2px 2px 0 #000;
  }

  .player-avatar {
    width: 100px;
    height: 100px;
    margin: 0 auto 1rem;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    border: 4px solid #555;
    background: #111;
  }

  .player-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .player-avatar.waiting {
    background: linear-gradient(180deg, #222 0%, #111 100%);
    font-size: 2.5rem;
    color: #333;
  }

  .player-name {
    font-size: 0.8rem;
    color: #fff;
    margin: 0 0 1rem 0;
    text-shadow: 2px 2px 0 #000;
  }

  .ready-badge {
    padding: 0.4rem 0.8rem;
    font-size: 0.5rem;
    background: linear-gradient(180deg, #333 0%, #111 100%);
    border: 2px solid #555;
    color: #666;
  }

  .ready-badge.ready {
    background: linear-gradient(180deg, #44BB44 0%, #228822 100%);
    border-color: #66DD66;
    color: #fff;
    box-shadow: 0 0 15px rgba(68, 187, 68, 0.4);
  }

  .vs-divider {
    font-size: 2rem;
    color: #ff4444;
    text-shadow:
      3px 3px 0 #880000,
      6px 6px 0 #000,
      0 0 30px rgba(255, 68, 68, 0.5);
    animation: vsGlow 1.5s ease-in-out infinite;
  }

  @keyframes vsGlow {
    0%, 100% { text-shadow: 3px 3px 0 #880000, 6px 6px 0 #000, 0 0 30px rgba(255, 68, 68, 0.5); }
    50% { text-shadow: 3px 3px 0 #880000, 6px 6px 0 #000, 0 0 50px rgba(255, 68, 68, 0.8); }
  }

  .character-select-mini,
  .map-select-mini,
  .map-display {
    background: linear-gradient(180deg, #1a1a2e 0%, #0d0d1a 100%);
    border: 4px solid #333;
    padding: 1rem 1.5rem;
  }

  .character-select-mini h3,
  .map-select-mini h3,
  .map-display h3 {
    font-size: 0.7rem;
    color: #ffcc00;
    margin: 0 0 1rem 0;
    text-align: center;
    text-shadow: 2px 2px 0 #000;
  }

  .character-grid-mini {
    display: flex;
    gap: 0.6rem;
    flex-wrap: wrap;
    justify-content: center;
  }

  .char-btn {
    width: 60px;
    height: 60px;
    border: 3px solid #555;
    background: #111;
    cursor: pointer;
    overflow: hidden;
    transition: all 0.1s;
    padding: 0;
  }

  .char-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .char-btn img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .char-btn:hover:not(:disabled) {
    border-color: #888;
    transform: scale(1.1);
  }

  .char-btn.selected {
    border-color: #ffcc00;
    box-shadow: 0 0 20px rgba(255, 204, 0, 0.5);
  }

  .map-grid-mini {
    display: flex;
    gap: 0.6rem;
    justify-content: center;
    flex-wrap: wrap;
  }

  .map-btn {
    padding: 0.5rem 1rem;
    font-family: 'Press Start 2P', monospace;
    font-size: 0.5rem;
    background: linear-gradient(180deg, #333 0%, #111 100%);
    border: 3px solid #555;
    color: #fff;
    cursor: pointer;
    transition: all 0.1s;
  }

  .map-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .map-btn:hover:not(:disabled) {
    border-color: #888;
    transform: translateY(-2px);
  }

  .map-btn.selected {
    border-color: #ffcc00;
    background: linear-gradient(180deg, #444 0%, #222 100%);
    box-shadow: 0 0 15px rgba(255, 204, 0, 0.3);
    color: #ffcc00;
  }

  .lobby-actions {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    margin-top: 0.5rem;
  }

  .action-button {
    padding: 1rem 2.5rem;
    font-family: 'Press Start 2P', monospace;
    font-size: 0.9rem;
    border: 4px solid #fff;
    cursor: pointer;
    transition: all 0.1s;
    box-shadow: 6px 6px 0 #000;
  }

  .ready-button {
    background: linear-gradient(180deg, #44BB44 0%, #228822 100%);
    color: #000;
  }

  .ready-button:hover {
    transform: translateY(-3px);
    box-shadow: 9px 9px 0 #000;
    background: linear-gradient(180deg, #66DD66 0%, #44BB44 100%);
  }

  .ready-button:active {
    transform: translateY(2px);
    box-shadow: 2px 2px 0 #000;
  }

  .start-button {
    background: linear-gradient(180deg, #ff6666 0%, #cc0000 100%);
    color: #fff;
    animation: startGlow 1s ease-in-out infinite;
  }

  .start-button:hover {
    transform: translateY(-3px);
    box-shadow: 9px 9px 0 #000;
    background: linear-gradient(180deg, #ff8888 0%, #ee2222 100%);
  }

  @keyframes startGlow {
    0%, 100% { box-shadow: 6px 6px 0 #000, 0 0 20px rgba(255, 68, 68, 0.3); }
    50% { box-shadow: 6px 6px 0 #000, 0 0 40px rgba(255, 68, 68, 0.6); }
  }

  .waiting-text {
    font-size: 0.6rem;
    color: #888;
    animation: blink 1s step-end infinite;
  }

  .error-message {
    padding: 0.8rem 1.5rem;
    font-size: 0.6rem;
    background: linear-gradient(180deg, #440000 0%, #220000 100%);
    border: 3px solid #FF4444;
    color: #FF4444;
    margin-top: 1rem;
    text-shadow: 0 0 10px rgba(255, 68, 68, 0.5);
  }

  /* Responsive styles */
  @media (max-width: 700px) {
    .menu-phase {
      flex-direction: column;
      gap: 1.5rem;
    }

    .lobby-option {
      width: 100%;
      max-width: 320px;
    }

    .lobby-header {
      flex-direction: column;
      gap: 0.8rem;
    }

    .lobby-header h1 {
      font-size: 1.2rem;
    }

    .back-button {
      align-self: flex-start;
    }

    .player-cards {
      gap: 1rem;
    }

    .player-card {
      width: 160px;
      padding: 1rem;
    }

    .player-avatar {
      width: 80px;
      height: 80px;
    }

    .player-name {
      font-size: 0.6rem;
    }

    .vs-divider {
      font-size: 1.5rem;
    }

    .char-btn {
      width: 50px;
      height: 50px;
    }

    .action-button {
      padding: 0.8rem 2rem;
      font-size: 0.7rem;
    }
  }

  @media (max-width: 450px) {
    .online-lobby {
      padding: 1rem 1rem 4rem;
    }

    .player-card {
      width: 140px;
      padding: 0.8rem;
    }

    .player-avatar {
      width: 60px;
      height: 60px;
    }

    .ready-badge {
      font-size: 0.4rem;
      padding: 0.3rem 0.5rem;
    }

    .char-btn {
      width: 45px;
      height: 45px;
    }

    .map-btn {
      font-size: 0.4rem;
      padding: 0.4rem 0.6rem;
    }
  }
`;
