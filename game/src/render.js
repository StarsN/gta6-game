// Drawing only: the world state in, pixels out. The static city is one
// pre-rendered layer; everything that moves is drawn on top, sorted by height,
// then the night tint. No game rules live here.
import { PALETTE, WORLD } from './config.js';
import { daylight } from './world.js';
import { currentStep, stepPosition } from './missions.js';

/** How long the muzzle flash shows after a shot. */
const PLAYER_FLASH = 0.12;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCarShape(ctx, car, time, isPlayer) {
  const model = car.model;
  const len = model.length;
  const wid = model.width;
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  roundRect(ctx, -len / 2 + 3, -wid / 2 + 4, len, wid, 7);
  ctx.fill();
  // The player's own car carries a white outline, so it reads at a glance.
  if (isPlayer) {
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 2.5;
    roundRect(ctx, -len / 2 - 2, -wid / 2 - 2, len + 4, wid + 4, 8);
    ctx.stroke();
  }
  // Wheels.
  ctx.fillStyle = '#141414';
  const wheelW = 9;
  const wheelH = 5;
  ctx.fillRect(-len / 2 + 6, -wid / 2 - 2, wheelW, wheelH);
  ctx.fillRect(len / 2 - 15, -wid / 2 - 2, wheelW, wheelH);
  ctx.fillRect(-len / 2 + 6, wid / 2 - 3, wheelW, wheelH);
  ctx.fillRect(len / 2 - 15, wid / 2 - 3, wheelW, wheelH);
  // Body.
  ctx.fillStyle = car.color;
  roundRect(ctx, -len / 2, -wid / 2, len, wid, 7);
  ctx.fill();
  // Hood and trunk shading.
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(len / 2 - 10, -wid / 2 + 2, 8, wid - 4);
  // Windshield and rear window.
  ctx.fillStyle = '#1b2a3a';
  ctx.fillRect(-4, -wid / 2 + 3, 9, wid - 6);
  ctx.fillRect(-len / 2 + 8, -wid / 2 + 3, 6, wid - 6);
  // Roof.
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  roundRect(ctx, -len / 2 + 16, -wid / 2 + 4, len / 2 - 6, wid - 8, 4);
  ctx.fill();
  // Headlights and tail lights.
  ctx.fillStyle = '#ffe9a8';
  ctx.fillRect(len / 2 - 2, -wid / 2 + 3, 3, 5);
  ctx.fillRect(len / 2 - 2, wid / 2 - 8, 3, 5);
  ctx.fillStyle = '#e74c3c';
  ctx.fillRect(-len / 2 - 1, -wid / 2 + 3, 3, 5);
  ctx.fillRect(-len / 2 - 1, wid / 2 - 8, 3, 5);
  if (car.brakeLight) {
    ctx.fillStyle = '#ff2d20';
    ctx.fillRect(-len / 2 - 3, -wid / 2 + 2, 4, 7);
    ctx.fillRect(-len / 2 - 3, wid / 2 - 9, 4, 7);
  }
  // Police livery and light bar.
  if (model.id === 'police') {
    ctx.fillStyle = '#f4f6f7';
    ctx.fillRect(-6, -wid / 2 + 2, 14, wid - 4);
    ctx.fillStyle = '#1a1a2e';
    ctx.font = 'bold 8px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SCPD', 1, 3);
    const flash = Math.floor(time * 4) % 2 === 0;
    ctx.fillStyle = flash ? '#ff2d20' : '#2e86ff';
    ctx.fillRect(-2, -wid / 2 - 4, 5, 6);
    ctx.fillStyle = flash ? '#2e86ff' : '#ff2d20';
    ctx.fillRect(-2, wid / 2 - 2, 5, 6);
  }
  if (model.id === 'taxi') {
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(-8, -wid / 2 + 1, 16, 4);
    ctx.fillRect(-8, wid / 2 - 5, 16, 4);
    ctx.fillStyle = '#f7dc6f';
    ctx.fillRect(-4, -5, 8, 10);
    ctx.fillStyle = '#1a1a1a';
    ctx.font = 'bold 7px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TAXI', 0, 2);
  }
  ctx.restore();
}

