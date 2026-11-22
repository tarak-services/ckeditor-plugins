/**
 * Spec for the unbounded colspan expansion in CustomTableColumnResize.
 * These tests fail while the vulnerability is present.
 *
 * A saved table with two cells and a large colspan is loaded through CKEditor's
 * table upcast. Pressing or double-clicking the resize handle must not create
 * one col element per unit of that colspan.
 *
 * Allowed ceiling, matching the remediation: each cell contributes at most 50
 * col elements (or at most the number of cells in the row, which is smaller).
 * One ordinary cell plus one capped cell is at most 51 col elements.
 * Missing, zero, negative, and non-finite colspan values contribute 1.
 *
 * jsdom reports a 0x0 box, and the plugin returns before reading colspan when
 * the table width is 0. The geometry stub below only supplies a positive width.
 */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { JSDOM } from 'jsdom';
import { createRequire } from 'node:module';

const MAX_COLS_FROM_ONE_CELL = 50;
const require = createRequire(import.meta.url);

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost/',
  pretendToBeVisual: true
});
const { window } = dom;

function expose(name, value) {
  Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
}

expose('window', window);
expose('document', window.document);
expose('navigator', window.navigator);
expose('getComputedStyle', window.getComputedStyle.bind(window));
expose('requestAnimationFrame', (callback) => setTimeout(callback, 16));
expose('cancelAnimationFrame', (id) => clearTimeout(id));
if (typeof window.ResizeObserver !== 'function') {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
for (const key of Object.getOwnPropertyNames(window)) {
  if (key in globalThis) continue;
  try {
    expose(key, window[key]);
  } catch {
    // Host accessors that cannot be copied are not used by this path.
  }
}

const originalRect = window.Element.prototype.getBoundingClientRect;
window.Element.prototype.getBoundingClientRect = function getBoundingClientRect() {
  const rect = originalRect.call(this);
  if (rect.width || rect.height) return rect;
  const tag = this.tagName;
  if (tag === 'TABLE') return new window.DOMRect(0, 0, 400, 40);
  if (tag === 'TD' || tag === 'TH' || tag === 'TR') return new window.DOMRect(0, 0, 200, 40);
  return rect;
};

const { ClassicEditor, Essentials, Paragraph, Table, GeneralHtmlSupport, Plugin } = await import('ckeditor5');
const createCustomTableColumnResizePlugin = (await import('../src/plugins/CustomTableColumnResizePlugin.js')).default;
const ResizePlugin = createCustomTableColumnResizePlugin({ Plugin });

function htmlFor(colspan) {
  const span = colspan == null ? '' : ` colspan="${colspan}"`;
  return `<table><tbody><tr><td>a</td><td${span}>b</td></tr></tbody></table>`;
}

async function loadTable(colspan) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const editor = await ClassicEditor.create(host, {
    licenseKey: 'GPL',
    plugins: [Essentials, Paragraph, Table, GeneralHtmlSupport, ResizePlugin],
    htmlSupport: {
      allow: [{ name: /.*/, attributes: true, classes: true, styles: true }]
    },
    toolbar: []
  });
  editor.setData(htmlFor(colspan));
  const plugin = editor.plugins.get('CustomTableColumnResize');
  plugin._updateOverlay();
  return { editor, host, plugin };
}

async function destroyEditor(editor, host) {
  document.querySelectorAll('#column-width-popover').forEach(node => node.remove());
  if (editor) await editor.destroy().catch(() => {});
  host?.remove();
}

function countColsCreatedDuring(run) {
  let created = 0;
  const original = document.createElement.bind(document);
  document.createElement = function createElement(name, options) {
    if (String(name).toLowerCase() === 'col') created += 1;
    return original(name, options);
  };
  try {
    run();
  } finally {
    document.createElement = original;
  }
  return created;
}

function pressHandle(eventName) {
  const handle = document.querySelector('.custom-table-resize-handle');
  assert.ok(handle, 'the resize plugin drew a handle for a two-cell row');
  const created = countColsCreatedDuring(() => {
    handle.dispatchEvent(new window.MouseEvent(eventName, {
      bubbles: true,
      cancelable: true,
      clientX: 10,
      clientY: 10
    }));
  });
  const inserted = document.querySelectorAll('col').length;
  return { created, inserted };
}

before(() => {
  assert.equal(require('ckeditor5/package.json').version, '47.2.0');
});

after(() => {
  document.querySelectorAll('#custom-table-resize-overlay-shared, #column-width-popover').forEach(node => node.remove());
});

test('mousedown does not expand a saved colspan into one col per unit', async () => {
  const { editor, host } = await loadTable(400);
  try {
    const editable = editor.ui.getEditableElement();
    assert.equal(editable.querySelector('td[colspan]')?.getAttribute('colspan'), '400');
    const { created, inserted } = pressHandle('mousedown');
    assert.ok(created <= MAX_COLS_FROM_ONE_CELL + 1, `mousedown created ${created} col elements`);
    assert.ok(inserted <= MAX_COLS_FROM_ONE_CELL + 1, `table contains ${inserted} col elements`);
  } finally {
    await destroyEditor(editor, host);
  }
});

test('double-click does not expand a saved colspan into one col per unit', async () => {
  const { editor, host } = await loadTable(400);
  try {
    const { created, inserted } = pressHandle('dblclick');
    assert.ok(created <= MAX_COLS_FROM_ONE_CELL + 1, `double-click created ${created} col elements`);
    assert.ok(inserted <= MAX_COLS_FROM_ONE_CELL + 1, `table contains ${inserted} col elements`);
  } finally {
    await destroyEditor(editor, host);
  }
});

test('a colspan of 2 still produces one col per spanned column', async () => {
  const { editor, host } = await loadTable(2);
  try {
    const { created } = pressHandle('mousedown');
    assert.equal(created, 3);
  } finally {
    await destroyEditor(editor, host);
  }
});

test('missing, zero, negative, and non-finite colspan values contribute one col', async () => {
  for (const colspan of [null, '0', '-4', 'foo', 'NaN', 'Infinity']) {
    const { editor, host } = await loadTable(colspan);
    try {
      const { created } = pressHandle('mousedown');
      assert.equal(created, 2, `colspan ${JSON.stringify(colspan)} created ${created} col elements`);
    } finally {
      await destroyEditor(editor, host);
    }
  }
});
