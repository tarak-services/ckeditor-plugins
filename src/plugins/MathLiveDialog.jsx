import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Select from 'react-select';
import 'mathlive/fonts.css';
import 'mathlive';
import styles from './MathLivePlugin.module.css';
import mathEditorCss from '../styles/MathLiveEditor.css?inline'; // Import CSS as string
import LatexCodeEditor from '../components/LatexCodeEditor/LatexCodeEditor.jsx';
import { formatLatexForEditor } from '../utils/latexFormatter.js';
import { prepareMathLatexForRender, isKokilaFontFamily } from '../utils/fracReplace.js';
import { applyMatrixSpacing, hasMatrix } from '../utils/matrixSpacing.js';

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

const MathLiveDialog = ({
  isOpen,
  initialLatex,
  initialRenderFormat,
  onInsert,
  onClose,
  availableFonts,
  getAvailableFonts,
  mathFontFamily,
  mathFontSize
}) => {
  // Raisebox lift on numeric \cfrac denominators is a Kokila-baseline fix
  // only; for any other math font we keep the denominator unwrapped.
  const prepareOptions = useMemo(
    () => ({ useRaisebox: isKokilaFontFamily(mathFontFamily) }),
    [mathFontFamily]
  );

  // Normalize incoming LaTeX so the editor opens in the same shape it will render/persist as.
  // Only the very first creation can show the raw form (before user opens this dialog again).
  const preparedInitial = useMemo(
    () => (initialLatex ? prepareMathLatexForRender(initialLatex, prepareOptions) : ''),
    [initialLatex, prepareOptions]
  );
  const [latex, setLatex] = useState(preparedInitial);
  const [editorLatex, setEditorLatex] = useState(preparedInitial ? formatLatexForEditor(preparedInitial) : '');
  const [isMounted, setIsMounted] = useState(false);
  const [fontOptions, setFontOptions] = useState([]);
  const [renderFormat, setRenderFormat] = useState(initialRenderFormat || 'markup');
  const [matrixColSpacing, setMatrixColSpacing] = useState(0);
  const [matrixRowSpacing, setMatrixRowSpacing] = useState(0);
  const [raiseValue, setRaiseValue] = useState('0.2');
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
    //
    // NOTE: assigning to `element.registers` REPLACES the entire register set
    // on the mathfield (unlike `convertLatexToMarkup`, which merges). So any
    // defaults we still want — most notably `arraycolsep` for matrix column
    // spacing — must be re-supplied here, otherwise matrices render with zero
    // column gaps in the editor while looking fine in static renders.
    element.registers = {
      thinmuskip: '0mu',
      medmuskip: '0mu',
      thickmuskip: '0mu',
      nulldelimiterspace: '0mu',
      arraycolsep: { dimension: 5 },
      arrayrulewidth: { dimension: 0.4 },
      doublerulesep: { dimension: 2 }
    };

    // Match the math font-family + size the host editor (and PDF) renders
    // at. MathLive sizes the entire equation relative to the host's CSS
    // font-size, so a single inline style on the <math-field> scales the
    // whole render to the right pt value. The font-family stack is forwarded
    // verbatim (it can include the per-doc LatinDigits/UO override font
    // names whose @font-face rules sit in document.head).
    if (mathFontFamily) {
      element.style.fontFamily = mathFontFamily;
    }
    if (Number.isFinite(mathFontSize) && mathFontSize > 0) {
      element.style.fontSize = `${mathFontSize}pt`;
    }

    // Inject custom CSS into shadow DOM to override MathLive defaults
    const style = document.createElement('style');
    // Pick up --text-font-family from the nearest editor ancestor
    const editorEl = element.closest?.('[data-editor-id]') || document.querySelector('[data-editor-id]');
    const textFontFamily = editorEl ? getComputedStyle(editorEl).getPropertyValue('--text-font-family').trim() : '';
    const overrideCss = textFontFamily ? `:host { --text-font-family: ${textFontFamily}; }` : '';
    style.textContent = mathEditorCss + '\n' + overrideCss;
    element.shadowRoot.appendChild(style);

    element.value = preparedInitial;

    // Listen for changes
    const handleInput = () => {
      setLatex(element.value || '');
      setEditorLatex(formatLatexForEditor(element.value || ''));
    };

    element.addEventListener('input', handleInput);

    // Continuously remember the last non-collapsed selection. Clicking into the
    // "Raise" number input blurs the mathfield and collapses its live selection,
    // so we need this saved range to know what to wrap on Apply.
    const trackSelection = () => {
      const range = element.selection?.ranges?.[0];
      if (range && range[0] !== range[1]) {
        savedSelectionRef.current = element.selection;
      }
    };
    element.addEventListener('selection-change', trackSelection);
    element.addEventListener('keyup', trackSelection);
    element.addEventListener('pointerup', trackSelection);

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
  }, [preparedInitial, mathFontFamily, mathFontSize]);

  useEffect(() => {
    if (isOpen) {
      setLatex(preparedInitial);
      setEditorLatex(preparedInitial ? formatLatexForEditor(preparedInitial) : '');
      setRenderFormat(initialRenderFormat || 'markup');
      setMatrixColSpacing(0);
      setMatrixRowSpacing(0);
      setIsMounted(false);
    }

    return () => {
      // Cleanup handled by React
    };
  }, [isOpen, preparedInitial, initialRenderFormat]);

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
      // Persist the normalized form so re-opening shows the same final state.
      const finalLatex = prepareMathLatexForRender(latex, prepareOptions);
      onInsert(finalLatex, renderFormat);
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

  const applyRaisebox = useCallback((rawVal) => {
    const mf = mathfieldRef.current;
    if (!mf) return;
    // Accept a bare number ("0.2", "-0.5") or a value with a unit ("0.2em").
    const trimmed = String(rawVal ?? '').trim();
    if (!trimmed || trimmed === '-' || trimmed === '+') return;
    const val = /[a-z%]$/i.test(trimmed) ? trimmed : `${trimmed}ex`;

    // Prefer the live selection; if the user typed in the number input the
    // mathfield lost focus and collapsed its selection, so fall back to the
    // last non-collapsed selection we tracked.
    let sel = mf.selection;
    let range = sel?.ranges?.[0];
    if (!(range && range[0] !== range[1])) {
      sel = savedSelectionRef.current;
      range = sel?.ranges?.[0];
    }
    if (!(range && range[0] !== range[1])) {
      mf.focus();
      return;
    }

    mf.focus();
    mf.selection = sel;
    // `#@` wraps the current selection. We use the TeX primitive math-mode command
    // `\raise <val> {#@}` which keeps its argument in math mode natively, ensuring
    // subscripts, superscripts, and other math formatting (e.g. E_g) render perfectly
    // without the parser bugs of text-mode `\raisebox`!
    mf.insert(`\\raise ${val} {#@}`, { selectionMode: 'item' });
    setLatex(mf.value || '');
    savedSelectionRef.current = null;
  }, []);

  const matrixPresent = useMemo(() => hasMatrix(latex), [latex]);

  const handleUpdateRender = useCallback(() => {
    const mf = mathfieldRef.current;
    const current = mf?.value || latex;
    const prepared = prepareMathLatexForRender(current, prepareOptions);
    setLatex(prepared);
    setEditorLatex(formatLatexForEditor(prepared));
    if (mf) {
      mf.value = prepared;
      mf.focus();
    }
  }, [latex, prepareOptions]);

  const applyMatrixSpacingChange = useCallback((colPt, rowPt) => {
    const mf = mathfieldRef.current;
    const current = mf?.value || latex;
    const next = applyMatrixSpacing(current, colPt, rowPt);
    setLatex(next);
    setEditorLatex(formatLatexForEditor(next));
    if (mf) {
      mf.value = next;
      mf.focus();
    }
  }, [latex]);

  const parseSpacingInput = (raw) => {
    if (raw === '' || raw === '-' || raw === '+') return 0;
    const n = parseFloat(raw);
    return Number.isFinite(n) ? n : 0;
  };

  const handleMatrixColChange = useCallback((e) => {
    const v = parseSpacingInput(e.target.value);
    setMatrixColSpacing(v);
    applyMatrixSpacingChange(v, matrixRowSpacing);
  }, [applyMatrixSpacingChange, matrixRowSpacing]);

  const handleMatrixRowChange = useCallback((e) => {
    const v = parseSpacingInput(e.target.value);
    setMatrixRowSpacing(v);
    applyMatrixSpacingChange(matrixColSpacing, v);
  }, [applyMatrixSpacingChange, matrixColSpacing]);

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
              <span className={styles.toolbarLabel}>Raise:</span>
              <input
                type="number"
                step="0.1"
                value={raiseValue}
                onChange={(e) => setRaiseValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    applyRaisebox(raiseValue);
                  }
                }}
                className={styles.raiseInput}
                title="Vertical shift in ex (positive = up, negative = down)"
              />
              <span className={styles.raiseUnit}>ex</span>
              <button
                className={styles.applyButton}
                onMouseDown={(e) => { e.preventDefault(); applyRaisebox(raiseValue); }}
                title="Raise/lower the selected text by this amount"
              >
                Apply
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
            {matrixPresent && (
              <>
                <div className={styles.toolbarGroup}>
                  <span className={styles.toolbarLabel}>Cols:</span>
                  <input
                    type="number"
                    step="1"
                    value={matrixColSpacing}
                    onChange={handleMatrixColChange}
                    className={styles.spacingInput}
                    title="Extra horizontal space between matrix columns, in pt (negative allowed)"
                  />
                  <span className={styles.spacingUnit}>pt</span>
                </div>
                <div className={styles.toolbarGroup}>
                  <span className={styles.toolbarLabel}>Rows:</span>
                  <input
                    type="number"
                    step="1"
                    value={matrixRowSpacing}
                    onChange={handleMatrixRowChange}
                    className={styles.spacingInput}
                    title="Extra vertical space between matrix rows, in pt (negative allowed)"
                  />
                  <span className={styles.spacingUnit}>pt</span>
                </div>
              </>
            )}
            <div className={styles.toolbarGroup}>
              <button
                className={styles.updateRenderButton}
                onClick={handleUpdateRender}
                title="Apply render transforms (\frac → \cfrac, \int → \intop)"
              >
                Update Render
              </button>
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
