// Night Post — the autopilot and the staged shots. The autopilot plays
// with the same cautious rules a careful player would: sneak, wait in
// bushes when seen, never walk into a guard's cone, flee when chased.
// It plays the same game the browser does — only through step().

import { PLAYER_RADIUS, PLAYER_SNEAK } from './config.js';
import { BUSHES, LETTERS, EXIT_RECT } from './level.js';
import {
  createWorld,
  step,
  guardSees,
  seenAt,
  pointInBush,
  dist,
  segmentClearOfWalls,
} from './world.js';

// 22 walkable points that span the courtyard. Two nodes are linked when
// a courier (radius 14) can walk straight between them.
export const NODES = [
  { x: 150, y: 120 }, // 0 letter 1
  { x: 1140, y: 620 }, // 1 letter 2
  { x: 760, y: 80 }, // 2 letter 3
  { x: 1206, y: 86 }, // 3 exit centre
  { x: 312, y: 360 }, // 4 W2 gap
  { x: 652, y: 60 }, // 5 W3 top gap
  { x: 652, y: 540 }, // 6 W3 bottom gap
  { x: 972, y: 120 }, // 7 W4 top gap
  { x: 430, y: 60 }, // 8 B1
  { x: 760, y: 200 }, // 9 B2
  { x: 180, y: 340 }, // 10 B3
  { x: 560, y: 620 }, // 11 B4
  { x: 1100, y: 340 }, // 12 B5
  { x: 880, y: 620 }, // 13 B6
  { x: 180, y: 480 }, // 14 west mid
  { x: 500, y: 360 }, // 15 centre
  { x: 1060, y: 300 }, // 16 east mid
  { x: 600, y: 200 }, // 17
  { x: 900, y: 80 }, // 18
  { x: 400, y: 300 }, // 19
  { x: 500, y: 620 }, // 20
  { x: 1080, y: 520 }, // 21
];

export function nearestNode(p) {
  let best = 0;
  let bd = Infinity;
  NODES.forEach((n, i) => {
    const d = dist(p.x, p.y, n.x, n.y);
    if (d < bd) {
      bd = d;
      best = i;
    }
  });
  return best;
}

