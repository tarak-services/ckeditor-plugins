/**
 * Replace \frac with \cfrac for full-size fraction rendering.
 *
 * MathLive renders \frac in inline-math mode with reduced sizing.
 * \cfrac keeps fractions at full display size.
 *
 * Rules:
 *  - Numeric-only fractions: \frac{N}{D}
 *      → with useRaisebox=true:  \cfrac{N}{\raisebox{0.5ex}{D}}
 *      → with useRaisebox=false: \cfrac{N}{D}
 *  - Other fractions: \frac{a}{b} → \cfrac{a}{b}
 *  - \cfrac, \dfrac are left untouched
 *
 * The `\raisebox{0.5ex}` lift on the denominator is a Kokila-font-specific
 * baseline fix -- Kokila's digit glyphs sit lower in the em box than Latin
 * math fonts, which leaves the denominator visibly low under the bar.
 * Other fonts (Times New Roman, Mangal, etc.) don't need it. Callers pass
 * `useRaisebox: isKokilaFontFamily(resolvedMathFontFamily)` to apply the
 * fix only when the math is actually rendered in Kokila.
 */

const NONE = -1;
const isDigit = (c) => c >= '0' && c <= '9';

/**
 * Stored formulas are untrusted, so the rewrite must stay linear in the input.
 *
 * Each \frac{a}{b} → \cfrac{a}{b} rewrite only inserts characters ('c',
 * braces around single-character arguments, the \raisebox wrapper) and drops
 * the spaces between arguments. The text is therefore kept as a linked list of
 * characters with brace matches tracked per node: a rewrite is a constant
 * number of splices, and scanning resumes right after the new `\cfrac` (every
 * earlier \frac already failed to match and the splices cannot change that).
 */
