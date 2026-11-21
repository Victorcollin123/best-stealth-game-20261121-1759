// Night Post — simulation tests. Plain node:assert, no test framework.
// Run: node test/world.test.mjs  (from game/ so the imports resolve)
import assert from 'node:assert';
import { mulberry32 } from '../game/src/random.js';
import { WALLS, CRATES, BUSHES, LAMPS, LETTERS, PLAYER_START, EXIT, GUARDS } from '../game/src/level.js';
import {
  createWorld, step, guardSees, dist, segmentHitsRect, segmentNearPoint,
  bushAt, lampAt, winRating,
} from '../game/src/world.js';
import { findPath, steerPoint, stageShot, NODES, createMemory } from '../game/src/shots.js';
import { PLAYER, GUARD } from '../game/src/config.js';

const DT = 1 / 60;
let n = 0;
function check(name, fn) {
  n += 1;
  fn();
  console.log(`ok ${n} - ${name}`);
}
function stepMany(world, input, seconds) {
  for (let i = 0; i < Math.round(seconds / DT); i++) step(world, input, DT);
}

// --- random ---
check('mulberry32 is deterministic for the same seed', () => {
  const a = mulberry32(7);
  const b = mulberry32(7);
  for (let i = 0; i < 20; i++) assert.strictEqual(a(), b());
});
check('mulberry32 stays in [0, 1)', () => {
  const rng = mulberry32(42);
  for (let i = 0; i < 1000; i++) {
    const v = rng();
    assert.ok(v >= 0 && v < 1);
  }
});
check('mulberry32 differs across seeds', () => {
  assert.notStrictEqual(mulberry32(1)(), mulberry32(2)());
});

// --- level ---
check('level has the border plus 7 interior walls', () => {
  assert.strictEqual(WALLS.length, 11);
});
check('level has 5 crates, 6 bushes, 4 lamps, 3 letters', () => {
  assert.strictEqual(CRATES.length, 5);
  assert.strictEqual(BUSHES.length, 6);
  assert.strictEqual(LAMPS.length, 4);
  assert.strictEqual(LETTERS.length, 3);
});
check('Wren patrols only the x=260 leg after the tweak', () => {
  const wren = GUARDS.find((g) => g.name === 'Wren');
  assert.deepStrictEqual(wren.waypoints, [{ x: 260, y: 200 }, { x: 260, y: 600 }]);
  assert.strictEqual(wren.speed, 70);
});
check('player starts at (80, 640) and the exit is top-right', () => {
  assert.deepStrictEqual(PLAYER_START, { x: 80, y: 640 });
  assert.ok(EXIT.x > 1100 && EXIT.y < 120);
});

// --- world basics ---
check('a fresh world is playing with 3 uncollected letters', () => {
  const w = createWorld(1);
  assert.strictEqual(w.status, 'playing');
  assert.strictEqual(w.lettersCollected, 0);
  assert.strictEqual(w.guards.length, 3);
  assert.strictEqual(w.player.x, 80);
  assert.strictEqual(w.player.y, 640);
});
check('the same seed gives the same guard start positions', () => {
  const a = createWorld(5);
  const b = createWorld(5);
  for (let i = 0; i < 3; i++) {
    assert.strictEqual(a.guards[i].x, b.guards[i].x);
    assert.strictEqual(a.guards[i].y, b.guards[i].y);
  }
});
check('stepping with no input leaves the courier still', () => {
  const w = createWorld(1);
  stepMany(w, { dx: 0, dy: 0, sneak: false }, 1);
  assert.strictEqual(w.player.x, 80);
  assert.strictEqual(w.player.y, 640);
  assert.ok(Math.abs(w.time - 1) < 1e-9);
});
check('walking covers more ground than sneaking in the same time', () => {
  const a = createWorld(1);
  const b = createWorld(1);
  stepMany(a, { dx: 1, dy: 0, sneak: false }, 1);
  stepMany(b, { dx: 1, dy: 0, sneak: true }, 1);
  assert.ok(a.player.x - 80 > b.player.x - 80);
  assert.ok(Math.abs(a.player.x - 80 - PLAYER.walkSpeed) < 2);
  assert.ok(Math.abs(b.player.x - 80 - PLAYER.sneakSpeed) < 2);
});
check('a wall stops the courier', () => {
  const w = createWorld(1);
  w.player.x = 280;
  w.player.y = 150;
  stepMany(w, { dx: 1, dy: 0, sneak: false }, 1);
  assert.ok(w.player.x < 300 - PLAYER.radius + 1);
});
check('a letter is picked up within 24 px', () => {
  const w = createWorld(1);
  w.player.x = LETTERS[0].x;
  w.player.y = LETTERS[0].y;
  step(w, { dx: 0, dy: 0, sneak: false }, DT);
  assert.strictEqual(w.lettersCollected, 1);
  assert.ok(w.letters[0].collected);
});
check('two identical worlds step identically (determinism)', () => {
  const a = createWorld(3);
  const b = createWorld(3);
  for (let i = 0; i < 600; i++) {
    const input = { dx: Math.sin(i / 30), dy: Math.cos(i / 40), sneak: i % 3 === 0 };
    step(a, input, DT);
    step(b, input, DT);
  }
  assert.strictEqual(a.player.x, b.player.x);
  assert.strictEqual(a.player.y, b.player.y);
  assert.strictEqual(a.guards[0].x, b.guards[0].x);
});

