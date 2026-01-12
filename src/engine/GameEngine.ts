import type {
  Fighter,
  GameState,
  Particle,
  Projectile,
  TextPopup,
  CharacterData,
  Attack,
  HitBox,
  SoundEvent,
  GameMode,
} from '../types/game';
import { HIT_SOUNDS, COMBO_TEXTS } from '../data/gameData';

// Constants - tuned for slower, more deliberate gameplay
const GRAVITY = 0.7;
const GROUND_Y = 520;
const ARENA_WIDTH = 1200;
const ARENA_PADDING = 50;
const FIGHTER_WIDTH = 80;
const FIGHTER_HEIGHT = 140;
const JUMP_FORCE = -16; // Higher jump to dodge projectiles
const MOVE_SPEED = 2.2;
const AIR_CONTROL = 0.25;
const FRICTION = 0.9;

// Special meter constants
const SPECIAL_METER_COST = 50; // Cost to use a special
const METER_GAIN_ON_HIT = 15; // Meter gained when landing a hit
const METER_GAIN_ON_DAMAGE = 10; // Meter gained when taking damage

export const createFighter = (
  characterData: CharacterData,
  x: number,
  facing: 'left' | 'right'
): Fighter => ({
  id: characterData.id,
  name: characterData.name,
  color: characterData.color,
  secondaryColor: characterData.secondaryColor,
  faceImage: characterData.faceImage,
  position: { x, y: GROUND_Y },
  velocity: { x: 0, y: 0 },
  health: 100,
  maxHealth: 100,
  facing,
  state: 'idle',
  stateFrame: 0,
  currentAttack: null,
  isBlocking: false,
  isGrounded: true,
  hitStun: 0,
  comboCount: 0,
  specialMeter: 0, // Start with no meter
});

export const createInitialGameState = (
  playerData: CharacterData,
  opponentData: CharacterData
): GameState => ({
  player: createFighter(playerData, 250, 'right'),
  opponent: createFighter(opponentData, 950, 'left'),
  particles: [],
  projectiles: [],
  textPopups: [],
  camera: {
    x: 0,
    y: 0,
    zoom: 1,
    shake: 0,
    targetZoom: 1,
  },
  gamePhase: 'intro',
  winner: null,
  slowMo: 1,
  roundTime: 99,
});

const getFighterHitBox = (fighter: Fighter): HitBox => ({
  x: fighter.position.x - FIGHTER_WIDTH / 2,
  y: fighter.position.y - FIGHTER_HEIGHT,
  width: FIGHTER_WIDTH,
  height: FIGHTER_HEIGHT,
});

const getAttackHitBox = (fighter: Fighter, attack: Attack): HitBox => {
  const attackWidth = attack.range;
  const attackHeight = attack.type === 'kick' ? 50 : 40;
  const attackY = attack.type === 'kick'
    ? fighter.position.y - FIGHTER_HEIGHT * 0.4
    : fighter.position.y - FIGHTER_HEIGHT * 0.7;

  return {
    x: fighter.facing === 'right'
      ? fighter.position.x + 20
      : fighter.position.x - 20 - attackWidth,
    y: attackY,
    width: attackWidth,
    height: attackHeight,
  };
};

const boxesIntersect = (a: HitBox, b: HitBox): boolean => {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
};

const createHitParticles = (x: number, y: number, color: string): Particle[] => {
  const particles: Particle[] = [];

  // Impact burst
  for (let i = 0; i < 12; i++) {
    const angle = (Math.PI * 2 * i) / 12 + Math.random() * 0.3;
    const speed = 8 + Math.random() * 6;
    particles.push({
      id: `spark-${Date.now()}-${i}`,
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 20 + Math.random() * 10,
      maxLife: 30,
      size: 6 + Math.random() * 8,
      color,
      type: 'spark',
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.4,
    });
  }

  // Stars
  for (let i = 0; i < 5; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 3 + Math.random() * 4;
    particles.push({
      id: `star-${Date.now()}-${i}`,
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 3,
      life: 40 + Math.random() * 20,
      maxLife: 60,
      size: 15 + Math.random() * 10,
      color: '#FFFF00',
      type: 'star',
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.2,
    });
  }

  return particles;
};

