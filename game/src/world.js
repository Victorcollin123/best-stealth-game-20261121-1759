// Night Post — the simulation. Pure and deterministic: createWorld(seed)
// then step(world, input, dt) at 60 Hz. No DOM, no audio here, so the
// tests and the browser loop share exactly this code.

import {
  FIELD_W,
  FIELD_H,
  PLAYER_RADIUS,
  PLAYER_WALK,
  PLAYER_SNEAK,
  PLAYER_PICKUP,
  NOISE_RUN,
  NOISE_SNEAK,
  NOISE_INTERVAL,
  GUARD_RADIUS,
  VISION_RANGE,
  VISION_HALF_ANGLE,
  CATCH_RADIUS,
  BUSH_SPOT,
  WAYPOINT_PAUSE,
  SCAN_SPEED,
  SCAN_AMPLITUDE,
  LOSE_SIGHT,
  INVESTIGATE_TIME,
  CHASE_SPEED,
  INVESTIGATE_SPEED_MUL,
  SUSPICION_CLOSE_RATE,
  SUSPICION_FAR_RATE,
  SUSPICION_CLOSE_DIST,
  SUSPICION_LAMP_MUL,
  SUSPICION_RUN_MUL,
  SUSPICION_BUSH_MUL,
  SUSPICION_DECAY,
  SUSPICION_INVESTIGATE,
  SUSPICION_CHASE,
} from './config.js';
import {
  WALLS,
  CRATES,
  BUSHES,
  LAMPS,
  LETTERS,
  PLAYER_START,
  EXIT_RECT,
  GUARDS,
} from './level.js';
import { mulberry32 } from './random.js';

export function solids() {
  return WALLS.concat(CRATES);
}

export function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

export function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

// Liang-Barsky: true when the segment touches or enters the rect.
// A segment parallel to an axis and outside the rect is a MISS — the
// guard against a zero-length projection must not report a hit.
export function segmentHitsRect(x1, y1, x2, y2, r) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  let t0 = 0;
  let t1 = 1;
  const p = [-dx, dx, -dy, dy];
  const q = [x1 - r.x, r.x + r.w - x1, y1 - r.y, r.y + r.h - y1];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return false;
    } else {
      const t = q[i] / p[i];
      if (p[i] < 0) {
        if (t > t1) return false;
        if (t > t0) t0 = t;
      } else {
        if (t < t0) return false;
        if (t < t1) t1 = t;
      }
    }
  }
  return true;
}

export function segmentBlocked(x1, y1, x2, y2) {
  for (const s of solids()) {
    if (segmentHitsRect(x1, y1, x2, y2, s)) return true;
  }
  return false;
}

// Same test with each solid inflated by pad: a corridor the courier's
// body (radius pad) can actually travel through.
export function segmentClearOfWalls(x1, y1, x2, y2, pad) {
  for (const s of solids()) {
    const r = { x: s.x - pad, y: s.y - pad, w: s.w + pad * 2, h: s.h + pad * 2 };
    if (segmentHitsRect(x1, y1, x2, y2, r)) return false;
  }
  return true;
}

export function pointInBush(x, y) {
  return BUSHES.some((b) => dist(x, y, b.x, b.y) <= b.r);
}

export function pointInLamp(x, y) {
  return LAMPS.some((l) => dist(x, y, l.x, l.y) <= l.r);
}

function circleHitsSolids(x, y, r) {
  for (const s of solids()) {
    const cx = Math.max(s.x, Math.min(x, s.x + s.w));
    const cy = Math.max(s.y, Math.min(y, s.y + s.h));
    if (dist(x, y, cx, cy) < r) return true;
  }
  return false;
}

// Axis-separated slide: try x, then y, so a walker slides along walls
// instead of stopping dead on a corner.
function moveWithCollision(e, dx, dy, r) {
  const nx = e.x + dx;
  if (!circleHitsSolids(nx, e.y, r) && nx - r >= 0 && nx + r <= FIELD_W) e.x = nx;
  const ny = e.y + dy;
  if (!circleHitsSolids(e.x, ny, r) && ny - r >= 0 && ny + r <= FIELD_H) e.y = ny;
}

