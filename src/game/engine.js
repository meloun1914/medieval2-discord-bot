const { FACTIONS, UNIT_TYPES, BUILDINGS, SETTLEMENT_LEVELS } = require('./data');
const { getPlayer, createPlayer, savePlayer } = require('./database');

/**
 * Calculate income per turn
 */
function calculateIncome(player) {
  let income = 200; // base

  // Population tax (simplified)
  income += Math.floor(player.population * 0.15);

  // Buildings
  for (const b of player.buildings) {
    const building = BUILDINGS[b];
    if (building && building.incomeBonus) {
      income += building.incomeBonus;
    }
  }

  // Faction bonus for trade-focused
  if (player.faction === 'venice') income = Math.floor(income * 1.25);

  return income;
}

/**
 * Calculate army upkeep
 */
function calculateUpkeep(player) {
  let upkeep = 0;
  for (const unit of player.army) {
    const def = UNIT_TYPES[unit.unit];
    if (def) {
      upkeep += def.upkeep * (unit.count || 1);
    }
  }
  return upkeep;
}

/**
 * End turn logic
 */
function endTurn(player) {
  const income = calculateIncome(player);
  const upkeep = calculateUpkeep(player);

  player.florins += income - upkeep;
  player.turn += 1;

  // Population growth
  const growth = Math.floor(player.population * 0.03) + 20;
  player.population += growth;

  // Check settlement upgrade
  const levels = Object.keys(SETTLEMENT_LEVELS);
  const currentIdx = levels.indexOf(player.settlementLevel);
  if (currentIdx < levels.length - 1) {
    const nextLevel = levels[currentIdx + 1];
    if (player.population >= SETTLEMENT_LEVELS[nextLevel].popRequired) {
      player.settlementLevel = nextLevel;
    }
  }

  // Clamp florins
  if (player.florins < 0) player.florins = 0;

  savePlayer(player);
  return { income, upkeep, growth };
}

/**
 * Recruit unit
 */
function recruitUnit(player, unitKey, amount = 1) {
  const unitDef = UNIT_TYPES[unitKey];
  if (!unitDef) return { success: false, message: 'Неизвестный юнит.' };

  // Check if unlocked by buildings
  const needsBuilding = Object.values(BUILDINGS).some(b => b.unlocks && b.unlocks.includes(unitKey));
  if (needsBuilding) {
    const hasUnlock = player.buildings.some(bKey => {
      const b = BUILDINGS[bKey];
      return b && b.unlocks && b.unlocks.includes(unitKey);
    });
    // Basic units always available
    const basic = ['spear_militia', 'peasant_archers'];
    if (!basic.includes(unitKey) && !hasUnlock) {
      return { success: false, message: 'Нужно построить соответствующее здание (казармы/конюшни/стрельбище).' };
    }
  }

  const totalCost = unitDef.cost * amount;
  if (player.florins < totalCost) {
    return { success: false, message: `Не хватает флоринов. Нужно ${totalCost}, есть ${player.florins}.` };
  }

  // Max army size ~20 units total for simplicity
  const currentSize = player.army.reduce((sum, u) => sum + (u.count || 1), 0);
  if (currentSize + amount > 20) {
    return { success: false, message: 'Армия не может быть больше 20 юнитов.' };
  }

  player.florins -= totalCost;

  const existing = player.army.find(u => u.unit === unitKey);
  if (existing) {
    existing.count = (existing.count || 1) + amount;
  } else {
    player.army.push({ unit: unitKey, count: amount, experience: 0 });
  }

  savePlayer(player);
  return { success: true, message: `Нанято ${amount}x ${unitDef.name} за ${totalCost} флоринов.` };
}

/**
 * Build building
 */
function buildBuilding(player, buildingKey) {
  const building = BUILDINGS[buildingKey];
  if (!building) return { success: false, message: 'Неизвестное здание.' };

  if (player.buildings.includes(buildingKey)) {
    return { success: false, message: 'Уже построено.' };
  }

  const maxBuildings = SETTLEMENT_LEVELS[player.settlementLevel]?.maxBuildings || 2;
  if (player.buildings.length >= maxBuildings) {
    return { success: false, message: `Достигнут лимит зданий для уровня ${player.settlementLevel} (${maxBuildings}).` };
  }

  if (player.florins < building.cost) {
    return { success: false, message: `Не хватает денег. Нужно ${building.cost}.` };
  }

  player.florins -= building.cost;
  player.buildings.push(buildingKey);
  savePlayer(player);

  return { success: true, message: `Построено: **${building.name}** за ${building.cost} флоринов.` };
}

/**
 * Simple battle simulation
 * Returns result object
 */
function simulateBattle(playerArmy, enemyPower = null) {
  // Generate enemy if not provided
  if (!enemyPower) {
    enemyPower = 40 + Math.floor(Math.random() * 80); // 40-120
  }

  let playerPower = 0;
  let details = [];

  for (const u of playerArmy) {
    const def = UNIT_TYPES[u.unit];
    if (!def) continue;

    const count = u.count || 1;
    const expBonus = (u.experience || 0) * 0.1;
    let unitPower = (def.attack + def.defense + (def.charge || 0)) * count * (1 + expBonus);

    // Type bonuses
    if (def.antiCav) unitPower *= 1.15;
    if (def.range) unitPower *= 1.1;

    playerPower += unitPower;
    details.push(`${def.name} x${count}: ~${Math.floor(unitPower)} силы`);
  }

  // Randomness ±15%
  const playerRoll = playerPower * (0.85 + Math.random() * 0.3);
  const enemyRoll = enemyPower * (0.85 + Math.random() * 0.3);

  const victory = playerRoll >= enemyRoll;
  const casualtiesPercent = victory
    ? 0.1 + Math.random() * 0.25
    : 0.35 + Math.random() * 0.4;

  return {
    victory,
    playerPower: Math.floor(playerPower),
    enemyPower: Math.floor(enemyPower),
    playerRoll: Math.floor(playerRoll),
    enemyRoll: Math.floor(enemyRoll),
    casualtiesPercent,
    details
  };
}

/**
 * Apply battle casualties to army
 */
function applyCasualties(player, percent) {
  const remaining = [];
  for (const u of player.army) {
    const lost = Math.ceil((u.count || 1) * percent);
    const left = Math.max(0, (u.count || 1) - lost);
    if (left > 0) {
      remaining.push({ ...u, count: left, experience: Math.min(9, (u.experience || 0) + 1) });
    }
  }
  player.army = remaining;
  savePlayer(player);
}

module.exports = {
  calculateIncome,
  calculateUpkeep,
  endTurn,
  recruitUnit,
  buildBuilding,
  simulateBattle,
  applyCasualties,
  getPlayer,
  createPlayer,
  savePlayer
};
