// Pretty-printing is skipped above this size, and indentation stops growing
// past MAX_INDENT_DEPTH, so the output stays linear in the input length.
const MAX_FORMAT_LENGTH = 32768;
const MAX_INDENT_DEPTH = 12;

export function formatLatexForEditor(latex) {
  if (!latex) return '';
  if (latex.length > MAX_FORMAT_LENGTH) return latex;

  const TAB = '  ';
  let out = '';
  let indent = 0;
  let i = 0;
  
  // Normalize existing newlines and extra spaces
  let s = latex.replace(/\s+/g, ' ').trim();
  
  const braceStack = [];
  const pad = () => TAB.repeat(Math.min(indent, MAX_INDENT_DEPTH));
  const peek = (str) => s.startsWith(str, i);

  while (i < s.length) {
    if (peek('\\begin{')) {
      const end = s.indexOf('}', i);
      if (end !== -1) {
        if (out && !out.endsWith('\n') && !out.endsWith(TAB)) out += '\n' + pad();
        out += s.substring(i, end + 1) + '\n';
        indent++;
        out += pad();
        i = end + 1;
        continue;
      }
    }

    if (peek('\\end{')) {
      const end = s.indexOf('}', i);
      if (end !== -1) {
        indent = Math.max(0, indent - 1);
        if (out.endsWith(TAB)) out = out.substring(0, out.length - TAB.length);
        if (!out.endsWith('\n')) out += '\n';
        out += pad() + s.substring(i, end + 1) + '\n';
        out += pad();
        i = end + 1;
        continue;
      }
    }

    if (peek('\\\\')) {
      let end = i + 2;
      if (s[end] === '[') {
        const close = s.indexOf(']', end);
        if (close !== -1) end = close + 1;
      }
      out += s.substring(i, end) + '\n' + pad();
      i = end;
      while (s[i] === ' ') i++;
      continue;
    }

    if (peek('\\left')) {
       if (out && !out.endsWith('\n') && !out.endsWith(TAB)) out += '\n' + pad();
       out += '\\left';
       i += 5;
       if (i < s.length && s[i] !== ' ') { out += s[i]; i++; } // delimiter
       out += '\n';
       indent++;
       out += pad();
       continue;
    }
    
    if (peek('\\right')) {
       indent = Math.max(0, indent - 1);
       if (out.endsWith(TAB)) out = out.substring(0, out.length - TAB.length);
       if (!out.endsWith('\n')) out += '\n';
       out += pad() + '\\right';
       i += 6;
       if (i < s.length && s[i] !== ' ') { out += s[i]; i++; } // delimiter
       out += '\n' + pad();
       continue;
    }

    // Math commands that make formatting nicer if preceded by newline
    const mathCmdMatch = s.substring(i).match(/^\\(frac|cfrac|dfrac|tfrac|int|sum|prod|lim|sqrt|oint)(?![a-zA-Z])/);
    if (mathCmdMatch) {
       // Remove trailing spaces if we are going to add a newline
       if (out.endsWith(' ')) out = out.slice(0, -1);
       if (out && !out.endsWith('\n') && !out.endsWith(TAB)) {
         out += '\n' + pad();
       }
       out += mathCmdMatch[0];
       i += mathCmdMatch[0].length;
       continue;
    }

    if (s[i] === '{') {
      let depth = 1;
      let j = i + 1;
      let hasCommand = false;
      // Stop once the content is known to exceed 3 chars; the result is a block either way.
      while (j < s.length && depth > 0 && j - i - 2 <= 3) {
        if (s[j] === '{') depth++;
        if (s[j] === '}') depth--;
        if (s[j] === '\\' && s[j+1] && /[a-zA-Z]/.test(s[j+1])) hasCommand = true;
        j++;
      }
      
      const contentLen = j - i - 2;
      // Block format if content is > 3 chars or has a command
      const isBlock = contentLen > 3 || hasCommand;
      
      braceStack.push(isBlock);
      
      if (isBlock) {
        out += '{\n';
        indent++;
        out += pad();
      } else {
        out += '{';
      }
      i++;
      continue;
    }

    if (s[i] === '}') {
      const isBlock = braceStack.length > 0 ? braceStack.pop() : false;
      if (isBlock) {
        indent = Math.max(0, indent - 1);
        if (out.endsWith(TAB)) out = out.substring(0, out.length - TAB.length);
        if (!out.endsWith('\n')) out += '\n';
        out += pad() + '}\n' + pad();
      } else {
        out += '}';
      }
      i++;
      continue;
    }

    // Skip extra spaces
    if (s[i] === ' ') {
      if (out && !out.endsWith('\n') && !out.endsWith(TAB) && !out.endsWith(' ')) {
        out += ' ';
      }
      i++;
      continue;
    }

    out += s[i];
    i++;
  }

  // Cleanup empty lines and trailing whitespace
  return out.replace(/\n[ \t]*\n/g, '\n').replace(/[ \t]+$/gm, '').trim();
}
