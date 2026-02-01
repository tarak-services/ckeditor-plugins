import React from 'react';
import { createRoot } from 'react-dom/client';
import FontSymbolSelectorDialog from './FontSymbolSelectorDialog.jsx';

/**
 * Factory function to create FontSymbolSelectorPlugin with CKEditor from CDN
 * @param {Object} CKEditor - CKEditor instance from CDN
 * @returns {Class} FontSymbolSelectorPlugin class
 */
export default function createFontSymbolSelectorPlugin(CKEditor) {
  const { Plugin, ButtonView } = CKEditor;

  class FontSymbolSelectorPlugin extends Plugin {
    static get pluginName() {
      return 'FontSymbolSelector';
    }

    init() {
      const editor = this.editor;

      // Add button to toolbar
      editor.ui.componentFactory.add('FontSymbolSelector', locale => {
        const view = new ButtonView(locale);

        view.set({
          label: 'Insert Symbol from Font',
          icon: this._getIcon(),
          tooltip: true
        });

        view.on('execute', () => {
          this._openDialog();
        });

        return view;
      });
    }

    _openDialog() {
      // Check if dialog container already exists
      let container = document.getElementById('font-symbol-selector-container');

      if (!container) {
        container = document.createElement('div');
        container.id = 'font-symbol-selector-container';
        document.body.appendChild(container);
      } else {
        // If it exists, it might be from a previous unmount that didn't clean up fully
        // or we just reuse it. But createRoot on existing root will warn.
        // For simplicity, let's just use a fresh container every time
        // but give it a unique ID or class so we can debug.
      }

      const root = createRoot(container);

      // We need to keep track of this open instance to prevent multiple
      // but the plugin structure makes it tricky to share state.
      // However, usually modals block interaction so user can't click button again.

      const cleanup = () => {
        // Use timeout to allow React to process events/updates before unmounting
        setTimeout(() => {
          root.unmount();
          if (container.parentNode) {
            container.parentNode.removeChild(container);
          }
        }, 0);
      };

      const handleInsert = (character, font) => {
        this.editor.model.change(writer => {
          const selection = this.editor.model.document.selection;

          // Insert text with font-family attribute
          // We use 'fontFamily' attribute which is handled by the standard FontFamily plugin
          writer.insertText(character, { fontFamily: font }, selection.getFirstPosition());
        });

        cleanup();
      };

      const handleClose = () => {
        cleanup();
      };

      root.render(
        <FontSymbolSelectorDialog
          isOpen={true}
          onInsert={handleInsert}
          onClose={handleClose}
        />
      );
    }

    _getIcon() {
      // Omega icon
      return '<svg viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M10 2c-4.42 0-8 3.58-8 8 0 1.6.5 3.08 1.36 4.32l-1.09 1.09 1.41 1.41 1.09-1.09C6.08 17.5 7.95 18 10 18c4.42 0 8-3.58 8-8s-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6z" fill="currentColor"/><path d="M10 6c-1.66 0-3 1.34-3 3h2c0-.55.45-1 1-1s1 .45 1 1-1 1-1 1H8v2h2v-2h.5c1.38 0 2.5-1.12 2.5-2.5S11.66 6 10 6z" fill="currentColor"/></svg>';
    }
  }

  return FontSymbolSelectorPlugin;
}
