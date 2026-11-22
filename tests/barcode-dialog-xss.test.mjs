/**
 * Stored XSS in the barcode and QR edit dialogs.
 *
 * These tests describe the safe behavior. They fail while the dialog builds
 * its form with innerHTML and copies saved text into a quoted attribute
 * through an escaper that does not encode double quotes.
 *
 * Run:
 *   node --import ./tests/register-jsx.mjs --test tests/barcode-dialog-xss.test.mjs
 */
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { JSDOM } from 'jsdom';

const PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

function installCanvas(window) {
  const context = {
    fillStyle: '',
    font: '',
    textAlign: '',
    save() {},
    restore() {},
    translate() {},
    clearRect() {},
    fillRect() {},
    fillText() {},
    measureText() {
      return { width: 8 };
    }
  };
  window.HTMLCanvasElement.prototype.getContext = function getContext() {
    return context;
  };
  window.HTMLCanvasElement.prototype.toDataURL = function toDataURL() {
    return PIXEL;
  };
}

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost/',
  runScripts: 'dangerously',
  pretendToBeVisual: true
});
installCanvas(dom.window);
dom.window.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};
globalThis.window = dom.window;
globalThis.document = dom.window.document;
for (const key of Object.getOwnPropertyNames(dom.window)) {
  if (key in globalThis) {
    continue;
  }
  const value = dom.window[key];
  if (typeof value !== 'function') {
    continue;
  }
  try {
    globalThis[key] = value;
  } catch {
    // Some browser globals are accessors that cannot be copied.
  }
}

function clearPage() {
  dom.window.document.body.innerHTML = '';
  delete dom.window.__barcodeValueXss;
  delete dom.window.__barcodeAltXss;
  delete dom.window.__barcodeInsertXss;
  delete dom.window.__barcodeModuleXss;
  delete dom.window.__qrValueXss;
}

async function loadEditorModules() {
  const ckeditor = await import('ckeditor5');
  const barcode = await import('../src/plugins/BarcodePlugin.jsx');
  const qr = await import('../src/plugins/QRCodePlugin.jsx');
  return {
    ckeditor,
    createBarcodePlugin: barcode.default,
    createQRCodePlugin: qr.default
  };
}

function attributeHtml(document, tag, attributes) {
  const element = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, value);
  }
  return element.outerHTML;
}

async function createEditor(dom, plugins, extraConfig = {}) {
  const { ClassicEditor, Essentials, Paragraph, Image } = plugins.ckeditor;
  const element = dom.window.document.createElement('div');
  dom.window.document.body.appendChild(element);
  const editor = await ClassicEditor.create(element, {
    licenseKey: 'GPL',
    plugins: [Essentials, Paragraph, Image, ...extraConfig.plugins],
    image: { toolbar: ['imageTextAlternative'] },
    ...extraConfig.config
  });
  openEditors.push(editor);
  return editor;
}

const openEditors = [];

afterEach(async () => {
  while (openEditors.length) {
    const editor = openEditors.pop();
    await editor.destroy();
  }
  clearPage();
});

function dialogInputs(document) {
  return {
    barcodeText: document.querySelector('#barcode-text'),
    barcodeModule: document.querySelector('#barcode-module-mm'),
    qrText: document.querySelector('#qrcode-text')
  };
}

function assertNoInjectedHandler(input, payload, flagName, window) {
  assert.ok(input, 'dialog field was not created');
  input.focus();
  assert.equal(window[flagName], undefined);
  assert.equal(input.getAttribute('onfocus'), null);
  const foreign = input.parentElement.querySelectorAll('[onfocus], img, script');
  assert.equal(foreign.length, 0);
  if (input.type === 'text') {
    assert.equal(input.value, payload);
  }
}

function doubleClick(window, editor) {
  const editable = editor.ui.getEditableElement();
  const img = editable.querySelector('img');
  assert.ok(img, 'barcode or QR image was not rendered');
  img.dispatchEvent(new window.MouseEvent('dblclick', { bubbles: true, cancelable: true }));
  return img;
}

