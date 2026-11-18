// The player on foot and behind the wheel, and the cars they drive. A car is a
// simple arcade body: forward speed, steering that bites harder the faster the
// car goes, and a slide when it clips a building.
import { CAR, CAR_MODELS, PLAYER, WORLD } from './config.js';
import { clamp, distance } from './random.js';
import { hitsBuilding, resolveCircleCollisions } from './city.js';

let nextCarId = 1;

export function makeCar(modelId, x, y, angle, kind) {
  const model = CAR_MODELS.find((m) => m.id === modelId) ?? CAR_MODELS[0];
  return {
    id: nextCarId,
    model,
    color: model.colors[Math.floor(Math.random() * model.colors.length)],
    x, y, angle,
    speed: 0,
    health: CAR.maxHealth,
    kind,
    driver: null,
    siren: false,
    smoke: 0,
    stuckTimer: 0,
    brakeLight: false,
  };
}

export function createPlayer(x, y) {
  return {
    x, y,
    angle: -Math.PI / 2,
    health: PLAYER.maxHealth,
    cash: 0,
    ammo: PLAYER.startAmmo,
    onFoot: true,
    car: null,
    speed: 0,
    punchTimer: 0,
    shootTimer: 0,
    hurtTimer: 0,
    regenTimer: 0,
    bustedTimer: 0,
    bustCarTimer: 0,
    invulnerable: 0,
    aimAngle: -Math.PI / 2,
    moving: false,
  };
}

/** Move the player on foot: WASD, Shift to run, colliding with buildings. */
export function updateOnFoot(game, dt, input, audio) {
  const player = game.player;
  const move = input.move();
  const running = input.run();
  const speed = running ? PLAYER.runSpeed : PLAYER.walkSpeed;
  const len = Math.hypot(move.x, move.y);
  player.moving = len > 0;
  if (len > 0) {
    const nx = move.x / len;
    const ny = move.y / len;
    player.x += nx * speed * dt;
    player.y += ny * speed * dt;
    player.angle = Math.atan2(ny, nx);
    player.speed = speed;
  } else {
    player.speed = 0;
  }
  player.x = clamp(player.x, 20, WORLD - 20);
  player.y = clamp(player.y, 20, WORLD - 20);
  const resolved = resolveCircleCollisions(game.city, player.x, player.y, PLAYER.radius);
  player.x = resolved.x;
  player.y = resolved.y;
  if (player.punchTimer > 0) player.punchTimer -= dt;
  if (player.shootTimer > 0) player.shootTimer -= dt;
  if (player.hurtTimer > 0) player.hurtTimer -= dt;
  if (player.invulnerable > 0) player.invulnerable -= dt;
  player.regenTimer += dt;
  if (player.regenTimer > PLAYER.regenDelay && player.health < PLAYER.maxHealth) {
    player.health = Math.min(PLAYER.maxHealth, player.health + PLAYER.healthRegen * dt);
  }
}

