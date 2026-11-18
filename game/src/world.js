// The world: one game state and the fixed step that moves it. Systems run in a
// fixed order — player, traffic, police, combat, missions — then the camera and
// the clock, so every frame sees the same world whatever the display rate.
import { DAY_LENGTH, STEP, WORLD } from './config.js';
import { createRandom, clamp, distance, lerp } from './random.js';
import { approachPoint, createCity } from './city.js';
import { createPlayer, updateDriving, updateOnFoot } from './player.js';
import { spawnParkedCars, spawnPeds, spawnTrafficCar, updatePeds, updateTraffic } from './traffic.js';
import { clearWanted, updatePolice } from './police.js';
import { spawnParticles, updateBullets, updateParticles, updatePickups, spawnPickups } from './combat.js';
import { createMissions, updateFares, updateMissions, updateRespray } from './missions.js';

export function createGame(seed) {
  const rng = createRandom(seed);
  const city = createCity(rng);
  const spawn = approachPoint(city.places.safehouse);
  const game = {
    seed,
    rng,
    city,
    time: 0,
    timeOfDay: 0.32,
    player: createPlayer(spawn.x, spawn.y),
    cars: [],
    peds: [],
    cops: [],
    bullets: [],
    particles: [],
    pickups: [],
    events: [],
    toasts: [],
    wanted: 0,
    timeSinceCrime: 999,
    decayTimer: 0,
    spawnTimer: 0,
    missions: createMissions(),
    stats: { earned: 0, fares: 0, packages: 0, busted: 0 },
    camera: { x: spawn.x, y: spawn.y, zoom: 1 },
    viewport: { width: 1280, height: 720 },
    shake: 0,
    over: null,
    paused: false,
  };
  spawnParkedCars(game);
  spawnPeds(game);
  for (let i = 0; i < 12; i += 1) spawnTrafficCar(game, false);
  spawnPickups(game);
  return game;
}

export function resetGame(game, keepCash) {
  const cash = keepCash ? game.player.cash : 0;
  const fresh = createGame(game.seed);
  fresh.player.cash = cash;
  return fresh;
}

function processEvents(game, audio) {
  for (const event of game.events) {
    if (event.type === 'explosion') {
      game.particles.push({ kind: 'fireball', x: event.x, y: event.y, radius: 8, maxRadius: 80, life: 0.6, age: 0 });
      spawnParticles(game, event.x, event.y, 18, '#e67e22', 260, 0.7);
      spawnParticles(game, event.x, event.y, 10, '#2c3e50', 90, 1.2);
      // The blast hurts the player when they stand too close.
      if (distance(game.player.x, game.player.y, event.x, event.y) < 110 && game.player.onFoot) {
        game.player.health -= 25;
        game.player.regenTimer = 0;
        if (game.player.health <= 0) {
          game.player.health = 0;
          game.events.push({ type: 'wasted' });
        }
      }
    } else if (event.type === 'crash') {
      spawnParticles(game, event.x, event.y, event.hard ? 10 : 5, '#b0b7bd', 140, 0.4);
    } else if (event.type === 'carjack') {
      game.toasts.push({ text: 'Car stolen — someone may have seen that', time: 3 });
    } else if (event.type === 'busted') {
      game.over = 'busted';
      game.stats.busted += 1;
      audio.sirenOff();
      audio.stopEngine();
    } else if (event.type === 'wasted') {
      game.over = 'wasted';
      audio.sirenOff();
      audio.stopEngine();
    }
  }
  game.events.length = 0;
}

/** Advance the world one fixed step. Input is only read while playing. */
export function stepGame(game, dt, input, audio) {
  if (game.over) return;
  game.time += dt;
  game.timeOfDay = (game.timeOfDay + dt / DAY_LENGTH) % 1;

  const player = game.player;
  if (player.onFoot) updateOnFoot(game, dt, input, audio);
  else updateDriving(game, dt, input, audio);

  updateTraffic(game, dt);
  updatePeds(game, dt);
  updatePolice(game, dt, audio);
  updateBullets(game, dt, audio);
  updateParticles(game, dt);
  updatePickups(game, dt, audio);
  updateMissions(game, dt, audio);
  updateFares(game, dt, audio);
  updateRespray(game, audio);

  // Toasts fade after their time.
  for (const toast of game.toasts) toast.time -= dt;
  game.toasts = game.toasts.filter((t) => t.time > 0);

  // Camera: follow the player, wider when driving, with a little look-ahead.
  // The view never leaves the world: the camera stops at the edge.
  const targetZoom = player.onFoot ? 1 : 0.82;
  game.camera.zoom = lerp(game.camera.zoom, targetZoom, 1 - Math.pow(0.5, dt * 2));
  const lookX = player.onFoot ? Math.cos(player.angle) * 40 : Math.cos(player.angle) * 90;
  const lookY = player.onFoot ? Math.sin(player.angle) * 40 : Math.sin(player.angle) * 90;
  const viewW = (game.viewport?.width ?? 1280) / 2 / game.camera.zoom;
  const viewH = (game.viewport?.height ?? 720) / 2 / game.camera.zoom;
  const tx = clamp(player.x + lookX, viewW, WORLD - viewW);
  const ty = clamp(player.y + lookY, viewH, WORLD - viewH);
  game.camera.x = lerp(game.camera.x, tx, 1 - Math.pow(0.001, dt));
  game.camera.y = lerp(game.camera.y, ty, 1 - Math.pow(0.001, dt));
  game.shake = Math.max(0, game.shake - dt * 26);

  processEvents(game, audio);
}

/** Daylight from the clock: 1 at noon, 0 in the small hours. */
export function daylight(game) {
  // 0.0 dawn, 0.25 noon, 0.5 dusk, 0.75 midnight.
  const t = game.timeOfDay;
  if (t < 0.25) return 0.55 + (t / 0.25) * 0.45;
  if (t < 0.5) return 1 - ((t - 0.25) / 0.25) * 0.55;
  if (t < 0.75) return 0.45 - ((t - 0.5) / 0.25) * 0.3;
  return 0.15 + ((t - 0.75) / 0.25) * 0.4;
}

export { STEP };
