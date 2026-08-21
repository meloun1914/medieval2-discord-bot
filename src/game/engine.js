const {
  FACTIONS, UNIT_TYPES, BUILDINGS, SETTLEMENT_LEVELS, FOCUSES, COMPANIONS
} = require('./data');
const { getPlayer, createPlayer, savePlayer } = require('./database');
const { tryExpand } = require('./map');

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function skillBonus(level) {
  return 1 + (level - 1) * 0.03;
}

function getCompanionBonuses(player) {
  const acc = {
    incomeMult: 1, armyMult: 1, caravanMult: 1, caravanRisk: 0,
    stability: 0, orgAfterBattle: 0, stewardXp: 0, prowessXp: 0, charmXp: 0
  };
  for (const id of player.companions || []) {
    const c = COMPANIONS[id];
    if (!c?.bonuses) continue;
    if (c.bonuses.incomeMult) acc.incomeMult *= c.bonuses.incomeMult;
    if (c.bonuses.armyMult) acc.armyMult *= c.bonuses.armyMult;
    if (c.bonuses.caravanMult) acc.caravanMult *= c.bonuses.caravanMult;
    if (c.bonuses.caravanRisk) acc.caravanRisk += c.bonuses.caravanRisk;
    if (c.bonuses.stability) acc.stability += c.bonuses.stability;
    if (c.bonuses.orgAfterBattle) acc.orgAfterBattle += c.bonuses.orgAfterBattle;
    if (c.bonuses.stewardXp) acc.stewardXp += c.bonuses.stewardXp;
    if (c.bonuses.prowessXp) acc.prowessXp += c.bonuses.prowessXp;
    if (c.bonuses.charmXp) acc.charmXp += c.bonuses.charmXp;
  }
  return acc;
}

function getFocusEffects(player) {
  return player.focusEffects || {};
}

function calculateIncome(player) {
  let income = 200;
  income += Math.floor(player.population * 0.15);
  for (const b of player.buildings) {
    const building = BUILDINGS[b];
    if (building?.incomeBonus) income += building.incomeBonus;
  }
  const regionCount = Object.values(player.regions || {}).filter(Boolean).length;
  income += regionCount * 80;
  if (player.faction === 'venice') income = Math.floor(income * 1.25);
  const skills = player.skills || {};
  income = Math.floor(income * skillBonus(skills.stewardship || 1));
  const comp = getCompanionBonuses(player);
  income = Math.floor(income * comp.incomeMult);
  const fe = getFocusEffects(player);
  if (fe.incomeMult) income = Math.floor(income * fe.incomeMult);
  const stab = player.stability ?? 60;
  income = Math.floor(income * (0.7 + stab / 200));
  return income;
}

function calculateUpkeep(player) {
  let upkeep = 0;
  for (const unit of player.army) {
    const def = UNIT_TYPES[unit.unit];
    if (def) upkeep += def.upkeep * (unit.count || 1);
  }
  for (const id of player.companions || []) {
    const c = COMPANIONS[id];
    if (c) upkeep += c.upkeep;
  }
  const fe = getFocusEffects(player);
  if (fe.upkeepMult) upkeep = Math.floor(upkeep * fe.upkeepMult);
  return upkeep;
}

function gainSkillXp(player, skill, amount) {
  if (!player.skills) player.skills = { leadership: 1, stewardship: 1, prowess: 1, charm: 1 };
  const cur = player.skills[skill] || 1;
  if (cur >= 10) return false;
  const chance = Math.min(0.45, amount * 0.08 + 0.05);
  if (Math.random() < chance) {
    player.skills[skill] = cur + 1;
    return true;
  }
  return false;
}

