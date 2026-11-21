// Night Post — canvas rendering. Vision cones are raycast against the
// walls so a cone stops at a wall instead of shining through it.

import {
  FIELD_W,
  FIELD_H,
  VISION_RANGE,
  VISION_HALF_ANGLE,
  PALETTE,
} from './config.js';
import { WALLS, CRATES, BUSHES, LAMPS, EXIT_RECT } from './level.js';
import { solids, dist, angleDiff } from './world.js';

// Ray vs rect: smallest t > 0 where the ray enters the rect, or Infinity.
function rayHitsRect(ox, oy, dx, dy, r) {
  let t0 = 0;
  let t1 = Infinity;
  const p = [-dx, dx, -dy, dy];
  const q = [ox - r.x, r.x + r.w - ox, oy - r.y, r.y + r.h - oy];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return Infinity;
    } else {
      const t = q[i] / p[i];
      if (p[i] < 0) {
        if (t > t1) return Infinity;
        if (t > t0) t0 = t;
      } else {
        if (t < t0) return Infinity;
        if (t < t1) t1 = t;
      }
    }
  }
  return t0;
}

function castRay(ox, oy, ang) {
  const dx = Math.cos(ang);
  const dy = Math.sin(ang);
  let best = VISION_RANGE;
  for (const s of solids()) {
    const t = rayHitsRect(ox, oy, dx, dy, s);
    if (t < best) best = t;
  }
  return { x: ox + dx * best, y: oy + dy * best };
}

function coneColor(g) {
  if (g.state === 'chase') return PALETTE.coneChase;
  if (g.suspicion >= 0.45) return PALETTE.coneAlert;
  return PALETTE.coneCalm;
}

function drawCone(ctx, g) {
  const rays = 24;
  ctx.fillStyle = coneColor(g);
  ctx.beginPath();
  ctx.moveTo(g.x, g.y);
  for (let i = 0; i <= rays; i++) {
    const a = g.facing - VISION_HALF_ANGLE + (2 * VISION_HALF_ANGLE * i) / rays;
    const hit = castRay(g.x, g.y, a);
    ctx.lineTo(hit.x, hit.y);
  }
  ctx.closePath();
  ctx.fill();
}

