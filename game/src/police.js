// The wanted level and the Solmar City Police Department: cruisers that chase the
// player through the streets and officers who chase on foot and make the arrest.
import { CAR_MODELS, WANTED, WORLD } from './config.js';
import { clamp, distance, range } from './random.js';
import { hitsBuilding, randomRoadPoint, resolveCircleCollisions } from './city.js';
import { damagePlayer, makeCar, shake } from './player.js';

export function addWanted(game, stars, audio) {
  if (stars <= 0) return;
  const before = game.wanted;
  game.wanted = Math.min(WANTED.maxStars, game.wanted + stars);
  game.timeSinceCrime = 0;
  game.decayTimer = 0;
  if (game.wanted > 0 && before === 0) {
    game.toasts.push({ text: `Wanted level ${game.wanted} — the SCPD is on its way`, time: 4 });
    audio?.sirenOn();
  } else if (game.wanted > before) {
    game.toasts.push({ text: `Wanted level ${game.wanted}`, time: 3 });
  }
}

export function clearWanted(game, audio) {
  if (game.wanted > 0) {
    game.wanted = 0;
    game.toasts.push({ text: 'You lost the cops', time: 3 });
    audio?.sirenOff();
  }
  for (const cop of game.cops) cop.state = 'leave';
}

function spawnCopCar(game) {
  const player = game.player;
  let point = null;
  for (let tries = 0; tries < 14; tries += 1) {
    point = randomRoadPoint(game.rng);
    const d = distance(point.x, point.y, player.x, player.y);
    if (d > 420 && d < 900) break;
  }
  const car = makeCar('police', point.x, point.y, 0, 'police');
  car.speed = 200;
  car.siren = true;
  game.cars.push(car);
  game.cops.push({
    x: point.x, y: point.y,
    angle: 0, speed: 0,
    state: 'chase',
    car,
    onFoot: false,
    down: false,
    downTimer: 0,
    shootTimer: range(game.rng, 0.5, 1.5),
    arrestTimer: 0,
  });
}

function spawnFootCop(game) {
  const player = game.player;
  const angle = game.rng() * Math.PI * 2;
  const x = clamp(player.x + Math.cos(angle) * 520, 30, WORLD - 30);
  const y = clamp(player.y + Math.sin(angle) * 520, 30, WORLD - 30);
  game.cops.push({
    x, y,
    angle: 0, speed: 0,
    state: 'chase',
    car: null,
    onFoot: true,
    down: false,
    downTimer: 0,
    shootTimer: range(game.rng, 0.5, 1.5),
    arrestTimer: 0,
  });
}

function steerToward(car, tx, ty, dt, maxTurn) {
  const want = Math.atan2(ty - car.y, tx - car.x);
  let d = want - car.angle;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  car.angle += clamp(d, -maxTurn * dt, maxTurn * dt);
}