const createWhiffParticles = (x: number, y: number): Particle[] => {
  const particles: Particle[] = [];
  for (let i = 0; i < 5; i++) {
    const angle = Math.random() * Math.PI * 2;
    particles.push({
      id: `dust-${Date.now()}-${i}`,
      x,
      y,
      vx: Math.cos(angle) * 2,
      vy: Math.sin(angle) * 2 - 1,
      life: 15,
      maxLife: 15,
      size: 8 + Math.random() * 5,
      color: 'rgba(200, 200, 200, 0.5)',
      type: 'dust',
      rotation: 0,
      rotationSpeed: 0,
    });
  }
  return particles;
};

const createHitPopup = (
  text: string,
  x: number,
  y: number,
  type: 'hit' | 'combo' | 'ko'
): TextPopup => ({
  id: `popup-${Date.now()}-${Math.random()}`,
  text,
  x,
  y,
  life: type === 'ko' ? 120 : 45,
  maxLife: type === 'ko' ? 120 : 45,
  scale: type === 'ko' ? 2 : 1,
  color: type === 'ko' ? '#FF0000' : type === 'combo' ? '#FFD700' : '#FFFFFF',
  type,
});

// Projectile constants
const PROJECTILE_SPEED = 5; // Slower for readability
const PROJECTILE_SIZE = 50;
const PROJECTILE_LIFE = 180; // frames before auto-destroy (longer for slower speed)

const createProjectile = (
  fighter: Fighter,
  attack: Attack,
  owner: 'player' | 'opponent',
  text: string,
  color: string
): Projectile => {
  const direction = fighter.facing === 'right' ? 1 : -1;
  return {
    id: `proj-${Date.now()}-${Math.random()}`,
    x: fighter.position.x + direction * 50,
    y: fighter.position.y - FIGHTER_HEIGHT * 0.6,
    vx: PROJECTILE_SPEED * direction,
    owner,
    damage: attack.damage,
    text,
    color,
    life: PROJECTILE_LIFE,
  };
};

const updateProjectiles = (projectiles: Projectile[]): Projectile[] => {
  return projectiles
    .map((p) => ({
      ...p,
      x: p.x + p.vx,
      life: p.life - 1,
    }))
    .filter((p) => p.life > 0 && p.x > -100 && p.x < ARENA_WIDTH + 100);
};

const getProjectileHitBox = (projectile: Projectile): HitBox => ({
  x: projectile.x - PROJECTILE_SIZE / 2,
  y: projectile.y - PROJECTILE_SIZE / 2,
  width: PROJECTILE_SIZE,
  height: PROJECTILE_SIZE,
});