function moveGuard(g, nx, ny) {
  if (!circleHitsSolids(nx, g.y, GUARD_RADIUS)) g.x = nx;
  if (!circleHitsSolids(g.x, ny, GUARD_RADIUS)) g.y = ny;
}

export function createWorld(seed) {
  const rng = mulberry32(seed);
  const guards = GUARDS.map((g) => {
    const start = Math.floor(rng() * g.patrol.length);
    const wp = (start + 1) % g.patrol.length;
    const [x, y] = g.patrol[start];
    const [tx, ty] = g.patrol[wp];
    return {
      name: g.name,
      x,
      y,
      patrol: g.patrol,
      wp,
      speed: g.speed,
      facing: Math.atan2(ty - y, tx - x),
      baseFacing: Math.atan2(ty - y, tx - x),
      suspicion: 0,
      state: 'patrol',
      pause: 0,
      scanDir: 1,
      scanOffset: 0,
      lastSeen: null,
      seenTimer: 0,
      investigateTimer: 0,
      target: null,
      stuckTimer: 0,
      lastDist: Infinity,
    };
  });
  return {
    seed,
    time: 0,
    status: 'playing',
    rating: null,
    player: {
      x: PLAYER_START.x,
      y: PLAYER_START.y,
      moving: false,
      sneaking: false,
      running: false,
    },
    guards,
    letters: LETTERS.map((l) => ({ x: l.x, y: l.y, collected: false })),
    lettersCollected: 0,
    timesSpotted: 0,
    noiseTimer: 0,
  };
}

// Can this guard see the point right now? sweep=true counts a pausing
// guard's whole scan arc (the autopilot's cautious view); the live
// simulation always passes false and uses the guard's current facing.
export function guardSees(guard, px, py, sweep) {
  const dx = px - guard.x;
  const dy = py - guard.y;
  const d = Math.hypot(dx, dy);
  const inBush = pointInBush(px, py);
  const inLamp = pointInLamp(px, py);
  const half = VISION_HALF_ANGLE + (sweep && guard.pause > 0 ? SCAN_AMPLITUDE : 0);
  if (d > VISION_RANGE) return { visible: false, dist: d, inBush, inLamp };
  const ang = Math.atan2(dy, dx);
  if (Math.abs(angleDiff(ang, guard.facing)) > half) {
    return { visible: false, dist: d, inBush, inLamp };
  }
  if (segmentBlocked(guard.x, guard.y, px, py)) {
    return { visible: false, dist: d, inBush, inLamp };
  }
  if (inBush && d > BUSH_SPOT) {
    return { visible: false, dist: d, inBush, inLamp };
  }
  return { visible: true, dist: d, inBush, inLamp };
}

export function seenAt(world, x, y) {
  for (const g of world.guards) {
    if (guardSees(g, x, y, true).visible) return true;
  }
  return false;
}

export function anyChasing(world) {
  return world.guards.some((g) => g.state === 'chase');
}

export function maxSuspicion(world) {
  let m = 0;
  for (const g of world.guards) m = Math.max(m, g.suspicion);
  return m;
}

function returnToPatrol(g) {
  let best = 0;
  let bd = Infinity;
  g.patrol.forEach((w, i) => {
    const dd = dist(g.x, g.y, w[0], w[1]);
    if (dd < bd) {
      bd = dd;
      best = i;
    }
  });
  g.wp = best;
  g.state = 'patrol';
  g.pause = 0;
  g.scanOffset = 0;
  g.scanDir = 1;
  g.stuckTimer = 0;
  const [tx, ty] = g.patrol[g.wp];
  g.baseFacing = Math.atan2(ty - g.y, tx - g.x);
  g.facing = g.baseFacing;
}

