// Night Post: the keyboard. WASD or arrows move, either Shift sneaks, Enter
// starts, R restarts, P pauses, M mutes. One-shot actions (start, restart,
// pause, mute) are queued and drained once per frame so a single press never
// fires twice.

const KEY_ACTIONS = {
  Enter: 'start',
  KeyR: 'restart',
  KeyP: 'pause',
  KeyM: 'mute',
};

const PREVENTED = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']);

export function createInput() {
  const held = new Set();
  const actions = [];

  function onKeyDown(event) {
    if (PREVENTED.has(event.code)) event.preventDefault();
    if (event.repeat) return;
    const action = KEY_ACTIONS[event.code];
    if (action) actions.push(action);
    held.add(event.code);
  }

  function onKeyUp(event) {
    held.delete(event.code);
  }

  function onBlur() {
    held.clear();
  }

  return {
    attach() {
      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('keyup', onKeyUp);
      window.addEventListener('blur', onBlur);
    },
    detach() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    },
    /** The movement direction right now, plus whether the courier is sneaking. */
    direction() {
      let x = 0;
      let y = 0;
      if (held.has('KeyA') || held.has('ArrowLeft')) x -= 1;
      if (held.has('KeyD') || held.has('ArrowRight')) x += 1;
      if (held.has('KeyW') || held.has('ArrowUp')) y -= 1;
      if (held.has('KeyS') || held.has('ArrowDown')) y += 1;
      return { x, y, sneak: held.has('ShiftLeft') || held.has('ShiftRight') };
    },
    /** The one-shot actions pressed since the last drain. */
    drainActions() {
      const drained = [...actions];
      actions.length = 0;
      return drained;
    },
  };
}
