import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// CKEditor 5 imports theme stylesheets, and this package's plugin entry is .jsx
// without JSX syntax. Node's loader knows neither, so the tests load both as source.
export async function load(url, context, nextLoad) {
  if (url.endsWith('.css') || url.endsWith('.svg')) {
    return {
      format: 'module',
      source: 'export default "";',
      shortCircuit: true
    };
  }
  if (url.endsWith('.jsx')) {
    return {
      format: 'module',
      source: await readFile(fileURLToPath(url), 'utf8'),
      shortCircuit: true
    };
  }
  return nextLoad(url, context);
}
