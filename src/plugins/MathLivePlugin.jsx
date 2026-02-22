import React from 'react';
import { createRoot } from 'react-dom/client';
import 'mathlive/static.css';  // Required for convertLatexToMarkup rendered output
import MathLiveDialog from './MathLiveDialog.jsx';
import MathLiveErrorBoundary from './MathLiveErrorBoundary.jsx';

// We'll import MathLive functions dynamically to avoid interfering with initialization
let convertLatexToMarkup = null;
let convertLatexToMathMl = null;
import('mathlive').then(ml => {
  convertLatexToMarkup = ml.convertLatexToMarkup;
  convertLatexToMathMl = ml.convertLatexToMathMl;
});

// NOTE: ResizeObserver warnings from MathLive are harmless and expected
// They occur when the browser can't deliver all resize notifications in one frame
// This is a known issue with complex UI libraries and doesn't affect functionality
// The warnings are already suppressed in index.js

/**
 * Factory function to create MathLivePlugin with CKEditor from CDN
 * This plugin integrates MathLive (LaTeX editor) with CKEditor5
 * Uses React components for the dialog UI
 * @param {Object} CKEditor - CKEditor instance from CDN
 * @returns {Class} MathLivePlugin class
 */
export default function createMathLivePlugin(CKEditor, options = {}) {
  const { Plugin, ButtonView, Widget, toWidget } = CKEditor;
  const { availableFonts, getAvailableFonts, mathRenderFormat = 'markup' } = options;

  class MathLivePlugin extends Plugin {
    static get pluginName() {
      return 'MathLive';
    }

    static get requires() {
      return [Widget];
    }

    init() {
      const editor = this.editor;

      // Define schema for math formulas
      this._defineSchema();

      // Define converters
      this._defineConverters();

      // Add MathLive button to toolbar
      editor.ui.componentFactory.add('MathLive', locale => {
        const view = new ButtonView(locale);

        view.set({
          label: 'Insert Math Equation',
          icon: this._getMathIcon(),
          tooltip: true
        });

        view.on('execute', () => {
          this._openMathEditor(editor);
        });

        return view;
      });

      // Add double-click handler to edit existing equations
      this.listenTo(editor.editing.view.document, 'dblclick', (evt, data) => {
        const modelElement = this._getSelectedMathElement();

        if (modelElement) {
          evt.stop();
          data.preventDefault();

          const latex = modelElement.getAttribute('latex') || '';
          this._showMathEditorDialog(editor, latex, modelElement);
        }
      });

      // Also handle click on selected widget
      this.listenTo(editor.editing.view.document, 'click', (evt, data) => {
        const viewElement = data.target;

        // Check if clicked on math formula widget
        if (viewElement && viewElement.hasClass && viewElement.hasClass('math-formula-widget')) {
          // Select the widget in the model
          const mapper = editor.editing.mapper;
          const modelElement = mapper.toModelElement(viewElement);

          if (modelElement) {
            editor.model.change(writer => {
              writer.setSelection(modelElement, 'on');
            });
          }
        }
      });
    }

    _getSelectedMathElement() {
      const selection = this.editor.model.document.selection;
      const selectedElement = selection.getSelectedElement();

      if (selectedElement && selectedElement.name === 'mathFormula') {
        return selectedElement;
      }

      return null;
    }

    _defineSchema() {
      const schema = this.editor.model.schema;

      schema.register('mathFormula', {
        allowWhere: '$text',
        isInline: true,
        isObject: true,
        allowAttributes: ['latex', 'display', 'renderFormat']
      });
    }

    _defineConverters() {
      const conversion = this.editor.conversion;

      // Upcast converter - Convert HTML to model
      // Support multiple input formats
      conversion.for('upcast').elementToElement({
        view: {
          name: 'span',
          classes: 'math-tex'
        },
        model: (viewElement, { writer }) => {
          let latex = viewElement.getAttribute('data-latex') || '';
          if (!latex) {
            latex = viewElement.getChild(0)?.data || '';
          }
          const format = viewElement.getAttribute('data-render-format') || mathRenderFormat;
          return writer.createElement('mathFormula', {
            latex,
            display: 'inline',
            renderFormat: format
          });
        }
      });

      conversion.for('upcast').elementToElement({
        view: {
          name: 'span',
          classes: 'math-formula-widget'
        },
        model: (viewElement, { writer }) => {
          const latex = viewElement.getAttribute('data-latex') || '';
          const format = viewElement.getAttribute('data-render-format') || mathRenderFormat;
          return writer.createElement('mathFormula', {
            latex,
            display: 'inline',
            renderFormat: format
          });
        }
      });

      // Also support script[type="math/tex"]
      conversion.for('upcast').elementToElement({
        view: {
          name: 'script',
          attributes: {
            type: 'math/tex'
          }
        },
        model: (viewElement, { writer }) => {
          const latex = viewElement.getChild(0)?.data || '';
          return writer.createElement('mathFormula', {
            latex: latex,
            display: 'inline'
          });
        }
      });

      conversion.for('editingDowncast').elementToElement({
        model: 'mathFormula',
        view: (modelElement, { writer }) => {
          const latex = modelElement.getAttribute('latex') || '';
          const format = modelElement.getAttribute('renderFormat') || mathRenderFormat;

          const span = writer.createContainerElement('span', {
            class: 'math-formula-widget',
            'data-latex': latex,
            'data-render-format': format
          });

          const mathSpan = writer.createRawElement('span', {
            class: 'math-formula-render',
            style: 'display: inline-block; vertical-align: baseline;'
          }, (domElement) => {
            this._renderMath(domElement, latex, format);
          });

          writer.insert(writer.createPositionAt(span, 0), mathSpan);

          return toWidget(span, writer, { label: 'math formula widget' });
        }
      });

      conversion.for('dataDowncast').elementToElement({
        model: 'mathFormula',
        view: (modelElement, { writer }) => {
          const latex = modelElement.getAttribute('latex') || '';
          const format = modelElement.getAttribute('renderFormat') || mathRenderFormat;

          const span = writer.createContainerElement('span', {
            class: 'math-tex',
            'data-latex': latex,
            'data-render-format': format
          });

          const renderedContent = writer.createRawElement('span', {
            class: 'math-formula-render'
          }, (domElement) => {
            this._renderMath(domElement, latex, format);
          });

          writer.insert(writer.createPositionAt(span, 0), renderedContent);

          return span;
        }
      });
    }

    _openMathEditor(editor) {
      const selection = editor.model.document.selection;
      const selectedElement = selection.getSelectedElement();

      // Get existing LaTeX if editing
      let currentLatex = '';
      if (selectedElement && selectedElement.name === 'mathFormula') {
        currentLatex = selectedElement.getAttribute('latex') || '';
      }

      this._showMathEditorDialog(editor, currentLatex, selectedElement);
    }

    _showMathEditorDialog(editor, currentLatex, selectedElement) {
      // Create a container for the React component
      const container = document.createElement('div');
      document.body.appendChild(container);
      const root = createRoot(container);

      let isCleanedUp = false;

      const cleanup = () => {
        if (isCleanedUp) return;
        isCleanedUp = true;
        if (container.parentNode) {
          container.parentNode.removeChild(container);
        }
        document.querySelectorAll('[data-mathlive-overlay]').forEach(el => el.remove());
        setTimeout(() => {
          try { root.unmount(); } catch(e) {}
        }, 0);
      };

      const handleInsert = (latex, format) => {
        if (latex !== null && latex !== undefined) {
          this._insertMath(editor, latex, selectedElement, format);
        }
      };

      const handleClose = () => {
        cleanup();
      };

      const existingFormat = selectedElement?.getAttribute('renderFormat') || mathRenderFormat;

      root.render(
        <MathLiveErrorBoundary>
          <MathLiveDialog
            isOpen={true}
            initialLatex={currentLatex}
            initialRenderFormat={existingFormat}
            onInsert={handleInsert}
            onClose={handleClose}
            availableFonts={availableFonts}
            getAvailableFonts={getAvailableFonts}
          />
        </MathLiveErrorBoundary>
      );
    }

    _insertMath(editor, latex, existingElement, format) {
      const renderFmt = format || mathRenderFormat;
      editor.model.change(writer => {
        const attrs = { latex, display: 'inline', renderFormat: renderFmt };

        if (existingElement) {
          const position = writer.createPositionBefore(existingElement);
          writer.remove(existingElement);
          const mathElement = writer.createElement('mathFormula', attrs);
          writer.insert(mathElement, position);
          writer.setSelection(mathElement, 'on');
        } else {
          const mathElement = writer.createElement('mathFormula', attrs);
          editor.model.insertContent(mathElement);
        }
      });
    }

    _renderMath(element, latex, format) {
      if (!latex) {
        element.textContent = '(empty formula)';
        element.style.color = '#999';
        return;
      }

      const latexToRender = this._replaceFracWithTightCfrac(latex);
      const useFormat = format || mathRenderFormat;
      const renderOptions = {
        letterShapeStyle: 'upright',
        defaultMode: 'inline-math',
        registers: {
          thinmuskip: { dimension: 0, unit: 'mu' },
          medmuskip: { dimension: 0, unit: 'mu' },
          thickmuskip: { dimension: 0, unit: 'mu' },
          nulldelimiterspace: { dimension: 0, unit: 'mu' }
        }
      };

      if (useFormat === 'mathml' && convertLatexToMathMl) {
        try {
          const cleaned = this._stripHtmlStyle(latexToRender);
          const ml = convertLatexToMathMl(cleaned, renderOptions);
          const wrapped = ml.trimStart().startsWith('<math') ? ml : `<math>${ml}</math>`;
          element.innerHTML = wrapped;
        } catch (e) {
          this._renderFallback(element, latex);
        }
      } else if (convertLatexToMarkup) {
        try {
          element.innerHTML = convertLatexToMarkup(latexToRender, renderOptions);
        } catch (e) {
          this._renderFallback(element, latex);
        }
      } else {
        this._renderFallback(element, latex);
      }
    }

    /**
     * Process fractions for compact (textstyle) rendering:
     * Convert \frac to \tfrac for consistent compact fraction display
     */
    _replaceFracWithTfrac(latex) {
      let result = latex;
      let changed = true;

      // Keep processing until no more \frac remain
      while (changed) {
        changed = false;
        let pos = 0;

        while (pos < result.length) {
          const fracIndex = result.indexOf('\\frac', pos);
          if (fracIndex === -1) break;

          // Skip \cfrac, \dfrac, and \tfrac
          if (fracIndex > 0 && (result[fracIndex - 1] === 'c' || result[fracIndex - 1] === 'd' || result[fracIndex - 1] === 't')) {
            pos = fracIndex + 5;
            continue;
          }

          // Parse arguments
          const parsed = this._parseFracArgs(result, fracIndex + 5);
          if (!parsed) {
            pos = fracIndex + 5;
            continue;
          }

          const { firstArg, secondArg, endPos } = parsed;

          // Convert to \tfrac for compact text-style fraction
          const replacement = `\\tfrac{${firstArg}}{${secondArg}}`;

          result = result.substring(0, fracIndex) + replacement + result.substring(endPos);
          changed = true;
          break; // Restart from beginning to catch nested fracs
        }
      }

      return result;
    }

    /**
     * Process fractions for display style rendering:
     * 1. Simple numeric fractions (only digits) → \cfrac with \raisebox for tighter spacing
     * 2. All other fractions → just \frac to \cfrac (no raisebox)
     */
    _replaceFracWithTightCfrac(latex) {
      let result = latex;
      let changed = true;

      // Keep processing until no more \frac remain
      while (changed) {
        changed = false;
        let pos = 0;

        while (pos < result.length) {
          const fracIndex = result.indexOf('\\frac', pos);
          if (fracIndex === -1) break;

          // Skip \cfrac and \dfrac
          if (fracIndex > 0 && (result[fracIndex - 1] === 'c' || result[fracIndex - 1] === 'd')) {
            pos = fracIndex + 5;
            continue;
          }

          // Parse arguments
          const parsed = this._parseFracArgs(result, fracIndex + 5);
          if (!parsed) {
            pos = fracIndex + 5;
            continue;
          }

          const { firstArg, secondArg, endPos } = parsed;

          // Check if both args are purely numeric (only digits)
          const isNumeric = /^\d+$/.test(firstArg) && /^\d+$/.test(secondArg);

          let replacement;
          if (isNumeric) {
            // Simple numeric fraction → use raisebox for tighter spacing
            replacement = `\\cfrac{${firstArg}}{\\raisebox{0.5ex}{${secondArg}}}`;
          } else {
            // Complex fraction → just convert to cfrac
            replacement = `\\cfrac{${firstArg}}{${secondArg}}`;
          }

          result = result.substring(0, fracIndex) + replacement + result.substring(endPos);
          changed = true;
          break; // Restart from beginning to catch nested fracs
        }
      }

      return result;
    }

    /**
     * Parse the two arguments of \frac starting at position pos.
     * Handles both {braced} and single-char arguments.
     */
    _parseFracArgs(str, pos) {
      // Skip whitespace
      while (pos < str.length && str[pos] === ' ') pos++;
      if (pos >= str.length) return null;

      // First argument
      let firstArg, firstEnd;
      if (str[pos] === '{') {
        const braceEnd = this._findMatchingBrace(str, pos);
        if (braceEnd === -1) return null;
        firstArg = str.substring(pos + 1, braceEnd);
        firstEnd = braceEnd + 1;
      } else {
        firstArg = str[pos];
        firstEnd = pos + 1;
      }

      // Skip whitespace
      pos = firstEnd;
      while (pos < str.length && str[pos] === ' ') pos++;
      if (pos >= str.length) return null;

      // Second argument
      let secondArg, secondEnd;
      if (str[pos] === '{') {
        const braceEnd = this._findMatchingBrace(str, pos);
        if (braceEnd === -1) return null;
        secondArg = str.substring(pos + 1, braceEnd);
        secondEnd = braceEnd + 1;
      } else {
        secondArg = str[pos];
        secondEnd = pos + 1;
      }

      return { firstArg, secondArg, endPos: secondEnd };
    }

    /**
     * Find matching closing brace for opening brace at startIndex.
     */
    _findMatchingBrace(str, startIndex) {
      if (str[startIndex] !== '{') return -1;
      let depth = 1;
      for (let i = startIndex + 1; i < str.length; i++) {
        if (str[i] === '{') depth++;
        else if (str[i] === '}') {
          depth--;
          if (depth === 0) return i;
        }
      }
      return -1;
    }

    /**
     * Strip \htmlStyle{...}{content} → content
     * MathML has no equivalent of \htmlStyle, so we unwrap to keep the content.
     */
    _stripHtmlStyle(latex) {
      let result = latex;
      let changed = true;
      while (changed) {
        changed = false;
        const idx = result.indexOf('\\htmlStyle');
        if (idx === -1) break;

        let pos = idx + '\\htmlStyle'.length;
        while (pos < result.length && result[pos] === ' ') pos++;
        if (pos >= result.length || result[pos] !== '{') continue;

        const styleEnd = this._findMatchingBrace(result, pos);
        if (styleEnd === -1) break;

        let contentStart = styleEnd + 1;
        while (contentStart < result.length && result[contentStart] === ' ') contentStart++;
        if (contentStart >= result.length || result[contentStart] !== '{') break;

        const contentEnd = this._findMatchingBrace(result, contentStart);
        if (contentEnd === -1) break;

        const innerContent = result.substring(contentStart + 1, contentEnd);
        result = result.substring(0, idx) + innerContent + result.substring(contentEnd + 1);
        changed = true;
      }
      return result;
    }

    _renderFallback(element, latex) {
      element.textContent = latex;
      element.style.fontFamily = 'monospace';
      element.style.background = '#f5f5f5';
      element.style.padding = '2px 6px';
      element.style.borderRadius = '3px';
      element.style.fontSize = '14px';
    }

    _getMathIcon() {
      return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="20" height="20"><path d="M12 2v2h3.59l-4.3 4.3 1.42 1.4L17 5.41V9h2V2h-7zm-2 7.5L8.5 8 5 11.5 8.5 15 10 13.5 7.5 11l2.5-2.5zM5 2H2v2h3V2zm0 4H2v2h3V6zm0 4H2v2h3v-2zm0 4H2v2h3v-2zm0 4H2v2h3v-2z"/></svg>';
    }
  }

  return MathLivePlugin;
}
