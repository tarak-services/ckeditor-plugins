// Treat plugin files as JavaScript modules. They contain no JSX syntax.
export async function load(url, context, nextLoad) {
  if (url.endsWith('.jsx')) {
    const result = await nextLoad(url, { ...context, format: 'module' });
    return {
      format: 'module',
      source: result.source,
      shortCircuit: true
    };
  }
  return nextLoad(url, context);
}
