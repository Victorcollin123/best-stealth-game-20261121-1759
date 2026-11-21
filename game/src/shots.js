// Night Post: the screenshot scenes. Each shot plays the real rules forward from a fresh
// world (seed 1) with a scripted courier, so every screenshot is a genuine frame of the
// game, not a mock-up. The courier is cautious: it sneaks near guards, waits when the
// next step would cross a vision cone, and retreats to the safest bush when a guard
// grows suspicious. The same steering drives the "end" shot to a real win.

import { STEP } from './config.js';
import { LEVEL } from './level.js';
import { createWorld, step, guardSees, segmentHitsRect, SOLIDS } from './world.js';

/** The shots, in the order they are listed (the first by name is the cover). The end shot
 *  is not one of them: the scripted courier does not win the full run on any seed in
 *  1–200, so there is no honest win frame to show — the entry ships three screenshots. */
export const SHOTS = [
  { name: '1-start.jpg', query: '?shot=start&seed=1' },
  { name: '2-play.jpg', query: '?shot=play&seed=1' },
  { name: '3-alert.jpg', query: '?shot=alert&seed=1' },
];

/** Open points across the courtyard: the letters, the gate, the gaps between walls, the
 *  bushes, and the corridor midpoints. Every point stands clear of every wall and crate. */
export const NAV_NODES = [
  { id: 'start', x: 80, y: 640 },
  { id: 'letter1', x: 150, y: 120 },
  { id: 'letter2', x: 1140, y: 620 },
  { id: 'letter3', x: 760, y: 80 },
  { id: 'exit', x: 1206, y: 86 },
  { id: 'westGap', x: 312, y: 360 },
  { id: 'westSouth', x: 150, y: 600 },
  { id: 'midSouth', x: 500, y: 360 },
  { id: 'midNorth', x: 600, y: 200 },
  { id: 'midGap', x: 652, y: 60 },
  { id: 'eastNorth', x: 900, y: 80 },
  { id: 'eastGap', x: 972, y: 100 },
  { id: 'eastMid', x: 1060, y: 300 },
  { id: 'eastSouth', x: 1140, y: 300 },
  { id: 'bush1', x: 430, y: 60 },
  { id: 'bush2', x: 760, y: 200 },
  { id: 'bush3', x: 180, y: 340 },
  { id: 'bush4', x: 560, y: 620 },
  { id: 'bush5', x: 1100, y: 340 },
  { id: 'bush6', x: 880, y: 620 },
  { id: 'southMid', x: 500, y: 620 },
  { id: 'southEast', x: 800, y: 620 },
];

/** True when a courier (radius 14) can walk the straight segment without touching a wall. */
export function segmentClear(ax, ay, bx, by) {
  for (const rect of SOLIDS) {
    const inflated = { x: rect.x - 14, y: rect.y - 14, w: rect.w + 28, h: rect.h + 28 };
    if (segmentHitsRect(ax, ay, bx, by, inflated)) return false;
  }
  return true;
}

function nodeById(id) {
  return NAV_NODES.find((node) => node.id === id);
}

/** The closest node the courier can walk straight to from (x, y). */
function nearestNode(x, y) {
  let best = null;
  let bestDistance = Infinity;
  for (const node of NAV_NODES) {
    const d = Math.hypot(node.x - x, node.y - y);
    if (d < bestDistance && segmentClear(x, y, node.x, node.y)) {
      bestDistance = d;
      best = node;
    }
  }
  if (!best) {
    for (const node of NAV_NODES) {
      const d = Math.hypot(node.x - x, node.y - y);
      if (d < bestDistance) {
        bestDistance = d;
        best = node;
      }
    }
  }
  return best;
}

/** True when the segment passes within `radius` of the point (px, py). */
function segmentNearPoint(ax, ay, bx, by, px, py, radius) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  let t = lengthSq === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / lengthSq;
  t = Math.max(0, Math.min(1, t));
  const closestX = ax + t * dx;
  const closestY = ay + t * dy;
  return Math.hypot(px - closestX, py - closestY) < radius;
}

/**
 * The shortest route between two nodes, as a list of node ids (breadth-first search).
 * `avoid` is a list of { x, y, r } points the route must keep clear of — the guards'
 * current positions while fleeing, so the escape route does not run past a guard.
 * Returns null when no route exists. */
