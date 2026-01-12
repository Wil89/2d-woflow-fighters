// Game Types
export interface Position {
  x: number;
  y: number;
}

export interface Velocity {
  x: number;
  y: number;
}

export interface HitBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Attack {
  name: string;
  damage: number;
  range: number;
  startup: number; // frames before hit becomes active
  active: number; // frames the hitbox is active
  recovery: number; // frames after attack ends
  knockback: number;
  type: 'punch' | 'kick' | 'special';
  sound: string;
}

export interface Fighter {
  id: string;
  name: string;
  color: string;
  secondaryColor: string;
  faceImage: string;
  position: Position;
  velocity: Velocity;
  health: number;
  maxHealth: number;
  facing: 'left' | 'right';
  state: FighterState;
  stateFrame: number;
  currentAttack: Attack | null;
  isBlocking: boolean;
  isGrounded: boolean;
  hitStun: number;
  comboCount: number;
}

export type FighterState =
  | 'idle'
  | 'walking'
  | 'jumping'
  | 'attacking'
  | 'hit'
  | 'blocking'
  | 'knockdown'
  | 'victory'
  | 'defeat';

export interface Particle {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  type: 'spark' | 'star' | 'dust' | 'impact';
  rotation: number;
  rotationSpeed: number;
}

export interface TextPopup {
  id: string;
  text: string;
  x: number;
  y: number;
  life: number;
  maxLife: number;
  scale: number;
  color: string;
  type: 'hit' | 'combo' | 'ko';
}

export interface CameraState {
  x: number;
  y: number;
  zoom: number;
  shake: number;
  targetZoom: number;
}

export interface GameState {
  player: Fighter;
  opponent: Fighter;
  particles: Particle[];
  textPopups: TextPopup[];
  camera: CameraState;
  gamePhase: 'intro' | 'fighting' | 'ko' | 'victory';
  winner: 'player' | 'opponent' | null;
  slowMo: number;
  roundTime: number;
}

export interface CharacterData {
  id: string;
  name: string;
  color: string;
  secondaryColor: string;
  faceImage: string;
  description: string;
  specialty: string;
  country: string;
  countryFlag: string;
  jobTitle: string;
  attacks: {
    punch: Attack;
    kick: Attack;
  };
  stats: {
    power: number;
    speed: number;
    defense: number;
  };
}

export interface MapData {
  id: string;
  name: string;
  image: string;
  groundY: number;
  ambience: string;
}

export type GameScreen = 'menu' | 'modeSelect' | 'characterSelect' | 'mapSelect' | 'onlineLobby' | 'game';

export type GameMode = 'training' | 'vs-cpu' | 'online';

export type SoundEvent = 'punch' | 'kick' | 'block' | 'whiff' | 'ko' | 'victory';
