/**
 * Load .jsx plugin sources as ES modules. These files contain no JSX syntax.
 */
export async function load(url, context, nextLoad) {
  if (url.endsWith('.jsx')) {
    const loaded = await nextLoad(url, { ...context, format: 'module' });
    return { ...loaded, format: 'module' };
  }
  return nextLoad(url, context);
}
