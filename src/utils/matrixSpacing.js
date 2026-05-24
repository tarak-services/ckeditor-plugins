/**
 * Per-equation matrix spacing transformations.
 *
 * Goal: let the toolbar selectors widen the space between matrix columns
 * and/or rows without changing the matrix environment (pmatrix/bmatrix/...).
 * Switching to `\left(\begin{array}{...}\end{array}\right)` would also work
 * for columns, but `\left\right` auto-sizes delimiters with extra padding
 * compared to pmatrix's built-in tight delimiters, which makes the parens
 * look "too tall" with empty space above and below the matrix content.
 *
 * Approach (purely additive, keeps the original env):
 *   - Column spacing: inject `\hspace{Xpt}` before every cell separator `&`
 *     inside each matrix body. With `c` alignment all rows get the same
 *     injection, so columns stay aligned. The default pmatrix inter-column
 *     space is preserved; we just add extra room on top.
 *   - Row spacing: replace `\\` row separators with `\\[Xpt]` to add extra
 *     vertical gap between rows.
 *
 * Both transforms are confined to recognized matrix environments so we don't
 * touch unrelated `&` or `\\` in the equation. `normalizeMatrixSpacing`
 * removes any prior injection so re-applying is idempotent.
 */

const MATRIX_ENVS = ['pmatrix', 'bmatrix', 'Bmatrix', 'vmatrix', 'Vmatrix', 'matrix'];
const ENV_ALT = MATRIX_ENVS.join('|');
const MATRIX_DETECT_RE = new RegExp(`\\\\begin\\{(?:${ENV_ALT})\\}`);

/** Whether `latex` contains at least one matrix environment we can target. */
export function hasMatrix(latex) {
  return typeof latex === 'string' && MATRIX_DETECT_RE.test(latex);
}

/** Strip prior column hspace injections and row spacing markers from `body`. */
function normalizeMatrixBody(body) {
  return body
    // Drop `\hspace{...}` (with optional surrounding whitespace) that sits
    // directly before a `&` cell separator -- that's our column injection.
    .replace(/\\hspace\{[^}]*\}\s*(?=&)/g, '')
    // Drop `\\[Xpt]` row spacing markers back to bare `\\`.
    .replace(/\\\\\[[^\]]*\]/g, '\\\\');
}

/** Run `transformBody(body)` over every matrix env body in `latex`. */
function transformMatrixBodies(latex, transformBody) {
  const envRe = new RegExp(
    `\\\\begin\\{(${ENV_ALT})\\}([\\s\\S]*?)\\\\end\\{\\1\\}`,
    'g'
  );
  return latex.replace(envRe, (_m, env, body) => {
    return `\\begin{${env}}${transformBody(body)}\\end{${env}}`;
  });
}

/** Remove all matrix spacing injections this module may have added. */
export function normalizeMatrixSpacing(latex) {
  if (!latex) return latex;
  return transformMatrixBodies(latex, normalizeMatrixBody);
}

/**
 * Apply column/row spacing to every matrix environment in `latex`.
 *   - `colPt`: extra horizontal pt to inject between columns (0 = no extra).
 *   - `rowPt`: extra vertical pt for `\\[Xpt]` row spacing (0 = no extra).
 *
 * Always normalizes any prior injection first so changing the selector value
 * cleanly replaces the previous setting instead of stacking on top.
 */
export function applyMatrixSpacing(latex, colPt, rowPt) {
  if (!latex) return latex;
  const addCol = Number.isFinite(colPt) && colPt !== 0;
  const addRow = Number.isFinite(rowPt) && rowPt !== 0;

  return transformMatrixBodies(latex, (body) => {
    let next = normalizeMatrixBody(body);
    if (addCol) {
      // Inject `\hspace{Xpt}` before every (non-escaped) `&`. All rows get
      // the same injection so column alignment is preserved. Negative values
      // are valid LaTeX (`\hspace{-2pt}`) and tighten columns below default.
      next = next.replace(/(?<!\\)&/g, `\\hspace{${colPt}pt}&`);
    }
    if (addRow) {
      next = next.replace(/\\\\(?!\[)/g, `\\\\[${rowPt}pt]`);
    }
    return next;
  });
}

/**
 * Selector options for the equation editor toolbar. Both axes are additive:
 * "Default" = no transform, larger values = more extra space.
 */
export const MATRIX_COL_SPACING_OPTIONS = [
  { value: 0, label: 'Default' },
  { value: 2, label: '+2pt' },
  { value: 5, label: '+5pt' },
  { value: 10, label: '+10pt' },
  { value: 15, label: '+15pt' },
  { value: 20, label: '+20pt' },
];

export const MATRIX_ROW_SPACING_OPTIONS = [
  { value: 0, label: 'Default' },
  { value: 4, label: '+4pt' },
  { value: 8, label: '+8pt' },
  { value: 12, label: '+12pt' },
  { value: 18, label: '+18pt' },
  { value: 24, label: '+24pt' },
];
