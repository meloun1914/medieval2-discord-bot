const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { FACTIONS } = require('./data');

/** Region definitions (must match scripts/generate_map.py) */
const REGIONS = {
  london: { name: 'London', neighbors: ['paris'] },
  paris: { name: 'Paris', neighbors: ['london', 'cologne', 'milan'] },
  cologne: { name: 'Cologne', neighbors: ['paris', 'vienna', 'milan'] },
  milan: { name: 'Milan', neighbors: ['paris', 'cologne', 'venice', 'rome'] },
  venice: { name: 'Venice', neighbors: ['milan', 'vienna', 'rome'] },
  rome: { name: 'Rome', neighbors: ['milan', 'venice', 'tunis'] },
  vienna: { name: 'Vienna', neighbors: ['cologne', 'venice', 'budapest', 'krakow'] },
  krakow: { name: 'Krakow', neighbors: ['vienna', 'budapest', 'kiev'] },
  budapest: { name: 'Budapest', neighbors: ['vienna', 'krakow', 'constantinople'] },
  constantinople: { name: 'Constantinople', neighbors: ['budapest', 'kiev', 'jerusalem'] },
  novgorod: { name: 'Novgorod', neighbors: ['kiev'] },
  kiev: { name: 'Kiev', neighbors: ['novgorod', 'krakow', 'constantinople'] },
  cordoba: { name: 'Cordoba', neighbors: ['tunis'] },
  cairo: { name: 'Cairo', neighbors: ['jerusalem', 'tunis'] },
  jerusalem: { name: 'Jerusalem', neighbors: ['cairo', 'constantinople'] },
  tunis: { name: 'Tunis', neighbors: ['rome', 'cordoba', 'cairo'] }
};

const FACTION_HOME = {
  england: 'london',
  france: 'paris',
  hre: 'cologne',
  venice: 'venice',
  byzantium: 'constantinople',
  russia: 'novgorod',
  moors: 'cordoba',
  egypt: 'cairo'
};

/**
 * Build initial regions for a new player (home only).
 */
function startingRegions(factionKey) {
  const home = FACTION_HOME[factionKey];
  if (!home) return {};
  return { [home]: factionKey };
}

/**
 * After a successful battle, try to claim a neighboring rebel/unowned region.
 */
function tryExpand(player) {
  const owned = Object.keys(player.regions || {}).filter(
    rid => player.regions[rid] === player.faction
  );
  if (owned.length === 0) return null;

  const candidates = new Set();
  for (const rid of owned) {
    const info = REGIONS[rid];
    if (!info) continue;
    for (const n of info.neighbors) {
      if (!player.regions[n] || player.regions[n] === null) {
        candidates.add(n);
      }
    }
  }

  const list = [...candidates];
  if (list.length === 0) return null;

  const pick = list[Math.floor(Math.random() * list.length)];
  player.regions[pick] = player.faction;
  return pick;
}

/**
 * Generate map PNG via Python Pillow script.
 * Returns absolute path to the image.
 */
function generateMapImage(player) {
  return new Promise((resolve, reject) => {
    const outDir = path.join(__dirname, '../../data/maps');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    const outPath = path.join(outDir, `map_${player.userId}_${Date.now()}.png`);
    const script = path.join(__dirname, '../../scripts/generate_map.py');

    const state = {
      regions: player.regions || {},
      turn: player.turn,
      player_label: `${FACTIONS[player.faction]?.name || player.faction}`
    };

    const py = process.env.PYTHON_PATH || 'python3';
    const child = spawn(py, [script, outPath], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stderr = '';
    child.stderr.on('data', d => { stderr += d.toString(); });
    child.on('error', err => {
      // Fallback: try `python`
      if (py === 'python3') {
        const child2 = spawn('python', [script, outPath], { stdio: ['pipe', 'pipe', 'pipe'] });
        child2.stderr.on('data', d => { stderr += d.toString(); });
        child2.on('close', code => {
          if (code === 0 && fs.existsSync(outPath)) resolve(outPath);
          else reject(new Error(stderr || `python exit ${code}`));
        });
        child2.stdin.write(JSON.stringify(state));
        child2.stdin.end();
      } else {
        reject(err);
      }
    });

    child.on('close', code => {
      if (code === 0 && fs.existsSync(outPath)) {
        resolve(outPath);
      } else {
        reject(new Error(stderr || `Map generator exited with code ${code}`));
      }
    });

    child.stdin.write(JSON.stringify(state));
    child.stdin.end();
  });
}

module.exports = {
  REGIONS,
  FACTION_HOME,
  startingRegions,
  tryExpand,
  generateMapImage
};
