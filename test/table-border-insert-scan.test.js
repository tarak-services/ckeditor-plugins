/**
 * Spec for the table-styles post-fixer.
 *
 * Run (fails while each inserted cell scans the whole table):
 *   npm install --no-save jsdom@25.0.1
 *   node --import ./test/dom-preload.mjs --test ./test/table-border-insert-scan.test.js
 *
 * Inserting a row builds the new row and then fills it, so the model differ
 * reports the new row rather than one tableCell per column. That path does
 * not repeat the scan and is not asserted here. Splitting one cell inserts
 * a single cell and is also not asserted.
 */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { ClassicEditor } from '@ckeditor/ckeditor5-editor-classic';
import { Essentials } from '@ckeditor/ckeditor5-essentials';
import { Paragraph } from '@ckeditor/ckeditor5-paragraph';
import { Table, TableToolbar } from '@ckeditor/ckeditor5-table';
import { ButtonView, createDropdown, ListItemView, ListView } from '@ckeditor/ckeditor5-ui';
import { Plugin } from '@ckeditor/ckeditor5-core';
import { ModelNode } from '@ckeditor/ckeditor5-engine';
import createTableBorderPlugin from '../src/plugins/TableBorderPlugin.jsx';

const ROWS = 32;
const MAX_SCANS = 4;
const DEFAULT_BORDER = '1px dashed #000';

const TableStyle = createTableBorderPlugin({
  Plugin,
  ButtonView,
  createDropdown,
  ListView,
  ListItemView
});

const originalGetAttribute = ModelNode.prototype.getAttribute;
let counting = false;
let styleReads = 0;

ModelNode.prototype.getAttribute = function (key) {
  if (counting && key === 'customCellStyle') {
    styleReads += 1;
  }
  return originalGetAttribute.call(this, key);
};

let editor;

before(async () => {
  const host = document.createElement('div');
  document.body.appendChild(host);
  editor = await ClassicEditor.create(host, {
    licenseKey: 'GPL',
    plugins: [Essentials, Paragraph, Table, TableToolbar, TableStyle],
    toolbar: ['insertTable'],
    table: {
      contentToolbar: ['tableColumn', 'tableRow']
    }
  });
  // jsdom ranges do not implement getClientRects; scrolling is after the model change.
  editor.editing.view.scrollToTheSelection = () => {};
  assert.equal(editor.plugins.has('TableStyle'), true);
  assert.equal(typeof editor.commands.get('insertTableColumnRight').execute, 'function');
});

after(async () => {
  ModelNode.prototype.getAttribute = originalGetAttribute;
  if (editor) {
    await editor.destroy();
  }
});

test('inserting a column into a borderless table scans the table a constant number of times and does not add a border', () => {
  for (const commandName of ['insertTableColumnRight', 'insertTableColumnLeft']) {
    const loadedReads = loadBorderlessTable(ROWS, 1);
    assert.ok(loadedReads <= ROWS * MAX_SCANS, `loading the table read customCellStyle ${loadedReads} times`);

    selectFirstCell();
    const reads = readStylesDuring(() => {
      editor.execute(commandName);
    });
    const cells = listCells();

    assertScanBound(reads, cells.length, commandName);
    assert.equal(cells.length, ROWS * 2);
    for (const cell of cells) {
      const style = cell.getAttribute('customCellStyle');
      assert.equal(style, undefined);
    }
    assert.equal(editor.getData().includes('dashed'), false);
  }
});

test('pasting a wider table into a borderless table scans the table a constant number of times', () => {
  loadBorderlessTable(ROWS, 1);
  selectFirstCell();

  const reads = readStylesDuring(() => {
    editor.editing.view.document.fire('clipboardInput', {
      method: 'paste',
      targetRanges: null,
      dataTransfer: {
        getData(type) {
          if (type === 'text/html') {
            return '<table><tbody><tr><td>a</td><td>b</td></tr></tbody></table>';
          }
          return '';
        }
      }
    });
  });

  const cells = listCells();
  assert.equal(cells.length, ROWS * 2);
  assertScanBound(reads, cells.length, 'paste wider table');
  for (const cell of cells) {
    assert.equal(cell.getAttribute('customCellStyle'), undefined);
  }
});

test('inserting a column into a table that already has a border still copies the default border onto the new cells', () => {
  loadBorderlessTable(3, 1, 'border:1px solid #000');
  selectFirstCell();
  editor.execute('insertTableColumnRight');

  const table = findTable();
  assert.equal(table.getChild(0).getChild(0).getAttribute('customCellStyle').border, '1px solid #000');
  for (let rowIndex = 0; rowIndex < 3; rowIndex++) {
    const inserted = table.getChild(rowIndex).getChild(1);
    assert.equal(inserted.getAttribute('customCellStyle').border, DEFAULT_BORDER);
  }
  assert.equal(editor.getData().includes(DEFAULT_BORDER), true);
});

function loadBorderlessTable(rows, cols, firstCellStyle) {
  const body = [];
  for (let row = 0; row < rows; row++) {
    const cells = [];
    for (let col = 0; col < cols; col++) {
      const style = firstCellStyle && row === 0 && col === 0 ? ` style="${firstCellStyle}"` : '';
      cells.push(`<td${style}></td>`);
    }
    body.push(`<tr>${cells.join('')}</tr>`);
  }
  const html = `<table><tbody>${body.join('')}</tbody></table>`;
  return readStylesDuring(() => {
    editor.setData(html);
  });
}

function selectFirstCell() {
  editor.model.change(writer => {
    const paragraph = findTable().getChild(0).getChild(0).getChild(0);
    writer.setSelection(paragraph, 0);
  });
}

function findTable() {
  const table = [...editor.model.document.getRoot().getChildren()].find(node => node.is('element', 'table'));
  assert.ok(table);
  return table;
}

function listCells() {
  const cells = [];
  for (const row of findTable().getChildren()) {
    if (!row.is('element', 'tableRow')) continue;
    for (const cell of row.getChildren()) {
      if (cell.is('element', 'tableCell')) cells.push(cell);
    }
  }
  return cells;
}

function readStylesDuring(fn) {
  styleReads = 0;
  counting = true;
  try {
    fn();
  } finally {
    counting = false;
  }
  return styleReads;
}

function assertScanBound(reads, cellCount, label) {
  const limit = cellCount * MAX_SCANS;
  assert.ok(
    reads <= limit,
    `${label} read customCellStyle ${reads} times across ${cellCount} cells; ` +
    `more than ${MAX_SCANS} full walks of the table (limit ${limit})`
  );
}