export function segmentNearPoint(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function edgeClear(a, b, avoid) {
  if (!segmentClearOfWalls(a.x, a.y, b.x, b.y, PLAYER_RADIUS)) return false;
  return avoid.every((av) => segmentNearPoint(av.x, av.y, a.x, a.y, b.x, b.y) > av.r);
}

// Breadth-first search over the node graph. Returns node indices from
// fromId to toId, or null when no route exists.
export function findPath(fromId, toId, avoid) {
  if (fromId === toId) return [fromId];
  const prev = new Array(NODES.length).fill(-1);
  const queue = [fromId];
  prev[fromId] = fromId;
  while (queue.length) {
    const cur = queue.shift();
    for (let i = 0; i < NODES.length; i++) {
      if (prev[i] !== -1 || i === cur) continue;
      if (!edgeClear(NODES[cur], NODES[i], avoid)) continue;
      prev[i] = cur;
      if (i === toId) {
        const path = [toId];
        let n = toId;
        while (n !== fromId) {
          n = prev[n];
          path.unshift(n);
        }
        return path;
      }
      queue.push(i);
    }
  }
  return null;
}

function steerPoint(world, from, target, avoid, mem) {
  if (
    segmentClearOfWalls(from.x, from.y, target.x, target.y, PLAYER_RADIUS) &&
    avoid.every((av) => segmentNearPoint(av.x, av.y, from.x, from.y, target.x, target.y) > av.r)
  ) {
    return target;
  }
  const key = `${target.x},${target.y}`;
  mem.pathTimer -= 1 / 60;
  if (!mem.path || mem.pathTarget !== key || mem.pathTimer <= 0) {
    mem.path = findPath(nearestNode(from), nearestNode(target), avoid);
    mem.pathTarget = key;
    mem.pathTimer = 0.5;
  }
  if (!mem.path || mem.path.length === 0) return target;
  if (mem.path.length === 1) return target;
  const first = NODES[mem.path[0]];
  if (dist(from.x, from.y, first.x, first.y) > 24) return first;
  return NODES[mem.path[1]];
}

function nearestBush(x, y) {
  let best = BUSHES[0];
  let bd = Infinity;
  for (const b of BUSHES) {
    const d = dist(x, y, b.x, b.y);
    if (d < bd) {
      bd = d;
      best = b;
    }
  }
  return best;
}

// The bush furthest from every guard, discounted by distance from the courier.
function bestBush(world) {
  const p = world.player;
  let best = null;
  let bs = -Infinity;
  for (const b of BUSHES) {
    let mg = Infinity;
    for (const g of world.guards) mg = Math.min(mg, dist(b.x, b.y, g.x, g.y));
    const score = mg - dist(b.x, b.y, p.x, p.y) * 0.5;
    if (score > bs) {
      bs = score;
      best = b;
    }
  }
  return best;
}

// The nearest bush further from the danger guard than the courier is,
// and at least 100 px from every guard; otherwise the furthest bush.
function safestBush(world, danger) {
  const p = world.player;
  const dDanger = dist(p.x, p.y, danger.x, danger.y);
  const cands = BUSHES.filter(
    (b) =>
      dist(b.x, b.y, danger.x, danger.y) > dDanger &&
      world.guards.every((g) => dist(b.x, b.y, g.x, g.y) >= 100),
  );
  if (cands.length) {
    cands.sort((a, b) => dist(a.x, a.y, p.x, p.y) - dist(b.x, b.y, p.x, p.y));
    return cands[0];
  }
  return bestBush(world);
}

function nearestGuardTo(world) {
  const p = world.player;
  let best = world.guards[0];
  let bd = Infinity;
  for (const g of world.guards) {
    const d = dist(g.x, g.y, p.x, p.y);
    if (d < bd) {
      bd = d;
      best = g;
    }
  }
  return best;
}

function moveToward(world, point, memory, sneak, avoid) {
  const p = world.player;
  const d = dist(p.x, p.y, point.x, point.y);
  if (d < 4) return { x: 0, y: 0, sneak: true };
  const sp = steerPoint(world, p, point, avoid || [], memory);
  const dx = sp.x - p.x;
  const dy = sp.y - p.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len, sneak };
}

function fleeDirect(world, guard) {
  const p = world.player;
  const dx = p.x - guard.x;
  const dy = p.y - guard.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len, sneak: false };
}

export function freshMemory(world) {
  return {
    lastX: world.player.x,
    lastY: world.player.y,
    stuckTimer: 0,
    fleeBush: null,
    fleeTimer: 0,
    waitTimer: 0,
    path: null,
    pathTarget: null,
    pathTimer: 0,
  };
}

// One cautious step toward target. brave skips the personal-space and
// exposed rules (used only to stage the alert shot).
export function cautiousStep(world, target, memory, dt, options) {
  const opts = options || {};
  const brave = !!opts.brave;
  const p = world.player;

  // Stuck against a wall: back out to the nearest bush and re-route.
  const moved = Math.hypot(p.x - memory.lastX, p.y - memory.lastY);
  if (moved < 0.5) memory.stuckTimer += dt;
  else memory.stuckTimer = 0;
  memory.lastX = p.x;
  memory.lastY = p.y;
  if (memory.stuckTimer > 0.1) {
    memory.stuckTimer = 0;
    return moveToward(world, nearestBush(p.x, p.y), memory, false);
  }

  const chasing = world.guards.filter((g) => g.state === 'chase');
  const maxSusp = Math.max(0, ...world.guards.map((g) => g.suspicion));
  const guard = nearestGuardTo(world);
  const guardDist = dist(guard.x, guard.y, p.x, p.y);

  // Fleeing a chase: run straight away when the guard is close, else run
  // to the best bush (recomputed every 0.5 s, sticky in between).
  if (!brave && (chasing.length > 0 || maxSusp > 0.6)) {
    if (guardDist < 100) return fleeDirect(world, guard);
    memory.fleeTimer -= dt;
    if (!memory.fleeBush || memory.fleeTimer <= 0) {
      memory.fleeBush = bestBush(world);
      memory.fleeTimer = 0.5;
    }
    return moveToward(world, memory.fleeBush, memory, false, [
      { x: guard.x, y: guard.y, r: 60 },
    ]);
  }

  // Exposed: step out of sight, into the safest bush.
  if (!brave && seenAt(world, p.x, p.y)) {
    return moveToward(world, safestBush(world, guard), memory, false);
  }

  // Personal space: a guard within 100 px is too close — leave quietly.
  if (!brave && guardDist < 100) {
    return moveToward(world, safestBush(world, guard), memory, false);
  }

  // Hidden in a bush with a guard near: stay put.
  if (!brave && pointInBush(p.x, p.y) && guardDist < 150) {
    return { x: 0, y: 0, sneak: true };
  }

  // Waited too long: retreat to a bush until the courtyard calms.
  if (memory.waitTimer > 2.5) {
    if (maxSusp < 0.2 && guardDist >= 200) {
      memory.waitTimer = 0;
    } else {
      return moveToward(world, safestBush(world, guard), memory, false);
    }
  }

  // Probe: look 1.5 s ahead at sneak speed; if that spot is seen, wait.
  const dx = target.x - p.x;
  const dy = target.y - p.y;
  const len = Math.hypot(dx, dy) || 1;
  const probeX = p.x + (dx / len) * PLAYER_SNEAK * 1.5;
  const probeY = p.y + (dy / len) * PLAYER_SNEAK * 1.5;
  if (!brave && seenAt(world, probeX, probeY)) {
    memory.waitTimer += dt;
    return { x: 0, y: 0, sneak: true };
  }
  memory.waitTimer = 0;
  // Approach: always sneak.
  return moveToward(world, target, memory, true);
}

