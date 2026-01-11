import { useEffect, useRef, useState, useCallback } from 'react';
import type { GameState, CharacterData, MapData, Fighter, Particle, TextPopup, SoundEvent, GameMode } from '../types/game';
import type { InputState } from '../engine/GameEngine';
import { createInitialGameState, updateGameState } from '../engine/GameEngine';
import { characters } from '../data/gameData';
import {
  initAudio,
  playPunchSound,
  playKickSound,
  playBlockSound,
  playWhiffSound,
  playKOSound,
  playVictorySound,
  playCountdownSound,
} from '../utils/sounds';
import { multiplayerService } from '../services/multiplayer-firebase';

interface GameProps {
  playerCharacter: CharacterData;
  opponentCharacter?: CharacterData | null; // For online mode, opponent is specified
  map: MapData;
  gameMode: GameMode;
  isHost?: boolean;
  roomCode?: string | null;
  onBack: () => void;
}

const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 600;
const FIGHTER_HEIGHT = 140;

export const Game = ({ playerCharacter, opponentCharacter, map, gameMode, isHost, roomCode, onBack }: GameProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameStateRef = useRef<GameState | null>(null);
  const inputRef = useRef<InputState>({
    left: false,
    right: false,
    up: false,
    down: false,
    punch: false,
    kick: false,
  });
  const lastPunchRef = useRef(false);
  const lastKickRef = useRef(false);
  const [gamePhase, setGamePhase] = useState<'intro' | 'fighting' | 'ko' | 'victory'>('intro');
  const [introCount, setIntroCount] = useState(3);
  const backgroundImageRef = useRef<HTMLImageElement | null>(null);
  const faceImagesRef = useRef<Map<string, HTMLImageElement>>(new Map());

  // Online multiplayer state
  const frameCountRef = useRef(0);
  const remoteInputRef = useRef<InputState>({
    left: false,
    right: false,
    up: false,
    down: false,
    punch: false,
    kick: false,
  });
  const lastRemotePunchRef = useRef(false);
  const lastRemoteKickRef = useRef(false);

  // Get opponent - use provided opponent for online, random for others
  const getOpponent = useCallback((): CharacterData => {
    if (opponentCharacter) {
      return opponentCharacter;
    }
    const others = characters.filter(c => c.id !== playerCharacter.id);
    return others[Math.floor(Math.random() * others.length)];
  }, [playerCharacter.id, opponentCharacter]);

  // Store the opponent for consistent reference
  const opponentRef = useRef<CharacterData | null>(null);

  // Initialize game
  useEffect(() => {
    const opponent = getOpponent();
    opponentRef.current = opponent;

    // For online mode, both players need the SAME game state perspective
    // Host's character is always "player" (left side), Guest's character is always "opponent" (right side)
    if (gameMode === 'online' && !isHost) {
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
    let count = 3;
    setIntroCount(3);
    // Play initial countdown sound
    initAudio();
    playCountdownSound(false);
    const introInterval = setInterval(() => {
      count--;
      setIntroCount(count);
      if (count <= 0) {
        clearInterval(introInterval);
        if (gameStateRef.current) {
          gameStateRef.current.gamePhase = 'fighting';
        }
        setGamePhase('fighting');
        // Play "FIGHT!" sound
        playCountdownSound(true);
      } else {
        // Play countdown beep
        playCountdownSound(false);
      }
    }, 1000);

    return () => clearInterval(introInterval);
  }, [playerCharacter, map, getOpponent, gameMode, isHost]);

  // Setup multiplayer input callbacks for online mode
  useEffect(() => {
    if (gameMode !== 'online') return;

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
    });
  }, [gameMode]);

  // Play sound based on event type
  const playSoundEvent = useCallback((event: SoundEvent) => {
    switch (event) {
      case 'punch':
        playPunchSound();
        break;
      case 'kick':
        playKickSound();
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
      const key = e.key.toLowerCase();
      if (key === 'a') inputRef.current.left = true;
      if (key === 'd') inputRef.current.right = true;
      if (key === 'w') inputRef.current.up = true;
      if (key === 's') inputRef.current.down = true;
      if (key === 'f') inputRef.current.punch = true;
      if (key === 'g') inputRef.current.kick = true;
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === 'a') inputRef.current.left = false;
      if (key === 'd') inputRef.current.right = false;
      if (key === 'w') inputRef.current.up = false;
      if (key === 's') inputRef.current.down = false;
      if (key === 'f') inputRef.current.punch = false;
      if (key === 'g') inputRef.current.kick = false;
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

      // Create input for this frame (only trigger punch/kick once per press)
      let input: InputState = {
        ...inputRef.current,
        punch: inputRef.current.punch && !lastPunchRef.current,
        kick: inputRef.current.kick && !lastKickRef.current,
      };
      lastPunchRef.current = inputRef.current.punch;
      lastKickRef.current = inputRef.current.kick;

      // Handle online multiplayer input
      let remoteInput: InputState | undefined;
      if (gameMode === 'online') {
        // Send our input to the remote player
        frameCountRef.current++;
        multiplayerService.sendInput(frameCountRef.current, inputRef.current);

        // Process remote input (only trigger punch/kick once per press)
        remoteInput = {
          ...remoteInputRef.current,
          punch: remoteInputRef.current.punch && !lastRemotePunchRef.current,
          kick: remoteInputRef.current.kick && !lastRemoteKickRef.current,
        };
        lastRemotePunchRef.current = remoteInputRef.current.punch;
        lastRemoteKickRef.current = remoteInputRef.current.kick;

        // Swap player/opponent based on host status
        // Host is player 1 (left side), guest is player 2 (right side)
        if (!isHost) {
          // If we're the guest, swap the inputs
          const tempInput = input;
          input = remoteInput;
          remoteInput = tempInput;
        }
      }

      // Update game state
      const opponent = opponentRef.current;

      // For online guest, attacks need to match the swapped game state order
      let playerAttacks = playerCharacter.attacks;
      let opponentAttacks = opponent?.attacks || playerCharacter.attacks;
      if (gameMode === 'online' && !isHost) {
        // Guest: game state has player=hostChar, opponent=guestChar
        // So player attacks = host's attacks (opponent), opponent attacks = guest's attacks (playerCharacter)
        playerAttacks = opponent?.attacks || playerCharacter.attacks;
        opponentAttacks = playerCharacter.attacks;
      }

      const updateResult = updateGameState(
        gameStateRef.current,
        input,
        playerAttacks,
        opponentAttacks,
        1 / 60,
        gameMode,
        remoteInput
      );
      gameStateRef.current = updateResult.state;

      // Play sound events
      updateResult.soundEvents.forEach(playSoundEvent);

      // Sync phase state
      if (gameStateRef.current.gamePhase !== gamePhase) {
        setGamePhase(gameStateRef.current.gamePhase);
      }

      // Render
      render(ctx, gameStateRef.current);

      animationId = requestAnimationFrame(gameLoop);
    };

    animationId = requestAnimationFrame(gameLoop);

    return () => cancelAnimationFrame(animationId);
  }, [playerCharacter, gamePhase, playSoundEvent, gameMode, isHost]);

  const render = (ctx: CanvasRenderingContext2D, state: GameState) => {
    const { camera, player, opponent, particles, textPopups } = state;

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

    // Draw particles
    particles.forEach(p => drawParticle(ctx, p));

    // Draw text popups
    textPopups.forEach(p => drawTextPopup(ctx, p));

    ctx.restore();

    // Draw UI (not affected by camera)
    drawUI(ctx, state);

    // Draw intro/ko overlay
    if (state.gamePhase === 'intro' && introCount > 0) {
      drawIntroOverlay(ctx, introCount);
    } else if (state.gamePhase === 'intro' && introCount === 0) {
      drawFightText(ctx);
    }

    if (state.gamePhase === 'victory') {
      drawVictoryOverlay(ctx, state.winner === 'player' ? player : opponent);
    }
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

    // VS text
    ctx.font = 'bold 24px Arial';
    ctx.fillStyle = '#FFD700';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('VS', CANVAS_WIDTH / 2, 47);
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

    ctx.font = 'bold 200px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Outline
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 15;
    ctx.strokeText(count.toString(), CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);

    // Gradient fill
    const gradient = ctx.createLinearGradient(
      CANVAS_WIDTH / 2 - 100,
      CANVAS_HEIGHT / 2 - 100,
      CANVAS_WIDTH / 2 + 100,
      CANVAS_HEIGHT / 2 + 100
    );
    gradient.addColorStop(0, '#FFFF00');
    gradient.addColorStop(0.5, '#FF8800');
    gradient.addColorStop(1, '#FF4400');
    ctx.fillStyle = gradient;
    ctx.fillText(count.toString(), CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
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
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Winner text
    ctx.font = 'bold 80px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.strokeStyle = '#000';
    ctx.lineWidth = 8;
    ctx.strokeText(`${winner.name} WINS!`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 50);

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
    ctx.fillText(`${winner.name} WINS!`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 50);

    // Subtitle
    ctx.font = 'bold 30px Arial';
    ctx.fillStyle = '#fff';
    ctx.fillText('Press any key to continue', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 50);
  };

  // Handle continue after victory
  useEffect(() => {
    if (gamePhase !== 'victory') return;

    const handleContinue = () => {
      onBack();
    };

    window.addEventListener('keydown', handleContinue);
    window.addEventListener('click', handleContinue);

    return () => {
      window.removeEventListener('keydown', handleContinue);
      window.removeEventListener('click', handleContinue);
    };
  }, [gamePhase, onBack]);

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
