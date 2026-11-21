// Night Post — the browser loop: fixed 60 Hz steps, canvas rendering,
// title / playing / won / caught screens, synthesized WebAudio sounds,
// best time in localStorage. `?shot=start|play|alert|end&seed=N`
// stages a frozen scene for screenshots instead of the title screen.

import { createWorld, step } from './src/world.js';
import { render } from './src/render.js';
import { createInput, attachInput, readMovement, drainActions } from './src/input.js';
import { stageShot } from './src/shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seed = Number.parseInt(params.get('seed') || '1', 10) || 1;

const BEST_KEY = 'night-post-best-time';
let bestTime = null;
try {
  const raw = window.localStorage.getItem(BEST_KEY);
  if (raw !== null) bestTime = Number.parseFloat(raw);
} catch {
  bestTime = null;
}

// --- tiny synth: no audio files, everything is WebAudio ---
let audioCtx = null;
let muted = false;
function beep(freq, dur, type = 'sine', gain = 0.08, when = 0) {
  if (muted) return;
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const t0 = audioCtx.currentTime + when;
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(audioCtx.destination);
    osc.start(t0);
    osc.stop(t0 + dur);
  } catch {
    // Audio is decoration; a failure must never break the game.
  }
}
function playPickup() { beep(880, 0.12, 'sine', 0.07); beep(1318, 0.16, 'sine', 0.06, 0.09); }
function playSpotted() { beep(220, 0.25, 'sawtooth', 0.09); beep(165, 0.3, 'sawtooth', 0.09, 0.12); }
function playCaught() { beep(110, 0.5, 'sawtooth', 0.1); beep(82, 0.6, 'sawtooth', 0.1, 0.2); }
function playWin() { [523, 659, 784, 1046].forEach((f, i) => beep(f, 0.22, 'sine', 0.07, i * 0.12)); }

const input = createInput();
attachInput(input, window);

let world;
let screen; // 'title' | 'playing' | 'won' | 'caught'
let staged = false;
let paused = false;
let lastSpotted = 0;
let lastLetters = 0;

if (shotName) {
  // Staged scene: FROZEN. The loop paints it but never plays it
  // forward, or a chasing guard would catch the standing courier
  // before the screenshot lands.
  world = stageShot(shotName, seed);
  staged = true;
  screen = world.status === 'won' ? 'won' : world.status === 'caught' ? 'caught' : 'playing';
  if (shotName === 'start') screen = 'title';
} else {
  world = createWorld(seed);
  screen = 'title';
}

let last = performance.now();
let acc = 0;
const STEP = 1 / 60;
let paints = 0;

function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;

  if (!staged) {
    for (const action of drainActions(input)) {
      if (action === 'start' && screen === 'title') {
        world = createWorld(seed);
        screen = 'playing';
        lastSpotted = 0;
        lastLetters = 0;
        beep(660, 0.1, 'sine', 0.06);
      } else if (action === 'pause' && screen === 'playing') {
        paused = !paused;
      } else if (action === 'mute') {
        muted = !muted;
      } else if (action === 'restart') {
        world = createWorld(seed);
        screen = 'playing';
        paused = false;
        lastSpotted = 0;
        lastLetters = 0;
      }
    }

    if (screen === 'playing' && !paused) {
      acc += dt;
      while (acc >= STEP) {
        step(world, readMovement(input), STEP);
        acc -= STEP;
        if (world.lettersCollected > lastLetters) {
          lastLetters = world.lettersCollected;
          playPickup();
        }
        if (world.timesSpotted > lastSpotted) {
          lastSpotted = world.timesSpotted;
          playSpotted();
        }
        if (world.status === 'won') {
          screen = 'won';
          playWin();
          if (bestTime === null || world.time < bestTime) {
            bestTime = world.time;
            try { window.localStorage.setItem(BEST_KEY, String(bestTime)); } catch { /* ignore */ }
          }
          break;
        }
        if (world.status === 'caught') {
          screen = 'caught';
          playCaught();
          break;
        }
      }
    }
  }

  render(ctx, world, screen, { bestTime });
  paints += 1;
  if (staged && paints >= 2) window.__shotReady = true;
  requestAnimationFrame(frame);
}

render(ctx, world, screen, { bestTime });
requestAnimationFrame(frame);
