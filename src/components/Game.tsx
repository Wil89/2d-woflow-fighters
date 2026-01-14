import { useEffect, useRef, useState, useCallback } from 'react';
import type { GameState, CharacterData, MapData, Fighter, Particle, Projectile, TextPopup, SoundEvent, GameMode } from '../types/game';
import type { InputState } from '../engine/GameEngine';
import { createInitialGameState, updateGameState } from '../engine/GameEngine';
import { characters } from '../data/gameData';
import {
  initAudio,
  playPunchSound,
  playKickSound,
  playSpecialSound,
  playBlockSound,
  playWhiffSound,
  playKOSound,
  playVictorySound,
  playCountdownSound,
} from '../utils/sounds';
import { multiplayerService } from '../services/multiplayer-firebase';
import { tournamentService } from '../services/tournament-firebase';

interface GameProps {
  playerCharacter: CharacterData;
  opponentCharacter?: CharacterData | null; // For online mode, opponent is specified
  map: MapData;
  gameMode: GameMode;
  isHost?: boolean;
  roomCode?: string | null;
  // Tournament mode props
  tournamentCode?: string | null;
  tournamentMatchId?: string | null;
  tournamentRound?: number | null;
  onBack: () => void;
}

const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 600;
const FIGHTER_HEIGHT = 140;

