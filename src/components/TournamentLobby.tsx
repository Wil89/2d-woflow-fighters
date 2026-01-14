import { useState, useEffect, useCallback, useRef } from 'react';
import type { CharacterData, MapData, Tournament, TournamentMatch, TournamentPlayer } from '../types/game';
import { characters, maps } from '../data/gameData';
import { tournamentService, type TournamentConnectionStatus } from '../services/tournament-firebase';
import { multiplayerService } from '../services/multiplayer-firebase';
import { TournamentBracket } from './TournamentBracket';

interface TournamentLobbyProps {
  onMatchStart: (
    character: CharacterData,
    opponent: CharacterData,
    map: MapData,
    isHost: boolean,
    roomCode: string,
    matchId: string,
    roundNumber: number,
    tournamentCode: string
  ) => void;
  onBack: () => void;
}

type LobbyPhase = 'menu' | 'creating' | 'joining' | 'waiting' | 'in_progress';

export const TournamentLobby = ({ onMatchStart, onBack }: TournamentLobbyProps) => {
  // Check if we're returning from a match (tournament service still has a code)
  const existingCode = tournamentService.getTournamentCode();

  const [phase, setPhase] = useState<LobbyPhase>(existingCode ? 'in_progress' : 'menu');
  const [tournamentCode, setTournamentCode] = useState(existingCode || '');
  const [inputCode, setInputCode] = useState('');
  const [playerName, setPlayerName] = useState(() => localStorage.getItem('tournament_player_name') || '');
  const [tournamentName, setTournamentName] = useState('');
  const [tournamentSize, setTournamentSize] = useState<4 | 8 | 16>(4);
  const [status, setStatus] = useState<TournamentConnectionStatus>('disconnected');
  const [error, setError] = useState<string | null>(null);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [myCharacter, setMyCharacter] = useState<CharacterData>(characters[0]);
  const [currentMatch, setCurrentMatch] = useState<TournamentMatch | null>(null);
  const [matchOpponent, setMatchOpponent] = useState<TournamentPlayer | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<string>('');
  const [waitingForOpponent, setWaitingForOpponent] = useState(false); // Track if we clicked ready

  const isStartingMatchRef = useRef(false);
  const hasAutoStartedRef = useRef<string | null>(null); // Track which match we auto-started
  const hasReconnectedRef = useRef(false); // Track if we've reconnected after returning from match
  const lastMatchIdRef = useRef<string | null>(null); // Track last match to reset waiting state
  const playerId = tournamentService.getPlayerId();
  const isCreator = tournamentService.getIsCreator();

  // On mount, reset refs and disconnect any existing multiplayer connection
  useEffect(() => {
    isStartingMatchRef.current = false;
    hasAutoStartedRef.current = null;
    // Disconnect any WebRTC connection from the previous match
    multiplayerService.disconnect();
  }, []);

  // Setup callbacks - runs once on mount and whenever we need to update callbacks
  useEffect(() => {
    tournamentService.setCallbacks({
      onStatusChange: setStatus,
      onTournamentUpdate: (t) => {
        setTournament(t);
        if (t && t.meta) {
          // Log tournament completion for debugging
          if (t.meta.status === 'completed') {
            console.log('Tournament completed!', {
              winnerId: t.meta.winnerId,
              winnerName: t.meta.winnerId ? t.players[t.meta.winnerId]?.name : 'N/A',
              playersCount: Object.keys(t.players).length
            });
          }

          if (t.meta.status === 'in_progress' || t.meta.status === 'completed') {
            setPhase('in_progress');
            const match = tournamentService.getMyCurrentMatch(t);
            setCurrentMatch(match);

            // Restore my character from tournament data (important after returning from a match)
            const myPlayerId = tournamentService.getPlayerId();
            const myTournamentPlayer = t.players[myPlayerId];
            if (myTournamentPlayer?.character) {
              console.log('Restoring character from tournament data:', {
                playerId: myPlayerId,
                playerName: myTournamentPlayer.name,
                character: myTournamentPlayer.character.name
              });
              setMyCharacter(myTournamentPlayer.character);
            }

            // Reset waiting state if this is a new match
            if (match && match.matchId !== lastMatchIdRef.current) {
              lastMatchIdRef.current = match.matchId;
              setWaitingForOpponent(false);
              setMatchOpponent(null);
              hasAutoStartedRef.current = null; // Reset auto-start for new match
            }
          } else if (t.meta.status === 'waiting') {
            setPhase('waiting');
          }
        }
      },
      onMatchReady: (match, opponent) => {
        console.log('Match ready callback:', {
          matchId: match.matchId,
          roundNumber: match.roundNumber,
          status: match.status,
          roomCode: match.roomCode,
          player1Id: match.player1Id,
          player2Id: match.player2Id,
          opponentId: opponent.id,
          opponentName: opponent.name,
          opponentCharacter: opponent.character?.name || 'NO CHARACTER'
        });
        setCurrentMatch(match);
        setMatchOpponent(opponent);
      },
      onError: setError,
    });
  }); // No dependencies - always update callbacks with fresh state setters

  // Reconnect if returning from a match - runs on each mount after Strict Mode reset
  useEffect(() => {
    if (existingCode && !hasReconnectedRef.current) {
      console.log('TournamentLobby: Reconnecting to tournament', existingCode);
      hasReconnectedRef.current = true;
      tournamentService.reconnect();
    }
  }, [existingCode]);

  // Cleanup on unmount only
  useEffect(() => {
    console.log('TournamentLobby cleanup effect setup');
    return () => {
      console.log('TournamentLobby cleanup running, isStartingMatch:', isStartingMatchRef.current);
      if (!isStartingMatchRef.current) {
        console.log('TournamentLobby: Disconnecting tournament service');
        tournamentService.disconnect();
      } else {
        console.log('TournamentLobby: NOT disconnecting (starting match)');
      }
      // Reset reconnect flag so next mount will properly reconnect
      // This is needed because React Strict Mode reuses refs across double-mount
      hasReconnectedRef.current = false;
    };
  }, []);

  // Save player name
  useEffect(() => {
    if (playerName) {
      localStorage.setItem('tournament_player_name', playerName);
    }
  }, [playerName]);

  // Send character selection
  useEffect(() => {
    if (status === 'connected' && tournament?.meta.status === 'waiting') {
      tournamentService.setCharacter(myCharacter);
    }
  }, [myCharacter, status, tournament?.meta.status]);

  // Auto-start match when both players are ready
  useEffect(() => {
    // Only proceed if we have a match that's ready with a room code
    if (!currentMatch || !matchOpponent || currentMatch.status !== 'ready' || !currentMatch.roomCode) {
      return;
    }

    // Prevent auto-starting the same match twice
    if (hasAutoStartedRef.current === currentMatch.matchId) {
      return;
    }

    // Mark that we're auto-starting this match
    hasAutoStartedRef.current = currentMatch.matchId;
    isStartingMatchRef.current = true;

    const opponentChar = matchOpponent.character || characters[0];
    const isHost = tournamentService.isMatchHost(currentMatch);
    const map = maps[0];
    const roomCode = currentMatch.roomCode;

    console.log('Auto-starting match:', {
      matchId: currentMatch.matchId,
      roundNumber: currentMatch.roundNumber,
      isHost,
      myPlayerId: tournamentService.getPlayerId(),
      myCharacter: myCharacter.name,
      opponentId: matchOpponent.id,
      opponentName: matchOpponent.name,
      opponentCharacter: opponentChar.name,
      player1Id: currentMatch.player1Id,
      player2Id: currentMatch.player2Id
    });

    // Set up WebRTC connection before starting match
    const setupAndStart = async () => {
      try {
        setConnectionStatus('Setting up connection...');

        // Set up multiplayer callbacks for the connection
        multiplayerService.setCallbacks({
          onStatusChange: (status) => {
            console.log('Tournament WebRTC status:', status);
            setConnectionStatus(status === 'connected' ? 'Connected!' : `Status: ${status}`);
          },
          onRemoteInput: () => {},
          onRemoteCharacter: () => {},
          onRemoteMap: () => {},
          onRemoteReady: () => {},
          onGameStart: () => {},
          onError: (err) => {
            console.error('Tournament WebRTC error:', err);
            setConnectionStatus(`Error: ${err}`);
          },
          onLatencyUpdate: () => {},
        });

        if (isHost) {
          // Host creates the room with the tournament room code
          setConnectionStatus('Creating room...');
          console.log('Tournament host creating room:', roomCode);
          await multiplayerService.createRoom(roomCode);
          setConnectionStatus('Waiting for opponent to connect...');
        } else {
          // Guest waits for host to set up room first
          setConnectionStatus('Waiting for host...');
          await new Promise(resolve => setTimeout(resolve, 1000));
          // Guest joins the room
          setConnectionStatus('Joining room...');
          console.log('Tournament guest joining room:', roomCode);
          await multiplayerService.joinRoom(roomCode);
        }

        // Wait for actual WebRTC connection (up to 15 seconds)
        setConnectionStatus('Establishing peer connection...');
        const connected = await multiplayerService.waitForConnection(15000);

        if (!connected) {
          setConnectionStatus('Connection failed - retrying...');
          setError('Failed to connect to opponent. Please try again.');
          hasAutoStartedRef.current = null;
          isStartingMatchRef.current = false;
          multiplayerService.disconnect();
          return;
        }

        setConnectionStatus('Connected! Starting match...');

        // Mark match as started in Firebase
        tournamentService.startMatch(currentMatch.matchId, currentMatch.roundNumber);

        // Small delay to ensure both sides are ready
        await new Promise(resolve => setTimeout(resolve, 500));

        onMatchStart(
          myCharacter,
          opponentChar,
          map,
          isHost,
          roomCode,
          currentMatch.matchId,
          currentMatch.roundNumber,
          tournamentCode
        );
      } catch (error) {
        console.error('Failed to set up tournament match connection:', error);
        setConnectionStatus('Connection error');
        setError('Failed to connect. Please try again.');
        // Reset so user can try again
        hasAutoStartedRef.current = null;
        isStartingMatchRef.current = false;
        multiplayerService.disconnect();
      }
    };

    setupAndStart();
  }, [currentMatch, matchOpponent, myCharacter, tournamentCode, onMatchStart]);

  const handleCreateTournament = async () => {
    if (!playerName.trim()) {
      setError('Please enter your name');
      return;
    }
    if (!tournamentName.trim()) {
      setError('Please enter a tournament name');
      return;
    }

    setPhase('creating');
    setError(null);

    try {
      const code = await tournamentService.createTournament(tournamentName, tournamentSize, playerName);
      setTournamentCode(code);
      setPhase('waiting');
    } catch (err) {
      setError('Failed to create tournament');
      setPhase('menu');
    }
  };

  const handleJoinTournament = async () => {
    if (!playerName.trim()) {
      setError('Please enter your name');
      return;
    }
    if (inputCode.length !== 6) {
      setError('Please enter a 6-character code');
      return;
    }

    setPhase('joining');
    setError(null);

    try {
      await tournamentService.joinTournament(inputCode, playerName);
      setTournamentCode(inputCode.toUpperCase());
      setPhase('waiting');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join tournament');
      setPhase('menu');
    }
  };

  const handleReady = useCallback(async () => {
    await tournamentService.setReady();
  }, []);

  const handleStartTournament = useCallback(async () => {
    await tournamentService.startTournament();
  }, []);

  const handleMatchReady = useCallback(async () => {
    if (!currentMatch) return;
    setWaitingForOpponent(true);
    console.log('Setting match ready:', currentMatch.matchId, currentMatch.roundNumber);
    await tournamentService.setMatchReady(currentMatch.matchId, currentMatch.roundNumber);
  }, [currentMatch]);

  const handleEnterMatch = useCallback(() => {
    if (!currentMatch || !matchOpponent || !currentMatch.roomCode) return;

    isStartingMatchRef.current = true;

    const opponentChar = matchOpponent.character || characters[0];
    const isHost = tournamentService.isMatchHost(currentMatch);
    const map = maps[0]; // Use first map for tournament matches

    // Mark match as started
    tournamentService.startMatch(currentMatch.matchId, currentMatch.roundNumber);

    onMatchStart(
      myCharacter,
      opponentChar,
      map,
      isHost,
      currentMatch.roomCode,
      currentMatch.matchId,
      currentMatch.roundNumber,
      tournamentCode
    );
  }, [currentMatch, matchOpponent, myCharacter, tournamentCode, onMatchStart]);

  const handleLeaveTournament = async () => {
    await tournamentService.leaveTournament();
    setPhase('menu');
    setTournament(null);
    setTournamentCode('');
    setError(null);
  };

  const getMyPlayer = (): TournamentPlayer | null => {
    if (!tournament) return null;
    return tournament.players[playerId] || null;
  };

  const myPlayer = getMyPlayer();
  const playerCount = tournament ? Object.keys(tournament.players).length : 0;
  const allReady = tournament ? Object.values(tournament.players).every(p => p.status === 'ready') : false;
  const canStart = isCreator && allReady && playerCount === tournament?.meta.size;

  // Menu Phase
  if (phase === 'menu') {
    return (
      <div className="tournament-lobby">
        <div className="lobby-header">
          <button className="back-button" onClick={onBack}>← BACK</button>
          <h1>TOURNAMENT</h1>
        </div>

        <div className="lobby-content menu-phase">
          <div className="name-input-section">
            <label>YOUR NAME</label>
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value.slice(0, 12))}
              placeholder="Enter name..."
              maxLength={12}
            />
          </div>

          <div className="menu-options">
            <div className="menu-option create">
              <h2>CREATE TOURNAMENT</h2>
              <input
                type="text"
                value={tournamentName}
                onChange={(e) => setTournamentName(e.target.value.slice(0, 20))}
                placeholder="Tournament name..."
                maxLength={20}
              />
              <div className="size-selector">
                <button
                  className={`size-btn ${tournamentSize === 4 ? 'selected' : ''}`}
                  onClick={() => setTournamentSize(4)}
                >
                  4 PLAYERS
                </button>
                <button
                  className={`size-btn ${tournamentSize === 8 ? 'selected' : ''}`}
                  onClick={() => setTournamentSize(8)}
                >
                  8 PLAYERS
                </button>
                <button
                  className={`size-btn ${tournamentSize === 16 ? 'selected' : ''}`}
                  onClick={() => setTournamentSize(16)}
                >
                  16 PLAYERS
                </button>
              </div>
              <button className="action-btn create-btn" onClick={handleCreateTournament}>
                CREATE
              </button>
            </div>

            <div className="menu-divider">OR</div>

            <div className="menu-option join">
              <h2>JOIN TOURNAMENT</h2>
              <input
                type="text"
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value.toUpperCase().slice(0, 6))}
                placeholder="ENTER CODE"
                maxLength={6}
              />
              <button className="action-btn join-btn" onClick={handleJoinTournament}>
                JOIN
              </button>
            </div>
          </div>

          {error && <div className="error-message">{error}</div>}
        </div>

        <style>{lobbyStyles}</style>
      </div>
    );
  }

  // Creating/Joining Phase
  if (phase === 'creating' || phase === 'joining') {
    return (
      <div className="tournament-lobby">
        <div className="lobby-header">
          <h1>TOURNAMENT</h1>
        </div>
        <div className="lobby-content connecting-phase">
          <div className="connecting-spinner"></div>
          <p>{phase === 'creating' ? 'Creating tournament...' : 'Joining tournament...'}</p>
        </div>
        <style>{lobbyStyles}</style>
      </div>
    );
  }

  // Waiting Phase (Tournament not started)
  if (phase === 'waiting' && tournament) {
    return (
      <div className="tournament-lobby">
        <div className="lobby-header">
          <button className="back-button" onClick={handleLeaveTournament}>← LEAVE</button>
          <h1>{tournament.meta.name}</h1>
          <div className="tournament-code">
            CODE: <span>{tournamentCode}</span>
          </div>
        </div>

        <div className="lobby-content waiting-phase">
          <div className="player-count">
            {playerCount} / {tournament.meta.size} PLAYERS
          </div>

          <div className="players-grid">
            {Object.values(tournament.players).map(player => (
              <div key={player.id} className={`player-card ${player.status === 'ready' ? 'ready' : ''} ${player.id === playerId ? 'me' : ''}`}>
                {player.character && (
                  <img src={player.character.faceImage} alt={player.character.name} className="player-face" />
                )}
                <div className="player-info">
                  <span className="player-name">{player.name}</span>
                  <span className={`player-status ${player.status}`}>
                    {player.status === 'ready' ? 'READY' : 'NOT READY'}
                  </span>
                </div>
                {player.id === tournament.meta.creatorId && (
                  <span className="host-badge">HOST</span>
                )}
              </div>
            ))}

            {Array.from({ length: tournament.meta.size - playerCount }).map((_, i) => (
              <div key={`empty-${i}`} className="player-card empty">
                <span className="waiting-text">Waiting...</span>
              </div>
            ))}
          </div>

          <div className="character-select-section">
            <h3>SELECT YOUR FIGHTER</h3>
            <div className="character-select-layout">
              {/* Character Grid */}
              <div className="character-grid-panel">
                <div className="character-grid">
                  {characters.map(char => (
                    <button
                      key={char.id}
                      className={`char-btn ${myCharacter.id === char.id ? 'selected' : ''}`}
                      onClick={() => setMyCharacter(char)}
                      disabled={myPlayer?.status === 'ready'}
                    >
                      <img src={char.faceImage} alt={char.name} />
                      <span className="char-name">{char.name}</span>
                      {myCharacter.id === char.id && <div className="select-cursor" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Selected Character Preview */}
              <div className="character-preview-panel">
                <div className="preview-card" style={{ borderColor: myCharacter.color }}>
                  <div className="preview-header" style={{ background: `linear-gradient(90deg, ${myCharacter.color}, ${myCharacter.secondaryColor})` }}>
                    <span className="preview-name">{myCharacter.name}</span>
                    <span className="preview-title">{myCharacter.jobTitle}</span>
                  </div>
                  <div className="preview-portrait">
                    <img src={myCharacter.faceImage} alt={myCharacter.name} />
                  </div>
                  <div className="preview-country">
                    <span className="country-flag-emoji">{myCharacter.countryFlag}</span>
                    <span className="country-name">{myCharacter.country}</span>
                  </div>
                  <div className="preview-description">
                    <p>{myCharacter.description}</p>
                  </div>
                  <div className="preview-stats">
                    <div className="stat-row">
                      <span className="stat-label">PWR</span>
                      <div className="stat-bar">
                        {[...Array(10)].map((_, i) => (
                          <div key={i} className={`stat-block ${i < myCharacter.stats.power ? 'filled power' : ''}`} />
                        ))}
                      </div>
                    </div>
                    <div className="stat-row">
                      <span className="stat-label">SPD</span>
                      <div className="stat-bar">
                        {[...Array(10)].map((_, i) => (
                          <div key={i} className={`stat-block ${i < myCharacter.stats.speed ? 'filled speed' : ''}`} />
                        ))}
                      </div>
                    </div>
                    <div className="stat-row">
                      <span className="stat-label">DEF</span>
                      <div className="stat-bar">
                        {[...Array(10)].map((_, i) => (
                          <div key={i} className={`stat-block ${i < myCharacter.stats.defense ? 'filled defense' : ''}`} />
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="preview-specialty">
                    <span className="specialty-label">SPECIALTY:</span>
                    <span className="specialty-value">{myCharacter.specialty}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="lobby-actions">
            {myPlayer?.status !== 'ready' && (
              <button className="action-btn ready-btn" onClick={handleReady}>
                READY!
              </button>
            )}
            {myPlayer?.status === 'ready' && !canStart && (
              <p className="waiting-message">Waiting for all players to ready up...</p>
            )}
            {canStart && (
              <button className="action-btn start-btn" onClick={handleStartTournament}>
                START TOURNAMENT!
              </button>
            )}
          </div>

          {error && <div className="error-message">{error}</div>}
        </div>

        <style>{lobbyStyles}</style>
      </div>
    );
  }

  // In Progress Phase
  if (phase === 'in_progress' && tournament) {
    const isEliminated = myPlayer?.status === 'eliminated';
    const isChampion = myPlayer?.status === 'champion';

    return (
      <div className="tournament-lobby">
        <div className="lobby-header">
          <button className="back-button" onClick={handleLeaveTournament}>← LEAVE</button>
          <h1>{tournament.meta.name}</h1>
          <div className="round-indicator">ROUND {tournament.meta.currentRound}</div>
        </div>

        <div className="lobby-content progress-phase">
          {isEliminated && (
            <div className="status-banner eliminated">
              <span>YOU HAVE BEEN ELIMINATED</span>
              <p>Watch the remaining matches below</p>
            </div>
          )}

          {isChampion && (
            <div className="status-banner champion">
              <span>🏆 YOU ARE THE CHAMPION! 🏆</span>
            </div>
          )}

          {!isEliminated && !isChampion && currentMatch && (
            <div className="match-status-panel">
              {currentMatch.status === 'pending' && currentMatch.player1Id && currentMatch.player2Id && !waitingForOpponent && (
                <>
                  <h3>YOUR MATCH</h3>
                  <p>Click ready when you're prepared to fight!</p>
                  <button className="action-btn ready-btn" onClick={handleMatchReady}>
                    READY FOR MATCH
                  </button>
                </>
              )}

              {currentMatch.status === 'pending' && currentMatch.player1Id && currentMatch.player2Id && waitingForOpponent && (
                <>
                  <h3>WAITING FOR OPPONENT</h3>
                  <p>You're ready! Waiting for your opponent...</p>
                  <div className="starting-indicator">
                    <div className="connecting-spinner small"></div>
                    <span>Opponent is getting ready...</span>
                  </div>
                </>
              )}

              {currentMatch.status === 'pending' && (!currentMatch.player1Id || !currentMatch.player2Id) && (
                <>
                  <h3>WAITING FOR OPPONENT</h3>
                  <p>Your next opponent is still battling...</p>
                  <div className="waiting-opponent">
                    <div className="fighter-preview">
                      <img src={myCharacter.faceImage} alt={myCharacter.name} />
                      <span>YOU</span>
                    </div>
                    <div className="vs">VS</div>
                    <div className="fighter-preview unknown">
                      <div className="unknown-fighter">?</div>
                      <span>TBD</span>
                    </div>
                  </div>
                  <div className="starting-indicator">
                    <div className="connecting-spinner small"></div>
                    <span>Waiting for other matches...</span>
                  </div>
                </>
              )}

              {currentMatch.status === 'ready' && matchOpponent && (
                <>
                  <h3>MATCH STARTING!</h3>
                  <div className="match-preview">
                    <div className="fighter-preview">
                      <img src={myCharacter.faceImage} alt={myCharacter.name} />
                      <span>YOU</span>
                    </div>
                    <div className="vs">VS</div>
                    <div className="fighter-preview">
                      <img src={matchOpponent.character?.faceImage || characters[0].faceImage} alt={matchOpponent.name} />
                      <span>{matchOpponent.name}</span>
                    </div>
                  </div>
                  <div className="starting-indicator">
                    <div className="connecting-spinner small"></div>
                    <span>{connectionStatus || 'Connecting to opponent...'}</span>
                  </div>
                </>
              )}

              {currentMatch.status === 'in_progress' && (
                <>
                  <h3>MATCH IN PROGRESS</h3>
                  <p>Return to your match!</p>
                  <button className="action-btn fight-btn" onClick={handleEnterMatch}>
                    REJOIN MATCH
                  </button>
                </>
              )}
            </div>
          )}

          <div className="bracket-section">
            <h3>TOURNAMENT BRACKET</h3>
            <TournamentBracket
              tournament={tournament}
              currentPlayerId={playerId}
              highlightMatchId={currentMatch?.matchId}
            />
          </div>
        </div>

        <style>{lobbyStyles}</style>
      </div>
    );
  }

  // Fallback
  return (
    <div className="tournament-lobby">
      <div className="lobby-header">
        <button className="back-button" onClick={onBack}>← BACK</button>
        <h1>TOURNAMENT</h1>
      </div>
      <div className="lobby-content">
        <p>Loading...</p>
      </div>
      <style>{lobbyStyles}</style>
    </div>
  );
};

const lobbyStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');

  .tournament-lobby {
    min-height: 100vh;
    height: auto;
    background: #0a0a15;
    padding: 2rem 2rem 3rem;
    display: block;
    font-family: 'Press Start 2P', monospace;
    position: relative;
    overflow: visible;
  }

  .tournament-lobby::before {
    content: '';
    position: fixed;
    inset: 0;
    background: radial-gradient(ellipse at 50% 30%, rgba(255, 204, 0, 0.1) 0%, transparent 50%);
    pointer-events: none;
    z-index: 0;
  }

  .tournament-lobby::after {
    content: '';
    position: fixed;
    inset: 0;
    background: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.3) 2px, rgba(0,0,0,0.3) 4px);
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
    flex-wrap: wrap;
  }

  .lobby-header h1 {
    font-size: 1.5rem;
    color: #ffcc00;
    text-shadow: 3px 3px 0 #996600, 6px 6px 0 #000;
    flex: 1;
    text-align: center;
    margin: 0;
  }

  .back-button {
    padding: 0.6rem 1rem;
    font-family: 'Press Start 2P', monospace;
    font-size: 0.7rem;
    color: #fff;
    background: linear-gradient(180deg, #333 0%, #111 100%);
    border: 3px solid #555;
    cursor: pointer;
  }

  .back-button:hover {
    background: linear-gradient(180deg, #444 0%, #222 100%);
    border-color: #777;
  }

  .tournament-code, .round-indicator {
    font-size: 0.7rem;
    color: #888;
    padding: 0.5rem 1rem;
    background: linear-gradient(180deg, #1a1a2e 0%, #0d0d1a 100%);
    border: 3px solid #ffcc00;
  }

  .tournament-code span {
    color: #ffcc00;
    letter-spacing: 0.2em;
    text-shadow: 0 0 10px #ffcc00;
  }

  .round-indicator {
    border-color: #44BB44;
    color: #44BB44;
  }

  .lobby-content {
    position: relative;
    z-index: 1;
  }

  .menu-phase {
    max-width: 800px;
    margin: 0 auto;
  }

  .name-input-section {
    text-align: center;
    margin-bottom: 2rem;
  }

  .name-input-section label {
    display: block;
    font-size: 0.7rem;
    color: #ffcc00;
    margin-bottom: 0.5rem;
  }

  .name-input-section input {
    width: 100%;
    max-width: 300px;
    padding: 0.8rem;
    font-family: 'Press Start 2P', monospace;
    font-size: 0.8rem;
    text-align: center;
    background: #000;
    border: 3px solid #555;
    color: #fff;
  }

  .name-input-section input:focus {
    outline: none;
    border-color: #ffcc00;
  }

  .menu-options {
    display: flex;
    gap: 2rem;
    justify-content: center;
    flex-wrap: wrap;
  }

  .menu-option {
    background: linear-gradient(180deg, #1a1a2e 0%, #0d0d1a 100%);
    border: 4px solid #333;
    padding: 1.5rem;
    text-align: center;
    width: 300px;
  }

  .menu-option h2 {
    font-size: 0.8rem;
    color: #ffcc00;
    margin: 0 0 1rem 0;
  }

  .menu-option input {
    width: 100%;
    padding: 0.8rem;
    font-family: 'Press Start 2P', monospace;
    font-size: 0.7rem;
    text-align: center;
    background: #000;
    border: 3px solid #555;
    color: #ffcc00;
    margin-bottom: 1rem;
  }

  .menu-option input::placeholder {
    color: #444;
  }

  .menu-option input:focus {
    outline: none;
    border-color: #ffcc00;
  }

  .size-selector {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .size-btn {
    flex: 1;
    padding: 0.6rem;
    font-family: 'Press Start 2P', monospace;
    font-size: 0.5rem;
    background: #222;
    border: 2px solid #555;
    color: #888;
    cursor: pointer;
  }

  .size-btn.selected {
    background: linear-gradient(180deg, #ffcc00 0%, #cc9900 100%);
    border-color: #fff;
    color: #000;
  }

  .size-btn:hover:not(.selected) {
    border-color: #888;
  }

  .menu-divider {
    display: flex;
    align-items: center;
    font-size: 1rem;
    color: #555;
  }

  .action-btn {
    padding: 0.8rem 2rem;
    font-family: 'Press Start 2P', monospace;
    font-size: 0.7rem;
    border: 4px solid #fff;
    cursor: pointer;
    box-shadow: 4px 4px 0 #000;
    transition: all 0.1s;
  }

  .action-btn:hover {
    transform: translateY(-2px);
    box-shadow: 6px 6px 0 #000;
  }

  .action-btn:active {
    transform: translateY(2px);
    box-shadow: 2px 2px 0 #000;
  }

  .create-btn, .ready-btn {
    background: linear-gradient(180deg, #44BB44 0%, #228822 100%);
    color: #000;
  }

  .join-btn {
    background: linear-gradient(180deg, #FF66AA 0%, #CC3388 100%);
    color: #000;
  }

  .start-btn, .fight-btn {
    background: linear-gradient(180deg, #ff6666 0%, #cc0000 100%);
    color: #fff;
    animation: startGlow 1s ease-in-out infinite;
  }

  @keyframes startGlow {
    0%, 100% { box-shadow: 4px 4px 0 #000, 0 0 20px rgba(255, 68, 68, 0.3); }
    50% { box-shadow: 4px 4px 0 #000, 0 0 40px rgba(255, 68, 68, 0.6); }
  }

  .connecting-phase {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 50vh;
    gap: 1rem;
  }

  .connecting-spinner {
    width: 60px;
    height: 60px;
    border: 6px solid #333;
    border-top-color: #ffcc00;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .connecting-spinner.small {
    width: 30px;
    height: 30px;
    border-width: 4px;
  }

  .starting-indicator {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.8rem;
  }

  .starting-indicator span {
    font-size: 0.5rem;
    color: #44BB44;
    animation: blink 1s step-end infinite;
  }

  .connecting-phase p {
    font-size: 0.8rem;
    color: #ffcc00;
  }

  .waiting-phase, .progress-phase {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.5rem;
  }

  .player-count {
    font-size: 1rem;
    color: #ffcc00;
    text-shadow: 2px 2px 0 #000;
  }

  .players-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 1rem;
    width: 100%;
    max-width: 800px;
  }

  .player-card {
    background: linear-gradient(180deg, #1a1a2e 0%, #0d0d1a 100%);
    border: 3px solid #333;
    padding: 0.8rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    position: relative;
  }

  .player-card.me {
    border-color: #FF66AA;
  }

  .player-card.ready {
    border-color: #44BB44;
  }

  .player-card.empty {
    border-style: dashed;
    opacity: 0.5;
  }

  .player-face {
    width: 60px;
    height: 60px;
    object-fit: cover;
    border: 2px solid #555;
  }

  .player-info {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.3rem;
  }

  .player-name {
    font-size: 0.5rem;
    color: #fff;
  }

  .player-status {
    font-size: 0.4rem;
    padding: 0.2rem 0.5rem;
  }

  .player-status.joined {
    color: #888;
  }

  .player-status.ready {
    color: #44BB44;
    text-shadow: 0 0 5px #44BB44;
  }

  .host-badge {
    position: absolute;
    top: 0.3rem;
    right: 0.3rem;
    font-size: 0.35rem;
    background: #ffcc00;
    color: #000;
    padding: 0.15rem 0.3rem;
  }

  .waiting-text {
    font-size: 0.4rem;
    color: #555;
  }

  .character-select-section {
    width: 100%;
    max-width: 900px;
    background: linear-gradient(180deg, #1a1a2e 0%, #0d0d1a 100%);
    border: 4px solid #ffcc00;
    padding: 1.5rem;
    box-shadow: 0 0 30px rgba(255, 204, 0, 0.2);
  }

  .character-select-section h3 {
    font-size: 0.9rem;
    color: #ffcc00;
    text-align: center;
    margin: 0 0 1.5rem 0;
    text-shadow: 2px 2px 0 #996600, 4px 4px 0 #000;
  }

  .character-select-layout {
    display: flex;
    gap: 1.5rem;
    justify-content: center;
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .character-grid-panel {
    background: #111;
    border: 3px solid #444;
    padding: 0.8rem;
  }

  .character-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.5rem;
  }

  .char-btn {
    position: relative;
    width: 70px;
    height: 85px;
    padding: 0;
    border: 3px solid #555;
    background: #111;
    cursor: pointer;
    overflow: hidden;
    transition: all 0.1s;
  }

  .char-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .char-btn img {
    width: 100%;
    height: 60px;
    object-fit: cover;
  }

  .char-btn .char-name {
    display: block;
    font-size: 0.35rem;
    color: #fff;
    background: rgba(0, 0, 0, 0.8);
    padding: 0.25rem;
    text-align: center;
  }

  .char-btn .select-cursor {
    position: absolute;
    inset: -5px;
    border: 3px solid #ffcc00;
    animation: cursorBlink 0.3s step-end infinite;
    pointer-events: none;
  }

  @keyframes cursorBlink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  .char-btn:hover:not(:disabled) {
    border-color: #888;
    transform: scale(1.05);
    z-index: 2;
  }

  .char-btn.selected {
    border-color: #ffcc00;
    box-shadow: 0 0 20px rgba(255, 204, 0, 0.5);
  }

  /* Character Preview Panel */
  .character-preview-panel {
    width: 250px;
    flex-shrink: 0;
  }

  .preview-card {
    background: #111;
    border: 4px solid;
    display: flex;
    flex-direction: column;
  }

  .preview-header {
    padding: 0.6rem;
    text-align: center;
  }

  .preview-name {
    display: block;
    font-size: 0.9rem;
    color: #fff;
    text-shadow: 2px 2px 0 #000;
  }

  .preview-title {
    display: block;
    font-size: 0.4rem;
    color: rgba(255,255,255,0.8);
    margin-top: 0.3rem;
  }

  .preview-portrait {
    background: #000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.5rem;
  }

  .preview-portrait img {
    width: 100%;
    height: 140px;
    object-fit: cover;
    border: 2px solid #333;
  }

  .preview-country {
    background: #222;
    padding: 0.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }

  .preview-country .country-flag-emoji {
    font-size: 1.5rem;
    font-family: "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif;
  }

  .preview-country .country-name {
    font-size: 0.45rem;
    color: #aaa;
  }

  .preview-description {
    background: #0d0d1a;
    padding: 0.6rem;
    border-top: 1px solid #333;
    border-bottom: 1px solid #333;
  }

  .preview-description p {
    font-size: 0.4rem;
    color: #ccc;
    line-height: 1.8;
    margin: 0;
    text-align: center;
  }

  .preview-stats {
    padding: 0.6rem;
    background: #0a0a15;
  }

  .preview-stats .stat-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.4rem;
  }

  .preview-stats .stat-row:last-child {
    margin-bottom: 0;
  }

  .preview-stats .stat-label {
    width: 35px;
    font-size: 0.4rem;
    color: #888;
  }

  .preview-stats .stat-bar {
    display: flex;
    gap: 2px;
    flex: 1;
  }

  .preview-stats .stat-block {
    width: 15px;
    height: 10px;
    background: #222;
    border: 1px solid #333;
  }

  .preview-stats .stat-block.filled.power {
    background: linear-gradient(180deg, #ff6666 0%, #cc0000 100%);
    border-color: #ff0000;
    box-shadow: 0 0 5px rgba(255, 0, 0, 0.5);
  }

  .preview-stats .stat-block.filled.speed {
    background: linear-gradient(180deg, #66aaff 0%, #0066cc 100%);
    border-color: #0088ff;
    box-shadow: 0 0 5px rgba(0, 136, 255, 0.5);
  }

  .preview-stats .stat-block.filled.defense {
    background: linear-gradient(180deg, #66ff66 0%, #00cc00 100%);
    border-color: #00ff00;
    box-shadow: 0 0 5px rgba(0, 255, 0, 0.5);
  }

  .preview-specialty {
    background: #1a1a2e;
    padding: 0.5rem;
    display: flex;
    gap: 0.4rem;
    align-items: center;
    justify-content: center;
    flex-wrap: wrap;
  }

  .preview-specialty .specialty-label {
    font-size: 0.35rem;
    color: #888;
  }

  .preview-specialty .specialty-value {
    font-size: 0.35rem;
    color: #ff6600;
    background: rgba(255, 102, 0, 0.2);
    padding: 0.2rem 0.4rem;
    border: 1px solid #ff6600;
  }

  .lobby-actions {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
  }

  .waiting-message {
    font-size: 0.5rem;
    color: #888;
    animation: blink 1s step-end infinite;
  }

  @keyframes blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  .error-message {
    padding: 0.8rem 1.5rem;
    font-size: 0.5rem;
    background: linear-gradient(180deg, #440000 0%, #220000 100%);
    border: 3px solid #FF4444;
    color: #FF4444;
    margin-top: 1rem;
  }

  .status-banner {
    padding: 1rem 2rem;
    text-align: center;
    border: 4px solid;
    margin-bottom: 1rem;
  }

  .status-banner.eliminated {
    background: linear-gradient(180deg, #440000 0%, #220000 100%);
    border-color: #FF4444;
    color: #FF4444;
  }

  .status-banner.champion {
    background: linear-gradient(180deg, #2a2a00 0%, #1a1a00 100%);
    border-color: #ffcc00;
    color: #ffcc00;
    font-size: 1rem;
    animation: championGlow 1s ease-in-out infinite;
  }

  @keyframes championGlow {
    0%, 100% { box-shadow: 0 0 20px rgba(255, 204, 0, 0.3); }
    50% { box-shadow: 0 0 40px rgba(255, 204, 0, 0.6); }
  }

  .status-banner span {
    font-size: 0.8rem;
  }

  .status-banner p {
    font-size: 0.5rem;
    margin-top: 0.5rem;
    opacity: 0.7;
  }

  .match-status-panel {
    background: linear-gradient(180deg, #1a1a2e 0%, #0d0d1a 100%);
    border: 4px solid #ffcc00;
    padding: 1.5rem;
    text-align: center;
    max-width: 500px;
    width: 100%;
  }

  .match-status-panel h3 {
    font-size: 0.8rem;
    color: #ffcc00;
    margin: 0 0 1rem 0;
  }

  .match-status-panel p {
    font-size: 0.5rem;
    color: #888;
    margin-bottom: 1rem;
  }

  .match-preview {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1.5rem;
    margin-bottom: 1.5rem;
  }

  .fighter-preview {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
  }

  .fighter-preview img {
    width: 80px;
    height: 80px;
    object-fit: cover;
    border: 3px solid #555;
  }

  .fighter-preview span {
    font-size: 0.5rem;
    color: #fff;
  }

  .vs {
    font-size: 1.5rem;
    color: #ff4444;
    text-shadow: 2px 2px 0 #000, 0 0 20px rgba(255, 68, 68, 0.5);
  }

  .waiting-opponent {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1.5rem;
    margin-bottom: 1.5rem;
  }

  .fighter-preview.unknown .unknown-fighter {
    width: 80px;
    height: 80px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 2.5rem;
    color: #555;
    background: linear-gradient(180deg, #1a1a2e 0%, #0d0d1a 100%);
    border: 3px solid #333;
    animation: questionPulse 2s ease-in-out infinite;
  }

  @keyframes questionPulse {
    0%, 100% { color: #555; border-color: #333; }
    50% { color: #888; border-color: #555; }
  }

  .bracket-section {
    width: 100%;
    background: linear-gradient(180deg, #1a1a2e 0%, #0d0d1a 100%);
    border: 3px solid #333;
    padding: 1rem;
  }

  .bracket-section h3 {
    font-size: 0.7rem;
    color: #ffcc00;
    text-align: center;
    margin: 0 0 1rem 0;
  }

  /* Responsive */
  @media (max-width: 700px) {
    .tournament-lobby {
      padding: 1rem;
    }

    .lobby-header {
      flex-direction: column;
      gap: 0.8rem;
    }

    .lobby-header h1 {
      font-size: 1.2rem;
    }

    .menu-options {
      flex-direction: column;
      align-items: center;
    }

    .menu-divider {
      margin: 1rem 0;
    }

    .players-grid {
      grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    }

    .player-face {
      width: 50px;
      height: 50px;
    }

    .character-select-section {
      padding: 1rem;
    }

    .character-select-section h3 {
      font-size: 0.7rem;
    }

    .character-select-layout {
      flex-direction: column;
      align-items: center;
    }

    .character-grid {
      grid-template-columns: repeat(4, 1fr);
    }

    .char-btn {
      width: 55px;
      height: 70px;
    }

    .char-btn img {
      height: 48px;
    }

    .char-btn .char-name {
      font-size: 0.3rem;
    }

    .character-preview-panel {
      width: 100%;
      max-width: 280px;
    }

    .preview-portrait img {
      height: 100px;
    }

    .preview-stats .stat-block {
      width: 12px;
      height: 8px;
    }

    .match-preview {
      gap: 1rem;
    }

    .fighter-preview img {
      width: 60px;
      height: 60px;
    }
  }
`;