const checkProjectileHits = (
  state: GameState
): { state: GameState; newParticles: Particle[]; newPopups: TextPopup[]; soundEvents: SoundEvent[] } => {
  let newState = { ...state };
  const newParticles: Particle[] = [];
  const newPopups: TextPopup[] = [];
  const soundEvents: SoundEvent[] = [];
  const projectilesToRemove: string[] = [];

  for (const projectile of newState.projectiles) {
    const projectileBox = getProjectileHitBox(projectile);

    // Check if player projectile hits opponent
    if (projectile.owner === 'player') {
      const targetBox = getFighterHitBox(newState.opponent);

      if (boxesIntersect(projectileBox, targetBox)) {
        projectilesToRemove.push(projectile.id);
        const hitX = projectile.x;
        const hitY = projectile.y;

        if (newState.opponent.isBlocking) {
          // Blocked
          newState.opponent.health -= projectile.damage * 0.2;
          newState.opponent.velocity.x = (projectile.vx > 0 ? 1 : -1) * 5;
          newState.opponent.hitStun = 8;
          newParticles.push(...createWhiffParticles(hitX, hitY));
          newPopups.push(createHitPopup('BLOCK!', hitX, hitY - 50, 'hit'));
          soundEvents.push('block');
        } else {
          // Hit!
          newState.opponent.health -= projectile.damage;
          newState.opponent.velocity.x = (projectile.vx > 0 ? 1 : -1) * 12;
          newState.opponent.velocity.y = -5;
          newState.opponent.hitStun = 25;
          newState.opponent.state = 'hit';
          newState.opponent.comboCount++;

          // Meter gain: attacker gains meter for landing hit, defender gains for taking damage
          newState.player.specialMeter = Math.min(100, newState.player.specialMeter + METER_GAIN_ON_HIT);
          newState.opponent.specialMeter = Math.min(100, newState.opponent.specialMeter + METER_GAIN_ON_DAMAGE);

          newParticles.push(...createHitParticles(hitX, hitY, projectile.color));
          newPopups.push(createHitPopup(projectile.text + '!', hitX, hitY - 60, 'hit'));

          if (newState.opponent.comboCount > 1) {
            const comboText = COMBO_TEXTS[Math.min(newState.opponent.comboCount - 2, COMBO_TEXTS.length - 1)];
            newPopups.push(createHitPopup(`${newState.opponent.comboCount} HIT ${comboText}`, hitX, hitY - 120, 'combo'));
          }

          newState.camera.shake = Math.min(25, newState.camera.shake + projectile.damage * 0.7);
          soundEvents.push('special');
        }
      }
    }
    // Check if opponent projectile hits player
    else if (projectile.owner === 'opponent') {
      const targetBox = getFighterHitBox(newState.player);

      if (boxesIntersect(projectileBox, targetBox)) {
        projectilesToRemove.push(projectile.id);
        const hitX = projectile.x;
        const hitY = projectile.y;

        if (newState.player.isBlocking) {
          // Blocked
          newState.player.health -= projectile.damage * 0.2;
          newState.player.velocity.x = (projectile.vx > 0 ? 1 : -1) * 5;
          newState.player.hitStun = 8;
          newParticles.push(...createWhiffParticles(hitX, hitY));
          newPopups.push(createHitPopup('BLOCK!', hitX, hitY - 50, 'hit'));
          soundEvents.push('block');
        } else {
          // Hit!
          newState.player.health -= projectile.damage;
          newState.player.velocity.x = (projectile.vx > 0 ? 1 : -1) * 12;
          newState.player.velocity.y = -5;
          newState.player.hitStun = 25;
          newState.player.state = 'hit';
          newState.player.comboCount++;

          // Meter gain: attacker gains meter for landing hit, defender gains for taking damage
          newState.opponent.specialMeter = Math.min(100, newState.opponent.specialMeter + METER_GAIN_ON_HIT);
          newState.player.specialMeter = Math.min(100, newState.player.specialMeter + METER_GAIN_ON_DAMAGE);

          newParticles.push(...createHitParticles(hitX, hitY, projectile.color));
          newPopups.push(createHitPopup(projectile.text + '!', hitX, hitY - 60, 'hit'));

          if (newState.player.comboCount > 1) {
            const comboText = COMBO_TEXTS[Math.min(newState.player.comboCount - 2, COMBO_TEXTS.length - 1)];
            newPopups.push(createHitPopup(`${newState.player.comboCount} HIT ${comboText}`, hitX, hitY - 120, 'combo'));
          }

          newState.camera.shake = Math.min(25, newState.camera.shake + projectile.damage * 0.7);
          soundEvents.push('special');
        }
      }
    }
  }

  // Remove hit projectiles
  newState.projectiles = newState.projectiles.filter(p => !projectilesToRemove.includes(p.id));

  return { state: newState, newParticles, newPopups, soundEvents };
};

export interface InputState {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  punch: boolean;
  kick: boolean;
  special: boolean;
  block: boolean;
}

export interface GameUpdateResult {
  state: GameState;
  soundEvents: SoundEvent[];
}

