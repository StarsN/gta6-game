// Combat on foot and the debris it leaves: punches, pistol fire, bullets, and
// the particles and pickups scattered around the city.
import { PLAYER, WORLD } from './config.js';
import { clamp, distance, range } from './random.js';
import { approachPoint } from './city.js';
import { damagePlayer, knockPed, shake } from './player.js';
import { addWanted } from './police.js';

export function spawnParticles(game, x, y, count, color, speed, life) {
  for (let i = 0; i < count; i += 1) {
    const a = game.rng() * Math.PI * 2;
    game.particles.push({
      kind: 'spark', x, y,
      vx: Math.cos(a) * speed * range(game.rng, 0.3, 1),
      vy: Math.sin(a) * speed * range(game.rng, 0.3, 1),
      color, life: life * range(game.rng, 0.6, 1.2), age: 0, size: range(game.rng, 2, 4.5),
    });
  }
}

/** The player's punch: a short arc in front that knocks a ped or an officer down. */
export function tryPunch(game, audio) {
  const player = game.player;
  if (player.punchTimer > 0 || !player.onFoot) return;
  player.punchTimer = PLAYER.punchCooldown;
  audio.punch();
  const px = player.x + Math.cos(player.angle) * PLAYER.punchRange * 0.7;
  const py = player.y + Math.sin(player.angle) * PLAYER.punchRange * 0.7;
  let hit = false;
  for (const ped of game.peds) {
    if (ped.state === 'down') continue;
    if (distance(ped.x, ped.y, px, py) < PLAYER.punchRange) {
      knockPed(game, ped, PLAYER.punchDamage);
      spawnParticles(game, ped.x, ped.y, 8, '#f39c12', 160, 0.4);
      hit = true;
    }
  }
  for (const cop of game.cops) {
    if (!cop.onFoot || cop.down) continue;
    if (distance(cop.x, cop.y, px, py) < PLAYER.punchRange) {
      cop.down = true;
      cop.downTimer = 3;
      spawnParticles(game, cop.x, cop.y, 8, '#3498db', 160, 0.4);
      hit = true;
      addWanted(game, 1, audio);
    }
  }
  if (hit) {
    shake(game, 3);
    // Bystanders who saw it call it in.
    let witness = false;
    for (const ped of game.peds) {
      if (ped.state !== 'down' && distance(ped.x, ped.y, player.x, player.y) < 260) witness = true;
    }
    for (const cop of game.cops) {
      if (distance(cop.x, cop.y, player.x, player.y) < 500) witness = true;
    }
    if (witness) addWanted(game, 1, audio);
  }
}

/** Fire the pistol toward the mouse; witnesses raise the wanted level. */
export function tryShoot(game, audio) {
  const player = game.player;
  if (player.shootTimer > 0 || !player.onFoot || player.ammo <= 0) return;
  player.shootTimer = PLAYER.pistolCooldown;
  player.ammo -= 1;
  audio.gunshot();
  shake(game, 2);
  const mx = player.x + Math.cos(player.aimAngle) * 26;
  const my = player.y + Math.sin(player.aimAngle) * 26;
  game.bullets.push({
    x: mx, y: my,
    angle: player.aimAngle,
    speed: 780, life: PLAYER.pistolRange / 780, from: 'player', damage: PLAYER.pistolDamage,
  });
  spawnParticles(game, mx, my, 4, '#f7dc6f', 120, 0.2);
  let witness = false;
  for (const ped of game.peds) {
    if (ped.state !== 'down' && distance(ped.x, ped.y, player.x, player.y) < 320) witness = true;
  }
  for (const cop of game.cops) {
    if (distance(cop.x, cop.y, player.x, player.y) < 520) witness = true;
  }
  if (witness) addWanted(game, 1, audio);
}

