// The minimap: the whole city shrunk into a corner, with the player, the
// mission marker, the police and the fares on it.
import { ROADS, WORLD } from './config.js';
import { currentStep, stepPosition } from './missions.js';

export function drawMinimap(ctx, game, x, y, size) {
  const scale = size / WORLD;
  ctx.save();
  ctx.fillStyle = 'rgba(12, 16, 24, 0.72)';
  ctx.fillRect(x - 6, y - 6, size + 12, size + 12);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x - 6, y - 6, size + 12, size + 12);
  ctx.beginPath();
  ctx.rect(x, y, size, size);
  ctx.clip();

  // Water and beach.
  ctx.fillStyle = '#1f6f8b';
  ctx.fillRect(x, y + game.city.beachY * scale, size, size - game.city.beachY * scale);
  ctx.fillStyle = '#2f333a';
  // Roads.
  for (const r of ROADS) {
    ctx.fillRect(x, y + r * scale - 1.5, size, 3);
    ctx.fillRect(x + r * scale - 1.5, y, 3, size);
  }
  // Buildings as faint blocks.
  ctx.fillStyle = 'rgba(180,190,200,0.35)';
  for (const b of game.city.buildings) {
    ctx.fillRect(x + b.x * scale, y + b.y * scale, Math.max(1.5, b.w * scale), Math.max(1.5, b.h * scale));
  }
  // Packages.
  ctx.fillStyle = '#f7dc6f';
  for (const p of game.pickups) {
    if (p.kind === 'package' && !p.taken) ctx.fillRect(x + p.x * scale - 1.5, y + p.y * scale - 1.5, 3, 3);
  }
  // Fare.
  if (game.missions.fare) {
    const fare = game.missions.fare;
    const target = fare.onboard ? fare.dest : fare.pickup;
    ctx.fillStyle = '#2ecc71';
    ctx.beginPath();
    ctx.arc(x + target.x * scale, y + target.y * scale, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  // Mission marker.
  const step = currentStep(game);
  if (step && (step.type === 'reach' || step.type === 'deliver' || step.type === 'collect' || step.type === 'timed')) {
    const pos = stepPosition(game, step);
    ctx.fillStyle = '#f7dc6f';
    ctx.save();
    ctx.translate(x + pos.x * scale, y + pos.y * scale);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-4, -4, 8, 8);
    ctx.restore();
  }
  // Police, only while wanted.
  if (game.wanted > 0) {
    for (const cop of game.cops) {
      ctx.fillStyle = '#ff2d20';
      ctx.beginPath();
      ctx.arc(x + cop.x * scale, y + cop.y * scale, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // The player, always in the middle of the action.
  const player = game.player;
  ctx.save();
  ctx.translate(x + player.x * scale, y + player.y * scale);
  ctx.rotate(player.angle);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(7, 0);
  ctx.lineTo(-5, -5);
  ctx.lineTo(-5, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.restore();
}
