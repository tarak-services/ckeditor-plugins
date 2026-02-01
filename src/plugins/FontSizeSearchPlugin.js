import createSearchableDropdownPlugin from './SearchableDropdownPlugin';

/**
 * Factory function to create FontSizeSearchPlugin with CKEditor from CDN
 * @param {Object} CKEditor - CKEditor instance from CDN
 * @returns {Class} FontSizeSearchPlugin class
 */
export default function createFontSizeSearchPlugin(CKEditor) {
  const { FontSize } = CKEditor;
  const SearchableDropdownPlugin = createSearchableDropdownPlugin(CKEditor);

  /**
   * Custom Font Size plugin with search functionality
   * Extends the base SearchableDropdownPlugin with font-size specific logic
   */
  class FontSizeSearchPlugin extends SearchableDropdownPlugin {
  static get requires() {
    return [FontSize];
  }

  static get pluginName() {
    return 'FontSizeSearch';
  }

  constructor(editor) {
    super(editor, {
      dropdownType: 'fontSize',
      searchInputClass: 'ck-font-size-search-input',
      searchWrapperClass: 'ck-font-size-search-wrapper',
      panelClass: 'ck-font-size-with-search',
      panelAttribute: 'data-ck-font-size-search',
      placeholder: 'Search sizes...',

      // Font size specific: check if panel contains font size items
      isPanelOfType: (panel) => {
        const listView = panel.querySelector('.ck-list');
        if (!listView) return false;

        const items = listView.querySelectorAll('.ck-list__item');
        if (items.length === 0) return false;

        // Check first item - if it's "Default", this is likely a line-height dropdown
        const firstItemText = (items[0].textContent || '').trim();
        if (firstItemText.toLowerCase() === 'default') {
          return false;
        }

        // Check if items are font size values (should have 'pt' and be numeric)
        const sampleSize = Math.min(5, items.length);
        let isFontSizeCount = 0;

        for (let i = 0; i < sampleSize; i++) {
          const itemText = (items[i].textContent || '').trim();
          // Font size values end with 'pt' and start with numbers
          if (itemText.match(/^\d+(\.\d+)?pt$/)) {
            isFontSizeCount++;
          }
        }

        // If majority of sampled items are font sizes, it's a font size panel
        return isFontSizeCount >= Math.ceil(sampleSize * 0.6);
      },

      // Find the fontSize dropdown
      findDropdownView: (editor) => {
        try {
          const fontSizeComponent = editor.ui.componentFactory.create('fontSize');
          return fontSizeComponent?.on ? fontSizeComponent : fontSizeComponent?.dropdownView;
        } catch (e) {
          // Fallback: find fontSize dropdown in toolbar
          const toolbar = editor.ui?.view?.toolbar;
          if (toolbar?.items) {
            for (const item of toolbar.items) {
              if (item.constructor.name === 'DropdownView') {
                // Check if it's the fontSize dropdown by checking its button label
                if (item.buttonView?.label?.includes('Font') || item.buttonView?.label?.includes('Size')) {
                  return item;
                }
              }
            }
          }
        }
        return null;
      }
    });
  }

  afterInit() {
    const editor = this.editor;

    editor.on('uiReady', () => {
      this._setupSearch(editor);
    });

    setTimeout(() => this._setupSearch(editor), 500);
  }
  }

  return FontSizeSearchPlugin;
}
