/**
 * Spec for the equation-source line-number denial of service.
 *
 * These tests fail while the source pane mounts one DOM node per
 * pretty-printed line. They pass once that pane virtualizes the gutter
 * or refuses to mount more than MAX_MOUNTED_LINE_NUMBER_NODES of them.
 *
 * Run:
 *   npm install --no-save --ignore-scripts react@18.3.1 react-dom@18.3.1 react-select@5.8.0 jsdom@25.0.1 esbuild@0.25.0
 *   node --import ./tests/register-css-loader.js --test tests/equation-source-line-nodes.test.mjs
 *
 * jsdom cannot construct mathlive's browser custom element (ElementInternals
 * throws, and Node's "mathlive" export is the SSR build, which never calls
 * customElements.define). The math-field stub below only supplies the shadow
 * root and value property MathLiveDialog writes before painting the source
 * pane. Line numbers come from the real LatexCodeEditor.
 *
 * Repeated `\left` and `\begin` also insert a line per command, but each line
 * is indented further than the last, so the pretty-printer's own string
 * building dominates before the gutter mounts. Those two branches are not
 * fixtures here. They still land in LatexCodeEditor, which the raw-newline
 * case caps.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

const MAX_MOUNTED_LINE_NUMBER_NODES = 2000;
const ATTACK_LINE_BREAKS = 8000;

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'http://localhost/',
  pretendToBeVisual: true,
});
const { window } = dom;

globalThis.window = window;
globalThis.document = window.document;
globalThis.HTMLElement = window.HTMLElement;
globalThis.SVGElement = window.SVGElement;
globalThis.Node = window.Node;
globalThis.Element = window.Element;
globalThis.MutationObserver = window.MutationObserver;
globalThis.DocumentFragment = window.DocumentFragment;
globalThis.getComputedStyle = window.getComputedStyle.bind(window);
globalThis.requestAnimationFrame = (callback) => window.setTimeout(callback, 0);
globalThis.cancelAnimationFrame = (id) => window.clearTimeout(id);
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
Object.defineProperty(globalThis, 'navigator', {
  value: window.navigator,
  configurable: true,
});

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver = ResizeObserverStub;
globalThis.ResizeObserver = ResizeObserverStub;
window.mathVirtualKeyboard = { show() {}, hide() {} };

// Built from mathlive 0.108.2 mathlive.mjs:40720, which attaches an open
// shadow root before the dialog appends its stylesheet. jsdom 25 throws in
// ElementInternals when the real constructor runs, so the dialog never
// reaches LatexCodeEditor under the real element.
class MathFieldStub extends window.HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._value = '';
  }

  get value() {
    return this._value;
  }

  set value(next) {
    this._value = next == null ? '' : String(next);
  }

  focus() {}

  get selection() {
    return { ranges: [[0, 0]] };
  }

  set selection(_next) {}

  insert() {}

  getValue() {
    return '';
  }
}

if (!window.customElements.get('math-field')) {
  window.customElements.define('math-field', MathFieldStub);
}

const { default: MathLiveDialog } = await import('../src/plugins/MathLiveDialog.jsx');
const { default: LatexCodeEditor } = await import('../src/components/LatexCodeEditor/LatexCodeEditor.jsx');
const { formatLatexForEditor } = await import('../src/utils/latexFormatter.js');
const { prepareMathLatexForRender } = await import('../src/utils/fracReplace.js');

function lineBreaks(count) {
  return '\\\\'.repeat(count);
}

function bracketedBreaks(count) {
  return '\\\\[0pt]'.repeat(count);
}

function gutterElementCount(container) {
  const textarea = container.querySelector('textarea');
  assert.ok(textarea, 'equation source textarea was not mounted');
  const gutter = textarea.previousElementSibling;
  assert.ok(gutter, 'line-number column was not mounted');
  return { textarea, count: gutter.querySelectorAll('*').length };
}

function assertGutterIsBounded(container, label) {
  const { textarea, count } = gutterElementCount(container);
  assert.ok(
    textarea.value.length > 0,
    `${label}: source pane dropped the formula`
  );
  assert.ok(
    count <= MAX_MOUNTED_LINE_NUMBER_NODES,
    `${label}: mounted ${count} line-number nodes, above the cap of ${MAX_MOUNTED_LINE_NUMBER_NODES}`
  );
}

async function renderDialog(initialLatex) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      React.createElement(MathLiveDialog, {
        isOpen: true,
        initialLatex,
        initialRenderFormat: 'markup',
        onInsert() {},
        onClose() {},
      })
    );
  });
  return {
    container,
    async unmount() {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    },
  };
}

async function renderSource(value) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      React.createElement(LatexCodeEditor, {
        value,
        onChange() {},
      })
    );
  });
  return {
    container,
    async unmount() {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    },
  };
}

test('opening a formula of repeated line breaks mounts a bounded line-number gutter', { timeout: 60000 }, async () => {
  const view = await renderDialog(lineBreaks(ATTACK_LINE_BREAKS));
  try {
    assertGutterIsBounded(view.container, 'open \\\\');
  } finally {
    await view.unmount();
  }
});

test('opening a formula of bracketed line breaks mounts a bounded line-number gutter', { timeout: 60000 }, async () => {
  const view = await renderDialog(bracketedBreaks(ATTACK_LINE_BREAKS));
  try {
    assertGutterIsBounded(view.container, 'open \\\\[0pt]');
  } finally {
    await view.unmount();
  }
});

test('mathfield input reformats stored line breaks without mounting one node per line', { timeout: 60000 }, async () => {
  const view = await renderDialog('x');
  try {
    const field = view.container.querySelector('math-field');
    assert.ok(field, 'math field was not mounted');
    field.value = lineBreaks(ATTACK_LINE_BREAKS);
    await act(async () => {
      field.dispatchEvent(new window.Event('input', { bubbles: true }));
    });
    assertGutterIsBounded(view.container, 'mathfield input');
  } finally {
    await view.unmount();
  }
});

test('Update Render reformats stored line breaks without mounting one node per line', { timeout: 60000 }, async () => {
  const view = await renderDialog(lineBreaks(ATTACK_LINE_BREAKS));
  try {
    const button = [...view.container.querySelectorAll('button')].find((node) =>
      node.textContent.includes('Update Render')
    );
    assert.ok(button, 'Update Render button was not mounted');
    await act(async () => {
      button.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    });
    assertGutterIsBounded(view.container, 'after Update Render');
  } finally {
    await view.unmount();
  }
});

test('matrix row spacing reformats a formula of line breaks without mounting one node per line', { timeout: 60000 }, async () => {
  const latex = `\\begin{pmatrix}${lineBreaks(ATTACK_LINE_BREAKS)}\\end{pmatrix}`;
  const view = await renderDialog(latex);
  try {
    const rows = view.container.querySelector('input[title*="matrix rows"]');
    assert.ok(rows, 'matrix row spacing control was not mounted');
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(rows, '4');
      rows.dispatchEvent(new window.Event('input', { bubbles: true }));
      rows.dispatchEvent(new window.Event('change', { bubbles: true }));
    });
    assertGutterIsBounded(view.container, 'after matrix spacing');
  } finally {
    await view.unmount();
  }
});

test('the source pane caps line-number nodes for every expansion that reaches it', { timeout: 60000 }, async () => {
  // Raw newlines bypass the pretty-printer. handleCodeChange writes the
  // textarea value straight back into this component, so a formatter-only
  // cap would leave this mount unbounded.
  const rawLines = `${'x\n'.repeat(ATTACK_LINE_BREAKS)}x`;
  const expanded = {
    'raw newlines': rawLines,
    'pretty-printed line breaks': formatLatexForEditor(prepareMathLatexForRender(lineBreaks(ATTACK_LINE_BREAKS))),
    'pretty-printed bracketed breaks': formatLatexForEditor(prepareMathLatexForRender(bracketedBreaks(ATTACK_LINE_BREAKS))),
    'pretty-printed block braces': formatLatexForEditor(prepareMathLatexForRender('{abcd}'.repeat(4000))),
    'pretty-printed right delimiters': formatLatexForEditor(prepareMathLatexForRender('\\right)'.repeat(4000))),
  };

  const failures = [];
  for (const [label, value] of Object.entries(expanded)) {
    const view = await renderSource(value);
    try {
      const { textarea, count } = gutterElementCount(view.container);
      if (textarea.value.length === 0) {
        failures.push(`${label}: source pane dropped the formula`);
      }
      if (count > MAX_MOUNTED_LINE_NUMBER_NODES) {
        failures.push(`${label}: mounted ${count} line-number nodes, above the cap of ${MAX_MOUNTED_LINE_NUMBER_NODES}`);
      }
    } finally {
      await view.unmount();
    }
  }
  assert.deepEqual(failures, []);
});

test('Update Render and matrix spacing keep a normal formula one node per line', async () => {
  const latex = '\\begin{pmatrix}a&b\\\\c&d\\end{pmatrix}';
  const view = await renderDialog(latex);
  try {
    const before = formatLatexForEditor(prepareMathLatexForRender(latex, { useRaisebox: false }));
    const opened = gutterElementCount(view.container);
    assert.equal(opened.count, before.split('\n').length);

    const button = [...view.container.querySelectorAll('button')].find((node) =>
      node.textContent.includes('Update Render')
    );
    assert.ok(button, 'Update Render button was not mounted');
    await act(async () => {
      button.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    });
    assert.equal(gutterElementCount(view.container).count, before.split('\n').length);

    const rows = view.container.querySelector('input[title*="matrix rows"]');
    assert.ok(rows, 'matrix row spacing control was not mounted');
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(rows, '4');
      rows.dispatchEvent(new window.Event('input', { bubbles: true }));
      rows.dispatchEvent(new window.Event('change', { bubbles: true }));
    });
    const spaced = gutterElementCount(view.container);
    const spacedLines = spaced.textarea.value.split('\n').length;
    assert.ok(spacedLines > 1 && spacedLines <= MAX_MOUNTED_LINE_NUMBER_NODES);
    assert.equal(spaced.count, spacedLines);
  } finally {
    await view.unmount();
  }
});

test('a normal formula still shows one line-number node per pretty-printed line', async () => {
  const latex = '\\sqrt{abcd}';
  const formatted = formatLatexForEditor(prepareMathLatexForRender(latex, { useRaisebox: false }));
  const expected = formatted.split('\n').length;
  assert.ok(expected > 1 && expected <= MAX_MOUNTED_LINE_NUMBER_NODES);

  const view = await renderSource(formatted);
  try {
    const { count } = gutterElementCount(view.container);
    assert.equal(count, expected);
  } finally {
    await view.unmount();
  }
});
