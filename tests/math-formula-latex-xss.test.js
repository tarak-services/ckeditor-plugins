/**
 * Stored XSS through MathLive text-mode LaTeX.
 *
 * These tests are expected to FAIL while math formulas are rendered by assigning
 * MathLive 0.108.2 markup to innerHTML. They pass once text-mode content cannot
 * introduce an element or an event-handler attribute, and a browser no longer
 * runs that handler.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  ButtonView,
  ClassicEditor,
  Essentials,
  Paragraph,
  Plugin,
  Widget,
  toWidget,
} from 'ckeditor5';
import { classNameAfterLoad } from './chrome-document.js';
import createMathLivePlugin from '../src/plugins/MathLivePlugin.jsx';

const HANDLER = 'document.documentElement.className=1';
const IMAGE = `<img src=x onerror=${HANDLER}>`;

const TEXT_COMMANDS = [
  'text',
  'mbox',
  'textbf',
  'textrm',
  'textit',
  'textsf',
  'texttt',
  'textsc',
  'textsl',
  'textup',
  'textmd',
  'textnormal',
];

function latexFor(command) {
  return `\\${command}{${IMAGE}}`;
}

function executableNodes(root) {
  if (!root) return [];
  const found = [];
  for (const element of root.querySelectorAll('*')) {
    const tag = element.tagName;
    if (tag === 'IMG' || tag === 'SCRIPT' || tag === 'IFRAME') found.push(element);
    for (const name of element.getAttributeNames()) {
      if (name.toLowerCase().startsWith('on') && !found.includes(element)) found.push(element);
    }
  }
  return found;
}

function describeNodes(nodes) {
  return nodes.map((element) => element.outerHTML).join('\n');
}

async function flushMathliveBinding() {
  await import('mathlive');
  await import('../src/plugins/MathLivePlugin.jsx');
  await new Promise((resolve) => setTimeout(resolve, 0));
}

async function createEditor(mathRenderFormat = 'markup') {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const MathLivePlugin = createMathLivePlugin(
    { Plugin, ButtonView, Widget, toWidget },
    { mathRenderFormat }
  );
  const editor = await ClassicEditor.create(host, {
    licenseKey: 'GPL',
    plugins: [Essentials, Paragraph, Widget, MathLivePlugin],
    toolbar: ['MathLive'],
  });
  await waitUntilMathRenders(editor, mathRenderFormat);
  return editor;
}

async function waitUntilMathRenders(editor, mathRenderFormat) {
  const probe = mathRenderFormat === 'mathml' ? 'x' : 'x';
  for (let attempt = 0; attempt < 50; attempt += 1) {
    editor.setData(storedHtml(probe, 'math-tex', mathRenderFormat === 'mathml' ? 'mathml' : ''));
    const render = editor.editing.view.getDomRoot()?.querySelector('.math-formula-render');
    const ready = mathRenderFormat === 'mathml'
      ? render?.querySelector('math')
      : render?.querySelector('.ML__latex');
    if (ready) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error('MathLive output was not assigned; the converter never ran');
}

function storedHtml(latex, kind, format) {
  const formatAttr = format ? ` data-render-format="${format}"` : '';
  if (kind === 'script') return `<p><script type="math/tex">${latex}</script></p>`;
  if (kind === 'widget') {
    return `<p><span class="math-formula-widget" data-latex="${latex}"${formatAttr}></span></p>`;
  }
  return `<p><span class="math-tex" data-latex="${latex}"${formatAttr}></span></p>`;
}

function renderRoot(editor) {
  return editor.editing.view.getDomRoot()?.querySelector('.math-formula-render') ?? null;
}

async function expectSafeFormula(editor, htmlForBrowser) {
  const render = renderRoot(editor);
  const nodes = executableNodes(render);
  const data = editor.getData();
  const parsed = new DOMParser().parseFromString(data, 'text/html');
  const dataNodes = executableNodes(parsed);
  const editingClass = await classNameAfterLoad(render?.innerHTML ?? '');
  const dataClass = await classNameAfterLoad(htmlForBrowser ?? data);
  const problems = [];
  if (!render?.querySelector('.ML__latex, math')) {
    problems.push('formula was not rendered by MathLive');
  }
  if (nodes.length) problems.push(`editing DOM has executable markup:\n${describeNodes(nodes)}`);
  if (dataNodes.length) problems.push(`getData() has executable markup:\n${describeNodes(dataNodes)}`);
  if (editingClass === '1') problems.push('editing markup ran the image error handler in Chrome');
  if (dataClass === '1') problems.push('getData() markup ran the image error handler in Chrome');
  expect(problems).toEqual([]);
}

describe('math formula LaTeX XSS', () => {
  beforeAll(async () => {
    if (!window.ResizeObserver) {
      window.ResizeObserver = class {
        observe() {}
        unobserve() {}
        disconnect() {}
      };
    }
    // jsdom's MathML elements are plain Elements and have no CSSStyleDeclaration.
    // The margin helper calls style.removeProperty after innerHTML is assigned.
    // Browsers provide style on these elements; give the test DOM the same method
    // so the mathml branch can finish. This does not sanitize markup.
    if (!Object.getOwnPropertyDescriptor(Element.prototype, 'style')) {
      Object.defineProperty(Element.prototype, 'style', {
        configurable: true,
        get() {
          if (!this.__testStyle) {
            const store = {};
            this.__testStyle = new Proxy(store, {
              get(target, prop) {
                if (prop === 'removeProperty' || prop === 'setProperty') return () => {};
                return target[prop] ?? '';
              },
              set(target, prop, value) {
                target[prop] = value;
                return true;
              },
            });
          }
          return this.__testStyle;
        },
      });
    }
    await flushMathliveBinding();
  });

  afterAll(() => {
    document.body.innerHTML = '';
  });

  it.each(TEXT_COMMANDS)(
    'stored math-tex markup does not execute %s in the editor or in getData()',
    async (command) => {
      const editor = await createEditor('markup');
      try {
        editor.setData(storedHtml(latexFor(command), 'math-tex', ''));
        await expectSafeFormula(editor);
      } finally {
        await editor.destroy();
      }
    }
  );

  it('stored math-formula-widget markup does not execute \\text', async () => {
    const editor = await createEditor('markup');
    try {
      editor.setData(storedHtml(latexFor('text'), 'widget', ''));
      await expectSafeFormula(editor);
    } finally {
      await editor.destroy();
    }
  });

  it('stored script math/tex markup does not execute \\text', async () => {
    const editor = await createEditor('markup');
    try {
      editor.setData(storedHtml(latexFor('text'), 'script', ''));
      await expectSafeFormula(editor);
    } finally {
      await editor.destroy();
    }
  });

  it('inserting a formula the way the math dialog does does not execute \\text', async () => {
    const editor = await createEditor('markup');
    try {
      const plugin = editor.plugins.get('MathLive');
      plugin._insertMath(editor, latexFor('text'), null, 'markup');
      await expectSafeFormula(editor);
    } finally {
      await editor.destroy();
    }
  });

  it('mathml render format does not execute \\text from stored markup', async () => {
    const editor = await createEditor('mathml');
    try {
      editor.setData(storedHtml(latexFor('text'), 'math-tex', 'mathml'));
      await expectSafeFormula(editor);
    } finally {
      await editor.destroy();
    }
  });

});
