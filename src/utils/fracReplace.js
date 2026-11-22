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

const RAISEBOX_OPEN = '{\\raisebox{0.5ex}{';

function isLetter(code) {
  return (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
}

function isSpace(ch) {
  return ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r';
}

// End index of the TeX token at `pos`: a control word (`\frac`), a control
// symbol (`\{`, `\\`), or a single character.
function tokenEnd(str, pos) {
  if (str[pos] === '\\') {
    let end = pos + 1;
    if (end < str.length && isLetter(str.charCodeAt(end))) {
      while (end < str.length && isLetter(str.charCodeAt(end))) end++;
      return end;
    }
    return Math.min(end + 1, str.length);
  }
  const code = str.charCodeAt(pos);
  if (code >= 0xd800 && code <= 0xdbff && pos + 1 < str.length) return pos + 2;
  return pos + 1;
}

function isCommandAt(str, pos, end, name) {
  return end - pos === name.length + 1 && str.startsWith(name, pos + 1);
}

// Index of the matching `}` for every unescaped `{` (-1 when unmatched),
// computed in one pass so argument parsing never rescans the string.
function matchBraces(str) {
  const match = new Int32Array(str.length).fill(-1);
  const open = [];
  let i = 0;
  while (i < str.length) {
    const ch = str[i];
    if (ch === '\\') {
      i = tokenEnd(str, i);
      continue;
    }
    if (ch === '{') open.push(i);
    else if (ch === '}' && open.length) match[open.pop()] = i;
    i++;
  }
  return match;
}

// A command argument starting at or after `pos`: a braced group
// (`start`..`end` is its content, `end` is the closing brace) or one token.
function parseArg(str, pos, match) {
  while (pos < str.length && isSpace(str[pos])) pos++;
  if (pos >= str.length) return null;
  const ch = str[pos];
  if (ch === '{') {
    const close = match[pos];
    return close === -1 ? null : { group: true, start: pos + 1, end: close };
  }
  if (ch === '}') return null;
  return { group: false, start: pos, end: tokenEnd(str, pos) };
}

function argNext(arg) {
  return arg.group ? arg.end + 1 : arg.end;
}

function isDigits(str, arg) {
  if (arg.end <= arg.start) return false;
  for (let i = arg.start; i < arg.end; i++) {
    const code = str.charCodeAt(i);
    if (code < 48 || code > 57) return false;
  }
  return true;
}

/**
 * Single left-to-right scan that rewrites matching commands in place.
 *
 * `rewrite(str, pos, end, match)` is called for each control word at `pos`
 * (ending at `end`) and either returns null to copy it unchanged, or
 * `{ text, next, closes }`: `text` is emitted in place of `pos`..`next`,
 * scanning resumes at `next`, and each `[index, text, next]` in `closes`
 * replaces the closing brace at `index` with `text` and resumes at `next`
 * once the scan reaches it. Every character is visited once, so the cost is
 * linear in the input regardless of how many commands it contains.
 */
function rewriteCommands(str, commandName, rewrite) {
  if (str.indexOf(`\\${commandName}`) === -1) return str;

  const match = matchBraces(str);
  const closes = new Map();
  const out = [];
  let copied = 0;
  let i = 0;

  while (i < str.length) {
    const ch = str[i];
    if (ch === '}') {
      const close = closes.size ? closes.get(i) : undefined;
      if (close) {
        closes.delete(i);
        out.push(str.slice(copied, i), close.text);
        i = copied = close.next;
      } else {
        i++;
      }
      continue;
    }
    if (ch !== '\\') {
      i++;
      continue;
    }

    const end = tokenEnd(str, i);
    const step = isCommandAt(str, i, end, commandName) ? rewrite(str, i, end, match) : null;
    if (!step) {
      i = end;
      continue;
    }
    out.push(str.slice(copied, i), step.text);
    for (const [index, text, next] of step.closes) closes.set(index, { text, next });
    i = copied = step.next;
  }

  out.push(str.slice(copied));
  return out.join('');
}

export function replaceFracWithCfrac(latex, { useRaisebox = false } = {}) {
  if (typeof latex !== 'string') return latex;

  return rewriteCommands(latex, 'frac', (str, pos, end, match) => {
    const first = parseArg(str, end, match);
    const second = first && parseArg(str, argNext(first), match);
    if (!second) return null;

    const raise = useRaisebox && isDigits(str, first) && isDigits(str, second);
    const secondOpen = raise ? RAISEBOX_OPEN : '{';
    const secondClose = raise ? '}}' : '}';
    const closes = [];

    let between;
    let afterBetween;
    if (second.group) {
      between = `}${secondOpen}`;
      afterBetween = second.start;
      closes.push([second.end, secondClose, second.end + 1]);
    } else {
      between = `}${secondOpen}${str.slice(second.start, second.end)}${secondClose}`;
      afterBetween = second.end;
    }

    if (first.group) {
      closes.push([first.end, between, afterBetween]);
      return { text: '\\cfrac{', next: first.start, closes };
    }
    return {
      text: `\\cfrac{${str.slice(first.start, first.end)}${between}`,
      next: afterBetween,
      closes,
    };
  });
}

/**
 * Strip \htmlStyle{style}{content} → content.
 * MathML has no equivalent of \htmlStyle, so the content is kept unwrapped.
 */
export function stripHtmlStyle(latex) {
  if (typeof latex !== 'string') return latex;

  return rewriteCommands(latex, 'htmlStyle', (str, pos, end, match) => {
    const style = parseArg(str, end, match);
    if (!style || !style.group) return null;
    const content = parseArg(str, style.end + 1, match);
    if (!content || !content.group) return null;
    return {
      text: '',
      next: content.start,
      closes: [[content.end, '', content.end + 1]],
    };
  });
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
