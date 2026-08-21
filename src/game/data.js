/**
 * Scripta Belli — hybrid of Medieval strategy, HOI4 and Mount & Blade
 * («Писания войны»)
 */

const GAME_NAME = 'Scripta Belli';

const FACTIONS = {
  england: {
    name: 'England',
    emoji: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    religion: 'Catholic',
    startingFlorins: 8000,
    strengths: 'Longbowmen, strong late infantry',
    color: 0xC8102E
  },
  france: {
    name: 'France',
    emoji: '🇫🇷',
    religion: 'Catholic',
    startingFlorins: 9000,
    strengths: 'Excellent heavy cavalry',
    color: 0x0055A4
  },
  hre: {
    name: 'Holy Roman Empire',
    emoji: '🦅',
    religion: 'Catholic',
    startingFlorins: 8500,
    strengths: 'Balanced, strong infantry',
    color: 0x1A1A1A
  },
  venice: {
    name: 'Venice',
    emoji: '🦁',
    religion: 'Catholic',
    startingFlorins: 12000,
    strengths: 'Trade empire, money',
    color: 0xCE1126
  },
  byzantium: {
    name: 'Byzantine Empire',
    emoji: '🦅',
    religion: 'Orthodox',
    startingFlorins: 10000,
    strengths: 'Cataphracts, strong early game',
    color: 0x9B2335
  },
  russia: {
    name: 'Russia',
    emoji: '🐻',
    religion: 'Orthodox',
    startingFlorins: 11000,
    strengths: 'Boyars, steppe cavalry',
    color: 0xD52B1E
  },
  moors: {
    name: 'Moors',
    emoji: '🌙',
    religion: 'Islam',
    startingFlorins: 9500,
    strengths: 'Light cavalry, desert warfare',
    color: 0x006233
  },
  egypt: {
    name: 'Egypt',
    emoji: '🏺',
    religion: 'Islam',
    startingFlorins: 10000,
    strengths: 'Mamluks, eastern power',
    color: 0xC09300
  }
};

const UNIT_TYPES = {
  spear_militia: {
    name: 'Spear Militia',
    type: 'infantry',
    attack: 5,
    defense: 8,
    armor: 2,
    morale: 4,
    cost: 250,
    upkeep: 80,
    antiCav: true,
    tier: 1,
    promotesTo: 'spearmen'
  },
  peasant_archers: {
    name: 'Peasant Archers',
    type: 'missile',
    attack: 4,
    defense: 3,
    armor: 0,
    morale: 3,
    cost: 200,
    upkeep: 60,
    range: true,
    tier: 1,
    promotesTo: 'longbowmen'
  },
  spearmen: {
    name: 'Spearmen',
    type: 'infantry',
    attack: 8,
    defense: 12,
    armor: 4,
    morale: 6,
    cost: 450,
    upkeep: 125,
    antiCav: true,
    tier: 2,
    promotesTo: 'dismounted_feudal_knights'
  },
  feudal_knights: {
    name: 'Feudal Knights',
    type: 'cavalry',
    attack: 12,
    defense: 14,
    armor: 8,
    morale: 9,
    cost: 800,
    upkeep: 250,
    charge: 8,
    tier: 2,
    promotesTo: 'chivalric_knights'
  },
  dismounted_feudal_knights: {
    name: 'Dismounted Feudal Knights',
    type: 'infantry',
    attack: 13,
    defense: 18,
    armor: 8,
    morale: 9,
    cost: 700,
    upkeep: 200,
    tier: 3
  },
  longbowmen: {
    name: 'Longbowmen',
    type: 'missile',
    attack: 9,
    defense: 5,
    armor: 2,
    morale: 6,
    cost: 550,
    upkeep: 150,
    range: true,
    tier: 2
  },
  chivalric_knights: {
    name: 'Chivalric Knights',
    type: 'cavalry',
    attack: 14,
    defense: 16,
    armor: 10,
    morale: 10,
    cost: 1100,
    upkeep: 320,
    charge: 10,
    tier: 3
  },
  boyar_sons: {
    name: 'Boyar Sons',
    type: 'cavalry',
    attack: 13,
    defense: 15,
    armor: 7,
    morale: 9,
    cost: 900,
    upkeep: 280,
    charge: 7,
    tier: 3
  },
  mamluks: {
    name: 'Mamluks',
    type: 'cavalry',
    attack: 12,
    defense: 13,
    armor: 6,
    morale: 9,
    cost: 850,
    upkeep: 260,
    charge: 6,
    tier: 3
  },
  cataphracts: {
    name: 'Cataphracts',
    type: 'cavalry',
    attack: 11,
    defense: 17,
    armor: 12,
    morale: 10,
    cost: 1000,
    upkeep: 300,
    charge: 5,
    tier: 3
  }
};

