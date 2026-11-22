/**
 * Spec for the math-formula fraction rewriter used when a saved document is opened.
 *
 * MathLivePlugin's editing downcast (and data downcast) pass the stored latex
 * attribute straight to prepareMathLatexForRender. These tests call that
 * function and replaceFracWithCfrac, which does the work.
 *
 * They fail while each fraction restarts the scan and copies the whole string.
 * A single left-to-right pass that still rewrites every fraction, including
 * fractions nested inside arguments, makes them pass. Outputs below match the
 * rewriter's current results for inputs that are already handled correctly.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  prepareMathLatexForRender,
  replaceFracWithCfrac,
} from '../src/utils/fracReplace.js';

const SIMPLE = '\\frac{1}{2}';
const SIMPLE_OUT = '\\cfrac{1}{2}';

function measure(fn, input) {
  const started = performance.now();
  const out = fn(input);
  return { ms: performance.now() - started, out };
}

/**
 * Four times as many fractions must stay well under a quadratic curve.
 * On the vulnerable rewriter, 5_000 → 20_000 simple fractions takes well
 * over a quarter second and scales by much more than 8x.
 */
function assertLinearFractionRewrite(fn, label) {
  fn(SIMPLE.repeat(300));

  const smallN = 5_000;
  const largeN = 20_000;
  const small = measure(fn, SIMPLE.repeat(smallN));
  const large = measure(fn, SIMPLE.repeat(largeN));

  assert.equal(small.out, SIMPLE_OUT.repeat(smallN), `${label} rewrote the smaller formula`);
  assert.equal(large.out, SIMPLE_OUT.repeat(largeN), `${label} rewrote every fraction`);
  assert.ok(
    large.ms < 250,
    `${label} took ${large.ms.toFixed(1)}ms to rewrite ${largeN} fractions (limit 250ms)`,
  );

  // Skip the ratio only when the small run is lost in timer noise. A quadratic
  // rewriter spends well over 2ms on 5_000 fractions, so this still runs there.
  if (small.ms >= 2) {
    const ratio = large.ms / small.ms;
    assert.ok(
      ratio < 8,
      `${label} scaled ${ratio.toFixed(1)}x for 4x more fractions ` +
        `(${small.ms.toFixed(1)}ms → ${large.ms.toFixed(1)}ms)`,
    );
  }
}

test('replaceFracWithCfrac rewrites thousands of fractions in one left-to-right pass', () => {
  assertLinearFractionRewrite(replaceFracWithCfrac, 'replaceFracWithCfrac');
});

test('prepareMathLatexForRender rewrites a saved formula of thousands of fractions without hanging', () => {
  assertLinearFractionRewrite(
    (latex) => prepareMathLatexForRender(latex),
    'prepareMathLatexForRender',
  );
});

test('Kokila raisebox rewriting of thousands of numeric fractions stays one pass', () => {
  const count = 8_000;
  const input = SIMPLE.repeat(count);
  const expected = '\\cfrac{1}{\\raisebox{0.5ex}{2}}'.repeat(count);
  prepareMathLatexForRender(SIMPLE.repeat(200), { useRaisebox: true });
  const { ms, out } = measure(
    (latex) => prepareMathLatexForRender(latex, { useRaisebox: true }),
    input,
  );
  assert.equal(out, expected);
  assert.ok(
    ms < 250,
    `raisebox rewrite took ${ms.toFixed(1)}ms for ${count} fractions (limit 250ms)`,
  );
});

test('nested fractions are rewritten at every level', () => {
  assert.equal(
    prepareMathLatexForRender('\\frac{\\frac{1}{2}}{\\frac{3}{4}}'),
    '\\cfrac{\\cfrac{1}{2}}{\\cfrac{3}{4}}',
  );
  const piece = '\\frac{\\frac{1}{2}}{3}';
  const pieceOut = '\\cfrac{\\cfrac{1}{2}}{3}';
  assert.equal(replaceFracWithCfrac(piece.repeat(30)), pieceOut.repeat(30));
});

test('continued and display fractions are left untouched and a following frac is rewritten', () => {
  assert.equal(
    prepareMathLatexForRender('\\cfrac{1}{2}\\dfrac{3}{4}\\frac{5}{6}'),
    '\\cfrac{1}{2}\\dfrac{3}{4}\\cfrac{5}{6}',
  );
  assert.equal(prepareMathLatexForRender('\\tfrac{1}{2}'), '\\tfrac{1}{2}');
});

test('numeric raisebox is applied only when requested, and only to numeric fractions', () => {
  assert.equal(
    replaceFracWithCfrac('\\frac{1}{2}\\frac{a}{b}', { useRaisebox: true }),
    '\\cfrac{1}{\\raisebox{0.5ex}{2}}\\cfrac{a}{b}',
  );
  assert.equal(
    replaceFracWithCfrac('\\frac{12}{34}', { useRaisebox: false }),
    '\\cfrac{12}{34}',
  );
  assert.equal(prepareMathLatexForRender('\\frac{a}{b}'), '\\cfrac{a}{b}');
});

test('spaced and unbraced fraction arguments are normalized', () => {
  assert.equal(prepareMathLatexForRender('\\frac {1} {2}'), '\\cfrac{1}{2}');
  assert.equal(prepareMathLatexForRender('\\frac12'), '\\cfrac{1}{2}');
  assert.equal(prepareMathLatexForRender('x+\\frac{a}{b}+y'), 'x+\\cfrac{a}{b}+y');
});

test('a fraction missing its second argument is left in place', () => {
  assert.equal(prepareMathLatexForRender('\\frac{1}'), '\\frac{1}');
  assert.equal(prepareMathLatexForRender(''), '');
});

test('integral normalization still runs after fraction rewriting', () => {
  assert.equal(prepareMathLatexForRender('\\frac{1}{\\int x}'), '\\cfrac{1}{\\intop x}');
  assert.equal(prepareMathLatexForRender('\\intop_0^1 \\iint'), '\\intop_0^1 \\iint');
  assert.equal(prepareMathLatexForRender('\\int_0^1'), '\\intop_0^1');
});
