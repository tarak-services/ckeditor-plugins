import React, { useState, useEffect, useRef, useCallback } from 'react';
import Select from 'react-select';
import 'mathlive/fonts.css';
import 'mathlive';
import styles from './MathLivePlugin.module.css';
import mathEditorCss from '../styles/MathLiveEditor.css?inline'; // Import CSS as string
import LatexCodeEditor from '../components/LatexCodeEditor/LatexCodeEditor.jsx';
import { formatLatexForEditor } from '../utils/latexFormatter.js';

// Suppress ResizeObserver errors (harmless warnings from MathLive keyboard)
if (typeof window !== 'undefined') {
  window.addEventListener('error', (e) => {
    if (e.message && e.message.includes('ResizeObserver')) {
      e.stopImmediatePropagation();
      e.preventDefault();
    }
  }, true);
}

const FONT_SIZES = [];
for (let i = 8; i <= 35; i += 0.5) {
  FONT_SIZES.push(`${i % 1 === 0 ? i : i.toFixed(1)}pt`);
}
const SIZE_OPTIONS = FONT_SIZES.map(s => ({ value: s, label: s }));

const DEFAULT_FONTS = [
  'Kokila', 'Mangal', 'Noto Sans Devanagari',
  'Arial', 'Times New Roman', 'Courier New'
];

const selectStyles = {
  control: (base) => ({ ...base, minHeight: 28, height: 28, fontSize: 12, minWidth: 100 }),
  valueContainer: (base) => ({ ...base, padding: '0 6px' }),
  input: (base) => ({ ...base, margin: 0, padding: 0 }),
  indicatorsContainer: (base) => ({ ...base, height: 28 }),
  option: (base) => ({ ...base, fontSize: 12, padding: '4px 8px' }),
  menuPortal: (base) => ({ ...base, zIndex: 10002 }),
  menu: (base) => ({ ...base, width: 'max-content', minWidth: '100%' }),
};

const RENDER_FORMAT_OPTIONS = [
  { value: 'markup', label: 'Markup' },
  { value: 'mathml', label: 'MathML' },
];

// Operator commands render upright regardless of \mathit/\mathbf wrapping.
// Decompose them to plain letters so font style commands actually take effect.
const OPERATOR_RE = /\\(?:ln|log|sin|cos|tan|cot|sec|csc|arcsin|arccos|arctan|exp|lim|min|max|inf|sup|det|dim|gcd|hom|ker|lg|deg|arg|sinh|cosh|tanh|coth)(?![a-zA-Z])/g;
const decomposeOperators = (latex) =>
  latex.replace(OPERATOR_RE, (m) => m.slice(1));