function drawPerson(ctx, x, y, angle, shirt, down, isPlayer, time) {
  ctx.save();
  ctx.translate(x, y);
  if (down) {
    ctx.rotate(angle + Math.PI / 2);
    ctx.fillStyle = shirt;
    roundRect(ctx, -9, -5, 18, 10, 4);
    ctx.fill();
    ctx.fillStyle = '#e8b98a';
    ctx.beginPath();
    ctx.arc(11, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  ctx.rotate(angle);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(2, 3, 11, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  // Body.
  ctx.fillStyle = shirt;
  roundRect(ctx, -8, -7, 16, 14, 6);
  ctx.fill();
  // Head.
  ctx.fillStyle = '#e8b98a';
  ctx.beginPath();
  ctx.arc(4, 0, 5.5, 0, Math.PI * 2);
  ctx.fill();
  // Cap for the player, badge for a cop.
  if (isPlayer) {
    ctx.fillStyle = '#c0392b';
    ctx.beginPath();
    ctx.arc(4, 0, 5.5, Math.PI, Math.PI * 2);
    ctx.fill();
  }
  // Facing tick.
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(8, 0);
  ctx.lineTo(13, 0);
  ctx.stroke();
  // The player carries a white ring, so they read at a glance.
  if (isPlayer) {
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 15, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPickup(ctx, pickup, time) {
  const bob = Math.sin(pickup.bob) * 2;
  ctx.save();
  ctx.translate(pickup.x, pickup.y + bob);
  if (pickup.kind === 'package') {
    ctx.fillStyle = '#f7dc6f';
    ctx.strokeStyle = '#7d6608';
    ctx.lineWidth = 2;
    roundRect(ctx, -9, -9, 18, 18, 3);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#7d6608';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('$', 0, 4);
  } else if (pickup.kind === 'health') {
    ctx.fillStyle = '#f4f6f7';
    ctx.strokeStyle = '#922b21';
    ctx.lineWidth = 2;
    roundRect(ctx, -10, -10, 20, 20, 3);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(-2.5, -7, 5, 14);
    ctx.fillRect(-7, -2.5, 14, 5);
  } else {
    ctx.fillStyle = '#2ecc71';
    ctx.strokeStyle = '#1e8449';
    ctx.lineWidth = 2;
    roundRect(ctx, -10, -7, 20, 14, 3);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 9px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('AMMO', 0, 3);
  }
  ctx.restore();
}

function drawMarker(ctx, x, y, time, color, label) {
  const pulse = 1 + Math.sin(time * 4) * 0.12;
  ctx.save();
  ctx.translate(x, y);
  // Beam.
  const grad = ctx.createLinearGradient(0, -90, 0, 0);
  grad.addColorStop(0, 'rgba(247,220,111,0)');
  grad.addColorStop(1, 'rgba(247,220,111,0.35)');
  ctx.fillStyle = grad;
  ctx.fillRect(-7, -90, 14, 90);
  // Diamond.
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = color;
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 2;
  const s = 13 * pulse;
  ctx.fillRect(-s / 2, -s / 2, s, s);
  ctx.strokeRect(-s / 2, -s / 2, s, s);
  ctx.restore();
  if (label) {
    ctx.save();
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(12,16,24,0.75)';
    const w = ctx.measureText(label).width + 16;
    roundRect(ctx, x - w / 2, y - 118, w, 22, 6);
    ctx.fill();
    ctx.fillStyle = '#f7dc6f';
    ctx.fillText(label, x, y - 103);
    ctx.restore();
  }
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let width = 0;
  let height = 0;
  let dpr = 1;

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
  }
  resize();
  window.addEventListener('resize', resize);

  function drawWorld(game) {
    const time = game.time;
    const light = daylight(game);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#0b0e13';
    ctx.fillRect(0, 0, width, height);

    const cam = game.camera;
    const shakeX = game.shake > 0 ? (Math.random() - 0.5) * game.shake : 0;
    const shakeY = game.shake > 0 ? (Math.random() - 0.5) * game.shake : 0;
    const zoom = cam.zoom;
    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-cam.x + shakeX, -cam.y + shakeY);

    // Static city, and its lit windows after dark.
    const view = {
      x: cam.x - width / 2 / zoom - 60,
      y: cam.y - height / 2 / zoom - 60,
      w: width / zoom + 120,
      h: height / zoom + 120,
    };
    ctx.drawImage(game.city.dayLayer, view.x, view.y, view.w, view.h, view.x, view.y, view.w, view.h);
    if (light < 0.75) {
      ctx.globalAlpha = (0.75 - light) * 1.6;
      ctx.drawImage(game.city.nightLayer, view.x, view.y, view.w, view.h, view.x, view.y, view.w, view.h);
      ctx.globalAlpha = 1;
    }

    // Mission marker, fare markers and the respray shop ring.
    const step = currentStep(game);
    if (step && (step.type === 'reach' || step.type === 'deliver' || step.type === 'collect' || step.type === 'timed')) {
      const pos = stepPosition(game, step);
      drawMarker(ctx, pos.x, pos.y, time, '#f7dc6f', step.label);
    }
    if (game.missions.fare) {
      const fare = game.missions.fare;
      if (!fare.onboard) drawMarker(ctx, fare.pickup.x, fare.pickup.y, time, '#2ecc71', 'FARE');
      else drawMarker(ctx, fare.dest.x, fare.dest.y, time, '#2ecc71', 'DROP-OFF');
    }
    if (game.wanted > 0) {
      const shop = game.city.places.respray;
      ctx.save();
      ctx.strokeStyle = '#2ecc71';
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 8]);
      ctx.beginPath();
      ctx.arc(shop.x, shop.y, 60 + Math.sin(time * 3) * 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // Pickups.
    for (const pickup of game.pickups) {
      if (!pickup.taken) drawPickup(ctx, pickup, time);
    }

    // Everything that moves, sorted by height so nearer things overlap.
    const drawables = [];
    for (const car of game.cars) {
      if (!car.exploded) drawables.push({ y: car.y, draw: () => drawCarShape(ctx, car, time, car === game.player.car) });
    }
    for (const ped of game.peds) {
      drawables.push({ y: ped.y, draw: () => drawPerson(ctx, ped.x, ped.y, ped.angle, ped.color, ped.state === 'down', false, time) });
    }
    for (const cop of game.cops) {
      if (cop.onFoot && !cop.gone) {
        drawables.push({ y: cop.y, draw: () => drawPerson(ctx, cop.x, cop.y, cop.angle, '#1f3a5f', cop.down, false, time) });
      }
    }
    const player = game.player;
    if (player.onFoot) {
      drawables.push({
        y: player.y,
        draw: () => {
          drawPerson(ctx, player.x, player.y, player.aimAngle, '#e74c3c', false, true, time);
          // Muzzle flash while firing.
          if (player.shootTimer > PLAYER_FLASH) {
            ctx.fillStyle = '#ffe9a8';
            ctx.beginPath();
            ctx.arc(player.x + Math.cos(player.aimAngle) * 26, player.y + Math.sin(player.aimAngle) * 26, 7, 0, Math.PI * 2);
            ctx.fill();
          }
        },
      });
    }
    drawables.sort((a, b) => a.y - b.y);
    for (const d of drawables) d.draw();

    // Bullets.
    ctx.strokeStyle = '#ffe9a8';
    ctx.lineWidth = 3;
    for (const b of game.bullets) {
      ctx.beginPath();
      ctx.moveTo(b.x - Math.cos(b.angle) * 12, b.y - Math.sin(b.angle) * 12);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    // Particles.
    for (const p of game.particles) {
      if (p.kind === 'spark') {
        ctx.globalAlpha = Math.max(0, 1 - p.age / p.life);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      } else if (p.kind === 'fireball') {
        const a = Math.max(0, 1 - p.age / p.life);
        const grad = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, p.radius);
        grad.addColorStop(0, `rgba(255, 220, 120, ${a})`);
        grad.addColorStop(0.5, `rgba(230, 126, 34, ${a * 0.8})`);
        grad.addColorStop(1, 'rgba(120, 40, 10, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === 'smoke') {
        ctx.globalAlpha = Math.max(0, 0.5 * (1 - p.age / p.life));
        ctx.fillStyle = '#5d6d7e';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    // Car smoke when a car is badly hurt.
    for (const car of game.cars) {
      if (!car.exploded && car.health < 40 && Math.random() < 0.25) {
        game.particles.push({ kind: 'smoke', x: car.x + (Math.random() - 0.5) * 16, y: car.y + (Math.random() - 0.5) * 16, radius: 6, life: 1.4, age: 0 });
      }
    }

    ctx.restore();

    // Night tint over the world, before the HUD.
    if (light < 0.85) {
      ctx.fillStyle = `rgba(8, 12, 40, ${(0.85 - light) * 0.45})`;
      ctx.fillRect(0, 0, width, height);
    }
    return { width, height, dpr };
  }

  return { drawWorld, resize, ctx, get size() { return { width, height }; } };
}
