export type UnitKind = 'harvester' | 'trooper' | 'ranger' | 'raider' | 'crawler' | 'wasp';
export type BuildingKind = 'core' | 'habitat' | 'extractor' | 'garrison' | 'works' | 'skyport' | 'turret';
export type ResourceKind = 'crystal' | 'vent';
export type Kind = UnitKind | BuildingKind | ResourceKind;

export interface Cost {
  crystal: number;
  flux: number;
}

export interface WeaponDef {
  damage: number;
  /** Edge-to-edge range in tiles. */
  range: number;
  /** Seconds between shots. */
  cooldown: number;
  hitsGround: boolean;
  hitsAir: boolean;
  /** Splash radius in tiles around the primary target. */
  splash?: number;
  bonusVsLight?: number;
  /** Visual style of the shot. */
  fx: 'bolt' | 'laser' | 'slash' | 'shell' | 'missile';
}

export interface UnitDef {
  kind: UnitKind;
  name: string;
  desc: string;
  hp: number;
  armor: number;
  /** Tiles per second. */
  speed: number;
  /** Collision radius in tiles. */
  radius: number;
  sight: number;
  cost: Cost;
  supply: number;
  buildTime: number;
  weapon?: WeaponDef;
  air?: boolean;
  light?: boolean;
  producedBy: BuildingKind;
  requires?: BuildingKind[];
}

export interface BuildingDef {
  kind: BuildingKind;
  name: string;
  desc: string;
  hp: number;
  armor: number;
  w: number;
  h: number;
  sight: number;
  cost: Cost;
  buildTime: number;
  supplyProvided?: number;
  trains?: UnitKind[];
  requires?: BuildingKind[];
  weapon?: WeaponDef;
  dropOff?: boolean;
  onVent?: boolean;
}

export interface ResourceDef {
  kind: ResourceKind;
  name: string;
  w: number;
  h: number;
  amount: number;
  /** Amount carried per trip. */
  perTrip: number;
  /** Seconds spent harvesting per trip. */
  mineTime: number;
}

export const UNITS: Record<UnitKind, UnitDef> = {
  harvester: {
    kind: 'harvester', name: 'Harvester', desc: 'Gathers crystal and flux. Constructs buildings.',
    hp: 40, armor: 0, speed: 3.0, radius: 0.33, sight: 7, cost: { crystal: 50, flux: 0 }, supply: 1, buildTime: 11,
    weapon: { damage: 5, range: 0.3, cooldown: 1.5, hitsGround: true, hitsAir: false, fx: 'slash' },
    light: true, producedBy: 'core',
  },
  trooper: {
    kind: 'trooper', name: 'Trooper', desc: 'Versatile rifle infantry. Hits ground and air.',
    hp: 50, armor: 0, speed: 2.8, radius: 0.35, sight: 8, cost: { crystal: 50, flux: 0 }, supply: 1, buildTime: 14,
    weapon: { damage: 6, range: 5, cooldown: 0.8, hitsGround: true, hitsAir: true, fx: 'bolt' },
    light: true, producedBy: 'garrison',
  },
  ranger: {
    kind: 'ranger', name: 'Ranger', desc: 'Long-range marksman. Strong single shots.',
    hp: 70, armor: 1, speed: 2.6, radius: 0.38, sight: 10, cost: { crystal: 75, flux: 25 }, supply: 2, buildTime: 18,
    weapon: { damage: 20, range: 7, cooldown: 1.8, hitsGround: true, hitsAir: true, fx: 'laser' },
    light: true, producedBy: 'garrison',
  },
  raider: {
    kind: 'raider', name: 'Raider', desc: 'Fast hover-bike with arc blades. Shreds light units.',
    hp: 95, armor: 0, speed: 4.6, radius: 0.45, sight: 8, cost: { crystal: 75, flux: 0 }, supply: 2, buildTime: 16,
    weapon: { damage: 10, range: 0.6, cooldown: 0.9, hitsGround: true, hitsAir: false, bonusVsLight: 8, fx: 'slash' },
    producedBy: 'works',
  },
  crawler: {
    kind: 'crawler', name: 'Crawler', desc: 'Heavy artillery walker. Long range splash vs ground.',
    hp: 170, armor: 1, speed: 2.2, radius: 0.6, sight: 10, cost: { crystal: 150, flux: 100 }, supply: 3, buildTime: 26,
    weapon: { damage: 30, range: 8, cooldown: 2.4, hitsGround: true, hitsAir: false, splash: 1.3, fx: 'shell' },
    producedBy: 'works',
  },
  wasp: {
    kind: 'wasp', name: 'Wasp', desc: 'Agile gunship. Flies over terrain, hits ground and air.',
    hp: 125, armor: 0, speed: 3.9, radius: 0.5, sight: 9, cost: { crystal: 125, flux: 75 }, supply: 2, buildTime: 22,
    weapon: { damage: 9, range: 5, cooldown: 1.0, hitsGround: true, hitsAir: true, fx: 'missile' },
    air: true, producedBy: 'skyport',
  },
};

