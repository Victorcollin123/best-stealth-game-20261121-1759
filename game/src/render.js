// Night Post — canvas rendering. Vision cones are raycast: each ray
// marches out from the guard and stops at the first wall, so a cone
// never shines through solid stone.

import { FIELD_W, FIELD_H, GUARD, PALETTE } from './config.js';
import { WALLS, CRATES, BUSHES, LAMPS, SOLIDS } from './level.js';
import { winRating } from './world.js';

function pointInSolid(x, y) {
  for (const s of SOLIDS) {
    if (x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h) return true;
  }
  return false;
}

// March a ray from (x, y) along angle until it hits a wall or the range.
function castRay(x, y, angle, range) {
  const step = 6;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  let d = 0;
  while (d < range) {
    d += step;
    const px = x + dx * d;
    const py = y + dy * d;
    if (px < 0 || px > FIELD_W || py < 0 || py > FIELD_H) return Math.min(d, range);
    if (pointInSolid(px, py)) return d;
  }
  return range;
}

export function conePolygon(guard) {
  const points = [{ x: guard.x, y: guard.y }];
  const rays = 28;
  const start = guard.facing - GUARD.visionHalfAngle;
  const end = guard.facing + GUARD.visionHalfAngle;
  for (let i = 0; i <= rays; i++) {
    const a = start + ((end - start) * i) / rays;
    const r = castRay(guard.x, guard.y, a, GUARD.visionRange);
    points.push({ x: guard.x + Math.cos(a) * r, y: guard.y + Math.sin(a) * r });
  }
  return points;
}

function drawCone(ctx, guard) {
  const poly = conePolygon(guard);
  ctx.beginPath();
  ctx.moveTo(poly[0].x, poly[0].y);
  for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y);
  ctx.closePath();
  const alert = guard.state === 'chase' || guard.suspicion >= 0.45;
  ctx.fillStyle = alert ? PALETTE.guardConeAlert : PALETTE.guardCone;
  ctx.fill();
}