export function replaceFracWithCfrac(latex, { useRaisebox = false } = {}) {
  if (!latex) return latex;

  const ch = Array.from({ length: latex.length }, (_, k) => latex[k]);
  const next = Array.from({ length: latex.length }, (_, k) => (k + 1 < latex.length ? k + 1 : NONE));
  const match = new Array(latex.length).fill(NONE);
  const matchedBy = new Array(latex.length).fill(NONE);

  const openers = [];
  for (let k = 0; k < latex.length; k++) {
    if (ch[k] === '{') openers.push(k);
    else if (ch[k] === '}' && openers.length) {
      const open = openers.pop();
      match[open] = k;
      matchedBy[k] = open;
    }
  }

  const node = (c) => {
    ch.push(c);
    next.push(NONE);
    match.push(NONE);
    matchedBy.push(NONE);
    return ch.length - 1;
  };
  const pair = (open, close) => {
    match[open] = close;
    matchedBy[close] = open;
  };
  // Links the given nodes into a chain and returns [first, last].
  const chain = (nodes) => {
    for (let k = 0; k + 1 < nodes.length; k++) next[nodes[k]] = nodes[k + 1];
    return [nodes[0], nodes[nodes.length - 1]];
  };
  const textNodes = (text) => Array.from(text, node);

  const skipSpaces = (n) => {
    while (n !== NONE && ch[n] === ' ') n = next[n];
    return n;
  };
  // Last node of the argument starting at n, or NONE if its brace is unclosed.
  const argEnd = (n) => (ch[n] === '{' ? match[n] : n);
  const isNumericArg = (start, end) => {
    if (ch[start] !== '{') return isDigit(ch[start]);
    if (next[start] === end) return false;
    for (let n = next[start]; n !== end; n = next[n]) {
      if (!isDigit(ch[n])) return false;
    }
    return true;
  };

  // Puts the single-character argument at n inside a new brace pair, placed
  // after node `before`, and returns the closing brace.
  const wrapSingle = (before, n) => {
    const open = node('{');
    const close = node('}');
    next[before] = open;
    next[open] = n;
    next[close] = next[n];
    next[n] = close;
    if (ch[n] === '}') {
      const outer = matchedBy[n];
      pair(open, n);
      if (outer !== NONE) pair(outer, close);
    } else {
      pair(open, close);
    }
    return close;
  };

  const spellsFrac = (n) => {
    for (const c of 'frac') {
      n = next[n];
      if (n === NONE || ch[n] !== c) return NONE;
    }
    return n;
  };

  let prev = NONE;
  let cur = 0;
  while (cur !== NONE) {
    const fracEnd = ch[cur] === '\\' ? spellsFrac(cur) : NONE;
    if (fracEnd === NONE) {
      prev = cur;
      cur = next[cur];
      continue;
    }

    const afterFrac = () => {
      prev = fracEnd;
      cur = next[fracEnd];
    };

    if (prev !== NONE && (ch[prev] === 'c' || ch[prev] === 'd')) {
      afterFrac();
      continue;
    }

    const firstStart = skipSpaces(next[fracEnd]);
    if (firstStart === NONE) { afterFrac(); continue; }
    const firstEnd = argEnd(firstStart);
    if (firstEnd === NONE) { afterFrac(); continue; }
    const secondStart = skipSpaces(next[firstEnd]);
    if (secondStart === NONE) { afterFrac(); continue; }
    const secondEnd = argEnd(secondStart);
    if (secondEnd === NONE) { afterFrac(); continue; }

    const isNumeric =
      useRaisebox && isNumericArg(firstStart, firstEnd) && isNumericArg(secondStart, secondEnd);
    const secondIsBrace = ch[secondStart] === '{';
    const afterArgs = next[secondEnd];

    const c = node('c');
    next[c] = next[cur];
    next[cur] = c;

    next[fracEnd] = firstStart;
    const firstClose = ch[firstStart] === '{' ? firstEnd : wrapSingle(fracEnd, firstStart);

    if (isNumeric) {
      const outerOpen = node('{');
      const outerClose = node('}');
      pair(outerOpen, outerClose);
      const raise = textNodes('\\raisebox{0.5ex}');
      pair(raise[9], raise[15]);
      const [, raiseEnd] = chain([outerOpen, ...raise]);

      let argFirst = secondStart;
      let argLast = secondEnd;
      if (!secondIsBrace) {
        const open = node('{');
        const close = node('}');
        pair(open, close);
        next[open] = secondStart;
        next[secondEnd] = close;
        argFirst = open;
        argLast = close;
      }
      next[firstClose] = outerOpen;
      next[raiseEnd] = argFirst;
      next[argLast] = outerClose;
      next[outerClose] = afterArgs;
    } else {
      next[firstClose] = secondStart;
      if (!secondIsBrace) wrapSingle(firstClose, secondStart);
    }

    afterFrac();
  }

  let result = '';
  const parts = [];
  for (let n = 0; n !== NONE; n = next[n]) {
    parts.push(ch[n]);
    if (parts.length >= 8192) {
      result += parts.join('');
      parts.length = 0;
    }
  }
  return result + parts.join('');
}

/**
 * Returns true when the font-family string mentions Kokila (case-insensitive,
 * matching even when it appears inside a longer fallback stack like
 * `'UO_0_LatinDigits_abc123', 'Kokila', 'Times New Roman', KaTeX_Main`).
 *
 * Used to gate the `\raisebox` denominator lift in `replaceFracWithCfrac`,
 * which is only needed for Kokila's lower-baseline digits.
 */
export function isKokilaFontFamily(family) {
  return typeof family === 'string' && /\bkokila\b/i.test(family);
}

/**
 * Replace \int with \intop for better integral rendering in MathLive.
 *
 * \intop stacks limits above/below in display style and reads more clearly
 * than the default slanted \int with adjacent limits.
 *
 * Skips \intop, \iint, \intclockwise, and other longer commands.
 */
export function replaceIntWithIntop(latex) {
  return latex.replace(/\\int(?![a-zA-Z])/g, '\\intop');
}

/**
 * Apply MathLive render-time LaTeX normalizations.
 *
 * `options.useRaisebox` is forwarded to `replaceFracWithCfrac` so callers can
 * opt into the Kokila-specific denominator lift. Default is false.
 */
export function prepareMathLatexForRender(latex, options = {}) {
  return replaceIntWithIntop(replaceFracWithCfrac(latex, options));
}
