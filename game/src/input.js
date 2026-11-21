// Night Post — keyboard input. Movement keys are held state; Enter,
// P, M and R are one-shot actions consumed once per press.

export function createInput() {
  return {
    keys: new Set(),
    actions: [], // one-shot queue: 'start' | 'pause' | 'mute' | 'restart'
  };
}

const MOVE_KEYS = {
  KeyW: [0, -1],
  ArrowUp: [0, -1],
  KeyS: [0, 1],
  ArrowDown: [0, 1],
  KeyA: [-1, 0],
  ArrowLeft: [-1, 0],
  KeyD: [1, 0],
  ArrowRight: [1, 0],
};

const ACTION_KEYS = {
  Enter: 'start',
  KeyP: 'pause',
  KeyM: 'mute',
  KeyR: 'restart',
};

export function attachInput(input, target) {
  function onKeyDown(e) {
    if (MOVE_KEYS[e.code] || ACTION_KEYS[e.code] || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
      e.preventDefault();
    }
    if (e.repeat) return;
    input.keys.add(e.code);
    const action = ACTION_KEYS[e.code];
    if (action) input.actions.push(action);
  }
  function onKeyUp(e) {
    input.keys.delete(e.code);
  }
  target.addEventListener('keydown', onKeyDown);
  target.addEventListener('keyup', onKeyUp);
  return () => {
    target.removeEventListener('keydown', onKeyDown);
    target.removeEventListener('keyup', onKeyUp);
  };
}

// Read the current movement vector + sneak flag from held keys.
export function readMovement(input) {
  let dx = 0;
  let dy = 0;
  for (const code of input.keys) {
    const v = MOVE_KEYS[code];
    if (v) {
      dx += v[0];
      dy += v[1];
    }
  }
  const sneak = input.keys.has('ShiftLeft') || input.keys.has('ShiftRight');
  return { dx, dy, sneak };
}

// Pull and clear the one-shot action queue.
export function drainActions(input) {
  const out = input.actions;
  input.actions = [];
  return out;
}
