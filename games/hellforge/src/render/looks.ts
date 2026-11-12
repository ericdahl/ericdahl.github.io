import { baseOf, type ClassId, type Item } from '../game/items';
import type { NpcKind } from '../game/world';
import type { HumanoidLook } from './figures';

export interface Gear {
  weapon?: Item | null;
  body?: Item | null;
  head?: Item | null;
  offhand?: Item | null;
  gloves?: Item | null;
  boots?: Item | null;
}

const ARMOR_KIND: Record<string, HumanoidLook['armor']> = {
  quilted_armor: 'cloth',
  leather_armor: 'leather',
  hard_leather: 'leather',
  studded_leather: 'studded',
  ring_mail: 'mail',
  scale_mail: 'scale',
  chain_mail: 'mail',
  lamellar: 'scale',
  plate_mail: 'plate',
  sun_plate: 'plate',
  fur_mantle: 'leather',
  founders_plate: 'plate',
};

const ARMOR_COLOR: Record<string, string> = {
  quilted_armor: '#9a8662',
  leather_armor: '#6b4a2e',
  hard_leather: '#5a3c24',
  studded_leather: '#5e4028',
  ring_mail: '#7e828a',
  scale_mail: '#7a7466',
  chain_mail: '#8a8e96',
  lamellar: '#8a6a3a',
  plate_mail: '#9ca2ac',
  sun_plate: '#c8a050',
  fur_mantle: '#a89a88',
  founders_plate: '#8a7a5a',
};

const HELM_KIND: Record<string, HumanoidLook['head']> = {
  cap: 'cap',
  skull_cap: 'skullcap',
  helm: 'helm',
  full_helm: 'fullhelm',
  great_helm: 'greathelm',
  wrapped_helm: 'wrapped',
  watch_helm: 'greathelm',
  circlet: 'circlet',
};

const HELM_COLOR: Record<string, string> = {
  cap: '#6a4a2e',
  skull_cap: '#7a7268',
  helm: '#8e939c',
  full_helm: '#9aa0aa',
  great_helm: '#a6acb6',
  wrapped_helm: '#c8b488',
  watch_helm: '#8a94a8',
  circlet: '#e0c060',
};

const SHIELD_KIND: Record<string, HumanoidLook['shieldShape']> = {
  buckler: 'round',
  small_shield: 'round',
  bronze_targe: 'round',
  large_shield: 'heater',
  kite_shield: 'kite',
  tower_shield: 'tower',
  bell_shield: 'round',
};

const SHIELD_COLOR: Record<string, string> = {
  buckler: '#6b4a2e',
  small_shield: '#7a5634',
  bronze_targe: '#b08040',
  large_shield: '#6a2a22',
  kite_shield: '#2a3a6a',
  tower_shield: '#4a4e58',
  bell_shield: '#a8834a',
};

const CLASS_BASE: Record<ClassId, HumanoidLook> = {
  reaver: {
    body: '#7a4a2a', trim: '#3a2a1a', skin: '#c89878', legs: '#4a3020', boots: '#2e2016', head: 'hair', hair: 'wild', headColor: '#3a2410',
    beard: '#3a2410', armor: 'leather', build: 1.15, gloves: '#3a2a1c',
  },
  arcanist: {
    body: '#33508f', trim: '#c8a858', skin: '#e0c0a0', legs: '#2e2a24', boots: '#2a2230', head: 'hood', headColor: '#2a3f72', robe: true,
    cape: '#22305a', eyeGlow: '#8ad8ff', accent: '#c8a858',
  },
  huntress: {
    body: '#3d5a32', trim: '#3a2a1a', skin: '#d8a888', legs: '#2e2a24', boots: '#4a3220', head: 'hair', hair: 'tail', headColor: '#b0702a',
    armor: 'leather', cape: '#2e4a2a', quiver: true, build: 0.9, gloves: '#5a3e24',
  },
  necromancer: {
    body: '#26262c', trim: '#9aa87a', skin: '#d8d2c4', legs: '#2e2a24', boots: '#1a1a1e', head: 'hood', headColor: '#1c1c22', robe: true,
    cape: '#141218', eyeGlow: '#a8ff70', accent: '#e8e0c8', bones: true,
  },
};