export function updatePolice(game, dt, audio) {
  const player = game.player;
  game.timeSinceCrime += dt;

  // Wanted decay: out of sight and quiet for a while, stars fall off one by one.
  if (game.wanted > 0) {
    let nearest = Infinity;
    for (const cop of game.cops) {
      nearest = Math.min(nearest, distance(cop.x, cop.y, player.x, player.y));
    }
    if (nearest > 450 && game.timeSinceCrime > WANTED.decayDelay) {
      game.decayTimer += dt;
      if (game.decayTimer >= WANTED.decayInterval) {
        game.decayTimer = 0;
        game.wanted -= 1;
        if (game.wanted === 0) {
          game.toasts.push({ text: 'You lost the cops', time: 3 });
          audio?.sirenOff();
          for (const cop of game.cops) cop.state = 'leave';
        } else {
          game.toasts.push({ text: `Wanted level ${game.wanted}`, time: 2 });
        }
      }
    } else {
      game.decayTimer = 0;
    }
  }

  // Reinforcements arrive until the street holds enough units for the stars.
  const wantCars = game.wanted >= 1 ? Math.min(3, game.wanted) : 0;
  const wantFoot = game.wanted >= 2 ? Math.min(3, game.wanted - 1) : 0;
  let cars = 0;
  let foot = 0;
  for (const cop of game.cops) {
    if (cop.state === 'leave' || cop.down) continue;
    if (cop.car) cars += 1;
    else foot += 1;
  }
  game.spawnTimer -= dt;
  if (game.wanted > 0 && game.spawnTimer <= 0) {
    if (cars < wantCars) { spawnCopCar(game); game.spawnTimer = 1.2; }
    else if (foot < wantFoot) { spawnFootCop(game); game.spawnTimer = 1.2; }
  }

  // Each unit chases, rams, shoots, or walks away when the heat is off.
  for (const cop of game.cops) {
    if (cop.down) {
      cop.downTimer -= dt;
      if (cop.downTimer <= 0) cop.down = false;
      continue;
    }
    if (cop.state === 'leave') {
      // Drive or walk away, then despawn far from the player.
      if (cop.car) {
        cop.car.speed = Math.max(0, cop.car.speed - 300 * dt);
        cop.car.x += Math.cos(cop.car.angle) * cop.car.speed * dt;
        cop.car.y += Math.sin(cop.car.angle) * cop.car.speed * dt;
        cop.x = cop.car.x;
        cop.y = cop.car.y;
      } else {
        cop.x += Math.cos(cop.angle) * 120 * dt;
        cop.y += Math.sin(cop.angle) * 120 * dt;
      }
      if (distance(cop.x, cop.y, player.x, player.y) > 1000) cop.gone = true;
      continue;
    }
    if (cop.car) {
      const car = cop.car;
      if (car.exploded) {
        cop.car = null;
        cop.onFoot = true;
        cop.x = player.x + 60;
        cop.y = player.y + 60;
        continue;
      }
      // Pursuit: steer at the player, faster with more stars.
      const targetSpeed = Math.min(WANTED.copCarSpeed, 380 + game.wanted * 45);
      car.speed += clamp(targetSpeed - car.speed, -600 * dt, 420 * dt);
      steerToward(car, player.x, player.y, dt, 2.4);
      const nx = car.x + Math.cos(car.angle) * car.speed * dt;
      const ny = car.y + Math.sin(car.angle) * car.speed * dt;
      const beforeX = car.x;
      const beforeY = car.y;
      car.x = clamp(nx, 20, WORLD - 20);
      car.y = clamp(ny, 20, WORLD - 20);
      if (hitsBuilding(game.city, car.x, car.y, 23)) {
        car.x = beforeX;
        car.y = beforeY;
        car.speed *= 0.5;
        car.angle += (game.rng() - 0.5) * 0.9;
      }
      cop.x = car.x;
      cop.y = car.y;
      cop.angle = car.angle;
      // Ram the player's car.
      if (player.car) {
        const d = distance(car.x, car.y, player.car.x, player.car.y);
        if (d < 52) {
          player.car.health -= 6 * dt;
          player.car.speed *= (1 - 0.6 * dt);
          car.speed *= 0.92;
          if (game.rng() < dt * 2) {
            game.events.push({ type: 'crash', x: car.x, y: car.y, hard: false });
            audio?.crash();
          }
          // Busted if the player is pinned and a cruiser sits on them.
          if (Math.abs(player.car.speed) < 25) {
            player.bustCarTimer += dt;
            if (player.bustCarTimer > WANTED.bustCarSeconds) game.events.push({ type: 'busted' });
          } else {
            player.bustCarTimer = 0;
          }
        } else {
          player.bustCarTimer = 0;
        }
      }
      // Close enough and the player is on foot: the officer gets out.
      if (player.onFoot && distance(car.x, car.y, player.x, player.y) < 90) {
        cop.car = null;
        cop.onFoot = true;
        cop.x = car.x;
        cop.y = car.y;
        game.cars = game.cars.filter((c) => c !== car);
      }
    } else {
      // On foot: run at the player, shoot when the heat is high.
      const d = distance(cop.x, cop.y, player.x, player.y);
      const want = Math.atan2(player.y - cop.y, player.x - cop.x);
      cop.angle = want;
      const speed = player.onFoot ? 235 : 200;
      cop.x += Math.cos(want) * speed * dt;
      cop.y += Math.sin(want) * speed * dt;
      const resolved = resolveCircleCollisions(game.city, cop.x, cop.y, 13);
      cop.x = resolved.x;
      cop.y = resolved.y;
      cop.shootTimer -= dt;
      if (game.wanted >= 2 && d < 380 && cop.shootTimer <= 0) {
        cop.shootTimer = range(game.rng, 0.9, 1.8);
        game.bullets.push({
          x: cop.x, y: cop.y,
          angle: want + range(game.rng, -0.08, 0.08),
          speed: 620, life: 0.9, from: 'cop', damage: 8,
        });
        audio?.gunshot();
      }
      if (player.onFoot && d < 26) {
        player.bustedTimer += dt;
        if (player.bustedTimer > WANTED.bustTouchSeconds) game.events.push({ type: 'busted' });
      } else {
        player.bustedTimer = Math.max(0, player.bustedTimer - dt * 2);
      }
    }
  }
  game.cops = game.cops.filter((c) => !c.gone);
  // A cop car the player stole or wrecked leaves its officer on foot.
  for (const car of game.cars) {
    if (car.kind === 'player' && car.model.id === 'police') {
      for (const cop of game.cops) {
        if (cop.car === car) {
          cop.car = null;
          cop.onFoot = true;
        }
      }
    }
  }
}