export function updateBullets(game, dt, audio) {
  for (const b of game.bullets) {
    b.x += Math.cos(b.angle) * b.speed * dt;
    b.y += Math.sin(b.angle) * b.speed * dt;
    b.life -= dt;
    if (b.x < 0 || b.x > WORLD || b.y < 0 || b.y > WORLD) b.life = 0;
    // Buildings stop bullets.
    if (game.city.colliders.some((r) => b.x > r.x && b.x < r.x + r.w && b.y > r.y && b.y < r.y + r.h)) {
      b.life = 0;
      spawnParticles(game, b.x, b.y, 5, '#b0b7bd', 120, 0.3);
      continue;
    }
    if (b.from === 'player') {
      for (const ped of game.peds) {
        if (ped.state === 'down') continue;
        if (distance(ped.x, ped.y, b.x, b.y) < 14) {
          knockPed(game, ped, b.damage);
          spawnParticles(game, ped.x, ped.y, 10, '#e74c3c', 180, 0.4);
          b.life = 0;
          break;
        }
      }
      if (b.life > 0) {
        for (const cop of game.cops) {
          if (!cop.onFoot || cop.down) continue;
          if (distance(cop.x, cop.y, b.x, b.y) < 14) {
            cop.down = true;
            cop.downTimer = 3.5;
            spawnParticles(game, cop.x, cop.y, 10, '#3498db', 180, 0.4);
            addWanted(game, 1, audio);
            b.life = 0;
            break;
          }
        }
      }
      if (b.life > 0) {
        for (const car of game.cars) {
          if (car.exploded || car === game.player.car) continue;
          if (distance(car.x, car.y, b.x, b.y) < 26) {
            car.health -= b.damage;
            spawnParticles(game, b.x, b.y, 6, '#f39c12', 140, 0.3);
            if (car.health <= 0 && car.kind === 'traffic') {
              game.events.push({ type: 'explosion', x: car.x, y: car.y });
              car.exploded = true;
            }
            b.life = 0;
            break;
          }
        }
      }
    } else {
      const player = game.player;
      if (player.onFoot && distance(player.x, player.y, b.x, b.y) < 14) {
        damagePlayer(game, b.damage, audio);
        spawnParticles(game, player.x, player.y, 8, '#e74c3c', 160, 0.4);
        b.life = 0;
      } else if (player.car && distance(player.car.x, player.car.y, b.x, b.y) < 26) {
        player.car.health -= b.damage * 0.5;
        spawnParticles(game, b.x, b.y, 5, '#f39c12', 120, 0.3);
        b.life = 0;
      }
    }
  }
  game.bullets = game.bullets.filter((b) => b.life > 0);
}

export function updateParticles(game, dt) {
  for (const p of game.particles) {
    p.age += dt;
    if (p.kind === 'spark') {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= (1 - 2 * dt);
      p.vy *= (1 - 2 * dt);
    } else if (p.kind === 'fireball') {
      p.radius = p.maxRadius * Math.min(1, p.age / p.life);
    } else if (p.kind === 'smoke') {
      p.y -= 30 * dt;
      p.radius += 14 * dt;
    }
  }
  game.particles = game.particles.filter((p) => p.age < p.life);
}

/** Pickups: hidden cash packages, health snacks and ammo boxes around the city. */
export function spawnPickups(game) {
  const random = game.rng;
  for (let i = 0; i < 10; i += 1) {
    const p = { x: 0, y: 0 };
    for (let tries = 0; tries < 20; tries += 1) {
      p.x = range(random, 120, WORLD - 120);
      p.y = range(random, 120, WORLD - 120);
      if (!game.city.colliders.some((r) => p.x > r.x - 10 && p.x < r.x + r.w + 10 && p.y > r.y - 10 && p.y < r.y + r.h + 10)) break;
    }
    game.pickups.push({ kind: 'package', x: p.x, y: p.y, taken: false, bob: random() * Math.PI * 2 });
  }
  const hospital = approachPoint(game.city.places.hospital);
  const plaza = approachPoint(game.city.places.plaza);
  const docks = approachPoint(game.city.places.docks);
  const police = approachPoint(game.city.places.police);
  const spots = [
    { kind: 'health', x: hospital.x + 60, y: hospital.y },
    { kind: 'health', x: plaza.x, y: plaza.y + 60 },
    { kind: 'ammo', x: docks.x - 80, y: docks.y },
    { kind: 'ammo', x: police.x + 70, y: police.y },
  ];
  for (const s of spots) game.pickups.push({ ...s, taken: false, bob: 0 });
}

export function updatePickups(game, dt, audio) {
  const player = game.player;
  for (const p of game.pickups) {
    if (p.taken) continue;
    p.bob += dt * 3;
    const reach = player.onFoot ? 34 : 44;
    if (distance(p.x, p.y, player.x, player.y) < reach) {
      p.taken = true;
      if (p.kind === 'package') {
        player.cash += 50;
        game.stats.earned += 50;
        game.stats.packages += 1;
        audio.cash();
        game.toasts.push({ text: `Hidden package found — $50 (${game.stats.packages}/10)`, time: 3 });
        if (game.stats.packages >= 10) {
          player.cash += 500;
          game.stats.earned += 500;
          game.toasts.push({ text: 'All 10 packages — $500 bonus!', time: 4 });
        }
      } else if (p.kind === 'health') {
        player.health = 100;
        audio.pickup();
        game.toasts.push({ text: 'Health restored', time: 2 });
        p.respawn = 45;
      } else if (p.kind === 'ammo') {
        player.ammo = Math.min(240, player.ammo + 60);
        audio.pickup();
        game.toasts.push({ text: 'Ammo +60', time: 2 });
        p.respawn = 45;
      }
    }
  }
  // Health and ammo boxes come back after a while.
  for (const p of game.pickups) {
    if (p.taken && p.respawn !== undefined) {
      p.respawn -= dt;
      if (p.respawn <= 0) { p.taken = false; p.respawn = undefined; }
    }
  }
}