const MathLiveDialog = ({ isOpen, initialLatex, initialRenderFormat, onInsert, onClose, availableFonts, getAvailableFonts }) => {
  const [latex, setLatex] = useState(initialLatex || '');
  const [editorLatex, setEditorLatex] = useState(initialLatex ? formatLatexForEditor(initialLatex) : '');
  const [isMounted, setIsMounted] = useState(false);
  const [fontOptions, setFontOptions] = useState([]);
  const [renderFormat, setRenderFormat] = useState(initialRenderFormat || 'markup');
  const mathfieldRef = useRef(null);
  const savedSelectionRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    if (getAvailableFonts) {
      getAvailableFonts().then(fonts => {
        const names = fonts.map(f => f.name || f).filter(Boolean);
        setFontOptions(names.map(n => ({ value: n, label: n })));
      }).catch(() => {
        const fallback = availableFonts && availableFonts.length > 0 ? availableFonts : DEFAULT_FONTS;
        setFontOptions(fallback.map(n => ({ value: n, label: n })));
      });
    } else {
      const fallback = availableFonts && availableFonts.length > 0 ? availableFonts : DEFAULT_FONTS;
      setFontOptions(fallback.map(n => ({ value: n, label: n })));
    }
  }, [isOpen, getAvailableFonts, availableFonts]);

  // Callback ref to set up the mathfield when it mounts
  const setupMathfield = useCallback((element) => {
    if (!element) return;

    mathfieldRef.current = element;

    // Configure the mathfield options
    element.mathModeSpace = '\\,'; // Allow thin space with spacebar
    element.smartFence = true;
    element.smartSuperscript = true;
    element.letterShapeStyle = 'upright'; // Use normal font instead of italics

    // Set tighter spacing for compact math display
    // - medmuskip: space around binary operators (default 4mu) - affects \cdot, +, -, etc.
    // - thinmuskip: thin space amount (default 3mu) - affects \, spacing in mixed fractions
    element.registers = {
      thinmuskip: '0mu',
      medmuskip: '0mu',
      thickmuskip: '0mu',
      nulldelimiterspace: '0mu'
    };

    // Inject custom CSS into shadow DOM to override MathLive defaults
    const style = document.createElement('style');
    // Pick up --text-font-family from the nearest editor ancestor
    const editorEl = element.closest?.('[data-editor-id]') || document.querySelector('[data-editor-id]');
    const textFontFamily = editorEl ? getComputedStyle(editorEl).getPropertyValue('--text-font-family').trim() : '';
    const overrideCss = textFontFamily ? `:host { --text-font-family: ${textFontFamily}; }` : '';
    style.textContent = mathEditorCss + '\n' + overrideCss;
    element.shadowRoot.appendChild(style);

    // Set initial value
    element.value = initialLatex || '';

    // Listen for changes
    const handleInput = () => {
      setLatex(element.value || '');
      setEditorLatex(formatLatexForEditor(element.value || ''));
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
      setEditorLatex(initialLatex ? formatLatexForEditor(initialLatex) : '');
      setRenderFormat(initialRenderFormat || 'markup');
      setIsMounted(false);
    }

    return () => {
      // Cleanup handled by React
    };
  }, [isOpen, initialLatex]);

  const handleCodeChange = (newLatex) => {
    setEditorLatex(newLatex);
    setLatex(newLatex);
    if (mathfieldRef.current) {
      // Programmatically updating value doesn't trigger 'input' event,
      // so this avoids a loop.
      mathfieldRef.current.value = newLatex;
    }
  };


  const handleInsert = () => {
    try {
      onInsert(latex, renderFormat);
    } catch (e) {
      console.error('Error inserting equation:', e);
    }
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

  const saveSelection = () => {
    if (mathfieldRef.current) {
      savedSelectionRef.current = mathfieldRef.current.selection;
    }
  };

  const applyFontSize = useCallback((option) => {
    const mf = mathfieldRef.current;
    if (!mf || !option) return;
    if (savedSelectionRef.current) {
      mf.selection = savedSelectionRef.current;
    }
    mf.insert(`\\htmlStyle{font-size: ${option.value}}{#@}`);
    setLatex(mf.value || '');
    mf.focus();
  }, []);

  const applyFontFamily = useCallback((option) => {
    const mf = mathfieldRef.current;
    if (!mf || !option) return;
    if (savedSelectionRef.current) {
      mf.selection = savedSelectionRef.current;
    }
    mf.insert(`\\htmlStyle{--text-font-family: ${option.value}}{#@}`);
    setLatex(mf.value || '');
    mf.focus();
  }, []);

  const insertStyled = useCallback((command) => {
    const mf = mathfieldRef.current;
    if (!mf) return;
    if (savedSelectionRef.current) {
      mf.selection = savedSelectionRef.current;
    }
    try {
      const selectedLatex = mf.getValue(mf.selection, 'latex');
      if (selectedLatex) {
        mf.insert(`${command}{${decomposeOperators(selectedLatex)}}`);
        setLatex(mf.value || '');
        mf.focus();
        return;
      }
    } catch (_) { /* fall through */ }
    mf.insert(`${command}{#@}`);
    setLatex(mf.value || '');
    mf.focus();
  }, []);

  const applyBold = useCallback(() => insertStyled('\\mathbf'), [insertStyled]);
  const applyItalic = useCallback(() => insertStyled('\\mathit'), [insertStyled]);
  const applyBoldItalic = useCallback(() => insertStyled('\\mathbfit'), [insertStyled]);

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} data-mathlive-overlay="true" onClick={handleOverlayClick}>
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
          {/* Font Size & Font Family Toolbar */}
          <div className={styles.toolbar} onMouseDown={saveSelection}>
            <div className={styles.toolbarGroup}>
              <span className={styles.toolbarLabel}>Size:</span>
              <div style={{ minWidth: 100 }}>
                <Select
                  options={SIZE_OPTIONS}
                  value={null}
                  onChange={applyFontSize}
                  onMenuOpen={saveSelection}
                  placeholder="Size"
                  isSearchable
                  menuPortalTarget={document.body}
                  menuPosition="fixed"
                  styles={selectStyles}
                />
              </div>
            </div>
            <div className={styles.toolbarGroup}>
              <span className={styles.toolbarLabel}>Font:</span>
              <div style={{ minWidth: 160 }}>
                <Select
                  options={fontOptions}
                  value={null}
                  onChange={applyFontFamily}
                  onMenuOpen={saveSelection}
                  placeholder="Font"
                  isSearchable
                  menuPortalTarget={document.body}
                  menuPosition="fixed"
                  styles={selectStyles}
                />
              </div>
            </div>
            <div className={styles.toolbarGroup}>
              <button
                className={styles.toolbarButton}
                onMouseDown={(e) => { e.preventDefault(); saveSelection(); }}
                onClick={applyBold}
                title="Bold"
              >
                <strong>B</strong>
              </button>
              <button
                className={styles.toolbarButton}
                onMouseDown={(e) => { e.preventDefault(); saveSelection(); }}
                onClick={applyItalic}
                title="Italic"
              >
                <em>I</em>
              </button>
              <button
                className={styles.toolbarButton}
                onMouseDown={(e) => { e.preventDefault(); saveSelection(); }}
                onClick={applyBoldItalic}
                title="Bold Italic"
              >
                <strong><em>BI</em></strong>
              </button>
            </div>
            <div className={styles.toolbarGroup}>
              <span className={styles.toolbarLabel}>Output:</span>
              <div style={{ minWidth: 110 }}>
                <Select
                  options={RENDER_FORMAT_OPTIONS}
                  value={RENDER_FORMAT_OPTIONS.find(o => o.value === renderFormat)}
                  onChange={(option) => option && setRenderFormat(option.value)}
                  isSearchable={false}
                  menuPortalTarget={document.body}
                  menuPosition="fixed"
                  styles={selectStyles}
                />
              </div>
            </div>
          </div>

          <div className={styles.editorsRow}>
            <div className={styles.mathfieldContainer} id="mathfield-container">
              {/* Render math-field directly as JSX */}
              <math-field
                ref={setupMathfield}
                style={{
                  fontSize: '24px',
                  minHeight: '60px',
                  padding: '10px',
                  width: '100%',
                  flex: '1',
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  color: '#000',
                  position: 'relative'
                }}
                virtual-keyboard-mode="onfocus"
              />
            </div>
            <div className={styles.latexEditorContainer}>
              <LatexCodeEditor value={editorLatex} onChange={handleCodeChange} />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={styles.footer}>
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
    </div>
  );
};

export default MathLiveDialog;
