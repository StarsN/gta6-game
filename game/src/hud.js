// The HUD and the menus: cash and health, the wanted stars, the mission
// objective, the toasts, and the title, pause and game-over screens. Drawing
// only — the screens' choices live in main.js.
import { FONT, PALETTE, WANTED } from './config.js';
import { daylight } from './world.js';
import { currentMission, objectiveText } from './missions.js';
import { drawMinimap } from './minimap.js';

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = PALETTE.hudPanel;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
}

function bar(ctx, x, y, w, h, fraction, color, back) {
  ctx.fillStyle = back;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 4);
  ctx.fill();
  ctx.fillStyle = color;
  if (fraction > 0) {
    ctx.beginPath();
    ctx.roundRect(x, y, w * Math.max(0, Math.min(1, fraction)), h, 4);
    ctx.fill();
  }
}

function drawStars(ctx, x, y, wanted) {
  ctx.font = '28px ' + FONT;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < WANTED.maxStars; i += 1) {
    ctx.fillStyle = i < wanted ? PALETTE.star : 'rgba(255,255,255,0.25)';
    ctx.fillText('★', x + i * 30, y);
  }
}

export function drawHud(ctx, game, view) {
  const player = game.player;
  const { width, height } = view;
  ctx.textBaseline = 'middle';

  // Top-left: cash and health.
  panel(ctx, 14, 14, 218, 74);
  ctx.fillStyle = PALETTE.ok;
  ctx.font = 'bold 24px ' + FONT;
  ctx.textAlign = 'left';
  ctx.fillText(`$${player.cash.toLocaleString('en-US')}`, 28, 38);
  ctx.fillStyle = PALETTE.muted;
  ctx.font = '13px ' + FONT;
  ctx.fillText(`Ammo ${player.ammo}`, 150, 38);
  bar(ctx, 28, 58, 190, 12, player.health / 100, player.health > 30 ? PALETTE.ok : PALETTE.danger, 'rgba(255,255,255,0.15)');
  ctx.fillStyle = PALETTE.text;
  ctx.font = '12px ' + FONT;
  ctx.fillText('HEALTH', 28, 78);

  // Top-right: wanted stars and the minimap.
  panel(ctx, width - 232, 14, 218, 46);
  drawStars(ctx, width - 218, 37, game.wanted);
  drawMinimap(ctx, game, width - 218, 72, 190);

  // Top-centre: the mission objective.
  const objective = objectiveText(game);
  ctx.font = 'bold 15px ' + FONT;
  const ow = Math.min(560, ctx.measureText(objective).width + 28);
  panel(ctx, (width - ow) / 2, 14, ow, 34);
  ctx.fillStyle = PALETTE.objective;
  ctx.textAlign = 'center';
  ctx.fillText(objective, width / 2, 31);

  // Mission timer, when a step is timed.
  const mission = currentMission(game);
  if (mission && game.missions.active) {
    const step = mission.steps[game.missions.stepIndex];
    if (step && step.type === 'timed') {
      const left = Math.max(0, step.seconds - game.missions.stepTimer);
      ctx.font = 'bold 22px ' + FONT;
      ctx.fillStyle = left < 15 ? PALETTE.danger : PALETTE.text;
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.ceil(left)}s`, width / 2, 66);
    }
    if (step && step.type === 'collect' && game.missions.holdTimer > 0) {
      bar(ctx, (width - 220) / 2, 54, 220, 10, game.missions.holdTimer / step.hold, PALETTE.objective, 'rgba(255,255,255,0.15)');
    }
  }

  // Bottom-left: controls.
  ctx.font = '12px ' + FONT;
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.textAlign = 'left';
  const hint = player.onFoot
    ? 'WASD move · Shift run · E enter car · F punch · Click shoot · M mute · Esc pause'
    : 'W/S drive · A/D steer · E exit car · M mute · Esc pause';
  ctx.fillText(hint, 16, height - 16);

  // Bottom-right: speedometer while driving.
  if (player.car) {
    const kmh = Math.round(Math.abs(player.car.speed) * 0.32);
    panel(ctx, width - 130, height - 66, 116, 52);
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 26px ' + FONT;
    ctx.textAlign = 'center';
    ctx.fillText(`${kmh}`, width - 72, height - 46);
    ctx.font = '11px ' + FONT;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText('KM/H', width - 72, height - 24);
    bar(ctx, width - 118, height - 62, 92, 5, player.car.health / 100, player.car.health > 30 ? '#f39c12' : PALETTE.danger, 'rgba(255,255,255,0.15)');
  }

  // Toasts, newest last, above the bottom edge.
  ctx.font = '14px ' + FONT;
  ctx.textAlign = 'center';
  const shown = game.toasts.slice(-3);
  shown.forEach((toast, i) => {
    const y = height - 84 - (shown.length - 1 - i) * 26;
    ctx.globalAlpha = Math.min(1, toast.time);
    ctx.fillStyle = 'rgba(12,16,24,0.7)';
    const w = ctx.measureText(toast.text).width + 24;
    ctx.beginPath();
    ctx.roundRect((width - w) / 2, y - 13, w, 26, 6);
    ctx.fill();
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(toast.text, width / 2, y);
    ctx.globalAlpha = 1;
  });

  // Hurt flash and busted warning.
  if (player.hurtTimer > 0) {
    ctx.fillStyle = `rgba(231, 76, 60, ${player.hurtTimer * 0.5})`;
    ctx.fillRect(0, 0, width, height);
  }
  if (player.bustedTimer > 0.4 || player.bustCarTimer > 0.8) {
    ctx.font = 'bold 26px ' + FONT;
    ctx.fillStyle = PALETTE.danger;
    ctx.textAlign = 'center';
    ctx.fillText('THE COPS ARE ON YOU — RUN!', width / 2, 108);
  }

  // Clock: sun or moon plus the time of day; it sits left of the speedometer
  // while driving so the two never overlap.
  const t = game.timeOfDay;
  const hour = Math.floor(((t * 24 + 6) % 24));
  const minute = Math.floor((((t * 24 + 6) % 1) * 60));
  ctx.font = '13px ' + FONT;
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.textAlign = 'right';
  const day = daylight(game) > 0.5;
  ctx.fillText(`${day ? '☀' : '☾'} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`, player.car ? width - 146 : width - 16, height - 40);
}

function drawMenuItems(ctx, items, selected, cx, topY) {
  const rects = [];
  ctx.textAlign = 'center';
  items.forEach((item, i) => {
    const y = topY + i * 52;
    const w = 340;
    const h = 40;
    const x = cx - w / 2;
    ctx.fillStyle = i === selected ? 'rgba(247, 220, 111, 0.92)' : 'rgba(255,255,255,0.12)';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 8);
    ctx.fill();
    ctx.fillStyle = i === selected ? '#1a1a1a' : PALETTE.text;
    ctx.font = (i === selected ? 'bold ' : '') + '18px ' + FONT;
    ctx.fillText(item.label, cx, y + 20);
    rects.push({ label: item.label, index: i, x, y, w, h, enabled: item.enabled !== false });
  });
  return rects;
}

function drawTitleBackdrop(ctx, view) {
  const { width, height } = view;
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, 'rgba(10, 14, 24, 0.25)');
  grad.addColorStop(0.55, 'rgba(10, 14, 24, 0.55)');
  grad.addColorStop(1, 'rgba(10, 14, 24, 0.88)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);
}

export function drawTitle(ctx, game, view, save, selected) {
  const { width, height } = view;
  drawTitleBackdrop(ctx, view);
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.text;
  ctx.font = 'bold 64px ' + FONT;
  ctx.fillText('SOLMAR NIGHTS', width / 2, height * 0.24);
  ctx.fillStyle = PALETTE.objective;
  ctx.font = '20px ' + FONT;
  ctx.fillText('An open-world crime story in the city of Solmar', width / 2, height * 0.24 + 38);
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.font = '15px ' + FONT;
  ctx.fillText('Milo Kade is out of prison and out of money. Rosa Ferrante has work — if he can drive.', width / 2, height * 0.24 + 66);
  ctx.fillText('Steal cars, run fares, dodge the SCPD, and pull the Big Score.', width / 2, height * 0.24 + 88);

  const items = [];
  if (save) items.push({ label: `Continue — $${save.cash ?? 0}, mission ${(save.missionIndex ?? 0) + 1} of 4` });
  items.push({ label: 'New game' });
  items.push({ label: 'How to play' });
  const rects = drawMenuItems(ctx, items, selected, width / 2, height * 0.52);

  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '13px ' + FONT;
  ctx.fillText('WASD move · E enter cars · F punch · Mouse aim, click to shoot · M mute', width / 2, height - 28);
  return rects;
}

export function drawHowTo(ctx, view, selected) {
  const { width, height } = view;
  drawTitleBackdrop(ctx, view);
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.text;
  ctx.font = 'bold 34px ' + FONT;
  ctx.fillText('HOW TO PLAY', width / 2, height * 0.2);
  const lines = [
    'On foot: WASD to move, Shift to run. Walk up to a car and press E to steal it.',
    'Driving: W and S for gas and brake, A and D to steer. Press E to step out.',
    'Fists: press F to punch. Pistol: aim with the mouse, click to shoot.',
    'Crime raises your wanted level — stars top right. Cops chase you in cars and on foot.',
    'Lose the heat by hiding, or pay $100 at Quick Respray (green ring on the map).',
    'Follow the yellow marker: missions pay $200 to $1,500. Drive a yellow cab for fares.',
    'Hidden packages are worth $50 each — find all 10 for a $500 bonus.',
    'Your progress saves automatically. Getting busted or wasted costs you cash.',
  ];
  ctx.font = '15px ' + FONT;
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  lines.forEach((line, i) => ctx.fillText(line, width / 2, height * 0.3 + i * 30));
  return drawMenuItems(ctx, [{ label: 'Back' }], selected, width / 2, height * 0.78);
}

export function drawPause(ctx, view, selected) {
  const { width, height } = view;
  ctx.fillStyle = 'rgba(8, 10, 16, 0.72)';
  ctx.fillRect(0, 0, width, height);
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.text;
  ctx.font = 'bold 44px ' + FONT;
  ctx.fillText('PAUSED', width / 2, height * 0.3);
  return drawMenuItems(ctx, [
    { label: 'Resume' },
    { label: 'Save and quit to title' },
    { label: 'Restart from the beginning' },
  ], selected, width / 2, height * 0.44);
}

export function drawGameOver(ctx, game, view, selected) {
  const { width, height } = view;
  ctx.fillStyle = 'rgba(8, 10, 16, 0.78)';
  ctx.fillRect(0, 0, width, height);
  ctx.textAlign = 'center';
  const busted = game.over === 'busted';
  ctx.fillStyle = busted ? '#5dade2' : PALETTE.danger;
  ctx.font = 'bold 56px ' + FONT;
  ctx.fillText(busted ? 'BUSTED' : 'WASTED', width / 2, height * 0.3);
  ctx.fillStyle = PALETTE.text;
  ctx.font = '17px ' + FONT;
  const fee = Math.min(game.player.cash, Math.max(150, Math.round(game.player.cash * 0.1)));
  ctx.fillText(
    busted
      ? `The SCPD hauled you in. You lost $${fee} in fines and impound fees.`
      : 'Milo went down. The hospital patched him up — for a price.',
    width / 2, height * 0.3 + 40,
  );
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillText(`Cash earned so far: $${game.stats.earned.toLocaleString('en-US')} · Fares: ${game.stats.fares} · Packages: ${game.stats.packages}/10`, width / 2, height * 0.3 + 68);
  return drawMenuItems(ctx, [
    { label: 'Respawn at Solmar General' },
    { label: 'Quit to title' },
  ], selected, width / 2, height * 0.52);
}
