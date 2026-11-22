/**
 * Fails while createEditorConfig() allows every element and attribute and
 * CKEditor 47.2.0 still builds a live iframe for a javascript URL that hides
 * the scheme with whitespace. Saved getData() keeps that iframe, event
 * handlers, and script elements, and a browser runs them.
 *
 * Run:
 *   npm ci
 *   npm install --prefix /tmp/xss-jsdom jsdom@25 --ignore-scripts
 *   node --test --test-concurrency=1 tests/html-support-xss.test.js
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

const chrome = process.env.CHROME_PATH || 'google-chrome';
const NL = '\n';

async function loadJsdom() {
  try {
    return (await import('jsdom')).JSDOM;
  } catch {
    return (await import('/tmp/xss-jsdom/node_modules/jsdom/lib/api.js')).JSDOM;
  }
}

async function createEditor(initialData) {
  const { JSDOM } = { JSDOM: await loadJsdom() };
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="editor"></div></body></html>', {
    url: 'http://localhost/',
    pretendToBeVisual: true
  });
  const { window } = dom;
  for (const key of Object.getOwnPropertyNames(window)) {
    if (key in globalThis) continue;
    try { globalThis[key] = window[key]; } catch { /* host getters */ }
  }
  globalThis.window = window;
  globalThis.document = window.document;
  Object.defineProperty(globalThis, 'navigator', { value: window.navigator, configurable: true });
  globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 16);
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);

  const CK = await import('ckeditor5');
  const { createEditorConfig } = await import('../src/editors/editorConfig.js');
  const { sharedPlugins, sharedDefaultConfig } = createEditorConfig(CK, {}, null, 'GPL');
  const plugins = sharedPlugins.filter((plugin) => typeof plugin === 'function');
  assert.ok(plugins.includes(CK.GeneralHtmlSupport));
  assert.ok(plugins.includes(CK.SourceEditing));
  const editor = await CK.ClassicEditor.create(document.getElementById('editor'), {
    ...sharedDefaultConfig,
    plugins,
    licenseKey: 'GPL',
    ...(initialData === undefined ? {} : { initialData })
  });
  return editor;
}

function chromeDom(file) {
  return new Promise((resolve, reject) => {
    const child = spawn('timeout', ['20', chrome,
      '--headless=new', '--disable-gpu', '--no-sandbox',
      '--virtual-time-budget=2000', '--dump-dom', file
    ], { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    child.stdout.on('data', (chunk) => { out += chunk; });
    child.on('error', reject);
    child.on('exit', () => resolve(out));
  });
}

async function browserFlag(html, interact) {
  const dir = await mkdtemp(path.join(tmpdir(), 'xss-'));
  const file = path.join(dir, 'page.html');
  const click = interact
    ? `const el = document.querySelector('[onclick], input[type=submit]'); if (el) el.click();`
    : '';
  await writeFile(file, `<!DOCTYPE html><html><body><pre id="out"></pre>${html}<script>
${click}
setTimeout(() => {
  document.getElementById('out').textContent = 'flag=' + !!(window.__xss);
  document.title = 'DONE';
}, 200);
</script></body></html>`);
  const dom = await chromeDom(file);
  await rm(dir, { recursive: true, force: true });
  const match = dom.match(/flag=(true|false)/);
  assert.ok(match, 'chrome did not report a flag: ' + dom.slice(0, 300));
  return match[1] === 'true';
}

test('editing view does not run an iframe javascript URL with whitespace in the scheme', async () => {
  const editor = await createEditor();
  const html = `<p><iframe src="java${NL}script:window.parent.__xss=1"></iframe></p>`;
  await editor.setData(html);
  const iframe = editor.editing.view.getDomRoot().querySelector('iframe');
  const outer = iframe ? iframe.outerHTML : '';
  await editor.destroy();
  const ran = outer ? await browserFlag(outer, false) : false;
  assert.equal(ran, false, outer);
});

test('initial data and source editing do not run that iframe either', async () => {
  const html = `<p><iframe src="java${NL}script:window.parent.__xss=1"></iframe></p>`;
  const initial = await createEditor(html);
  const initialFrame = initial.editing.view.getDomRoot().querySelector('iframe');
  const initialOuter = initialFrame ? initialFrame.outerHTML : '';
  await initial.destroy();

  const editor = await createEditor();
  await editor.setData('<p>safe</p>');
  const source = editor.plugins.get('SourceEditing');
  source.isSourceEditingMode = true;
  const textarea = document.querySelector('.ck-source-editing-area textarea');
  assert.ok(textarea);
  textarea.value = html;
  textarea.dispatchEvent(new window.Event('input', { bubbles: true }));
  try { source.isSourceEditingMode = false; } catch { /* jsdom has no scrollTo; data is already applied */ }
  const sourceFrame = editor.editing.view.getDomRoot().querySelector('iframe');
  const sourceOuter = sourceFrame ? sourceFrame.outerHTML : '';
  const saved = editor.getData();
  await editor.destroy();

  assert.equal(await browserFlag(initialOuter || '<p></p>', false), false, initialOuter);
  assert.equal(await browserFlag(sourceOuter || '<p></p>', false), false, sourceOuter);
  assert.equal(await browserFlag(saved, false), false, saved);
});

test('getData HTML does not run event handlers, scripts, or a literal javascript iframe', async () => {
  const editor = await createEditor();
  const samples = [
    ['<p><iframe src="javascript:window.parent.__xss=1"></iframe></p>', false],
    ['<p onclick="window.parent.__xss=1">open</p>', true],
    ['<p><img src="x" onerror="window.parent.__xss=1"></p>', false],
    ['<p>x</p><script>window.parent.__xss=1</script>', false],
    [`<form action="java${NL}script:window.parent.__xss=1"><p><input type="submit"></p></form>`, true]
  ];
  const outputs = [];
  for (const [html] of samples) {
    await editor.setData(html);
    outputs.push(editor.getData());
  }
  await editor.destroy();
  for (let i = 0; i < samples.length; i++) {
    const ran = await browserFlag(outputs[i], samples[i][1]);
    assert.equal(ran, false, outputs[i]);
  }
});