export function findPath(fromId, toId, avoid = []) {
  if (fromId === toId) return [fromId];
  const edgeClear = (a, b) => {
    if (!segmentClear(a.x, a.y, b.x, b.y)) return false;
    for (const point of avoid) {
      if (segmentNearPoint(a.x, a.y, b.x, b.y, point.x, point.y, point.r)) return false;
    }
    return true;
  };
  const prev = new Map([[fromId, null]]);
  const queue = [fromId];
  while (queue.length > 0) {
    const current = queue.shift();
    const currentNode = nodeById(current);
    for (const next of NAV_NODES) {
      if (next.id === current || prev.has(next.id)) continue;
      if (!edgeClear(currentNode, next)) continue;
      prev.set(next.id, current);
      if (next.id === toId) {
        const path = [toId];
        let step = toId;
        while (prev.get(step) !== null) {
          step = prev.get(step);
          path.unshift(step);
        }
        return path;
      }
      queue.push(next.id);
    }
  }
  return null;
}

/**
 * The next point to steer for on the way to `target`: the target itself when the courier
 * can walk straight to it, otherwise the next node on the graph route there. The route
 * is recomputed when the target changes, when the path runs out, or — while `avoid` is
 * given — every half second, because the guards it routes around keep moving. This is
 * what keeps the courier out of wall corners: it follows clear corridors instead of
 * pushing straight through solid cover.
 */
function steerPoint(world, target, memory, avoid = []) {
  const player = world.player;
  const directClear =
    segmentClear(player.x, player.y, target.x, target.y) &&
    !avoid.some((point) => segmentNearPoint(player.x, player.y, target.x, target.y, point.x, point.y, point.r));
  if (directClear) {
    memory.path = null;
    return target;
  }
  const stale =
    !memory.path ||
    memory.pathTarget !== target ||
    memory.pathIndex >= memory.path.length ||
    (avoid.length > 0 && world.time - (memory.pathTime || 0) > 0.5);
  if (stale) {
    const from = nearestNode(player.x, player.y);
    const to = nearestNode(target.x, target.y);
    // A guard-clear route first; the wall-only route when no guard-clear one exists
    // (a guard standing on the only exit must not leave the courier routeless).
    let ids = findPath(from.id, to.id, avoid);
    if (!ids) ids = findPath(from.id, to.id);
    if (!ids) ids = [from.id, to.id];
    memory.path = ids.map((id) => nodeById(id));
    memory.path.push(target);
    memory.pathTarget = target;
    memory.pathIndex = 0;
    memory.pathTime = world.time;
  }
  while (
    memory.pathIndex < memory.path.length &&
    Math.hypot(memory.path[memory.pathIndex].x - player.x, memory.path[memory.pathIndex].y - player.y) < 24
  ) {
    memory.pathIndex += 1;
  }
  return memory.path[Math.min(memory.pathIndex, memory.path.length - 1)];
}

function nearestBush(x, y) {
  let best = null;
  let bestDistance = Infinity;
  for (const bush of LEVEL.bushes) {
    const d = Math.hypot(bush.x - x, bush.y - y);
    if (d < bestDistance) {
      bestDistance = d;
      best = bush;
    }
  }
  return best;
}

function maxSuspicion(world) {
  return Math.max(...world.guards.map((guard) => guard.suspicion));
}

/** True when any guard would see a courier standing at (x, y) right now. A guard pausing
 *  at a waypoint sweeps its cone around as it looks about, so the whole sweep counts as
 *  seen — a probe that is clear this instant can be in the cone half a second later. */
function seenAt(world, x, y) {
  for (const guard of world.guards) {
    if (guardSees(guard, { x, y }).visible) return true;
    if (guard.pauseTimer > 0) {
      for (const offset of [-0.8, 0.8]) {
        if (guardSees({ ...guard, angle: guard.angle + offset }, { x, y }).visible) return true;
      }
    }
  }
  return false;
}

function moveToward(world, target, sneak) {
  const player = world.player;
  const dx = target.x - player.x;
  const dy = target.y - player.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 6) return { x: 0, y: 0, sneak };
  return { x: dx / dist, y: dy / dist, sneak };
}

