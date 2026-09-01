/**
 * Minify src/split-reveal.css into dist/. No target is set on purpose:
 * lowering would rewrite the very features the library exists to use.
 */
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { transform } from 'esbuild';

const source = new URL('../src/split-reveal.css', import.meta.url);
const outDir = new URL('../dist/', import.meta.url);

const css = await readFile(source, 'utf8');
const { code } = await transform(css, { loader: 'css', minify: true, legalComments: 'inline' });

await mkdir(outDir, { recursive: true });
await writeFile(new URL('split-reveal.css', outDir), code);

const gzip = gzipSync(Buffer.from(code), { level: 9 }).length;
console.log(`dist/split-reveal.css  ${code.length} B raw  ${gzip} B gzip`);
