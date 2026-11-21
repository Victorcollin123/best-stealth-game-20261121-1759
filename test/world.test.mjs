// Night Post — world tests. Plain node:assert, no framework.
// Run: node test/world.test.mjs (from the entry root).
import assert from 'node:assert';
import { createWorld, step, guardSees, segmentIntersectsRect, segmentNearPoint, circleHitsSolids } from '../game/src/world.js';
import { LEVEL } from '../game/src/level.js';
import { findPath, stageShot, NODES } from '../game/src/shots.js';

const DT = 1 / 60;
const tests = [];
function t(name, fn) {
  tests.push([name, fn]);
}

/** A world whose first guard stands still at (x, y), facing `facing`. */
function stillWorld(x, y, facing) {
  const world = createWorld(1);
  const g = world.guards[0];
  g.x = x;
  g.y = y;
  g.facing = facing;
  g.waypoints = [{ x, y }];
  g.waypointIndex = 0;
  g.pauseTimer = 5;
  g.state = 'patrol';
  g.suspicion = 0;
  return world;
}

t('fresh world starts playing with three guards and three letters', () => {
  const w = createWorld(1);
  assert.equal(w.status, 'playing');
  assert.equal(w.time, 0);
  assert.equal(w.lettersCollected, 0);
  assert.equal(w.guards.length, 3);
  assert.equal(w.letters.length, 3);
  assert.ok(w.letters.every((l) => !l.taken));
  assert.deepEqual({ x: w.player.x, y: w.player.y }, LEVEL.playerStart);
});

t('the same seed builds the same world', () => {
  const a = createWorld(7);
  const b = createWorld(7);
  a.guards.forEach((g, i) => {
    assert.equal(g.x, b.guards[i].x);
    assert.equal(g.y, b.guards[i].y);
    assert.equal(g.facing, b.guards[i].facing);
    assert.equal(g.waypointIndex, b.guards[i].waypointIndex);
  });
});

t('walls stop the courier', () => {
  const w = createWorld(1);
  w.player.x = 280;
  w.player.y = 150;
  for (let i = 0; i < 30; i++) step(w, { x: 1, y: 0, sneak: false }, DT);
  assert.ok(w.player.x > 280, 'courier moved east');
  assert.ok(w.player.x <= 286.5, `courier stopped at the wall, x=${w.player.x}`);
});

t('a guard sees the courier inside its cone', () => {
  const w = stillWorld(500, 360, 0); // facing east
  w.player.x = 600;
  w.player.y = 360;
  const seen = guardSees(w.guards[0], w.player);
  assert.equal(seen.visible, true);
  assert.equal(Math.round(seen.dist), 100);
});

t('a guard does not see the courier behind it', () => {
  const w = stillWorld(500, 360, 0); // facing east
  w.player.x = 400;
  w.player.y = 360;
  assert.equal(guardSees(w.guards[0], w.player).visible, false);
});

t('a guard does not see through a wall', () => {
  const w = stillWorld(500, 200, 0); // facing east, W3 between guard and courier
  w.player.x = 700;
  w.player.y = 200;
  assert.equal(guardSees(w.guards[0], w.player).visible, false);
});

t('a bush hides the courier beyond close-spotting range', () => {
  const w = stillWorld(180, 200, Math.PI / 2); // facing south, courier in bush B3
  w.player.x = 180;
  w.player.y = 340;
  const far = guardSees(w.guards[0], w.player);
  assert.equal(far.inBush, true);
  assert.equal(far.visible, false, 'hidden in the bush at 140 px');
  w.guards[0].y = 290; // 50 px away: inside close-spotting range
  const near = guardSees(w.guards[0], w.player);
  assert.equal(near.visible, true, 'spotted up close even in a bush');
});

t('suspicion rises while seen and falls when unseen', () => {
  const w = stillWorld(500, 360, 0);
  w.player.x = 600;
  w.player.y = 360;
  for (let i = 0; i < 30; i++) step(w, { x: 0, y: 0, sneak: false }, DT);
  const risen = w.guards[0].suspicion;
  assert.ok(risen > 0, `suspicion rose to ${risen}`);
  w.player.x = 80;
  w.player.y = 640; // far away, out of every cone
  for (let i = 0; i < 60; i++) step(w, { x: 0, y: 0, sneak: false }, DT);
  assert.ok(w.guards[0].suspicion < risen, 'suspicion decayed once unseen');
});

t('suspicion at 0.45 makes the guard investigate', () => {
  const w = stillWorld(500, 360, 0);
  w.player.x = 600;
  w.player.y = 360;
  w.guards[0].suspicion = 0.44;
  step(w, { x: 0, y: 0, sneak: false }, 0.1);
  assert.equal(w.guards[0].state, 'investigate');
});

t('suspicion at 1.0 makes the guard chase', () => {
  const w = stillWorld(500, 360, 0);
  w.player.x = 600;
  w.player.y = 360;
  w.guards[0].suspicion = 0.99;
  const spotted = w.timesSpotted;
  step(w, { x: 0, y: 0, sneak: false }, 0.1);
  assert.equal(w.guards[0].state, 'chase');
  assert.equal(w.timesSpotted, spotted + 1);
});

