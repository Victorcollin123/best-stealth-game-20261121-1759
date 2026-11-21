// Night Post — tests. Plain node:assert, run with:
//   node test/world.test.mjs

import assert from 'node:assert';
import { mulberry32 } from '../game/src/random.js';
import {
  createWorld,
  step,
  guardSees,
  seenAt,
  segmentHitsRect,
  segmentClearOfWalls,
  pointInBush,
  dist,
} from '../game/src/world.js';
import {
  NODES,
  findPath,
  cautiousStep,
  freshMemory,
  runUntil,
  stageShot,
} from '../game/src/shots.js';

const tests = [];
function test(name, fn) {
  tests.push([name, fn]);
}

function withGuardAt(world, gi, x, y, facing) {
  const g = world.guards[gi];
  g.x = x;
  g.y = y;
  g.facing = facing;
  g.baseFacing = facing;
  return g;
}

function withPlayerAt(world, x, y) {
  world.player.x = x;
  world.player.y = y;
  return world.player;
}

test('mulberry32 is deterministic per seed', () => {
  const a = mulberry32(1);
  const b = mulberry32(1);
  for (let i = 0; i < 10; i++) assert.strictEqual(a(), b());
});

test('mulberry32 differs across seeds', () => {
  const a = mulberry32(1);
  const b = mulberry32(2);
  let same = true;
  for (let i = 0; i < 10; i++) if (a() !== b()) same = false;
  assert.strictEqual(same, false);
});

test('createWorld is deterministic for the same seed', () => {
  const a = createWorld(1);
  const b = createWorld(1);
  assert.deepStrictEqual(
    a.guards.map((g) => [g.x, g.y, g.wp]),
    b.guards.map((g) => [g.x, g.y, g.wp]),
  );
});

test('different seeds offset guard starts', () => {
  const a = createWorld(1);
  const b = createWorld(2);
  const same = a.guards.every((g, i) => g.x === b.guards[i].x && g.y === b.guards[i].y);
  assert.strictEqual(same, false);
});

test('player moves right with input', () => {
  const w = createWorld(1);
  step(w, { x: 1, y: 0, sneak: false }, 1 / 60);
  assert.ok(w.player.x > 80);
  assert.strictEqual(w.player.y, 640);
});

test('player does not move without input', () => {
  const w = createWorld(1);
  step(w, { x: 0, y: 0, sneak: false }, 1);
  assert.strictEqual(w.player.x, 80);
  assert.strictEqual(w.player.y, 640);
});

test('wall W1 blocks the courier', () => {
  const w = createWorld(1);
  withPlayerAt(w, 280, 100);
  for (let i = 0; i < 60; i++) step(w, { x: 1, y: 0, sneak: false }, 1 / 60);
  assert.ok(w.player.x > 280, 'courier moved east');
  assert.ok(w.player.x <= 286.5, `courier stopped at the wall, x=${w.player.x}`);
});

test('letter pickup within 24 px', () => {
  const w = createWorld(1);
  withPlayerAt(w, 150, 120);
  step(w, { x: 0, y: 0, sneak: false }, 1 / 60);
  assert.strictEqual(w.lettersCollected, 1);
  assert.strictEqual(w.letters[0].collected, true);
});

test('exit does not win without all letters', () => {
  const w = createWorld(1);
  withPlayerAt(w, 1206, 86);
  step(w, { x: 0, y: 0, sneak: false }, 1 / 60);
  assert.strictEqual(w.status, 'playing');
});

test('win with all letters at the exit', () => {
  const w = createWorld(1);
  for (const l of w.letters) l.collected = true;
  w.lettersCollected = 3;
  withPlayerAt(w, 1206, 86);
  step(w, { x: 0, y: 0, sneak: false }, 1 / 60);
  assert.strictEqual(w.status, 'won');
  assert.strictEqual(w.rating, 'Ghost');
});

test('guard sees the courier in its cone, line of sight clear', () => {
  const w = createWorld(1);
  const g = withGuardAt(w, 0, 500, 360, 0);
  const s = guardSees(g, 600, 360, false);
  assert.strictEqual(s.visible, true);
});

