// Night Post — make.fun entrypoint (round 2).
//
// The grader copies this repo to /bot and runs `node /bot/main.ts` with an
// empty writable /output. This program copies the game and screenshots in
// and builds the dossier.
//
// Round-1 fix: /output is a mount point in the grader, and removing the
// folder itself fails (rmdir on a mount throws, exiting 1). So the output
// folder is never removed — only its CONTENTS are cleared. That behaves
// identically on a normal folder and succeeds on a mount.

import { cpSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const root = dirname(fileURLToPath(import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR || '/output';

mkdirSync(out, { recursive: true });
const existing = readdirSync(out);
for (const entry of existing) {
  rmSync(join(out, entry), { recursive: true, force: true });
}
cpSync(join(root, 'game'), join(out, 'game'), { recursive: true });
cpSync(join(root, 'screenshots'), join(out, 'screenshots'), { recursive: true });

const dossierBytes = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(out, 'dossier.json'), dossierBytes);

const dossier = JSON.parse(new TextDecoder().decode(dossierBytes));
console.log(
  `dossier: out=${out} cleared=${existing.length} cover=${dossier.images[dossier.cover].name} images=${dossier.images.length} text=${dossier.text.length} bytes`,
);
