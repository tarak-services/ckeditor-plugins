/**
 * Spec for the equation pretty-printer used when a stored formula is opened.
 *
 * MathLiveDialog prepares the stored latex, then formatLatexForEditor builds
 * the string shown in the code pane (initial state, reopen effect, mathfield
 * input, Update Render, and matrix spacing all call that formatter).
 *
 * These tests fail while indent is uncapped. They pass when indent and the
 * pretty-printed length are capped. Returning the formula unchanged, or a
 * truncation of it, is a valid way to meet the cap.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatLatexForEditor } from '../src/utils/latexFormatter.js';
import { prepareMathLatexForRender, isKokilaFontFamily } from '../src/utils/fracReplace.js';

// 128 levels of the formatter's two-space indent. Real formulas stay far
// below this; uncapped growth from a few hundred commands does not.
const MAX_LEADING_WHITESPACE = 256;

// Large enough for a linear pretty-print of the inputs below with the indent
// cap above, and smaller than the quadratic padding those inputs produce now.
const MAX_OUTPUT_CHARS = 128 * 1024;

const COMMAND_COUNT = 400;

function maxLeadingWhitespace(text) {
  let max = 0;
  let i = 0;
  while (i < text.length) {
    let j = i;
    while (j < text.length && (text[j] === ' ' || text[j] === '\t')) j++;
    if (j - i > max) max = j - i;
    const nl = text.indexOf('\n', j);
    if (nl === -1) break;
    i = nl + 1;
  }
  return max;
}

function assertPrettyPrintBounded(output, input) {
  assert.equal(typeof output, 'string');
  const leading = maxLeadingWhitespace(output);
  assert.ok(
    leading <= MAX_LEADING_WHITESPACE,
    `leading whitespace ${leading} exceeds ${MAX_LEADING_WHITESPACE} ` +
      `(input length ${input.length}, output length ${output.length})`
  );
  assert.ok(
    output.length <= MAX_OUTPUT_CHARS,
    `pretty-printed length ${output.length} exceeds ${MAX_OUTPUT_CHARS} ` +
      `(input length ${input.length})`
  );
}

// Same sequence as MathLiveDialog's first render of a stored formula.
function editorLatexOnOpen(storedLatex, mathFontFamily) {
  const prepareOptions = { useRaisebox: isKokilaFontFamily(mathFontFamily) };
  const preparedInitial = storedLatex
    ? prepareMathLatexForRender(storedLatex, prepareOptions)
    : '';
  return preparedInitial ? formatLatexForEditor(preparedInitial) : '';
}

const payloads = {
  'repeated \\begin environments': '\\begin{a}'.repeat(COMMAND_COUNT),
  'repeated \\left commands with delimiters': '\\left('.repeat(COMMAND_COUNT),
  'repeated \\left commands separated by spaces': '\\left '.repeat(COMMAND_COUNT),
  'repeated block braces': '{'.repeat(COMMAND_COUNT) + 'abcd}',
};

for (const [name, input] of Object.entries(payloads)) {
  test(`formatLatexForEditor keeps ${name} within the indent and length caps`, () => {
    assertPrettyPrintBounded(formatLatexForEditor(input), input);
  });

  for (const mathFontFamily of ['Times New Roman', 'Kokila']) {
    test(`opening a stored formula (${mathFontFamily}) keeps ${name} within the caps`, () => {
      assertPrettyPrintBounded(editorLatexOnOpen(input, mathFontFamily), input);
    });
  }
}
