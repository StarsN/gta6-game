// Keyboard and mouse input: the keys held this frame and the edge-triggered
// actions (confirm, pause, punch, interact) the game consumes once.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_PUNCH = 4;
export const ACTION_INTERACT = 8;
export const ACTION_MUTE = 16;

export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set();
  let mouseX = 0;
  let mouseY = 0;
  let mouseDown = false;
  let mouseClicked = false;

  function code(event) {
    return event.code;
  }

  window.addEventListener('keydown', (event) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
    if (!keys.has(event.code)) pressed.add(event.code);
    keys.add(event.code);
  });
  window.addEventListener('keyup', (event) => keys.delete(event.code));
  window.addEventListener('blur', () => keys.clear());
  canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
  });
  canvas.addEventListener('mousedown', (event) => {
    if (event.button === 0) {
      mouseDown = true;
      mouseClicked = true;
    }
  });
  window.addEventListener('mouseup', () => { mouseDown = false; });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  function held(...codes) {
    return codes.some((c) => keys.has(c));
  }

  return {
    /** Driving / walking direction: -1, 0 or 1 on each axis. */
    move() {
      const x = (held('KeyD', 'ArrowRight') ? 1 : 0) - (held('KeyA', 'ArrowLeft') ? 1 : 0);
      const y = (held('KeyS', 'ArrowDown') ? 1 : 0) - (held('KeyW', 'ArrowUp') ? 1 : 0);
      return { x, y };
    },
    run() { return held('ShiftLeft', 'ShiftRight'); },
    get mouse() { return { x: mouseX, y: mouseY, down: mouseDown, clicked: mouseClicked }; },
    clearClick() { mouseClicked = false; },
    /** Actions pressed since the last call, as a bitmask. */
    takeActions() {
      let actions = 0;
      if (pressed.has('Enter') || pressed.has('Space')) actions |= ACTION_CONFIRM;
      if (pressed.has('Escape') || pressed.has('KeyP')) actions |= ACTION_PAUSE;
      if (pressed.has('KeyF')) actions |= ACTION_PUNCH;
      if (pressed.has('KeyE')) actions |= ACTION_INTERACT;
      if (pressed.has('KeyM')) actions |= ACTION_MUTE;
      pressed.clear();
      return actions;
    },
  };
}
