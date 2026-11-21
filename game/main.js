// Night Post — the browser loop. Fixed 60 Hz stepping, title / pause /
// mute / best-time, synthesised WebAudio sounds (no audio files), and the
// ?shot= staging mode: a staged scene is FROZEN — the loop paints it but
// never plays it forward — and sets window.__shotReady after two paints.

import { createWorld, step } from './src/world.js';
import { render } from './src/render.js';
import { createInput } from './src/input.js';
import { stageShot } from './src/shots.js';
import { FIELD } from './src/config.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = FIELD.w;
canvas.height = FIELD.h;

const input = createInput();
const params = new URLSearchParams(window.location.search);

// ---- sounds (synthesised, no files)
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
  return audio;
}
function tone(freq, dur, type = 'sine', gain = 0.08, when = 0) {
  if (muted) return;
  const ac = ensureAudio();
  if (!ac) return;
  const t = ac.currentTime + when;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(g);
  g.connect(ac.destination);
  osc.start(t);
  osc.stop(t + dur);
}
const sfx = {
  pickup() {
    tone(660, 0.12);
    tone(880, 0.18, 'sine', 0.08, 0.09);
  },
  spotted() {
    tone(220, 0.25, 'square', 0.06);
    tone(180, 0.3, 'square', 0.06, 0.15);
  },
  win() {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.25, 'sine', 0.08, i * 0.12));
  },
  caught() {
    tone(140, 0.5, 'sawtooth', 0.07);
  },
};

// ---- best time (localStorage)
const BEST_KEY = 'night-post-best';
function fmtTime(t) {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60)
    .toString()
    .padStart(2, '0');
  return `${m}:${s}`;
}
function loadBest() {
  try {
    return window.localStorage.getItem(BEST_KEY);
  } catch {
    return null;
  }
}
function saveBest(t) {
  const best = loadBest();
  if (best == null || t < parseFloat(best)) {
    try {
      window.localStorage.setItem(BEST_KEY, String(t));
    } catch {
      /* storage unavailable — the game still plays */
    }
  }
}

// ---- state
let world = null;
let screen = 'title'; // title | playing | paused | won | caught
let frozen = false;
let paints = 0;
let prevLetters = 0;
let prevChasing = false;

function newRun(seed) {
  world = createWorld(seed ?? Math.floor(Math.random() * 100000));
  screen = 'playing';
  prevLetters = 0;
  prevChasing = false;
}

function ui() {
  const best = loadBest();
  return { screen, bestTime: best == null ? null : fmtTime(parseFloat(best)), muted };
}

// ---- staging mode: ?shot=start|play|alert|end&seed=N
const shot = params.get('shot');
if (shot) {
  const seed = parseInt(params.get('seed') || '1', 10);
  world = stageShot(shot, seed);
  frozen = true;
  screen =
    world.status === 'won' ? 'won' : world.status === 'caught' ? 'caught' : shot === 'start' ? 'title' : 'playing';
  prevLetters = world.lettersCollected;
  prevChasing = world.guards.some((g) => g.state === 'chase');
} else {
  world = createWorld(1);
  screen = 'title';
}

// ---- fixed-step loop
const DT = 1 / 60;
let acc = 0;
let last = performance.now();

function frame(now) {
  requestAnimationFrame(frame);
  const elapsed = Math.min(0.25, (now - last) / 1000);
  last = now;

  if (!frozen) {
    for (const action of input.actions()) {
      if (action === 'start' && (screen === 'title' || screen === 'won' || screen === 'caught')) {
        ensureAudio();
        newRun();
      } else if (action === 'pause' && (screen === 'playing' || screen === 'paused')) {
        screen = screen === 'playing' ? 'paused' : 'playing';
      } else if (action === 'mute') {
        muted = !muted;
      } else if (action === 'restart') {
        ensureAudio();
        newRun();
      }
    }

    if (screen === 'playing') {
      acc += elapsed;
      let n = 0;
      while (acc >= DT && n < 5) {
        step(world, input.move(), DT);
        acc -= DT;
        n++;
      }
      if (world.lettersCollected > prevLetters) {
        prevLetters = world.lettersCollected;
        sfx.pickup();
      }
      const chasing = world.guards.some((g) => g.state === 'chase');
      if (chasing && !prevChasing) sfx.spotted();
      prevChasing = chasing;
      if (world.status === 'won') {
        screen = 'won';
        saveBest(world.time);
        sfx.win();
      } else if (world.status === 'caught') {
        screen = 'caught';
        sfx.caught();
      }
    }
  }

  render(ctx, world, ui());
  paints++;
  if (frozen && paints >= 2) window.__shotReady = true;
}

requestAnimationFrame(frame);
