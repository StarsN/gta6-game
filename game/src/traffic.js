// Traffic and pedestrians: the city alive around the player. Traffic cars run the
// road grid on right-hand lanes and brake for the car ahead; pedestrians walk the
// sidewalks and run from gunfire, explosions and speeding cars.
import { LANE, PED, ROADS, TRAFFIC, WORLD } from './config.js';
import { clamp, distance, pick, range, rangeInt } from './random.js';
import { hitsBuilding, randomRoadPoint, randomSidewalkPoint, resolveCircleCollisions } from './city.js';
import { makeCar } from './player.js';

const PED_COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22', '#ecf0f1', '#34495e', '#fd79a8'];
const TRAFFIC_MODELS = ['sedan', 'sedan', 'coupe', 'van', 'truck', 'taxi', 'sport'];

function laneOffset(axis, dir) {
  // Right-hand traffic: the lane sits on the right of the direction of travel.
  if (axis === 'x') return dir > 0 ? LANE : -LANE;
  return dir > 0 ? -LANE : LANE;
}

export function spawnParkedCars(game) {
  const random = game.rng;
  const spots = [];
  for (let i = 0; i < 26; i += 1) {
    const p = randomSidewalkPoint(random);
    // Parked cars sit just off the road edge, facing along it.
    const vertical = Math.abs(p.x - 200) < 60 || ROADS.some((r) => Math.abs(p.x - r) < 60);
    const angle = vertical ? (random() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (random() < 0.5 ? 0 : Math.PI);
    const model = pick(random, TRAFFIC_MODELS);
    const car = makeCar(model, p.x, p.y, angle, 'parked');
    if (!hitsBuilding(game.city, car.x, car.y, 30)) spots.push(car);
  }
  game.cars.push(...spots);
}

export function spawnTrafficCar(game, nearPlayer) {
  const random = game.rng;
  let point;
  if (nearPlayer) {
    // Somewhere on a road 500-900 px from the player, so the streets stay busy.
    for (let tries = 0; tries < 12; tries += 1) {
      point = randomRoadPoint(random);
      if (distance(point.x, point.y, game.player.x, game.player.y) > 450) break;
    }
  } else {
    point = randomRoadPoint(random);
  }
  const vertical = ROADS.some((r) => Math.abs(point.x - r) < 30);
  const model = pick(random, TRAFFIC_MODELS);
  const car = makeCar(model, point.x, point.y, 0, 'traffic');
  if (vertical) {
    car.axis = 'y';
    car.road = ROADS.reduce((a, b) => (Math.abs(b - point.x) < Math.abs(a - point.x) ? b : a));
    car.s = point.y;
    car.dir = point.y < WORLD / 2 ? 1 : -1;
    car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  } else {
    car.axis = 'x';
    car.road = ROADS.reduce((a, b) => (Math.abs(b - point.y) < Math.abs(a - point.y) ? b : a));
    car.s = point.x;
    car.dir = point.x < WORLD / 2 ? 1 : -1;
    car.angle = car.dir > 0 ? 0 : Math.PI;
  }
  car.targetSpeed = TRAFFIC.cruiseSpeed * range(random, 0.8, 1.1);
  car.speed = car.targetSpeed;
  game.cars.push(car);
  return car;
}

function carAheadInLane(game, car, lookAhead) {
  let best = null;
  let bestGap = Infinity;
  for (const other of game.cars) {
    if (other === car || other.exploded) continue;
    if (other.axis !== car.axis || other.road !== car.road || other.dir !== car.dir) continue;
    const gap = (other.s - car.s) * car.dir;
    if (gap > 8 && gap < lookAhead && gap < bestGap) { best = other; bestGap = gap; }
  }
  return best;
}

export function updateTraffic(game, dt) {
  const player = game.player;
  for (const car of game.cars) {
    if (car.kind !== 'traffic' || car.exploded) continue;
    // Brake for the car ahead in the same lane.
    const ahead = carAheadInLane(game, car, 80);
    let target = car.targetSpeed;
    if (ahead) target = Math.min(target, Math.max(0, ahead.speed - 30));
    // Brake for the player's car blocking the lane.
    if (player.car && player.car !== car) {
      const pc = player.car;
      if (pc.axis === undefined) {
        // The player's car has no lane state: brake by proximity on the same road.
        const along = car.axis === 'x' ? pc.x - car.s : pc.y - car.s;
        const across = car.axis === 'x' ? Math.abs(pc.y - car.road) : Math.abs(pc.x - car.road);
        if (across < 40 && along * car.dir > 0 && along * car.dir < 90) target = 0;
      }
    }
    car.speed += clamp(target - car.speed, -500 * dt, 220 * dt);
    car.s += car.dir * car.speed * dt;

    // At an intersection, mostly go straight, sometimes turn.
    const nextRoad = ROADS.find((r) => (r - car.s) * car.dir > 0 && Math.abs(r - car.s) < Math.max(30, car.speed * dt + 4));
    if (nextRoad !== undefined) {
      const turn = game.rng();
      if (turn < 0.28) {
        const newDir = game.rng() < 0.5 ? 1 : -1;
        if (car.axis === 'x') {
          car.axis = 'y';
          car.road = nextRoad;
          car.s = car.y;
          car.dir = newDir;
        } else {
          car.axis = 'x';
          car.road = nextRoad;
          car.s = car.x;
          car.dir = newDir;
        }
        car.speed *= 0.55;
      }
    }
    // Wrap around the far edge or respawn near the player when too far away.
    if (car.s < -80 || car.s > WORLD + 80) {
      car.s = car.dir > 0 ? -40 : WORLD + 40;
    }
    if (car.axis === 'x') {
      car.x = car.s;
      car.y = car.road + laneOffset('x', car.dir);
      car.angle = car.dir > 0 ? 0 : Math.PI;
    } else {
      car.x = car.road + laneOffset('y', car.dir);
      car.y = car.s;
      car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    }
  }
  // Keep the streets busy near the player.
  let count = 0;
  for (const car of game.cars) if (car.kind === 'traffic' && !car.exploded) count += 1;
  if (count < TRAFFIC.count) spawnTrafficCar(game, true);
}

export function spawnPed(game, x, y) {
  const random = game.rng;
  return {
    x, y,
    angle: range(random, 0, Math.PI * 2),
    speed: 0,
    state: 'walk',
    walkTimer: range(random, 2, 6),
    fleeTimer: 0,
    downTimer: 0,
    health: 40,
    color: pick(random, PED_COLORS),
    axis: random() < 0.5 ? 'x' : 'y',
    road: ROADS[rangeInt(random, 0, ROADS.length - 1)],
    dir: random() < 0.5 ? 1 : -1,
    offset: (random() < 0.5 ? -1 : 1) * 48,
  };
}

export function spawnPeds(game) {
  for (let i = 0; i < PED.count; i += 1) {
    const p = randomSidewalkPoint(game.rng);
    game.peds.push(spawnPed(game, p.x, p.y));
  }
}

function pedNearThreat(game, ped) {
  for (const b of game.bullets) {
    if (distance(ped.x, ped.y, b.x, b.y) < 220) return { x: b.x, y: b.y };
  }
  for (const part of game.particles) {
    if (part.kind === 'fireball' && distance(ped.x, ped.y, part.x, part.y) < 240) return { x: part.x, y: part.y };
  }
  if (game.player.car && Math.abs(game.player.car.speed) > 300 && distance(ped.x, ped.y, game.player.x, game.player.y) < 130) {
    return { x: game.player.x, y: game.player.y };
  }
  return null;
}

export function updatePeds(game, dt) {
  for (const ped of game.peds) {
    if (ped.state === 'down') {
      ped.downTimer -= dt;
      if (ped.downTimer <= 0) {
        ped.state = 'flee';
        ped.fleeTimer = 4;
      }
      continue;
    }
    const threat = pedNearThreat(game, ped);
    if (threat && ped.state !== 'flee') {
      ped.state = 'flee';
      ped.fleeTimer = 3;
      ped.fleeFrom = threat;
    }
    if (ped.state === 'flee') {
      ped.fleeTimer -= dt;
      const away = Math.atan2(ped.y - (ped.fleeFrom?.y ?? ped.y), ped.x - (ped.fleeFrom?.x ?? ped.x));
      ped.angle = away;
      ped.speed = PED.fleeSpeed;
      ped.x += Math.cos(away) * ped.speed * dt;
      ped.y += Math.sin(away) * ped.speed * dt;
      if (ped.fleeTimer <= 0) ped.state = 'walk';
    } else {
      ped.walkTimer -= dt;
      ped.speed = PED.walkSpeed;
      if (ped.walkTimer <= 0) {
        ped.walkTimer = range(game.rng, 2, 7);
        // At an intersection, sometimes turn onto the crossing road.
        if (game.rng() < 0.45) {
          ped.axis = ped.axis === 'x' ? 'y' : 'x';
          ped.road = ped.axis === 'x' ? ped.y : ped.x;
          ped.road = ROADS.reduce((a, b) => (Math.abs(b - ped.road) < Math.abs(a - ped.road) ? b : a));
          ped.dir = game.rng() < 0.5 ? 1 : -1;
          ped.offset = (game.rng() < 0.5 ? -1 : 1) * 48;
        } else {
          ped.dir *= game.rng() < 0.3 ? -1 : 1;
        }
      }
      if (ped.axis === 'x') {
        ped.x += ped.dir * ped.speed * dt;
        ped.y = ped.road + ped.offset;
        ped.angle = ped.dir > 0 ? 0 : Math.PI;
        if (ped.x < 40 || ped.x > WORLD - 40) ped.dir *= -1;
      } else {
        ped.y += ped.dir * ped.speed * dt;
        ped.x = ped.road + ped.offset;
        ped.angle = ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        if (ped.y < 40 || ped.y > WORLD - 40) ped.dir *= -1;
      }
    }
    ped.x = clamp(ped.x, 20, WORLD - 20);
    ped.y = clamp(ped.y, 20, WORLD - 20);
    const resolved = resolveCircleCollisions(game.city, ped.x, ped.y, 12);
    ped.x = resolved.x;
    ped.y = resolved.y;
  }
  // Replace peds that wandered far from the player with fresh ones nearby.
  let far = 0;
  for (const ped of game.peds) {
    if (distance(ped.x, ped.y, game.player.x, game.player.y) > 1100) far += 1;
  }
  if (far > 8) {
    game.peds = game.peds.filter((p) => distance(p.x, p.y, game.player.x, game.player.y) <= 1100);
    let tries = 0;
    while (game.peds.length < PED.count && tries < 60) {
      tries += 1;
      const p = randomSidewalkPoint(game.rng);
      if (distance(p.x, p.y, game.player.x, game.player.y) < 900) game.peds.push(spawnPed(game, p.x, p.y));
    }
  }
}
