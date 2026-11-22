import React, { useRef, useMemo, useState, useCallback, useLayoutEffect, useEffect } from 'react';
import styles from './LatexCodeEditor.module.css';

// Must match `.lineNumber` height and the textarea's line-height/padding in the CSS module.
const LINE_HEIGHT = 19.5;
const GUTTER_PADDING = 10;

// The gutter is virtualized: only the line numbers around the textarea's
// visible window are mounted, so a value with a huge number of lines cannot
// turn into a huge number of DOM nodes.
const OVERSCAN_LINES = 20;
const FALLBACK_VIEWPORT_HEIGHT = 600;
const MAX_RENDERED_LINES = 500;

function countLines(value) {
  if (!value) return 1;
  let count = 1;
  for (let i = value.indexOf('\n'); i !== -1; i = value.indexOf('\n', i + 1)) {
    count++;
  }
  return count;
}

export default function LatexCodeEditor({ value, onChange }) {
  const textareaRef = useRef(null);
  const lineNumbersRef = useRef(null);
  const [viewport, setViewport] = useState({ scrollTop: 0, height: 0 });

  const lines = useMemo(() => countLines(value), [value]);

  const syncViewport = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const { scrollTop, clientHeight } = textarea;
    setViewport((prev) =>
      prev.scrollTop === scrollTop && prev.height === clientHeight
        ? prev
        : { scrollTop, height: clientHeight }
    );
  }, []);

  useLayoutEffect(() => {
    syncViewport();
  }, [value, syncViewport]);

  useLayoutEffect(() => {
    if (lineNumbersRef.current && textareaRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  });

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => syncViewport());
    observer.observe(textarea);
    return () => observer.disconnect();
  }, [syncViewport]);

  const viewportHeight = viewport.height > 0 ? viewport.height : FALLBACK_VIEWPORT_HEIGHT;
  const visibleCount = Math.min(
    MAX_RENDERED_LINES,
    Math.ceil(viewportHeight / LINE_HEIGHT) + 2 * OVERSCAN_LINES
  );
  const firstVisible = Math.floor(Math.max(0, viewport.scrollTop - GUTTER_PADDING) / LINE_HEIGHT);
  const start = Math.max(0, Math.min(firstVisible - OVERSCAN_LINES, lines - visibleCount));
  const end = Math.min(lines, start + visibleCount);

  // Margins on the first and last mounted line stand in for the unmounted ones,
  // so the gutter keeps the textarea's scroll height without extra nodes.
  const lineNumbers = [];
  for (let i = start; i < end; i++) {
    const style = {};
    if (i === start && start > 0) style.marginTop = start * LINE_HEIGHT;
    if (i === end - 1 && end < lines) style.marginBottom = (lines - end) * LINE_HEIGHT;
    lineNumbers.push(
      <div key={i} className={styles.lineNumber} style={style}>{i + 1}</div>
    );
  }

  const handleChange = (e) => {
    onChange(e.target.value);
  };

  const handleScroll = (e) => {
    if (lineNumbersRef.current) {
      // Sync the line numbers scroll with textarea's scroll position
      lineNumbersRef.current.scrollTop = e.target.scrollTop;
    }
    syncViewport();
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
        {lineNumbers}
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
