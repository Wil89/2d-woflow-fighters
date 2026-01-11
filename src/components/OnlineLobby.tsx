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
  .online-lobby {
    min-height: 100vh;
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    padding: 2rem;
    display: flex;
    flex-direction: column;
  }

  .lobby-header {
    display: flex;
    align-items: center;
    gap: 2rem;
    margin-bottom: 2rem;
  }

  .back-button {
    padding: 0.8rem 1.5rem;
    font-size: 1rem;
    font-weight: 700;
    color: #fff;
    background: rgba(255,255,255,0.1);
    border: 2px solid rgba(255,255,255,0.3);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .back-button:hover {
    background: rgba(255,255,255,0.2);
  }

  .lobby-header h1 {
    font-size: 2.5rem;
    color: #fff;
    text-shadow: 3px 3px 0 #000;
    flex: 1;
    text-align: center;
  }

  .room-code {
    font-size: 1.2rem;
    color: rgba(255,255,255,0.7);
  }

  .room-code span {
    font-family: monospace;
    font-size: 1.5rem;
    color: #FF66AA;
    font-weight: bold;
    letter-spacing: 0.2em;
  }

  .lobby-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2rem;
    padding: 2rem;
  }

  .menu-phase {
    flex-direction: row;
    justify-content: center;
    gap: 3rem;
  }

  .lobby-option {
    width: 300px;
    padding: 2rem;
    background: rgba(0,0,0,0.4);
    border: 4px solid rgba(255,255,255,0.2);
    border-radius: 20px;
    text-align: center;
    transition: all 0.3s;
  }

  .lobby-option.create {
    cursor: pointer;
  }

  .lobby-option.create:hover {
    background: rgba(255, 102, 170, 0.3);
    border-color: #FF66AA;
  }

  .lobby-option .option-icon {
    font-size: 4rem;
    display: block;
    margin-bottom: 1rem;
  }

  .lobby-option h2 {
    color: #fff;
    margin: 0 0 0.5rem 0;
  }

  .lobby-option p {
    color: rgba(255,255,255,0.7);
    margin: 0 0 1rem 0;
  }

  .lobby-option input {
    width: 100%;
    padding: 1rem;
    font-size: 1.5rem;
    text-align: center;
    font-family: monospace;
    letter-spacing: 0.3em;
    background: rgba(0,0,0,0.5);
    border: 2px solid rgba(255,255,255,0.3);
    border-radius: 8px;
    color: #fff;
    margin-bottom: 1rem;
  }

  .lobby-option input::placeholder {
    color: rgba(255,255,255,0.3);
    letter-spacing: 0.1em;
  }

  .join-button {
    width: 100%;
    padding: 1rem;
    font-size: 1.2rem;
    font-weight: 700;
    color: #fff;
    background: linear-gradient(180deg, #FF66AA 0%, #CC3388 100%);
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .join-button:hover {
    transform: translateY(-2px);
  }

  .connecting-phase {
    justify-content: center;
  }

  .connecting-spinner {
    width: 60px;
    height: 60px;
    border: 4px solid rgba(255,255,255,0.2);
    border-top-color: #FF66AA;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .connection-status {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: rgba(0,0,0,0.3);
    border-radius: 20px;
  }

  .status-indicator {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #666;
  }

  .status-indicator.waiting {
    background: #FFAA00;
    animation: pulse 1s infinite;
  }

  .status-indicator.connected {
    background: #44BB44;
  }

  .status-indicator.error {
    background: #FF4444;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  .player-cards {
    display: flex;
    align-items: center;
    gap: 2rem;
  }

  .player-card {
    width: 200px;
    padding: 1.5rem;
    background: rgba(0,0,0,0.3);
    border: 3px solid rgba(255,255,255,0.1);
    border-radius: 15px;
    text-align: center;
  }

  .player-card h3 {
    color: rgba(255,255,255,0.7);
    margin: 0 0 1rem 0;
    font-size: 0.9rem;
  }

  .player-avatar {
    width: 100px;
    height: 100px;
    border-radius: 50%;
    margin: 0 auto 1rem;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    border: 3px solid rgba(0,0,0,0.3);
  }

  .player-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .player-avatar.waiting {
    background: rgba(255,255,255,0.1);
    font-size: 3rem;
    color: rgba(255,255,255,0.3);
  }

  .player-name {
    color: #fff;
    font-size: 1.2rem;
    font-weight: 700;
    margin: 0 0 1rem 0;
  }

  .ready-badge {
    padding: 0.3rem 0.8rem;
    border-radius: 20px;
    font-size: 0.8rem;
    font-weight: 700;
    background: rgba(255,255,255,0.1);
    color: rgba(255,255,255,0.5);
  }

  .ready-badge.ready {
    background: rgba(68, 187, 68, 0.3);
    color: #44BB44;
  }

  .vs-divider {
    font-size: 2rem;
    font-weight: 700;
    color: #FF66AA;
    text-shadow: 2px 2px 0 #000;
  }

  .character-select-mini h3,
  .map-select-mini h3,
  .map-display h3 {
    color: rgba(255,255,255,0.7);
    margin: 0 0 1rem 0;
    text-align: center;
  }

  .character-grid-mini {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    justify-content: center;
  }

  .char-btn {
    width: 50px;
    height: 50px;
    border-radius: 50%;
    border: 2px solid rgba(255,255,255,0.2);
    background: rgba(0,0,0,0.3);
    cursor: pointer;
    overflow: hidden;
    transition: all 0.2s;
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
    border-color: rgba(255,255,255,0.5);
    transform: scale(1.1);
  }

  .char-btn.selected {
    border-color: #FF66AA;
    box-shadow: 0 0 10px rgba(255, 102, 170, 0.5);
  }

  .map-grid-mini {
    display: flex;
    gap: 0.5rem;
    justify-content: center;
  }

  .map-btn {
    padding: 0.5rem 1rem;
    background: rgba(0,0,0,0.3);
    border: 2px solid rgba(255,255,255,0.2);
    border-radius: 8px;
    color: #fff;
    cursor: pointer;
    transition: all 0.2s;
  }

  .map-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .map-btn:hover:not(:disabled) {
    border-color: rgba(255,255,255,0.5);
  }

  .map-btn.selected {
    border-color: #FF66AA;
    background: rgba(255, 102, 170, 0.2);
  }

  .lobby-actions {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    margin-top: 1rem;
  }

  .action-button {
    padding: 1rem 3rem;
    font-size: 1.3rem;
    font-weight: 700;
    border: none;
    border-radius: 50px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .ready-button {
    background: linear-gradient(180deg, #44BB44 0%, #339933 100%);
    color: #fff;
    box-shadow: 0 4px 0 #226622;
  }

  .ready-button:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 0 #226622;
  }

  .start-button {
    background: linear-gradient(180deg, #FF66AA 0%, #CC3388 100%);
    color: #fff;
    box-shadow: 0 4px 0 #993366;
    animation: glow 1s ease-in-out infinite;
  }

  @keyframes glow {
    0%, 100% { box-shadow: 0 4px 0 #993366, 0 0 20px rgba(255, 102, 170, 0.3); }
    50% { box-shadow: 0 4px 0 #993366, 0 0 30px rgba(255, 102, 170, 0.6); }
  }

  .waiting-text {
    color: rgba(255,255,255,0.5);
    font-style: italic;
  }

  .error-message {
    padding: 1rem 2rem;
    background: rgba(255, 68, 68, 0.2);
    border: 2px solid #FF4444;
    border-radius: 8px;
    color: #FF4444;
    margin-top: 1rem;
  }
`;
