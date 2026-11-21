// Night Post: the whole simulation, with no browser in it. The renderer only
// draws this state; the input loop only feeds it a direction and a sneak flag.
// That split is what lets the game be unit-tested in plain Node and the
// screenshots be played forward by a script that uses the real rules. Every
// number comes from config.js.

import { FIELD, STEP, PLAYER, GUARD, SUSPICION, LETTERS_TO_WIN, LETTER_PICKUP_RADIUS } from './config.js';
import { LEVEL } from './level.js';
import { createRandom } from './random.js';

/** The solid things: walls plus crates. Bushes and lamps are not solid. */
export const SOLIDS = [...LEVEL.walls, ...LEVEL.crates];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function wrapAngle(angle) {
  while (angle > Math.PI) angle -= Math.PI * 2;
  while (angle < -Math.PI) angle += Math.PI * 2;
  return angle;
}

function distance(ax, ay, bx, by) {
  return Math.hypot(bx - ax, by - ay);
}

/** True when a circle overlaps a rectangle. */
export function circleHitsRect(x, y, radius, rect) {
  const closestX = clamp(x, rect.x, rect.x + rect.w);
  const closestY = clamp(y, rect.y, rect.y + rect.h);
  return distance(x, y, closestX, closestY) < radius;
}

/** True when a circle overlaps any solid rectangle. */
export function circleHitsAny(x, y, radius, solids = SOLIDS) {
  for (const rect of solids) {
    if (circleHitsRect(x, y, radius, rect)) return true;
  }
  return false;
}

/** Move a circle by (dx, dy), sliding along walls: try each axis on its own. */
export function moveCircle(pos, radius, dx, dy, solids = SOLIDS) {
  const nextX = pos.x + dx;
  if (!circleHitsAny(nextX, pos.y, radius, solids)) pos.x = nextX;
  const nextY = pos.y + dy;
  if (!circleHitsAny(pos.x, nextY, radius, solids)) pos.y = nextY;
  return pos;
}

/** True when the segment from (ax, ay) to (bx, by) crosses a rectangle. */
export function segmentHitsRect(ax, ay, bx, by, rect) {
  const dx = bx - ax;
  const dy = by - ay;
  let tMin = 0;
  let tMax = 1;
  // Liang-Barsky clipping against the rectangle's four sides.
  const sides = [
    [-dx, ax - rect.x],
    [dx, rect.x + rect.w - ax],
    [-dy, ay - rect.y],
    [dy, rect.y + rect.h - ay],
  ];
  for (const [p, q] of sides) {
    if (p === 0) {
      if (q < 0) return false; // Parallel to this side and outside it: the segment misses.
    } else {
      const t = q / p;
      if (p < 0) {
        if (t > tMax) return false;
        if (t > tMin) tMin = t;
      } else {
        if (t < tMin) return false;
        if (t < tMax) tMax = t;
      }
    }
  }
  return tMin <= tMax;
}

/** True when the segment crosses any solid rectangle. */
export function segmentBlocked(ax, ay, bx, by, solids = SOLIDS) {
  for (const rect of solids) {
    if (segmentHitsRect(ax, ay, bx, by, rect)) return true;
  }
  return false;
}

export function pointInBush(x, y) {
  return LEVEL.bushes.some((bush) => distance(x, y, bush.x, bush.y) <= bush.r);
}

export function pointInLamp(x, y) {
  return LEVEL.lamps.some((lamp) => distance(x, y, lamp.x, lamp.y) <= lamp.r);
}

export function pointInExit(x, y) {
  const exit = LEVEL.exit;
  return x >= exit.x && x <= exit.x + exit.w && y >= exit.y && y <= exit.y + exit.h;
}

/**
 * What a guard makes of the courier right now. Visible means the courier is
 * inside the vision cone, within range, with a clear line of sight, and not
 * hidden in a bush beyond the close-spotting range. The returned factors
 * explain the suspicion rate.
 */
export function guardSees(guard, player) {
  const dist = distance(guard.x, guard.y, player.x, player.y);
  if (dist > GUARD.visionRange) return { visible: false, dist };
  const angleToPlayer = Math.atan2(player.y - guard.y, player.x - guard.x);
  if (Math.abs(wrapAngle(angleToPlayer - guard.angle)) > GUARD.visionHalfAngle) {
    return { visible: false, dist };
  }
  if (segmentBlocked(guard.x, guard.y, player.x, player.y)) return { visible: false, dist };
  const inBush = pointInBush(player.x, player.y);
  if (inBush && dist > GUARD.bushSpotRange) return { visible: false, dist, inBush };
  return { visible: true, dist, inBush, inLamp: pointInLamp(player.x, player.y) };
}

