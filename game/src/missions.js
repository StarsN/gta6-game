// The story of Solmar Nights and the taxi fares that pay the bills between jobs.
// Missions are data: each step names what to do and where, and the update below
// checks it off. All names, places and dialogue are original.
import { ECONOMY } from './config.js';
import { clamp, distance, range } from './random.js';
import { approachPoint, randomSidewalkPoint } from './city.js';
import { addWanted, clearWanted } from './police.js';

function at(place) {
  return { place };
}

export const MISSIONS = [
  {
    id: 'first-wheels',
    title: 'First Wheels',
    reward: ECONOMY.missionRewards[0],
    intro: "Rosa Ferrante: Milo, I need a set of wheels that can't be traced. Take any car on the street and bring it to the drop-off at the East Docks.",
    steps: [
      { type: 'enterCar', label: 'Steal a car (walk up to one and press E)' },
      { type: 'deliver', ...at('docks'), radius: 80, label: 'Deliver the car to the docks', inCar: true },
    ],
  },
  {
    id: 'the-pickup',
    title: 'The Pickup',
    reward: ECONOMY.missionRewards[1],
    intro: "Rosa Ferrante: A package is waiting in a container at the docks. Grab it, then bring it to the safehouse. The harbour patrol has been sniffing around — stay sharp.",
    steps: [
      { type: 'collect', ...at('docks'), radius: 60, hold: 2, label: 'Pick up the package at the docks' },
      { type: 'deliver', ...at('safehouse'), radius: 80, label: 'Bring the package to the safehouse' },
    ],
    onStart(game, audio) { addWanted(game, 1, audio); },
  },
  {
    id: 'getaway-driver',
    title: 'Getaway Driver',
    reward: ECONOMY.missionRewards[2],
    intro: "Rosa Ferrante: Sal's crew hit a courier van near Founders Plaza. Pick them up and get them to the safehouse — fast. The SCPD will be all over this in minutes.",
    steps: [
      { type: 'timed', ...at('plaza'), radius: 80, seconds: 75, label: 'Reach the crew at Founders Plaza' },
      { type: 'timed', ...at('safehouse'), radius: 80, seconds: 90, label: 'Get the crew to the safehouse', inCar: true },
    ],
    onStart(game, audio) { addWanted(game, 2, audio); },
  },
  {
    id: 'the-big-score',
    title: 'The Big Score',
    reward: ECONOMY.missionRewards[3],
    intro: "Rosa Ferrante: This is the one, Milo. The Solmar Reserve Bank. Get inside, hold the vault, and walk out rich. Chief Okafor will throw everything at you — make the safehouse and lose them.",
    steps: [
      { type: 'reach', ...at('bank'), radius: 80, label: 'Get to the Solmar Reserve Bank' },
      { type: 'collect', ...at('bank'), radius: 60, hold: 4, label: 'Hold the vault — grab the cash' },
      { type: 'deliver', ...at('safehouse'), radius: 80, label: 'Escape to the safehouse' },
      { type: 'loseHeat', label: 'Lose the heat (hide, or visit Quick Respray)' },
    ],
    onStart(game, audio) { addWanted(game, 2, audio); },
    onCollect(game, audio) { addWanted(game, 2, audio); },
  },
];

export function createMissions() {
  return {
    index: 0,
    stepIndex: 0,
    active: false,
    stepTimer: 0,
    holdTimer: 0,
    done: false,
    fare: null,
    fareCooldown: 6,
    retryTimer: 0,
  };
}

/** Resolve a step's place name to coordinates in this city: the street outside it. */
export function stepPosition(game, step) {
  if (step.place) {
    const place = game.city.places[step.place];
    const approach = approachPoint(place);
    return { x: approach.x, y: approach.y, label: place.label };
  }
  return { x: step.x, y: step.y, label: step.label ?? '' };
}

export function currentMission(game) {
  if (game.missions.index >= MISSIONS.length) return null;
  return MISSIONS[game.missions.index];
}

export function currentStep(game) {
  const mission = currentMission(game);
  if (!mission || !game.missions.active) return null;
  return mission.steps[game.missions.stepIndex] ?? null;
}

export function objectiveText(game) {
  const mission = currentMission(game);
  if (!mission) return 'Free roam — fares, packages and trouble, all yours.';
  const step = currentStep(game);
  if (!step) return mission.title;
  return `${mission.title}: ${step.label}`;
}

export function startMission(game, audio) {
  const mission = currentMission(game);
  if (!mission) return;
  game.missions.active = true;
  game.missions.stepIndex = 0;
  game.missions.holdTimer = 0;
  game.toasts.push({ text: `${mission.title} — ${mission.intro}`, time: 7 });
  audio.missionJingle();
  if (mission.onStart) mission.onStart(game, audio);
}

export function failMission(game, audio) {
  const mission = currentMission(game);
  if (!mission) return;
  game.missions.active = false;
  game.missions.stepIndex = 0;
  game.missions.retryTimer = 6;
  game.toasts.push({ text: `${mission.title} failed — try again in a moment`, time: 5 });
  audio.failTone();
}

