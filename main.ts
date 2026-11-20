// main.ts — the entry program for the Neon Vice cover maker.
//
// Node 22, standard library only. It hands the app in: it copies app/ and
// screenshots/ from beside this file into the output directory and writes
// /output/dossier.json, the summary the judge reads, using the vendored
// make.fun dossier library. Outside the grader, MAKEFUN_OUTPUT_DIR stands
// in for /output:
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// The program must write the same bytes on both of its runs, so it copies
// files as they are and lets buildDossier do the only transformation.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'app'), join(out, 'app'), { recursive: true });

const shotsDir = join(here, 'screenshots');
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(shotsDir)) {
  cpSync(shotsDir, join(out, 'screenshots'), { recursive: true });
}

// The scorer's caps for this bounty: no more than 4 screenshots, none over
// 256 KiB; app/ at most 993 files and 48 MiB in all; no path under app/
// longer than 1000 bytes. buildDossier refuses anything past them, and the
// dossier text is capped at 160 KiB.
const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
});
writeFileSync(join(out, 'dossier.json'), dossier);
console.log(`wrote ${join(out, 'dossier.json')} (${Buffer.byteLength(dossier)} bytes)`);
