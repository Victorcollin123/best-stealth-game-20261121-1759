// Night Post — the entrypoint. Copies game/ and screenshots/ into the
// output directory and writes dossier.json there with the vendored
// buildDossier. The output directory comes from MAKEFUN_OUTPUT_DIR (the
// scorer runs it with /output); running it twice into two different
// directories must produce byte-identical output. Usage: node main.ts
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const root = dirname(fileURLToPath(import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR || '/output';

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
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
  `dossier: out=${out} cover=${dossier.images[dossier.cover].name} images=${dossier.images.length} text=${dossier.text.length} bytes`,
);