function endTurn(player) {
  const income = calculateIncome(player);
  const upkeep = calculateUpkeep(player);
  player.florins += income - upkeep;
  player.turn += 1;
  const growth = Math.floor(player.population * 0.03) + 20;
  player.population += growth;
  const levels = Object.keys(SETTLEMENT_LEVELS);
  const currentIdx = levels.indexOf(player.settlementLevel);
  if (currentIdx < levels.length - 1) {
    const nextLevel = levels[currentIdx + 1];
    if (player.population >= SETTLEMENT_LEVELS[nextLevel].popRequired) {
      player.settlementLevel = nextLevel;
    }
  }
  if (player.florins < 0) player.florins = 0;
  const skills = player.skills || {};
  let ppGain = 8 + Math.floor((skills.charm || 1) * 1.5);
  const fe = getFocusEffects(player);
  if (fe.ppPerTurn) ppGain += fe.ppPerTurn;
  player.politicalPower = (player.politicalPower || 0) + ppGain;
  player.organization = clamp((player.organization || 100) + 25, 0, 100);
  if (player.activeFocus && player.focusTurnsLeft > 0) {
    player.focusTurnsLeft -= 1;
    if (player.focusTurnsLeft <= 0) {
      player.activeFocus = null;
      player.focusEffects = {};
    }
  }
  if (player.caravanCooldown > 0) player.caravanCooldown -= 1;
  const stab = player.stability ?? 60;
  if (stab > 55) player.stability = stab - 1;
  else if (stab < 45) player.stability = stab + 1;
  const comp = getCompanionBonuses(player);
  if (comp.stability) {
    player.stability = clamp((player.stability || 60) + Math.floor(comp.stability / 4), 0, 100);
  }
  const leveled = [];
  if (gainSkillXp(player, 'stewardship', 1 + (comp.stewardXp || 0))) leveled.push('stewardship');
  if (gainSkillXp(player, 'charm', 1 + (comp.charmXp || 0))) leveled.push('charm');
  savePlayer(player);
  return { income, upkeep, growth, ppGain, leveled };
}

function recruitUnit(player, unitKey, amount = 1) {
  const unitDef = UNIT_TYPES[unitKey];
  if (!unitDef) return { success: false, message: 'Неизвестный юнит.' };
  const needsBuilding = Object.values(BUILDINGS).some(b => b.unlocks && b.unlocks.includes(unitKey));
  if (needsBuilding) {
    const hasUnlock = player.buildings.some(bKey => BUILDINGS[bKey]?.unlocks?.includes(unitKey));
    const basic = ['spear_militia', 'peasant_archers'];
    if (!basic.includes(unitKey) && !hasUnlock) {
      return { success: false, message: 'Нужно здание (казармы / конюшни / стрельбище).' };
    }
  }
  const totalCost = unitDef.cost * amount;
  if (player.florins < totalCost) {
    return { success: false, message: `Не хватает флоринов. Нужно ${totalCost}, есть ${player.florins}.` };
  }
  const lead = player.skills?.leadership || 1;
  const maxArmy = 16 + lead * 2;
  const currentSize = player.army.reduce((sum, u) => sum + (u.count || 1), 0);
  if (currentSize + amount > maxArmy) {
    return {
      success: false,
      message: `Лимит армии ${maxArmy} (Лидерство ${lead}). Сейчас ${currentSize}.`
    };
  }
  player.florins -= totalCost;
  const existing = player.army.find(u => u.unit === unitKey);
  if (existing) existing.count = (existing.count || 1) + amount;
  else player.army.push({ unit: unitKey, count: amount, experience: 0 });
  gainSkillXp(player, 'leadership', 1);
  savePlayer(player);
  return { success: true, message: `Нанято ${amount}× ${unitDef.name} за ${totalCost} флоринов.` };
}

function buildBuilding(player, buildingKey) {
  const building = BUILDINGS[buildingKey];
  if (!building) return { success: false, message: 'Неизвестное здание.' };
  if (player.buildings.includes(buildingKey)) return { success: false, message: 'Уже построено.' };
  const maxBuildings = SETTLEMENT_LEVELS[player.settlementLevel]?.maxBuildings || 2;
  if (player.buildings.length >= maxBuildings) {
    return { success: false, message: `Лимит зданий для уровня «${SETTLEMENT_LEVELS[player.settlementLevel]?.name || player.settlementLevel}»: ${maxBuildings}.` };
  }
  if (player.florins < building.cost) {
    return { success: false, message: `Нужно ${building.cost} флоринов.` };
  }
  player.florins -= building.cost;
  player.buildings.push(buildingKey);
  gainSkillXp(player, 'stewardship', 2);
  savePlayer(player);
  return { success: true, message: `Построено: **${building.name}** за ${building.cost} флоринов.` };
}