function drawGuard(ctx, g) {
  drawCone(ctx, g);
  ctx.fillStyle = PALETTE.guard;
  ctx.beginPath();
  ctx.arc(g.x, g.y, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Facing tick.
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(g.x, g.y);
  ctx.lineTo(g.x + Math.cos(g.facing) * 18, g.y + Math.sin(g.facing) * 18);
  ctx.stroke();
  // Suspicion: "!" over the head once the guard is curious.
  if (g.suspicion >= 0.45) {
    ctx.fillStyle = g.state === 'chase' ? '#ef4444' : '#f97316';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('!', g.x, g.y - 20);
  }
}

export function render(ctx, world, screen, extra) {
  const info = extra || {};
  ctx.clearRect(0, 0, FIELD_W, FIELD_H);

  // Floor.
  ctx.fillStyle = PALETTE.floor;
  ctx.fillRect(0, 0, FIELD_W, FIELD_H);
  ctx.strokeStyle = PALETTE.floorLine;
  ctx.lineWidth = 1;
  for (let x = 80; x < FIELD_W; x += 80) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, FIELD_H);
    ctx.stroke();
  }
  for (let y = 80; y < FIELD_H; y += 80) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(FIELD_W, y);
    ctx.stroke();
  }

  // Exit gate (green, glowing when open).
  const e = EXIT_RECT;
  const open = world.lettersCollected === world.letters.length;
  ctx.fillStyle = open ? PALETTE.exitGlow : 'rgba(34, 197, 94, 0.12)';
  ctx.fillRect(e.x - 8, e.y - 8, e.w + 16, e.h + 16);
  ctx.fillStyle = open ? PALETTE.exit : '#166534';
  ctx.fillRect(e.x, e.y, e.w, e.h);
  ctx.strokeStyle = '#bbf7d0';
  ctx.lineWidth = 2;
  ctx.strokeRect(e.x, e.y, e.w, e.h);

  // Lamps: glow circle + post.
  for (const l of LAMPS) {
    ctx.fillStyle = PALETTE.lampGlow;
    ctx.beginPath();
    ctx.arc(l.x, l.y, l.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.lampPost;
    ctx.beginPath();
    ctx.arc(l.x, l.y, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Bushes.
  for (const b of BUSHES) {
    ctx.fillStyle = PALETTE.bush;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.bushLeaf;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.4;
      ctx.beginPath();
      ctx.arc(b.x + Math.cos(a) * 16, b.y + Math.sin(a) * 16, 9, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Walls and crates.
  for (const w of WALLS) {
    ctx.fillStyle = PALETTE.wall;
    ctx.fillRect(w.x, w.y, w.w, w.h);
    ctx.strokeStyle = PALETTE.wallEdge;
    ctx.lineWidth = 2;
    ctx.strokeRect(w.x + 1, w.y + 1, w.w - 2, w.h - 2);
  }
  for (const c of CRATES) {
    ctx.fillStyle = PALETTE.crate;
    ctx.fillRect(c.x, c.y, c.w, c.h);
    ctx.strokeStyle = PALETTE.crateEdge;
    ctx.lineWidth = 2;
    ctx.strokeRect(c.x + 1, c.y + 1, c.w - 2, c.h - 2);
    ctx.beginPath();
    ctx.moveTo(c.x, c.y);
    ctx.lineTo(c.x + c.w, c.y + c.h);
    ctx.moveTo(c.x + c.w, c.y);
    ctx.lineTo(c.x, c.y + c.h);
    ctx.stroke();
  }

  // Letters not yet collected.
  for (const l of world.letters) {
    if (l.collected) continue;
    ctx.fillStyle = PALETTE.letterGlow;
    ctx.beginPath();
    ctx.arc(l.x, l.y, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.letter;
    ctx.fillRect(l.x - 9, l.y - 6, 18, 12);
    ctx.strokeStyle = '#92400e';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(l.x - 9, l.y - 6, 18, 12);
    ctx.beginPath();
    ctx.moveTo(l.x - 9, l.y - 6);
    ctx.lineTo(l.x, l.y + 1);
    ctx.lineTo(l.x + 9, l.y - 6);
    ctx.stroke();
  }

  // Guards and their cones.
  for (const g of world.guards) drawGuard(ctx, g);

  // Courier.
  const p = world.player;
  ctx.fillStyle = PALETTE.player;
  ctx.beginPath();
  ctx.arc(p.x, p.y, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = PALETTE.playerAccent;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc(p.x - 4, p.y - 2, 2, 0, Math.PI * 2);
  ctx.arc(p.x + 4, p.y - 2, 2, 0, Math.PI * 2);
  ctx.fill();

  // HUD.
  ctx.fillStyle = PALETTE.hud;
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`Letters ${world.lettersCollected}/${world.letters.length}`, 32, 48);
  ctx.textAlign = 'right';
  ctx.fillText(`${world.time.toFixed(1)}s`, FIELD_W - 32, 48);
  if (info.best) {
    ctx.fillStyle = PALETTE.hudDim;
    ctx.font = '14px sans-serif';
    ctx.fillText(`Best ${info.best.toFixed(1)}s`, FIELD_W - 32, 70);
  }
  ctx.textAlign = 'left';
  if (screen === 'playing' && world.guards.some((g) => g.state === 'chase')) {
    ctx.fillStyle = '#ef4444';
    ctx.font = 'bold 30px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SPOTTED — RUN!', FIELD_W / 2, 64);
  }

  // Overlays.
  if (screen === 'title') {
    ctx.fillStyle = PALETTE.titleBg;
    ctx.fillRect(0, 0, FIELD_W, FIELD_H);
    ctx.fillStyle = PALETTE.hud;
    ctx.textAlign = 'center';
    ctx.font = 'bold 64px sans-serif';
    ctx.fillText('NIGHT POST', FIELD_W / 2, 250);
    ctx.font = '22px sans-serif';
    ctx.fillStyle = PALETTE.hudDim;
    ctx.fillText('Carry three letters across the courtyard. Reach the green gate unseen.', FIELD_W / 2, 300);
    ctx.fillStyle = PALETTE.hud;
    ctx.font = '18px sans-serif';
    ctx.fillText('WASD / arrows to move · Shift to sneak · P pause · M mute', FIELD_W / 2, 360);
    ctx.fillText('Bushes hide you. Lamps give you away. Run, and the guards hear you.', FIELD_W / 2, 390);
    ctx.fillStyle = PALETTE.playerAccent;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('Press Enter to start', FIELD_W / 2, 450);
    if (info.best) {
      ctx.fillStyle = PALETTE.hudDim;
      ctx.font = '16px sans-serif';
      ctx.fillText(`Best time: ${info.best.toFixed(1)}s`, FIELD_W / 2, 490);
    }
  } else if (screen === 'paused') {
    ctx.fillStyle = PALETTE.titleBg;
    ctx.fillRect(0, 0, FIELD_W, FIELD_H);
    ctx.fillStyle = PALETTE.hud;
    ctx.textAlign = 'center';
    ctx.font = 'bold 48px sans-serif';
    ctx.fillText('PAUSED', FIELD_W / 2, 360);
    ctx.font = '18px sans-serif';
    ctx.fillText('Press P to continue', FIELD_W / 2, 400);
  } else if (screen === 'won') {
    ctx.fillStyle = PALETTE.titleBg;
    ctx.fillRect(0, 0, FIELD_W, FIELD_H);
    ctx.fillStyle = PALETTE.hud;
    ctx.textAlign = 'center';
    ctx.font = 'bold 56px sans-serif';
    ctx.fillText('GATE REACHED', FIELD_W / 2, 300);
    ctx.font = '26px sans-serif';
    ctx.fillStyle = PALETTE.exit;
    ctx.fillText(`Rating: ${world.rating} · ${world.time.toFixed(1)}s`, FIELD_W / 2, 350);
    ctx.fillStyle = PALETTE.hud;
    ctx.font = '18px sans-serif';
    ctx.fillText('Press R to play again', FIELD_W / 2, 400);
  } else if (screen === 'caught') {
    ctx.fillStyle = 'rgba(69, 10, 10, 0.72)';
    ctx.fillRect(0, 0, FIELD_W, FIELD_H);
    ctx.fillStyle = '#fecaca';
    ctx.textAlign = 'center';
    ctx.font = 'bold 56px sans-serif';
    ctx.fillText('CAUGHT', FIELD_W / 2, 300);
    ctx.fillStyle = PALETTE.hud;
    ctx.font = '20px sans-serif';
    ctx.fillText(`Letters carried: ${world.lettersCollected}/${world.letters.length}`, FIELD_W / 2, 350);
    ctx.fillText('Press R to try again', FIELD_W / 2, 400);
  }

  if (info.muted) {
    ctx.fillStyle = PALETTE.hudDim;
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Muted (M)', 32, FIELD_H - 24);
  }
}
