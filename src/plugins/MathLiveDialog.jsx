import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import 'mathlive/fonts.css';
import 'mathlive';
import styles from './MathLivePlugin.module.css';
import mathEditorCss from '../styles/MathLiveEditor.css?inline'; // Import CSS as string

// Suppress ResizeObserver errors (harmless warnings from MathLive keyboard)
if (typeof window !== 'undefined') {
  // Simple error suppression - don't modify ResizeObserver behavior
  window.addEventListener('error', (e) => {
    if (e.message && e.message.includes('ResizeObserver')) {
      e.stopImmediatePropagation();
      e.preventDefault();
    }
  }, true);
}

const MathLiveDialog = ({ isOpen, initialLatex, onInsert, onClose }) => {
  const [latex, setLatex] = useState(initialLatex || '');
  const [isMounted, setIsMounted] = useState(false);
  const mathfieldRef = useRef(null);

  // Callback ref to set up the mathfield when it mounts
  const setupMathfield = useCallback((element) => {
    if (!element) return;

    mathfieldRef.current = element;

    // Configure the mathfield options
    element.mathModeSpace = '\\,'; // Allow thin space with spacebar
    element.smartFence = true;
    element.smartSuperscript = true;
    element.letterShapeStyle = 'upright'; // Use normal font instead of italics

    // Inject custom CSS into shadow DOM to override MathLive defaults
    const style = document.createElement('style');
    style.textContent = mathEditorCss;
    element.shadowRoot.appendChild(style);

    // Set initial value
    element.value = initialLatex || '';

    // Listen for changes
    const handleInput = () => {
      setLatex(element.value || '');
    };

    element.addEventListener('input', handleInput);

    // Mark as mounted
    setIsMounted(true);

    // Focus with delay
    setTimeout(() => {
      if (element) {
        element.focus();
        // Show virtual keyboard
        if (window.mathVirtualKeyboard) {
          window.mathVirtualKeyboard.show();
        }
      }
    }, 100);

    // Note: cleanup is handled by React when component unmounts
  }, [initialLatex]);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (isOpen) {
      setLatex(initialLatex || '');
      setIsMounted(false);
    }

    return () => {
      // Cleanup handled by React
    };
  }, [isOpen, initialLatex]);

  // Handle Escape key to close dialog
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const handleInsert = () => {
    onInsert(latex);
    handleClose();
  };

  const handleClose = () => {
    if (window.mathVirtualKeyboard) {
      window.mathVirtualKeyboard.hide();
    }
    onClose();
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className={styles.overlay} onClick={handleOverlayClick}>
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <h3 className={styles.headerTitle}>Equation Editor</h3>
          <button className={styles.closeButton} onClick={handleClose}>
            &times;
          </button>
        </div>

        {/* Content */}
        <div className={styles.content}>
          <div className={styles.mathfieldContainer} id="mathfield-container">
            {/* Render math-field directly as JSX */}
            <math-field
              ref={setupMathfield}
              style={{
                fontSize: '24px',
                minHeight: '60px',
                padding: '10px',
                width: '100%',
                display: 'block',
                border: 'none',
                outline: 'none',
                background: 'transparent',
                color: '#000',
                position: 'relative'
              }}
              virtual-keyboard-mode="onfocus"
            />
          </div>

          {/* Help Section */}
          <div className={styles.helpSection}>
            <strong className={styles.helpTitle}>⌨️ Quick Reference:</strong>
            <div className={styles.helpGrid}>
              <div>
                <code>/</code> Fraction • <code>^</code> Power • <code>_</code> Subscript
              </div>
              <div>
                <code>\sqrt</code> √ • <code>\int</code> ∫ • <code>\sum</code> Σ
              </div>
              <div>
                <code>\pi</code> π • <code>\alpha</code> α • <code>\infty</code> ∞
              </div>
            </div>
            <div className={styles.helpProTips}>
              <kbd>ESC</kbd> raw LaTeX • <kbd>Tab</kbd> next placeholder • Use virtual keyboard below for more symbols
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <code className={styles.latexOutput}>
            {latex || '(empty)'}
          </code>
          <div className={styles.buttonGroup}>
            <button className={styles.cancelButton} onClick={handleClose}>
              Cancel
            </button>
            <button className={styles.insertButton} onClick={handleInsert}>
              Insert Equation
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default MathLiveDialog;
