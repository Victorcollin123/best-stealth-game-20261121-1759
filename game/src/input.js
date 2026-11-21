// Night Post — keyboard input. WASD/arrows move, Shift sneaks.
// Enter starts, P pauses, M mutes, R restarts. Arrow keys and space are
// prevented from scrolling the page.

export function createInput() {
  const keys = new Set();
  const actions = [];

  function onKeyDown(e) {
    if (
      e.code === 'ArrowUp' ||
      e.code === 'ArrowDown' ||
      e.code === 'ArrowLeft' ||
      e.code === 'ArrowRight' ||
      e.code === 'Space'
    ) {
      e.preventDefault();
    }
    if (e.repeat) return;
    keys.add(e.code);
    if (e.code === 'Enter') actions.push('start');
    else if (e.code === 'KeyP') actions.push('pause');
    else if (e.code === 'KeyM') actions.push('mute');
    else if (e.code === 'KeyR') actions.push('restart');
  }

  function onKeyUp(e) {
    keys.delete(e.code);
  }

  let target = null;
  return {
    attach(el) {
      target = el;
      el.addEventListener('keydown', onKeyDown);
      el.addEventListener('keyup', onKeyUp);
    },
    detach() {
      if (!target) return;
      target.removeEventListener('keydown', onKeyDown);
      target.removeEventListener('keyup', onKeyUp);
      target = null;
    },
    read() {
      let x = 0;
      let y = 0;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
      if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
      const sneak = keys.has('ShiftLeft') || keys.has('ShiftRight');
      return { x, y, sneak };
    },
    takeAction() {
      return actions.shift() || null;
    },
  };
}
