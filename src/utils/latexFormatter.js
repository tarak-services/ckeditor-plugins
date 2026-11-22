const TAB = '  ';

// Nesting deeper than this keeps formatting but stops adding indent, so the
// output stays linear in the input size.
export const MAX_FORMAT_INDENT = 16;

// Longer input is returned as-is: pretty-printing it is never useful and
// every keystroke in the equation editor re-runs the formatter.
export const MAX_FORMAT_LENGTH = 20000;

const MATH_CMD_RE = /\\(frac|cfrac|dfrac|tfrac|int|sum|prod|lim|sqrt|oint)(?![a-zA-Z])/y;

function isLetter(ch) {
  return ch !== undefined && /[a-zA-Z]/.test(ch);
}

// For every '{' in `s`, decide whether it opens a block: its content (up to
// the matching '}', or to the end of the string when unmatched) is longer than
// 3 characters or contains a command. One pass with a stack plus a prefix
// count of command starts, instead of rescanning the remainder per brace.
function classifyBraces(s) {
  const n = s.length;
  const cmdBefore = new Int32Array(n + 1);
  for (let k = 0; k < n; k++) {
    cmdBefore[k + 1] = cmdBefore[k] + (s[k] === '\\' && isLetter(s[k + 1]) ? 1 : 0);
  }

  const isBlock = new Uint8Array(n);
  const open = [];
  const classify = (i, close) => {
    const contentLen = close === -1 ? n - i - 2 : close - i - 1;
    const end = close === -1 ? n : close;
    const hasCommand = cmdBefore[end] - cmdBefore[i + 1] > 0;
    isBlock[i] = contentLen > 3 || hasCommand ? 1 : 0;
  };

  for (let k = 0; k < n; k++) {
    if (s[k] === '{') open.push(k);
    else if (s[k] === '}' && open.length > 0) classify(open.pop(), k);
  }
  while (open.length > 0) classify(open.pop(), -1);

  return isBlock;
}

// nextIndex[k] = first index >= k holding `ch`, or -1.
function nextIndexOf(s, ch) {
  const next = new Int32Array(s.length + 1);
  next[s.length] = -1;
  for (let k = s.length - 1; k >= 0; k--) {
    next[k] = s[k] === ch ? k : next[k + 1];
  }
  return next;
}

export function formatLatexForEditor(latex) {
  if (!latex) return '';
  if (latex.length > MAX_FORMAT_LENGTH) return latex;

  // Normalize existing newlines and extra spaces
  const s = latex.replace(/\s+/g, ' ').trim();
  const n = s.length;

  const braceIsBlock = classifyBraces(s);
  const nextBrace = nextIndexOf(s, '}');
  const nextBracket = nextIndexOf(s, ']');

  // Output is kept as finished lines plus the current line, with the current
  // line's trailing-space count tracked so no check has to rescan `out`.
  const lines = [];
  let line = '';
  let trail = 0;

  const isEmpty = () => line === '' && lines.length === 0;
  const endsWithNewline = () => line === '' && lines.length > 0;
  const endsWithTab = () => trail >= TAB.length;
  const write = (text) => {
    if (!text) return;
    line += text;
    let k = text.length;
    while (k > 0 && text[k - 1] === ' ') k--;
    trail = k === 0 ? trail + text.length : text.length - k;
  };
  const newline = () => {
    lines.push(line);
    line = '';
    trail = 0;
  };
  const dropTrailing = (count) => {
    line = line.slice(0, line.length - count);
    trail -= count;
  };

  let indent = 0;
  const pad = () => TAB.repeat(Math.min(indent, MAX_FORMAT_INDENT));
  const closeIndent = () => {
    indent = Math.max(0, indent - 1);
    if (endsWithTab()) dropTrailing(TAB.length);
    if (!endsWithNewline()) newline();
  };

  const braceStack = [];
  const peek = (str) => s.startsWith(str, i);
  let i = 0;

  while (i < n) {
    if (peek('\\begin{')) {
      const end = nextBrace[i];
      if (end !== -1) {
        if (!isEmpty() && !endsWithNewline() && !endsWithTab()) {
          newline();
          write(pad());
        }
        write(s.substring(i, end + 1));
        newline();
        indent++;
        write(pad());
        i = end + 1;
        continue;
      }
    }

    if (peek('\\end{')) {
      const end = nextBrace[i];
      if (end !== -1) {
        closeIndent();
        write(pad() + s.substring(i, end + 1));
        newline();
        write(pad());
        i = end + 1;
        continue;
      }
    }

    if (peek('\\\\')) {
      let end = i + 2;
      if (s[end] === '[') {
        const close = nextBracket[end];
        if (close !== -1) end = close + 1;
      }
      write(s.substring(i, end));
      newline();
      write(pad());
      i = end;
      while (s[i] === ' ') i++;
      continue;
    }

    if (peek('\\left')) {
      if (!isEmpty() && !endsWithNewline() && !endsWithTab()) {
        newline();
        write(pad());
      }
      write('\\left');
      i += 5;
      if (i < n && s[i] !== ' ') { write(s[i]); i++; } // delimiter
      newline();
      indent++;
      write(pad());
      continue;
    }

    if (peek('\\right')) {
      closeIndent();
      write(pad() + '\\right');
      i += 6;
      if (i < n && s[i] !== ' ') { write(s[i]); i++; } // delimiter
      newline();
      write(pad());
      continue;
    }

    // Math commands that make formatting nicer if preceded by newline
    MATH_CMD_RE.lastIndex = i;
    const mathCmdMatch = MATH_CMD_RE.exec(s);
    if (mathCmdMatch) {
      // Remove trailing spaces if we are going to add a newline
      if (trail > 0) dropTrailing(1);
      if (!isEmpty() && !endsWithNewline() && !endsWithTab()) {
        newline();
        write(pad());
      }
      write(mathCmdMatch[0]);
      i += mathCmdMatch[0].length;
      continue;
    }

    if (s[i] === '{') {
      // Block format if content is > 3 chars or has a command
      const isBlock = braceIsBlock[i] === 1;
      braceStack.push(isBlock);

      if (isBlock) {
        write('{');
        newline();
        indent++;
        write(pad());
      } else {
        write('{');
      }
      i++;
      continue;
    }

    if (s[i] === '}') {
      const isBlock = braceStack.length > 0 ? braceStack.pop() : false;
      if (isBlock) {
        closeIndent();
        write(pad() + '}');
        newline();
        write(pad());
      } else {
        write('}');
      }
      i++;
      continue;
    }

    // Skip extra spaces
    if (s[i] === ' ') {
      if (!isEmpty() && !endsWithNewline() && trail === 0) {
        write(' ');
      }
      i++;
      continue;
    }

    write(s[i]);
    i++;
  }

  lines.push(line);
  const out = lines.join('\n');

  // Cleanup empty lines and trailing whitespace
  return out.replace(/\n[ \t]*\n/g, '\n').replace(/[ \t]+$/gm, '').trim();
}
