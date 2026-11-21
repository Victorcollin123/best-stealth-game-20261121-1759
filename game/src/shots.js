// Night Post — the screenshot autopilot: a cautious scripted courier.
// It steers with a navigation graph, flees to bushes when spotted,
// probes ahead at sneak speed before committing, and always sneaks on
// the approach — only a chase ever runs.

import { PLAYER, GUARD } from './config.js';
import { BUSHES, LETTERS, SOLIDS, exitCenter } from './level.js';
import { createWorld, step, guardSees, dist, segmentHitsRect, segmentNearPoint } from './world.js';

// The navigation graph: letters, the gate, gaps, bushes and corridor
// midpoints. Two nodes join when the courier (radius 14) can walk
// straight between them — solids inflated by 14.
export const NODES = [
  { x: 150, y: 120 }, // 0 letter 1
  { x: 1140, y: 620 }, // 1 letter 2
  { x: 760, y: 80 }, // 2 letter 3
  { x: 1206, y: 86 }, // 3 exit centre
  { x: 312, y: 360 }, // 4 gap between W1 and W2
  { x: 500, y: 360 }, // 5 middle
  { x: 600, y: 200 }, // 6
  { x: 652, y: 60 }, // 7 top middle
  { x: 900, y: 80 }, // 8
  { x: 972, y: 100 }, // 9
  { x: 1060, y: 300 }, // 10 east middle
  { x: 1140, y: 300 }, // 11 east corridor
  { x: 80, y: 640 }, // 12 player start
  { x: 430, y: 60 }, // 13 B1
  { x: 760, y: 200 }, // 14 B2
  { x: 180, y: 340 }, // 15 B3
  { x: 560, y: 620 }, // 16 B4
  { x: 1100, y: 340 }, // 17 B5
  { x: 880, y: 620 }, // 18 B6
  { x: 240, y: 120 }, // 19 west upper corridor
  { x: 430, y: 560 }, // 20 south middle
  { x: 760, y: 620 }, // 21 south-east corridor
];

function segmentClearOfSolids(ax, ay, bx, by) {
  for (const s of SOLIDS) {
    const inflated = { x: s.x - 14, y: s.y - 14, w: s.w + 28, h: s.h + 28 };
    if (segmentHitsRect(ax, ay, bx, by, inflated)) return false;
  }
  return true;
}

function segmentClear(ax, ay, bx, by, avoid) {
  if (!segmentClearOfSolids(ax, ay, bx, by)) return false;
  for (const a of avoid || []) {
    if (segmentNearPoint(ax, ay, bx, by, a.x, a.y).dist < a.r) return false;
  }
  return true;
}