export const updateGameState = (
  state: GameState,
  playerInput: InputState,
  playerAttacks: { punch: Attack; kick: Attack; special: Attack },
  opponentAttacks: { punch: Attack; kick: Attack; special: Attack },
  _deltaTime: number,
  gameMode: GameMode = 'vs-cpu',
  remoteInput?: InputState, // For online multiplayer
  playerProjectileText: string = 'SPECIAL',
  opponentProjectileText: string = 'SPECIAL'
): GameUpdateResult => {
  if (state.gamePhase === 'victory') {
    return {
      state: {
        ...state,
        particles: updateParticles(state.particles),
        projectiles: updateProjectiles(state.projectiles),
        textPopups: updateTextPopups(state.textPopups),
      },
      soundEvents: [],
    };
  }

  let newState = { ...state };
  const soundEvents: SoundEvent[] = [];
  let newProjectiles: Projectile[] = [];

  // Apply slow motion
  const timeScale = newState.slowMo;

  // Update slow motion decay
  if (newState.slowMo < 1) {
    newState.slowMo = Math.min(1, newState.slowMo + 0.02);
  }

  // Update fighters
  const playerResult = updateFighter(
    newState.player,
    playerInput,
    playerAttacks,
    timeScale,
    newState.gamePhase
  );
  newState.player = playerResult.fighter;

  // Spawn player projectile if special was just started
  if (playerResult.spawnedSpecial) {
    const projectile = createProjectile(
      newState.player,
      playerAttacks.special,
      'player',
      playerProjectileText,
      newState.player.color
    );
    newProjectiles.push(projectile);
    soundEvents.push('special');
  }

  // Determine opponent input based on game mode
  let opponentInput: InputState;
  if (gameMode === 'online' && remoteInput) {
    // Online mode: use remote player's input
    opponentInput = remoteInput;
  } else if (gameMode === 'training') {
    // Training mode: AI moves but doesn't attack
    opponentInput = calculateTrainingAIInput(newState.opponent, newState.player);
  } else {
    // VS CPU mode: regular AI
    opponentInput = calculateAIInput(newState.opponent, newState.player);
  }

  const opponentResult = updateFighter(
    newState.opponent,
    opponentInput,
    opponentAttacks,
    timeScale,
    newState.gamePhase
  );
  newState.opponent = opponentResult.fighter;

  // Spawn opponent projectile if special was just started
  if (opponentResult.spawnedSpecial) {
    const projectile = createProjectile(
      newState.opponent,
      opponentAttacks.special,
      'opponent',
      opponentProjectileText,
      newState.opponent.color
    );
    newProjectiles.push(projectile);
    soundEvents.push('special');
  }

  // Face each other
  if (newState.player.state !== 'hit' && newState.player.state !== 'attacking') {
    newState.player.facing = newState.player.position.x < newState.opponent.position.x ? 'right' : 'left';
  }
  if (newState.opponent.state !== 'hit' && newState.opponent.state !== 'attacking') {
    newState.opponent.facing = newState.opponent.position.x < newState.player.position.x ? 'right' : 'left';
  }

  // Add new projectiles
  newState.projectiles = [...newState.projectiles, ...newProjectiles];

  // Update projectiles
  newState.projectiles = updateProjectiles(newState.projectiles);

  // Check for projectile hits
  const projectileHitResult = checkProjectileHits(newState);
  newState = projectileHitResult.state;
  newState.particles = [...newState.particles, ...projectileHitResult.newParticles];
  newState.textPopups = [...newState.textPopups, ...projectileHitResult.newPopups];
  soundEvents.push(...projectileHitResult.soundEvents);

  // Check for melee hits (excludes specials which use projectiles)
  const hitResult = checkHits(newState);
  newState = hitResult.state;
  newState.particles = [...newState.particles, ...hitResult.newParticles];
  newState.textPopups = [...newState.textPopups, ...hitResult.newPopups];
  soundEvents.push(...hitResult.soundEvents);

  // Check for KO
  if (newState.player.health <= 0 && newState.gamePhase === 'fighting') {
    newState.gamePhase = 'ko';
    newState.winner = 'opponent';
    newState.slowMo = 0.1;
    newState.opponent.state = 'victory';
    newState.player.state = 'defeat';
    newState.camera.targetZoom = 1.3;
    newState.textPopups.push(createHitPopup('K.O.!', 600, 250, 'ko'));
    soundEvents.push('ko');
  } else if (newState.opponent.health <= 0 && newState.gamePhase === 'fighting') {
    newState.gamePhase = 'ko';
    newState.winner = 'player';
    newState.slowMo = 0.1;
    newState.player.state = 'victory';
    newState.opponent.state = 'defeat';
    newState.camera.targetZoom = 1.3;
    newState.textPopups.push(createHitPopup('K.O.!', 600, 250, 'ko'));
    soundEvents.push('ko');
  }

  // Transition from KO to victory
  if (newState.gamePhase === 'ko' && newState.slowMo >= 0.95) {
    newState.gamePhase = 'victory';
    soundEvents.push('victory');
  }

  // Update particles
  newState.particles = updateParticles(newState.particles);

  // Update text popups
  newState.textPopups = updateTextPopups(newState.textPopups);

  // Update camera
  newState.camera = updateCamera(newState.camera, newState.player, newState.opponent);

  return { state: newState, soundEvents };
};

