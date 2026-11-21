// Night Post: unit tests for the simulation and the screenshot autopilot. Plain
// Node, no framework: `node test/world.test.mjs` from the entry root. Every test
// builds its own world, so they run in any order and none depends on another.

import assert from 'node:assert/strict';
import { createWorld, step, guardSees, segmentBlocked, circleHitsAny } from '../game/src/world.js';
import { stageShot, findPath, NAV_NODES, segmentClear } from '../game/src/shots.js';
import { LEVEL } from '../game/src/level.js';

const STILL = { x: 0, y: 0, sneak: false };
let passed = 0;

function test(name, fn) {
  fn();
  passed += 1;
  console.log(`ok - ${name}`);
}

function stepN(world, input, seconds) {
  const steps = Math.round(seconds * 60);
  for (let i = 0; i < steps; i += 1) step(world, input, 1 / 60);
}

function parkGuards(world, x = 1200, y = 650) {
  for (const guard of world.guards) {
    guard.x = x;
    guard.y = y;
    guard.state = 'patrol';
    guard.suspicion = 0;
  }
}

/** Pin a guard in place, facing `angle`, so a test watches only its suspicion and state. */
function pinGuard(guard, x, y, angle) {
  guard.x = x;
  guard.y = y;
  guard.angle = angle;
  guard.waypoints = [{ x: x + Math.cos(angle) * 100, y: y + Math.sin(angle) * 100 }];
  guard.waypointIndex = 0;
  guard.patrolSpeed = 0;
  guard.state = 'patrol';
  guard.suspicion = 0;
}

test('a fresh world starts playing with three guards and three letters', () => {
  const world = createWorld(1);
  assert.equal(world.status, 'playing');
  assert.equal(world.guards.length, 3);
  assert.equal(world.letters.length, 3);
  assert.equal(world.lettersCollected, 0);
  assert.equal(world.player.x, LEVEL.playerStart.x);
  assert.equal(world.player.y, LEVEL.playerStart.y);
});

test('the same seed builds the same world twice', () => {
  const a = createWorld(7);
  const b = createWorld(7);
  assert.deepEqual(
    a.guards.map((g) => [g.x, g.y, g.angle]),
    b.guards.map((g) => [g.x, g.y, g.angle]),
  );
});

test('walls stop the courier', () => {
  const world = createWorld(1);
  world.player.x = 40;
  world.player.y = 360;
  stepN(world, { x: -1, y: 0, sneak: false }, 2);
  assert.ok(world.player.x >= 37.9, `courier crossed the west wall: x=${world.player.x}`);
  assert.ok(world.player.x <= 40.1);
});

test('a guard sees the courier straight ahead with a clear line of sight', () => {
  const world = createWorld(1);
  const guard = world.guards[0];
  guard.x = 400;
  guard.y = 400;
  guard.angle = 0;
  world.player.x = 500;
  world.player.y = 400;
  assert.equal(guardSees(guard, world.player).visible, true);
});

test('a guard does not see the courier behind it', () => {
  const world = createWorld(1);
  const guard = world.guards[0];
  guard.x = 400;
  guard.y = 400;
  guard.angle = 0;
  world.player.x = 300;
  world.player.y = 400;
  assert.equal(guardSees(guard, world.player).visible, false);
});

test('a wall between guard and courier blocks the sight line', () => {
  const world = createWorld(1);
  const guard = world.guards[0];
  guard.x = 400;
  guard.y = 400;
  guard.angle = 0;
  world.player.x = 700;
  world.player.y = 400;
  assert.equal(guardSees(guard, world.player).visible, false);
});

test('a bush hides the courier beyond close range, but not up close', () => {
  const world = createWorld(1);
  const guard = world.guards[0];
  // The bush at (180, 340); the lane north from (180, 440) is clear of walls and crates.
  guard.x = 180;
  guard.y = 440;
  guard.angle = -Math.PI / 2;
  // In the bush, 80px away: hidden.
  world.player.x = 180;
  world.player.y = 360;
  assert.equal(guardSees(guard, world.player).visible, false);
  // Out of the bush, 40px away: spotted.
  world.player.x = 180;
  world.player.y = 400;
  assert.equal(guardSees(guard, world.player).visible, true);
});

test('suspicion rises while the courier is seen and falls while hidden', () => {
  const world = createWorld(1);
  const guard = world.guards[0];
  pinGuard(guard, 400, 400, 0);
  world.player.x = 500;
  world.player.y = 400;
  stepN(world, STILL, 1);
  assert.ok(guard.suspicion > 0.5, `suspicion did not rise: ${guard.suspicion}`);
  world.player.x = 300;
  world.player.y = 400;
  stepN(world, STILL, 2.5);
  assert.ok(guard.suspicion < 0.2, `suspicion did not fall: ${guard.suspicion}`);
});

