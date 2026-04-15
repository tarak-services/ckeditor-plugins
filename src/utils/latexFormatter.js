export function formatLatexForEditor(latex) {
  if (!latex) return '';
  
  // Add newline and indent after \begin{...}
  let formatted = latex.replace(/\\begin{([^}]+)}/g, '\\begin{$1}\n  ');
  
  // Add newline and indent after \\ or \\[1em]
  formatted = formatted.replace(/(\\\\(?:\[[^\]]*\])?)\s*/g, '$1\n  ');

  // Add newline before \end{...}
  formatted = formatted.replace(/\s*\\end{([^}]+)}/g, '\n\\end{$1}');

  return formatted.trim();
}