function simulateBattle(player) {
  const playerArmy = player.army;
  let enemyPower = 45 + Math.floor(Math.random() * 90);
  let playerPower = 0;
  const details = [];
  for (const u of playerArmy) {
    const def = UNIT_TYPES[u.unit];
    if (!def) continue;
    const count = u.count || 1;
    const expBonus = (u.experience || 0) * 0.12;
    let unitPower = (def.attack + def.defense + (def.charge || 0)) * count * (1 + expBonus);
    if (def.antiCav) unitPower *= 1.15;
    if (def.range) unitPower *= 1.1;
    if (player.buildings.includes('blacksmith')) unitPower *= 1.05;
    playerPower += unitPower;
    details.push(`${def.name} ×${count}: ~${Math.floor(unitPower)}`);
  }
  const skills = player.skills || {};
  playerPower *= skillBonus(skills.leadership || 1);
  playerPower *= skillBonus(skills.prowess || 1);
  playerPower *= getCompanionBonuses(player).armyMult;
  const fe = getFocusEffects(player);
  if (fe.armyMult) playerPower *= fe.armyMult;
  const ws = (player.warSupport ?? 50) / 100;
  const org = (player.organization ?? 100) / 100;
  playerPower *= 0.75 + ws * 0.35;
  playerPower *= 0.55 + org * 0.45;
  const playerRoll = playerPower * (0.85 + Math.random() * 0.3);
  const enemyRoll = enemyPower * (0.85 + Math.random() * 0.3);
  const victory = playerRoll >= enemyRoll;
  const casualtiesPercent = victory ? 0.08 + Math.random() * 0.22 : 0.35 + Math.random() * 0.4;
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
}

function tryPromoteTroops(player) {
  const promoted = [];
  for (const u of player.army) {
    const def = UNIT_TYPES[u.unit];
    if (!def?.promotesTo || (u.experience || 0) < 4) continue;
    const next = UNIT_TYPES[def.promotesTo];
    if (!next) continue;
    const needsBuilding = Object.values(BUILDINGS).some(b => b.unlocks && b.unlocks.includes(def.promotesTo));
    if (needsBuilding) {
      const has = player.buildings.some(bKey => BUILDINGS[bKey]?.unlocks?.includes(def.promotesTo));
      if (!has) continue;
    }
    const convert = Math.min(u.count || 1, 1 + Math.floor(Math.random() * 2));
    u.count = (u.count || 1) - convert;
    const existing = player.army.find(x => x.unit === def.promotesTo);
    if (existing) {
      existing.count = (existing.count || 1) + convert;
      existing.experience = Math.max(existing.experience || 0, 1);
    } else {
      player.army.push({ unit: def.promotesTo, count: convert, experience: 2 });
    }
    promoted.push(`${convert}× ${def.name} → ${next.name}`);
  }
  player.army = player.army.filter(u => (u.count || 0) > 0);
  return promoted;
}

function resolveBattle(player) {
  if (!player.regions) player.regions = {};
  const result = simulateBattle(player);
  applyCasualties(player, result.casualtiesPercent);
  let loot = 0;
  let conquered = null;
  let promoted = [];
  const orgLoss = result.victory ? 15 + Math.floor(Math.random() * 15) : 30 + Math.floor(Math.random() * 25);
  player.organization = clamp((player.organization || 100) - orgLoss, 0, 100);
  const comp = getCompanionBonuses(player);
  if (comp.orgAfterBattle) {
    player.organization = clamp(player.organization + comp.orgAfterBattle, 0, 100);
  }
  if (result.victory) {
    loot = 150 + Math.floor(Math.random() * 350);
    loot = Math.floor(loot * (1 + (player.warSupport || 50) / 200));
    player.florins += loot;
    conquered = tryExpand(player);
    player.warSupport = clamp((player.warSupport || 50) + 3, 0, 100);
    promoted = tryPromoteTroops(player);
    gainSkillXp(player, 'prowess', 2 + (comp.prowessXp || 0));
    gainSkillXp(player, 'leadership', 1);
  } else {
    player.warSupport = clamp((player.warSupport || 50) - 5, 0, 100);
    player.stability = clamp((player.stability || 60) - 3, 0, 100);
  }
  savePlayer(player);
  return { ...result, loot, conquered, promoted, orgLoss };
}

