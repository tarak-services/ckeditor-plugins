/**
 * Replace \frac with \cfrac for full-size fraction rendering.
 *
 * MathLive renders \frac in inline-math mode with reduced sizing.
 * \cfrac keeps fractions at full display size.
 *
 * Rules:
 *  - Numeric-only fractions: \frac{N}{D} → \cfrac{N}{\raisebox{0.5ex}{D}}
 *  - Other fractions: \frac{a}{b} → \cfrac{a}{b}
 *  - \cfrac, \dfrac are left untouched
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

export function replaceFracWithCfrac(latex) {
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
      if (isNumeric) {
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
