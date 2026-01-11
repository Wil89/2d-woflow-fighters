import type { CharacterData, MapData, Attack } from '../types/game';

const createAttack = (
  name: string,
  damage: number,
  range: number,
  knockback: number,
  type: 'punch' | 'kick' | 'special',
  speed: 'fast' | 'medium' | 'slow'
): Attack => {
  const speedConfig = {
    fast: { startup: 3, active: 4, recovery: 8 },
    medium: { startup: 5, active: 5, recovery: 12 },
    slow: { startup: 8, active: 6, recovery: 16 },
  };
  const config = speedConfig[speed];
  return {
    name,
    damage,
    range,
    knockback,
    type,
    sound: type === 'punch' ? 'WHAM!' : type === 'kick' ? 'POW!' : 'BOOM!',
    ...config,
  };
};

export const characters: CharacterData[] = [
  {
    id: 'wil',
    name: 'WIL',
    color: '#FF4444',
    secondaryColor: '#FF8800',
    faceImage: '/assets/fighters/wil.png',
    description: 'The legendary street fighter!',
    specialty: 'Power Punches',
    attacks: {
      punch: createAttack('Thunder Fist', 15, 80, 12, 'punch', 'medium'),
      kick: createAttack('Dragon Kick', 18, 90, 15, 'kick', 'slow'),
    },
    stats: { power: 9, speed: 6, defense: 5 },
  },
  {
    id: 'jordan',
    name: 'JORDAN',
    color: '#44AAFF',
    secondaryColor: '#88DDFF',
    faceImage: '/assets/fighters/jordan.png',
    description: 'Swift and unstoppable!',
    specialty: 'Speed Combos',
    attacks: {
      punch: createAttack('Flash Jab', 10, 70, 8, 'punch', 'fast'),
      kick: createAttack('Cyclone Kick', 14, 85, 10, 'kick', 'fast'),
    },
    stats: { power: 5, speed: 9, defense: 6 },
  },
  {
    id: 'tony',
    name: 'TONY',
    color: '#44BB44',
    secondaryColor: '#88DD44',
    faceImage: '/assets/fighters/tony.png',
    description: 'The iron wall!',
    specialty: 'Iron Defense',
    attacks: {
      punch: createAttack('Steel Bash', 12, 75, 10, 'punch', 'medium'),
      kick: createAttack('Titan Stomp', 16, 80, 14, 'kick', 'medium'),
    },
    stats: { power: 7, speed: 5, defense: 8 },
  },
  {
    id: 'adrian',
    name: 'ADRIAN',
    color: '#9933FF',
    secondaryColor: '#CC66FF',
    faceImage: '/assets/fighters/adrian.png',
    description: 'Master of dark arts!',
    specialty: 'Shadow Strikes',
    attacks: {
      punch: createAttack('Phantom Punch', 14, 85, 11, 'punch', 'medium'),
      kick: createAttack('Void Kick', 17, 90, 13, 'kick', 'medium'),
    },
    stats: { power: 8, speed: 7, defense: 5 },
  },
  {
    id: 'haris',
    name: 'HARIS',
    color: '#FF6600',
    secondaryColor: '#FFAA44',
    faceImage: '/assets/fighters/haris.png',
    description: 'Blazing fury unleashed!',
    specialty: 'Fire Combos',
    attacks: {
      punch: createAttack('Inferno Fist', 16, 80, 13, 'punch', 'medium'),
      kick: createAttack('Blaze Kick', 19, 85, 15, 'kick', 'slow'),
    },
    stats: { power: 9, speed: 5, defense: 6 },
  },
  {
    id: 'karan',
    name: 'KARAN',
    color: '#00CCCC',
    secondaryColor: '#44FFFF',
    faceImage: '/assets/fighters/karan.png',
    description: 'Cool as ice, sharp as steel!',
    specialty: 'Precision Strikes',
    attacks: {
      punch: createAttack('Frost Jab', 11, 75, 9, 'punch', 'fast'),
      kick: createAttack('Ice Blade Kick', 15, 80, 12, 'kick', 'fast'),
    },
    stats: { power: 6, speed: 8, defense: 6 },
  },
  {
    id: 'lily',
    name: 'LILY',
    color: '#FF66AA',
    secondaryColor: '#FFAACC',
    faceImage: '/assets/fighters/lily.png',
    description: 'Grace meets power!',
    specialty: 'Agile Attacks',
    attacks: {
      punch: createAttack('Petal Strike', 12, 70, 10, 'punch', 'fast'),
      kick: createAttack('Blossom Kick', 14, 85, 11, 'kick', 'fast'),
    },
    stats: { power: 6, speed: 9, defense: 5 },
  },
  {
    id: 'richard',
    name: 'RICHARD',
    color: '#8B4513',
    secondaryColor: '#CD853F',
    faceImage: '/assets/fighters/richard.png',
    description: 'Unstoppable force!',
    specialty: 'Heavy Blows',
    attacks: {
      punch: createAttack('Mammoth Punch', 18, 90, 16, 'punch', 'slow'),
      kick: createAttack('Earthquake Stomp', 20, 95, 18, 'kick', 'slow'),
    },
    stats: { power: 10, speed: 4, defense: 6 },
  },
];

export const maps: MapData[] = [
  {
    id: 'san_francisco',
    name: 'San Francisco',
    image: '/assets/san_francisco.png',
    groundY: 520,
    ambience: 'Golden Gate Bridge Arena',
  },
  {
    id: 'new_york',
    name: 'New York',
    image: '/assets/new_york.png',
    groundY: 520,
    ambience: 'Times Square Showdown',
  },
  {
    id: 'woflow_arena',
    name: 'Woflow Arena',
    image: '/assets/woflow_arena.png',
    groundY: 520,
    ambience: 'The Ultimate Battleground',
  },
];

export const HIT_SOUNDS = ['WHAM!', 'POW!', 'BAM!', 'CRACK!', 'BOOM!', 'SMASH!', 'THWACK!'];
export const COMBO_TEXTS = ['NICE!', 'GREAT!', 'AWESOME!', 'AMAZING!', 'INCREDIBLE!', 'LEGENDARY!'];
