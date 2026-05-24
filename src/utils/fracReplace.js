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

function findMatchingBrace(str, startIndex) {
  if (str[startIndex] !== '{') return -1;
  let depth = 1;
  for (let i = startIndex + 1; i < str.length; i++) {
    if (str[i] === '{') depth++;
    else if (str[i] === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function parseFracArgs(str, pos) {
  while (pos < str.length && str[pos] === ' ') pos++;
  if (pos >= str.length) return null;

  let firstArg, firstEnd;
  if (str[pos] === '{') {
    const braceEnd = findMatchingBrace(str, pos);
    if (braceEnd === -1) return null;
    firstArg = str.substring(pos + 1, braceEnd);
    firstEnd = braceEnd + 1;
  } else {
    firstArg = str[pos];
    firstEnd = pos + 1;
  }

  pos = firstEnd;
  while (pos < str.length && str[pos] === ' ') pos++;
  if (pos >= str.length) return null;

  let secondArg, secondEnd;
  if (str[pos] === '{') {
    const braceEnd = findMatchingBrace(str, pos);
    if (braceEnd === -1) return null;
    secondArg = str.substring(pos + 1, braceEnd);
    secondEnd = braceEnd + 1;
  } else {
    secondArg = str[pos];
    secondEnd = pos + 1;
  }

  return { firstArg, secondArg, endPos: secondEnd };
}

export function replaceFracWithCfrac(latex, { useRaisebox = false } = {}) {
  let result = latex;
  let changed = true;

  while (changed) {
    changed = false;
    let pos = 0;

    while (pos < result.length) {
      const fracIndex = result.indexOf('\\frac', pos);
      if (fracIndex === -1) break;

      if (fracIndex > 0 && (result[fracIndex - 1] === 'c' || result[fracIndex - 1] === 'd')) {
        pos = fracIndex + 5;
        continue;
      }

      const parsed = parseFracArgs(result, fracIndex + 5);
      if (!parsed) {
        pos = fracIndex + 5;
        continue;
      }

      const { firstArg, secondArg, endPos } = parsed;
      const isNumeric = /^\d+$/.test(firstArg) && /^\d+$/.test(secondArg);

      let replacement;
      if (isNumeric && useRaisebox) {
        replacement = `\\cfrac{${firstArg}}{\\raisebox{0.5ex}{${secondArg}}}`;
      } else {
        replacement = `\\cfrac{${firstArg}}{${secondArg}}`;
      }

      result = result.substring(0, fracIndex) + replacement + result.substring(endPos);
      changed = true;
      break;
    }
  }

  return result;
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