test('barcode value saved in data-barcode-value does not run when the image is double-clicked', async () => {
  clearPage();
  const mods = await loadEditorModules();
  const BarcodePlugin = mods.createBarcodePlugin(mods.ckeditor);
  const editor = await createEditor(dom, mods, { plugins: [BarcodePlugin] });
  const payload = 'x" onfocus="window.__barcodeValueXss=1" x="&<>';
  const html = `<p>${attributeHtml(dom.window.document, 'img', {
    src: PIXEL,
    alt: `Barcode: ${payload}`,
    'data-barcode-value': payload
  })}</p>`;

  editor.setData(html);
  const saved = editor.getData();
  assert.match(saved, /data-barcode-value="x&quot;/);
  const storedImg = editor.ui.getEditableElement().querySelector('img');
  assert.equal(storedImg.getAttribute('onfocus'), null);
  assert.equal(storedImg.getAttribute('data-barcode-value'), payload);
  const reloaded = await createEditor(dom, mods, { plugins: [BarcodePlugin] });
  reloaded.setData(saved);

  doubleClick(dom.window, reloaded);
  const { barcodeText } = dialogInputs(dom.window.document);
  assertNoInjectedHandler(barcodeText, payload, '__barcodeValueXss', dom.window);
  barcodeText.focus();
  assert.equal(dom.window.__barcodeValueXss, undefined);

});

test('barcode value stored only in the image alt does not run when the image is double-clicked', async () => {
  clearPage();
  const mods = await loadEditorModules();
  const BarcodePlugin = mods.createBarcodePlugin(mods.ckeditor);
  const editor = await createEditor(dom, mods, { plugins: [BarcodePlugin] });
  const payload = 'y" onfocus="window.__barcodeAltXss=1" y="';
  editor.setData(`<p>${attributeHtml(dom.window.document, 'img', {
    src: PIXEL,
    alt: `Barcode: ${payload}`
  })}</p>`);

  doubleClick(dom.window, editor);
  const { barcodeText } = dialogInputs(dom.window.document);
  assertNoInjectedHandler(barcodeText, payload, '__barcodeAltXss', dom.window);
  barcodeText.focus();
  assert.equal(dom.window.__barcodeAltXss, undefined);

});

test('barcode inserted from the dialog does not run for the next editor who double-clicks it', async () => {
  clearPage();
  const mods = await loadEditorModules();
  const BarcodePlugin = mods.createBarcodePlugin(mods.ckeditor);
  const editor = await createEditor(dom, mods, { plugins: [BarcodePlugin] });
  const payload = 'z" onfocus="window.__barcodeInsertXss=1" z="';

  editor.plugins.get('Barcode')._showBarcodeDialog(editor);
  const { barcodeText } = dialogInputs(dom.window.document);
  assert.ok(barcodeText);
  barcodeText.value = payload;
  barcodeText.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  dom.window.document.querySelector('#barcode-insert').click();

  const saved = editor.getData();
  assert.match(saved, /data-barcode-value="z&quot;/);
  const storedImg = editor.ui.getEditableElement().querySelector('img');
  assert.equal(storedImg.getAttribute('onfocus'), null);
  assert.equal(editor.model.document.getRoot().getChild(0).getChild(0).getAttribute('data-barcode-value'), payload);

  const victim = await createEditor(dom, mods, { plugins: [BarcodePlugin] });
  victim.setData(saved);
  doubleClick(dom.window, victim);
  const edited = dialogInputs(dom.window.document).barcodeText;
  assertNoInjectedHandler(edited, payload, '__barcodeInsertXss', dom.window);
  edited.focus();
  assert.equal(dom.window.__barcodeInsertXss, undefined);

});

test('printed bar width from data-barcode-module-mm does not become an event handler', async () => {
  clearPage();
  const mods = await loadEditorModules();
  const BarcodePlugin = mods.createBarcodePlugin(mods.ckeditor);
  const editor = await createEditor(dom, mods, { plugins: [BarcodePlugin] });
  const value = 'ABC123';
  const moduleMm = '0.3" onfocus="window.__barcodeModuleXss=1" autofocus x="';
  editor.setData(`<p>${attributeHtml(dom.window.document, 'img', {
    src: PIXEL,
    alt: `Barcode: ${value}`,
    'data-barcode-value': value,
    'data-barcode-module-mm': moduleMm
  })}</p>`);

  doubleClick(dom.window, editor);
  const { barcodeModule, barcodeText } = dialogInputs(dom.window.document);
  assert.ok(barcodeModule);
  barcodeModule.focus();
  assert.equal(dom.window.__barcodeModuleXss, undefined);
  assert.equal(barcodeModule.getAttribute('onfocus'), null);
  assert.equal(barcodeModule.hasAttribute('autofocus'), false);
  assert.equal(barcodeText.value, value);
  assert.equal(barcodeText.getAttribute('onfocus'), null);

});

test('QR value saved in data-qrcode-value does not run when the image is double-clicked', async () => {
  clearPage();
  const mods = await loadEditorModules();
  const QRCodePlugin = mods.createQRCodePlugin(mods.ckeditor);
  const editor = await createEditor(dom, mods, { plugins: [QRCodePlugin] });
  const payload = 'q" onfocus="window.__qrValueXss=1" q="&<>';
  const html = `<p>${attributeHtml(dom.window.document, 'img', {
    src: PIXEL,
    alt: `QR Code: ${payload}`,
    'data-qrcode-value': payload
  })}</p>`;
  editor.setData(html);
  const saved = editor.getData();
  assert.match(saved, /data-qrcode-value="q&quot;/);
  const storedImg = editor.ui.getEditableElement().querySelector('img');
  assert.equal(storedImg.getAttribute('onfocus'), null);
  assert.equal(storedImg.getAttribute('data-qrcode-value'), payload);

  const victim = await createEditor(dom, mods, { plugins: [QRCodePlugin] });
  victim.setData(saved);
  doubleClick(dom.window, victim);
  const { qrText } = dialogInputs(dom.window.document);
  assertNoInjectedHandler(qrText, payload, '__qrValueXss', dom.window);
  qrText.focus();
  assert.equal(dom.window.__qrValueXss, undefined);

});