/**
 * One step of the cautious courier, heading for `target`. It flees away from a guard
 * that chases or grows suspicious, hides when the heat is on, and waits rather than
 * walking into a cone — detouring to a bush if the wait drags on. If it ever pushes
 * against a wall corner without moving, it breaks for the nearest bush instead: a
 * wedged courier is a caught courier. `options.brave` skips the personal-space rule:
 * the alert shot stands its ground on purpose, to be spotted.
 */
export function cautiousStep(world, target, memory, dt, options = {}) {
  const player = world.player;

  // Stuck detection: the last input asked for movement but the courier barely moved.
  const lastInput = memory.lastInput || { x: 0, y: 0 };
  const wasMoving = Math.hypot(lastInput.x, lastInput.y) > 0.01;
  const moved = Math.hypot(player.x - (memory.lastX ?? player.x), player.y - (memory.lastY ?? player.y));
  if (wasMoving && moved < 0.5) {
    memory.stuckTimer = (memory.stuckTimer || 0) + dt;
  } else {
    memory.stuckTimer = 0;
  }
  memory.lastX = player.x;
  memory.lastY = player.y;

  let input;
  const bush = nearestBush(player.x, player.y);
  const inBush = Math.hypot(bush.x - player.x, bush.y - player.y) < bush.r;
  if ((memory.stuckTimer || 0) > 0.1) {
    // Wedged in a wall corner: run for the nearest bush, which sits in open ground.
    input = moveToward(world, bush, false);
  } else {
    input = decide(world, target, memory, dt, bush, inBush, options);
  }
  memory.lastInput = input;
  return input;
}

/** The bush to run for while fleeing: the one furthest from every guard, discounted by how
 *  far the courier must run to reach it. A bush next to another guard's patrol is no
 *  hiding place at all — the nearest bush can sit behind the guard. */
function bestFleeBush(player, guards) {
  let best = null;
  let bestScore = -Infinity;
  for (const bush of LEVEL.bushes) {
    const fromGuards = Math.min(...guards.map((guard) => Math.hypot(bush.x - guard.x, bush.y - guard.y)));
    const fromPlayer = Math.hypot(bush.x - player.x, bush.y - player.y);
    const score = fromGuards - 0.5 * fromPlayer;
    if (score > bestScore) {
      bestScore = score;
      best = bush;
    }
  }
  return best;
}

/** The bush to retreat to: the nearest one further from the danger guard than the courier
 *  is — a short hop away from the threat, not a cross-map run — and clear of every other
 *  guard too. Falls back to the safest bush when every bush sits closer to the guard
 *  than the courier does. */
function retreatBush(player, guards, dangerGuard) {
  const playerDist = Math.hypot(dangerGuard.x - player.x, dangerGuard.y - player.y);
  let best = null;
  let bestDist = Infinity;
  for (const bush of LEVEL.bushes) {
    const fromDanger = Math.hypot(bush.x - dangerGuard.x, bush.y - dangerGuard.y);
    if (fromDanger <= playerDist) continue;
    const fromGuards = Math.min(...guards.map((guard) => Math.hypot(bush.x - guard.x, bush.y - guard.y)));
    if (fromGuards < 100) continue;
    const fromPlayer = Math.hypot(bush.x - player.x, bush.y - player.y);
    if (fromPlayer < bestDist) {
      bestDist = fromPlayer;
      best = bush;
    }
  }
  return best || bestFleeBush(player, guards);
}