/** A fresh world for a seed. The seed only offsets where each guard starts its loop. */
export function createWorld(seed = 1) {
  const random = createRandom(seed);
  const guards = LEVEL.guards.map((def) => {
    const startIndex = Math.floor(random() * def.waypoints.length);
    const start = def.waypoints[startIndex];
    const next = def.waypoints[(startIndex + 1) % def.waypoints.length];
    return {
      name: def.name,
      x: start.x,
      y: start.y,
      angle: Math.atan2(next.y - start.y, next.x - start.x),
      waypoints: def.waypoints,
      waypointIndex: (startIndex + 1) % def.waypoints.length,
      patrolSpeed: def.speed,
      state: 'patrol',
      suspicion: 0,
      target: null,
      pauseTimer: 0,
      loseSightTimer: 0,
      investigateTimer: 0,
      scanDirection: 1,
    };
  });
  return {
    seed,
    time: 0,
    status: 'playing', // 'playing' | 'won' | 'caught'
    player: {
      x: LEVEL.playerStart.x,
      y: LEVEL.playerStart.y,
      angle: -Math.PI / 2,
      sneaking: false,
      moving: false,
    },
    guards,
    letters: LEVEL.letters.map((letter) => ({ ...letter, taken: false })),
    lettersCollected: 0,
    timesSpotted: 0,
    winTime: null,
    noiseTimer: 0,
  };
}

/** How fast suspicion rises while this guard sees the courier. */
function suspicionRate(guard, player, seen) {
  const closeness = 1 - seen.dist / GUARD.visionRange;
  let rate = SUSPICION.farRate + (SUSPICION.closeRate - SUSPICION.farRate) * closeness;
  if (seen.inLamp) rate *= SUSPICION.lampMultiplier;
  if (!player.sneaking && player.moving) rate *= SUSPICION.runMultiplier;
  if (seen.inBush) rate *= 0.5;
  return rate;
}

function nearestWaypointIndex(guard) {
  let best = 0;
  let bestDist = Infinity;
  guard.waypoints.forEach((point, index) => {
    const d = distance(guard.x, guard.y, point.x, point.y);
    if (d < bestDist) {
      bestDist = d;
      best = index;
    }
  });
  return best;
}

function moveGuardToward(guard, target, speed, dt) {
  const dx = target.x - guard.x;
  const dy = target.y - guard.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 1) return true;
  const step = Math.min(speed * dt, dist);
  guard.angle = Math.atan2(dy, dx);
  moveCircle(guard, GUARD.radius, (dx / dist) * step, (dy / dist) * step);
  return dist - step < 8;
}

function enterState(guard, state, target = null) {
  guard.state = state;
  guard.target = target;
  if (state === 'investigate') guard.investigateTimer = GUARD.investigateSeconds;
  if (state === 'chase') guard.loseSightTimer = 0;
}