interface FighterUpdateResult {
  fighter: Fighter;
  spawnedSpecial: boolean;
}

const updateFighter = (
  fighter: Fighter,
  input: InputState,
  attacks: { punch: Attack; kick: Attack; special: Attack },
  timeScale: number,
  gamePhase: string
): FighterUpdateResult => {
  let f = { ...fighter };
  let spawnedSpecial = false;

  if (gamePhase === 'intro' || gamePhase === 'victory' || gamePhase === 'ko') {
    // Just animate idle or victory
    f.stateFrame++;
    return { fighter: f, spawnedSpecial };
  }

  // Update hitstun
  if (f.hitStun > 0) {
    f.hitStun -= timeScale;
    if (f.hitStun <= 0) {
      f.hitStun = 0;
      f.state = 'idle';
      f.comboCount = 0;
    }
  }

  // Can only act if not in hitstun or attacking
  const canAct = f.hitStun <= 0 && (f.state !== 'attacking' || f.stateFrame > getTotalAttackFrames(f.currentAttack));

  if (canAct) {
    // Reset attack if finished
    if (f.state === 'attacking' && f.stateFrame > getTotalAttackFrames(f.currentAttack)) {
      f.state = 'idle';
      f.currentAttack = null;
      f.stateFrame = 0;
    }

    // Handle input
    if (input.special && f.isGrounded && f.specialMeter >= SPECIAL_METER_COST) {
      f.state = 'attacking';
      f.currentAttack = attacks.special;
      f.stateFrame = 0;
      f.velocity.x *= 0.2; // Specials root you more
      f.specialMeter -= SPECIAL_METER_COST; // Consume meter
      spawnedSpecial = true; // Signal to spawn a projectile
    } else if (input.punch && f.isGrounded) {
      f.state = 'attacking';
      f.currentAttack = attacks.punch;
      f.stateFrame = 0;
      f.velocity.x *= 0.3;
    } else if (input.kick && f.isGrounded) {
      f.state = 'attacking';
      f.currentAttack = attacks.kick;
      f.stateFrame = 0;
      f.velocity.x *= 0.3;
    } else if (input.up && f.isGrounded) {
      f.velocity.y = JUMP_FORCE * timeScale;
      f.isGrounded = false;
      f.state = 'jumping';
    }

    // Horizontal movement (only if not attacking)
    const moveMultiplier = f.isGrounded ? 1 : AIR_CONTROL;
    const canMove = f.state !== 'attacking';
    if (input.left && canMove) {
      f.velocity.x -= MOVE_SPEED * moveMultiplier * timeScale;
      if (f.isGrounded) f.state = 'walking';
    }
    if (input.right && canMove) {
      f.velocity.x += MOVE_SPEED * moveMultiplier * timeScale;
      if (f.isGrounded) f.state = 'walking';
    }

    // Blocking (dedicated block key)
    f.isBlocking = input.block && f.isGrounded && f.state !== 'attacking';
    if (f.isBlocking) {
      f.state = 'blocking';
      f.velocity.x *= 0.5;
    }

    // Idle state
    if (!input.left && !input.right && f.isGrounded && f.state === 'walking') {
      f.state = 'idle';
    }
  }

  // Apply physics
  f.velocity.x *= FRICTION;
  f.velocity.y += GRAVITY * timeScale;

  f.position.x += f.velocity.x * timeScale;
  f.position.y += f.velocity.y * timeScale;

  // Ground collision
  if (f.position.y >= GROUND_Y) {
    f.position.y = GROUND_Y;
    f.velocity.y = 0;
    f.isGrounded = true;
    if (f.state === 'jumping') f.state = 'idle';
  } else {
    f.isGrounded = false;
  }

  // Arena bounds
  f.position.x = Math.max(ARENA_PADDING, Math.min(ARENA_WIDTH - ARENA_PADDING, f.position.x));

  f.stateFrame++;

  return { fighter: f, spawnedSpecial };
};

const getTotalAttackFrames = (attack: Attack | null): number => {
  if (!attack) return 0;
  return attack.startup + attack.active + attack.recovery;
};