export function completeMission(game, audio) {
  const mission = currentMission(game);
  if (!mission) return;
  game.player.cash += mission.reward;
  game.stats.earned += mission.reward;
  game.toasts.push({ text: `${mission.title} complete — $${mission.reward}`, time: 5 });
  audio.missionJingle();
  audio.cash();
  game.missions.index += 1;
  game.missions.active = false;
  game.missions.stepIndex = 0;
  if (game.missions.index >= MISSIONS.length) {
    game.missions.done = true;
    game.toasts.push({ text: 'Story complete. Solmar is yours — keep the fares coming.', time: 6 });
  }
}

function advanceStep(game, audio) {
  const mission = currentMission(game);
  game.missions.stepIndex += 1;
  game.missions.holdTimer = 0;
  game.missions.stepTimer = 0;
  if (game.missions.stepIndex >= mission.steps.length) {
    completeMission(game, audio);
  } else {
    const step = mission.steps[game.missions.stepIndex];
    game.toasts.push({ text: step.label, time: 4 });
  }
}

export function updateMissions(game, dt, audio) {
  const state = game.missions;
  if (state.retryTimer > 0) {
    state.retryTimer -= dt;
    return;
  }
  if (!state.active && state.index < MISSIONS.length) {
    startMission(game, audio);
    return;
  }
  const mission = currentMission(game);
  if (!mission || !state.active) return;
  const step = mission.steps[state.stepIndex];
  if (!step) return;
  const player = game.player;

  if (step.type === 'timed') {
    state.stepTimer += dt;
    if (state.stepTimer > step.seconds) {
      game.toasts.push({ text: 'Too slow — the window closed', time: 4 });
      failMission(game, audio);
      return;
    }
  }

  if (step.type === 'reach' || step.type === 'deliver') {
    const pos = stepPosition(game, step);
    if (step.inCar && !player.car) return;
    if (distance(player.x, player.y, pos.x, pos.y) < step.radius) {
      advanceStep(game, audio);
    }
  } else if (step.type === 'enterCar') {
    if (player.car) advanceStep(game, audio);
  } else if (step.type === 'collect') {
    const pos = stepPosition(game, step);
    if (distance(player.x, player.y, pos.x, pos.y) < step.radius) {
      state.holdTimer += dt;
      if (state.holdTimer >= step.hold) {
        if (mission.onCollect) mission.onCollect(game, audio);
        advanceStep(game, audio);
      }
    } else {
      state.holdTimer = Math.max(0, state.holdTimer - dt * 2);
    }
  } else if (step.type === 'loseHeat') {
    if (game.wanted === 0) advanceStep(game, audio);
  }
}

/** Taxi fares: while the player drives a cab, passengers flag one down. */
export function updateFares(game, dt, audio) {
  const state = game.missions;
  const player = game.player;
  const inTaxi = player.car && player.car.model.id === 'taxi';
  if (!inTaxi) {
    if (state.fare) {
      state.fare = null;
      state.fareCooldown = 8;
    }
    state.fareCooldown = Math.max(0, state.fareCooldown - dt);
    return;
  }
  if (!state.fare) {
    state.fareCooldown -= dt;
    if (state.fareCooldown > 0) return;
    const spot = randomSidewalkPoint(game.rng);
    if (distance(spot.x, spot.y, player.x, player.y) > 800) return;
    const dest = randomSidewalkPoint(game.rng);
    const fare = clamp(Math.round(distance(spot.x, spot.y, dest.x, dest.y) / 28), ECONOMY.taxiFareMin, ECONOMY.taxiFareMax);
    state.fare = { pickup: spot, dest, fare, onboard: false, waitTimer: 0 };
    game.toasts.push({ text: 'A fare is waiting — pick them up', time: 3 });
    return;
  }
  const fare = state.fare;
  if (!fare.onboard) {
    fare.waitTimer += dt;
    if (fare.waitTimer > 45) {
      state.fare = null;
      state.fareCooldown = 8;
      game.toasts.push({ text: 'The fare gave up waiting', time: 3 });
      return;
    }
    if (distance(player.x, player.y, fare.pickup.x, fare.pickup.y) < 55) {
      fare.onboard = true;
      audio.pickup();
      game.toasts.push({ text: `Passenger aboard — take them to the marker ($${fare.fare})`, time: 4 });
    }
  } else if (distance(player.x, player.y, fare.dest.x, fare.dest.y) < 60) {
    player.cash += fare.fare;
    game.stats.earned += fare.fare;
    game.stats.fares += 1;
    audio.cash();
    game.toasts.push({ text: `Fare paid — $${fare.fare}`, time: 3 });
    state.fare = null;
    state.fareCooldown = 10;
  }
}

/** The respray shop: drive in with heat and $100, drive out clean. */
export function updateRespray(game, audio) {
  const player = game.player;
  if (!player.car || game.wanted === 0 || player.cash < 100) return;
  const shop = game.city.places.respray;
  if (distance(player.x, player.y, shop.x, shop.y) < 110) {
    player.cash -= 100;
    clearWanted(game, audio);
    audio.cash();
    game.toasts.push({ text: 'Quick Respray — $100, good as new', time: 3 });
  }
}
