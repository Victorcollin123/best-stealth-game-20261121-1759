// Night Post — canvas rendering. Draws the courtyard from a world: ground,
// lamps, exit gate, bushes, crates, walls, letters, guards with raycast
// vision cones, the courier, and the HUD / screens on top. No simulation
// lives here; it only paints what the world says.

import { FIELD, PALETTE } from './config.js';
import { LEVEL, solids } from './level.js';

/** Ray vs rect (slab method): distance along the ray, or Infinity. */
export function rayHitRect(ox, oy, dx, dy, rect) {
  let tmin = 0;
  let tmax = Infinity;
  const slabs = [
    [dx, ox, rect.x, rect.x + rect.w],
    [dy, oy, rect.y, rect.y + rect.h],
  ];
  for (const [d, o, lo, hi] of slabs) {
    if (Math.abs(d) < 1e-9) {
      if (o < lo || o > hi) return Infinity;
    } else {
      let t1 = (lo - o) / d;
      let t2 = (hi - o) / d;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return Infinity;
    }
  }
  return tmin;
}

/** Nearest wall hit along a ray, capped at maxDist. */
export function raycast(ox, oy, angle, maxDist) {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  let best = maxDist;
  for (const s of solids()) {
    const t = rayHitRect(ox, oy, dx, dy, s);
    if (t < best) best = t;
  }
  return best;
}

