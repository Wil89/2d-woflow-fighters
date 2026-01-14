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
  specialMeter: number; // 0-100, specials cost meter to use
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

export interface Projectile {
  id: string;
  x: number;
  y: number;
  vx: number;
  owner: 'player' | 'opponent';
  damage: number;
  text: string;
  color: string;
  life: number;
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
  projectiles: Projectile[];
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
  projectileText: string; // Text shown on special move projectile
  victoryQuotes: string[]; // Funny job-related quotes shown on victory
  attacks: {
    punch: Attack;
    kick: Attack;
    special: Attack;
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

export type GameScreen = 'menu' | 'modeSelect' | 'characterSelect' | 'mapSelect' | 'onlineLobby' | 'tournamentLobby' | 'game';

export type GameMode = 'training' | 'vs-cpu' | 'online' | 'tournament';

export type SoundEvent = 'punch' | 'kick' | 'special' | 'block' | 'whiff' | 'ko' | 'victory';

// Tournament Types
export type TournamentStatus = 'waiting' | 'in_progress' | 'completed' | 'cancelled';
export type TournamentPlayerStatus = 'joined' | 'ready' | 'eliminated' | 'champion';
export type TournamentMatchStatus = 'pending' | 'ready' | 'in_progress' | 'completed' | 'forfeit';

export interface TournamentPlayer {
  id: string;
  name: string;
  seed: number;
  character: CharacterData | null;
  status: TournamentPlayerStatus;
  joinedAt: number;
}

export interface TournamentMatch {
  matchId: string;
  roundNumber: number;
  matchNumber: number;
  player1Id: string | null;
  player2Id: string | null;
  player1Ready: boolean;
  player2Ready: boolean;
  status: TournamentMatchStatus;
  winnerId: string | null;
  roomCode: string | null;
  startedAt: number | null;
  completedAt: number | null;
  scores: { player1: number; player2: number };
  currentGameRound?: number; // Current round within the match (1, 2, or 3)
  lastUpdate?: number; // Timestamp of last score update for live tracking
}

export interface TournamentMeta {
  id: string;
  code: string;
  name: string;
  creatorId: string;
  status: TournamentStatus;
  size: 4 | 8 | 16;
  createdAt: number;
  startedAt: number | null;
  completedAt: number | null;
  currentRound: number;
  winnerId: string | null;
}

export interface Tournament {
  meta: TournamentMeta;
  players: Record<string, TournamentPlayer>;
  bracket: Record<string, Record<string, TournamentMatch>>; // round -> matchId -> match
}