function startFocus(player, focusKey) {
  const focus = FOCUSES[focusKey];
  if (!focus) return { success: false, message: 'Неизвестный фокус.' };
  if (player.activeFocus) {
    return {
      success: false,
      message: `Уже активен фокус: **${FOCUSES[player.activeFocus]?.name || player.activeFocus}** (${player.focusTurnsLeft} ход.).`
    };
  }
  if ((player.politicalPower || 0) < focus.costPP) {
    return {
      success: false,
      message: `Нужно ${focus.costPP} полит. власти, есть ${player.politicalPower || 0}.`
    };
  }
  player.politicalPower -= focus.costPP;
  player.activeFocus = focusKey;
  player.focusTurnsLeft = focus.duration;
  const eff = { ...focus.effect };
  if (eff.stability) player.stability = clamp((player.stability || 60) + eff.stability, 0, 100);
  if (eff.warSupport) player.warSupport = clamp((player.warSupport || 50) + eff.warSupport, 0, 100);
  if (eff.orgBonus) player.organization = clamp((player.organization || 100) + eff.orgBonus, 0, 100);
  player.focusEffects = {};
  if (eff.incomeMult) player.focusEffects.incomeMult = eff.incomeMult;
  if (eff.armyMult) player.focusEffects.armyMult = eff.armyMult;
  if (eff.upkeepMult) player.focusEffects.upkeepMult = eff.upkeepMult;
  if (eff.ppPerTurn) player.focusEffects.ppPerTurn = eff.ppPerTurn;
  if (eff.turns === 0) {
    player.activeFocus = null;
    player.focusTurnsLeft = 0;
    player.focusEffects = {};
  }
  if (!player.completedFocuses) player.completedFocuses = [];
  if (!player.completedFocuses.includes(focusKey)) player.completedFocuses.push(focusKey);
  gainSkillXp(player, 'charm', 2);
  savePlayer(player);
  return { success: true, message: `Фокус **${focus.name}** запущен.`, focus };
}

function hireCompanion(player, companionId) {
  const c = COMPANIONS[companionId];
  if (!c) return { success: false, message: 'Нет такого компаньона.' };
  if ((player.companions || []).includes(companionId)) return { success: false, message: 'Уже в отряде.' };
  if ((player.companions || []).length >= 3) return { success: false, message: 'Максимум 3 компаньона в отряде.' };
  if (player.florins < c.cost) return { success: false, message: `Нужно ${c.cost} флоринов.` };
  player.florins -= c.cost;
  if (!player.companions) player.companions = [];
  player.companions.push(companionId);
  if (c.bonuses?.stability) {
    player.stability = clamp((player.stability || 60) + c.bonuses.stability, 0, 100);
  }
  savePlayer(player);
  return { success: true, message: `**${c.name}** присоединился к отряду!`, companion: c };
}

function runCaravan(player) {
  if ((player.caravanCooldown || 0) > 0) {
    return { success: false, message: `Караван ещё в пути. Кулдаун: ${player.caravanCooldown} ход(ов).` };
  }
  const invest = Math.min(player.florins, 400 + Math.floor(Math.random() * 400));
  if (player.florins < 200) {
    return { success: false, message: 'Нужно хотя бы 200 флоринов на товары.' };
  }
  const comp = getCompanionBonuses(player);
  const risk = clamp(0.35 + comp.caravanRisk, 0.1, 0.6);
  const skills = player.skills || {};
  const skillSafe = (skills.stewardship || 1) * 0.02;
  const failed = Math.random() < risk - skillSafe;
  player.florins -= invest;
  player.caravanCooldown = 2;
  if (failed) {
    gainSkillXp(player, 'stewardship', 1);
    savePlayer(player);
    return {
      success: true, survived: false, invest, profit: -invest,
      message: `Караван ограблен! Потеряно **${invest}** флоринов.`
    };
  }
  let profit = Math.floor(invest * (0.35 + Math.random() * 0.55));
  profit = Math.floor(profit * comp.caravanMult * skillBonus(skills.stewardship || 1));
  player.florins += invest + profit;
  gainSkillXp(player, 'stewardship', 2);
  savePlayer(player);
  return {
    success: true, survived: true, invest, profit,
    message: `Караван вернулся! Вложено ${invest}, прибыль **+${profit}**.`
  };
}

module.exports = {
  calculateIncome, calculateUpkeep, endTurn, recruitUnit, buildBuilding,
  simulateBattle, applyCasualties, resolveBattle, startFocus, hireCompanion,
  runCaravan, getCompanionBonuses, getPlayer, createPlayer, savePlayer
};
