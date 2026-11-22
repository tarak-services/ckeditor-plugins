/**
 * Spec for the equation-editor pretty-printer denial of service.
 *
 * These tests fail while the vulnerability is present. They pass once
 * formatting is a single forward pass with a fixed indent cap (or the
 * formula is refused/truncated before formatting) and the LaTeX code pane
 * refuses to mount one line-number node per line of a huge value.
 *
 * Run:
 *   npm install --prefix /tmp/ckeditor-plugins-dos-deps react@18.3.1 react-dom@18.3.1 esbuild@0.25.12
 *   node --test tests/latex-brace-dos.test.mjs
 *
 * Override the dependency directory with LATEX_DOS_DEPS (the node_modules path).
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { formatLatexForEditor } from '../src/utils/latexFormatter.js';
import { prepareMathLatexForRender } from '../src/utils/fracReplace.js';
import { applyMatrixSpacing } from '../src/utils/matrixSpacing.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const deps = process.env.LATEX_DOS_DEPS || '/tmp/ckeditor-plugins-dos-deps/node_modules';

// Two-space indent, capped at 16 levels. Enough for any real formula and far
// below the unbounded indent the formatter emits today. Output may add a
// newline plus that indent on top of each input character.
const MAX_INDENT_SPACES = 32;
const MAX_OUTPUT_PER_INPUT_CHAR = 48;
// The code pane may show every line of a normal formula. It must not allocate
// a line-number node for every line once the value is this long.
const MAX_LINE_NUMBER_NODES = 512;

function maxLeadingSpaces(output) {
  let max = 0;
  for (const line of output.split('\n')) {
    let width = 0;
    for (const ch of line) {
      if (ch === ' ') width += 1;
      else if (ch === '\t') width += 2;
      else break;
    }
    if (width > max) max = width;
  }
  return max;
}

function assertPrettyPrintBounded(output, input) {
  assert.equal(typeof output, 'string');
  const limit = input.length * MAX_OUTPUT_PER_INPUT_CHAR;
  assert.ok(
    output.length <= limit,
    `pretty-printer expanded ${input.length} characters into ${output.length} (limit ${limit})`
  );
  const indent = maxLeadingSpaces(output);
  assert.ok(
    indent <= MAX_INDENT_SPACES,
    `pretty-printer indented ${indent} spaces (limit ${MAX_INDENT_SPACES})`
  );
}

// MathLiveDialog.jsx initial state, open effect, and Update Render:
// prepareMathLatexForRender then formatLatexForEditor.
function formatForEquationEditor(initialLatex, { useRaisebox = false } = {}) {
  const prepared = initialLatex
    ? prepareMathLatexForRender(initialLatex, { useRaisebox })
    : '';
  return prepared ? formatLatexForEditor(prepared) : '';
}

// MathLiveDialog.jsx matrix column/row spacing handler.
function formatAfterMatrixSpacing(latex, colPt, rowPt) {
  const next = applyMatrixSpacing(latex, colPt, rowPt);
  return formatLatexForEditor(next || '');
}

let lineNumberCounter;

function lineNumberNodes(value) {
  if (!lineNumberCounter) lineNumberCounter = loadLineNumberCounter();
  return lineNumberCounter.then((count) => count(value));
}

async function loadLineNumberCounter() {
  const require = createRequire(path.join(deps, 'esbuild', 'package.json'));
  const esbuild = require('esbuild');
  const outDir = mkdtempSync(path.join(tmpdir(), 'latex-dos-'));
  const outfile = path.join(outDir, 'line-count.cjs');
  const editorPath = path.join(repoRoot, 'src/components/LatexCodeEditor/LatexCodeEditor.jsx');

  await esbuild.build({
    stdin: {
      contents: `
        const { renderToStaticMarkup } = require('react-dom/server');
        const LatexCodeEditor = require(${JSON.stringify(editorPath)}).default;
        function countLineNumberNodes(value) {
          const html = renderToStaticMarkup(
            require('react').createElement(LatexCodeEditor, { value, onChange() {} })
          );
          const matches = html.match(/class="lineNumber"/g);
          return matches ? matches.length : 0;
        }
        module.exports = { countLineNumberNodes };
      `,
      resolveDir: repoRoot,
      sourcefile: 'line-count-entry.js',
      loader: 'js',
    },
    bundle: true,
    format: 'cjs',
    platform: 'node',
    outfile,
    jsx: 'automatic',
    nodePaths: [deps],
    plugins: [
      {
        name: 'css-stub',
        setup(build) {
          build.onResolve({ filter: /\.css$/ }, (args) => ({
            path: args.path,
            namespace: 'css-stub',
          }));
          build.onLoad({ filter: /.*/, namespace: 'css-stub' }, () => ({
            contents: 'export default new Proxy({}, { get: (_, key) => String(key) });',
            loader: 'js',
          }));
        },
      },
    ],
  });

  return require(outfile).countLineNumberNodes;
}