function drawCone(ctx, guard, visionRange, halfAngle) {
  const rays = 26;
  const chasing = guard.state === 'chase';
  ctx.beginPath();
  ctx.moveTo(guard.x, guard.y);
  for (let i = 0; i <= rays; i++) {
    const a = guard.facing - halfAngle + (2 * halfAngle * i) / rays;
    const d = raycast(guard.x, guard.y, a, visionRange);
    ctx.lineTo(guard.x + Math.cos(a) * d, guard.y + Math.sin(a) * d);
  }
  ctx.closePath();
  ctx.fillStyle = chasing ? PALETTE.coneChase : PALETTE.cone;
  ctx.fill();
  ctx.strokeStyle = chasing ? PALETTE.coneChaseEdge : PALETTE.coneEdge;
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawGuard(ctx, guard) {
  drawCone(ctx, guard, 230, 0.6);
  // body
  ctx.beginPath();
  ctx.arc(guard.x, guard.y, 14, 0, Math.PI * 2);
  ctx.fillStyle = PALETTE.guard;
  ctx.fill();
  ctx.strokeStyle = PALETTE.guardEdge;
  ctx.lineWidth = 2;
  ctx.stroke();
  // facing tick
  ctx.beginPath();
  ctx.moveTo(guard.x, guard.y);
  ctx.lineTo(guard.x + Math.cos(guard.facing) * 20, guard.y + Math.sin(guard.facing) * 20);
  ctx.strokeStyle = PALETTE.guardEdge;
  ctx.lineWidth = 2;
  ctx.stroke();
  // suspicion bar
  if (guard.suspicion > 0.02) {
    const w = 30;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(guard.x - w / 2, guard.y - 30, w, 5);
    ctx.fillStyle = guard.suspicion >= 1 ? PALETTE.danger : PALETTE.gold;
    ctx.fillRect(guard.x - w / 2, guard.y - 30, w * guard.suspicion, 5);
  }
  // name
  ctx.fillStyle = PALETTE.dim;
  ctx.font = '11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(guard.name, guard.x, guard.y + 30);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Paint one frame. ui: { screen, bestTime, muted } where screen is
 * 'title' | 'playing' | 'paused' | 'won' | 'caught'.
 */
export function render(ctx, world, ui) {
  const W = FIELD.w;
  const H = FIELD.h;
  ctx.clearRect(0, 0, W, H);

  // ground, with a faint checker of paving
  ctx.fillStyle = PALETTE.ground;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = PALETTE.groundAlt;
  for (let y = 24; y < H - 24; y += 96) {
    for (let x = 24 + ((y / 96) % 2) * 48; x < W - 24; x += 96) {
      ctx.fillRect(x, y, 48, 48);
    }
  }

  // lamp glow
  for (const lamp of LEVEL.lamps) {
    ctx.beginPath();
    ctx.arc(lamp.x, lamp.y, lamp.r, 0, Math.PI * 2);
    ctx.fillStyle = PALETTE.lamp;
    ctx.fill();
    ctx.strokeStyle = PALETTE.lampEdge;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(lamp.x, lamp.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = PALETTE.gold;
    ctx.fill();
  }

  // exit gate
  const e = LEVEL.exit;
  ctx.fillStyle = PALETTE.exit;
  ctx.fillRect(e.x, e.y, e.w, e.h);
  ctx.strokeStyle = PALETTE.exitEdge;
  ctx.lineWidth = 3;
  ctx.strokeRect(e.x, e.y, e.w, e.h);
  ctx.fillStyle = '#d7ffd7';
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('GATE', e.x + e.w / 2, e.y + e.h / 2 + 4);

  // bushes
  for (const b of LEVEL.bushes) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fillStyle = PALETTE.bush;
    ctx.fill();
    ctx.strokeStyle = PALETTE.bushEdge;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(b.x - 10, b.y - 8, 9, 0, Math.PI * 2);
    ctx.arc(b.x + 11, b.y + 6, 11, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(47, 122, 62, 0.5)';
    ctx.fill();
  }

  // crates
  for (const c of LEVEL.crates) {
    ctx.fillStyle = PALETTE.crate;
    ctx.fillRect(c.x, c.y, c.w, c.h);
    ctx.strokeStyle = PALETTE.crateEdge;
    ctx.lineWidth = 2;
    ctx.strokeRect(c.x, c.y, c.w, c.h);
    ctx.beginPath();
    ctx.moveTo(c.x, c.y);
    ctx.lineTo(c.x + c.w, c.y + c.h);
    ctx.moveTo(c.x + c.w, c.y);
    ctx.lineTo(c.x, c.y + c.h);
    ctx.stroke();
  }

  // walls
  for (const wall of LEVEL.walls) {
    ctx.fillStyle = PALETTE.wall;
    ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
    ctx.fillStyle = PALETTE.wallTop;
    ctx.fillRect(wall.x, wall.y, wall.w, Math.min(4, wall.h));
  }

  // letters (from the world, so a collected letter stops being drawn)
  for (const letter of world.letters) {
    if (letter.taken) continue;
    ctx.fillStyle = PALETTE.letter;
    ctx.fillRect(letter.x - 11, letter.y - 8, 22, 16);
    ctx.strokeStyle = PALETTE.letterEdge;
    ctx.lineWidth = 2;
    ctx.strokeRect(letter.x - 11, letter.y - 8, 22, 16);
    ctx.beginPath();
    ctx.moveTo(letter.x - 11, letter.y - 8);
    ctx.lineTo(letter.x, letter.y + 2);
    ctx.lineTo(letter.x + 11, letter.y - 8);
    ctx.stroke();
  }

  // guards, then the courier
  for (const g of world.guards) drawGuard(ctx, g);

  const p = world.player;
  ctx.beginPath();
  ctx.arc(p.x, p.y, 14, 0, Math.PI * 2);
  ctx.fillStyle = PALETTE.playerCoat;
  ctx.fill();
  ctx.strokeStyle = PALETTE.player;
  ctx.lineWidth = 2;
  ctx.stroke();
  // satchel
  ctx.fillStyle = PALETTE.letter;
  ctx.fillRect(p.x - 4, p.y - 3, 9, 7);
  if (p.sneaking) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 19, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(232,232,232,0.4)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // ---- HUD
  ctx.textAlign = 'left';
  ctx.font = 'bold 16px system-ui, sans-serif';
  ctx.fillStyle = PALETTE.text;
  const mins = Math.floor(world.time / 60);
  const secs = Math.floor(world.time % 60)
    .toString()
    .padStart(2, '0');
  ctx.fillText(`Letters ${world.lettersCollected}/3    ${mins}:${secs}`, 36, 52);
  if (ui.bestTime != null) {
    ctx.fillStyle = PALETTE.dim;
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillText(`Best ${ui.bestTime}`, 36, 74);
  }
  if (ui.muted) {
    ctx.fillStyle = PALETTE.dim;
    ctx.font = '14px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('Muted (M)', W - 36, 52);
  }
  const chasing = world.guards.some((g) => g.state === 'chase');
  if (world.status === 'playing' && chasing) {
    ctx.textAlign = 'center';
    ctx.font = 'bold 30px system-ui, sans-serif';
    ctx.fillStyle = PALETTE.danger;
    ctx.fillText('SPOTTED — RUN!', W / 2, 132); // below the HUD and the north letters
  }

  // ---- screens
  if (ui.screen === 'title') {
    ctx.fillStyle = 'rgba(5, 8, 16, 0.72)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 64px system-ui, sans-serif';
    ctx.fillText('NIGHT POST', W / 2, 250);
    ctx.font = '20px system-ui, sans-serif';
    ctx.fillStyle = PALETTE.gold;
    ctx.fillText('Three letters. Three guards. One gate. Unseen.', W / 2, 300);
    ctx.fillStyle = PALETTE.dim;
    ctx.font = '17px system-ui, sans-serif';
    ctx.fillText('WASD / arrows to move · Shift to sneak · P pause · M mute · R restart', W / 2, 350);
    ctx.fillText('Hide in bushes. Mind the lamps. Running is loud.', W / 2, 380);
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillText('Press Enter to start', W / 2, 440);
    if (ui.bestTime != null) {
      ctx.fillStyle = PALETTE.dim;
      ctx.font = '16px system-ui, sans-serif';
      ctx.fillText(`Best time: ${ui.bestTime}`, W / 2, 480);
    }
  } else if (ui.screen === 'paused') {
    ctx.fillStyle = 'rgba(5, 8, 16, 0.6)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 44px system-ui, sans-serif';
    ctx.fillText('PAUSED', W / 2, H / 2);
    ctx.font = '18px system-ui, sans-serif';
    ctx.fillStyle = PALETTE.dim;
    ctx.fillText('P to resume · R to restart', W / 2, H / 2 + 40);
  } else if (ui.screen === 'won') {
    ctx.fillStyle = 'rgba(5, 8, 16, 0.72)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 56px system-ui, sans-serif';
    ctx.fillText('DELIVERED', W / 2, 300);
    ctx.font = '24px system-ui, sans-serif';
    ctx.fillStyle = PALETTE.gold;
    ctx.fillText(`Rating: ${world.rating} · Time ${mins}:${secs}`, W / 2, 350);
    ctx.fillStyle = PALETTE.dim;
    ctx.font = '18px system-ui, sans-serif';
    ctx.fillText('Press R to play again', W / 2, 400);
  } else if (ui.screen === 'caught') {
    ctx.fillStyle = 'rgba(20, 5, 8, 0.72)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.danger;
    ctx.font = 'bold 56px system-ui, sans-serif';
    ctx.fillText('CAUGHT', W / 2, 300);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '24px system-ui, sans-serif';
    ctx.fillText(`Letters delivered: ${world.lettersCollected}/3`, W / 2, 350);
    ctx.fillStyle = PALETTE.dim;
    ctx.font = '18px system-ui, sans-serif';
    ctx.fillText('Press R to try again', W / 2, 400);
  }
}