function nearestNode(x, y) {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < NODES.length; i++) {
    const d = dist(x, y, NODES[i].x, NODES[i].y);
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

// Breadth-first search over the graph, skipping edges that pass within
// r of an `avoid` point {x, y, r}. Returns an array of node ids, or
// null when no route exists.
export function findPath(fromId, toId, avoid) {
  if (fromId === toId) return [fromId];
  const prev = new Array(NODES.length).fill(-1);
  const queue = [fromId];
  prev[fromId] = fromId;
  while (queue.length > 0) {
    const cur = queue.shift();
    for (let nxt = 0; nxt < NODES.length; nxt++) {
      if (prev[nxt] !== -1 || nxt === cur) continue;
      if (!segmentClear(NODES[cur].x, NODES[cur].y, NODES[nxt].x, NODES[nxt].y, avoid)) continue;
      prev[nxt] = cur;
      if (nxt === toId) {
        const path = [toId];
        let node = toId;
        while (node !== fromId) {
          node = prev[node];
          path.unshift(node);
        }
        return path;
      }
      queue.push(nxt);
    }
  }
  return null;
}

// Steer from `from` toward `target`: the target itself when the segment
// is clear of walls and avoid points, otherwise the next node on the
// graph route (recomputed when the target changes, the path runs out,
// or every 0.5 s while avoiding).
export function steerPoint(from, target, memory, dt, avoid) {
  if (segmentClear(from.x, from.y, target.x, target.y, avoid)) {
    memory.path = null;
    return { ...target };
  }
  const fromId = nearestNode(from.x, from.y);
  const toId = nearestNode(target.x, target.y);
  const targetKey = `${target.x},${target.y}`;
  memory.pathTimer = (memory.pathTimer || 0) + dt;
  const stale = !memory.path || memory.pathTarget !== targetKey || memory.pathTimer > 0.5;
  if (stale) {
    memory.path = findPath(fromId, toId, avoid);
    memory.pathTarget = targetKey;
    memory.pathTimer = 0;
  }
  const path = memory.path;
  if (!path || path.length < 2) return { ...target };
  // Skip nodes already reached.
  while (path.length > 1 && dist(from.x, from.y, NODES[path[1]].x, NODES[path[1]].y) < 20) {
    path.shift();
  }
  if (path.length < 2) return { ...target };
  return { ...NODES[path[1]] };
}

// The bush furthest from every guard, discounted by distance from the
// courier — the sticky flee destination, recomputed every 0.5 s.
export function bestBush(world) {
  let best = null;
  let bestScore = -Infinity;
  for (const b of BUSHES) {
    let minGuard = Infinity;
    for (const g of world.guards) minGuard = Math.min(minGuard, dist(b.x, b.y, g.x, g.y));
    const score = minGuard - 0.5 * dist(world.player.x, world.player.y, b.x, b.y);
    if (score > bestScore) { bestScore = score; best = b; }
  }
  return best;
}

// The safest bush to retreat to: the nearest bush further from the
// danger guard than the courier is, and at least 100 px from every
// guard — falling back to the furthest-from-all-guards bush.
export function safestBush(world, dangerGuard) {
  const player = world.player;
  let best = null;
  let bestD = Infinity;
  for (const b of BUSHES) {
    const dPlayer = dist(player.x, player.y, b.x, b.y);
    const dDanger = dist(b.x, b.y, dangerGuard.x, dangerGuard.y);
    const dCourier = dist(player.x, player.y, dangerGuard.x, dangerGuard.y);
    if (dDanger <= dCourier) continue;
    let ok = true;
    for (const g of world.guards) {
      if (dist(b.x, b.y, g.x, g.y) < 100) { ok = false; break; }
    }
    if (!ok) continue;
    if (dPlayer < bestD) { bestD = dPlayer; best = b; }
  }
  if (best) return best;
  let fallback = null;
  let fallbackScore = -Infinity;
  for (const b of BUSHES) {
    let minGuard = Infinity;
    for (const g of world.guards) minGuard = Math.min(minGuard, dist(b.x, b.y, g.x, g.y));
    if (minGuard > fallbackScore) { fallbackScore = minGuard; fallback = b; }
  }
  return fallback;
}

export function createMemory() {
  return {
    stuckTimer: 0,
    prevX: null,
    prevY: null,
    hadInput: false,
    waitTimer: 0,
    detouring: false,
    fleeBush: null,
    fleeTimer: 0,
    path: null,
    pathTarget: null,
    pathTimer: 0,
  };
}

function moveInput(from, to, sneak) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const d = Math.hypot(dx, dy);
  if (d < 0.001) return { dx: 0, dy: 0, sneak: !!sneak };
  return { dx: dx / d, dy: dy / d, sneak: !!sneak };
}

function waitInput() {
  return { dx: 0, dy: 0, sneak: true };
}