// --- vision ---
function guardFacingPlayer(guard, px, py) {
  guard.x = 400;
  guard.y = 360;
  guard.facing = Math.atan2(py - 360, px - 400);
  guard.baseFacing = guard.facing;
  return { x: px, y: py };
}
check('guardSees is true inside the cone with a clear line', () => {
  const w = createWorld(1);
  const g = w.guards[0];
  const p = guardFacingPlayer(g, 500, 360);
  assert.strictEqual(guardSees(g, p).visible, true);
});
check('guardSees is false outside the cone angle', () => {
  const w = createWorld(1);
  const g = w.guards[0];
  g.x = 400; g.y = 360; g.facing = 0; g.baseFacing = 0;
  assert.strictEqual(guardSees(g, { x: 400, y: 200 }).visible, false);
});
check('guardSees is false beyond vision range', () => {
  const w = createWorld(1);
  const g = w.guards[0];
  const p = guardFacingPlayer(g, 400 + GUARD.visionRange + 50, 360);
  assert.strictEqual(guardSees(g, p).visible, false);
});
check('guardSees is false through a wall', () => {
  const w = createWorld(1);
  const g = w.guards[0];
  // W3 (640,120,24,360) stands between (600,300) and (700,300).
  const p = guardFacingPlayer(g, 700, 300);
  g.x = 600; g.y = 300;
  g.facing = 0; g.baseFacing = 0;
  assert.strictEqual(guardSees(g, p).visible, false);
});
check('a bush hides the courier beyond the close-spotting range', () => {
  const w = createWorld(1);
  const g = w.guards[0];
  // B3 (180,340): stand in it, guard 100 px away facing the courier.
  const p = guardFacingPlayer(g, 180, 340);
  g.x = 280; g.y = 340;
  g.facing = Math.PI; g.baseFacing = Math.PI;
  const seen = guardSees(g, p);
  assert.strictEqual(seen.inBush, true);
  assert.strictEqual(seen.visible, false);
});
check('a bush does not hide the courier at close range', () => {
  const w = createWorld(1);
  const g = w.guards[0];
  const p = guardFacingPlayer(g, 180, 340);
  g.x = 220; g.y = 340;
  g.facing = Math.PI; g.baseFacing = Math.PI;
  assert.strictEqual(guardSees(g, p).visible, true);
});
check('segmentHitsRect: a parallel segment outside the rect is a MISS', () => {
  assert.strictEqual(segmentHitsRect(0, 0, 100, 0, { x: 40, y: 10, w: 20, h: 20 }), false);
  assert.strictEqual(segmentHitsRect(0, 0, 100, 0, { x: 40, y: -10, w: 20, h: 20 }), true);
});
check('segmentNearPoint clamps t to the segment', () => {
  const r = segmentNearPoint(0, 0, 10, 0, 20, 0);
  assert.strictEqual(r.t, 1);
  assert.strictEqual(r.dist, 10);
});

