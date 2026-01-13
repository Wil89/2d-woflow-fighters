import { useState } from 'react';
import type { GameScreen, CharacterData, MapData, GameMode } from './types/game';
import { MainMenu } from './components/MainMenu';
import { ModeSelect } from './components/ModeSelect';
import { CharacterSelect } from './components/CharacterSelect';
import { MapSelect } from './components/MapSelect';
import { OnlineLobby } from './components/OnlineLobby';
import { TournamentLobby } from './components/TournamentLobby';
import { Game } from './components/Game';
import './App.css';

function App() {
  const [screen, setScreen] = useState<GameScreen>('menu');
  const [selectedMode, setSelectedMode] = useState<GameMode | null>(null);
  const [selectedCharacter, setSelectedCharacter] = useState<CharacterData | null>(null);
  const [selectedMap, setSelectedMap] = useState<MapData | null>(null);
  // Online multiplayer state
  const [isHost, setIsHost] = useState(false);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [opponentCharacter, setOpponentCharacter] = useState<CharacterData | null>(null);

  // Tournament state
  const [tournamentCode, setTournamentCode] = useState<string | null>(null);
  const [tournamentMatchId, setTournamentMatchId] = useState<string | null>(null);
  const [tournamentRound, setTournamentRound] = useState<number | null>(null);

  const handleStart = () => {
    setScreen('modeSelect');
  };

  const handleModeSelect = (mode: GameMode) => {
    setSelectedMode(mode);
    if (mode === 'online') {
      setScreen('onlineLobby');
    } else if (mode === 'tournament') {
      setScreen('tournamentLobby');
    } else {
      setScreen('characterSelect');
    }
  };

  const handleCharacterSelect = (character: CharacterData) => {
    setSelectedCharacter(character);
    setScreen('mapSelect');
  };

  const handleMapSelect = (map: MapData) => {
    setSelectedMap(map);
    setScreen('game');
  };

  const handleBackToMenu = () => {
    setScreen('menu');
    setSelectedMode(null);
    setSelectedCharacter(null);
    setSelectedMap(null);
    setIsHost(false);
    setRoomCode(null);
    setOpponentCharacter(null);
    setTournamentCode(null);
    setTournamentMatchId(null);
    setTournamentRound(null);
  };

  const handleBackToModeSelect = () => {
    setScreen('modeSelect');
    setSelectedMode(null);
    setSelectedCharacter(null);
    setSelectedMap(null);
  };

  const handleBackToCharacterSelect = () => {
    setScreen('characterSelect');
    setSelectedMap(null);
  };

  // Online lobby handlers
  const handleLobbyBack = () => {
    setScreen('modeSelect');
    setSelectedMode(null);
    setRoomCode(null);
    setIsHost(false);
  };

  return (
    <div className="app">
      {screen === 'menu' && (
        <MainMenu onStart={handleStart} />
      )}

      {screen === 'modeSelect' && (
        <ModeSelect
          onSelect={handleModeSelect}
          onBack={handleBackToMenu}
        />
      )}

      {screen === 'characterSelect' && (
        <CharacterSelect
          onSelect={handleCharacterSelect}
          onBack={handleBackToModeSelect}
        />
      )}

      {screen === 'mapSelect' && selectedCharacter && (
        <MapSelect
          selectedCharacter={selectedCharacter}
          onSelect={handleMapSelect}
          onBack={handleBackToCharacterSelect}
        />
      )}

      {screen === 'onlineLobby' && (
        <OnlineLobby
          onGameStart={(character, opponent, map, host, code) => {
            setSelectedCharacter(character);
            setOpponentCharacter(opponent);
            setSelectedMap(map);
            setIsHost(host);
            setRoomCode(code);
            setScreen('game');
          }}
          onBack={handleLobbyBack}
        />
      )}

      {screen === 'tournamentLobby' && (
        <TournamentLobby
          onMatchStart={(character, opponent, map, host, roomCode, matchId, roundNumber, tCode) => {
            setSelectedCharacter(character);
            setOpponentCharacter(opponent);
            setSelectedMap(map);
            setIsHost(host);
            setRoomCode(roomCode);
            setTournamentMatchId(matchId);
            setTournamentRound(roundNumber);
            setTournamentCode(tCode);
            setSelectedMode('tournament');
            setScreen('game');
          }}
          onBack={handleLobbyBack}
        />
      )}

      {screen === 'game' && selectedCharacter && selectedMap && selectedMode && (
        <Game
          playerCharacter={selectedCharacter}
          opponentCharacter={opponentCharacter}
          map={selectedMap}
          gameMode={selectedMode}
          isHost={isHost}
          roomCode={roomCode}
          tournamentCode={tournamentCode}
          tournamentMatchId={tournamentMatchId}
          tournamentRound={tournamentRound}
          onBack={selectedMode === 'tournament' ? () => {
            setScreen('tournamentLobby');
            setTournamentMatchId(null);
            setRoomCode(null);
          } : handleBackToMenu}
        />
      )}
    </div>
  );
}

export default App;
