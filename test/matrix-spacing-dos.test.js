/**
 * Spec for the matrix-spacing main-thread stall.
 *
 * These tests fail while transformMatrixBodies walks the rest of the formula
 * once per unmatched \begin. They pass once that work is a single forward
 * scan, or the rewrite is skipped when an \end is missing or the formula
 * exceeds a fixed bound.
 *
 * Run: node --test test/matrix-spacing-dos.test.js
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyMatrixSpacing,
  hasMatrix,
  normalizeMatrixSpacing,
} from '../src/utils/matrixSpacing.js';

const ENVS = ['pmatrix', 'bmatrix', 'Bmatrix', 'vmatrix', 'Vmatrix', 'matrix'];

function unmatched(env, count) {
  // Text between begins keeps a fix from special-casing one repeated token.
  return `\\begin{${env}}x`.repeat(count);
}

function median(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function elapsedMs(fn) {
  const start = process.hrtime.bigint();
  fn();
  return Number(process.hrtime.bigint() - start) / 1e6;
}

function medianMs(fn, runs = 3) {
  const samples = [];
  for (let i = 0; i < runs; i++) samples.push(elapsedMs(fn));
  return median(samples);
}

/**
 * Four times as many unmatched begins must not take quadratic time.
 * A single forward scan is about 4x. The current per-begin search is about 16x.
 */
function assertSubquadratic(label, run) {
  const small = unmatched('pmatrix', 2000);
  const large = unmatched('pmatrix', 8000);
  assert.equal(hasMatrix(small), true);
  assert.equal(hasMatrix(large), true);
  run(unmatched('pmatrix', 50));
  const smallMs = medianMs(() => run(small));
  const largeMs = medianMs(() => run(large));
  const ratio = largeMs / Math.max(smallMs, 0.25);
  assert.ok(
    ratio < 8,
    `${label}: 4x unmatched begins took ${ratio.toFixed(1)}x ` +
      `(${smallMs.toFixed(1)}ms -> ${largeMs.toFixed(1)}ms)`
  );
  assert.equal(run(large), large);
}

test('column spacing change stays subquadratic without a matrix end', () => {
  assertSubquadratic('applyMatrixSpacing column', (latex) => applyMatrixSpacing(latex, 1, 0));
});

test('row spacing change stays subquadratic without a matrix end', () => {
  assertSubquadratic('applyMatrixSpacing row', (latex) => applyMatrixSpacing(latex, 0, 1));
});

test('normalizeMatrixSpacing stays subquadratic without a matrix end', () => {
  assertSubquadratic('normalizeMatrixSpacing', (latex) => normalizeMatrixSpacing(latex));
});

test('every matrix environment shares the same bounded scan', () => {
  for (const env of ENVS) {
    const small = unmatched(env, 2000);
    const large = unmatched(env, 8000);
    assert.equal(hasMatrix(large), true);
    applyMatrixSpacing(unmatched(env, 50), 1, 0);
    const smallMs = medianMs(() => applyMatrixSpacing(small, 1, 0));
    const largeMs = medianMs(() => applyMatrixSpacing(large, 1, 0));
    const ratio = largeMs / Math.max(smallMs, 0.25);
    assert.ok(
      ratio < 8,
      `${env}: 4x unmatched begins took ${ratio.toFixed(1)}x ` +
        `(${smallMs.toFixed(1)}ms -> ${largeMs.toFixed(1)}ms)`
    );
    assert.equal(normalizeMatrixSpacing(large), large);
  }
});

test('a closed matrix still receives column and row spacing', () => {
  for (const env of ENVS) {
    const src = `\\begin{${env}}a&b\\\\c&d\\end{${env}}`;
    assert.equal(hasMatrix(src), true);
    assert.equal(
      applyMatrixSpacing(src, 5, 0),
      `\\begin{${env}}a\\hspace{5pt}&b\\\\c\\hspace{5pt}&d\\end{${env}}`
    );
    assert.equal(
      applyMatrixSpacing(src, 0, 8),
      `\\begin{${env}}a&b\\\\[8pt]c&d\\end{${env}}`
    );
    assert.equal(normalizeMatrixSpacing(applyMatrixSpacing(src, 5, 8)), src);
  }
});