// One cautious step toward `target`. Returns a movement input.
export function cautiousStep(world, target, memory, dt, options = {}) {
  const player = world.player;
  const guards = world.guards;
  const brave = !!options.brave;

  // --- what does the courier know right now? ---
  let seenNow = false;
  let maxSuspicion = 0;
  let nearestGuard = null;
  let nearestD = Infinity;
  for (const g of guards) {
    maxSuspicion = Math.max(maxSuspicion, g.suspicion);
    const d = dist(g.x, g.y, player.x, player.y);
    if (d < nearestD) { nearestD = d; nearestGuard = g; }
    if (guardSees(g, player).visible) seenNow = true;
    if (g.state === 'pause') {
      // A pausing guard sweeps its whole cone: count the full sweep.
      const saved = g.facing;
      for (const off of [-0.9, 0, 0.9]) {
        g.facing = g.baseFacing + off;
        if (guardSees(g, player).visible) seenNow = true;
      }
      g.facing = saved;
    }
  }
  const chasing = guards.some((g) => g.state === 'chase');
  const inBush = BUSHES.some((b) => dist(player.x, player.y, b.x, b.y) <= b.r);

  // --- stuck detection: the last input moved the courier < 0.5 px ---
  if (memory.hadInput && memory.prevX !== null) {
    const moved = dist(player.x, player.y, memory.prevX, memory.prevY);
    if (moved < 0.5) memory.stuckTimer += dt;
    else memory.stuckTimer = 0;
  }
  memory.prevX = player.x;
  memory.prevY = player.y;

  let input;
  const avoid = guards.map((g) => ({ x: g.x, y: g.y, r: 60 }));

  if (!brave && memory.stuckTimer > 0.1) {
    // Wedged on a corner: break for the nearest bush and reset.
    let nearest = null;
    let nd = Infinity;
    for (const b of BUSHES) {
      const d = dist(player.x, player.y, b.x, b.y);
      if (d < nd) { nd = d; nearest = b; }
    }
    memory.stuckTimer = 0;
    input = moveInput(player, nearest, true);
  } else if (!brave && (chasing || maxSuspicion > 0.6)) {
    // Flee: run the graph route to a sticky best bush.
    if (nearestD < 100) {
      // A guard is right on top of us: run straight away first.
      const dx = player.x - nearestGuard.x;
      const dy = player.y - nearestGuard.y;
      const d = Math.hypot(dx, dy) || 1;
      input = { dx: dx / d, dy: dy / d, sneak: false };
    } else {
      memory.fleeTimer += dt;
      if (!memory.fleeBush || memory.fleeTimer > 0.5) {
        memory.fleeBush = bestBush(world);
        memory.fleeTimer = 0;
      }
      const dest = steerPoint(player, memory.fleeBush, memory, dt, avoid);
      input = moveInput(player, dest, false);
    }
    memory.waitTimer = 0;
  } else if (!brave && seenNow) {
    // Exposed inside a cone right now: retreat to the safest bush.
    const dest = steerPoint(player, safestBush(world, nearestGuard), memory, dt, avoid);
    input = moveInput(player, dest, true);
    memory.waitTimer = 0;
  } else if (!brave && nearestD < 100) {
    // Personal space: a guard is too close.
    const dest = steerPoint(player, safestBush(world, nearestGuard), memory, dt, avoid);
    input = moveInput(player, dest, true);
    memory.waitTimer = 0;
  } else if (!brave && inBush && nearestD < 150) {
    // Hidden, but a guard is near: stay put.
    input = waitInput();
  } else if (!brave && memory.detouring) {
    // Detour until the heat dies down.
    if (maxSuspicion < 0.2 && nearestD > 200) {
      memory.detouring = false;
      memory.waitTimer = 0;
    } else {
      const dest = steerPoint(player, safestBush(world, nearestGuard), memory, dt, avoid);
      input = moveInput(player, dest, true);
    }
  } else if (!brave && memory.waitTimer > 2.5) {
    // Waited too long: retreat to a bush until it is safe again.
    memory.detouring = true;
    const dest = steerPoint(player, safestBush(world, nearestGuard), memory, dt, avoid);
    input = moveInput(player, dest, true);
  } else {
    // Probe: look 1.5 s ahead at sneak speed; if that point is seen,
    // wait instead. The courier always sneaks on the approach.
    const dir = moveInput(player, target, true);
    const probeX = player.x + dir.dx * PLAYER.sneakSpeed * 1.5;
    const probeY = player.y + dir.dy * PLAYER.sneakSpeed * 1.5;
    let probeSeen = false;
    if (!brave) {
      for (const g of guards) {
        if (guardSees(g, { x: probeX, y: probeY }).visible) { probeSeen = true; break; }
      }
      if (!segmentClearOfSolids(player.x, player.y, probeX, probeY)) probeSeen = false;
    }
    if (probeSeen) {
      memory.waitTimer += dt;
      input = waitInput();
    } else {
      memory.waitTimer = 0;
      const dest = steerPoint(player, target, memory, dt, brave ? [] : avoid);
      input = moveInput(player, dest, true);
    }
  }

  memory.hadInput = Math.hypot(input.dx, input.dy) > 0.01;
  return input;
}

