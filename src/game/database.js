const Database = require('better-sqlite3');
const path = require('path');
const { FACTIONS, UNIT_TYPES } = require('./data');

const db = new Database(path.join(__dirname, '../../data/medieval2.db'));

// Initialize tables
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
    last_active INTEGER,
    created_at INTEGER
  );
`);

function getPlayer(userId) {
  const row = db.prepare('SELECT * FROM players WHERE user_id = ?').get(userId);
  if (!row) return null;

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
    lastActive: row.last_active,
    createdAt: row.created_at
  };
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

  db.prepare(`
    INSERT INTO players (user_id, faction, florins, turn, population, settlement_level, buildings, army, generals, agents, last_active, created_at)
    VALUES (?, ?, ?, 1, 500, 'village', '[]', ?, ?, '[]', ?, ?)
  `).run(
    userId,
    factionKey,
    faction.startingFlorins,
    JSON.stringify(starterArmy),
    JSON.stringify(starterGeneral),
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
  db
};
