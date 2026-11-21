// Night Post — the screenshot autopilot: a cautious courier that stages the
// shots. Graph routing over 22 nodes, flee / retreat / probe / wait rules,
// always sneaking on the approach (only a chase runs). stageShot(name, seed)
// stages one shot and returns the world in its final frame.

import { PLAYER, GUARD } from './config.js';
import { LEVEL } from './level.js';
import { createWorld, step, guardSeesAt, segmentBlocked, segmentNearPoint, inBushAt } from './world.js';

// ---------------------------------------------------------------- nav graph

// 22 nodes: the letters, the gate, the wall gaps, the bushes, corridor midpoints.
export const NODES = [
  { x: 150, y: 120 }, // 0 letter 1
  { x: 1140, y: 620 }, // 1 letter 2
  { x: 760, y: 80 }, // 2 letter 3
  { x: 1206, y: 86 }, // 3 exit centre
  { x: 312, y: 360 }, // 4 W1/W2 gap
  { x: 500, y: 360 }, // 5 middle
  { x: 600, y: 200 }, // 6
  { x: 652, y: 60 }, // 7 north middle
  { x: 900, y: 80 }, // 8 north east
  { x: 972, y: 100 }, // 9
  { x: 1060, y: 300 }, // 10 east middle
  { x: 1140, y: 300 }, // 11 east column
  { x: 80, y: 640 }, // 12 player start
  { x: 180, y: 340 }, // 13 bush B3
  { x: 430, y: 60 }, // 14 bush B1
  { x: 760, y: 200 }, // 15 bush B2
  { x: 560, y: 620 }, // 16 bush B4
  { x: 1100, y: 340 }, // 17 bush B5
  { x: 880, y: 620 }, // 18 bush B6
  { x: 360, y: 640 }, // 19 south corridor
  { x: 700, y: 640 }, // 20 south corridor
  { x: 1060, y: 640 }, // 21 south east
];

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// Two nodes are joined when a courier (radius 14) can walk straight between them.
const ADJACENCY = (() => {
  const adj = NODES.map(() => []);
  for (let i = 0; i < NODES.length; i++) {
    for (let j = i + 1; j < NODES.length; j++) {
      if (!segmentBlocked(NODES[i].x, NODES[i].y, NODES[j].x, NODES[j].y, PLAYER.radius)) {
        adj[i].push(j);
        adj[j].push(i);
      }
    }
  }
  return adj;
})();