function fmtTime(t) {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// screen: 'title' | 'playing' | 'won' | 'caught'.
// opts: { bestTime } — best time in seconds, or null.
export function render(ctx, world, screen, opts = {}) {
  const { player } = world;

  // Night ground, faint checker for depth.
  ctx.fillStyle = PALETTE.ground;
  ctx.fillRect(0, 0, FIELD_W, FIELD_H);
  ctx.fillStyle = PALETTE.groundAlt;
  const tile = 80;
  for (let y = 0; y < FIELD_H / tile; y++) {
    for (let x = 0; x < FIELD_W / tile; x++) {
      if ((x + y) % 2 === 0) ctx.fillRect(x * tile, y * tile, tile, tile);
    }
  }

  // Lamp glow pools.
  for (const lamp of LAMPS) {
    const g = ctx.createRadialGradient(lamp.x, lamp.y, 8, lamp.x, lamp.y, lamp.r);
    g.addColorStop(0, PALETTE.lampGlow);
    g.addColorStop(1, 'rgba(255, 214, 120, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(lamp.x, lamp.y, lamp.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Exit gate.
  const e = world.exit;
  ctx.fillStyle = PALETTE.exitGlow;
  ctx.fillRect(e.x - 6, e.y - 6, e.w + 12, e.h + 12);
  ctx.fillStyle = PALETTE.exit;
  ctx.fillRect(e.x, e.y, e.w, e.h);
  ctx.fillStyle = '#0b1026';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('GATE', e.x + e.w / 2, e.y + e.h / 2);

  // Letters not yet collected.
  for (const letter of world.letters) {
    if (letter.collected) continue;
    ctx.fillStyle = PALETTE.letter;
    ctx.beginPath();
    ctx.arc(letter.x, letter.y, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#8a7433';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#3a2f10';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('✉', letter.x, letter.y + 0.5);
  }

  // Bushes — soft cover.
  for (const bush of BUSHES) {
    ctx.fillStyle = PALETTE.bushDark;
    ctx.beginPath();
    ctx.arc(bush.x, bush.y, bush.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.bush;
    ctx.beginPath();
    ctx.arc(bush.x - 6, bush.y - 4, bush.r * 0.62, 0, Math.PI * 2);
    ctx.arc(bush.x + 8, bush.y + 6, bush.r * 0.55, 0, Math.PI * 2);
    ctx.arc(bush.x + 2, bush.y - 10, bush.r * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Crates.
  for (const crate of CRATES) {
    ctx.fillStyle = PALETTE.crate;
    ctx.fillRect(crate.x, crate.y, crate.w, crate.h);
    ctx.fillStyle = PALETTE.crateTop;
    ctx.fillRect(crate.x + 4, crate.y + 4, crate.w - 8, crate.h - 8);
    ctx.strokeStyle = '#2e2415';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(crate.x, crate.y);
    ctx.lineTo(crate.x + crate.w, crate.y + crate.h);
    ctx.moveTo(crate.x + crate.w, crate.y);
    ctx.lineTo(crate.x, crate.y + crate.h);
    ctx.stroke();
  }

  // Walls.
  for (const wall of WALLS) {
    ctx.fillStyle = PALETTE.wall;
    ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
    ctx.fillStyle = PALETTE.wallTop;
    if (wall.w >= wall.h) ctx.fillRect(wall.x, wall.y, wall.w, 4);
    else ctx.fillRect(wall.x, wall.y, 4, wall.h);
  }

  // Lamp posts.
  for (const lamp of LAMPS) {
    ctx.fillStyle = PALETTE.lampCore;
    ctx.beginPath();
    ctx.arc(lamp.x, lamp.y, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Guard vision cones, then the guards themselves.
  for (const guard of world.guards) drawCone(ctx, guard);
  for (const guard of world.guards) {
    ctx.fillStyle = PALETTE.guard;
    ctx.beginPath();
    ctx.arc(guard.x, guard.y, GUARD.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#7e2a2a';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Facing tick.
    ctx.strokeStyle = '#ffd6d6';
    ctx.beginPath();
    ctx.moveTo(guard.x, guard.y);
    ctx.lineTo(guard.x + Math.cos(guard.facing) * 18, guard.y + Math.sin(guard.facing) * 18);
    ctx.stroke();
    // Suspicion arc above the guard.
    if (guard.suspicion > 0.02) {
      ctx.strokeStyle = guard.suspicion >= 0.45 ? PALETTE.danger : PALETTE.letter;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(guard.x, guard.y, GUARD.radius + 7, -Math.PI / 2, -Math.PI / 2 + guard.suspicion * Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = PALETTE.text;
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(guard.name, guard.x, guard.y - GUARD.radius - 12);
  }

  // The courier.
  ctx.fillStyle = player.sneaking ? PALETTE.playerSneak : PALETTE.player;
  ctx.beginPath();
  ctx.arc(player.x, player.y, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#7a5a16';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.strokeStyle = '#fff3c4';
  ctx.beginPath();
  ctx.moveTo(player.x, player.y);
  ctx.lineTo(player.x + Math.cos(player.facing) * 18, player.y + Math.sin(player.facing) * 18);
  ctx.stroke();

  // HUD.
  ctx.fillStyle = 'rgba(5, 8, 20, 0.72)';
  ctx.fillRect(0, 0, FIELD_W, 34);
  ctx.fillStyle = PALETTE.text;
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(`Letters ${world.lettersCollected}/3`, 16, 17);
  ctx.fillText(`Time ${fmtTime(world.time)}`, 170, 17);
  if (opts.bestTime != null) {
    ctx.fillStyle = PALETTE.textDim;
    ctx.fillText(`Best ${fmtTime(opts.bestTime)}`, 300, 17);
  }
  ctx.textAlign = 'right';
  ctx.fillStyle = PALETTE.textDim;
  ctx.fillText('WASD move · Shift sneak · P pause · M mute · R restart', FIELD_W - 16, 17);

  // Chase banner.
  const chased = world.guards.some((g) => g.state === 'chase');
  if (screen === 'playing' && chased) {
    ctx.fillStyle = PALETTE.danger;
    ctx.font = 'bold 34px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SPOTTED — RUN!', FIELD_W / 2, 84);
  }

  if (screen === 'title') {
    ctx.fillStyle = 'rgba(5, 8, 20, 0.78)';
    ctx.fillRect(0, 0, FIELD_W, FIELD_H);
    ctx.fillStyle = PALETTE.title;
    ctx.font = 'bold 64px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('NIGHT POST', FIELD_W / 2, 250);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '22px sans-serif';
    ctx.fillText('Carry three letters across the courtyard — unseen.', FIELD_W / 2, 305);
    ctx.fillStyle = PALETTE.textDim;
    ctx.font = '18px sans-serif';
    ctx.fillText('Three guards patrol with lantern-lit vision cones. Hide in the bushes.', FIELD_W / 2, 340);
    ctx.fillText('Lamps give you away. Running is loud. Sneak with Shift.', FIELD_W / 2, 368);
    ctx.fillStyle = PALETTE.letter;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('Press Enter to begin', FIELD_W / 2, 440);
    ctx.fillStyle = PALETTE.textDim;
    ctx.font = '15px sans-serif';
    ctx.fillText('WASD / arrows move · Shift sneak · P pause · M mute · R restart', FIELD_W / 2, 480);
  }

  if (screen === 'won') {
    ctx.fillStyle = 'rgba(5, 20, 10, 0.78)';
    ctx.fillRect(0, 0, FIELD_W, FIELD_H);
    ctx.fillStyle = PALETTE.exit;
    ctx.font = 'bold 56px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('DELIVERED', FIELD_W / 2, 280);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '26px sans-serif';
    ctx.fillText(`Rating: ${winRating(world)}  ·  Time ${fmtTime(world.time)}`, FIELD_W / 2, 335);
    ctx.fillStyle = PALETTE.textDim;
    ctx.font = '18px sans-serif';
    ctx.fillText('Ghost — never seen · Shadow — seen once · Seen — seen twice or more', FIELD_W / 2, 375);
    ctx.fillStyle = PALETTE.letter;
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('Press R to play again', FIELD_W / 2, 440);
  }

  if (screen === 'caught') {
    ctx.fillStyle = 'rgba(25, 5, 5, 0.78)';
    ctx.fillRect(0, 0, FIELD_W, FIELD_H);
    ctx.fillStyle = PALETTE.danger;
    ctx.font = 'bold 56px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('CAUGHT', FIELD_W / 2, 280);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '24px sans-serif';
    ctx.fillText(`Letters delivered: ${world.lettersCollected}/3`, FIELD_W / 2, 335);
    ctx.fillStyle = PALETTE.textDim;
    ctx.font = '18px sans-serif';
    ctx.fillText('The night shift keeps its letters. Try a slower route — and mind the lamps.', FIELD_W / 2, 375);
    ctx.fillStyle = PALETTE.letter;
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('Press R to try again', FIELD_W / 2, 440);
  }
}
