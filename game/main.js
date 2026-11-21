// Night Post — browser entry. Interactive loop, plus a frozen staged
// mode for screenshots: ?shot=start|play|alert|end&seed=1 renders one
// staged world and sets window.__shotReady when the frame is painted.

import { createWorld, step } from './src/world.js';
import { render } from './src/render.js';
import { createInput } from './src/input.js';
import { stageShot } from './src/shots.js';

const params = new URLSearchParams(location.search);
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const input = createInput();
input.attach(window);

// Tiny synth: a few tones, no assets. AudioContext is created lazily on
// the first key press, so a silent screenshot run never touches audio.
let audio = null;
let muted = false;
function ensureAudio() {
  if (!audio) {
    try {
      audio = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      audio = null;
    }
  }
  if (audio && audio.state === 'suspended') audio.resume();
}
function tone(freq, dur, type, gain) {
  if (!audio || muted) return;
  try {
    const osc = audio.createOscillator();
    const g = audio.createGain();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    g.gain.value = gain || 0.06;
    osc.connect(g);
    g.connect(audio.destination);
    osc.start();
    osc.stop(audio.currentTime + dur);
  } catch {
    // Audio is decoration; never let it break the game.
  }
}
function sound(name) {
  if (name === 'pickup') {
    tone(880, 0.12, 'sine', 0.08);
    setTimeout(() => tone(1320, 0.15, 'sine', 0.08), 80);
  } else if (name === 'alert') {
    tone(220, 0.2, 'sawtooth', 0.05);
  } else if (name === 'caught') {
    tone(160, 0.4, 'sawtooth', 0.08);
    setTimeout(() => tone(110, 0.5, 'sawtooth', 0.08), 150);
  } else if (name === 'win') {
    tone(523, 0.15, 'sine', 0.08);
    setTimeout(() => tone(659, 0.15, 'sine', 0.08), 120);
    setTimeout(() => tone(784, 0.3, 'sine', 0.08), 240);
  }
}

function loadBest() {
  try {
    return Number(localStorage.getItem('nightpost.best') || 0) || null;
  } catch {
    return null;
  }
}
function saveBest(t) {
  try {
    localStorage.setItem('nightpost.best', String(t));
  } catch {
    // Best time is decoration; never let storage break the game.
  }
}

let world = createWorld(1);
let screen = 'title';
let best = loadBest();

if (params.has('shot')) {
  const shot = params.get('shot');
  const seed = Number(params.get('seed') || 1);
  world = stageShot(shot, seed);
  screen =
    world.status === 'won'
      ? 'won'
      : world.status === 'caught'
        ? 'caught'
        : shot === 'start'
          ? 'title'
          : 'playing';
  render(ctx, world, screen, { best, muted });
  requestAnimationFrame(() => {
    render(ctx, world, screen, { best, muted });
    window.__shotReady = true;
  });
} else {
  let lastTime = performance.now();
  let acc = 0;
  let lastLetters = 0;
  let lastChasing = false;

  function frame(now) {
    const dt = Math.min(0.1, (now - lastTime) / 1000);
    lastTime = now;
    const action = input.takeAction();
    if (action === 'start' && screen === 'title') {
      ensureAudio();
      world = createWorld((Math.random() * 1e9) | 0);
      screen = 'playing';
      lastLetters = 0;
      lastChasing = false;
    } else if (action === 'pause' && (screen === 'playing' || screen === 'paused')) {
      screen = screen === 'playing' ? 'paused' : 'playing';
    } else if (action === 'mute') {
      muted = !muted;
    } else if (action === 'restart' && screen !== 'title') {
      ensureAudio();
      world = createWorld((Math.random() * 1e9) | 0);
      screen = 'playing';
      lastLetters = 0;
      lastChasing = false;
    }

    if (screen === 'playing') {
      acc += dt;
      const STEP = 1 / 60;
      let n = 0;
      while (acc >= STEP && n < 5) {
        step(world, input.read(), STEP);
        acc -= STEP;
        n++;
      }
      if (world.lettersCollected > lastLetters) {
        sound('pickup');
        lastLetters = world.lettersCollected;
      }
      const chasing = world.guards.some((g) => g.state === 'chase');
      if (chasing && !lastChasing) sound('alert');
      lastChasing = chasing;
      if (world.status === 'won') {
        screen = 'won';
        sound('win');
        if (!best || world.time < best) {
          best = world.time;
          saveBest(best);
        }
      } else if (world.status === 'caught') {
        screen = 'caught';
        sound('caught');
      }
    }
    render(ctx, world, screen, { best, muted });
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
