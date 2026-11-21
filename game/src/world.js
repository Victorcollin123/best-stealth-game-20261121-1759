// Night Post — the pure simulation. No browser globals here, so the
// tests and the autopilot can run it in plain Node.
// The courier collects 3 letters and reaches the green gate unseen.
// Three guards patrol with raycast vision cones; suspicion 0..1 per
// guard (0.45 investigate, 1.0 chase).

import { FIELD_W, FIELD_H, PLAYER, GUARD, SUSPICION, LETTER_PICKUP_RADIUS } from './config.js';
import { BUSHES, LAMPS, LETTERS, PLAYER_START, EXIT, GUARDS, SOLIDS, exitCenter } from './level.js';
import { mulberry32, randInt } from './random.js';

export function dist(ax, ay, bx, by) {
  return Math.hypot(bx - ax, by - ay);
}

export function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// Liang–Barsky: does segment (x1,y1)-(x2,y2) cross rect r?
// A segment parallel to an edge and outside the rect is a MISS.
export function segmentHitsRect(x1, y1, x2, y2, r) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  let t0 = 0;
  let t1 = 1;
  const p = [-dx, dx, -dy, dy];
  const q = [x1 - r.x, r.x + r.w - x1, y1 - r.y, r.y + r.h - y1];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return false; // parallel and outside: a miss
      continue;
    }
    const t = q[i] / p[i];
    if (p[i] < 0) {
      if (t > t1) return false;
      if (t > t0) t0 = t;
    } else {
      if (t < t0) return false;
      if (t < t1) t1 = t;
    }
  }
  return t0 <= t1;
}

export function segmentBlocked(x1, y1, x2, y2) {
  for (const s of SOLIDS) {
    if (segmentHitsRect(x1, y1, x2, y2, s)) return true;
  }
  return false;
}

// Closest point on segment ab to point p, with t clamped to [0,1].
export function segmentNearPoint(ax, ay, bx, by, px, py) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return { x: cx, y: cy, dist: Math.hypot(px - cx, py - cy), t };
}

export function bushAt(x, y) {
  for (const b of BUSHES) {
    if (dist(x, y, b.x, b.y) <= b.r) return b;
  }
  return null;
}

export function lampAt(x, y) {
  for (const l of LAMPS) {
    if (dist(x, y, l.x, l.y) <= l.r) return l;
  }
  return null;
}

function circleHitsSolid(x, y, radius) {
  for (const s of SOLIDS) {
    const cx = Math.max(s.x, Math.min(x, s.x + s.w));
    const cy = Math.max(s.y, Math.min(y, s.y + s.h));
    if (dist(x, y, cx, cy) < radius) return s;
  }
  return null;
}

// Push a circle out of every solid it overlaps, one axis at a time.
export function resolveCollisions(body, radius) {
  for (let pass = 0; pass < 3; pass++) {
    const s = circleHitsSolid(body.x, body.y, radius);
    if (!s) break;
    const cx = Math.max(s.x, Math.min(body.x, s.x + s.w));
    const cy = Math.max(s.y, Math.min(body.y, s.y + s.h));
    let dx = body.x - cx;
    let dy = body.y - cy;
    if (dx === 0 && dy === 0) {
      // Centre inside the rect: push out along the smallest overlap.
      const left = body.x - s.x;
      const right = s.x + s.w - body.x;
      const top = body.y - s.y;
      const bottom = s.y + s.h - body.y;
      const m = Math.min(left, right, top, bottom);
      if (m === left) body.x = s.x - radius;
      else if (m === right) body.x = s.x + s.w + radius;
      else if (m === top) body.y = s.y - radius;
      else body.y = s.y + s.h + radius;
      continue;
    }
    const d = Math.hypot(dx, dy);
    dx /= d;
    dy /= d;
    body.x = cx + dx * radius;
    body.y = cy + dy * radius;
  }
  body.x = Math.max(GUARD.radius, Math.min(FIELD_W - GUARD.radius, body.x));
  body.y = Math.max(GUARD.radius, Math.min(FIELD_H - GUARD.radius, body.y));
}

export function createWorld(seed = 1) {
  const rng = mulberry32(seed);
  const guards = GUARDS.map((g) => {
    const startIndex = randInt(rng, g.waypoints.length);
    const wp = g.waypoints[startIndex];
    const next = g.waypoints[(startIndex + 1) % g.waypoints.length];
    return {
      name: g.name,
      speed: g.speed,
      waypoints: g.waypoints,
      x: wp.x,
      y: wp.y,
      facing: Math.atan2(next.y - wp.y, next.x - wp.x),
      baseFacing: Math.atan2(next.y - wp.y, next.x - wp.x),
      waypointIndex: (startIndex + 1) % g.waypoints.length,
      state: 'patrol', // patrol | pause | investigate | chase | return
      suspicion: 0,
      pauseTimer: 0,
      scanDir: 1,
      scanOffset: 0,
      scanTimer: 0,
      loseTimer: 0,
      lastSeen: null,
      investigateTarget: null,
      returnTarget: null,
      chasing: false,
    };
  });
  return {
    seed,
    time: 0,
    status: 'playing', // title | playing | won | caught
    timesSpotted: 0,
    letters: LETTERS.map((l) => ({ x: l.x, y: l.y, collected: false })),
    lettersCollected: 0,
    player: {
      x: PLAYER_START.x,
      y: PLAYER_START.y,
      moving: false,
      sneaking: false,
      running: false,
      facing: -Math.PI / 2,
    },
    guards,
    noiseTimer: 0,
    exit: { ...EXIT },
  };
}

