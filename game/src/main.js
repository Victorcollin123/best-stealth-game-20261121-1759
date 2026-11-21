// Night Post: the browser half. A fixed 60 Hz simulation loop, a title screen, pause and
// mute, a best time kept in localStorage, and small synthesized sounds (no audio files).
// With ?shot=start|play|alert|end&seed=N in the URL the game stages that screenshot
// scene instead of starting the title screen, and sets window.__shotReady once it has
// painted twice — that is what the screenshot step waits on.

import { FIELD, STEP, BEST_KEY, FONT, PALETTE } from './config.js';
import { createWorld, step } from './world.js';
import { render } from './render.js';
import { createInput } from './input.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = FIELD.width;
canvas.height = FIELD.height;

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seed = Number(params.get('seed') || 1);

let world = createWorld(seed);
let screen = 'title'; // 'title' | 'playing' | 'paused' | 'won' | 'caught'
let muted = false;
let best = null;
try {
  const saved = window.localStorage.getItem(BEST_KEY);
  best = saved == null ? null : Number(saved);
} catch {
  best = null;
}

const input = createInput();
input.attach();

// --- Sound: tiny synthesized blips, no audio files. -----------------------
let audio = null;
function audioContext() {
  if (audio == null) audio = new (window.AudioContext || window.webkitAudioContext)();
  if (audio.state === 'suspended') audio.resume();
  return audio;
}
function tone(frequency, duration, type = 'sine', volume = 0.12, when = 0) {
  if (muted) return;
  try {
    const context = audioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    const start = context.currentTime + when;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.05);
  } catch {
    // Sound is decoration: a browser without audio still plays the game.
  }
}
function playPickup() {
  tone(660, 0.12, 'sine', 0.1);
  tone(880, 0.16, 'sine', 0.1, 0.08);
}
function playAlert() {
  tone(220, 0.4, 'sawtooth', 0.08);
  tone(165, 0.4, 'sawtooth', 0.06, 0.1);
}
function playWin() {
  [523, 659, 784, 1046].forEach((frequency, index) => tone(frequency, 0.22, 'sine', 0.1, index * 0.12));
}
function playCaught() {
  tone(110, 0.5, 'square', 0.1);
}

function saveBest() {
  if (world.winTime == null) return;
  if (best == null || world.winTime < best) {
    best = world.winTime;
    try {
      window.localStorage.setItem(BEST_KEY, String(best));
    } catch {
      // A browser that refuses storage still keeps the best for this visit.
    }
  }
}

function startGame() {
  world = createWorld(seed);
  screen = 'playing';
  lastLetters = 0;
  lastChasing = false;
}

function drawPaused() {
  ctx.fillStyle = 'rgba(11, 14, 20, 0.72)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  ctx.fillStyle = PALETTE.text;
  ctx.font = `600 32px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Paused — press P to continue', FIELD.width / 2, FIELD.height / 2);
}

function paint() {
  render(ctx, world, { screen, best });
  if (screen === 'paused') drawPaused();
}

// --- Screenshot staging ---------------------------------------------------
// A staged scene is already final: the loop paints it but never plays it forward,
// or a chasing guard would catch the standing courier before the screenshot lands.
const frozen = Boolean(shotName);
let staged = false;
if (shotName) {
  const stagedShot = stageShot(shotName, seed);
  world = stagedShot.world;
  screen =
    shotName === 'start'
      ? 'title'
      : world.status === 'won'
        ? 'won'
        : world.status === 'caught'
          ? 'caught'
          : 'playing';
  staged = true;
}

// --- The loop --------------------------------------------------------------
let lastLetters = 0;
let lastChasing = false;
let lastTime = performance.now();
let accumulator = 0;

function frame(now) {
  const actions = input.drainActions();
  for (const action of actions) {
    if (action === 'start' && screen === 'title') {
      audioContext();
      startGame();
    } else if (action === 'restart' && (screen === 'won' || screen === 'caught')) {
      startGame();
    } else if (action === 'pause' && (screen === 'playing' || screen === 'paused')) {
      screen = screen === 'playing' ? 'paused' : 'playing';
    } else if (action === 'mute') {
      muted = !muted;
    }
  }

  if (screen === 'playing' && !frozen) {
    accumulator += Math.min((now - lastTime) / 1000, 0.25);
    let steps = 0;
    while (accumulator >= STEP && steps < 5) {
      step(world, input.direction(), STEP);
      accumulator -= STEP;
      steps += 1;
    }
    if (world.lettersCollected > lastLetters) {
      playPickup();
      lastLetters = world.lettersCollected;
    }
    const chasing = world.guards.some((guard) => guard.state === 'chase');
    if (chasing && !lastChasing) playAlert();
    lastChasing = chasing;
    if (world.status === 'won') {
      saveBest();
      playWin();
      screen = 'won';
    } else if (world.status === 'caught') {
      playCaught();
      screen = 'caught';
    }
  }
  lastTime = now;
  paint();
  if (staged) {
    // Paint twice, then tell the screenshot step the scene is ready.
    requestAnimationFrame(() => {
      paint();
      window.__shotReady = true;
    });
    staged = false;
  }
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
