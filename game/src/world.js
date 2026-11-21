// Night Post — the pure simulation. No browser globals here, so the tests can
// run it in plain Node: createWorld(seed) + step(world, input, dt).
// Rules: guards see the courier inside a raycast cone with a clear line of
// sight; suspicion 0..1 (0.45 investigate, 1.0 chase); bushes hide, lamps
// expose, running feet make noise; caught on touch by a guard that noticed;
// three letters plus the green gate wins.

import { FIELD, PLAYER, GUARD, SUSPICION, LETTER_PICKUP_RADIUS } from './config.js';
import { LEVEL, solids } from './level.js';
import { mulberry32 } from './random.js';

// ---------------------------------------------------------------- geometry

export function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Smallest signed angle from b to a, wrapped to [-PI, PI]. */
export function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

/**
 * Liang-Barsky: does segment (ax,ay)-(bx,by) touch rect {x,y,w,h}?
 * A segment parallel to an edge and outside the rect is a MISS.
 */
export function segmentIntersectsRect(ax, ay, bx, by, rect) {
  const dx = bx - ax;
  const dy = by - ay;
  const p = [-dx, dx, -dy, dy];
  const q = [ax - rect.x, rect.x + rect.w - ax, ay - rect.y, rect.y + rect.h - ay];
  let t0 = 0;
  let t1 = 1;
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return false; // parallel and outside
      continue;
    }
    const r = q[i] / p[i];
    if (p[i] < 0) {
      if (r > t1) return false;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return false;
      if (r < t1) t1 = r;
    }
  }
  return true;
}

/** Distance from point (px,py) to segment (ax,ay)-(bx,by); t clamped to [0,1]. */
export function segmentNearPoint(ax, ay, bx, by, px, py) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

/** True when the segment is blocked by any solid (optionally inflated by r). */
export function segmentBlocked(ax, ay, bx, by, inflate = 0) {
  for (const s of solids()) {
    const rect =
      inflate === 0
        ? s
        : { x: s.x - inflate, y: s.y - inflate, w: s.w + 2 * inflate, h: s.h + 2 * inflate };
    if (segmentIntersectsRect(ax, ay, bx, by, rect)) return true;
  }
  return false;
}

/** True when a circle at (x,y) radius r overlaps any solid rect. */
export function circleHitsSolids(x, y, r) {
  for (const s of solids()) {
    const cx = Math.max(s.x, Math.min(x, s.x + s.w));
    const cy = Math.max(s.y, Math.min(y, s.y + s.h));
    const dx = x - cx;
    const dy = y - cy;
    if (dx * dx + dy * dy < r * r) return true;
  }
  return false;
}

/** Move a circle axis by axis so it slides along walls instead of sticking. */
export function moveCircle(pos, dx, dy, r) {
  if (dx !== 0 && !circleHitsSolids(pos.x + dx, pos.y, r)) pos.x += dx;
  if (dy !== 0 && !circleHitsSolids(pos.x, pos.y + dy, r)) pos.y += dy;
}

export function inBushAt(pos) {
  return LEVEL.bushes.some((b) => Math.hypot(pos.x - b.x, pos.y - b.y) <= b.r);
}

export function inLampAt(pos) {
  return LEVEL.lamps.some((l) => Math.hypot(pos.x - l.x, pos.y - l.y) <= l.r);
}

// ---------------------------------------------------------------- vision

/**
 * Does this guard see a courier at pos? Inside the cone, within range, with a
 * clear line of sight, and not hidden in a bush beyond close-spotting range.
 * opts.sweep counts a pausing guard's whole scan sweep (its cone swings
 * +/- scanSpeed * pause while it stands at a waypoint).
 */
export function guardSeesAt(guard, pos, opts = {}) {
  const dx = pos.x - guard.x;
  const dy = pos.y - guard.y;
  const d = Math.hypot(dx, dy);
  const inBush = inBushAt(pos);
  const inLamp = inLampAt(pos);
  const result = { visible: false, dist: d, inBush, inLamp };
  if (d > GUARD.visionRange) return result;
  let half = GUARD.halfAngle;
  if (opts.sweep && guard.state === 'patrol' && guard.pauseTimer > 0) {
    half += GUARD.scanSpeed * GUARD.waypointPause;
  }
  if (d > 0.001 && Math.abs(angleDiff(Math.atan2(dy, dx), guard.facing)) > half) return result;
  if (segmentBlocked(guard.x, guard.y, pos.x, pos.y)) return result;
  if (inBush && d > GUARD.bushSpotRange) return result;
  result.visible = true;
  return result;
}