// Does this guard see the courier right now?
// Returns { visible, dist, inBush, inLamp }.
export function guardSees(guard, player) {
  const d = dist(guard.x, guard.y, player.x, player.y);
  const inBush = bushAt(player.x, player.y) !== null;
  const inLamp = lampAt(player.x, player.y) !== null;
  if (d > GUARD.visionRange) return { visible: false, dist: d, inBush, inLamp };
  if (inBush && d > GUARD.bushSpotRange) return { visible: false, dist: d, inBush, inLamp };
  const ang = Math.atan2(player.y - guard.y, player.x - guard.x);
  if (Math.abs(angleDiff(ang, guard.facing)) > GUARD.visionHalfAngle) {
    return { visible: false, dist: d, inBush, inLamp };
  }
  if (segmentBlocked(guard.x, guard.y, player.x, player.y)) {
    return { visible: false, dist: d, inBush, inLamp };
  }
  return { visible: true, dist: d, inBush, inLamp };
}

function moveToward(body, tx, ty, speed, dt) {
  const d = dist(body.x, body.y, tx, ty);
  if (d < 0.001) return true;
  const stepLen = speed * dt;
  if (stepLen >= d) {
    body.x = tx;
    body.y = ty;
    return true;
  }
  body.x += ((tx - body.x) / d) * stepLen;
  body.y += ((ty - body.y) / d) * stepLen;
  return false;
}

function stepGuard(world, guard, dt) {
  const player = world.player;
  const seen = guardSees(guard, player);

  // --- suspicion ---
  if (seen.visible) {
    let rate = seen.dist < GUARD.visionRange / 2 ? SUSPICION.closeRate : SUSPICION.farRate;
    if (seen.inLamp) rate *= SUSPICION.lampMultiplier;
    if (player.running) rate *= SUSPICION.runMultiplier;
    if (seen.inBush) rate *= SUSPICION.bushMultiplier;
    guard.suspicion = Math.min(1, guard.suspicion + rate * dt);
    guard.lastSeen = { x: player.x, y: player.y };
    guard.loseTimer = 0;
  } else {
    guard.suspicion = Math.max(0, guard.suspicion - SUSPICION.decayRate * dt);
    if (guard.state === 'chase') {
      guard.loseTimer += dt;
      if (guard.loseTimer >= GUARD.loseSightTime) {
        guard.state = 'investigate';
        guard.investigateTarget = guard.lastSeen
          ? { ...guard.lastSeen }
          : { x: guard.x, y: guard.y };
        guard.scanTimer = 0;
        guard.chasing = false;
      }
    }
  }

  // --- state transitions from suspicion ---
  if (guard.suspicion >= SUSPICION.chaseAt && guard.state !== 'chase') {
    guard.state = 'chase';
    if (!guard.chasing) {
      guard.chasing = true;
      world.timesSpotted += 1;
    }
  } else if (
    guard.suspicion >= SUSPICION.investigateAt &&
    guard.state !== 'chase' &&
    guard.state !== 'investigate'
  ) {
    guard.state = 'investigate';
    guard.investigateTarget = guard.lastSeen
      ? { ...guard.lastSeen }
      : { x: player.x, y: player.y };
    guard.scanTimer = 0;
  }

  // --- movement by state ---
  if (guard.state === 'chase') {
    guard.facing = Math.atan2(player.y - guard.y, player.x - guard.x);
    moveToward(guard, player.x, player.y, GUARD.chaseSpeed, dt);
    resolveCollisions(guard, GUARD.radius);
  } else if (guard.state === 'investigate') {
    const t = guard.investigateTarget;
    if (t) {
      guard.facing = Math.atan2(t.y - guard.y, t.x - guard.x);
      const arrived = moveToward(guard, t.x, t.y, guard.speed * 1.25, dt);
      resolveCollisions(guard, GUARD.radius);
      if (arrived) {
        guard.scanTimer += dt;
        // Scan the cone while standing at the investigated point.
        guard.scanOffset += guard.scanDir * GUARD.scanSpeed * dt;
        if (guard.scanOffset > 0.9) { guard.scanOffset = 0.9; guard.scanDir = -1; }
        if (guard.scanOffset < -0.9) { guard.scanOffset = -0.9; guard.scanDir = 1; }
        guard.facing = guard.baseFacing + guard.scanOffset;
        if (guard.scanTimer >= GUARD.investigateTime) {
          guard.state = 'return';
          guard.returnTarget = null;
          guard.scanOffset = 0;
        }
      }
    }
  } else if (guard.state === 'return') {
    // Walk back to the nearest waypoint, then resume the patrol loop.
    if (!guard.returnTarget) {
      let best = null;
      let bestD = Infinity;
      for (const wp of guard.waypoints) {
        const d = dist(guard.x, guard.y, wp.x, wp.y);
        if (d < bestD) { bestD = d; best = wp; }
      }
      guard.returnTarget = best;
      guard.waypointIndex = guard.waypoints.indexOf(best);
    }
    const t = guard.returnTarget;
    guard.facing = Math.atan2(t.y - guard.y, t.x - guard.x);
    const arrived = moveToward(guard, t.x, t.y, guard.speed, dt);
    resolveCollisions(guard, GUARD.radius);
    if (arrived) {
      guard.state = 'patrol';
      guard.baseFacing = guard.facing;
    }
  } else if (guard.state === 'pause') {
    guard.pauseTimer -= dt;
    guard.scanOffset += guard.scanDir * GUARD.scanSpeed * dt;
    if (guard.scanOffset > 0.9) { guard.scanOffset = 0.9; guard.scanDir = -1; }
    if (guard.scanOffset < -0.9) { guard.scanOffset = -0.9; guard.scanDir = 1; }
    guard.facing = guard.baseFacing + guard.scanOffset;
    if (guard.pauseTimer <= 0) {
      guard.state = 'patrol';
      guard.scanOffset = 0;
    }
  } else {
    // patrol
    const wp = guard.waypoints[guard.waypointIndex];
    guard.facing = Math.atan2(wp.y - guard.y, wp.x - guard.x);
    const arrived = moveToward(guard, wp.x, wp.y, guard.speed, dt);
    resolveCollisions(guard, GUARD.radius);
    if (arrived) {
      guard.waypointIndex = (guard.waypointIndex + 1) % guard.waypoints.length;
      const next = guard.waypoints[guard.waypointIndex];
      guard.baseFacing = Math.atan2(next.y - guard.y, next.x - guard.x);
      guard.facing = guard.baseFacing;
      guard.state = 'pause';
      guard.pauseTimer = GUARD.waypointPause;
      guard.scanDir = guard.scanDir === 1 ? -1 : 1; // flip each pause
      guard.scanOffset = 0;
    }
  }

  // --- caught? A guard that has noticed the courier and closes in. ---
  const d = dist(guard.x, guard.y, player.x, player.y);
  if (
    d < GUARD.catchRadius &&
    (guard.state === 'chase' || guard.state === 'investigate' || guard.suspicion >= SUSPICION.investigateAt)
  ) {
    world.status = 'caught';
  }
}

