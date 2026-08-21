/**
 * Medieval II: Total War inspired data
 * Simplified for Discord bot
 */

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
    strengths: 'Excellent heavy cavalry (knights)',
    color: 0x0055A4
  },
  hre: {
    name: 'Holy Roman Empire',
    emoji: '🦅',
    religion: 'Catholic',
    startingFlorins: 8500,
    strengths: 'Balanced, strong infantry',
    color: 0x000000
  },
  venice: {
    name: 'Venice',
    emoji: '🦁',
    religion: 'Catholic',
    startingFlorins: 12000,
    strengths: 'Trade, money, good navy',
    color: 0xCE1126
  },
  byzantium: {
    name: 'Byzantine Empire',
    emoji: '🦅',
    religion: 'Orthodox',
    startingFlorins: 10000,
    strengths: 'Strong early units, cataphracts',
    color: 0x9B2335
  },
  russia: {
    name: 'Russia',
    emoji: '🐻',
    religion: 'Orthodox',
    startingFlorins: 11000,
    strengths: 'Excellent cavalry (Boyars, Dvors)',
    color: 0xD52B1E
  },
  moors: {
    name: 'Moors',
    emoji: '🌙',
    religion: 'Islam',
    startingFlorins: 9500,
    strengths: 'Light cavalry, camel units',
    color: 0x006233
  },
  egypt: {
    name: 'Egypt',
    emoji: '🏺',
    religion: 'Islam',
    startingFlorins: 10000,
    strengths: 'Mamluks, strong desert troops',
    color: 0xC09300
  }
};

const UNIT_TYPES = {
  // Militia / Early
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
    description: 'Дешёвые копейщики. Хороши против кавалерии.'
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
    description: 'Слабые лучники.'
  },
  // Mid
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
    description: 'Нормальные копья.'
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
    description: 'Классическая тяжёлая кавалерия.'
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
    description: 'Тяжёлая пехота.'
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
    description: 'Английские лучники. Очень сильны.'
  },
  // Late / Elite
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
    description: 'Элитная рыцарская кавалерия.'
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
    description: 'Русская тяжёлая кавалерия.'
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
    description: 'Египетская элитная кавалерия.'
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
    description: 'Византийская сверхтяжёлая кавалерия.'
  }
};

const BUILDINGS = {
  farms: {
    name: 'Farms',
    cost: 600,
    incomeBonus: 150,
    description: 'Увеличивает доход от сельского хозяйства'
  },
  market: {
    name: 'Market',
    cost: 800,
    incomeBonus: 200,
    description: 'Торговый бонус'
  },
  barracks: {
    name: 'Barracks',
    cost: 1000,
    unlocks: ['spearmen', 'dismounted_feudal_knights'],
    description: 'Позволяет нанимать лучшую пехоту'
  },
  stables: {
    name: 'Stables',
    cost: 1200,
    unlocks: ['feudal_knights', 'boyar_sons', 'mamluks', 'cataphracts'],
    description: 'Конюшни — кавалерия'
  },
  archery_range: {
    name: 'Archery Range',
    cost: 900,
    unlocks: ['longbowmen'],
    description: 'Стрельбище'
  },
  blacksmith: {
    name: 'Blacksmith',
    cost: 700,
    attackBonus: 1,
    description: 'Апгрейд оружия (+1 attack всем юнитам)'
  }
};

const SETTLEMENT_LEVELS = {
  village: { name: 'Village', popRequired: 0, maxBuildings: 2 },
  town: { name: 'Town', popRequired: 400, maxBuildings: 3 },
  large_town: { name: 'Large Town', popRequired: 2000, maxBuildings: 4 },
  city: { name: 'City', popRequired: 6000, maxBuildings: 5 },
  large_city: { name: 'Large City', popRequired: 12000, maxBuildings: 6 }
};

module.exports = {
  FACTIONS,
  UNIT_TYPES,
  BUILDINGS,
  SETTLEMENT_LEVELS
};
