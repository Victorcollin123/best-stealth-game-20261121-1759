// Night Post: everything the player sees, drawn on one canvas. The camera is
// fixed on the whole 1280x720 courtyard — a stealth game reads better when the
// whole level is in view than when the screen scrolls. Vision cones are
// raycast so they stop at walls, which is what makes the hiding spots readable
// at a glance.

import { FIELD, GUARD, PALETTE, FONT, LETTERS_TO_WIN } from './config.js';
import { LEVEL } from './level.js';
import { circleHitsAny } from './world.js';

function coneColor(guard) {
  if (guard.state === 'chase') return PALETTE.coneAlert;
  if (guard.state === 'investigate' || guard.suspicion >= 0.45) return PALETTE.coneSuspicious;
  return PALETTE.cone;
}

/** Walk a ray from the guard until it hits a wall or the vision range, cone edge by edge. */
function conePolygon(guard) {
  const points = [{ x: guard.x, y: guard.y }];
  const rays = 24;
  for (let i = 0; i <= rays; i += 1) {
    const angle = guard.angle - GUARD.visionHalfAngle + (2 * GUARD.visionHalfAngle * i) / rays;
    let endX = guard.x + Math.cos(angle) * GUARD.visionRange;
    let endY = guard.y + Math.sin(angle) * GUARD.visionRange;
    for (let t = 8; t <= GUARD.visionRange; t += 8) {
      const px = guard.x + Math.cos(angle) * t;
      const py = guard.y + Math.sin(angle) * t;
      if (circleHitsAny(px, py, 2)) {
        endX = px;
        endY = py;
        break;
      }
    }
    points.push({ x: endX, y: endY });
  }
  return points;
}

function drawFloor(ctx) {
  ctx.fillStyle = PALETTE.floor;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  const tile = 40;
  ctx.fillStyle = PALETTE.floorDark;
  for (let y = 0; y < FIELD.height / tile; y += 1) {
    for (let x = 0; x < FIELD.width / tile; x += 1) {
      if ((x + y) % 2 === 0) ctx.fillRect(x * tile, y * tile, tile, tile);
    }
  }
  ctx.strokeStyle = PALETTE.tileLine;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= FIELD.width; x += tile) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, FIELD.height);
  }
  for (let y = 0; y <= FIELD.height; y += tile) {
    ctx.moveTo(0, y);
    ctx.lineTo(FIELD.width, y);
  }
  ctx.stroke();
}