export const Game = ({ playerCharacter, opponentCharacter, map, gameMode, isHost, roomCode, tournamentCode: _tournamentCode, tournamentMatchId, tournamentRound, onBack }: GameProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameStateRef = useRef<GameState | null>(null);
  const inputRef = useRef<InputState>({
    left: false,
    right: false,
    up: false,
    down: false,
    punch: false,
    kick: false,
    special: false,
    block: false,
  });
  const lastPunchRef = useRef(false);
  const lastKickRef = useRef(false);
  const lastSpecialRef = useRef(false);
  const [gamePhase, setGamePhase] = useState<'intro' | 'fighting' | 'ko' | 'roundEnd' | 'victory'>('intro');
  const introCountRef = useRef(3);
  const backgroundImageRef = useRef<HTMLImageElement | null>(null);
  const faceImagesRef = useRef<Map<string, HTMLImageElement>>(new Map());

  // Best of 3 rounds
  const [currentRound, setCurrentRound] = useState(1);
  const [playerWins, setPlayerWins] = useState(0);
  const [opponentWins, setOpponentWins] = useState(0);
  const playerWinsRef = useRef(0);
  const opponentWinsRef = useRef(0);
  const roundWinnerRef = useRef<'player' | 'opponent' | null>(null);
  const matchOverRef = useRef(false);
  const tournamentResultReportedRef = useRef(false);
  const victoryQuoteRef = useRef<string | null>(null);

  // Keep refs in sync with state for use in effects
  useEffect(() => {
    playerWinsRef.current = playerWins;
  }, [playerWins]);

  useEffect(() => {
    opponentWinsRef.current = opponentWins;
  }, [opponentWins]);

  // Online multiplayer state
  const frameCountRef = useRef(0);
  const remoteInputRef = useRef<InputState>({
    left: false,
    right: false,
    up: false,
    down: false,
    punch: false,
    kick: false,
    special: false,
    block: false,
  });
  const lastRemotePunchRef = useRef(false);
  const lastRemoteKickRef = useRef(false);
  const lastRemoteSpecialRef = useRef(false);

  // Store the opponent for consistent reference
  const opponentRef = useRef<CharacterData | null>(null);

  // Lock body scroll during gameplay
  useEffect(() => {
    document.body.classList.add('game-active');
    return () => {
      document.body.classList.remove('game-active');
    };
  }, []);

  // Initialize game
  useEffect(() => {
    const opponent = opponentCharacter || (() => {
      const others = characters.filter(c => c.id !== playerCharacter.id);
      return others[Math.floor(Math.random() * others.length)];
    })();
    opponentRef.current = opponent;

    // For online/tournament mode, both players need the SAME game state perspective
    // Host's character is always "player" (left side), Guest's character is always "opponent" (right side)
    const isMultiplayer = gameMode === 'online' || gameMode === 'tournament';
    if (isMultiplayer && !isHost) {
      // Guest: swap characters so both clients see the same game
      // playerCharacter = guest's char, opponent = host's char
      // We want: player = host's char (opponent), opponent = guest's char (playerCharacter)
      gameStateRef.current = createInitialGameState(opponent, playerCharacter);
    } else {
      gameStateRef.current = createInitialGameState(playerCharacter, opponent);
    }

    // Load background image
    const img = new Image();
    img.src = map.image;
    img.onload = () => {
      backgroundImageRef.current = img;
    };

    // Load face images for both fighters
    const loadFaceImage = (character: CharacterData) => {
      const faceImg = new Image();
      faceImg.src = character.faceImage;
      faceImg.onload = () => {
        faceImagesRef.current.set(character.id, faceImg);
      };
    };
    loadFaceImage(playerCharacter);
    loadFaceImage(opponent);

    // Intro countdown
    introCountRef.current = 3;
    setGamePhase('intro');
    // Play initial countdown sound
    initAudio();
    playCountdownSound(false);
    const introInterval = setInterval(() => {
      introCountRef.current--;
      if (introCountRef.current <= 0) {
        clearInterval(introInterval);
        // Play "FIGHT!" sound
        playCountdownSound(true);
        // Show "FIGHT!" text for 800ms before starting
        setTimeout(() => {
          if (gameStateRef.current) {
            gameStateRef.current.gamePhase = 'fighting';
          }
          setGamePhase('fighting');
        }, 800);
      } else {
        // Play countdown beep
        playCountdownSound(false);
      }
    }, 1000);

    return () => {
      clearInterval(introInterval);
    };
    // These props are stable on mount and shouldn't change during gameplay
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerCharacter.id, map.id, gameMode, isHost]);

  // Setup multiplayer input callbacks for online/tournament mode
  useEffect(() => {
    const isMultiplayer = gameMode === 'online' || gameMode === 'tournament';
    if (!isMultiplayer) return;

    multiplayerService.setCallbacks({
      onStatusChange: () => {},
      onRemoteInput: (_frame, input) => {
        remoteInputRef.current = input;
      },
      onRemoteCharacter: () => {},
      onRemoteMap: () => {},
      onRemoteReady: () => {},
      onGameStart: () => {},
      onError: (error) => console.error('Multiplayer error:', error),
      onLatencyUpdate: () => {},
      // Guest receives game state from host
      onGameStateSync: (state) => {
        if (!isHost && state) {
          gameStateRef.current = state as GameState;
          // Sync phase state for UI
          if (gameStateRef.current.gamePhase !== gamePhase) {
            setGamePhase(gameStateRef.current.gamePhase);
          }
        }
      },
    });
  }, [gameMode, isHost, gamePhase]);

  // Play sound based on event type
  const playSoundEvent = useCallback((event: SoundEvent) => {
    switch (event) {
      case 'punch':
        playPunchSound();
        break;
      case 'kick':
        playKickSound();
        break;
      case 'special':
        playSpecialSound();
        break;
      case 'block':
        playBlockSound();
        break;
      case 'whiff':
        playWhiffSound();
        break;
      case 'ko':
        playKOSound();
        break;
      case 'victory':
        playVictorySound();
        break;
    }
  }, []);

  // Handle input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Initialize audio on first key press
      initAudio();
      // Prevent default for arrow keys to avoid page scrolling
      if (e.key.startsWith('Arrow')) {
        e.preventDefault();
      }
      if (e.key === 'ArrowLeft') inputRef.current.left = true;
      if (e.key === 'ArrowRight') inputRef.current.right = true;
      if (e.key === 'ArrowUp') inputRef.current.up = true;
      if (e.key === 'ArrowDown') inputRef.current.down = true;
      const key = e.key.toLowerCase();
      if (key === 'f') inputRef.current.punch = true;
      if (key === 'g') inputRef.current.kick = true;
      if (key === 'h') inputRef.current.special = true;
      if (key === 'shift') inputRef.current.block = true;
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') inputRef.current.left = false;
      if (e.key === 'ArrowRight') inputRef.current.right = false;
      if (e.key === 'ArrowUp') inputRef.current.up = false;
      if (e.key === 'ArrowDown') inputRef.current.down = false;
      const key = e.key.toLowerCase();
      if (key === 'f') inputRef.current.punch = false;
      if (key === 'g') inputRef.current.kick = false;
      if (key === 'h') inputRef.current.special = false;
      if (key === 'shift') inputRef.current.block = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Game loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;

    const gameLoop = () => {
      if (!gameStateRef.current) {
        animationId = requestAnimationFrame(gameLoop);
        return;
      }

      // Create input for this frame (only trigger punch/kick/special once per press)
      let input: InputState = {
        ...inputRef.current,
        punch: inputRef.current.punch && !lastPunchRef.current,
        kick: inputRef.current.kick && !lastKickRef.current,
        special: inputRef.current.special && !lastSpecialRef.current,
      };
      lastPunchRef.current = inputRef.current.punch;
      lastKickRef.current = inputRef.current.kick;
      lastSpecialRef.current = inputRef.current.special;

      // Online/tournament multiplayer with authoritative host
      const isMultiplayer = gameMode === 'online' || gameMode === 'tournament';
      if (isMultiplayer) {
        // Always send our input
        frameCountRef.current++;
        multiplayerService.sendInput(frameCountRef.current, inputRef.current);

        if (isHost) {
          // HOST: Run game logic with both inputs
          // Process remote input (guest's input controls the opponent)
          const remoteInput: InputState = {
            ...remoteInputRef.current,
            punch: remoteInputRef.current.punch && !lastRemotePunchRef.current,
            kick: remoteInputRef.current.kick && !lastRemoteKickRef.current,
            special: remoteInputRef.current.special && !lastRemoteSpecialRef.current,
          };
          lastRemotePunchRef.current = remoteInputRef.current.punch;
          lastRemoteKickRef.current = remoteInputRef.current.kick;
          lastRemoteSpecialRef.current = remoteInputRef.current.special;

          const opponent = opponentRef.current;
          const updateResult = updateGameState(
            gameStateRef.current,
            input,  // Host's input controls player (left)
            playerCharacter.attacks,
            opponent?.attacks || playerCharacter.attacks,
            1 / 60,
            gameMode,
            remoteInput,  // Guest's input controls opponent (right)
            playerCharacter.projectileText,
            opponent?.projectileText || 'SPECIAL'
          );
          gameStateRef.current = updateResult.state;

          // Play sound events
          updateResult.soundEvents.forEach(playSoundEvent);

          // Send game state to guest
          multiplayerService.sendGameState(gameStateRef.current);

          // Sync phase state
          if (gameStateRef.current.gamePhase !== gamePhase) {
            setGamePhase(gameStateRef.current.gamePhase);
          }
        }
        // GUEST: State is updated via onGameStateSync callback, just render
      } else {
        // Offline modes (training, vs-cpu)
        const opponent = opponentRef.current;
        const updateResult = updateGameState(
          gameStateRef.current,
          input,
          playerCharacter.attacks,
          opponent?.attacks || playerCharacter.attacks,
          1 / 60,
          gameMode,
          undefined,  // No remote input for offline modes
          playerCharacter.projectileText,
          opponent?.projectileText || 'SPECIAL'
        );
        gameStateRef.current = updateResult.state;

        // Play sound events
        updateResult.soundEvents.forEach(playSoundEvent);

        // Sync phase state
        if (gameStateRef.current.gamePhase !== gamePhase) {
          setGamePhase(gameStateRef.current.gamePhase);
        }
      }

      // Render (both host and guest render their state)
      render(ctx, gameStateRef.current);

      animationId = requestAnimationFrame(gameLoop);
    };

    animationId = requestAnimationFrame(gameLoop);

    return () => cancelAnimationFrame(animationId);
  }, [playerCharacter, gamePhase, playSoundEvent, gameMode, isHost]);

  const render = (ctx: CanvasRenderingContext2D, state: GameState) => {
    const { camera, player, opponent, particles, projectiles, textPopups } = state;

    ctx.save();

    // Apply camera shake
    const shakeX = (Math.random() - 0.5) * camera.shake;
    const shakeY = (Math.random() - 0.5) * camera.shake;
    ctx.translate(shakeX, shakeY);

    // Apply camera zoom
    const zoomOffsetX = (CANVAS_WIDTH * (1 - camera.zoom)) / 2;
    const zoomOffsetY = (CANVAS_HEIGHT * (1 - camera.zoom)) / 2;
    ctx.translate(zoomOffsetX, zoomOffsetY);
    ctx.scale(camera.zoom, camera.zoom);

    // Draw background
    if (backgroundImageRef.current) {
      ctx.drawImage(backgroundImageRef.current, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    } else {
      // Fallback gradient
      const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
      gradient.addColorStop(0, '#87CEEB');
      gradient.addColorStop(1, '#228B22');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }

    // Draw ground line
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, map.groundY + 5);
    ctx.lineTo(CANVAS_WIDTH, map.groundY + 5);
    ctx.stroke();

    // Draw fighters
    drawFighter(ctx, player, true);
    drawFighter(ctx, opponent, false);

    // Draw projectiles
    projectiles.forEach(p => drawProjectile(ctx, p));

    // Draw particles
    particles.forEach(p => drawParticle(ctx, p));

    // Draw text popups
    textPopups.forEach(p => drawTextPopup(ctx, p));

    ctx.restore();

    // Draw UI (not affected by camera)
    drawUI(ctx, state);

    // Draw intro/ko overlay
    if (state.gamePhase === 'intro' && introCountRef.current > 0) {
      drawIntroOverlay(ctx, introCountRef.current);
    } else if (state.gamePhase === 'intro' && introCountRef.current === 0) {
      drawFightText(ctx);
    }

    // Draw round end overlay (not match end)
    if (gamePhase === 'roundEnd') {
      drawRoundEndOverlay(ctx);
    }

    // Only show final victory when match is over (2 wins)
    if (state.gamePhase === 'victory' && matchOverRef.current) {
      drawVictoryOverlay(ctx, state.winner === 'player' ? player : opponent);
    }

    // Draw round indicators
    drawRoundIndicators(ctx);
  };

  const drawRoundIndicators = (ctx: CanvasRenderingContext2D) => {
    const indicatorY = 75;
    const indicatorSize = 8;
    const spacing = 18;

    // Player round wins (left side, under health bar)
    for (let i = 0; i < 2; i++) {
      const x = 30 + i * spacing;
      ctx.beginPath();
      ctx.arc(x, indicatorY, indicatorSize, 0, Math.PI * 2);
      if (i < playerWins) {
        ctx.fillStyle = '#ffcc00';
        ctx.fill();
        ctx.strokeStyle = '#aa8800';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        ctx.fillStyle = '#333';
        ctx.fill();
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    // Opponent round wins (right side, under health bar)
    for (let i = 0; i < 2; i++) {
      const x = CANVAS_WIDTH - 30 - i * spacing;
      ctx.beginPath();
      ctx.arc(x, indicatorY, indicatorSize, 0, Math.PI * 2);
      if (i < opponentWins) {
        ctx.fillStyle = '#ffcc00';
        ctx.fill();
        ctx.strokeStyle = '#aa8800';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        ctx.fillStyle = '#333';
        ctx.fill();
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    // Round number at top center
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'center';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.strokeText(`ROUND ${currentRound}`, CANVAS_WIDTH / 2, 25);
    ctx.fillStyle = '#fff';
    ctx.fillText(`ROUND ${currentRound}`, CANVAS_WIDTH / 2, 25);
  };

  const drawRoundEndOverlay = (ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    const winnerName = roundWinnerRef.current === 'player'
      ? gameStateRef.current?.player.name || 'PLAYER'
      : gameStateRef.current?.opponent.name || 'OPPONENT';

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Winner name + WINS ROUND X!
    const winText = `${winnerName} WINS!`;
    ctx.font = 'bold 70px Arial';

    // Outline
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 8;
    ctx.strokeText(winText, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 30);

    // Fill
    const gradient = ctx.createLinearGradient(0, CANVAS_HEIGHT / 2 - 80, 0, CANVAS_HEIGHT / 2 + 40);
    gradient.addColorStop(0, '#ffcc00');
    gradient.addColorStop(1, '#ff8800');
    ctx.fillStyle = gradient;
    ctx.fillText(winText, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 30);

    // Round info
    ctx.font = 'bold 36px Arial';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 4;
    ctx.strokeText(`ROUND ${currentRound}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 40);
    ctx.fillStyle = '#fff';
    ctx.fillText(`ROUND ${currentRound}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 40);
  };

  const drawFighter = (ctx: CanvasRenderingContext2D, fighter: Fighter, _isPlayer: boolean) => {
    const { position, facing, state, stateFrame, color, secondaryColor, currentAttack } = fighter;
    const x = position.x;
    const y = position.y;

    ctx.save();
    ctx.translate(x, y);
    if (facing === 'left') {
      ctx.scale(-1, 1);
    }

    // Animation calculations
    const idleBob = Math.sin(stateFrame * 0.1) * 3;
    const walkBob = Math.sin(stateFrame * 0.3) * 5;
    const hitShake = state === 'hit' ? (Math.random() - 0.5) * 8 : 0;

    let bodyOffsetY = 0;
    let armAngle = 0;
    let legAngle = 0;

    switch (state) {
      case 'idle':
        bodyOffsetY = idleBob;
        armAngle = Math.sin(stateFrame * 0.08) * 0.1;
        break;
      case 'walking':
        bodyOffsetY = walkBob;
        armAngle = Math.sin(stateFrame * 0.3) * 0.5;
        legAngle = Math.sin(stateFrame * 0.3) * 0.4;
        break;
      case 'jumping':
        bodyOffsetY = -10;
        armAngle = -0.3;
        legAngle = 0.3;
        break;
      case 'attacking':
        if (currentAttack) {
          const attackProgress = stateFrame / (currentAttack.startup + currentAttack.active + currentAttack.recovery);
          if (currentAttack.type === 'punch') {
            armAngle = attackProgress < 0.3 ? -0.5 : attackProgress < 0.6 ? 1.5 : 0.5;
          } else {
            legAngle = attackProgress < 0.3 ? -0.3 : attackProgress < 0.6 ? 1.2 : 0.3;
            bodyOffsetY = attackProgress < 0.6 ? -15 : 0;
          }
        }
        break;
      case 'hit':
        bodyOffsetY = hitShake;
        armAngle = 0.5;
        break;
      case 'blocking':
        armAngle = -0.8;
        bodyOffsetY = 5;
        break;
      case 'victory':
        bodyOffsetY = Math.sin(stateFrame * 0.15) * 10 - 20;
        armAngle = -1 + Math.sin(stateFrame * 0.2) * 0.3;
        break;
      case 'defeat':
        bodyOffsetY = 60;
        armAngle = 0.8;
        legAngle = 0.5;
        break;
    }

    ctx.translate(0, bodyOffsetY);

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(0, 5, 35, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    // Cel-shading outline function
    const drawWithOutline = (drawFn: () => void, outlineWidth = 4) => {
      ctx.save();
      ctx.strokeStyle = '#000';
      ctx.lineWidth = outlineWidth;
      ctx.lineJoin = 'round';
      drawFn();
      ctx.stroke();
      drawFn();
      ctx.fill();
      ctx.restore();
    };

    // Legs
    ctx.save();
    ctx.translate(-15, -20);
    ctx.rotate(legAngle);
    drawWithOutline(() => {
      ctx.beginPath();
      ctx.roundRect(-8, 0, 16, 55, 8);
    });
    ctx.fillStyle = secondaryColor;
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(15, -20);
    ctx.rotate(-legAngle);
    drawWithOutline(() => {
      ctx.beginPath();
      ctx.roundRect(-8, 0, 16, 55, 8);
    });
    ctx.fillStyle = secondaryColor;
    ctx.fill();
    ctx.restore();

    // Body
    const bodyGradient = ctx.createLinearGradient(-20, -FIGHTER_HEIGHT + 40, 20, -20);
    bodyGradient.addColorStop(0, color);
    bodyGradient.addColorStop(1, secondaryColor);
    ctx.fillStyle = bodyGradient;
    drawWithOutline(() => {
      ctx.beginPath();
      ctx.roundRect(-25, -FIGHTER_HEIGHT + 40, 50, 70, 15);
    });

    // Arms
    ctx.save();
    ctx.translate(-30, -FIGHTER_HEIGHT + 50);
    ctx.rotate(armAngle - 0.2);
    ctx.fillStyle = color;
    drawWithOutline(() => {
      ctx.beginPath();
      ctx.roundRect(-8, 0, 16, 50, 8);
    });
    // Fist
    ctx.fillStyle = '#FFE0BD';
    ctx.beginPath();
    ctx.arc(0, 55, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.translate(30, -FIGHTER_HEIGHT + 50);
    ctx.rotate(-armAngle + 0.2);
    ctx.fillStyle = color;
    drawWithOutline(() => {
      ctx.beginPath();
      ctx.roundRect(-8, 0, 16, 50, 8);
    });
    // Fist
    ctx.fillStyle = '#FFE0BD';
    ctx.beginPath();
    ctx.arc(0, 55, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();

    // Head with face image
    const faceImg = faceImagesRef.current.get(fighter.id);
    const headRadius = 32;
    const headY = -FIGHTER_HEIGHT + 25;

    // Draw circular head background
    ctx.fillStyle = '#FFE0BD';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, headY, headRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Draw face image if loaded
    if (faceImg) {
      ctx.save();
      // Clip to circle
      ctx.beginPath();
      ctx.arc(0, headY, headRadius - 2, 0, Math.PI * 2);
      ctx.clip();

      // Draw the face image
      const imgSize = headRadius * 2;
      ctx.drawImage(faceImg, -headRadius, headY - headRadius, imgSize, imgSize);

      // Add tint effect based on state
      if (state === 'hit') {
        ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
        ctx.fillRect(-headRadius, headY - headRadius, imgSize, imgSize);
      } else if (state === 'victory') {
        ctx.fillStyle = 'rgba(255, 215, 0, 0.2)';
        ctx.fillRect(-headRadius, headY - headRadius, imgSize, imgSize);
      }

      ctx.restore();

      // Re-draw outline on top
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, headY, headRadius, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  };

  const drawParticle = (ctx: CanvasRenderingContext2D, particle: Particle) => {
    const alpha = particle.life / particle.maxLife;
    ctx.save();
    ctx.translate(particle.x, particle.y);
    ctx.rotate(particle.rotation);
    ctx.globalAlpha = alpha;

    if (particle.type === 'star') {
      // Draw star
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const angle = (i * Math.PI * 2) / 5 - Math.PI / 2;
        const outerX = Math.cos(angle) * particle.size;
        const outerY = Math.sin(angle) * particle.size;
        const innerAngle = angle + Math.PI / 5;
        const innerX = Math.cos(innerAngle) * (particle.size * 0.4);
        const innerY = Math.sin(innerAngle) * (particle.size * 0.4);
        if (i === 0) {
          ctx.moveTo(outerX, outerY);
        } else {
          ctx.lineTo(outerX, outerY);
        }
        ctx.lineTo(innerX, innerY);
      }
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.stroke();
    } else if (particle.type === 'spark') {
      // Draw spark
      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, particle.size);
      gradient.addColorStop(0, particle.color);
      gradient.addColorStop(0.5, particle.color);
      gradient.addColorStop(1, 'transparent');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(0, 0, particle.size, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Dust
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(0, 0, particle.size, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  };

  const drawProjectile = (ctx: CanvasRenderingContext2D, projectile: Projectile) => {
    const size = 65; // Fire size
    const time = Date.now() * 0.01;
    const pulseScale = 1 + Math.sin(time) * 0.15;
    const flickerScale = 1 + Math.sin(time * 3) * 0.05;

    ctx.save();
    ctx.translate(projectile.x, projectile.y);
    ctx.scale(pulseScale * flickerScale, pulseScale * flickerScale);

    // Outer fire glow (largest, most transparent)
    const outerGlow = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 1.5);
    outerGlow.addColorStop(0, 'rgba(255, 100, 0, 0.8)');
    outerGlow.addColorStop(0.3, 'rgba(255, 50, 0, 0.5)');
    outerGlow.addColorStop(0.6, 'rgba(200, 0, 0, 0.2)');
    outerGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = outerGlow;
    ctx.beginPath();
    ctx.arc(0, 0, size * 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Middle fire layer
    const midGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, size);
    midGradient.addColorStop(0, '#FFFF00');
    midGradient.addColorStop(0.2, '#FFCC00');
    midGradient.addColorStop(0.4, '#FF8800');
    midGradient.addColorStop(0.7, '#FF4400');
    midGradient.addColorStop(1, '#CC0000');
    ctx.fillStyle = midGradient;
    ctx.beginPath();
    ctx.arc(0, 0, size, 0, Math.PI * 2);
    ctx.fill();

    // Inner hot core (white/yellow center)
    const innerGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 0.5);
    innerGradient.addColorStop(0, '#FFFFFF');
    innerGradient.addColorStop(0.3, '#FFFFAA');
    innerGradient.addColorStop(0.6, '#FFFF00');
    innerGradient.addColorStop(1, '#FFAA00');
    ctx.fillStyle = innerGradient;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.5, 0, Math.PI * 2);
    ctx.fill();

    // Flame tendrils (random flickering shapes)
    ctx.globalAlpha = 0.7;
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 + time * 0.5;
      const flameLength = size * (0.8 + Math.sin(time * 2 + i) * 0.3);
      const flameWidth = size * 0.3;

      ctx.save();
      ctx.rotate(angle);

      const flameGrad = ctx.createLinearGradient(0, 0, flameLength, 0);
      flameGrad.addColorStop(0, '#FFAA00');
      flameGrad.addColorStop(0.5, '#FF6600');
      flameGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = flameGrad;

      ctx.beginPath();
      ctx.moveTo(size * 0.3, 0);
      ctx.quadraticCurveTo(flameLength * 0.5, -flameWidth, flameLength, 0);
      ctx.quadraticCurveTo(flameLength * 0.5, flameWidth, size * 0.3, 0);
      ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;

    // Projectile text
    ctx.font = 'bold 16px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 4;
    ctx.strokeText(projectile.text, 0, 0);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(projectile.text, 0, 0);

    // Fire trail
    for (let i = 1; i <= 5; i++) {
      const trailX = -projectile.vx * i * 4;
      const trailY = Math.sin(time * 5 + i) * 5;
      ctx.globalAlpha = 0.5 / i;

      const trailGrad = ctx.createRadialGradient(trailX, trailY, 0, trailX, trailY, size * 0.5 / i);
      trailGrad.addColorStop(0, '#FFAA00');
      trailGrad.addColorStop(0.5, '#FF4400');
      trailGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = trailGrad;
      ctx.beginPath();
      ctx.arc(trailX, trailY, size * 0.5 / i, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  };

  const drawTextPopup = (ctx: CanvasRenderingContext2D, popup: TextPopup) => {
    const alpha = Math.min(1, popup.life / (popup.maxLife * 0.3));
    const scale = popup.scale * (1 + (1 - popup.life / popup.maxLife) * 0.3);

    ctx.save();
    ctx.translate(popup.x, popup.y);
    ctx.scale(scale, scale);
    ctx.globalAlpha = alpha;

    // Comic book style text
    ctx.font = `bold ${popup.type === 'ko' ? 80 : popup.type === 'combo' ? 32 : 40}px "Comic Sans MS", cursive, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Outline
    ctx.strokeStyle = '#000';
    ctx.lineWidth = popup.type === 'ko' ? 8 : 5;
    ctx.lineJoin = 'round';
    ctx.strokeText(popup.text, 0, 0);

    // Fill with gradient
    const gradient = ctx.createLinearGradient(0, -20, 0, 20);
    if (popup.type === 'ko') {
      gradient.addColorStop(0, '#FF6666');
      gradient.addColorStop(0.5, '#FF0000');
      gradient.addColorStop(1, '#990000');
    } else if (popup.type === 'combo') {
      gradient.addColorStop(0, '#FFFF66');
      gradient.addColorStop(0.5, '#FFD700');
      gradient.addColorStop(1, '#FF8800');
    } else {
      gradient.addColorStop(0, '#FFFFFF');
      gradient.addColorStop(1, '#DDDDDD');
    }
    ctx.fillStyle = gradient;
    ctx.fillText(popup.text, 0, 0);

    ctx.restore();
  };

  const drawUI = (ctx: CanvasRenderingContext2D, state: GameState) => {
    const { player, opponent } = state;

    // Health bar background panel
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.beginPath();
    ctx.roundRect(20, 20, CANVAS_WIDTH - 40, 70, 10);
    ctx.fill();

    // Player health bar
    drawHealthBar(ctx, 40, 35, 450, 25, player.health, player.maxHealth, player.color, player.name, true);

    // Opponent health bar
    drawHealthBar(ctx, CANVAS_WIDTH - 490, 35, 450, 25, opponent.health, opponent.maxHealth, opponent.color, opponent.name, false);

    // Special meter bars (under health bars)
    drawMeterBar(ctx, 40, 65, 200, 12, player.specialMeter, player.color, true);
    drawMeterBar(ctx, CANVAS_WIDTH - 240, 65, 200, 12, opponent.specialMeter, opponent.color, false);

    // VS text
    ctx.font = 'bold 24px Arial';
    ctx.fillStyle = '#FFD700';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('VS', CANVAS_WIDTH / 2, 47);
  };

  const drawMeterBar = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    meter: number,
    _color: string,
    isLeft: boolean
  ) => {
    const meterPercent = Math.max(0, Math.min(100, meter)) / 100;

    // Bar background
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 3);
    ctx.fill();

    // Meter fill
    const meterWidth = width * meterPercent;
    const gradient = ctx.createLinearGradient(x, y, x + width, y);
    gradient.addColorStop(0, '#00AAFF');
    gradient.addColorStop(0.5, '#00FFFF');
    gradient.addColorStop(1, '#00AAFF');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    if (isLeft) {
      ctx.roundRect(x, y, meterWidth, height, 3);
    } else {
      ctx.roundRect(x + width - meterWidth, y, meterWidth, height, 3);
    }
    ctx.fill();

    // Ready indicator when meter >= 50
    if (meter >= 50) {
      ctx.fillStyle = '#FFD700';
      ctx.font = 'bold 10px Arial';
      ctx.textAlign = isLeft ? 'left' : 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText('READY!', isLeft ? x + width + 8 : x - 8, y + height / 2);
    }

    // Shine effect
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.roundRect(x, y, isLeft ? meterWidth : width, height / 3, [3, 3, 0, 0]);
    ctx.fill();
  };

  const drawHealthBar = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    health: number,
    maxHealth: number,
    color: string,
    name: string,
    isLeft: boolean
  ) => {
    const healthPercent = Math.max(0, health / maxHealth);

    // Name
    ctx.font = 'bold 18px Arial';
    ctx.fillStyle = '#fff';
    ctx.textAlign = isLeft ? 'left' : 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText(name, isLeft ? x : x + width, y - 2);

    // Bar background
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 5);
    ctx.fill();

    // Health fill
    const healthWidth = width * healthPercent;
    const gradient = ctx.createLinearGradient(x, y, x, y + height);

    if (healthPercent > 0.5) {
      gradient.addColorStop(0, '#66FF66');
      gradient.addColorStop(1, '#33AA33');
    } else if (healthPercent > 0.25) {
      gradient.addColorStop(0, '#FFFF66');
      gradient.addColorStop(1, '#AAAA33');
    } else {
      gradient.addColorStop(0, '#FF6666');
      gradient.addColorStop(1, '#AA3333');
    }

    ctx.fillStyle = gradient;
    ctx.beginPath();
    if (isLeft) {
      ctx.roundRect(x, y, healthWidth, height, 5);
    } else {
      ctx.roundRect(x + width - healthWidth, y, healthWidth, height, 5);
    }
    ctx.fill();

    // Character color indicator
    ctx.fillStyle = color;
    ctx.beginPath();
    if (isLeft) {
      ctx.roundRect(x, y, 8, height, [5, 0, 0, 5]);
    } else {
      ctx.roundRect(x + width - 8, y, 8, height, [0, 5, 5, 0]);
    }
    ctx.fill();

    // Shine effect
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.roundRect(x, y, isLeft ? healthWidth : width, height / 3, [5, 5, 0, 0]);
    ctx.fill();

    // Health text
    ctx.font = 'bold 14px Arial';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#000';
    ctx.shadowBlur = 2;
    ctx.fillText(`${Math.max(0, Math.round(health))}%`, x + width / 2, y + height / 2);
    ctx.shadowBlur = 0;
  };

  const drawIntroOverlay = (ctx: CanvasRenderingContext2D, count: number) => {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Show "ROUND X" above the countdown
    ctx.font = 'bold 50px Arial';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 6;
    ctx.strokeText(`ROUND ${currentRound}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 120);
    ctx.fillStyle = '#fff';
    ctx.fillText(`ROUND ${currentRound}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 120);

    // Countdown number
    ctx.font = 'bold 200px Arial';

    // Outline
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 15;
    ctx.strokeText(count.toString(), CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 30);

    // Gradient fill
    const gradient = ctx.createLinearGradient(
      CANVAS_WIDTH / 2 - 100,
      CANVAS_HEIGHT / 2 - 70,
      CANVAS_WIDTH / 2 + 100,
      CANVAS_HEIGHT / 2 + 130
    );
    gradient.addColorStop(0, '#FFFF00');
    gradient.addColorStop(0.5, '#FF8800');
    gradient.addColorStop(1, '#FF4400');
    ctx.fillStyle = gradient;
    ctx.fillText(count.toString(), CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 30);
  };

  const drawFightText = (ctx: CanvasRenderingContext2D) => {
    ctx.font = 'bold 120px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.strokeStyle = '#000';
    ctx.lineWidth = 10;
    ctx.strokeText('FIGHT!', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);

    const gradient = ctx.createLinearGradient(
      CANVAS_WIDTH / 2 - 200,
      CANVAS_HEIGHT / 2,
      CANVAS_WIDTH / 2 + 200,
      CANVAS_HEIGHT / 2
    );
    gradient.addColorStop(0, '#FF4444');
    gradient.addColorStop(0.5, '#FFFF44');
    gradient.addColorStop(1, '#FF4444');
    ctx.fillStyle = gradient;
    ctx.fillText('FIGHT!', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
  };

  const drawVictoryOverlay = (ctx: CanvasRenderingContext2D, winner: Fighter) => {
    // Semi-transparent background
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Winner name + WINS! on single line
    const winText = `${winner.name} WINS!`;
    ctx.font = 'bold 80px Arial';

    ctx.strokeStyle = '#000';
    ctx.lineWidth = 10;
    ctx.strokeText(winText, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 60);

    const gradient = ctx.createLinearGradient(
      CANVAS_WIDTH / 2 - 300,
      CANVAS_HEIGHT / 2 - 100,
      CANVAS_WIDTH / 2 + 300,
      CANVAS_HEIGHT / 2
    );
    gradient.addColorStop(0, winner.color);
    gradient.addColorStop(0.5, '#FFD700');
    gradient.addColorStop(1, winner.color);
    ctx.fillStyle = gradient;
    ctx.fillText(winText, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 60);

    // Speech bubble with victory quote
    if (victoryQuoteRef.current) {
      const quote = victoryQuoteRef.current;
      const bubbleX = winner.position.x;
      const bubbleY = winner.position.y - 220;

      // Measure text for bubble size
      ctx.font = 'bold 18px Arial';
      const textWidth = ctx.measureText(quote).width;
      const bubbleWidth = Math.max(textWidth + 40, 200);
      const bubbleHeight = 50;
      const bubbleRadius = 15;

      // Draw speech bubble background
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 4;

      // Rounded rectangle for bubble
      ctx.beginPath();
      ctx.moveTo(bubbleX - bubbleWidth/2 + bubbleRadius, bubbleY - bubbleHeight/2);
      ctx.lineTo(bubbleX + bubbleWidth/2 - bubbleRadius, bubbleY - bubbleHeight/2);
      ctx.quadraticCurveTo(bubbleX + bubbleWidth/2, bubbleY - bubbleHeight/2, bubbleX + bubbleWidth/2, bubbleY - bubbleHeight/2 + bubbleRadius);
      ctx.lineTo(bubbleX + bubbleWidth/2, bubbleY + bubbleHeight/2 - bubbleRadius);
      ctx.quadraticCurveTo(bubbleX + bubbleWidth/2, bubbleY + bubbleHeight/2, bubbleX + bubbleWidth/2 - bubbleRadius, bubbleY + bubbleHeight/2);
      ctx.lineTo(bubbleX - bubbleWidth/2 + bubbleRadius, bubbleY + bubbleHeight/2);
      ctx.quadraticCurveTo(bubbleX - bubbleWidth/2, bubbleY + bubbleHeight/2, bubbleX - bubbleWidth/2, bubbleY + bubbleHeight/2 - bubbleRadius);
      ctx.lineTo(bubbleX - bubbleWidth/2, bubbleY - bubbleHeight/2 + bubbleRadius);
      ctx.quadraticCurveTo(bubbleX - bubbleWidth/2, bubbleY - bubbleHeight/2, bubbleX - bubbleWidth/2 + bubbleRadius, bubbleY - bubbleHeight/2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Draw speech bubble tail (pointing to character)
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(bubbleX - 15, bubbleY + bubbleHeight/2);
      ctx.lineTo(bubbleX, bubbleY + bubbleHeight/2 + 25);
      ctx.lineTo(bubbleX + 15, bubbleY + bubbleHeight/2);
      ctx.closePath();
      ctx.fill();

      // Draw tail border
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(bubbleX - 15, bubbleY + bubbleHeight/2);
      ctx.lineTo(bubbleX, bubbleY + bubbleHeight/2 + 25);
      ctx.lineTo(bubbleX + 15, bubbleY + bubbleHeight/2);
      ctx.stroke();

      // Cover the line inside the bubble
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(bubbleX - 16, bubbleY + bubbleHeight/2 - 3, 32, 6);

      // Draw quote text
      ctx.font = 'bold 18px Arial';
      ctx.fillStyle = '#000';
      ctx.textAlign = 'center';
      ctx.fillText(quote, bubbleX, bubbleY + 2);
    }

    // Score
    ctx.textAlign = 'center';
    ctx.font = 'bold 36px Arial';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 4;
    ctx.strokeText(`${playerWins} - ${opponentWins}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 20);
    ctx.fillStyle = '#ffcc00';
    ctx.fillText(`${playerWins} - ${opponentWins}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 20);

    // "MATCH CHAMPION" subtitle
    ctx.font = 'bold 28px Arial';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 4;
    ctx.strokeText('MATCH CHAMPION', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 70);
    ctx.fillStyle = '#88ff88';
    ctx.fillText('MATCH CHAMPION', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 70);

    // Subtitle
    ctx.font = 'bold 20px Arial';
    ctx.fillStyle = '#aaa';
    ctx.fillText('Press any key to continue', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 120);
  };

  // Track round transition timer and processed rounds
  const roundTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const processedRoundRef = useRef(0);

  // Handle round end - intercept 'victory' from engine for round logic
  useEffect(() => {
    if (gamePhase !== 'victory') return;
    if (!gameStateRef.current) return;

    // Determine round winner
    const winner = gameStateRef.current.winner;

    // Guard: don't process if no valid winner or already processed this round
    if (!winner || processedRoundRef.current >= currentRound) {
      return;
    }

    // Mark this round as processed
    processedRoundRef.current = currentRound;
    roundWinnerRef.current = winner;

    // Calculate new wins using refs (which have current values, not stale closure values)
    const currentPlayerWins = playerWinsRef.current;
    const currentOpponentWins = opponentWinsRef.current;
    const newPlayerWins = winner === 'player' ? currentPlayerWins + 1 : currentPlayerWins;
    const newOpponentWins = winner === 'opponent' ? currentOpponentWins + 1 : currentOpponentWins;

    // IMPORTANT: Update refs IMMEDIATELY with new values
    // This fixes the race condition where tournament result reporting runs before state sync effects
    playerWinsRef.current = newPlayerWins;
    opponentWinsRef.current = newOpponentWins;

    // Update wins state (async, for UI)
    if (winner === 'player') {
      setPlayerWins(newPlayerWins);
    } else if (winner === 'opponent') {
      setOpponentWins(newOpponentWins);
    }

    // Check if match is over (best of 3 = first to 2 wins)
    if (newPlayerWins >= 2 || newOpponentWins >= 2) {
      // Match is over - mark it and stay in victory phase
      matchOverRef.current = true;
      console.log('Match over! Final scores: playerWins=' + newPlayerWins + ', opponentWins=' + newOpponentWins);

      // Select a random victory quote for the winner
      const winnerCharacter = newPlayerWins >= 2 ? playerCharacter : opponentRef.current;
      if (winnerCharacter?.victoryQuotes && winnerCharacter.victoryQuotes.length > 0) {
        const randomIndex = Math.floor(Math.random() * winnerCharacter.victoryQuotes.length);
        victoryQuoteRef.current = winnerCharacter.victoryQuotes[randomIndex];
      }
      return;
    }

    // Round is over but match continues - show round end, then start next round
    setGamePhase('roundEnd');

    // Clear any existing timer
    if (roundTimerRef.current) {
      clearTimeout(roundTimerRef.current);
    }

    // After 2 seconds, start the next round
    roundTimerRef.current = setTimeout(() => {
      startNextRound();
      roundTimerRef.current = null;
    }, 2000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gamePhase, currentRound]);

  // Start the next round
  const startNextRound = () => {
    if (!gameStateRef.current) return;

    // Reset fighter positions and health
    gameStateRef.current.player.health = 100;
    gameStateRef.current.player.position = { x: 300, y: 520 };
    gameStateRef.current.player.velocity = { x: 0, y: 0 };
    gameStateRef.current.player.state = 'idle';
    gameStateRef.current.player.stateFrame = 0;
    gameStateRef.current.player.hitStun = 0;
    gameStateRef.current.player.comboCount = 0;
    gameStateRef.current.player.isGrounded = true;
    gameStateRef.current.player.facing = 'right';
    gameStateRef.current.player.specialMeter = 0; // Reset meter

    gameStateRef.current.opponent.health = 100;
    gameStateRef.current.opponent.position = { x: 900, y: 520 };
    gameStateRef.current.opponent.velocity = { x: 0, y: 0 };
    gameStateRef.current.opponent.state = 'idle';
    gameStateRef.current.opponent.stateFrame = 0;
    gameStateRef.current.opponent.hitStun = 0;
    gameStateRef.current.opponent.comboCount = 0;
    gameStateRef.current.opponent.isGrounded = true;
    gameStateRef.current.opponent.facing = 'left';
    gameStateRef.current.opponent.specialMeter = 0; // Reset meter

    // Reset game state
    gameStateRef.current.particles = [];
    gameStateRef.current.projectiles = [];
    gameStateRef.current.textPopups = [];
    gameStateRef.current.slowMo = 1;
    gameStateRef.current.winner = null;
    gameStateRef.current.gamePhase = 'intro';

    // Increment round
    setCurrentRound(prev => prev + 1);
    roundWinnerRef.current = null;

    // Start countdown for next round
    introCountRef.current = 3;
    setGamePhase('intro');
    playCountdownSound(false);

    const introInterval = setInterval(() => {
      introCountRef.current--;
      if (introCountRef.current <= 0) {
        clearInterval(introInterval);
        playCountdownSound(true);
        setTimeout(() => {
          if (gameStateRef.current) {
            gameStateRef.current.gamePhase = 'fighting';
          }
          setGamePhase('fighting');
        }, 800);
      } else {
        playCountdownSound(false);
      }
    }, 1000);
  };

  // Handle continue after final victory
  useEffect(() => {
    if (gamePhase !== 'victory') return;
    // Only allow continue when match is truly over
    if (!matchOverRef.current) return;

    const handleContinue = () => {
      onBack();
    };

    // Add a delay before allowing continue
    const enableContinue = setTimeout(() => {
      window.addEventListener('keydown', handleContinue);
      window.addEventListener('click', handleContinue);
    }, 1500);

    return () => {
      clearTimeout(enableContinue);
      window.removeEventListener('keydown', handleContinue);
      window.removeEventListener('click', handleContinue);
    };
  }, [gamePhase, onBack]);

  // Send live scores during tournament matches for spectator view
  useEffect(() => {
    // Only for tournament mode
    if (gameMode !== 'tournament') return;
    // Only host sends updates to avoid duplicates
    if (!isHost) return;
    // Need match details
    if (!tournamentMatchId || !tournamentRound) return;
    // Only during active game phases
    if (gamePhase !== 'fighting' && gamePhase !== 'roundEnd' && gamePhase !== 'victory') return;

    // Send current scores
    tournamentService.updateLiveScore(
      tournamentMatchId,
      tournamentRound,
      { player1: playerWinsRef.current, player2: opponentWinsRef.current },
      currentRound
    );
  }, [gameMode, isHost, tournamentMatchId, tournamentRound, playerWins, opponentWins, currentRound, gamePhase]);

  // Report tournament match result when match ends
  useEffect(() => {
    // Only for tournament mode
    if (gameMode !== 'tournament') return;
    // Only when match is over
    if (gamePhase !== 'victory' || !matchOverRef.current) return;
    // Only host reports to avoid duplicate submissions
    if (!isHost) return;
    // Only report once
    if (tournamentResultReportedRef.current) return;
    // Need match details
    if (!tournamentMatchId || !tournamentRound) return;

    const reportResult = async () => {
      try {
        // Mark as reported immediately to prevent double-reporting
        tournamentResultReportedRef.current = true;

        // Get match data to find player IDs
        const matchData = await tournamentService.getMatchData(tournamentMatchId, tournamentRound);
        if (!matchData) {
          console.error('Could not fetch match data for result reporting');
          return;
        }

        // Determine winner:
        // - Host controls "player" (left side) which is player1
        // - Guest controls "opponent" (right side) which is player2
        // playerWins >= 2 means player1 (host) wins
        // opponentWins >= 2 means player2 (guest) wins
        const finalPlayerWins = playerWinsRef.current;
        const finalOpponentWins = opponentWinsRef.current;

        console.log('Tournament result determination:', {
          isHost,
          finalPlayerWins,
          finalOpponentWins,
          player1Id: matchData.player1Id,
          player2Id: matchData.player2Id,
          myPlayerId: tournamentService.getPlayerId(),
          player1WinsMatch: finalPlayerWins >= 2,
        });

        const winnerId = finalPlayerWins >= 2 ? matchData.player1Id : matchData.player2Id;

        if (!winnerId) {
          console.error('Could not determine winner ID');
          return;
        }

        const winnerRole = winnerId === matchData.player1Id ? 'player1/host' : 'player2/guest';
        console.log(`Reporting winner: ${winnerId} (${winnerRole}) with scores ${finalPlayerWins}-${finalOpponentWins}`);

        // Report the result
        await tournamentService.reportMatchResult(
          tournamentMatchId,
          tournamentRound,
          winnerId,
          { player1: playerWinsRef.current, player2: opponentWinsRef.current }
        );

        console.log('Tournament result reported successfully');
      } catch (error) {
        console.error('Failed to report tournament result:', error);
        // Reset flag to allow retry
        tournamentResultReportedRef.current = false;
      }
    };

    reportResult();
  }, [gamePhase, gameMode, isHost, tournamentMatchId, tournamentRound]);

  // Reset health in training mode
  const handleResetHealth = () => {
    if (gameStateRef.current && gameMode === 'training') {
      gameStateRef.current.player.health = 100;
      gameStateRef.current.opponent.health = 100;
      gameStateRef.current.player.state = 'idle';
      gameStateRef.current.opponent.state = 'idle';
      gameStateRef.current.player.hitStun = 0;
      gameStateRef.current.opponent.hitStun = 0;
    }
  };

  return (
    <div className="game-container">
      {/* Game mode indicator */}
      {gameMode === 'training' && (
        <div className="mode-indicator training-indicator">
          TRAINING MODE
        </div>
      )}
      {gameMode === 'online' && (
        <div className="mode-indicator online-indicator">
          ONLINE PvP {roomCode && `• Room: ${roomCode}`}
        </div>
      )}
      {gameMode === 'tournament' && (
        <div className="mode-indicator tournament-indicator">
          TOURNAMENT {tournamentRound && `• Round ${tournamentRound}`}
        </div>
      )}

      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="game-canvas"
      />

      <div className="game-controls">
        <button className="menu-button" onClick={onBack}>← BACK TO MENU</button>
        {gameMode === 'training' && (
          <button className="menu-button reset-button" onClick={handleResetHealth}>
            RESET HEALTH
          </button>
        )}
      </div>

      <style>{`
        .game-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          background: #111;
          padding: 1rem;
        }

        .game-canvas {
          border: 4px solid #333;
          border-radius: 10px;
          box-shadow: 0 0 30px rgba(0,0,0,0.8), 0 0 60px rgba(255,100,0,0.2);
          max-width: 100%;
          height: auto;
        }

        .game-controls {
          margin-top: 1rem;
        }

        .menu-button {
          padding: 0.8rem 2rem;
          font-size: 1rem;
          font-weight: 700;
          color: #fff;
          background: rgba(255,255,255,0.1);
          border: 2px solid rgba(255,255,255,0.3);
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .mode-indicator {
          position: absolute;
          top: 1rem;
          left: 50%;
          transform: translateX(-50%);
          padding: 0.5rem 1.5rem;
          font-size: 1rem;
          font-weight: 700;
          border-radius: 20px;
          z-index: 10;
        }

        .training-indicator {
          background: rgba(68, 187, 68, 0.9);
          color: #fff;
          border: 2px solid #226622;
        }

        .online-indicator {
          background: rgba(255, 102, 170, 0.9);
          color: #fff;
          border: 2px solid #993366;
        }

        .tournament-indicator {
          background: rgba(255, 204, 0, 0.9);
          color: #000;
          border: 2px solid #996600;
        }

        .reset-button {
          margin-left: 1rem;
          background: rgba(68, 187, 68, 0.3);
          border-color: #44BB44;
        }

        .reset-button:hover {
          background: rgba(68, 187, 68, 0.5);
        }

        .menu-button:hover {
          background: rgba(255,255,255,0.2);
        }
      `}</style>
    </div>
  );
};