/** The hero's look: their class silhouette, dressed in whatever they have equipped. */
export function heroLook(classId: ClassId, eq: Gear): HumanoidLook {
  const base = CLASS_BASE[classId];
  const look: HumanoidLook = { ...base };
  const caster = classId === 'arcanist' || classId === 'necromancer';
  if (eq.body) {
    const id = eq.body.base;
    look.armor = ARMOR_KIND[id] ?? 'leather';
    look.body = ARMOR_COLOR[id] ?? '#6b4a2e';
    look.robe = false;
    if (look.armor === 'plate' || look.armor === 'scale' || look.armor === 'mail') look.pauldrons = look.body;
    // Casters keep a tabard of their colour over whatever armour they wear.
    if (caster) look.tabard = base.body;
  }
  if (eq.head) {
    const id = eq.head.base;
    look.head = HELM_KIND[id] ?? 'helm';
    look.headColor = HELM_COLOR[id] ?? '#8e939c';
    if (look.head === 'circlet') look.hairUnder = base.head === 'hair' ? base.headColor : classId === 'necromancer' ? '#d8d8d8' : '#3a2a20';
    else look.eyeGlow = undefined;
  }
  if (eq.weapon) {
    const b = baseOf(eq.weapon);
    look.weapon = b.id === 'club' ? 'club' : b.cat!;
    look.weaponId = b.id;
    look.weaponTier = b.qlvl >= 18 ? 3 : b.qlvl >= 9 ? 2 : 1;
    const r = eq.weapon.rarity;
    look.weaponGlow = r === 'unique' ? '#e8c27a' : r === 'set' ? '#60e060' : r === 'rare' ? '#f0e070' : r === 'magic' ? '#7090ff' : undefined;
  } else {
    look.weapon = null;
  }
  if (eq.offhand) {
    const id = eq.offhand.base;
    look.shield = SHIELD_COLOR[id] ?? '#6b4a2e';
    look.shieldShape = SHIELD_KIND[id] ?? 'heater';
  }
  if (eq.gloves) {
    const q = baseOf(eq.gloves).qlvl;
    look.gloves = q >= 12 ? '#8e939c' : q >= 7 ? '#4a3420' : '#6a4a2e';
  }
  if (eq.boots) {
    const q = baseOf(eq.boots).qlvl;
    look.boots = q >= 12 ? '#8e939c' : q >= 7 ? '#3a2818' : '#5a3e26';
  }
  return look;
}

const NPC_ACT1: Record<NpcKind, HumanoidLook> = {
  healer: {
    body: '#d8d0c0', trim: '#a02020', skin: '#e0c0a0', legs: '#333', head: 'hood', headColor: '#e8e0d0', robe: true, weapon: 'staff', weaponColor: '#ff8080',
    weaponGlow: '#ff9090', hairUnder: '#c8a060', accent: '#a02020', openHood: true,
  },
  smith: {
    body: '#5a3a22', trim: '#2a1a10', skin: '#c08868', legs: '#2a2018', boots: '#1e140c', head: 'hair', hair: 'bald', headColor: '#2a1a0a', beard: '#2a1a0a',
    weapon: 'mace', weaponId: 'hammer', weaponColor: '#888', apron: '#3a2416', build: 1.25, bareArms: true, gloves: '#2a1c12',
  },
  sage: {
    body: '#4a5068', trim: '#c8b060', skin: '#d8b898', legs: '#222', head: 'hair', hair: 'long', headColor: '#e8e8e8', beard: '#e8e8e8', longBeard: true,
    robe: true, weapon: 'staff', weaponColor: '#a0d8ff', weaponGlow: '#a0d8ff', accent: '#c8b060',
  },
  fence: {
    body: '#5a2a5a', trim: '#d8b850', skin: '#d0a888', legs: '#2a1a2a', boots: '#1a101a', head: 'hat', headColor: '#2a1a2a', cape: '#3a1a3a',
    weapon: 'dagger', weaponColor: '#c8c8d0', hair: 'short', hairUnder: '#1a1010', armor: 'cloth', accent: '#d8b850',
  },
  caravan: {
    body: '#8a6a3a', trim: '#3a2a18', skin: '#b08860', legs: '#3a2c1a', boots: '#2a1e12', head: 'turban', headColor: '#d8c8a0', weapon: 'staff', weaponColor: '#6a4a24',
    beard: '#2a1a0a', armor: 'cloth', cape: '#6a4a2a', accent: '#c84a2a',
  },
};