// Advance the world one fixed step. input: {dx, dy, sneak} with dx/dy
// a unit-ish direction vector (0,0) to stand still.
export function step(world, input, dt) {
  if (world.status !== 'playing') return world;
  world.time += dt;
  const player = world.player;

  // --- player movement ---
  const mag = Math.hypot(input.dx || 0, input.dy || 0);
  player.moving = mag > 0.01;
  player.sneaking = !!input.sneak && player.moving;
  player.running = player.moving && !player.sneaking;
  if (player.moving) {
    const speed = player.sneaking ? PLAYER.sneakSpeed : PLAYER.walkSpeed;
    const nx = (input.dx || 0) / (mag || 1);
    const ny = (input.dy || 0) / (mag || 1);
    player.facing = Math.atan2(ny, nx);
    player.x += nx * speed * dt;
    player.y += ny * speed * dt;
    resolveCollisions(player, PLAYER.radius);
  }

  // --- footsteps: a moving courier makes noise on a timer ---
  world.noiseTimer += dt;
  if (player.moving && world.noiseTimer >= PLAYER.noiseInterval) {
    world.noiseTimer = 0;
    const radius = player.sneaking ? PLAYER.sneakNoiseRadius : PLAYER.runNoiseRadius;
    for (const guard of world.guards) {
      if (guard.state !== 'patrol' && guard.state !== 'pause') continue;
      if (dist(guard.x, guard.y, player.x, player.y) <= radius) {
        guard.state = 'investigate';
        guard.investigateTarget = { x: player.x, y: player.y };
        guard.scanTimer = 0;
      }
    }
  }

  // --- letters ---
  for (const letter of world.letters) {
    if (!letter.collected && dist(player.x, player.y, letter.x, letter.y) <= LETTER_PICKUP_RADIUS) {
      letter.collected = true;
      world.lettersCollected += 1;
    }
  }

  // --- guards ---
  for (const guard of world.guards) {
    stepGuard(world, guard, dt);
    if (world.status === 'caught') return world;
  }

  // --- exit: all three letters, then reach the green gate ---
  if (world.lettersCollected >= 3) {
    const e = world.exit;
    if (player.x >= e.x && player.x <= e.x + e.w && player.y >= e.y && player.y <= e.y + e.h) {
      world.status = 'won';
    }
  }
  return world;
}

export function winRating(world) {
  if (world.timesSpotted === 0) return 'Ghost';
  if (world.timesSpotted === 1) return 'Shadow';
  return 'Seen';
}

export { exitCenter };
