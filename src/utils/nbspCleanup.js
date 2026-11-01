const SPACE_RUN = /[ \u00a0]+/g;

/**
 * Edits that turn ``&nbsp;`` padding in one block of text into plain spacing.
 *
 * CKEditor loads ``&nbsp; &nbsp;`` padding as runs of plain spaces in the model
 * and only writes ``&nbsp;`` back on output, so runs are matched regardless of
 * which space character they hold:
 *
 * - A run of two or more spaces/nbsps collapses to one plain space.
 * - Any run at the start or end of the block is dropped entirely.
 * - A single space or lone nbsp between two words is kept (a lone nbsp is how
 *   typists stop a line break).
 *
 * ``text`` must keep one character per model offset (inline widgets as a
 * placeholder such as U+FFFC) so the returned offsets map onto the model.
 *
 * @param {string} text
 * @returns {Array<{start: number, end: number, replacement: string}>} in ascending order
 */
export function findNbspEdits(text) {
  const edits = [];
  for (const match of text.matchAll(SPACE_RUN)) {
    const start = match.index;
    const end = start + match[0].length;
    if (start === 0 || end === text.length) {
      edits.push({ start, end, replacement: '' });
    } else if (end - start > 1) {
      edits.push({ start, end, replacement: ' ' });
    }
  }
  return edits;
}

/** Apply ``findNbspEdits`` to a plain string. */
export function cleanNbspText(text) {
  let out = text;
  const edits = findNbspEdits(text);
  for (let i = edits.length - 1; i >= 0; i -= 1) {
    const { start, end, replacement } = edits[i];
    out = out.slice(0, start) + replacement + out.slice(end);
  }
  return out;
}
