/**
 * Plugin to keep the Font Family dropdown list readable.
 *
 * CKEditor renders each font option's label using the font itself so the name
 * doubles as a preview. For non-Latin fonts (Indic, Meitei Mayek, Urdu, etc.)
 * the English family name gets drawn with the font's own glyphs and becomes
 * unreadable. This plugin prepends the English family name in a normal UI font
 * to each list item, while leaving the original label in place as a preview
 * rendered in the actual font.
 *
 * @param {Object} CKEditor - CKEditor instance from CDN
 * @returns {Class} FontFamilyEnglishLabelPlugin class
 */
export default function createFontFamilyEnglishLabelPlugin(CKEditor) {
  const { Plugin } = CKEditor;

  // Readable UI font used for the English name (independent of the font option)
  const UI_FONT_STACK =
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

  class FontFamilyEnglishLabelPlugin extends Plugin {
    static get pluginName() {
      return 'FontFamilyEnglishLabel';
    }

    init() {
      const editor = this.editor;
      editor.ui.once('ready', () => {
        // Small delay so the toolbar is fully rendered before we hook in.
        setTimeout(() => this._setup(), 300);
      });
    }

    _setup() {
      const dropdownView = this._findFontFamilyDropdown();
      if (!dropdownView) {
        // Toolbar may still be initializing — retry a few times.
        if (this._setupRetries === undefined) this._setupRetries = 0;
        if (this._setupRetries < 25) {
          this._setupRetries += 1;
          setTimeout(() => this._setup(), 200);
        }
        return;
      }

      dropdownView.on('change:isOpen', (evt, name, isOpen) => {
        if (!isOpen) return;

        // The panel/list renders lazily, so retry across a few frames.
        [0, 50, 120, 250].forEach((delay) => {
          setTimeout(() => this._decorate(dropdownView), delay);
        });

        // Fallback: observe the panel until the list items appear.
        const panelEl = dropdownView.panelView?.element;
        if (panelEl) {
          if (this._observer) this._observer.disconnect();
          this._observer = new MutationObserver(() => this._decorate(dropdownView));
          this._observer.observe(panelEl, { childList: true, subtree: true });
          setTimeout(() => {
            if (this._observer) {
              this._observer.disconnect();
              this._observer = null;
            }
          }, 2000);
        }
      });
    }

    _findFontFamilyDropdown() {
      const editor = this.editor;
      if (!editor.commands.get('fontFamily')) return null;

      const toolbar = editor.ui?.view?.toolbar;
      if (!toolbar?.items) return null;

      for (const item of Array.from(toolbar.items)) {
        // Must be a dropdown (has isOpen) with a button
        if (item.isOpen === undefined || !item.buttonView) continue;

        const tooltip =
          typeof item.buttonView.tooltip === 'string'
            ? item.buttonView.tooltip.toLowerCase()
            : '';
        const label = (item.buttonView.label || '').toLowerCase();
        const aria = (
          item.buttonView.element?.getAttribute('aria-label') || ''
        ).toLowerCase();

        if (
          tooltip.includes('font family') ||
          label.includes('font family') ||
          aria.includes('font family')
        ) {
          return item;
        }
      }
      return null;
    }

    _decorate(dropdownView) {
      const panelEl = dropdownView.panelView?.element;
      if (!panelEl) return;

      const labels = panelEl.querySelectorAll('.ck-list__item .ck-button__label');
      labels.forEach((labelEl) => {
        if (labelEl.dataset.ckEnglishFontLabel === '1') return;

        // Only decorate items that carry a font preview style (i.e. real fonts).
        const previewFont = labelEl.style.fontFamily;
        const name = (labelEl.textContent || '').trim();
        if (!previewFont || !name) return;

        // Prepend the English name in a readable UI font. The original label
        // text node is left untouched as the in-font preview.
        const nameEl = document.createElement('span');
        nameEl.className = 'ck-font-english-name';
        nameEl.textContent = name;
        nameEl.style.fontFamily = UI_FONT_STACK;
        nameEl.style.marginRight = '10px';

        labelEl.insertBefore(nameEl, labelEl.firstChild);
        labelEl.dataset.ckEnglishFontLabel = '1';
      });
    }
  }

  return FontFamilyEnglishLabelPlugin;
}