const BUILDINGS = {
  farms: {
    name: 'Farms',
    cost: 600,
    incomeBonus: 150,
    description: 'Сельское хозяйство — стабильный доход'
  },
  market: {
    name: 'Market',
    cost: 800,
    incomeBonus: 200,
    description: 'Торговля и пошлины'
  },
  barracks: {
    name: 'Barracks',
    cost: 1000,
    unlocks: ['spearmen', 'dismounted_feudal_knights'],
    description: 'Пехота и ветераны'
  },
  stables: {
    name: 'Stables',
    cost: 1200,
    unlocks: ['feudal_knights', 'boyar_sons', 'mamluks', 'cataphracts'],
    description: 'Конница'
  },
  archery_range: {
    name: 'Archery Range',
    cost: 900,
    unlocks: ['longbowmen'],
    description: 'Лучники'
  },
  blacksmith: {
    name: 'Blacksmith',
    cost: 700,
    attackBonus: 1,
    description: 'Оружие (+1 ATK всем юнитам)'
  }
};

const SETTLEMENT_LEVELS = {
  village: { name: 'Village', popRequired: 0, maxBuildings: 2 },
  town: { name: 'Town', popRequired: 400, maxBuildings: 3 },
  large_town: { name: 'Large Town', popRequired: 2000, maxBuildings: 4 },
  city: { name: 'City', popRequired: 6000, maxBuildings: 5 },
  large_city: { name: 'Large City', popRequired: 12000, maxBuildings: 6 }
};

/** HOI4-style national focuses */
const FOCUSES = {
  industrial_effort: {
    name: 'Industrial Effort',
    emoji: '🏭',
    costPP: 50,
    duration: 3,
    description: '+25% дохода от зданий на 3 хода',
    effect: { incomeMult: 1.25, turns: 3 }
  },
  military_reform: {
    name: 'Military Reform',
    emoji: '⚔️',
    costPP: 60,
    duration: 3,
    description: '+15% силы армии и +10 организации на 3 хода',
    effect: { armyMult: 1.15, orgBonus: 10, turns: 3 }
  },
  war_propaganda: {
    name: 'War Propaganda',
    emoji: '📢',
    costPP: 40,
    duration: 2,
    description: '+20 War Support, +5 Stability',
    effect: { warSupport: 20, stability: 5, turns: 0 }
  },
  grand_army: {
    name: 'Grand Army',
    emoji: '🛡️',
    costPP: 55,
    duration: 2,
    description: '−20% upkeep армии на 2 хода',
    effect: { upkeepMult: 0.8, turns: 2 }
  },
  diplomatic_corps: {
    name: 'Diplomatic Corps',
    emoji: '🕊️',
    costPP: 45,
    duration: 2,
    description: '+15 Political Power за ход на 2 хода',
    effect: { ppPerTurn: 15, turns: 2 }
  },
  total_mobilization: {
    name: 'Total Mobilization',
    emoji: '🔥',
    costPP: 80,
    duration: 3,
    description: '+30% силы в бою, −10 Stability',
    effect: { armyMult: 1.3, stability: -10, turns: 3 }
  }
};

/** Mount & Blade companions */
const COMPANIONS = {
  sergius: {
    name: 'Sergius the Steward',
    emoji: '📒',
    cost: 1200,
    upkeep: 40,
    description: 'Бывший казначей. +12% дохода, +stewardship XP',
    bonuses: { incomeMult: 1.12, stewardXp: 2 }
  },
  brynhild: {
    name: 'Brynhild Iron-Arm',
    emoji: '🪓',
    cost: 1500,
    upkeep: 50,
    description: 'Ветеран наёмницы. +10% силы армии, +prowess XP',
    bonuses: { armyMult: 1.1, prowessXp: 2 }
  },
  omar: {
    name: 'Omar the Caravaner',
    emoji: '🐪',
    cost: 1100,
    upkeep: 35,
    description: 'Знает все дороги. Караваны +30% прибыли, меньше риска',
    bonuses: { caravanMult: 1.3, caravanRisk: -0.1 }
  },
  father_alric: {
    name: 'Father Alric',
    emoji: '✝️',
    cost: 900,
    upkeep: 30,
    description: 'Священник. +8 Stability, +charm XP',
    bonuses: { stability: 8, charmXp: 2 }
  },
  liao: {
    name: 'Liao the Scout',
    emoji: '🏹',
    cost: 1000,
    upkeep: 35,
    description: 'Разведчик. +15 организация после боя',
    bonuses: { orgAfterBattle: 15 }
  }
};

/** Ruler skills (Mount & Blade style) */
const SKILLS = {
  leadership: {
    name: 'Leadership',
    emoji: '👑',
    description: 'Сила армии и размер отряда'
  },
  stewardship: {
    name: 'Stewardship',
    emoji: '💼',
    description: 'Доход и здания'
  },
  prowess: {
    name: 'Prowess',
    emoji: '⚔️',
    description: 'Личная мощь в бою'
  },
  charm: {
    name: 'Charm',
    emoji: '🕊️',
    description: 'Political Power и стабильность'
  }
};

module.exports = {
  GAME_NAME,
  FACTIONS,
  UNIT_TYPES,
  BUILDINGS,
  SETTLEMENT_LEVELS,
  FOCUSES,
  COMPANIONS,
  SKILLS
};