// --- suspicion ---
check('suspicion rises while seen and decays when hidden', () => {
  const w = createWorld(1);
  const g = w.guards[0];
  g.x = 400; g.y = 360; g.facing = 0; g.baseFacing = 0;
  g.state = 'pause'; g.pauseTimer = 99;
  w.player.x = 500; w.player.y = 360;
  step(w, { dx: 0, dy: 0, sneak: false }, DT);
  const up = g.suspicion;
  assert.ok(up > 0);
  w.player.x = 80; w.player.y = 640;
  stepMany(w, { dx: 0, dy: 0, sneak: false }, 1);
  assert.ok(g.suspicion < up);
});
check('a guard investigates at 0.45 suspicion and chases at 1.0', () => {
  const w = createWorld(1);
  const g = w.guards[0];
  g.suspicion = 0.5;
  step(w, { dx: 0, dy: 0, sneak: false }, DT);
  assert.strictEqual(g.state, 'investigate');
  g.suspicion = 1.0;
  step(w, { dx: 0, dy: 0, sneak: false }, DT);
  assert.strictEqual(g.state, 'chase');
  assert.strictEqual(w.timesSpotted, 1);
});
check('a chasing guard that gets within 26 px catches the courier', () => {
  const w = createWorld(1);
  const g = w.guards[0];
  g.state = 'chase';
  g.x = w.player.x + 20;
  g.y = w.player.y;
  step(w, { dx: 0, dy: 0, sneak: false }, DT);
  assert.strictEqual(w.status, 'caught');
});
check('running footsteps draw a patrolling guard to investigate', () => {
  const w = createWorld(1);
  const g = w.guards[0];
  g.x = w.player.x + 80;
  g.y = w.player.y;
  g.state = 'patrol';
  stepMany(w, { dx: 1, dy: 0, sneak: false }, 1.2);
  assert.strictEqual(g.state, 'investigate');
});

// --- win / lose ---
check('reaching the gate without all letters does not win', () => {
  const w = createWorld(1);
  w.player.x = 1206;
  w.player.y = 86;
  step(w, { dx: 0, dy: 0, sneak: false }, DT);
  assert.strictEqual(w.status, 'playing');
});
check('three letters plus the gate wins the run', () => {
  const w = createWorld(1);
  for (const l of w.letters) l.collected = true;
  w.lettersCollected = 3;
  w.player.x = 1206;
  w.player.y = 86;
  step(w, { dx: 0, dy: 0, sneak: false }, DT);
  assert.strictEqual(w.status, 'won');
});
check('winRating is Ghost / Shadow / Seen by times spotted', () => {
  const w = createWorld(1);
  assert.strictEqual(winRating(w), 'Ghost');
  w.timesSpotted = 1;
  assert.strictEqual(winRating(w), 'Shadow');
  w.timesSpotted = 3;
  assert.strictEqual(winRating(w), 'Seen');
});

// --- autopilot ---
check('findPath joins the start node to the letter-1 node', () => {
  const path = findPath(12, 0, []);
  assert.ok(Array.isArray(path));
  assert.strictEqual(path[0], 12);
  assert.strictEqual(path[path.length - 1], 0);
});
check('steerPoint returns the target directly when the way is clear', () => {
  const mem = createMemory();
  const dest = steerPoint({ x: 80, y: 640 }, { x: 180, y: 640 }, mem, DT, []);
  assert.deepStrictEqual(dest, { x: 180, y: 640 });
});
check('the start shot is 5 s of patrolling with no letters', () => {
  const w = stageShot('start', 1);
  assert.strictEqual(w.status, 'playing');
  assert.strictEqual(w.lettersCollected, 0);
  assert.ok(Math.abs(w.time - 5) < 1e-9);
});
check('the play shot sneaks to letter 1', () => {
  const w = stageShot('play', 1);
  assert.strictEqual(w.lettersCollected, 1);
  assert.strictEqual(w.status, 'playing');
});
check('the alert shot ends mid-chase with the courier alive', () => {
  const w = stageShot('alert', 1);
  assert.strictEqual(w.status, 'playing');
  assert.ok(w.guards.some((g) => g.state === 'chase'));
});
check('the end shot on seed 1 ends caught with 1 letter (honest outcome)', () => {
  const w = stageShot('end', 1);
  assert.strictEqual(w.status, 'caught');
  assert.strictEqual(w.lettersCollected, 1);
});
check('the end shot is deterministic across two stagings', () => {
  const a = stageShot('end', 1);
  const b = stageShot('end', 1);
  assert.strictEqual(a.status, b.status);
  assert.strictEqual(a.lettersCollected, b.lettersCollected);
  assert.strictEqual(a.time, b.time);
});
check('the autopilot wins on no seed in 1–40', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const w = stageShot('end', seed);
    assert.notStrictEqual(w.status, 'won', `seed ${seed} won`);
  }
});

console.log(`\n${n} tests passed`);
