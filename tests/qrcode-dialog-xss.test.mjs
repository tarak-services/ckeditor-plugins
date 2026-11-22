/**
 * Stored markup in a QR (and barcode) image must not run when the edit dialog opens.
 *
 * These tests fail while the dialog builds its form with innerHTML and copies the
 * saved text into a quoted attribute. They pass once that text cannot escape the
 * attribute and cannot run as a handler.
 *
 * Run:
 *   npm install --no-save --ignore-scripts jsdom@25.0.1
 *   node --import ./tests/register-jsx.mjs --test --test-concurrency=1 ./tests/qrcode-dialog-xss.test.mjs
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';

const PAYLOAD = '" onfocus="window.__xssFired=1" x="';
const GIF = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost/',
  pretendToBeVisual: true,
});
const { window } = dom;
global.window = window;
global.document = window.document;
for (const key of Object.getOwnPropertyNames(window)) {
  if (key in global) continue;
  try {
    global[key] = window[key];
  } catch {
    // Some browser globals cannot be copied onto Node's global object.
  }
}
if (!window.ResizeObserver) {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
global.ResizeObserver = window.ResizeObserver;
global.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 16);
global.cancelAnimationFrame = (id) => clearTimeout(id);
window.requestAnimationFrame = global.requestAnimationFrame;
window.cancelAnimationFrame = global.cancelAnimationFrame;

const CKEditor = await import('ckeditor5');
const {
  ClassicEditor,
  Essentials,
  Paragraph,
  Image,
  ImageInline,
  ImageTextAlternative,
  GeneralHtmlSupport,
} = CKEditor;
const createQRCodePlugin = (await import('../src/plugins/QRCodePlugin.jsx')).default;
const createBarcodePlugin = (await import('../src/plugins/BarcodePlugin.jsx')).default;
const QRCodePlugin = createQRCodePlugin(CKEditor);
const BarcodePlugin = createBarcodePlugin(CKEditor);

const htmlSupport = {
  allow: [{ name: /.*/, attributes: true, classes: true, styles: true }],
  disallow: [{
    name: 'img',
    attributes: [
      'data-qrcode-value',
      'data-qrcode-size',
      'data-barcode-value',
      'data-barcode-format',
      'data-barcode-height',
      'data-barcode-showtext',
      'data-barcode-module-mm',
    ],
  }],
};

