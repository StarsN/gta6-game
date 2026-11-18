// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps (several in a slow frame, none in a fast one), and the renderer
// paints what is there. The game moves between five screens: title, how to play,
// play, paused and game over.
//
// ?seed=N fixes the city's random pattern. ?shot=start|street|chase|mission
// (with &seed=N) stages that scene instead of running the loop, paints it twice
// and sets window.__shotReady for a screenshot.
import { STEP } from './config.js';
import { createGame, resetGame, stepGame } from './world.js';
import { ACTION_CONFIRM, ACTION_INTERACT, ACTION_MUTE, ACTION_PAUSE, ACTION_PUNCH, createInput } from './input.js';
import { createRenderer } from './render.js';
import { drawGameOver, drawHowTo, drawHud, drawPause, drawTitle } from './hud.js';
import { createAudio } from './audio.js';
import { clearSave, readSave, writeSave } from './save.js';
import { enterCar, exitCar } from './player.js';
import { tryPunch, tryShoot } from './combat.js';
import { failMission } from './missions.js';
import { approachPoint } from './city.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped. */
const MAX_FRAME = 0.25;
const AUTOSAVE_SECONDS = 5;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const audio = createAudio();

const SILENT = {
  sirenOn() {}, sirenOff() {}, stopEngine() {}, engineSet() {}, engineStart() {},
  crash() {}, gunshot() {}, cash() {}, pickup() {}, missionJingle() {}, failTone() {},
  click() {}, punch() {}, explosion() {}, unlock() {}, setMuted() {}, isMuted() { return false; },
  musicStart() {}, musicStop() {},
};