// Advance the world through `targets` in order (each within 24 px)
// until done(world) is true, the world ends, or maxSeconds elapse.
export function runUntil(world, targets, done, maxSeconds, options = {}) {
  const dt = 1 / 60;
  const memory = createMemory();
  let t = 0;
  let ti = 0;
  while (t < maxSeconds && world.status === 'playing') {
    if (done && done(world)) break;
    const target = targets[Math.min(ti, targets.length - 1)];
    const input = cautiousStep(world, target, memory, dt, options);
    step(world, input, dt);
    t += dt;
    if (ti < targets.length - 1 && dist(world.player.x, world.player.y, target.x, target.y) <= 24) {
      ti += 1;
    }
  }
  return { world, seconds: t, targetIndex: ti };
}

// The 'end' route: letter 1, across the middle, letter 3, down the
// east side, letter 2, then the green gate. 150 s cap.
export const END_ROUTE = [
  { x: LETTERS[0].x, y: LETTERS[0].y },
  { x: 312, y: 360 },
  { x: 500, y: 360 },
  { x: 600, y: 200 },
  { x: 652, y: 60 },
  { x: LETTERS[2].x, y: LETTERS[2].y },
  { x: 900, y: 80 },
  { x: 972, y: 100 },
  { x: 1060, y: 300 },
  { x: LETTERS[1].x, y: LETTERS[1].y },
  { x: 1140, y: 300 },
  exitCenter(),
];

// Stage one screenshot scene and return the world in its final frame.
export function stageShot(name, seed = 1) {
  const dt = 1 / 60;
  if (name === 'start') {
    const world = createWorld(seed);
    for (let i = 0; i < 5 / dt; i++) step(world, { dx: 0, dy: 0, sneak: false }, dt);
    return world;
  }
  if (name === 'play') {
    const world = createWorld(seed);
    runUntil(world, [{ x: LETTERS[0].x, y: LETTERS[0].y }], (w) => w.lettersCollected >= 1, 60);
    return world;
  }
  if (name === 'alert') {
    const world = createWorld(seed);
    world.player.x = 260;
    world.player.y = 400;
    // Stand on Wren's path until chased, then run for 2 s keeping ~120 px.
    let chasedFor = 0;
    let t = 0;
    while (t < 40 && world.status === 'playing') {
      const chasingGuard = world.guards.find((g) => g.state === 'chase');
      if (chasingGuard) {
        chasedFor += dt;
        if (chasedFor >= 2) break;
        const dx = world.player.x - chasingGuard.x;
        const dy = world.player.y - chasingGuard.y;
        const d = Math.hypot(dx, dy) || 1;
        step(world, { dx: dx / d, dy: dy / d, sneak: false }, dt);
      } else {
        step(world, { dx: 0, dy: 0, sneak: false }, dt);
      }
      t += dt;
    }
    return world;
  }
  if (name === 'end') {
    const world = createWorld(seed);
    runUntil(world, END_ROUTE, (w) => w.status === 'won', 150);
    return world;
  }
  throw new Error(`unknown shot: ${name}`);
}