t('running footsteps draw a patrolling guard to investigate', () => {
  const w = stillWorld(400, 360, 0); // facing east; courier behind it
  w.player.x = 390;
  w.player.y = 360;
  assert.equal(guardSees(w.guards[0], w.player).visible, false);
  for (let i = 0; i < 36; i++) step(w, { x: -1, y: 0, sneak: false }, DT);
  assert.equal(w.guards[0].state, 'investigate');
});

t('three letters plus the gate wins the run', () => {
  const w = createWorld(1);
  for (const letter of LEVEL.letters) {
    w.player.x = letter.x;
    w.player.y = letter.y;
    step(w, { x: 0, y: 0, sneak: false }, DT);
  }
  assert.equal(w.lettersCollected, 3);
  w.player.x = LEVEL.exit.x + LEVEL.exit.w / 2;
  w.player.y = LEVEL.exit.y + LEVEL.exit.h / 2;
  step(w, { x: 0, y: 0, sneak: false }, DT);
  assert.equal(w.status, 'won');
  assert.ok(['Ghost', 'Shadow', 'Seen'].includes(w.rating));
});

t('a chasing guard touching the courier catches it', () => {
  const w = createWorld(1);
  const g = w.guards[0];
  g.x = 500;
  g.y = 360;
  g.facing = 0;
  g.state = 'chase';
  g.suspicion = 1;
  w.player.x = 520;
  w.player.y = 360;
  step(w, { x: 0, y: 0, sneak: false }, DT);
  assert.equal(w.status, 'caught');
});

t('segment and circle helpers behave', () => {
  const rect = { x: 100, y: 100, w: 50, h: 50 };
  assert.equal(segmentIntersectsRect(0, 125, 200, 125, rect), true, 'crossing');
  assert.equal(segmentIntersectsRect(0, 0, 200, 0, rect), false, 'parallel outside');
  assert.equal(segmentIntersectsRect(0, 0, 50, 50, rect), false, 'missing');
  assert.equal(segmentIntersectsRect(0, 125, 120, 125, rect), true, 'ending inside');
  assert.equal(segmentNearPoint(0, 0, 10, 0, 5, 3), 3, 'perpendicular distance');
  assert.equal(segmentNearPoint(0, 0, 10, 0, 20, 0), 10, 'clamped past the end');
  assert.equal(segmentNearPoint(0, 0, 10, 0, 5, 0), 0, 'on the segment');
  assert.equal(circleHitsSolids(310, 150, 14), true, 'inside wall W1');
  assert.equal(circleHitsSolids(200, 360, 14), false, 'open ground');
});

t('Wren patrols only the x=260 column', () => {
  const wren = LEVEL.guards[0];
  assert.equal(wren.name, 'Wren');
  assert.deepEqual(wren.waypoints, [
    { x: 260, y: 200 },
    { x: 260, y: 600 },
  ]);
  assert.equal(wren.speed, 70);
});

t('the start shot runs 5 s of patrolling', () => {
  const w = stageShot('start', 1);
  assert.ok(Math.abs(w.time - 5) < 0.01, `time=${w.time}`);
  assert.equal(w.status, 'playing');
  assert.equal(w.lettersCollected, 0);
});

t('the play shot collects letter 1', () => {
  const w = stageShot('play', 1);
  assert.equal(w.letters[0].taken, true);
  assert.ok(w.lettersCollected >= 1);
  assert.ok(w.time < 90, `time=${w.time}`);
});

t('the alert shot ends chasing, not caught', () => {
  const w = stageShot('alert', 1);
  assert.equal(w.status, 'playing');
  assert.ok(w.guards.some((g) => g.state === 'chase'), 'a guard is chasing');
});

t('the nav graph connects every node from the start', () => {
  for (let i = 0; i < NODES.length; i++) {
    assert.notEqual(findPath(12, i, []), null, `node ${i} unreachable`);
  }
});

t('the end staging collects at least 2 letters in under 150 s, deterministically', () => {
  const a = stageShot('end', 1);
  const b = stageShot('end', 1);
  assert.equal(a.lettersCollected, b.lettersCollected, 'same letters both runs');
  assert.equal(a.status, b.status, 'same ending both runs');
  assert.equal(a.time, b.time, 'same time both runs');
  assert.ok(a.lettersCollected >= 2, `only ${a.lettersCollected} letters (status ${a.status}, time ${a.time})`);
  assert.ok(a.time < 150, `time=${a.time}`);
});

// ---- run them all, report honestly, never abort on the first failure
let passed = 0;
for (const [name, fn] of tests) {
  try {
    fn();
    passed++;
    console.log(`pass - ${name}`);
  } catch (e) {
    console.log(`FAIL - ${name}: ${e.message}`);
  }
}
console.log(`${passed}/${tests.length} passed`);
if (passed !== tests.length) process.exit(1);