test('a guard investigates at half suspicion and chases at full suspicion', () => {
  const world = createWorld(1);
  const guard = world.guards[0];
  pinGuard(guard, 400, 400, 0);
  world.player.x = 500;
  world.player.y = 400;
  stepN(world, STILL, 0.6);
  assert.equal(guard.state, 'investigate');
  assert.equal(world.timesSpotted, 0);
  stepN(world, STILL, 1.5);
  assert.equal(guard.state, 'chase');
  assert.equal(world.timesSpotted, 1);
});

test('running footsteps draw a patrolling guard to investigate', () => {
  const world = createWorld(1);
  const guard = world.guards[0];
  pinGuard(guard, 400, 400, 0);
  world.player.x = 340;
  world.player.y = 400;
  stepN(world, { x: -1, y: 0, sneak: false }, 0.6);
  assert.equal(guard.state, 'investigate');
});

test('collecting the letters and reaching the gate wins the run', () => {
  const world = createWorld(1);
  parkGuards(world);
  for (const letter of LEVEL.letters) {
    world.player.x = letter.x;
    world.player.y = letter.y;
    step(world, STILL);
  }
  assert.equal(world.lettersCollected, 3);
  world.player.x = LEVEL.exit.x + LEVEL.exit.w / 2;
  world.player.y = LEVEL.exit.y + LEVEL.exit.h / 2;
  step(world, STILL);
  assert.equal(world.status, 'won');
  assert.ok(world.winTime > 0);
});

test('a chasing guard that touches the courier ends the run', () => {
  const world = createWorld(1);
  const guard = world.guards[0];
  guard.state = 'chase';
  guard.x = world.player.x + 20;
  guard.y = world.player.y;
  step(world, STILL);
  assert.equal(world.status, 'caught');
});

test('the segment and circle helpers agree with the level', () => {
  assert.equal(segmentBlocked(0, 360, 1280, 360), true);
  assert.equal(segmentBlocked(100, 100, 200, 100), false);
  assert.equal(circleHitsAny(12, 360, 14), true);
  assert.equal(circleHitsAny(640, 360, 14), true);
  assert.equal(circleHitsAny(600, 360, 14), false);
});

test('Wren patrols the east leg of the west room, clear of letter 1', () => {
  // The finish tweak: Wren walks up and down x=260 only, so the courier's walk
  // north to letter 1 at (150,120) never meets her head-on in the narrow west column.
  const wren = LEVEL.guards.find((g) => g.name === 'Wren');
  assert.deepEqual(wren.waypoints, [
    { x: 260, y: 200 },
    { x: 260, y: 600 },
  ]);
});

test('the start shot stages five seconds of patrolling', () => {
  const { world, seconds } = stageShot('start', 1);
  assert.equal(world.status, 'playing');
  assert.equal(seconds, 5);
  assert.ok(Math.abs(world.time - 5) < 0.01, `time after five seconds: ${world.time}`);
});

test('the play shot collects the first letter', () => {
  const { world, seconds } = stageShot('play', 1);
  assert.ok(world.lettersCollected >= 1, `no letter in ${seconds}s`);
});

test('the alert shot ends with a guard chasing, not a caught courier', () => {
  const { world } = stageShot('alert', 1);
  assert.equal(world.status, 'playing');
  assert.ok(world.guards.some((guard) => guard.state === 'chase'), 'no guard chased');
});

test('the navigation graph connects every open point with walkable legs', () => {
  const byId = new Map(NAV_NODES.map((node) => [node.id, node]));
  for (const from of NAV_NODES) {
    for (const to of NAV_NODES) {
      const path = findPath(from.id, to.id);
      assert.ok(path.length >= 1, `no path ${from.id} -> ${to.id}`);
      assert.equal(path[0], from.id);
      assert.equal(path[path.length - 1], to.id);
      for (let i = 0; i + 1 < path.length; i += 1) {
        const a = byId.get(path[i]);
        const b = byId.get(path[i + 1]);
        assert.ok(segmentClear(a.x, a.y, b.x, b.y), `leg ${path[i]} -> ${path[i + 1]} is blocked`);
      }
    }
  }
});

test('the autopilot plays the full route on seed 1 (no win frame is claimed)', () => {
  // The scripted courier does not win the full run on any seed in 1–200, even
  // after Wren's patrol moved east — so the entry ships three screenshots and
  // no end shot. What this test pins down is that the staging plays the whole
  // route honestly: it collects at least two letters before the run ends, and
  // it ends the same way every time (see the determinism test below).
  const { world, seconds } = stageShot('end', 1);
  assert.ok(world.lettersCollected >= 2, `only ${world.lettersCollected} letters in ${seconds}s`);
  assert.ok(seconds < 150, `run took ${seconds}s`);
  console.log(`    (autopilot ends ${world.status} with ${world.lettersCollected}/3 letters in ${seconds.toFixed(1)}s)`);
});

test('staging the same shot twice gives the same ending', () => {
  const a = stageShot('end', 1);
  const b = stageShot('end', 1);
  assert.equal(a.world.winTime, b.world.winTime);
  assert.equal(a.world.player.x, b.world.player.x);
  assert.equal(a.world.player.y, b.world.player.y);
});

console.log(`\n${passed} tests passed`);
