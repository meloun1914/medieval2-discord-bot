const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { FACTIONS } = require('./data');
const { startingRegions } = require('./map');

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(path.join(dataDir, 'medieval2.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS players (
    user_id TEXT PRIMARY KEY,
    faction TEXT NOT NULL,
    florins INTEGER DEFAULT 0,
    turn INTEGER DEFAULT 1,
    population INTEGER DEFAULT 500,
    settlement_level TEXT DEFAULT 'village',
    buildings TEXT DEFAULT '[]',
    army TEXT DEFAULT '[]',
    generals TEXT DEFAULT '[]',
    agents TEXT DEFAULT '[]',
    regions TEXT DEFAULT '{}',
    political_power INTEGER DEFAULT 40,
    stability INTEGER DEFAULT 60,
    war_support INTEGER DEFAULT 50,
    organization INTEGER DEFAULT 100,
    skills TEXT DEFAULT '{}',
    companions TEXT DEFAULT '[]',
    active_focus TEXT DEFAULT NULL,
    focus_turns_left INTEGER DEFAULT 0,
    focus_effects TEXT DEFAULT '{}',
    completed_focuses TEXT DEFAULT '[]',
    caravan_cooldown INTEGER DEFAULT 0,
    last_active INTEGER,
    created_at INTEGER
  );
`);

const extraColumns = [
  ['political_power', 'INTEGER DEFAULT 40'],
  ['stability', 'INTEGER DEFAULT 60'],
  ['war_support', 'INTEGER DEFAULT 50'],
  ['organization', 'INTEGER DEFAULT 100'],
  ['skills', "TEXT DEFAULT '{}'"] ,
  ['companions', "TEXT DEFAULT '[]'"],
  ['active_focus', 'TEXT DEFAULT NULL'],
  ['focus_turns_left', 'INTEGER DEFAULT 0'],
  ['focus_effects', "TEXT DEFAULT '{}'"],
  ['completed_focuses', "TEXT DEFAULT '[]'"],
  ['caravan_cooldown', 'INTEGER DEFAULT 0'],
  ['regions', "TEXT DEFAULT '{}'"]
];

for (const [col, def] of extraColumns) {
  try {
    db.exec(`ALTER TABLE players ADD COLUMN ${col} ${def}`);
  } catch (_) {}
}

function defaultSkills() {
  return { leadership: 1, stewardship: 1, prowess: 1, charm: 1 };
}

function parsePlayer(row) {
  if (!row) return null;
  let skills;
  try {
    skills = JSON.parse(row.skills || '{}');
  } catch {
    skills = {};
  }
  if (!skills.leadership) skills = { ...defaultSkills(), ...skills };

  return {
    userId: row.user_id,
    faction: row.faction,
    florins: row.florins,
    turn: row.turn,
    population: row.population,
    settlementLevel: row.settlement_level,
    buildings: JSON.parse(row.buildings || '[]'),
    army: JSON.parse(row.army || '[]'),
    generals: JSON.parse(row.generals || '[]'),
    agents: JSON.parse(row.agents || '[]'),
    regions: JSON.parse(row.regions || '{}'),
    politicalPower: row.political_power ?? 40,
    stability: row.stability ?? 60,
    warSupport: row.war_support ?? 50,
    organization: row.organization ?? 100,
    skills,
    companions: JSON.parse(row.companions || '[]'),
    activeFocus: row.active_focus || null,
    focusTurnsLeft: row.focus_turns_left || 0,
    focusEffects: JSON.parse(row.focus_effects || '{}'),
    completedFocuses: JSON.parse(row.completed_focuses || '[]'),
    caravanCooldown: row.caravan_cooldown || 0,
    lastActive: row.last_active,
    createdAt: row.created_at
  };
}

function getPlayer(userId) {
  const row = db.prepare('SELECT * FROM players WHERE user_id = ?').get(userId);
  return parsePlayer(row);
}

function createPlayer(userId, factionKey) {
  const faction = FACTIONS[factionKey];
  if (!faction) throw new Error('Invalid faction');

  const now = Date.now();
  const starterArmy = [
    { unit: 'spear_militia', count: 2, experience: 0 },
    { unit: 'peasant_archers', count: 1, experience: 0 }
  ];
  const starterGeneral = [{
    name: 'Lord ' + Math.random().toString(36).substring(2, 7).toUpperCase(),
    command: 3,
    chivalry: 1,
    dread: 0,
    loyalty: 5
  }];
  const regions = startingRegions(factionKey);
  const skills = defaultSkills();

  db.prepare(`
    INSERT INTO players (
      user_id, faction, florins, turn, population, settlement_level,
      buildings, army, generals, agents, regions,
      political_power, stability, war_support, organization,
      skills, companions, active_focus, focus_turns_left, focus_effects,
      completed_focuses, caravan_cooldown, last_active, created_at
    ) VALUES (?, ?, ?, 1, 500, 'village', '[]', ?, ?, '[]', ?, 40, 60, 50, 100, ?, '[]', NULL, 0, '{}', '[]', 0, ?, ?)
  `).run(
    userId,
    factionKey,
    faction.startingFlorins,
    JSON.stringify(starterArmy),
    JSON.stringify(starterGeneral),
    JSON.stringify(regions),
    JSON.stringify(skills),
    now,
    now
  );

  return getPlayer(userId);
}

function savePlayer(player) {
  db.prepare(`
    UPDATE players SET
      florins = ?,
      turn = ?,
      population = ?,
      settlement_level = ?,
      buildings = ?,
      army = ?,
      generals = ?,
      agents = ?,
      regions = ?,
      political_power = ?,
      stability = ?,
      war_support = ?,
      organization = ?,
      skills = ?,
      companions = ?,
      active_focus = ?,
      focus_turns_left = ?,
      focus_effects = ?,
      completed_focuses = ?,
      caravan_cooldown = ?,
      last_active = ?
    WHERE user_id = ?
  `).run(
    player.florins,
    player.turn,
    player.population,
    player.settlementLevel,
    JSON.stringify(player.buildings),
    JSON.stringify(player.army),
    JSON.stringify(player.generals),
    JSON.stringify(player.agents),
    JSON.stringify(player.regions || {}),
    player.politicalPower ?? 40,
    player.stability ?? 60,
    player.warSupport ?? 50,
    player.organization ?? 100,
    JSON.stringify(player.skills || defaultSkills()),
    JSON.stringify(player.companions || []),
    player.activeFocus || null,
    player.focusTurnsLeft || 0,
    JSON.stringify(player.focusEffects || {}),
    JSON.stringify(player.completedFocuses || []),
    player.caravanCooldown || 0,
    Date.now(),
    player.userId
  );
}

function deletePlayer(userId) {
  db.prepare('DELETE FROM players WHERE user_id = ?').run(userId);
}

module.exports = {
  getPlayer,
  createPlayer,
  savePlayer,
  deletePlayer,
  db,
  defaultSkills
};
