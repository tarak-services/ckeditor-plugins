// Node ESM loader so tests can import the real JSX components.
// CSS modules and Vite `?inline` CSS imports become inert modules.
// JSX is transformed with esbuild's automatic runtime, the same transform
// Vite applies before the browser runs these files.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

function isCss(url) {
  return url.includes('.css');
}

function isJsx(url) {
  const path = url.split('?')[0];
  return path.endsWith('.jsx');
}

export async function load(url, context, nextLoad) {
  if (isCss(url)) {
    const inline = url.includes('inline');
    const source = inline
      ? 'export default "";\n'
      : 'export default new Proxy({}, { get(_target, key) { return String(key); } });\n';
    return { format: 'module', source, shortCircuit: true };
  }

  if (isJsx(url)) {
    const path = fileURLToPath(url.split('?')[0]);
    const source = await readFile(path, 'utf8');
    const transformed = await esbuild.transform(source, {
      loader: 'jsx',
      format: 'esm',
      jsx: 'automatic',
      sourcefile: path,
    });
    return { format: 'module', source: transformed.code, shortCircuit: true };
  }

  return nextLoad(url, context);
}