/** guardSees(guard, player) — the player object carries x and y. */
export function guardSees(guard, player) {
  return guardSeesAt(guard, { x: player.x, y: player.y });
}

// ---------------------------------------------------------------- world

export function createWorld(seed) {
  const rng = mulberry32(seed);
  const guards = LEVEL.guards.map((g) => {
    const start = Math.floor(rng() * g.waypoints.length);
    const at = g.waypoints[start];
    const next = g.waypoints[(start + 1) % g.waypoints.length];
    return {
      name: g.name,
      x: at.x,
      y: at.y,
      facing: Math.atan2(next.y - at.y, next.x - at.x),
      speed: g.speed,
      waypoints: g.waypoints.map((w) => ({ x: w.x, y: w.y })),
      waypointIndex: (start + 1) % g.waypoints.length,
      state: 'patrol', // patrol | investigate | chase
      suspicion: 0,
      pauseTimer: 0,
      scanDir: 1,
      lastSeen: null,
      unseenTimer: 0,
      investigateTimer: 0,
      atTarget: false,
      target: null,
    };
  });
  return {
    seed,
    time: 0,
    status: 'playing', // playing | won | caught
    rating: null, // Ghost | Shadow | Seen, once won
    player: { x: LEVEL.playerStart.x, y: LEVEL.playerStart.y, sneaking: false, moving: false },
    letters: LEVEL.letters.map((l) => ({ x: l.x, y: l.y, taken: false })),
    lettersCollected: 0,
    timesSpotted: 0,
    guards,
    noiseTimer: 0,
  };
}

