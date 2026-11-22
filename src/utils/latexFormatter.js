// Stored formulas are untrusted document content, so the pretty-print must stay
// linear in the input: indentation stops growing past MAX_INDENT_LEVEL and the
// raw formula is returned unchanged once the output would exceed MAX_OUTPUT_LENGTH.
const MAX_INDENT_LEVEL = 32;
const MAX_OUTPUT_LENGTH = 100000;

const MATH_CMD_RE = /\\(frac|cfrac|dfrac|tfrac|int|sum|prod|lim|sqrt|oint)(?![a-zA-Z])/y;

function createOutputBuffer() {
  const parts = [];
  let length = 0;

  const tail = (n) => {
    let text = '';
    for (let k = parts.length - 1; k >= 0 && text.length < n; k--) {
      const part = parts[k];
      text = part.slice(Math.max(0, part.length - (n - text.length))) + text;
    }
    return text;
  };

  return {
    get length() {
      return length;
    },
    append(str) {
      if (!str) return;
      parts.push(str);
      length += str.length;
    },
    endsWith(suffix) {
      return tail(suffix.length) === suffix;
    },
    dropEnd(n) {
      while (n > 0 && parts.length) {
        const last = parts.pop();
        if (last.length > n) {
          parts.push(last.slice(0, last.length - n));
          length -= n;
          return;
        }
        length -= last.length;
        n -= last.length;
      }
    },
    toString() {
      return parts.join('');
    },
  };
}

// One pass over the string: for every '{' record where its group ends (the
// index after the matching '}', or s.length if unclosed) and whether a
// \command appears inside it.
function scanBraceGroups(s) {
  const groups = new Map();
  const stack = [];
  const close = (frame, end) => {
    groups.set(frame.start, { end, hasCommand: frame.hasCommand });
    if (stack.length && frame.hasCommand) stack[stack.length - 1].hasCommand = true;
  };

  for (let j = 0; j < s.length; j++) {
    const ch = s[j];
    if (ch === '{') {
      stack.push({ start: j, hasCommand: false });
    } else if (ch === '}') {
      if (stack.length) close(stack.pop(), j + 1);
    } else if (ch === '\\' && stack.length && s[j + 1] && /[a-zA-Z]/.test(s[j + 1])) {
      stack[stack.length - 1].hasCommand = true;
    }
  }
  while (stack.length) close(stack.pop(), s.length);

  return groups;
}

export function formatLatexForEditor(latex) {
  if (!latex) return '';

  const TAB = '  ';
  const out = createOutputBuffer();
  let indent = 0;
  let i = 0;

  const pad = () => TAB.repeat(Math.min(indent, MAX_INDENT_LEVEL));
  // Dedent only removes a TAB that was actually emitted as padding.
  const dropPaddingTab = () => {
    if (indent < MAX_INDENT_LEVEL && out.endsWith(TAB)) out.dropEnd(TAB.length);
  };

  // Normalize existing newlines and extra spaces
  let s = latex.replace(/\s+/g, ' ').trim();

  const nextIndex = new Map();
  // i only moves forward, so a cached position (or a cached miss) stays valid.
  const indexFrom = (ch, from) => {
    const cached = nextIndex.get(ch);
    if (cached !== undefined && (cached === -1 || cached >= from)) return cached;
    const found = s.indexOf(ch, from);
    nextIndex.set(ch, found);
    return found;
  };

  const braceGroups = scanBraceGroups(s);
  const braceStack = [];
  const peek = (str) => s.startsWith(str, i);

  while (i < s.length) {
    if (out.length > MAX_OUTPUT_LENGTH) return latex;

    if (peek('\\begin{')) {
      const end = indexFrom('}', i);
      if (end !== -1) {
        if (out.length && !out.endsWith('\n') && !out.endsWith(TAB)) out.append('\n' + pad());
        out.append(s.substring(i, end + 1) + '\n');
        indent++;
        out.append(pad());
        i = end + 1;
        continue;
      }
    }

    if (peek('\\end{')) {
      const end = indexFrom('}', i);
      if (end !== -1) {
        indent = Math.max(0, indent - 1);
        dropPaddingTab();
        if (!out.endsWith('\n')) out.append('\n');
        out.append(pad() + s.substring(i, end + 1) + '\n');
        out.append(pad());
        i = end + 1;
        continue;
      }
    }

    if (peek('\\\\')) {
      let end = i + 2;
      if (s[end] === '[') {
        const close = indexFrom(']', end);
        if (close !== -1) end = close + 1;
      }
      out.append(s.substring(i, end) + '\n' + pad());
      i = end;
      while (s[i] === ' ') i++;
      continue;
    }

    if (peek('\\left')) {
       if (out.length && !out.endsWith('\n') && !out.endsWith(TAB)) out.append('\n' + pad());
       out.append('\\left');
       i += 5;
       if (i < s.length && s[i] !== ' ') { out.append(s[i]); i++; } // delimiter
       out.append('\n');
       indent++;
       out.append(pad());
       continue;
    }
    
    if (peek('\\right')) {
       indent = Math.max(0, indent - 1);
       dropPaddingTab();
       if (!out.endsWith('\n')) out.append('\n');
       out.append(pad() + '\\right');
       i += 6;
       if (i < s.length && s[i] !== ' ') { out.append(s[i]); i++; } // delimiter
       out.append('\n' + pad());
       continue;
    }

    // Math commands that make formatting nicer if preceded by newline
    MATH_CMD_RE.lastIndex = i;
    const mathCmdMatch = MATH_CMD_RE.exec(s);
    if (mathCmdMatch) {
       // Remove trailing spaces if we are going to add a newline
       if (out.endsWith(' ')) out.dropEnd(1);
       if (out.length && !out.endsWith('\n') && !out.endsWith(TAB)) {
         out.append('\n' + pad());
       }
       out.append(mathCmdMatch[0]);
       i += mathCmdMatch[0].length;
       continue;
    }

    if (s[i] === '{') {
      const { end: j, hasCommand } = braceGroups.get(i);
      
      const contentLen = j - i - 2;
      // Block format if content is > 3 chars or has a command
      const isBlock = contentLen > 3 || hasCommand;
      
      braceStack.push(isBlock);
      
      if (isBlock) {
        out.append('{\n');
        indent++;
        out.append(pad());
      } else {
        out.append('{');
      }
      i++;
      continue;
    }

    if (s[i] === '}') {
      const isBlock = braceStack.length > 0 ? braceStack.pop() : false;
      if (isBlock) {
        indent = Math.max(0, indent - 1);
        dropPaddingTab();
        if (!out.endsWith('\n')) out.append('\n');
        out.append(pad() + '}\n' + pad());
      } else {
        out.append('}');
      }
      i++;
      continue;
    }

    // Skip extra spaces
    if (s[i] === ' ') {
      if (out.length && !out.endsWith('\n') && !out.endsWith(TAB) && !out.endsWith(' ')) {
        out.append(' ');
      }
      i++;
      continue;
    }

    out.append(s[i]);
    i++;
  }

  if (out.length > MAX_OUTPUT_LENGTH) return latex;

  // Cleanup empty lines and trailing whitespace
  return out.toString().replace(/\n[ \t]*\n/g, '\n').replace(/[ \t]+$/gm, '').trim();
}
