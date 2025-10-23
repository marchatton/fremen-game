import type { Vector3 } from './index.js';

// Equipment Types
export enum EquipmentSlot {
  HEAD = 'HEAD',
  BODY = 'BODY',
  FEET = 'FEET',
}

export enum EquipmentTier {
  BASIC = 'BASIC',
  IMPROVED = 'IMPROVED',
  ADVANCED = 'ADVANCED',
}

export enum EquipmentType {
  STILLSUIT = 'STILLSUIT',
  HEADGEAR = 'HEADGEAR',
  BOOTS = 'BOOTS',
  THUMPER = 'THUMPER',
}

export interface EquipmentItem {
  id: string;
  type: EquipmentType;
  tier: EquipmentTier;
  name: string;
  description: string;
  stats: EquipmentStats;
}

export interface EquipmentStats {
  waterReduction?: number; // Percentage (0-1)
  speedBoost?: number;
  healthBoost?: number;
}

export interface Equipment {
  head?: EquipmentItem;
  body?: EquipmentItem;
  feet?: EquipmentItem;
}

// Player Resources
export interface PlayerResources {
  water: number; // 0-100
  spice: number;
  equipment: Equipment;
  stats: PlayerStats;
  inventory: InventoryItem[];
}

export interface InventoryItem {
  id: string;
  type: EquipmentType;
  tier: EquipmentTier;
  quantity: number;
}

export interface PlayerStats {
  objectivesCompleted: number;
  totalSpiceEarned: number;
  distanceTraveled: number;
  deaths: number;
  wormsRidden: number;
}

// Spice Nodes
export enum SpiceNodeState {
  ACTIVE = 'ACTIVE',
  DEPLETED = 'DEPLETED',
  RESPAWNING = 'RESPAWNING',
}

export interface SpiceNode {
  id: string;
  position: Vector3;
  supply: number; // 0-100
  maxSupply: number;
  state: SpiceNodeState;
  respawnAt?: number; // timestamp
  lastHarvestedBy?: string; // playerId
}

// Oasis
export interface Oasis {
  id: string;
  position: Vector3;
  radius: number;
  refillAmount: number; // water to add
  cooldownDuration: number; // ms
  activeCooldowns: Record<string, number>; // playerId -> cooldownEndTime
}

// Sietch
export interface MerchantItem {
  id: string;
  item: EquipmentItem;
  price: number; // spice
  stock: number; // -1 = infinite
}

export interface TradeOffer {
  itemId: string;
  quantity: number;
  totalPrice: number;
}

// Death
export interface CorpseMarker {
  id: string;
  playerId: string;
  position: Vector3;
  spiceAmount: number;
  expiresAt: number; // timestamp
}

// Thirst Effects
export enum ThirstLevel {
  HYDRATED = 'HYDRATED',     // 100-50
  MILD = 'MILD',             // 50-25
  MODERATE = 'MODERATE',     // 25-10
  SEVERE = 'SEVERE',         // 10-0
}

export interface ThirstEffect {
  level: ThirstLevel;
  speedPenalty: number;    // Multiplier (0.9 = -10% speed)
  healthDrain: number;     // HP per second
  vfxIntensity: number;    // 0-1 for blur effect
}

export const THIRST_EFFECTS: Record<ThirstLevel, ThirstEffect> = {
  [ThirstLevel.HYDRATED]: {
    level: ThirstLevel.HYDRATED,
    speedPenalty: 1.0,
    healthDrain: 0,
    vfxIntensity: 0,
  },
  [ThirstLevel.MILD]: {
    level: ThirstLevel.MILD,
    speedPenalty: 0.9, // -10%
    healthDrain: 0,
    vfxIntensity: 0,
  },
  [ThirstLevel.MODERATE]: {
    level: ThirstLevel.MODERATE,
    speedPenalty: 0.75, // -25%
    healthDrain: 0,
    vfxIntensity: 0.3,
  },
  [ThirstLevel.SEVERE]: {
    level: ThirstLevel.SEVERE,
    speedPenalty: 0.5, // -50%
    healthDrain: 1, // -1 HP/second
    vfxIntensity: 0.7,
  },
};

// Water Depletion Rates (per minute)
export const WATER_DEPLETION_RATES = {
  IDLE: 0.5,
  WALKING: 1.0,
  RUNNING: 2.0,
  RIDING_WORM: 0.2,
} as const;

// Starting Resources
export const STARTING_RESOURCES: Partial<PlayerResources> = {
  water: 100,
  spice: 0,
  equipment: {},
  stats: {
    objectivesCompleted: 0,
    totalSpiceEarned: 0,
    distanceTraveled: 0,
    deaths: 0,
    wormsRidden: 0,
  },
  inventory: [
    {
      id: 'starter-thumper',
      type: EquipmentType.THUMPER,
      tier: EquipmentTier.BASIC,
      quantity: 3,
    },
  ],
};

// Equipment Definitions
export const EQUIPMENT_CATALOG: Record<string, EquipmentItem> = {
  'basic-stillsuit': {
    id: 'basic-stillsuit',
    type: EquipmentType.STILLSUIT,
    tier: EquipmentTier.BASIC,
    name: 'Basic Stillsuit',
    description: 'Standard desert survival suit. Reduces water loss by 25%.',
    stats: {
      waterReduction: 0.25,
    },
  },
  'improved-stillsuit': {
    id: 'improved-stillsuit',
    type: EquipmentType.STILLSUIT,
    tier: EquipmentTier.IMPROVED,
    name: 'Improved Stillsuit',
    description: 'Enhanced stillsuit with better reclamation. Reduces water loss by 50%.',
    stats: {
      waterReduction: 0.50,
    },
  },
  'advanced-stillsuit': {
    id: 'advanced-stillsuit',
    type: EquipmentType.STILLSUIT,
    tier: EquipmentTier.ADVANCED,
    name: 'Advanced Stillsuit',
    description: 'Fremen-quality stillsuit. Reduces water loss by 75%.',
    stats: {
      waterReduction: 0.75,
    },
  },
};

// Merchant Prices
export const MERCHANT_PRICES: Record<string, number> = {
  'basic-stillsuit': 50,
  'improved-stillsuit': 200,
  'advanced-stillsuit': 500,
  'thumper': 20,
};

// Economy Constants
export const ECONOMY_CONSTANTS = {
  OBJECTIVE_REWARD_SPICE: 50,
  OBJECTIVE_REWARD_WATER: 25,
  DEATH_SPICE_PENALTY: 0.20, // 20% of carried spice
  CORPSE_DURATION: 120000, // 2 minutes
  HARVEST_DURATION: 3000, // 3 seconds
  HARVEST_DISTANCE: 3, // meters
  OASIS_REFILL_AMOUNT: 50,
  OASIS_COOLDOWN: 300000, // 5 minutes
  SPICE_NODE_RESPAWN: 600000, // 10 minutes
  SPICE_NODE_MAX_SUPPLY: 100,
  SPICE_HARVEST_AMOUNT: 10, // per harvest
} as const;