const isAttackActive = (fighter: Fighter): boolean => {
  if (!fighter.currentAttack || fighter.state !== 'attacking') return false;
  const attack = fighter.currentAttack;
  // Special attacks use projectiles, not melee hitboxes
  if (attack.type === 'special') return false;
  return (
    fighter.stateFrame >= attack.startup &&
    fighter.stateFrame < attack.startup + attack.active
  );
};

const checkHits = (
  state: GameState
): { state: GameState; newParticles: Particle[]; newPopups: TextPopup[]; soundEvents: SoundEvent[] } => {
  let newState = { ...state };
  const newParticles: Particle[] = [];
  const newPopups: TextPopup[] = [];
  const soundEvents: SoundEvent[] = [];

  // Check player attacking opponent
  if (isAttackActive(newState.player) && newState.opponent.hitStun <= 0) {
    const attackBox = getAttackHitBox(newState.player, newState.player.currentAttack!);
    const targetBox = getFighterHitBox(newState.opponent);

    if (boxesIntersect(attackBox, targetBox)) {
      const attack = newState.player.currentAttack!;
      const hitX = (attackBox.x + targetBox.x + targetBox.width) / 2;
      const hitY = attackBox.y + attackBox.height / 2;

      if (newState.opponent.isBlocking) {
        // Blocked - reduced damage and effects
        newState.opponent.health -= attack.damage * 0.2;
        newState.opponent.velocity.x = (newState.player.facing === 'right' ? 1 : -1) * attack.knockback * 0.3;
        newState.opponent.hitStun = 8;
        newParticles.push(...createWhiffParticles(hitX, hitY));
        newPopups.push(createHitPopup('BLOCK!', hitX, hitY - 50, 'hit'));
        soundEvents.push('block');
      } else {
        // Hit!
        newState.opponent.health -= attack.damage;
        newState.opponent.velocity.x = (newState.player.facing === 'right' ? 1 : -1) * attack.knockback;
        newState.opponent.velocity.y = -attack.knockback * 0.3;
        newState.opponent.hitStun = 20;
        newState.opponent.state = 'hit';
        newState.opponent.comboCount++;

        // Meter gain: attacker gains meter for landing hit, defender gains for taking damage
        newState.player.specialMeter = Math.min(100, newState.player.specialMeter + METER_GAIN_ON_HIT);
        newState.opponent.specialMeter = Math.min(100, newState.opponent.specialMeter + METER_GAIN_ON_DAMAGE);

        newParticles.push(...createHitParticles(hitX, hitY, newState.player.color));

        const hitSound = HIT_SOUNDS[Math.floor(Math.random() * HIT_SOUNDS.length)];
        newPopups.push(createHitPopup(hitSound, hitX, hitY - 60, 'hit'));

        if (newState.opponent.comboCount > 1) {
          const comboText = COMBO_TEXTS[Math.min(newState.opponent.comboCount - 2, COMBO_TEXTS.length - 1)];
          newPopups.push(createHitPopup(`${newState.opponent.comboCount} HIT ${comboText}`, hitX, hitY - 120, 'combo'));
        }

        // Camera shake
        newState.camera.shake = Math.min(20, newState.camera.shake + attack.damage * 0.5);

        // Sound event based on attack type
        soundEvents.push(attack.type === 'special' ? 'special' : attack.type === 'kick' ? 'kick' : 'punch');
      }

      // Clear attack so it doesn't hit again
      newState.player = {
        ...newState.player,
        stateFrame: newState.player.currentAttack!.startup + newState.player.currentAttack!.active,
      };
    }
  }

  // Check opponent attacking player
  if (isAttackActive(newState.opponent) && newState.player.hitStun <= 0) {
    const attackBox = getAttackHitBox(newState.opponent, newState.opponent.currentAttack!);
    const targetBox = getFighterHitBox(newState.player);

    if (boxesIntersect(attackBox, targetBox)) {
      const attack = newState.opponent.currentAttack!;
      const hitX = (attackBox.x + targetBox.x + targetBox.width) / 2;
      const hitY = attackBox.y + attackBox.height / 2;

      if (newState.player.isBlocking) {
        // Blocked
        newState.player.health -= attack.damage * 0.2;
        newState.player.velocity.x = (newState.opponent.facing === 'right' ? 1 : -1) * attack.knockback * 0.3;
        newState.player.hitStun = 8;
        newParticles.push(...createWhiffParticles(hitX, hitY));
        newPopups.push(createHitPopup('BLOCK!', hitX, hitY - 50, 'hit'));
        soundEvents.push('block');
      } else {
        // Hit!
        newState.player.health -= attack.damage;
        newState.player.velocity.x = (newState.opponent.facing === 'right' ? 1 : -1) * attack.knockback;
        newState.player.velocity.y = -attack.knockback * 0.3;
        newState.player.hitStun = 20;
        newState.player.state = 'hit';
        newState.player.comboCount++;

        // Meter gain: attacker gains meter for landing hit, defender gains for taking damage
        newState.opponent.specialMeter = Math.min(100, newState.opponent.specialMeter + METER_GAIN_ON_HIT);
        newState.player.specialMeter = Math.min(100, newState.player.specialMeter + METER_GAIN_ON_DAMAGE);

        newParticles.push(...createHitParticles(hitX, hitY, newState.opponent.color));

        const hitSound = HIT_SOUNDS[Math.floor(Math.random() * HIT_SOUNDS.length)];
        newPopups.push(createHitPopup(hitSound, hitX, hitY - 60, 'hit'));

        if (newState.player.comboCount > 1) {
          const comboText = COMBO_TEXTS[Math.min(newState.player.comboCount - 2, COMBO_TEXTS.length - 1)];
          newPopups.push(createHitPopup(`${newState.player.comboCount} HIT ${comboText}`, hitX, hitY - 120, 'combo'));
        }

        newState.camera.shake = Math.min(20, newState.camera.shake + attack.damage * 0.5);

        // Sound event based on attack type
        soundEvents.push(attack.type === 'special' ? 'special' : attack.type === 'kick' ? 'kick' : 'punch');
      }

      newState.opponent = {
        ...newState.opponent,
        stateFrame: newState.opponent.currentAttack!.startup + newState.opponent.currentAttack!.active,
      };
    }
  }

  // Check for whiff (attack finished without hitting)
  if (newState.player.currentAttack && newState.player.state === 'attacking') {
    const attack = newState.player.currentAttack;
    if (newState.player.stateFrame === attack.startup + attack.active) {
      const attackBox = getAttackHitBox(newState.player, attack);
      const targetBox = getFighterHitBox(newState.opponent);
      if (!boxesIntersect(attackBox, targetBox)) {
        newParticles.push(...createWhiffParticles(
          attackBox.x + attackBox.width / 2,
          attackBox.y + attackBox.height / 2
        ));
        soundEvents.push('whiff');
      }
    }
  }

  if (newState.opponent.currentAttack && newState.opponent.state === 'attacking') {
    const attack = newState.opponent.currentAttack;
    if (newState.opponent.stateFrame === attack.startup + attack.active) {
      const attackBox = getAttackHitBox(newState.opponent, attack);
      const targetBox = getFighterHitBox(newState.player);
      if (!boxesIntersect(attackBox, targetBox)) {
        newParticles.push(...createWhiffParticles(
          attackBox.x + attackBox.width / 2,
          attackBox.y + attackBox.height / 2
        ));
        soundEvents.push('whiff');
      }
    }
  }

  return { state: newState, newParticles, newPopups, soundEvents };
};