function runShot(name) {
  const { game, screen } = stageShot(name, seed, SILENT);
  const renderer = createRenderer(canvas);
  let painted = 0;
  function paint() {
    const view = renderer.drawWorld(game);
    if (screen === 'title') {
      drawTitle(renderer.ctx, game, view, null, 0);
    } else {
      drawHud(renderer.ctx, game, view);
    }
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  const renderer = createRenderer(canvas);
  let game = createGame(seed);
  let screen = 'title';
  let selected = 0;
  let save = readSave();
  let menuRects = [];
  let autosaveTimer = 0;
  let lastMissionIndex = 0;
  let accumulator = 0;
  let last = performance.now();
  let unlocked = false;

  function announce(message) {
    status.textContent = message;
  }

  // A read-only handle for automated playtests: the state and the screen.
  window.__solmar = {
    get state() { return game; },
    get screen() { return screen; },
  };

  function snapshot() {
    return {
      cash: game.player.cash,
      missionIndex: game.missions.index,
      packages: game.stats.packages,
      fares: game.stats.fares,
      earned: game.stats.earned,
      playerX: Math.round(game.player.x),
      playerY: Math.round(game.player.y),
      muted: audio.isMuted(),
    };
  }

  function autosave() {
    writeSave(snapshot());
  }

  function applySave(data) {
    game.player.cash = data.cash ?? 0;
    game.missions.index = data.missionIndex ?? 0;
    game.stats.packages = data.packages ?? 0;
    game.stats.fares = data.fares ?? 0;
    game.stats.earned = data.earned ?? 0;
    if (typeof data.playerX === 'number') game.player.x = data.playerX;
    if (typeof data.playerY === 'number') game.player.y = data.playerY;
    game.camera.x = game.player.x;
    game.camera.y = game.player.y;
    if (data.muted) audio.setMuted(true);
    // Packages already collected stay collected.
    let taken = 0;
    for (const p of game.pickups) {
      if (p.kind === 'package' && taken < game.stats.packages) { p.taken = true; taken += 1; }
    }
  }

  function unlockAudio() {
    if (unlocked) return;
    unlocked = true;
    audio.unlock();
    audio.musicStart();
  }

  function startNewGame() {
    clearSave();
    game = createGame(seed);
    save = null;
    screen = 'play';
    announce('Playing. Follow the yellow marker.');
  }

  function continueGame() {
    game = createGame(seed);
    if (save) applySave(save);
    screen = 'play';
    announce('Playing. Follow the yellow marker.');
  }

  function quitToTitle() {
    autosave();
    save = readSave();
    game = createGame(seed);
    screen = 'title';
    selected = 0;
    announce('Solmar Nights. Press Enter to start.');
  }

  function respawn() {
    const player = game.player;
    const fee = Math.min(player.cash, Math.max(150, Math.round(player.cash * 0.1)));
    player.cash -= fee;
    player.health = 100;
    const hospital = approachPoint(game.city.places.hospital);
    player.x = hospital.x;
    player.y = hospital.y;
    player.onFoot = true;
    if (player.car) { player.car.kind = 'parked'; player.car = null; }
    game.wanted = 0;
    game.cops = [];
    game.over = null;
    game.player.bustedTimer = 0;
    game.player.bustCarTimer = 0;
    game.player.invulnerable = 2;
    failMission(game, audio);
    audio.sirenOff();
    audio.stopEngine();
    game.camera.x = player.x;
    game.camera.y = player.y;
    screen = 'play';
    game.toasts.push({ text: `Back on your feet — $${fee} poorer`, time: 4 });
    announce('Playing.');
  }

  function titleItems() {
    const items = [];
    if (save) items.push({ label: 'continue' });
    items.push({ label: 'new' });
    items.push({ label: 'howto' });
    return items;
  }

  function activateTitle() {
    const items = titleItems();
    const choice = items[selected]?.label;
    audio.click();
    if (choice === 'continue') continueGame();
    else if (choice === 'new') startNewGame();
    else if (choice === 'howto') { screen = 'howto'; selected = 0; }
  }

  function activatePause() {
    audio.click();
    if (selected === 0) { screen = 'play'; announce('Playing.'); }
    else if (selected === 1) quitToTitle();
    else if (selected === 2) startNewGame();
  }

  function activateOver() {
    audio.click();
    if (selected === 0) respawn();
    else quitToTitle();
  }

  function activateHowTo() {
    audio.click();
    screen = 'title';
    selected = 0;
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      audio.setMuted(!audio.isMuted());
      game.toasts.push({ text: audio.isMuted() ? 'Sound off' : 'Sound on', time: 2 });
    }
    if (screen === 'title') {
      if (actions & ACTION_CONFIRM) activateTitle();
    } else if (screen === 'howto') {
      if (actions & ACTION_CONFIRM) activateHowTo();
    } else if (screen === 'play') {
      if (actions & ACTION_PAUSE) { screen = 'paused'; selected = 0; announce('Paused.'); }
      else if (actions & ACTION_PUNCH) tryPunch(game, audio);
      else if (actions & ACTION_INTERACT) {
        if (game.player.onFoot) {
          const car = enterCar(game, audio);
          if (car) game.toasts.push({ text: `You took the ${car.model.name}`, time: 2 });
        } else {
          exitCar(game, audio);
        }
      }
    } else if (screen === 'paused') {
      if (actions & ACTION_PAUSE) { screen = 'play'; announce('Playing.'); }
      else if (actions & ACTION_CONFIRM) activatePause();
    } else if (screen === 'over') {
      if (actions & ACTION_CONFIRM) activateOver();
    }
    // Mouse click: shoot on foot, or press a menu button.
    const mouse = input.mouse;
    if (mouse.clicked) {
      unlockAudio();
      if (screen === 'play' && game.player.onFoot) tryShoot(game, audio);
      else if (screen !== 'play') {
        for (const rect of menuRects) {
          if (rect.enabled && mouse.x >= rect.x && mouse.x <= rect.x + rect.w && mouse.y >= rect.y && mouse.y <= rect.y + rect.h) {
            selected = rect.index;
            if (screen === 'title') activateTitle();
            else if (screen === 'howto') activateHowTo();
            else if (screen === 'paused') activatePause();
            else if (screen === 'over') activateOver();
            break;
          }
        }
      }
      input.clearClick();
    }
  }

  function step() {
    if (screen === 'title' || screen === 'howto') {
      // Attract mode: the city lives behind the menu.
      const idle = {
        move() { return { x: 0, y: 0 }; },
        run() { return false; },
        takeActions() { return 0; },
        mouse: { x: 0, y: 0, down: false, clicked: false },
        clearClick() {},
      };
      stepGame(game, STEP, idle, SILENT);
      return;
    }
    if (screen !== 'play') return;
    // Aim the pistol at the mouse.
    const mouse = input.mouse;
    const view = renderer.size;
    const cam = game.camera;
    const worldX = cam.x + (mouse.x - view.width / 2) / cam.zoom;
    const worldY = cam.y + (mouse.y - view.height / 2) / cam.zoom;
    game.player.aimAngle = Math.atan2(worldY - game.player.y, worldX - game.player.x);
    if (game.player.onFoot && mouse.down) tryShoot(game, audio);
    stepGame(game, STEP, input, audio);
    autosaveTimer += STEP;
    if (autosaveTimer > AUTOSAVE_SECONDS || game.missions.index !== lastMissionIndex) {
      autosaveTimer = 0;
      lastMissionIndex = game.missions.index;
      autosave();
    }
    if (game.over) {
      screen = 'over';
      selected = 0;
      autosave();
      announce(game.over === 'busted' ? 'Busted.' : 'Wasted.');
    }
  }

  // Menu arrow keys: listen once, here, so selection moves without fighting input.
  window.addEventListener('keydown', (event) => {
    unlockAudio();
    if (screen === 'title' || screen === 'paused' || screen === 'over' || screen === 'howto') {
      const count = screen === 'title' ? titleItems().length : screen === 'paused' ? 3 : screen === 'over' ? 2 : 1;
      if (event.code === 'ArrowUp') selected = (selected - 1 + count) % count;
      if (event.code === 'ArrowDown') selected = (selected + 1) % count;
    }
  });
  window.addEventListener('mousedown', unlockAudio, { once: false });
  canvas.addEventListener('mousedown', unlockAudio);

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    game.viewport = renderer.size;
    while (accumulator >= STEP && (screen === 'title' || screen === 'howto' || screen === 'play')) {
      step();
      accumulator -= STEP;
    }
    if (screen === 'paused' || screen === 'over') accumulator = 0;
    const view = renderer.drawWorld(game);
    if (screen === 'title') menuRects = drawTitle(renderer.ctx, game, view, save, selected);
    else if (screen === 'howto') menuRects = drawHowTo(renderer.ctx, view, selected);
    else if (screen === 'paused') menuRects = drawPause(renderer.ctx, view, selected);
    else if (screen === 'over') menuRects = drawGameOver(renderer.ctx, game, view, selected);
    else drawHud(renderer.ctx, game, view);
    if (!window.__gameReady) window.__gameReady = true;
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === 'play') {
      screen = 'paused';
      selected = 0;
      announce('Paused.');
    }
  });

  announce('Solmar Nights. Press Enter to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