/** Advance the world one fixed step. `input` is { x, y, sneak } from the keyboard. */
export function step(world, input, dt = STEP) {
  if (world.status !== 'playing') return;
  dt = Math.min(dt, 0.05);
  world.time += dt;

  // --- The courier -------------------------------------------------------
  const player = world.player;
  const magnitude = Math.hypot(input.x, input.y);
  player.moving = magnitude > 0.01;
  player.sneaking = Boolean(input.sneak);
  if (player.moving) {
    const speed = player.sneaking ? PLAYER.sneakSpeed : PLAYER.walkSpeed;
    const nx = input.x / magnitude;
    const ny = input.y / magnitude;
    player.angle = Math.atan2(ny, nx);
    moveCircle(player, PLAYER.radius, nx * speed * dt, ny * speed * dt);
  }

  // Footsteps: running carries further, and a guard that hears one comes to look.
  world.noiseTimer -= dt;
  if (player.moving && world.noiseTimer <= 0) {
    world.noiseTimer = PLAYER.noiseInterval;
    const radius = player.sneaking ? PLAYER.sneakNoise : PLAYER.runNoise;
    for (const guard of world.guards) {
      if (guard.state === 'patrol' && guard.suspicion < SUSPICION.investigateAt) {
        if (distance(guard.x, guard.y, player.x, player.y) <= radius) {
          enterState(guard, 'investigate', { x: player.x, y: player.y });
        }
      }
    }
  }

  // --- The guards --------------------------------------------------------
  for (const guard of world.guards) {
    const seen = guardSees(guard, player);
    if (seen.visible) {
      guard.suspicion = Math.min(1, guard.suspicion + suspicionRate(guard, player, seen) * dt);
    } else {
      guard.suspicion = Math.max(0, guard.suspicion - SUSPICION.decayRate * dt);
    }

    if (guard.state === 'patrol') {
      if (guard.suspicion >= 1) {
        world.timesSpotted += 1;
        enterState(guard, 'chase', { x: player.x, y: player.y });
      } else if (guard.suspicion >= SUSPICION.investigateAt) {
        enterState(guard, 'investigate', { x: player.x, y: player.y });
      } else if (guard.pauseTimer > 0) {
        guard.pauseTimer -= dt;
        guard.angle += GUARD.scanSpeed * guard.scanDirection * dt;
      } else {
        const target = guard.waypoints[guard.waypointIndex];
        if (moveGuardToward(guard, target, guard.patrolSpeed, dt)) {
          guard.waypointIndex = (guard.waypointIndex + 1) % guard.waypoints.length;
          guard.pauseTimer = GUARD.waypointPause;
          guard.scanDirection *= -1;
        }
      }
    } else if (guard.state === 'investigate') {
      if (guard.suspicion >= 1) {
        world.timesSpotted += 1;
        enterState(guard, 'chase', { x: player.x, y: player.y });
      } else if (seen.visible) {
        guard.target = { x: player.x, y: player.y };
        moveGuardToward(guard, guard.target, guard.patrolSpeed * 1.25, dt);
      } else if (guard.target) {
        const arrived = moveGuardToward(guard, guard.target, guard.patrolSpeed * 1.25, dt);
        if (arrived) {
          guard.investigateTimer -= dt;
          guard.angle += GUARD.scanSpeed * guard.scanDirection * dt;
          if (guard.investigateTimer <= 0) {
            guard.waypointIndex = nearestWaypointIndex(guard);
            enterState(guard, 'return');
          }
        }
      }
    } else if (guard.state === 'chase') {
      if (seen.visible) {
        guard.loseSightTimer = 0;
        guard.target = { x: player.x, y: player.y };
      } else {
        guard.loseSightTimer += dt;
        if (guard.loseSightTimer >= GUARD.loseSightSeconds) {
          enterState(guard, 'investigate', guard.target || { x: player.x, y: player.y });
          continue;
        }
      }
      moveGuardToward(guard, guard.target || { x: player.x, y: player.y }, GUARD.chaseSpeed, dt);
    } else if (guard.state === 'return') {
      // A guard walking back to its loop still reacts when it spots the courier.
      if (guard.suspicion >= 1) {
        world.timesSpotted += 1;
        enterState(guard, 'chase', { x: player.x, y: player.y });
      } else if (guard.suspicion >= SUSPICION.investigateAt) {
        enterState(guard, 'investigate', { x: player.x, y: player.y });
      }
      const target = guard.waypoints[guard.waypointIndex];
      if (moveGuardToward(guard, target, guard.patrolSpeed, dt)) {
        guard.waypointIndex = (guard.waypointIndex + 1) % guard.waypoints.length;
        enterState(guard, 'patrol');
      }
    }

    // Caught: a guard that has noticed the courier and gets within arm's reach.
    if (
      distance(guard.x, guard.y, player.x, player.y) < GUARD.catchRadius &&
      (guard.state === 'chase' || seen.visible)
    ) {
      world.status = 'caught';
      return;
    }
  }

  // --- Letters and the gate ----------------------------------------------
  for (const letter of world.letters) {
    if (!letter.taken && distance(player.x, player.y, letter.x, letter.y) < LETTER_PICKUP_RADIUS) {
      letter.taken = true;
      world.lettersCollected += 1;
    }
  }
  if (world.lettersCollected >= LETTERS_TO_WIN && pointInExit(player.x, player.y)) {
    world.status = 'won';
    world.winTime = world.time;
  }
}
