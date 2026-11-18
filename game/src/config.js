// Solmar Nights — every tuning number and colour in one place.
// The world is a fixed 3200x3200 city; the renderer scales it to the window,
// so no rule below depends on the screen size.

export const WORLD = 3200;
/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** City grid: roads run at these coordinates, both axes. */
export const ROADS = [200, 600, 1000, 1400, 1800, 2200, 2600, 3000];
export const ROAD_WIDTH = 72;
export const LANE = 18;

export const PLAYER = {
  radius: 13,
  walkSpeed: 170,
  runSpeed: 265,
  punchRange: 34,
  punchDamage: 20,
  punchCooldown: 0.42,
  maxHealth: 100,
  healthRegen: 2.5,
  regenDelay: 5,
  pistolDamage: 26,
  pistolRange: 460,
  pistolCooldown: 0.22,
  startAmmo: 60,
  maxAmmo: 240,
};

export const CAR = {
  accel: 420,
  brake: 700,
  reverseAccel: 260,
  maxSpeed: 560,
  maxReverse: 170,
  turnRate: 2.6,
  grip: 3.2,
  damageSpeed: 260,
  maxHealth: 100,
  length: 46,
  width: 22,
};

export const CAR_MODELS = [
  { id: 'sedan', name: 'Solmar Sedan', length: 46, width: 22, accel: 400, maxSpeed: 520, turn: 2.6, colors: ['#c0392b', '#2e6fb7', '#7d8a96', '#3f7d5a'] },
  { id: 'coupe', name: 'Vento Coupe', length: 44, width: 21, accel: 470, maxSpeed: 580, turn: 2.9, colors: ['#d4a017', '#8e44ad', '#c0392b'] },
  { id: 'sport', name: 'Falco GT', length: 45, width: 22, accel: 560, maxSpeed: 660, turn: 3.1, colors: ['#e67e22', '#16a085', '#e74c3c'] },
  { id: 'taxi', name: 'Harbor Cab', length: 46, width: 22, accel: 400, maxSpeed: 520, turn: 2.6, colors: ['#f1c40f'] },
  { id: 'truck', name: 'Dock Hauler', length: 58, width: 24, accel: 300, maxSpeed: 430, turn: 2.0, colors: ['#5d6d7e', '#935116'] },
  { id: 'van', name: 'Courier Van', length: 52, width: 23, accel: 340, maxSpeed: 460, turn: 2.2, colors: ['#aab7b8', '#2c3e50'] },
  { id: 'police', name: 'SCPD Interceptor', length: 46, width: 22, accel: 520, maxSpeed: 620, turn: 3.0, colors: ['#1a1a2e'] },
];

export const WANTED = {
  maxStars: 5,
  decayDelay: 8,
  decayInterval: 6,
  copCarSpeed: 540,
  bustTouchSeconds: 1.2,
  bustCarSeconds: 2.0,
  resprayCost: 100,
  hospitalFee: 150,
};

export const PED = {
  count: 56,
  walkSpeed: 55,
  fleeSpeed: 150,
};

export const TRAFFIC = {
  count: 18,
  cruiseSpeed: 210,
  spawnMargin: 700,
};

export const ECONOMY = {
  missionRewards: [200, 450, 700, 1500],
  taxiFareMin: 20,
  taxiFareMax: 60,
  packageValue: 50,
  packageBonus: 500,
  packageCount: 10,
};

export const DAY_LENGTH = 240;

export const SAVE_KEY = 'solmar-nights.save.v1';

export const PALETTE = {
  grass: '#3e7d44',
  parkGrass: '#4c9153',
  sand: '#d9c27a',
  water: '#1f6f8b',
  waterDeep: '#155e75',
  road: '#2f333a',
  roadEdge: '#4a4f57',
  sidewalk: '#8d9299',
  laneLine: '#e8d44d',
  buildingRoof: '#6b5d4f',
  buildingRoof2: '#7a6a58',
  downtownRoof: '#4a5568',
  windowLit: '#ffd166',
  windowDark: '#2c3e50',
  player: '#e74c3c',
  playerShirt: '#f39c12',
  police: '#1a1a2e',
  policeLight: '#e74c3c',
  policeLight2: '#3498db',
  taxi: '#f1c40f',
  text: '#f2f4f6',
  muted: '#aab2bd',
  hudPanel: 'rgba(12, 16, 24, 0.72)',
  star: '#ffd166',
  objective: '#f7dc6f',
  danger: '#e74c3c',
  ok: '#2ecc71',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Original story cast — nobody from any commercial game. */
export const CAST = {
  player: "Milo Kade",
  fixer: "Rosa Ferrante",
  boss: "Salvatore Moreau",
  cop: "Chief Dana Okafor",
};
