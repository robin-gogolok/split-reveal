/**
 * Emit dist/types/ from the JSDoc in src/. Nothing here is a second source of
 * truth: `tsc` only reads the annotations back out, and `checkJs` in
 * tsconfig.json means a wrong annotation fails the build instead of shipping.
 *
 * The directory is wiped first so a renamed or deleted export cannot leave a
 * stale declaration behind that the dist-is-current CI job would then keep.
 */
import { rm, stat } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const root = new URL('../', import.meta.url);
const outDir = new URL('dist/types/', root);

await rm(outDir, { recursive: true, force: true });

const tsc = spawnSync(process.execPath, [
  new URL('node_modules/typescript/bin/tsc', root).pathname,
  '-p',
  new URL('tsconfig.json', root).pathname,
], { stdio: 'inherit' });

if (tsc.status !== 0) process.exit(tsc.status ?? 1);

for (const name of ['split.d.ts', 'fallback.d.ts']) {
  const { size } = await stat(new URL(name, outDir));
  console.log(`dist/types/${name}  ${size} B`);
}