// Drive the autopilot through targets until done(world) or maxSeconds.
export function runUntil(world, targets, done, maxSeconds) {
  const dt = 1 / 60;
  const memory = freshMemory(world);
  let ti = 0;
  const maxSteps = Math.floor(maxSeconds * 60);
  for (let i = 0; i < maxSteps; i++) {
    if (world.status !== 'playing') break;
    if (done && done(world)) break;
    while (
      ti < targets.length &&
      dist(world.player.x, world.player.y, targets[ti].x, targets[ti].y) < 24
    ) {
      ti++;
    }
    if (ti >= targets.length) break;
    const input = cautiousStep(world, targets[ti], memory, dt);
    step(world, input, dt);
  }
  return world;
}

// Staged shots. The first three are the submitted screenshots; 'end' is
// the full route, kept as a regression probe of the autopilot.
export function stageShot(name, seed) {
  const world = createWorld(seed);
  const dt = 1 / 60;
  if (name === 'start') {
    for (let i = 0; i < 5 * 60; i++) step(world, { x: 0, y: 0, sneak: false }, dt);
    return world;
  }
  if (name === 'play') {
    runUntil(world, [{ x: 150, y: 120 }], (w) => w.letters[0].collected, 60);
    return world;
  }
  if (name === 'alert') {
    runUntil(world, [{ x: 260, y: 400 }], null, 60);
    // Stand on Wren's path, brave, until she starts chasing; then run
    // away for 2 s of chase, keeping roughly 120 px from her.
    const mem = freshMemory(world);
    let chaseTime = 0;
    let fleeing = false;
    for (let i = 0; i < 90 * 60; i++) {
      if (world.status !== 'playing') break;
      const chasing = world.guards.some((g) => g.state === 'chase');
      if (chasing) {
        fleeing = true;
        chaseTime += dt;
      }
      if (fleeing && chaseTime >= 2) break;
      if (fleeing) {
        const g = nearestGuardTo(world);
        step(world, fleeDirect(world, g), dt);
      } else {
        const input = cautiousStep(world, { x: 260, y: 400 }, mem, dt, { brave: true });
        step(world, input, dt);
      }
    }
    return world;
  }
  if (name === 'end') {
    const route = [
      { x: 150, y: 120 },
      { x: 312, y: 360 },
      { x: 500, y: 360 },
      { x: 600, y: 200 },
      { x: 652, y: 60 },
      { x: 760, y: 80 },
      { x: 900, y: 80 },
      { x: 972, y: 100 },
      { x: 1060, y: 300 },
      { x: 1140, y: 620 },
      { x: 1140, y: 300 },
      { x: 1206, y: 86 },
    ];
    runUntil(world, route, (w) => w.status !== 'playing', 150);
    return world;
  }
  throw new Error(`unknown shot: ${name}`);
}