function nearestWaypointIndex(guard) {
  let best = 0;
  let bestD = Infinity;
  guard.waypoints.forEach((w, i) => {
    const d = Math.hypot(w.x - guard.x, w.y - guard.y);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}

function moveToward(guard, tx, ty, speed, dt) {
  const dx = tx - guard.x;
  const dy = ty - guard.y;
  const d = Math.hypot(dx, dy);
  if (d < 0.001) return true;
  const step = speed * dt;
  if (d <= step) {
    guard.x = tx;
    guard.y = ty;
    return true;
  }
  guard.x += (dx / d) * step;
  guard.y += (dy / d) * step;
  guard.facing = Math.atan2(dy, dx);
  return false;
}

/** Advance the world one fixed step. input: {x, y, sneak}. */
export function step(world, input, dt) {
  if (world.status !== 'playing') return;
  world.time += dt;
  const p = world.player;

  // --- courier movement (sneak 85, walk 170), sliding along walls
  const mag = Math.hypot(input.x || 0, input.y || 0);
  p.sneaking = !!input.sneak;
  p.moving = mag > 0.001;
  if (p.moving) {
    const speed = p.sneaking ? PLAYER.sneak : PLAYER.walk;
    const nx = (input.x / mag) * speed * dt;
    const ny = (input.y / mag) * speed * dt;
    moveCircle(p, nx, ny, PLAYER.radius);
    p.x = Math.max(PLAYER.radius, Math.min(FIELD.w - PLAYER.radius, p.x));
    p.y = Math.max(PLAYER.radius, Math.min(FIELD.h - PLAYER.radius, p.y));
  }

  // --- footsteps: every 0.5 s a moving courier makes noise; a patrolling
  // guard inside the noise radius investigates the noise point.
  if (p.moving) {
    world.noiseTimer += dt;
    if (world.noiseTimer >= PLAYER.noiseInterval) {
      world.noiseTimer = 0;
      const radius = p.sneaking ? PLAYER.sneakNoiseRadius : PLAYER.runNoiseRadius;
      for (const g of world.guards) {
        if (g.state !== 'patrol') continue;
        if (Math.hypot(g.x - p.x, g.y - p.y) <= radius) {
          g.state = 'investigate';
          g.target = { x: p.x, y: p.y };
          g.lastSeen = { x: p.x, y: p.y };
          g.investigateTimer = GUARD.investigateTime;
          g.atTarget = false;
          g.pauseTimer = 0;
        }
      }
    }
  } else {
    world.noiseTimer = 0;
  }

  // --- guards: see, suspect, move
  for (const g of world.guards) {
    const seen = guardSees(g, p);
    if (seen.visible) g.lastSeen = { x: p.x, y: p.y };

    // suspicion rises while seen (closer / lit / running / out of bush is worse)
    if (seen.visible) {
      let rate = seen.dist < GUARD.visionRange / 2 ? SUSPICION.closeRate : SUSPICION.farRate;
      if (seen.inLamp) rate *= SUSPICION.lampMultiplier;
      if (p.moving && !p.sneaking) rate *= SUSPICION.runMultiplier;
      if (seen.inBush) rate *= SUSPICION.bushMultiplier;
      g.suspicion = Math.min(1, g.suspicion + rate * dt);
    } else {
      g.suspicion = Math.max(0, g.suspicion - SUSPICION.decay * dt);
    }

    // state changes on suspicion
    if (g.suspicion >= SUSPICION.chaseAt) {
      if (g.state !== 'chase') {
        g.state = 'chase';
        g.unseenTimer = 0;
        world.timesSpotted += 1;
        g.pauseTimer = 0;
        g.atTarget = false;
      }
    } else if (g.suspicion >= SUSPICION.investigateAt && g.state === 'patrol') {
      g.state = 'investigate';
      g.target = g.lastSeen ? { ...g.lastSeen } : { x: p.x, y: p.y };
      g.investigateTimer = GUARD.investigateTime;
      g.atTarget = false;
      g.pauseTimer = 0;
    }

    // movement per state
    if (g.state === 'patrol') {
      if (g.pauseTimer > 0) {
        g.pauseTimer -= dt;
        g.facing += g.scanDir * GUARD.scanSpeed * dt;
      } else {
        const wp = g.waypoints[g.waypointIndex];
        if (moveToward(g, wp.x, wp.y, g.speed, dt)) {
          g.pauseTimer = GUARD.waypointPause;
          g.scanDir = -g.scanDir; // flip the scan direction each pause
          g.waypointIndex = (g.waypointIndex + 1) % g.waypoints.length;
        }
      }
    } else if (g.state === 'investigate') {
      const t = g.target;
      if (!t) {
        g.state = 'patrol';
        g.waypointIndex = nearestWaypointIndex(g);
      } else if (!g.atTarget) {
        if (moveToward(g, t.x, t.y, g.speed * 1.25, dt)) g.atTarget = true;
      } else {
        g.investigateTimer -= dt;
        g.facing += g.scanDir * GUARD.scanSpeed * dt;
        if (g.investigateTimer <= 0) {
          g.state = 'patrol';
          g.atTarget = false;
          g.target = null;
          g.waypointIndex = nearestWaypointIndex(g);
        }
      }
    } else if (g.state === 'chase') {
      moveToward(g, p.x, p.y, GUARD.chaseSpeed, dt);
      if (seen.visible) {
        g.unseenTimer = 0;
      } else {
        g.unseenTimer += dt;
        if (g.unseenTimer >= GUARD.loseSight) {
          g.state = 'investigate';
          g.target = g.lastSeen ? { ...g.lastSeen } : { x: p.x, y: p.y };
          g.investigateTimer = GUARD.investigateTime;
          g.atTarget = false;
        }
      }
    }
  }

  // --- caught: a guard that has noticed the courier (chasing, or seeing it
  // right now) gets within touch distance.
  for (const g of world.guards) {
    const d = Math.hypot(g.x - p.x, g.y - p.y);
    if (d < GUARD.catchRadius && (g.state === 'chase' || guardSees(g, p).visible)) {
      world.status = 'caught';
      return;
    }
  }

  // --- letters, then the gate
  for (const letter of world.letters) {
    if (!letter.taken && Math.hypot(letter.x - p.x, letter.y - p.y) <= LETTER_PICKUP_RADIUS) {
      letter.taken = true;
      world.lettersCollected += 1;
    }
  }
  if (world.lettersCollected >= world.letters.length) {
    const e = LEVEL.exit;
    if (p.x >= e.x && p.x <= e.x + e.w && p.y >= e.y && p.y <= e.y + e.h) {
      world.status = 'won';
      world.rating =
        world.timesSpotted === 0 ? 'Ghost' : world.timesSpotted === 1 ? 'Shadow' : 'Seen';
    }
  }
}