const updateParticles = (particles: Particle[]): Particle[] => {
  return particles
    .map((p) => ({
      ...p,
      x: p.x + p.vx,
      y: p.y + p.vy,
      vy: p.vy + 0.2,
      vx: p.vx * 0.98,
      life: p.life - 1,
      rotation: p.rotation + p.rotationSpeed,
    }))
    .filter((p) => p.life > 0);
};

const updateTextPopups = (popups: TextPopup[]): TextPopup[] => {
  return popups
    .map((p) => ({
      ...p,
      y: p.y - 1.5,
      life: p.life - 1,
      scale: p.scale * (p.life > p.maxLife * 0.8 ? 1.05 : 1),
    }))
    .filter((p) => p.life > 0);
};

const updateCamera = (
  camera: GameState['camera'],
  player: Fighter,
  opponent: Fighter
): GameState['camera'] => {
  const centerX = (player.position.x + opponent.position.x) / 2;
  const distance = Math.abs(player.position.x - opponent.position.x);

  // Zoom based on distance
  const targetZoom = Math.max(0.8, Math.min(1.2, 1 + (400 - distance) / 800));

  return {
    x: (centerX - 600) * 0.1,
    y: 0,
    zoom: camera.zoom + (camera.targetZoom - camera.zoom) * 0.05,
    targetZoom: Math.max(targetZoom, camera.targetZoom * 0.99),
    shake: camera.shake * 0.9,
  };
};