export const BUILDINGS: Record<BuildingKind, BuildingDef> = {
  core: {
    kind: 'core', name: 'Command Core', desc: 'Trains harvesters. Resources are delivered here.',
    hp: 1500, armor: 1, w: 4, h: 3, sight: 11, cost: { crystal: 400, flux: 0 }, buildTime: 60,
    supplyProvided: 10, trains: ['harvester'], dropOff: true,
  },
  habitat: {
    kind: 'habitat', name: 'Habitat', desc: 'Provides 8 supply.',
    hp: 400, armor: 1, w: 2, h: 2, sight: 6, cost: { crystal: 100, flux: 0 }, buildTime: 20, supplyProvided: 8,
  },
  extractor: {
    kind: 'extractor', name: 'Extractor', desc: 'Built on a flux vent so harvesters can collect flux.',
    hp: 450, armor: 1, w: 3, h: 2, sight: 6, cost: { crystal: 75, flux: 0 }, buildTime: 20, onVent: true,
  },
  garrison: {
    kind: 'garrison', name: 'Garrison', desc: 'Trains infantry.',
    hp: 1000, armor: 1, w: 3, h: 3, sight: 8, cost: { crystal: 150, flux: 0 }, buildTime: 40,
    trains: ['trooper', 'ranger'], requires: ['core'],
  },
  works: {
    kind: 'works', name: 'War Works', desc: 'Builds vehicles and walkers.',
    hp: 1200, armor: 1, w: 3, h: 3, sight: 8, cost: { crystal: 150, flux: 100 }, buildTime: 45,
    trains: ['raider', 'crawler'], requires: ['garrison'],
  },
  skyport: {
    kind: 'skyport', name: 'Skyport', desc: 'Launches aircraft.',
    hp: 1100, armor: 1, w: 3, h: 3, sight: 8, cost: { crystal: 150, flux: 100 }, buildTime: 45,
    trains: ['wasp'], requires: ['works'],
  },
  turret: {
    kind: 'turret', name: 'Turret', desc: 'Static defense. Hits ground and air.',
    hp: 350, armor: 1, w: 2, h: 2, sight: 9, cost: { crystal: 100, flux: 0 }, buildTime: 22,
    requires: ['garrison'],
    weapon: { damage: 12, range: 7, cooldown: 1.0, hitsGround: true, hitsAir: true, fx: 'bolt' },
  },
};

export const RESOURCES: Record<ResourceKind, ResourceDef> = {
  crystal: { kind: 'crystal', name: 'Crystal', w: 2, h: 1, amount: 1500, perTrip: 5, mineTime: 2.2 },
  vent: { kind: 'vent', name: 'Flux Vent', w: 3, h: 2, amount: 2500, perTrip: 4, mineTime: 1.6 },
};

export const BUILD_MENU: BuildingKind[] = ['core', 'habitat', 'extractor', 'garrison', 'turret', 'works', 'skyport'];
export const MAX_SUPPLY = 200;
export const QUEUE_LIMIT = 5;

export function isUnitKind(k: Kind): k is UnitKind {
  return k in UNITS;
}
export function isBuildingKind(k: Kind): k is BuildingKind {
  return k in BUILDINGS;
}
export function isResourceKind(k: Kind): k is ResourceKind {
  return k in RESOURCES;
}