test('formatLatexForEditor does not quadratically expand unmatched opening braces', () => {
  // Mathfield input handler calls formatLatexForEditor on the field value
  // (MathLiveDialog.jsx input listener). The same helper is the whole bug.
  const input = '{'.repeat(400);
  assertPrettyPrintBounded(formatLatexForEditor(input), input);
});

test('formatLatexForEditor does not quadratically expand deeply nested braces', () => {
  const depth = 200;
  const input = '{'.repeat(depth) + 'x' + '}'.repeat(depth);
  assertPrettyPrintBounded(formatLatexForEditor(input), input);
});

test('formatLatexForEditor caps indent for repeated \\left', () => {
  const input = '\\left('.repeat(450);
  assertPrettyPrintBounded(formatLatexForEditor(input), input);
});

test('formatLatexForEditor caps indent for repeated \\begin', () => {
  const input = '\\begin{matrix}'.repeat(800);
  assertPrettyPrintBounded(formatLatexForEditor(input), input);
});

test('opening the equation editor on a saved brace payload stays bounded', () => {
  // Attacker-stored formula, both font paths the dialog actually runs.
  const input = '{'.repeat(600);
  assertPrettyPrintBounded(formatForEquationEditor(input, { useRaisebox: false }), input);
  assertPrettyPrintBounded(formatForEquationEditor(input, { useRaisebox: true }), input);
});

test('equation editor open path does not mount one line-number node per formatted line', async () => {
  const input = '{'.repeat(600);
  const editorLatex = formatForEquationEditor(input);
  assertPrettyPrintBounded(editorLatex, input);
  const lines = editorLatex === '' ? 0 : editorLatex.split('\n').length;
  const nodes = await lineNumberNodes(editorLatex);
  assert.ok(
    nodes <= MAX_LINE_NUMBER_NODES,
    `code pane mounted ${nodes} line-number nodes for ${lines} formatted lines`
  );
});

test('matrix spacing handler formats the current formula within the same bound', () => {
  const input = '\\begin{pmatrix}' + '{'.repeat(400);
  const output = formatAfterMatrixSpacing(input, 4, 8);
  assertPrettyPrintBounded(output, input);
});

test('a normal formula is still pretty-printed within the bound', () => {
  const input = '\\begin{pmatrix}a&b\\\\c&d\\end{pmatrix}';
  const output = formatLatexForEditor(input);
  assertPrettyPrintBounded(output, input);
  assert.ok(output.includes('\\begin{pmatrix}'));
  assert.ok(output.includes('\\end{pmatrix}'));
  assert.ok(output.includes('a&b'));
  assert.equal(formatLatexForEditor(''), '');
  assert.equal(formatLatexForEditor(undefined), '');
});

test('LatexCodeEditor keeps one line-number node per line of a normal formula', async () => {
  const lines = 40;
  const value = Array.from({ length: lines }, (_, i) => `x${i}`).join('\n');
  assert.equal(await lineNumberNodes(value), lines);
});

test('LatexCodeEditor caps line-number nodes for a multi-thousand-line value', async () => {
  const lines = 4000;
  const value = Array.from({ length: lines }, () => 'x').join('\n');
  const nodes = await lineNumberNodes(value);
  assert.ok(
    nodes <= MAX_LINE_NUMBER_NODES,
    `code pane mounted ${nodes} line-number nodes for ${lines} lines`
  );
  assert.ok(nodes < lines);
});
