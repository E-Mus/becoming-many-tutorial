/**
 * Spiegelt den Quellcode nach Z:/Projekte/Becoming Many/Experimente/Icaros tutorial/Weiß1
 *
 * Warum ueberhaupt: von der TrueNAS-Freigabe darf Windows keine Programme
 * starten, deshalb kann dort kein node_modules und damit kein Dev-Server
 * liegen. Entwickelt wird lokal, der Code liegt zusaetzlich dort, wo er
 * hingehoert. Erlaubt die Freigabe irgendwann Execute, kann das hier weg.
 *
 * Aufruf: npm run sync
 */
import { cp, mkdir, readdir, rm, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, '..');
const dst = 'Z:/Projekte/Becoming Many/Experimente/Icaros tutorial/Weiß1';

/** Was gespiegelt wird. node_modules und dist bleiben absichtlich lokal. */
const ENTRIES = [
  'index.html', 'package.json', 'tsconfig.json', 'vite.config.ts',
  '.gitignore', 'README.md', 'src', 'scripts', 'docs',
];

/** Von frueheren Versuchen uebrig und inzwischen irrefuehrend. */
const OBSOLETE = ['start.cmd'];

if (!existsSync('Z:/')) {
  console.error('Z: ist nicht erreichbar - Netzlaufwerk verbunden?');
  process.exit(1);
}

await mkdir(dst, { recursive: true });

for (const name of ENTRIES) {
  const from = join(src, name);
  if (!existsSync(from)) continue;
  await cp(from, join(dst, name), { recursive: true, force: true });
  const s = await stat(from);
  console.log(`  ${s.isDirectory() ? 'Ordner' : 'Datei '}  ${name}`);
}

for (const name of OBSOLETE) {
  const p = join(dst, name);
  if (existsSync(p)) {
    await rm(p, { force: true });
    console.log(`  entfernt (veraltet)  ${name}`);
  }
}

// Fremde Dateien nur melden, nie loeschen.
const known = new Set([...ENTRIES, 'node_modules', 'dist']);
const extra = (await readdir(dst)).filter((n) => !known.has(n));
if (extra.length) console.log(`\nHinweis - nicht von hier, unangetastet gelassen: ${extra.join(', ')}`);

console.log(`\nGespiegelt nach:\n  ${dst}\n`);