export function nearestNode(pos) {
  let best = 0;
  let bestD = Infinity;
  NODES.forEach((n, i) => {
    const d = dist(pos, n);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}

/**
 * Breadth-first route from fromId to toId, skipping any edge that passes
 * within r of an avoid point {x, y, r}. Returns node ids, or null.
 */
export function findPath(fromId, toId, avoid = []) {
  if (fromId === toId) return [fromId];
  const prev = new Array(NODES.length).fill(-1);
  const seen = new Array(NODES.length).fill(false);
  const queue = [fromId];
  seen[fromId] = true;
  while (queue.length > 0) {
    const u = queue.shift();
    for (const v of ADJACENCY[u]) {
      if (seen[v]) continue;
      let blocked = false;
      for (const a of avoid) {
        if (segmentNearPoint(NODES[u].x, NODES[u].y, NODES[v].x, NODES[v].y, a.x, a.y) < a.r) {
          blocked = true;
          break;
        }
      }
      if (blocked) continue;
      seen[v] = true;
      prev[v] = u;
      if (v === toId) {
        const path = [v];
        let cur = v;
        while (prev[cur] !== -1) {
          cur = prev[cur];
          path.unshift(cur);
        }
        return path;
      }
      queue.push(v);
    }
  }
  return null;
}

/** Is the straight walk from->to clear of walls (courier radius) and avoid points? */
function segmentClear(from, to, avoid) {
  if (segmentBlocked(from.x, from.y, to.x, to.y, PLAYER.radius)) return false;
  for (const a of avoid) {
    if (segmentNearPoint(from.x, from.y, to.x, to.y, a.x, a.y) < a.r) return false;
  }
  return true;
}

/**
 * Where to walk next for target: the target itself when the segment is clear
 * of walls and avoid points, else the next node on the graph route (the
 * nearest few nodes to the courier are tried, so it never walks backwards
 * to a node it already passed).
 */
export function steerPoint(from, target, avoid = []) {
  if (segmentClear(from, target, avoid)) return { x: target.x, y: target.y };
  const toId = nearestNode(target);
  const order = NODES.map((n, i) => [dist(from, n), i])
    .sort((a, b) => a[0] - b[0])
    .slice(0, 4);
  for (const [, fromId] of order) {
    const path = findPath(fromId, toId, avoid);
    if (!path) continue;
    if (path.length === 1) return { x: target.x, y: target.y };
    const hop = NODES[path[1]];
    if (segmentClear(from, hop, avoid)) return { x: hop.x, y: hop.y };
    return { x: NODES[fromId].x, y: NODES[fromId].y };
  }
  return { x: target.x, y: target.y };
}

// ---------------------------------------------------------------- bushes

function minGuardDist(world, pos) {
  return Math.min(...world.guards.map((g) => Math.hypot(g.x - pos.x, g.y - pos.y)));
}

function nearestBush(pos) {
  let best = LEVEL.bushes[0];
  let bestD = Infinity;
  for (const b of LEVEL.bushes) {
    const d = Math.hypot(b.x - pos.x, b.y - pos.y);
    if (d < bestD) {
      bestD = d;
      best = b;
    }
  }
  return { x: best.x, y: best.y };
}

/**
 * The safest bush to retreat to: the nearest bush further from the danger
 * guard than the courier is AND at least 100 px from every guard; failing
 * that, the bush furthest from all guards.
 */
export function safestBush(world, danger) {
  const p = world.player;
  const dCourier = Math.hypot(danger.x - p.x, danger.y - p.y);
  const cands = LEVEL.bushes.filter(
    (b) =>
      Math.hypot(b.x - danger.x, b.y - danger.y) > dCourier &&
      world.guards.every((g) => Math.hypot(b.x - g.x, b.y - g.y) >= 100),
  );
  if (cands.length > 0) {
    let best = cands[0];
    let bestD = Infinity;
    for (const b of cands) {
      const d = Math.hypot(b.x - p.x, b.y - p.y);
      if (d < bestD) {
        bestD = d;
        best = b;
      }
    }
    return { x: best.x, y: best.y };
  }
  let best = LEVEL.bushes[0];
  let bestD = -Infinity;
  for (const b of LEVEL.bushes) {
    const d = minGuardDist(world, b);
    if (d > bestD) {
      bestD = d;
      best = b;
    }
  }
  return { x: best.x, y: best.y };
}

/**
 * The sticky best bush for a flee: the bush furthest from every guard,
 * discounted by distance from the courier. Recomputed at most every 0.5 s
 * by the caller, so the courier commits instead of dithering.
 */
export function bestBush(world) {
  const p = world.player;
  let best = LEVEL.bushes[0];
  let bestScore = -Infinity;
  for (const b of LEVEL.bushes) {
    const score = minGuardDist(world, b) - 0.3 * Math.hypot(b.x - p.x, b.y - p.y);
    if (score > bestScore) {
      bestScore = score;
      best = b;
    }
  }
  return { x: best.x, y: best.y };
}

function pointSeen(world, pos) {
  return world.guards.some((g) => guardSeesAt(g, pos, { sweep: true }).visible);
}

export function freshMemory() {
  return {
    clock: 0,
    prevPos: null,
    hadInput: false,
    stuckTimer: 0,
    waited: 0,
    detour: false,
    breakout: null,
    bestBush: null,
    bestBushAt: -10,
  };
}

function towardInput(from, to, sneak) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const d = Math.hypot(dx, dy);
  if (d < 1) return { x: 0, y: 0, sneak };
  return { x: dx / d, y: dy / d, sneak };
}

/**
 * One cautious step toward target. Rules, in order: stuck (break for the
 * nearest bush) → flee (chase, or suspicion > 0.6: run the graph route to
 * the sticky best bush, straight away from a guard within 100 px) →
 * exposed (standing inside a cone right now: retreat to the safest bush) →
 * personal space (guard within 100 px: retreat; in a bush with a guard
 * within 150 px: stay) → detour (waited > 2.5 s: retreat until suspicion
 * < 0.2 and no guard within 200 px) → probe (look 1.5 s ahead at sneak
 * speed; if that point is seen, wait instead). The courier always sneaks
 * on the approach — only a chase runs. options.brave skips the
 * flee/exposed/personal-space rules (the alert shot stands its ground).
 * Returns the input used, and applies it to the world.
 */
export function cautiousStep(world, target, memory, dt, options = {}) {
  const p = world.player;
  const brave = !!options.brave;
  const guards = world.guards;
  memory.clock = (memory.clock || 0) + dt;

  // apply one step, remembering where the courier stood BEFORE it so the
  // stuck check can measure how far the last input actually moved it
  const apply = (input) => {
    const before = { x: p.x, y: p.y };
    step(world, input, dt);
    memory.prevPos = before;
    memory.hadInput = Math.hypot(input.x, input.y) > 0.001;
    return input;
  };
  const wait = () => {
    memory.waited = (memory.waited || 0) + dt;
    return apply({ x: 0, y: 0, sneak: true });
  };

  // stuck: the last input moved the courier less than 0.5 px
  if (memory.prevPos && memory.hadInput) {
    const moved = Math.hypot(p.x - memory.prevPos.x, p.y - memory.prevPos.y);
    memory.stuckTimer = moved < 0.5 ? (memory.stuckTimer || 0) + dt : 0;
    if (memory.stuckTimer > 0.1) {
      memory.breakout = nearestBush(p);
      memory.stuckTimer = 0;
    }
  }

  const maxSuspicion = Math.max(...guards.map((g) => g.suspicion));
  const chasing = guards.filter((g) => g.state === 'chase');
  let nearestGuard = guards[0];
  for (const g of guards) {
    if (Math.hypot(g.x - p.x, g.y - p.y) < Math.hypot(nearestGuard.x - p.x, nearestGuard.y - p.y)) {
      nearestGuard = g;
    }
  }
  const nearestDist = Math.hypot(nearestGuard.x - p.x, nearestGuard.y - p.y);
  const seenNow =
    !brave && guards.some((g) => guardSeesAt(g, p, { sweep: true }).visible);
  const inBush = inBushAt(p);
  const avoid = guards.map((g) => ({ x: g.x, y: g.y, r: 60 }));

  // stuck breakout: walk to the nearest bush, then carry on
  if (memory.breakout) {
    if (Math.hypot(p.x - memory.breakout.x, p.y - memory.breakout.y) < 24) {
      memory.breakout = null;
    } else {
      const dest = steerPoint(p, memory.breakout, avoid);
      return apply(towardInput(p, dest, true));
    }
  }

  // flee: a chase, or suspicion over 0.6 — run
  if (!brave && (chasing.length > 0 || maxSuspicion > 0.6)) {
    if (nearestDist < 100) {
      // run straight away from the guard first: the graph route's first
      // node may sit next to the guard
      const dx = p.x - nearestGuard.x;
      const dy = p.y - nearestGuard.y;
      const d = Math.hypot(dx, dy) || 1;
      return apply({ x: dx / d, y: dy / d, sneak: false });
    }
    if (!memory.bestBush || memory.clock - (memory.bestBushAt || -10) > 0.5) {
      memory.bestBush = bestBush(world);
      memory.bestBushAt = memory.clock;
    }
    const dest = steerPoint(p, memory.bestBush, avoid);
    return apply(towardInput(p, dest, false));
  }

  // exposed: standing inside a cone right now — retreat to the safest bush
  if (seenNow) {
    const dest = steerPoint(p, safestBush(world, nearestGuard), avoid);
    return apply(towardInput(p, dest, true));
  }

  // personal space: a guard too close — retreat; in a bush with a guard
  // near — stay put and let it pass
  if (!brave && nearestDist < 100) {
    const dest = steerPoint(p, safestBush(world, nearestGuard), avoid);
    return apply(towardInput(p, dest, true));
  }
  if (!brave && inBush && nearestDist < 150) return wait();

  // detour: waited too long — retreat to a bush until calm and clear
  if ((memory.waited || 0) > 2.5) memory.detour = true;
  if (memory.detour) {
    if (maxSuspicion < 0.2 && nearestDist > 200) {
      memory.detour = false;
      memory.waited = 0;
    } else {
      const dest = steerPoint(p, safestBush(world, nearestGuard), avoid);
      return apply(towardInput(p, dest, true));
    }
  }

  // probe: look 1.5 s ahead at sneak speed; if that point is seen, wait
  const toTarget = { x: target.x - p.x, y: target.y - p.y };
  const targetDist = Math.hypot(toTarget.x, toTarget.y);
  if (targetDist > 1) {
    const ahead = {
      x: p.x + (toTarget.x / targetDist) * PLAYER.sneak * 1.5,
      y: p.y + (toTarget.y / targetDist) * PLAYER.sneak * 1.5,
    };
    if (pointSeen(world, ahead)) return wait();
  }

  // approach: sneak, by the graph when the direct walk is blocked
  memory.waited = 0;
  const dest = steerPoint(p, target, []);
  return apply(towardInput(p, dest, true));
}

/**
 * Walk the targets in order (each reached within 24 px) until done(world)
 * or maxSeconds elapse. Returns the world.
 */
export function runUntil(world, targets, done, maxSeconds) {
  const dt = 1 / 60;
  const memory = freshMemory();
  let idx = 0;
  let t = 0;
  while (t < maxSeconds && world.status === 'playing') {
    if (idx >= targets.length) break;
    const target = targets[idx];
    if (Math.hypot(world.player.x - target.x, world.player.y - target.y) < 24) {
      idx++;
      continue;
    }
    cautiousStep(world, target, memory, dt);
    t += dt;
    if (done && done(world)) break;
  }
  return world;
}

// ---------------------------------------------------------------- staging

const LETTER1 = LEVEL.letters[0];
const LETTER2 = LEVEL.letters[1];
const LETTER3 = LEVEL.letters[2];
const EXIT_CENTRE = {
  x: LEVEL.exit.x + LEVEL.exit.w / 2,
  y: LEVEL.exit.y + LEVEL.exit.h / 2,
};

// The end route: letter 1, across the middle, letter 3, along the north,
// down the east column to letter 2, back up to the gate. 150 s cap.
const END_ROUTE = [
  { x: LETTER1.x, y: LETTER1.y },
  { x: 312, y: 360 },
  { x: 500, y: 360 },
  { x: 600, y: 200 },
  { x: 652, y: 60 },
  { x: LETTER3.x, y: LETTER3.y },
  { x: 900, y: 80 },
  { x: 972, y: 100 },
  { x: 1060, y: 300 },
  { x: LETTER2.x, y: LETTER2.y },
  { x: 1140, y: 300 },
  { x: EXIT_CENTRE.x, y: EXIT_CENTRE.y },
];

/**
 * Stage one shot and return the world in its final frame.
 * start: 5 s of patrolling under the title. play: sneak to letter 1 until
 * it is collected. alert: stand at (260,400) on Wren's path, brave, until
 * chased, then run keeping clear for 2 s. end: the full route, 150 s cap.
 */
export function stageShot(name, seed) {
  const dt = 1 / 60;
  if (name === 'start') {
    const world = createWorld(seed);
    for (let i = 0; i < 5 * 60; i++) step(world, { x: 0, y: 0, sneak: false }, dt);
    return world;
  }
  if (name === 'play') {
    const world = createWorld(seed);
    return runUntil(world, [{ x: LETTER1.x, y: LETTER1.y }], (w) => w.lettersCollected >= 1, 90);
  }
  if (name === 'alert') {
    const world = createWorld(seed);
    world.player.x = 260;
    world.player.y = 400;
    const memory = freshMemory();
    // stand brave on Wren's path until a guard gives chase (40 s cap)
    let t = 0;
    while (t < 40 && world.status === 'playing') {
      if (world.guards.some((g) => g.state === 'chase')) break;
      cautiousStep(world, { x: 260, y: 400 }, memory, dt, { brave: true });
      t += dt;
    }
    // then run, keeping clear, for 2 s — the SPOTTED frame
    t = 0;
    while (t < 2 && world.status === 'playing') {
      cautiousStep(world, safestBush(world, world.guards[0]), memory, dt);
      t += dt;
    }
    return world;
  }
  if (name === 'end') {
    const world = createWorld(seed);
    return runUntil(world, END_ROUTE, (w) => w.status !== 'playing', 150);
  }
  throw new Error(`unknown shot: ${name}`);
}