const NPC_ACT2: Partial<Record<NpcKind, HumanoidLook>> = {
  healer: {
    body: '#3f7f8a', trim: '#e8d8a0', skin: '#a87850', legs: '#222', head: 'hood', headColor: '#d8e8e0', robe: true, weapon: 'staff', weaponColor: '#80e0ff',
    weaponGlow: '#80e0ff', hairUnder: '#1a1210', accent: '#e8d8a0', openHood: true,
  },
  smith: {
    body: '#6a4a2a', trim: '#70c8c8', skin: '#8a5a38', legs: '#2a2018', boots: '#1e140c', head: 'turban', headColor: '#d8c8a0', beard: '#1a1210',
    weapon: 'mace', weaponId: 'hammer', weaponColor: '#70c8c8', apron: '#3a2416', build: 1.2, bareArms: true, gloves: '#2a1c12', accent: '#70c8c8',
  },
  sage: {
    body: '#7a5a2a', trim: '#e8c860', skin: '#8a6040', legs: '#222', head: 'hood', headColor: '#e8d8b0', robe: true, weapon: 'staff', weaponColor: '#ffd080',
    weaponGlow: '#ffd080', beard: '#d8d8d8', longBeard: true, openHood: true, accent: '#e8c860',
  },
  fence: {
    body: '#8a2a3a', trim: '#e8c860', skin: '#a87850', legs: '#2a1a1a', boots: '#1a1010', head: 'hair', hair: 'long', headColor: '#141014', cape: '#5a1a2a',
    weapon: 'dagger', weaponColor: '#e8c860', armor: 'cloth', accent: '#e8c860',
  },
};

/** Emberwatch under snow: the same people, a year older, wearing everything they own. */
const NPC_ACT3: Partial<Record<NpcKind, HumanoidLook>> = {
  healer: {
    body: '#b8b0a4', trim: '#a02020', skin: '#d8b8a0', legs: '#333', head: 'hood', headColor: '#d8d0c4', robe: true, weapon: 'staff', weaponColor: '#ff9040',
    weaponGlow: '#ffb060', hairUnder: '#c8a060', accent: '#a02020', openHood: true, cape: '#8a7a68', gloves: '#5a4a3a',
  },
  smith: {
    body: '#5a4a3a', trim: '#2a1a10', skin: '#b88868', legs: '#2a2018', boots: '#3a3028', head: 'cap', headColor: '#6a5a48', beard: '#4a4038',
    weapon: 'mace', weaponId: 'hammer', weaponColor: '#888', apron: '#3a2416', build: 1.25, gloves: '#2a1c12', cape: '#7a6a58',
  },
  sage: {
    body: '#4a5068', trim: '#c8b060', skin: '#d8b090', legs: '#222', head: 'hood', headColor: '#3a4058', robe: true, weapon: 'staff', weaponColor: '#ffb060',
    weaponGlow: '#ffb060', hairUnder: '#6a3a1a', openHood: true, accent: '#c8b060', cape: '#6a5a4a', build: 0.92, gloves: '#3a3040',
  },
  fence: {
    body: '#6a6258', trim: '#a8c0d0', skin: '#c8a888', legs: '#3a342c', boots: '#2a2620', head: 'hood', headColor: '#8a8478', cape: '#9a9488',
    weapon: 'dagger', weaponColor: '#c8d8e0', armor: 'leather', accent: '#a8c0d0', gloves: '#4a4038',
  },
};

export function npcLook(kind: NpcKind, act: number): HumanoidLook {
  return (act === 3 ? NPC_ACT3[kind] : act === 2 ? NPC_ACT2[kind] : undefined) ?? NPC_ACT1[kind];
}