test('guard does not see through a wall', () => {
  const w = createWorld(1);
  const g = withGuardAt(w, 0, 200, 200, 0);
  const s = guardSees(g, 400, 200, false);
  assert.strictEqual(s.visible, false);
});

test('guard does not see outside its cone', () => {
  const w = createWorld(1);
  const g = withGuardAt(w, 0, 500, 360, 0);
  const s = guardSees(g, 500, 200, false);
  assert.strictEqual(s.visible, false);
});

test('guard does not see beyond 230 px', () => {
  const w = createWorld(1);
  const g = withGuardAt(w, 0, 500, 360, 0);
  const s = guardSees(g, 800, 360, false);
  assert.strictEqual(s.visible, false);
});

test('bush hides the courier beyond 55 px', () => {
  const w = createWorld(1);
  const g = withGuardAt(w, 0, 180, 200, Math.PI / 2);
  assert.strictEqual(pointInBush(180, 340), true);
  const s = guardSees(g, 180, 340, false);
  assert.strictEqual(s.visible, false);
});

test('bush does not hide within 55 px', () => {
  const w = createWorld(1);
  const g = withGuardAt(w, 0, 180, 300, Math.PI / 2);
  const s = guardSees(g, 180, 340, false);
  assert.strictEqual(s.visible, true);
});

test('suspicion rises while seen', () => {
  const w = createWorld(1);
  const g = withGuardAt(w, 0, 500, 360, 0);
  // Keep the guard facing the courier: patrol toward the courier, speed 0.
  g.patrol = [[600, 360]];
  g.wp = 0;
  g.speed = 0;
  withPlayerAt(w, 600, 360);
  for (let i = 0; i < 30; i++) step(w, { x: 0, y: 0, sneak: false }, 1 / 60);
  assert.ok(w.guards[0].suspicion > 0.4, `suspicion=${w.guards[0].suspicion}`);
});

test('suspicion decays when unseen', () => {
  const w = createWorld(1);
  const g = withGuardAt(w, 0, 500, 360, Math.PI);
  g.suspicion = 0.8;
  withPlayerAt(w, 600, 360);
  for (let i = 0; i < 60; i++) step(w, { x: 0, y: 0, sneak: false }, 1 / 60);
  assert.ok(w.guards[0].suspicion < 0.8, `suspicion=${w.guards[0].suspicion}`);
});

test('suspicion 0.45 investigates, 1.0 chases and counts a spotting', () => {
  const w = createWorld(1);
  const g = withGuardAt(w, 0, 500, 360, 0);
  // Keep the guard facing the courier and standing still: patrol toward
  // the courier at speed 0, so it watches without ever reaching them.
  g.patrol = [[600, 360]];
  g.wp = 0;
  g.speed = 0;
  withPlayerAt(w, 600, 360);
  let investigated = false;
  let chased = false;
  for (let i = 0; i < 120; i++) {
    step(w, { x: 0, y: 0, sneak: false }, 1 / 60);
    if (w.guards[0].state === 'investigate') investigated = true;
    if (w.guards[0].state === 'chase') chased = true;
    if (chased) break;
  }
  assert.strictEqual(investigated, true);
  assert.strictEqual(chased, true);
  assert.strictEqual(w.timesSpotted, 1);
});

test('chase loses sight after 3 s unseen and falls back to investigate', () => {
  const w = createWorld(1);
  const g = withGuardAt(w, 0, 400, 200, Math.PI);
  g.state = 'chase';
  g.suspicion = 1;
  g.lastSeen = { x: 400, y: 200 };
  withPlayerAt(w, 200, 200);
  for (let i = 0; i < 240; i++) step(w, { x: 0, y: 0, sneak: false }, 1 / 60);
  assert.strictEqual(w.guards[0].state, 'investigate');
});

