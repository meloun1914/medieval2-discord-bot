/**
 * Scripta Belli — «Писания войны»
 */

const GAME_NAME = 'Scripta Belli';

const FACTIONS = {
  england: {
    name: 'Англия',
    emoji: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    religion: 'Католицизм',
    startingFlorins: 8000,
    strengths: 'Длинные луки, сильная поздняя пехота',
    color: 0xC8102E
  },
  france: {
    name: 'Франция',
    emoji: '🇫🇷',
    religion: 'Католицизм',
    startingFlorins: 9000,
    strengths: 'Отличная тяжёлая кавалерия',
    color: 0x0055A4
  },
  hre: {
    name: 'Священная Римская империя',
    emoji: '🦅',
    religion: 'Католицизм',
    startingFlorins: 8500,
    strengths: 'Сбалансированная армия, крепкая пехота',
    color: 0x1A1A1A
  },
  venice: {
    name: 'Венеция',
    emoji: '🦁',
    religion: 'Католицизм',
    startingFlorins: 12000,
    strengths: 'Торговая империя, много денег',
    color: 0xCE1126
  },
  byzantium: {
    name: 'Византия',
    emoji: '🦅',
    religion: 'Православие',
    startingFlorins: 10000,
    strengths: 'Катафракты, сильный ранний этап',
    color: 0x9B2335
  },
  russia: {
    name: 'Русь',
    emoji: '🐻',
    religion: 'Православие',
    startingFlorins: 11000,
    strengths: 'Бояре, степная кавалерия',
    color: 0xD52B1E
  },
  moors: {
    name: 'Мавры',
    emoji: '🌙',
    religion: 'Ислам',
    startingFlorins: 9500,
    strengths: 'Лёгкая кавалерия, пустынная война',
    color: 0x006233
  },
  egypt: {
    name: 'Египет',
    emoji: '🏺',
    religion: 'Ислам',
    startingFlorins: 10000,
    strengths: 'Мамлюки, восточная мощь',
    color: 0xC09300
  }
};

const UNIT_TYPES = {
  spear_militia: {
    name: 'Копейная милиция',
    type: 'infantry',
    attack: 5, defense: 8, armor: 2, morale: 4,
    cost: 250, upkeep: 80, antiCav: true, tier: 1, promotesTo: 'spearmen'
  },
  peasant_archers: {
    name: 'Крестьянские лучники',
    type: 'missile',
    attack: 4, defense: 3, armor: 0, morale: 3,
    cost: 200, upkeep: 60, range: true, tier: 1, promotesTo: 'longbowmen'
  },
  spearmen: {
    name: 'Копейщики',
    type: 'infantry',
    attack: 8, defense: 12, armor: 4, morale: 6,
    cost: 450, upkeep: 125, antiCav: true, tier: 2, promotesTo: 'dismounted_feudal_knights'
  },
  feudal_knights: {
    name: 'Феодальные рыцари',
    type: 'cavalry',
    attack: 12, defense: 14, armor: 8, morale: 9,
    cost: 800, upkeep: 250, charge: 8, tier: 2, promotesTo: 'chivalric_knights'
  },
  dismounted_feudal_knights: {
    name: 'Спешенные феодальные рыцари',
    type: 'infantry',
    attack: 13, defense: 18, armor: 8, morale: 9,
    cost: 700, upkeep: 200, tier: 3
  },
  longbowmen: {
    name: 'Лучники с длинным луком',
    type: 'missile',
    attack: 9, defense: 5, armor: 2, morale: 6,
    cost: 550, upkeep: 150, range: true, tier: 2
  },
  chivalric_knights: {
    name: 'Рыцари-chevaliers',
    type: 'cavalry',
    attack: 14, defense: 16, armor: 10, morale: 10,
    cost: 1100, upkeep: 320, charge: 10, tier: 3
  },
  boyar_sons: {
    name: 'Сыны боярские',
    type: 'cavalry',
    attack: 13, defense: 15, armor: 7, morale: 9,
    cost: 900, upkeep: 280, charge: 7, tier: 3
  },
  mamluks: {
    name: 'Мамлюки',
    type: 'cavalry',
    attack: 12, defense: 13, armor: 6, morale: 9,
    cost: 850, upkeep: 260, charge: 6, tier: 3
  },
  cataphracts: {
    name: 'Катафракты',
    type: 'cavalry',
    attack: 11, defense: 17, armor: 12, morale: 10,
    cost: 1000, upkeep: 300, charge: 5, tier: 3
  }
};