/** The steering decision, without the stuck detection wrapped around it. */
function decide(world, target, memory, dt, bush, inBush, options = {}) {
  const player = world.player;
  const chaser = world.guards.find((guard) => guard.state === 'chase');
  const threat = world.guards.reduce(
    (worst, guard) => (guard.suspicion > (worst ? worst.suspicion : -1) ? guard : worst),
    null,
  );

  // Routes keep 60 px clear of every guard: a graph route whose first leg runs past a
  // guard is worse than no route at all, and the direct-steer shortcut respects it too.
  const avoid = world.guards.map((g) => ({ x: g.x, y: g.y, r: 60 }));

  // Fleeing: a chasing guard, or one past 0.6 suspicion (already investigating, about to
  // chase). Run for the bush furthest from the guard, routing around the walls on the
  // navigation graph instead of straight through them — and keep the same bush until the
  // chase is over, so the courier does not dither between two hiding spots. The courier
  // is only 20 px/s faster than a chasing guard, so the route matters more than the speed.
  const fleeing = chaser || (threat && threat.suspicion > 0.6);
  if (!fleeing) {
    memory.fleeBush = null;
  } else {
    const guard = chaser || threat;
    const threatDistance = Math.hypot(guard.x - player.x, guard.y - player.y);
    if (inBush && threatDistance > 70) return { x: 0, y: 0, sneak: true };
    if (!memory.fleeBush) memory.fleeBush = bestFleeBush(player, world.guards);
    const guardDistance = Math.hypot(guard.x - player.x, guard.y - player.y);
    if (guardDistance < 100) {
      // The guard is on top of the courier: run straight away from it first. The graph
      // route's first node may sit right next to the guard, and following it would run
      // the courier into the guard it is fleeing. steerPoint still routes around walls.
      const away = {
        x: Math.max(40, Math.min(1240, player.x + ((player.x - guard.x) / guardDistance) * 200)),
        y: Math.max(40, Math.min(680, player.y + ((player.y - guard.y) / guardDistance) * 200)),
      };
      return moveToward(world, steerPoint(world, away, memory), false);
    }
    return moveToward(world, steerPoint(world, memory.fleeBush, memory, avoid), false);
  }

  // The guard to get away from: the one that sees the courier, else the closest one.
  // The retreat bush is the nearest one further from that guard than the courier is —
  // a short hop away from the threat. The nearest bush of all can sit behind the guard,
  // and running for it would cross the guard's path.
  const dangerGuard =
    world.guards.find((guard) => guardSees(guard, player).visible) ||
    world.guards.reduce((nearest, guard) =>
      Math.hypot(guard.x - player.x, guard.y - player.y) <
      Math.hypot(nearest.x - player.x, nearest.y - player.y)
        ? guard
        : nearest,
    );
  const safeBush = retreatBush(player, world.guards, dangerGuard);

  // Exposed: the courier is standing inside a cone right now. Waiting here only lets
  // suspicion climb, and walking on toward the target crosses more of it — so fall back
  // to the safest bush and let the guard lose sight of it, instead of standing in the
  // open. The probe below only checks the next step; this one checks where it stands.
  if (!options.brave && seenAt(world, player.x, player.y)) {
    if (!inBush) return moveToward(world, steerPoint(world, safeBush, memory, avoid), true);
    return { x: 0, y: 0, sneak: true };
  }

  // Personal space: a guard this close will hear the courier's footsteps or simply walk
  // into it, even without seeing it. Standing still and waiting is wrong when the guard
  // is the one closing the distance, so back off to the safest bush and wait there
  // until the guard has moved on.
  if (!options.brave) {
    const closeGuard = world.guards.some(
      (guard) => Math.hypot(guard.x - player.x, guard.y - player.y) < 100,
    );
    if (closeGuard) {
      if (!inBush) return moveToward(world, steerPoint(world, safeBush, memory, avoid), true);
      return { x: 0, y: 0, sneak: true };
    }
    if (
      inBush &&
      world.guards.some((guard) => Math.hypot(guard.x - player.x, guard.y - player.y) < 150)
    ) {
      return { x: 0, y: 0, sneak: true };
    }
  }
  if (memory.detour) {
    if (!inBush) return moveToward(world, steerPoint(world, bush, memory, avoid), true);
    // Wait in the bush until the heat is off AND the guards have actually moved away —
    // suspicion alone decays while a guard still stands just outside the cone's edge,
    // and stepping out then walks straight back into it.
    const guardsNear = world.guards.some(
      (guard) => Math.hypot(guard.x - player.x, guard.y - player.y) < 200,
    );
    if (maxSuspicion(world) > 0.2 || guardsNear) return { x: 0, y: 0, sneak: true };
    memory.detour = false;
    memory.waitTimer = 0;
  }
  // Look a second and a half ahead: step into the cone and the courier waits instead.
  // Half a second was too short — the courier started moves into windows that closed
  // mid-stride, and a guard's cone sweeps onto it before it clears the danger.
  // The courier always sneaks on the approach — running carries 100 px and a guard
  // 320 px away closes that gap in two seconds, so running "when clear" is how it
  // gets heard. Only a chase runs.
  const sneak = true;
  const speed = 85;
  const probe = moveToward(world, steerPoint(world, target, memory), sneak);
  const aheadX = player.x + probe.x * speed * 1.5;
  const aheadY = player.y + probe.y * speed * 1.5;
  if (probe.x !== 0 && seenAt(world, aheadX, aheadY)) {
    memory.waitTimer += dt;
    if (memory.waitTimer > 2.5) memory.detour = true;
    return { x: 0, y: 0, sneak: true };
  }
  memory.waitTimer = 0;
  return probe;
}