function drawLamps(ctx) {
  for (const lamp of LEVEL.lamps) {
    const gradient = ctx.createRadialGradient(lamp.x, lamp.y, 6, lamp.x, lamp.y, lamp.r);
    gradient.addColorStop(0, 'rgba(242, 201, 76, 0.30)');
    gradient.addColorStop(1, 'rgba(242, 201, 76, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(lamp.x, lamp.y, lamp.r, 0, Math.PI * 2);
    ctx.fill();
    // The lamp post itself.
    ctx.fillStyle = '#2a2f3a';
    ctx.fillRect(lamp.x - 3, lamp.y - 3, 6, 6);
    ctx.fillStyle = PALETTE.lampGlow;
    ctx.beginPath();
    ctx.arc(lamp.x, lamp.y, 5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBushes(ctx) {
  for (const bush of LEVEL.bushes) {
    ctx.fillStyle = PALETTE.bush;
    ctx.beginPath();
    ctx.arc(bush.x, bush.y, bush.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.bushLight;
    for (const [ox, oy, r] of [[-12, -8, 9], [10, -12, 8], [12, 10, 9], [-10, 12, 7], [0, 0, 8]]) {
      ctx.beginPath();
      ctx.arc(bush.x + ox, bush.y + oy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawWalls(ctx) {
  for (const wall of LEVEL.walls) {
    ctx.fillStyle = PALETTE.wall;
    ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
    ctx.fillStyle = PALETTE.wallTop;
    ctx.fillRect(wall.x, wall.y, wall.w, 4);
  }
  for (const crate of LEVEL.crates) {
    ctx.fillStyle = PALETTE.crate;
    ctx.fillRect(crate.x, crate.y, crate.w, crate.h);
    ctx.fillStyle = PALETTE.crateTop;
    ctx.fillRect(crate.x, crate.y, crate.w, 4);
    ctx.strokeStyle = '#3d2f21';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(crate.x, crate.y + crate.h / 2);
    ctx.lineTo(crate.x + crate.w, crate.y + crate.h / 2);
    ctx.moveTo(crate.x + crate.w / 2, crate.y);
    ctx.lineTo(crate.x + crate.w / 2, crate.y + crate.h);
    ctx.stroke();
  }
}

function drawLetters(ctx, world) {
  for (const letter of world.letters) {
    if (letter.taken) continue;
    const bob = Math.sin(world.time * 3 + letter.x) * 3;
    const y = letter.y + bob;
    ctx.save();
    ctx.translate(letter.x, y);
    ctx.rotate(-0.12);
    ctx.fillStyle = PALETTE.letter;
    ctx.fillRect(-11, -8, 22, 16);
    ctx.strokeStyle = '#b39b4a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-11, -8);
    ctx.lineTo(0, 2);
    ctx.lineTo(11, -8);
    ctx.stroke();
    ctx.restore();
  }
}

function drawExit(ctx, world) {
  const exit = LEVEL.exit;
  const open = world.lettersCollected >= LETTERS_TO_WIN;
  ctx.fillStyle = open ? PALETTE.exit : PALETTE.exitDark;
  ctx.fillRect(exit.x, exit.y, exit.w, exit.h);
  ctx.fillStyle = '#0b0e14';
  ctx.font = `bold 11px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(open ? 'EXIT' : `${world.lettersCollected}/${LETTERS_TO_WIN}`, exit.x + exit.w / 2, exit.y + exit.h / 2);
  if (open) {
    ctx.strokeStyle = 'rgba(126, 231, 135, 0.5)';
    ctx.lineWidth = 3;
    ctx.strokeRect(exit.x - 4, exit.y - 4, exit.w + 8, exit.h + 8);
  }
}

function drawCones(ctx, world) {
  for (const guard of world.guards) {
    const polygon = conePolygon(guard);
    ctx.fillStyle = coneColor(guard);
    ctx.beginPath();
    ctx.moveTo(polygon[0].x, polygon[0].y);
    for (let i = 1; i < polygon.length; i += 1) ctx.lineTo(polygon[i].x, polygon[i].y);
    ctx.closePath();
    ctx.fill();
  }
}

function drawGuard(ctx, guard) {
  ctx.fillStyle = PALETTE.guard;
  ctx.beginPath();
  ctx.arc(guard.x, guard.y, GUARD.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = PALETTE.guardDark;
  ctx.lineWidth = 3;
  ctx.stroke();
  // The direction the guard is facing.
  ctx.strokeStyle = '#f5d0cb';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(guard.x, guard.y);
  ctx.lineTo(guard.x + Math.cos(guard.angle) * (GUARD.radius + 8), guard.y + Math.sin(guard.angle) * (GUARD.radius + 8));
  ctx.stroke();
  // Suspicion: a "?" while it wonders, a "!" once it is sure.
  if (guard.state === 'chase') {
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 20px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('!', guard.x, guard.y - 26);
  } else if (guard.suspicion >= 0.45) {
    ctx.fillStyle = '#ffd9a0';
    ctx.font = `bold 18px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', guard.x, guard.y - 26);
  }
  // A thin suspicion meter above the guard.
  if (guard.suspicion > 0.05) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(guard.x - 16, guard.y - 40, 32, 5);
    ctx.fillStyle = guard.suspicion >= 1 ? PALETTE.danger : PALETTE.gold;
    ctx.fillRect(guard.x - 16, guard.y - 40, 32 * guard.suspicion, 5);
  }
}

function drawPlayer(ctx, world) {
  const player = world.player;
  const radius = player.sneaking ? 12 : 14;
  ctx.fillStyle = player.sneaking ? PALETTE.playerDark : PALETTE.player;
  ctx.beginPath();
  ctx.arc(player.x, player.y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#d6f2ff';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.strokeStyle = '#d6f2ff';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(player.x, player.y);
  ctx.lineTo(player.x + Math.cos(player.angle) * (radius + 7), player.y + Math.sin(player.angle) * (radius + 7));
  ctx.stroke();
}

function formatTime(seconds) {
  const total = Math.floor(seconds);
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  return `${minutes}:${String(secs).padStart(2, '0')}`;
}

function drawHud(ctx, world, ui) {
  ctx.fillStyle = 'rgba(11, 14, 20, 0.72)';
  ctx.fillRect(0, 0, FIELD.width, 40);
  ctx.fillStyle = PALETTE.text;
  ctx.font = `600 16px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(`Letters  ${world.lettersCollected}/${LETTERS_TO_WIN}`, 16, 21);
  ctx.textAlign = 'center';
  const alert = world.guards.some((g) => g.state === 'chase');
  const wary = world.guards.some((g) => g.state === 'investigate' || g.suspicion >= 0.45);
  if (alert) {
    ctx.fillStyle = PALETTE.danger;
    ctx.fillText('SPOTTED — RUN!', FIELD.width / 2, 21);
  } else if (wary) {
    ctx.fillStyle = PALETTE.gold;
    ctx.fillText('Something stirs…', FIELD.width / 2, 21);
  } else {
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText('Stay out of the light', FIELD.width / 2, 21);
  }
  ctx.fillStyle = PALETTE.text;
  ctx.textAlign = 'right';
  const best = ui.best == null ? '—' : formatTime(ui.best);
  ctx.fillText(`${formatTime(world.time)}   Best ${best}`, FIELD.width - 16, 21);
}

function drawTitle(ctx, world, ui) {
  ctx.fillStyle = 'rgba(11, 14, 20, 0.78)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  ctx.fillStyle = PALETTE.gold;
  ctx.font = `800 64px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('NIGHT POST', FIELD.width / 2, 240);
  ctx.fillStyle = PALETTE.text;
  ctx.font = `400 22px ${FONT}`;
  ctx.fillText('Three letters. One courtyard. Three guards who never sleep.', FIELD.width / 2, 300);
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `400 17px ${FONT}`;
  ctx.fillText('WASD / arrows to move · hold Shift to sneak · hide in the bushes', FIELD.width / 2, 344);
  ctx.fillText('Lamplight and running make you easier to spot · reach the green gate with all three letters', FIELD.width / 2, 372);
  ctx.fillStyle = PALETTE.text;
  ctx.font = `600 22px ${FONT}`;
  ctx.fillText('Press Enter to begin', FIELD.width / 2, 440);
  if (ui.best != null) {
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `400 16px ${FONT}`;
    ctx.fillText(`Best delivery: ${formatTime(ui.best)}`, FIELD.width / 2, 480);
  }
}

function drawEnd(ctx, world, ui) {
  ctx.fillStyle = 'rgba(11, 14, 20, 0.78)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (world.status === 'won') {
    const rating = world.timesSpotted === 0 ? 'Ghost — never seen' : world.timesSpotted === 1 ? 'Shadow — seen once' : `Seen ${world.timesSpotted} times`;
    ctx.fillStyle = PALETTE.exit;
    ctx.font = `800 56px ${FONT}`;
    ctx.fillText('DELIVERED', FIELD.width / 2, 260);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `400 22px ${FONT}`;
    ctx.fillText(`All three letters, in ${formatTime(world.winTime || 0)}. ${rating}.`, FIELD.width / 2, 320);
  } else {
    ctx.fillStyle = PALETTE.danger;
    ctx.font = `800 56px ${FONT}`;
    ctx.fillText('CAUGHT', FIELD.width / 2, 260);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `400 22px ${FONT}`;
    ctx.fillText(`The courier was caught with ${world.lettersCollected} of ${LETTERS_TO_WIN} letters.`, FIELD.width / 2, 320);
  }
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `400 17px ${FONT}`;
  if (ui.best != null) ctx.fillText(`Best delivery: ${formatTime(ui.best)}`, FIELD.width / 2, 360);
  ctx.fillStyle = PALETTE.text;
  ctx.font = `600 22px ${FONT}`;
  ctx.fillText('Press R to play again', FIELD.width / 2, 420);
}

/** Draw the whole scene: floor, light, cover, cones, pieces, HUD, and any screen over it. */
export function render(ctx, world, ui) {
  drawFloor(ctx);
  drawLamps(ctx);
  drawBushes(ctx);
  drawWalls(ctx);
  drawLetters(ctx, world);
  drawExit(ctx, world);
  drawCones(ctx, world);
  for (const guard of world.guards) drawGuard(ctx, guard);
  drawPlayer(ctx, world);
  drawHud(ctx, world, ui);
  if (ui.screen === 'title') drawTitle(ctx, world, ui);
  if (world.status === 'won' || world.status === 'caught') drawEnd(ctx, world, ui);
}
