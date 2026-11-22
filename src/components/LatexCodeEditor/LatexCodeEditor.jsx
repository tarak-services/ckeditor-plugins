import React, { useRef, useMemo, useState } from 'react';
import styles from './LatexCodeEditor.module.css';

// Must match the .lineNumber height in LatexCodeEditor.module.css.
const LINE_HEIGHT_PX = 19.5;
// Only this many line-number nodes are mounted at once; the rest of the
// gutter is filled by spacers so its scroll height still matches the textarea.
const MAX_RENDERED_LINES = 200;
const OVERSCAN_LINES = 50;

function countLines(value) {
  if (!value) return 1;
  let count = 1;
  for (let i = value.indexOf('\n'); i !== -1; i = value.indexOf('\n', i + 1)) count++;
  return count;
}

export default function LatexCodeEditor({ value, onChange }) {
  const textareaRef = useRef(null);
  const lineNumbersRef = useRef(null);
  const [firstVisibleLine, setFirstVisibleLine] = useState(0);

  const lines = useMemo(() => countLines(value), [value]);

  const windowStart = Math.max(
    0,
    Math.min(firstVisibleLine - OVERSCAN_LINES, lines - MAX_RENDERED_LINES)
  );
  const windowEnd = Math.min(lines, windowStart + MAX_RENDERED_LINES);

  const handleChange = (e) => {
    onChange(e.target.value);
  };

  const handleScroll = (e) => {
    const { scrollTop } = e.target;
    setFirstVisibleLine(Math.floor(scrollTop / LINE_HEIGHT_PX));
    if (lineNumbersRef.current) {
      // Sync the line numbers scroll with textarea's scroll position
      lineNumbersRef.current.scrollTop = scrollTop;
    }
  };

  const handleKeyDown = (e) => {
    // Handle tab indent
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = e.target.selectionStart;
      const end = e.target.selectionEnd;

      // Simple insert 2 spaces
      const newValue = value.substring(0, start) + '  ' + value.substring(end);
      onChange(newValue);
      
      // Set cursor position after React re-renders
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 2;
        }
      });
    }
  };

  return (
    <div className={styles.editorContainer}>
      <div className={styles.lineNumbers} ref={lineNumbersRef}>
        {windowStart > 0 && (
          <div
            className={styles.lineNumberSpacer}
            style={{ height: windowStart * LINE_HEIGHT_PX }}
          />
        )}
        {Array.from({ length: windowEnd - windowStart }).map((_, i) => (
          <div key={windowStart + i} className={styles.lineNumber}>{windowStart + i + 1}</div>
        ))}
        {windowEnd < lines && (
          <div
            className={styles.lineNumberSpacer}
            style={{ height: (lines - windowEnd) * LINE_HEIGHT_PX }}
          />
        )}
      </div>
      <textarea
        ref={textareaRef}
        className={styles.textarea}
        value={value}
        onChange={handleChange}
        onScroll={handleScroll}
        onKeyDown={handleKeyDown}
        spellCheck={false}
        placeholder="Type raw LaTeX here..."
      />
    </div>
  );
}
