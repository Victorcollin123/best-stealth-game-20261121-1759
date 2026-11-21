// Night Post — make.fun entrypoint (Node 22+).
// Copies game/ and screenshots/ into the output directory and writes
// dossier.json via the vendored buildDossier.
//
// IMPORTANT: the grader's output folder may be a mount point, so this
// script NEVER removes the output folder itself. It creates the folder
// if needed, then deletes only the entries inside it.

import { mkdirSync, readdirSync, rmSync, cpSync, existsSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = dirname(fileURLToPath(import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR || join(here, 'output');

// Create the output folder (never delete it — it may be a mount point).
mkdirSync(out, { recursive: true });

// Clear only the entries inside the output folder.
let cleared = 0;
for (const entry of readdirSync(out)) {
  rmSync(join(out, entry), { recursive: true, force: true });
  cleared += 1;
}

// Copy the game and the screenshots in.
const gameDir = join(here, 'game');
const shotsDir = join(here, 'screenshots');
if (existsSync(gameDir)) cpSync(gameDir, join(out, 'game'), { recursive: true });
if (existsSync(shotsDir)) cpSync(shotsDir, join(out, 'screenshots'), { recursive: true });

// buildDossier returns the dossier as bytes; the caller writes the
// dossier.json file itself.
const dossierBytes = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(out, 'dossier.json'), dossierBytes);
const dossier = JSON.parse(Buffer.from(dossierBytes).toString('utf8'));

console.log(
  `Night Post dossier written: ${dossier.images?.length ?? 0} screenshots, ` +
  `cover ${dossier.cover}, schema ${dossier.schema}, cleared=${cleared}`,
);