/** Drive the player's car: W/S throttle and brake, A/D steer, with collision and damage. */
export function updateDriving(game, dt, input, audio) {
  const player = game.player;
  const car = player.car;
  if (!car) return;
  const move = input.move();
  const model = car.model;
  const forward = move.y < 0;
  const backward = move.y > 0;
  const steer = move.x;

  if (forward) {
    car.speed += model.accel * dt;
    if (car.speed < 0) car.speed += CAR.brake * dt;
  } else if (backward) {
    if (car.speed > 5) car.speed -= CAR.brake * dt;
    else car.speed -= model.accel * 0.6 * dt;
  } else {
    car.speed *= Math.pow(0.35, dt);
    if (Math.abs(car.speed) < 4) car.speed = 0;
  }
  car.speed = clamp(car.speed, -model.maxSpeed * 0.32, model.maxSpeed);
  car.brakeLight = backward && car.speed > 5;

  const speedNorm = Math.abs(car.speed) / model.maxSpeed;
  // Steering bites harder the faster the car goes, and reverses when reversing.
  car.angle += steer * model.turn * dt * clamp(Math.abs(car.speed) / 140, 0, 1) * (car.speed >= 0 ? 1 : -1);

  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const beforeX = car.x;
  const beforeY = car.y;
  car.x = clamp(nx, 20, WORLD - 20);
  car.y = clamp(ny, 20, WORLD - 20);
  if (hitsBuilding(game.city, car.x, car.y, CAR.length / 2)) {
    const impact = Math.abs(car.speed);
    car.x = beforeX;
    car.y = beforeY;
    if (impact > CAR.damageSpeed) {
      car.health -= (impact - CAR.damageSpeed) / 12;
      car.speed *= -0.25;
      game.events.push({ type: 'crash', x: car.x, y: car.y, hard: true });
      audio.crash();
      shake(game, Math.min(10, impact / 60));
    } else {
      car.speed *= 0.4;
      game.events.push({ type: 'crash', x: car.x, y: car.y, hard: false });
    }
  }
  if (car.health <= 40) car.smoke = Math.min(1, car.smoke + dt * 0.5);
  if (car.health <= 0) {
    explodeCar(game, car, audio);
    return;
  }
  player.x = car.x;
  player.y = car.y;
  player.angle = car.angle;
  player.speed = car.speed;
  audio.engineSet(Math.abs(car.speed) / model.maxSpeed);
}

export function explodeCar(game, car, audio) {
  car.health = 0;
  car.exploded = true;
  game.events.push({ type: 'explosion', x: car.x, y: car.y });
  audio.explosion();
  shake(game, 14);
  const player = game.player;
  if (player.car === car) {
    exitCar(game, audio);
    damagePlayer(game, 35, audio);
  }
  game.particles.push({
    kind: 'fireball', x: car.x, y: car.y, radius: 10, maxRadius: 90, life: 0.7, age: 0,
  });
  // Hurt anything close to the blast.
  for (const ped of game.peds) {
    if (distance(ped.x, ped.y, car.x, car.y) < 90) knockPed(game, ped, 60);
  }
  for (const cop of game.cops) {
    if (cop.onFoot && distance(cop.x, cop.y, car.x, car.y) < 90) {
      cop.down = true;
      cop.downTimer = 3;
    }
  }
}

export function shake(game, amount) {
  game.shake = Math.max(game.shake, amount);
}

/** Step into the nearest car within reach; returns the car or null. */
export function enterCar(game, audio) {
  const player = game.player;
  let best = null;
  let bestD = 70;
  for (const car of game.cars) {
    if (car.exploded || car.kind === 'police') continue;
    const d = distance(player.x, player.y, car.x, car.y);
    if (d < bestD) { best = car; bestD = d; }
  }
  if (!best) return null;
  if (best.kind === 'traffic' && best.driver) {
    // Yank the driver out: they flee, and someone may have seen it.
    const driver = best.driver;
    driver.state = 'flee';
    driver.fleeTimer = 4;
    best.driver = null;
    game.events.push({ type: 'carjack', x: best.x, y: best.y });
  }
  best.kind = 'player';
  player.car = best;
  player.onFoot = false;
  player.x = best.x;
  player.y = best.y;
  audio.engineStart();
  audio.click();
  return best;
}

export function exitCar(game, audio) {
  const player = game.player;
  const car = player.car;
  if (!car) return;
  player.car = null;
  player.onFoot = true;
  player.x = car.x + Math.cos(car.angle + Math.PI / 2) * 26;
  player.y = car.y + Math.sin(car.angle + Math.PI / 2) * 26;
  const resolved = resolveCircleCollisions(game.city, player.x, player.y, PLAYER.radius);
  player.x = resolved.x;
  player.y = resolved.y;
  audio.stopEngine();
}

export function damagePlayer(game, amount, audio) {
  const player = game.player;
  if (player.invulnerable > 0) return;
  player.health -= amount;
  player.hurtTimer = 0.4;
  player.regenTimer = 0;
  shake(game, 6);
  if (player.health <= 0) {
    player.health = 0;
    game.events.push({ type: 'wasted' });
  }
}

export function knockPed(game, ped, damage) {
  ped.health -= damage;
  ped.state = 'down';
  ped.downTimer = 2.5;
  ped.fleeTimer = 5;
}
