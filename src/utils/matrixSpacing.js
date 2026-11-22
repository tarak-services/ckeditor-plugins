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

const HSPACE_OPEN = '\\hspace{';
const ROW_SPACING_OPEN = '\\\\[';
const WHITESPACE_RUN = /\s*/y;

// The two strips below are index scans rather than regexes because an
// unclosed `\hspace{` or `\\[` makes a regex rescan to the end for every
// occurrence, which is quadratic on untrusted formulas.

/** Drop `\hspace{...}` plus trailing whitespace that sits directly before `&`. */
function stripColumnSpacing(body) {
  let out = '';
  let cursor = 0;
  let from = 0;
  for (;;) {
    const start = body.indexOf(HSPACE_OPEN, from);
    if (start === -1) break;
    const close = body.indexOf('}', start + HSPACE_OPEN.length);
    if (close === -1) break;
    WHITESPACE_RUN.lastIndex = close + 1;
    WHITESPACE_RUN.exec(body);
    const after = WHITESPACE_RUN.lastIndex;
    if (body[after] === '&') {
      out += body.slice(cursor, start);
      cursor = after;
      from = after;
    } else {
      // Every other `\hspace{` before `close` would end at the same brace.
      from = close + 1;
    }
  }
  return out + body.slice(cursor);
}

/** Turn `\\[Xpt]` row spacing markers back into bare `\\`. */
function stripRowSpacing(body) {
  let out = '';
  let cursor = 0;
  for (;;) {
    const start = body.indexOf(ROW_SPACING_OPEN, cursor);
    if (start === -1) break;
    const close = body.indexOf(']', start + ROW_SPACING_OPEN.length);
    if (close === -1) break;
    out += body.slice(cursor, start) + '\\\\';
    cursor = close + 1;
  }
  return out + body.slice(cursor);
}

/** Strip prior column hspace injections and row spacing markers from `body`. */
function normalizeMatrixBody(body) {
  return stripRowSpacing(stripColumnSpacing(body));
}

/**
 * Run `transformBody(body)` over every matrix env body in `latex`.
 *
 * Each `\begin{env}` pairs with the nearest following `\end{env}`; nested or
 * overlapping begins inside a paired body are left as body text. Unclosed
 * begins are skipped in one pass (a lazy regex would rescan to the end for
 * each of them, which is quadratic on untrusted formulas).
 */
function transformMatrixBodies(latex, transformBody) {
  const tokenRe = new RegExp(`\\\\(begin|end)\\{(${ENV_ALT})\\}`, 'g');
  const begins = [];
  const endsByEnv = new Map();
  for (const m of latex.matchAll(tokenRe)) {
    const token = { env: m[2], start: m.index, end: m.index + m[0].length };
    if (m[1] === 'begin') {
      begins.push(token);
    } else {
      if (!endsByEnv.has(token.env)) endsByEnv.set(token.env, { list: [], next: 0 });
      endsByEnv.get(token.env).list.push(token);
    }
  }

  let out = '';
  let cursor = 0;
  for (const begin of begins) {
    if (begin.start < cursor) continue;
    const ends = endsByEnv.get(begin.env);
    if (!ends) continue;
    while (ends.next < ends.list.length && ends.list[ends.next].start < begin.end) ends.next++;
    if (ends.next >= ends.list.length) continue;
    const end = ends.list[ends.next];
    const body = latex.slice(begin.end, end.start);
    out += latex.slice(cursor, begin.start) +
      `\\begin{${begin.env}}${transformBody(body)}\\end{${begin.env}}`;
    cursor = end.end;
  }
  return out + latex.slice(cursor);
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