// AI Logic - more passive and reactive
const calculateAIInput = (ai: Fighter, player: Fighter): InputState => {
  const input: InputState = {
    left: false,
    right: false,
    up: false,
    down: false,
    punch: false,
    kick: false,
    special: false,
    block: false,
  };

  if (ai.hitStun > 0) return input;

  // AI has a "think" cooldown - only acts some of the time
  if (Math.random() > 0.4) return input; // 60% of the time, do nothing

  const distance = Math.abs(ai.position.x - player.position.x);
  const isPlayerAttacking = player.state === 'attacking';

  const rand = Math.random();

  // Approach player if too far - but slowly and hesitantly
  if (distance > 250) {
    if (rand < 0.5) { // Only move half the time
      if (ai.position.x < player.position.x) {
        input.right = true;
      } else {
        input.left = true;
      }
    }
    // Rarely jump while approaching
    if (rand < 0.005 && ai.isGrounded) {
      input.up = true;
    }
  }
  // In attack range - be cautious
  else if (distance < 120 && distance > 70) {
    // Block if player is attacking
    if (isPlayerAttacking && rand < 0.6) {
      input.block = true;
    }
    // Occasionally attack
    else if (rand < 0.025 && ai.state !== 'attacking') {
      if (rand < 0.005 && ai.specialMeter >= SPECIAL_METER_COST) {
        input.special = true; // Rare special attack (only if has meter)
      } else if (rand < 0.015) {
        input.punch = true;
      } else {
        input.kick = true;
      }
    }
    // Sometimes back off
    else if (rand < 0.1) {
      if (ai.position.x < player.position.x) {
        input.left = true;
      } else {
        input.right = true;
      }
    }
  }
  // Too close, mostly back off
  else if (distance <= 70) {
    // Rarely attack when close
    if (rand < 0.03 && ai.state !== 'attacking') {
      input.punch = true;
    }
    // Usually back away
    else if (rand < 0.4) {
      if (ai.position.x < player.position.x) {
        input.left = true;
      } else {
        input.right = true;
      }
    }
    // Sometimes block
    else if (rand < 0.5) {
      input.block = true;
    }
  }
  // Medium range - mostly idle, sometimes approach
  else {
    if (rand < 0.02) {
      if (ai.position.x < player.position.x) {
        input.right = true;
      } else {
        input.left = true;
      }
    }
  }

  return input;
};

// Training AI - moves around but never attacks
const calculateTrainingAIInput = (ai: Fighter, player: Fighter): InputState => {
  const input: InputState = {
    left: false,
    right: false,
    up: false,
    down: false,
    punch: false,   // Never attacks in training mode
    kick: false,    // Never attacks in training mode
    special: false, // Never attacks in training mode
    block: false,
  };

  if (ai.hitStun > 0) return input;

  // More active movement than regular AI
  if (Math.random() > 0.3) return input; // 30% idle

  const distance = Math.abs(ai.position.x - player.position.x);
  const rand = Math.random();

  // Move around to be a moving target
  if (distance > 200) {
    // Approach player
    if (rand < 0.6) {
      if (ai.position.x < player.position.x) {
        input.right = true;
      } else {
        input.left = true;
      }
    }
  } else if (distance < 100) {
    // Back away when close
    if (rand < 0.5) {
      if (ai.position.x < player.position.x) {
        input.left = true;
      } else {
        input.right = true;
      }
    }
    // Sometimes block to let player practice against blocking
    else if (rand < 0.7) {
      input.block = true;
    }
  } else {
    // Medium range - random movement
    if (rand < 0.3) {
      input.left = Math.random() > 0.5;
      input.right = !input.left;
    }
  }

  // Occasionally jump
  if (rand < 0.01 && ai.isGrounded) {
    input.up = true;
  }

  return input;
};
