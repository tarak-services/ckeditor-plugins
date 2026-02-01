import createSearchableDropdownPlugin from './SearchableDropdownPlugin';

/**
 * Factory function to create FontFamilySearchPlugin with CKEditor from CDN
 * @param {Object} CKEditor - CKEditor instance from CDN
 * @returns {Class} FontFamilySearchPlugin class
 */
export default function createFontFamilySearchPlugin(CKEditor) {
  const { FontFamily } = CKEditor;
  const SearchableDropdownPlugin = createSearchableDropdownPlugin(CKEditor);

  class FontFamilySearchPlugin extends SearchableDropdownPlugin {
  static get requires() {
    return [FontFamily];
  }

  static get pluginName() {
    return 'FontFamilySearch';
  }

  constructor(editor) {
    super(editor, {
      dropdownType: 'fontFamily',
      searchInputClass: 'ck-font-search-input',
      searchWrapperClass: 'ck-font-search-wrapper',
      panelClass: 'ck-font-family-with-search',
      panelAttribute: 'data-ck-font-search',
      placeholder: 'Search...',
      maxHeight: '250px',
      searchBarHeight: '40px',

      // Font family specific: check if panel contains font family items
      isPanelOfType: (panel) => {
        const listView = panel.querySelector('.ck-list');
        if (!listView) return false;

        const items = listView.querySelectorAll('.ck-list__item');
        if (items.length === 0) return false;

        // Check if first item is "Default" - if so, it's line-height
        const firstItemText = (items[0].textContent || '').trim();
        if (firstItemText.toLowerCase() === 'default') {
          return false;
        }

        // Sample a few items to check if they look like font names
        const sampleSize = Math.min(3, items.length);
        let fontLikeCount = 0;

        for (let i = 0; i < sampleSize; i++) {
          const itemText = (items[i].textContent || '').trim();

          const isNotSizePattern = !itemText.match(/^\d+(\.\d+)?pt$/);
          const hasAlphaChars = /[a-zA-Z]/.test(itemText);

          if (isNotSizePattern && hasAlphaChars && itemText.length > 3) {
            fontLikeCount++;
          }
        }

        // If majority of sampled items look like font families, it's a font family panel
        return fontLikeCount >= Math.ceil(sampleSize * 0.6);
      },

      // Find the fontFamily dropdown
      findDropdownView: (editor) => {
        try {
          const fontFamilyComponent = editor.ui.componentFactory.create('fontFamily');
          return fontFamilyComponent?.on ? fontFamilyComponent : fontFamilyComponent?.dropdownView;
        } catch (e) {
          // Fallback: find first dropdown in toolbar
          const toolbar = editor.ui?.view?.toolbar;
          if (toolbar?.items) {
            for (const item of toolbar.items) {
              if (item.constructor.name === 'DropdownView') {
                return item;
              }
            }
          }
        }
        return null;
      },

      // Custom filter to handle quoted font names
      filterItem: (item, text, term) => {
        const cleanText = text.replace(/['"]/g, '');
        return !term || cleanText.includes(term);
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

  return FontFamilySearchPlugin;
}
