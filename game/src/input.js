// Night Post — keyboard input. Movement keys are read live each frame;
// one-shot actions (start, pause, mute, restart) go on a queue the loop
// consumes, so a single press is never missed or doubled.

const MOVE_KEYS = {
  KeyW: { x: 0, y: -1 },
  ArrowUp: { x: 0, y: -1 },
  KeyS: { x: 0, y: 1 },
  ArrowDown: { x: 0, y: 1 },
  KeyA: { x: -1, y: 0 },
  ArrowLeft: { x: -1, y: 0 },
  KeyD: { x: 1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
};

const ACTION_KEYS = {
  Enter: 'start',
  KeyP: 'pause',
  KeyM: 'mute',
  KeyR: 'restart',
};

export function createInput() {
  const keys = new Set();
  const queue = [];

  function onKeyDown(e) {
    if (MOVE_KEYS[e.code] || ACTION_KEYS[e.code] || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
      e.preventDefault();
    }
    if (e.repeat) return;
    keys.add(e.code);
    const action = ACTION_KEYS[e.code];
    if (action) queue.push(action);
  }

  function onKeyUp(e) {
    keys.delete(e.code);
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
  }

  return {
    /** Current movement vector {x, y, sneak}; zero when no key is held. */
    move() {
      let x = 0;
      let y = 0;
      for (const code of keys) {
        const m = MOVE_KEYS[code];
        if (m) {
          x += m.x;
          y += m.y;
        }
      }
      return {
        x,
        y,
        sneak: keys.has('ShiftLeft') || keys.has('ShiftRight'),
      };
    },
    /** Drain the one-shot action queue, in order. */
    actions() {
      return queue.splice(0, queue.length);
    },
    /** Test hook: pretend a key was pressed (no browser needed). */
    press(code) {
      onKeyDown({ code, repeat: false, preventDefault() {} });
    },
    release(code) {
      onKeyUp({ code });
    },
  };
}
