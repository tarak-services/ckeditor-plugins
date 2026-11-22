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

// match[k] = index of the '}' closing the '{' at k, or -1 when it is unmatched.
function matchBraces(str) {
  const match = new Int32Array(str.length).fill(-1);
  const open = [];
  for (let k = 0; k < str.length; k++) {
    if (str[k] === '{') open.push(k);
    else if (str[k] === '}' && open.length > 0) match[open.pop()] = k;
  }
  return match;
}

// next[k] = first index >= k where '\frac' starts, or -1.
function nextFracIndex(str) {
  const next = new Int32Array(str.length + 1);
  next[str.length] = -1;
  for (let k = str.length - 1; k >= 0; k--) {
    next[k] = str.startsWith('\\frac', k) ? k : next[k + 1];
  }
  return next;
}

// One \frac argument starting at `pos`: a brace group or a single character.
// It must lie before `limit`, the closing brace of the argument being scanned.
function parseFracArg(str, pos, limit, match) {
  while (pos < limit && str[pos] === ' ') pos++;
  if (pos >= limit) return null;
  if (str[pos] === '{') {
    const close = match[pos];
    if (close === -1) return null;
    return { start: pos + 1, end: close, next: close + 1 };
  }
  return { start: pos, end: pos + 1, next: pos + 1 };
}

// Single forward pass over `latex`; arguments of a converted \frac are queued
// as ranges and scanned in turn, so nested \frac are converted outer-first
// without rescanning the string or re-matching braces per replacement.
export function replaceFracWithCfrac(latex, { useRaisebox = false } = {}) {
  if (!latex) return latex;

  const match = matchBraces(latex);
  const nextFrac = nextFracIndex(latex);
  const out = [];
  let lastChar = '';
  const emit = (text) => {
    if (!text) return;
    out.push(text);
    lastChar = text[text.length - 1];
  };

  // Each item is either text to emit or a [from, to) range of `latex` to scan.
  const work = [{ from: 0, to: latex.length }];
  while (work.length > 0) {
    const item = work.pop();
    if (typeof item === 'string') {
      emit(item);
      continue;
    }

    const { from, to } = item;
    let pos = from;
    let fracIndex = -1;
    let first = null;
    let second = null;
    while (pos < to) {
      const candidate = nextFrac[pos];
      if (candidate === -1 || candidate >= to) break;
      pos = candidate + 5;

      const prev = candidate > from ? latex[candidate - 1] : lastChar;
      if (prev === 'c' || prev === 'd') continue;

      first = parseFracArg(latex, candidate + 5, to, match);
      second = first && parseFracArg(latex, first.next, to, match);
      if (second) {
        fracIndex = candidate;
        break;
      }
    }

    if (fracIndex === -1) {
      emit(latex.slice(from, to));
      continue;
    }

    emit(latex.slice(from, fracIndex));
    const firstArg = latex.slice(first.start, first.end);
    const secondArg = latex.slice(second.start, second.end);
    const isNumeric = /^\d+$/.test(firstArg) && /^\d+$/.test(secondArg);
    const raise = isNumeric && useRaisebox;

    // Pushed in reverse: \cfrac{first}{second} (or {\raisebox{0.5ex}{second}}), then the rest.
    work.push({ from: second.next, to });
    work.push(raise ? '}}' : '}');
    work.push({ from: second.start, to: second.end });
    work.push(raise ? '}{\\raisebox{0.5ex}{' : '}{');
    work.push({ from: first.start, to: first.end });
    work.push('\\cfrac{');
  }

  return out.join('');
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
