// Default symbols as fallback when API hasn't loaded yet
const DEFAULT_MATH_SYMBOLS = [
  { label: 'α (alpha)', character: 'α' },
  { label: 'β (beta)', character: 'β' },
  { label: 'π (pi)', character: 'π' },
  { label: '± (plus-minus)', character: '±' },
  { label: '× (multiply)', character: '×' },
  { label: '÷ (divide)', character: '÷' },
  { label: '√ (square root)', character: '√' },
  { label: '∞ (infinity)', character: '∞' },
  { label: '≈ (approximately)', character: '≈' },
  { label: '≠ (not equal)', character: '≠' },
  { label: '≤ (less or equal)', character: '≤' },
  { label: '≥ (greater or equal)', character: '≥' },
];

// Global store for math symbols (loaded from API)
let globalMathSymbols = null;

/**
 * Set math symbols globally (called from MathSymbolsProvider)
 */
export function setGlobalMathSymbols(symbols) {
  globalMathSymbols = symbols;
}

/**
 * Get math symbols (from global store or fallback to defaults)
 */
export function getGlobalMathSymbols() {
  return globalMathSymbols || DEFAULT_MATH_SYMBOLS;
}

/**
 * Factory function to create MathSymbolsPlugin with CKEditor from CDN
 * @param {Object} CKEditor - CKEditor instance from CDN
 * @returns {Class} MathSymbolsPlugin class
 */
export default function createMathSymbolsPlugin(CKEditor) {
  const { Plugin } = CKEditor;
  const { createDropdown, addListToDropdown } = CKEditor;
  const { Collection } = CKEditor;

  class MathSymbolsPlugin extends Plugin {
  static get pluginName() {
    return 'MathSymbols';
  }

  init() {
    const editor = this.editor;

    // Get math symbols from global store or use defaults
    const mathSymbols = getGlobalMathSymbols().map(s => ({
      label: `${s.character} (${s.label})`,
      character: s.character
    }));

    // Add the math symbols dropdown to the toolbar
    editor.ui.componentFactory.add('mathSymbols', locale => {
      const dropdownView = createDropdown(locale);

      // Set dropdown button properties
      dropdownView.buttonView.set({
        label: 'Math Symbols',
        icon: this._getMathIcon(),
        tooltip: true,
        withText: false
      });

      // Create list items with character stored in model
      const items = new Collection();

      mathSymbols.forEach(symbol => {
        items.add({
          type: 'button',
          model: {
            label: symbol.label,
            character: symbol.character,
            withText: true
          }
        });
      });

      // Add list to dropdown
      addListToDropdown(dropdownView, items);

      // Listen to execute event on the dropdown to insert symbols
      dropdownView.on('execute', evt => {
        const { character } = evt.source;
        if (character) {
          editor.model.change(writer => {
            const selection = editor.model.document.selection;
            writer.insertText(character, selection.getFirstPosition());
          });
          editor.editing.view.focus();
        }
      });

      // Customize the search placeholder text after render
      dropdownView.on('change:isOpen', () => {
        if (dropdownView.isOpen && dropdownView.listView && dropdownView.listView.filterView) {
          const filterView = dropdownView.listView.filterView;
          if (filterView.element) {
            const input = filterView.element.querySelector('input');
            if (input) {
              input.placeholder = 'Search';
            }
          }
        }
      });

      return dropdownView;
    });
  }

  _getMathIcon() {
    // Math symbol icon (π - lowercase pi)
    return `<svg viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
      <path d="M 4 6 L 4 7.5 L 16 7.5 L 16 6 L 4 6 Z M 7 7.5 L 7 17 L 8.5 17 L 8.5 7.5 Z M 13 7.5 L 13 17 L 14.5 17 L 14.5 7.5 Z" fill="currentColor"/>
    </svg>`;
  }
  }

  return MathSymbolsPlugin;
}
