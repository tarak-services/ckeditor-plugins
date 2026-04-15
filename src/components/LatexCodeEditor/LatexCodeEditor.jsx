import React, { useRef, useMemo } from 'react';
import styles from './LatexCodeEditor.module.css';

export default function LatexCodeEditor({ value, onChange }) {
  const textareaRef = useRef(null);
  const lineNumbersRef = useRef(null);

  // Calculate lines based on newlines
  const lines = useMemo(() => {
    if (!value) return 1;
    return Math.max(1, value.split('\n').length);
  }, [value]);

  const handleChange = (e) => {
    onChange(e.target.value);
  };

  const handleScroll = (e) => {
    if (lineNumbersRef.current) {
      // Sync the line numbers scroll with textarea's scroll position
      lineNumbersRef.current.scrollTop = e.target.scrollTop;
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
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} className={styles.lineNumber}>{i + 1}</div>
        ))}
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