function mount() {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

async function createEditor(extraPlugins, toolbar) {
  return ClassicEditor.create(mount(), {
    licenseKey: 'GPL',
    plugins: [Essentials, Paragraph, Image, ImageInline, GeneralHtmlSupport, ...extraPlugins],
    toolbar,
    image: { insert: { type: 'inline' } },
    htmlSupport,
  });
}

async function destroyEditor(editor) {
  for (const node of [...document.body.querySelectorAll('div')]) {
    if (!node.querySelector('.ck-editor') && node.querySelector('input, button, h2')) {
      node.remove();
    }
  }
  await editor.destroy();
}

function savedDocumentCarriesRawQuote(html, attribute) {
  // The data processor encodes the quote, so the saved document is text, not a handler.
  assert.match(html, new RegExp(`${attribute}="[^"]*&quot;`));
}

async function loadInFreshEditor(html, extraPlugins) {
  const editor = await createEditor(extraPlugins, []);
  await editor.setData(html);
  return editor;
}

function editingImage(editor) {
  const img = editor.ui.getEditableElement().querySelector('img');
  assert.ok(img, 'expected an image in the editing view');
  for (const attr of img.getAttributeNames()) {
    assert.equal(attr.toLowerCase().startsWith('on'), false, `image attribute ${attr} is an event handler`);
  }
  return img;
}

function openByDoubleClick(img) {
  window.__xssFired = undefined;
  img.dispatchEvent(new window.MouseEvent('dblclick', { bubbles: true, cancelable: true }));
}

function eventHandlerAttributes(element) {
  return element.getAttributeNames().filter(name => name.toLowerCase().startsWith('on'));
}

/**
 * Re-parse the dialog markup the plugin just inserted and focus its fields
 * in Chrome. jsdom records the injected handler but does not run it.
 */
function chromeRunsHandler(markup) {
  return new Promise((resolve, reject) => {
    mkdtemp(join(tmpdir(), 'qr-xss-')).then(async (dir) => {
      const file = join(dir, 'page.html');
      const page = `<!DOCTYPE html><html><body><div id="host"></div><script>
        document.getElementById('host').innerHTML = ${JSON.stringify(markup)};
        for (const el of document.querySelectorAll('input, textarea, select, button')) {
          try { el.focus(); } catch (e) {}
        }
        document.documentElement.dataset.fired = window.__xssFired ? 'yes' : 'no';
      </script></body></html>`;
      await writeFile(file, page);
      const child = spawn('google-chrome', [
        '--headless=new',
        '--no-sandbox',
        '--disable-gpu',
        '--disable-dev-shm-usage',
        `--user-data-dir=${join(dir, 'profile')}`,
        '--virtual-time-budget=2000',
        '--timeout=3000',
        '--dump-dom',
        file,
      ], { stdio: ['ignore', 'pipe', 'ignore'] });
      let out = '';
      child.stdout.on('data', (chunk) => {
        out += chunk;
        if (out.includes('data-fired=')) {
          child.kill('SIGKILL');
        }
      });
      const timer = setTimeout(() => child.kill('SIGKILL'), 20000);
      child.on('close', async () => {
        clearTimeout(timer);
        await rm(dir, { recursive: true, force: true });
        const match = out.match(/data-fired="(yes|no)"/);
        if (!match) {
          reject(new Error(`Chrome did not report handler execution.\n${out.slice(0, 800)}`));
          return;
        }
        resolve(match[1] === 'yes');
      });
    }).catch(reject);
  });
}

async function assertFieldShowsTextWithoutRunning(input, expectedValue) {
  assert.ok(input, 'edit dialog did not create the text field');
  // outerHTML is the field the plugin inserted, including any handler attribute
  // the quote breakout created. Chrome parses that markup and focuses the field.
  const fired = await chromeRunsHandler(input.outerHTML);
  assert.equal(fired, false);
  assert.equal(input.value, expectedValue);
  assert.deepEqual(eventHandlerAttributes(input), []);
}

test('QR insert stores a quoted value, and reopening it does not run that value', { timeout: 60000 }, async () => {
  const author = await createEditor([QRCodePlugin], ['insertQRCode']);
  try {
    author.ui.componentFactory.create('insertQRCode').fire('execute');
    const draft = document.querySelector('#qrcode-text');
    assert.ok(draft, 'insert dialog did not open');
    draft.value = PAYLOAD;
    document.querySelector('#qrcode-insert').click();
    const html = await waitFor(() => {
      const data = author.getData();
      return data.includes('data-qrcode-value') ? data : '';
    });
    savedDocumentCarriesRawQuote(html, 'data-qrcode-value');
    savedDocumentCarriesRawQuote(html, 'alt');

    const victim = await loadInFreshEditor(html, [QRCodePlugin]);
    try {
      const img = editingImage(victim);
      assert.equal(img.getAttribute('data-qrcode-value'), PAYLOAD);
      openByDoubleClick(img);
      await assertFieldShowsTextWithoutRunning(document.querySelector('#qrcode-text'), PAYLOAD);
    } finally {
      await destroyEditor(victim);
    }
  } finally {
    await destroyEditor(author);
  }
});

test('image alt text set through the text-alternative command reopens as QR text without running', { timeout: 60000 }, async () => {
  const author = await createEditor([QRCodePlugin, ImageTextAlternative], ['imageTextAlternative']);
  try {
    author.model.change(writer => {
      const image = writer.createElement('imageInline', { src: GIF, alt: 'photo' });
      author.model.insertContent(image);
      writer.setSelection(image, 'on');
    });
    author.execute('imageTextAlternative', { newValue: `QR Code: ${PAYLOAD}` });
    const html = author.getData();
    savedDocumentCarriesRawQuote(html, 'alt');
    assert.equal(html.includes('data-qrcode-value'), false);

    const victim = await loadInFreshEditor(html, [QRCodePlugin]);
    try {
      const img = editingImage(victim);
      assert.equal(img.getAttribute('alt'), `QR Code: ${PAYLOAD}`);
      assert.equal(img.hasAttribute('data-qrcode-value'), false);
      openByDoubleClick(img);
      await assertFieldShowsTextWithoutRunning(document.querySelector('#qrcode-text'), PAYLOAD);
    } finally {
      await destroyEditor(victim);
    }
  } finally {
    await destroyEditor(author);
  }
});

test('barcode value stored on the image does not run when the edit dialog opens', { timeout: 60000 }, async () => {
  const author = await createEditor([BarcodePlugin], []);
  try {
    author.model.change(writer => {
      const image = writer.createElement('imageInline', {
        src: GIF,
        alt: `Barcode: ${PAYLOAD}`,
        'data-barcode-value': PAYLOAD,
        'data-barcode-format': 'CODE128',
        'data-barcode-height': '50',
        'data-barcode-showtext': 'true',
      });
      author.model.insertContent(image);
    });
    const html = author.getData();
    savedDocumentCarriesRawQuote(html, 'data-barcode-value');

    const victim = await loadInFreshEditor(html, [BarcodePlugin]);
    try {
      const img = editingImage(victim);
      assert.equal(img.getAttribute('data-barcode-value'), PAYLOAD);
      openByDoubleClick(img);
      await assertFieldShowsTextWithoutRunning(document.querySelector('#barcode-text'), PAYLOAD);
    } finally {
      await destroyEditor(victim);
    }
  } finally {
    await destroyEditor(author);
  }
});

test('barcode printed-width value stored on the image does not become a handler', { timeout: 60000 }, async () => {
  const author = await createEditor([BarcodePlugin], []);
  try {
    author.model.change(writer => {
      const image = writer.createElement('imageInline', {
        src: GIF,
        alt: 'Barcode: ABC123',
        'data-barcode-value': 'ABC123',
        'data-barcode-format': 'CODE128',
        'data-barcode-height': '50',
        'data-barcode-showtext': 'true',
        'data-barcode-module-mm': PAYLOAD,
      });
      author.model.insertContent(image);
    });
    const html = author.getData();
    savedDocumentCarriesRawQuote(html, 'data-barcode-module-mm');

    const victim = await loadInFreshEditor(html, [BarcodePlugin]);
    try {
      const img = editingImage(victim);
      assert.equal(img.getAttribute('data-barcode-module-mm'), PAYLOAD);
      openByDoubleClick(img);
      const width = document.querySelector('#barcode-module-mm');
      await assertFieldShowsTextWithoutRunning(width, PAYLOAD);
      const text = document.querySelector('#barcode-text');
      assert.equal(text.value, 'ABC123');
      assert.deepEqual(eventHandlerAttributes(text), []);
    } finally {
      await destroyEditor(victim);
    }
  } finally {
    await destroyEditor(author);
  }
});

function waitFor(fn, ms = 3000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      let value = '';
      try {
        value = fn();
      } catch (error) {
        reject(error);
        return;
      }
      if (value) {
        resolve(value);
        return;
      }
      if (Date.now() - start > ms) {
        reject(new Error('timed out waiting for the editor to store the QR code'));
        return;
      }
      setTimeout(tick, 20);
    };
    tick();
  });
}