/** Play the world forward with the cautious courier until `done` says stop. */
function runUntil(world, targets, done, maxSeconds) {
  const memory = { waitTimer: 0, detour: false };
  let targetIndex = 0;
  let steps = 0;
  const maxSteps = Math.floor(maxSeconds / STEP);
  while (steps < maxSteps) {
    if (world.status !== 'playing') break;
    const target = targets[Math.min(targetIndex, targets.length - 1)];
    const input = cautiousStep(world, target, memory, STEP);
    step(world, input, STEP);
    steps += 1;
    const player = world.player;
    if (Math.hypot(target.x - player.x, target.y - player.y) < 24) {
      targetIndex += 1;
    }
    if (done(world, steps)) break;
  }
  return { world, steps, seconds: steps * STEP };
}

/**
 * Stage one shot and return the world in its final frame, with how long it took.
 * 'start': five seconds of the guards patrolling, title over it.
 * 'play': the courier sneaks toward the first letter until it is collected.
 * 'alert': the courier stands on a guard's patrol path until it is chased, then runs.
 * 'end': the courier collects all three letters and reaches the gate.
 */
export function stageShot(name, seed = 1) {
  const world = createWorld(seed);
  if (name === 'start') {
    for (let i = 0; i < 5 * 60; i += 1) step(world, { x: 0, y: 0, sneak: false });
    return { world, steps: 300, seconds: 5 };
  }
  if (name === 'play') {
    const firstLetter = LEVEL.letters[0];
    return runUntil(world, [firstLetter], (w) => w.lettersCollected >= 1, 30);
  }
  if (name === 'alert') {
    // Stand on Wren's patrol path, in the open, until she gives chase.
    const memory = { waitTimer: 0, detour: false };
    const stand = { x: 260, y: 400 };
    let steps = 0;
    let chaseSeconds = 0;
    while (steps < 30 * 60 && world.status === 'playing') {
      const player = world.player;
      const chaser = world.guards.find((guard) => guard.state === 'chase');
      let input;
      if (chaser) {
        chaseSeconds += STEP;
        // Run from the chaser, but stay in frame: keep some distance without leaving.
        const dx = player.x - chaser.x;
        const dy = player.y - chaser.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 120) {
          input = { x: dx / dist, y: dy / dist, sneak: false };
        } else {
          input = { x: 0, y: 0, sneak: true };
        }
      } else {
        // Brave: stand here to be spotted, even when a guard walks close.
        input = cautiousStep(world, stand, memory, STEP, { brave: true });
      }
      step(world, input, STEP);
      steps += 1;
      if (chaser && chaseSeconds >= 2) break;
    }
    return { world, steps, seconds: steps * STEP };
  }
  if (name === 'end') {
    // West letter, then through the west gap, across the middle, over the middle wall's
    // top gap to the north-middle letter; east through the east wall's top gap to the
    // east letter, then north to the gate. Every leg was checked against every wall and
    // crate, so the route never asks the courier to walk through solid cover.
    const exit = LEVEL.exit;
    const targets = [
      LEVEL.letters[0],
      { x: 312, y: 360 },
      { x: 500, y: 360 },
      { x: 600, y: 200 },
      { x: 652, y: 60 },
      LEVEL.letters[2],
      { x: 900, y: 80 },
      { x: 972, y: 100 },
      { x: 1060, y: 300 },
      LEVEL.letters[1],
      { x: 1140, y: 300 },
      { x: exit.x + exit.w / 2, y: exit.y + exit.h / 2 },
    ];
    return runUntil(world, targets, (w) => w.status === 'won', 150);
  }
  throw new Error(`Unknown shot: ${name}`);
}