export function step(world, input, dt) {
  if (world.status !== 'playing') return;
  world.time += dt;
  const p = world.player;

  // --- courier movement ---
  let mx = input.x || 0;
  let my = input.y || 0;
  const len = Math.hypot(mx, my);
  if (len > 1) {
    mx /= len;
    my /= len;
  }
  const sneaking = !!input.sneak;
  const speed = sneaking ? PLAYER_SNEAK : PLAYER_WALK;
  const ox = p.x;
  const oy = p.y;
  moveWithCollision(p, mx * speed * dt, my * speed * dt, PLAYER_RADIUS);
  p.moving = p.x !== ox || p.y !== oy;
  p.sneaking = sneaking;
  p.running = p.moving && !sneaking;

  // --- noise: every 0.5 s a moving courier pings nearby patrolling guards ---
  if (p.moving) {
    world.noiseTimer += dt;
    if (world.noiseTimer >= NOISE_INTERVAL) {
      world.noiseTimer = 0;
      const radius = sneaking ? NOISE_SNEAK : NOISE_RUN;
      for (const g of world.guards) {
        if (g.state === 'patrol' && dist(g.x, g.y, p.x, p.y) <= radius) {
          g.state = 'investigate';
          g.target = { x: p.x, y: p.y };
          g.investigateTimer = 0;
          g.stuckTimer = 0;
          g.lastDist = Infinity;
        }
      }
    }
  } else {
    world.noiseTimer = 0;
  }

  // --- letters ---
  for (const l of world.letters) {
    if (!l.collected && dist(p.x, p.y, l.x, l.y) <= PLAYER_PICKUP) {
      l.collected = true;
      world.lettersCollected++;
    }
  }

  // --- exit: only once every letter is carried ---
  if (world.lettersCollected === world.letters.length) {
    const e = EXIT_RECT;
    if (p.x >= e.x && p.x <= e.x + e.w && p.y >= e.y && p.y <= e.y + e.h) {
      world.status = 'won';
      world.rating =
        world.timesSpotted === 0 ? 'Ghost' : world.timesSpotted === 1 ? 'Shadow' : 'Seen';
      return;
    }
  }

  // --- guards ---
  for (const g of world.guards) {
    const sight = guardSees(g, p.x, p.y, false);
    if (sight.visible) {
      let rate = sight.dist < SUSPICION_CLOSE_DIST ? SUSPICION_CLOSE_RATE : SUSPICION_FAR_RATE;
      if (sight.inLamp) rate *= SUSPICION_LAMP_MUL;
      if (p.running) rate *= SUSPICION_RUN_MUL;
      if (sight.inBush) rate *= SUSPICION_BUSH_MUL;
      g.suspicion = Math.min(1, g.suspicion + rate * dt);
      g.lastSeen = { x: p.x, y: p.y };
      g.seenTimer = 0;
      if (g.suspicion >= SUSPICION_CHASE && g.state !== 'chase') {
        g.state = 'chase';
        world.timesSpotted++;
      } else if (g.suspicion >= SUSPICION_INVESTIGATE && g.state === 'patrol') {
        g.state = 'investigate';
        g.target = { x: g.lastSeen.x, y: g.lastSeen.y };
        g.investigateTimer = 0;
        g.stuckTimer = 0;
        g.lastDist = Infinity;
      }
    } else {
      g.suspicion = Math.max(0, g.suspicion - SUSPICION_DECAY * dt);
      if (g.state === 'chase') {
        g.seenTimer += dt;
        if (g.seenTimer >= LOSE_SIGHT) {
          g.state = 'investigate';
          g.target = g.lastSeen ? { x: g.lastSeen.x, y: g.lastSeen.y } : { x: g.x, y: g.y };
          g.investigateTimer = 0;
          g.stuckTimer = 0;
          g.lastDist = Infinity;
        }
      }
    }

    if (g.state === 'patrol') {
      if (g.pause > 0) {
        g.pause -= dt;
        g.scanOffset += g.scanDir * SCAN_SPEED * dt;
        if (g.scanOffset > SCAN_AMPLITUDE) {
          g.scanOffset = SCAN_AMPLITUDE;
          g.scanDir = -1;
        }
        if (g.scanOffset < -SCAN_AMPLITUDE) {
          g.scanOffset = -SCAN_AMPLITUDE;
          g.scanDir = 1;
        }
        g.facing = g.baseFacing + g.scanOffset;
        if (g.pause <= 0) {
          g.scanOffset = 0;
          g.scanDir = 1;
        }
      } else {
        const [tx, ty] = g.patrol[g.wp];
        const d = dist(g.x, g.y, tx, ty);
        const stepLen = g.speed * dt;
        if (d <= Math.max(stepLen, 2)) {
          g.x = tx;
          g.y = ty;
          g.wp = (g.wp + 1) % g.patrol.length;
          g.pause = WAYPOINT_PAUSE;
          g.baseFacing = Math.atan2(g.patrol[g.wp][1] - g.y, g.patrol[g.wp][0] - g.x);
          g.facing = g.baseFacing;
        } else {
          const nx = g.x + ((tx - g.x) / d) * stepLen;
          const ny = g.y + ((ty - g.y) / d) * stepLen;
          moveGuard(g, nx, ny);
          g.facing = Math.atan2(ty - g.y, tx - g.x);
          g.baseFacing = g.facing;
        }
      }
    } else if (g.state === 'investigate') {
      const t = g.target || { x: g.x, y: g.y };
      const d = dist(g.x, g.y, t.x, t.y);
      const stepLen = g.speed * INVESTIGATE_SPEED_MUL * dt;
      if (d <= Math.max(stepLen, 2)) {
        g.x = t.x;
        g.y = t.y;
        g.investigateTimer += dt;
        g.scanOffset += g.scanDir * SCAN_SPEED * dt;
        if (g.scanOffset > SCAN_AMPLITUDE) {
          g.scanOffset = SCAN_AMPLITUDE;
          g.scanDir = -1;
        }
        if (g.scanOffset < -SCAN_AMPLITUDE) {
          g.scanOffset = -SCAN_AMPLITUDE;
          g.scanDir = 1;
        }
        g.facing = g.baseFacing + g.scanOffset;
        if (g.investigateTimer >= INVESTIGATE_TIME) returnToPatrol(g);
      } else {
        // Stuck against a wall for 2 s without closing: give up, go home.
        if (d >= g.lastDist - 0.5) {
          g.stuckTimer += dt;
        } else {
          g.stuckTimer = 0;
        }
        g.lastDist = d;
        if (g.stuckTimer >= 2) {
          returnToPatrol(g);
        } else {
          const nx = g.x + ((t.x - g.x) / d) * stepLen;
          const ny = g.y + ((t.y - g.y) / d) * stepLen;
          moveGuard(g, nx, ny);
          g.facing = Math.atan2(t.y - g.y, t.x - g.x);
          g.baseFacing = g.facing;
        }
      }
    } else if (g.state === 'chase') {
      const d = dist(g.x, g.y, p.x, p.y);
      const stepLen = CHASE_SPEED * dt;
      if (d > 0.01) {
        const m = Math.min(stepLen, d);
        const nx = g.x + ((p.x - g.x) / d) * m;
        const ny = g.y + ((p.y - g.y) / d) * m;
        moveGuard(g, nx, ny);
      }
      g.facing = Math.atan2(p.y - g.y, p.x - g.x);
      g.baseFacing = g.facing;
    }

    // --- caught: a guard that has noticed the courier, within reach ---
    const noticed = g.state === 'chase' || sight.visible;
    if (noticed && dist(g.x, g.y, p.x, p.y) < CATCH_RADIUS) {
      world.status = 'caught';
      return;
    }
  }
}
