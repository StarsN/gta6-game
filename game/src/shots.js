// The screenshot scenes behind ?shot=start|street|chase|mission. Each one plays
// the real rules forward from a fresh world for a fixed number of steps, steered
// by a simple autopilot, so the frame is what a short game really looks like
// and the same seed always gives the same frame.
import { STEP } from './config.js';
import { createGame, stepGame } from './world.js';
import { enterCar, makeCar } from './player.js';
import { addWanted } from './police.js';

const START_SECONDS = 5;
const STREET_SECONDS = 7;
const CHASE_SECONDS = 8;
const MISSION_SECONDS = 2;

/** A fake input that drives a loop of downtown avenues, steering at each waypoint. */
const ROUTE = [
  { x: 2600, y: 1800 },
  { x: 2600, y: 1000 },
  { x: 1000, y: 1000 },
  { x: 1000, y: 1800 },
  { x: 2600, y: 1800 },
];

function routeDriver(game) {
  let waypoint = 0;
  return {
    move() {
      const car = game.player.car;
      if (!car) return { x: 0, y: 0 };
      const target = ROUTE[waypoint];
      const dx = target.x - car.x;
      const dy = target.y - car.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 90) {
        waypoint = (waypoint + 1) % ROUTE.length;
        return { x: 0, y: -1 };
      }
      const want = Math.atan2(dy, dx);
      let err = want - car.angle;
      while (err > Math.PI) err -= Math.PI * 2;
      while (err < -Math.PI) err += Math.PI * 2;
      const steer = Math.max(-1, Math.min(1, err * 3));
      // Brake for the corner: arrive slow, turn, then accelerate away.
      // Never brake when already slow, or the car would reverse instead.
      const speed = Math.abs(car.speed);
      const throttle = (Math.abs(err) > 0.9 && speed > 60) || (dist < 280 && speed > 240) ? 1 : -1;
      return { x: steer, y: throttle };
    },
    run() { return false; },
    takeActions() { return 0; },
    mouse: { x: 0, y: 0, down: false, clicked: false },
    clearClick() {},
  };
}

const IDLE_INPUT = {
  move() { return { x: 0, y: 0 }; },
  run() { return false; },
  takeActions() { return 0; },
  mouse: { x: 0, y: 0, down: false, clicked: false },
  clearClick() {},
};

function stepN(game, seconds, input, audio) {
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    stepGame(game, STEP, input, audio);
    if (game.over) break;
  }
}

/**
 * Set `game` to the named scene and return the screen to draw over it.
 * The game passed in is rebuilt from the seed first, so every scene is fresh.
 */
export function stageShot(name, seed, audio) {
  const game = createGame(seed);
  const silent = { sirenOn() {}, sirenOff() {}, stopEngine() {}, engineSet() {}, engineStart() {}, crash() {}, gunshot() {}, cash() {}, pickup() {}, missionJingle() {}, failTone() {}, click() {}, punch() {}, explosion() {} };
  const sfx = audio ?? silent;

  if (name === 'street') {
    // Milo driving a Falco GT around the downtown avenues, traffic around.
    const car = makeCar('sport', 800, 1800, 0, 'player');
    car.color = '#e67e22';
    car.speed = 380;
    game.cars.push(car);
    game.player.car = car;
    game.player.onFoot = false;
    game.player.x = car.x;
    game.player.y = car.y;
    game.camera.x = car.x;
    game.camera.y = car.y;
    game.timeOfDay = 0.3;
    stepN(game, STREET_SECONDS, routeDriver(game), sfx);
    return { game, screen: 'play' };
  }

  if (name === 'chase') {
    // Wanted 3 at dusk: two cruisers on Milo's tail through downtown.
    const car = makeCar('sport', 800, 1800, 0, 'player');
    car.color = '#e67e22';
    car.speed = 420;
    car.health = 62;
    game.cars.push(car);
    game.player.car = car;
    game.player.onFoot = false;
    game.player.x = car.x;
    game.player.y = car.y;
    game.camera.x = car.x;
    game.camera.y = car.y;
    game.timeOfDay = 0.42;
    addWanted(game, 3, sfx);
    stepN(game, CHASE_SECONDS, routeDriver(game), sfx);
    return { game, screen: 'play' };
  }

  if (name === 'mission') {
    // On foot mid-mission: Milo runs east along the avenue toward the docks,
    // the package marker ahead, a cruiser closing in behind him.
    game.missions.index = 1;
    game.missions.active = true;
    game.missions.stepIndex = 0;
    game.player.x = 2300;
    game.player.y = 1400;
    game.player.aimAngle = 0;
    game.camera.x = game.player.x;
    game.camera.y = game.player.y;
    game.timeOfDay = 0.35;
    addWanted(game, 1, sfx);
    const runEast = {
      move() { return { x: 1, y: 0 }; },
      run() { return true; },
      takeActions() { return 0; },
      mouse: { x: 0, y: 0, down: false, clicked: false },
      clearClick() {},
    };
    stepN(game, MISSION_SECONDS, runEast, sfx);
    return { game, screen: 'play' };
  }

  // Start: the title screen over a living downtown, camera drifting.
  game.player.x = 2000;
  game.player.y = 2000;
  game.camera.x = 2000;
  game.camera.y = 2000;
  game.timeOfDay = 0.3;
  stepN(game, START_SECONDS, IDLE_INPUT, sfx);
  return { game, screen: 'title' };
}