test('noise draws a patrolling guard to the sound', () => {
  const w = createWorld(1);
  const g = withGuardAt(w, 0, 500, 360, 0);
  // Courier 80 px north of the guard, outside the east-facing cone,
  // running west — loud enough to hear, never seen.
  withPlayerAt(w, 500, 280);
  assert.strictEqual(guardSees(g, 500, 280, false).visible, false);
  for (let i = 0; i < 40; i++) {
    step(w, { x: -1, y: 0, sneak: false }, 1 / 60);
  }
  assert.strictEqual(w.guards[0].state, 'investigate');
});

test('a chasing guard within 26 px catches the courier', () => {
  const w = createWorld(1);
  const g = withGuardAt(w, 0, 500, 360, 0);
  g.state = 'chase';
  g.suspicion = 1;
  withPlayerAt(w, 520, 360);
  step(w, { x: 0, y: 0, sneak: false }, 1 / 60);
  assert.strictEqual(w.status, 'caught');
});

test('guard pauses at a waypoint and scans', () => {
  const w = createWorld(1);
  const g = w.guards[0];
  g.x = 260;
  g.y = 200;
  g.pause = 0.5;
  g.baseFacing = 0;
  g.facing = 0;
  step(w, { x: 0, y: 0, sneak: false }, 0.4);
  assert.strictEqual(g.x, 260);
  assert.strictEqual(g.y, 200);
  assert.ok(g.facing !== 0, 'guard scanned while pausing');
});

test('segmentHitsRect: parallel-outside is a miss, through is a hit', () => {
  const r = { x: 100, y: 100, w: 50, h: 50 };
  assert.strictEqual(segmentHitsRect(0, 90, 200, 90, r), false);
  assert.strictEqual(segmentHitsRect(0, 120, 200, 120, r), true);
});

test('findPath links letter 1 to the exit; steerPoint goes direct when clear', () => {
  const w = createWorld(1);
  const path = findPath(0, 3, []);
  assert.ok(Array.isArray(path) && path.length > 1);
  assert.strictEqual(path[0], 0);
  assert.strictEqual(path[path.length - 1], 3);
  const mem = freshMemory(w);
  const sp = (function steer() {
    const from = { x: 500, y: 360 };
    const target = { x: 600, y: 360 };
    if (segmentClearOfWalls(from.x, from.y, target.x, target.y, 14)) return target;
    return null;
  })();
  assert.deepStrictEqual(sp, { x: 600, y: 360 });
});

test('runUntil reaches a near target', () => {
  const w = createWorld(1);
  runUntil(w, [{ x: 150, y: 120 }], (ww) => ww.letters[0].collected, 60);
  assert.strictEqual(w.letters[0].collected, true);
});

test("stageShot('start', 1) is playing after 5 s", () => {
  const w = stageShot('start', 1);
  assert.strictEqual(w.status, 'playing');
  assert.ok(Math.abs(w.time - 5) < 0.01, `time=${w.time}`);
  assert.strictEqual(w.lettersCollected, 0);
});

test("stageShot('play', 1) collects letter 1 unseen", () => {
  const w = stageShot('play', 1);
  assert.strictEqual(w.status, 'playing');
  assert.strictEqual(w.lettersCollected, 1);
  assert.strictEqual(w.timesSpotted, 0);
});

test("stageShot('alert', 1) ends mid-chase, courier alive", () => {
  const w = stageShot('alert', 1);
  assert.strictEqual(w.status, 'playing');
  assert.strictEqual(w.timesSpotted, 1);
  assert.ok(w.guards.some((g) => g.state === 'chase'));
});

test("stageShot('end', 1) is deterministic and honestly ends caught with 1 letter", () => {
  const a = stageShot('end', 1);
  const b = stageShot('end', 1);
  assert.strictEqual(a.status, b.status);
  assert.strictEqual(a.lettersCollected, b.lettersCollected);
  assert.strictEqual(a.status, 'caught');
  assert.strictEqual(a.lettersCollected, 1);
});

let pass = 0;
let fail = 0;
for (const [name, fn] of tests) {
  try {
    fn();
    pass++;
    console.log(`ok - ${name}`);
  } catch (e) {
    fail++;
    console.log(`FAIL - ${name}: ${e.message}`);
  }
}
console.log(`${pass}/${pass + fail} pass`);
if (fail) process.exit(1);