const BUILDINGS = {
  farms: { name: 'Фермы', cost: 600, incomeBonus: 150, description: 'Сельское хозяйство — стабильный доход' },
  market: { name: 'Рынок', cost: 800, incomeBonus: 200, description: 'Торговля и пошлины' },
  barracks: { name: 'Казармы', cost: 1000, unlocks: ['spearmen', 'dismounted_feudal_knights'], description: 'Пехота и ветераны' },
  stables: { name: 'Конюшни', cost: 1200, unlocks: ['feudal_knights', 'boyar_sons', 'mamluks', 'cataphracts'], description: 'Конница' },
  archery_range: { name: 'Стрельбище', cost: 900, unlocks: ['longbowmen'], description: 'Лучники' },
  blacksmith: { name: 'Кузница', cost: 700, attackBonus: 1, description: 'Оружие (+1 к атаке всем юнитам)' }
};

const SETTLEMENT_LEVELS = {
  village: { name: 'Деревня', popRequired: 0, maxBuildings: 2 },
  town: { name: 'Городок', popRequired: 400, maxBuildings: 3 },
  large_town: { name: 'Большой город', popRequired: 2000, maxBuildings: 4 },
  city: { name: 'Город', popRequired: 6000, maxBuildings: 5 },
  large_city: { name: 'Крупный город', popRequired: 12000, maxBuildings: 6 }
};

const FOCUSES = {
  industrial_effort: {
    name: 'Промышленный рывок', emoji: '🏭', costPP: 50, duration: 3,
    description: '+25% дохода от зданий на 3 хода',
    effect: { incomeMult: 1.25, turns: 3 }
  },
  military_reform: {
    name: 'Военная реформа', emoji: '⚔️', costPP: 60, duration: 3,
    description: '+15% силы армии и +10 организации на 3 хода',
    effect: { armyMult: 1.15, orgBonus: 10, turns: 3 }
  },
  war_propaganda: {
    name: 'Военная пропаганда', emoji: '📢', costPP: 40, duration: 2,
    description: '+20 к поддержке войны, +5 к стабильности',
    effect: { warSupport: 20, stability: 5, turns: 0 }
  },
  grand_army: {
    name: 'Великая армия', emoji: '🛡️', costPP: 55, duration: 2,
    description: '−20% содержания армии на 2 хода',
    effect: { upkeepMult: 0.8, turns: 2 }
  },
  diplomatic_corps: {
    name: 'Дипломатический корпус', emoji: '🕊️', costPP: 45, duration: 2,
    description: '+15 полит. власти за ход на 2 хода',
    effect: { ppPerTurn: 15, turns: 2 }
  },
  total_mobilization: {
    name: 'Тотальная мобилизация', emoji: '🔥', costPP: 80, duration: 3,
    description: '+30% силы в бою, −10 стабильности',
    effect: { armyMult: 1.3, stability: -10, turns: 3 }
  }
};

const COMPANIONS = {
  sergius: {
    name: 'Сергий Казначей', emoji: '📒', cost: 1200, upkeep: 40,
    description: 'Бывший казначей. +12% дохода, больше опыта управления',
    bonuses: { incomeMult: 1.12, stewardXp: 2 }
  },
  brynhild: {
    name: 'Брюнхильд Железная Рука', emoji: '🪓', cost: 1500, upkeep: 50,
    description: 'Ветеран-наёмница. +10% силы армии, больше боевого опыта',
    bonuses: { armyMult: 1.1, prowessXp: 2 }
  },
  omar: {
    name: 'Омар Караванщик', emoji: '🐪', cost: 1100, upkeep: 35,
    description: 'Знает все дороги. Караваны +30% прибыли, меньше риска',
    bonuses: { caravanMult: 1.3, caravanRisk: -0.1 }
  },
  father_alric: {
    name: 'Отец Альрик', emoji: '✝️', cost: 900, upkeep: 30,
    description: 'Священник. +8 стабильности, больше опыта обаяния',
    bonuses: { stability: 8, charmXp: 2 }
  },
  liao: {
    name: 'Ляо Разведчик', emoji: '🏹', cost: 1000, upkeep: 35,
    description: 'Разведчик. +15 организации после боя',
    bonuses: { orgAfterBattle: 15 }
  }
};

const SKILLS = {
  leadership: { name: 'Лидерство', emoji: '👑', description: 'Сила армии и размер отряда' },
  stewardship: { name: 'Управление', emoji: '💼', description: 'Доход и строительство' },
  prowess: { name: 'Воинское мастерство', emoji: '⚔️', description: 'Личная мощь в бою' },
  charm: { name: 'Обаяние', emoji: '🕊️', description: 'Политическая власть и стабильность' }
};

module.exports = {
  GAME_NAME, FACTIONS, UNIT_TYPES, BUILDINGS, SETTLEMENT_LEVELS, FOCUSES, COMPANIONS, SKILLS
};
