/**
 * Factory function to create CurlyQuotesPlugin with CKEditor from CDN
 * @param {Object} CKEditor - CKEditor instance from CDN
 * @returns {Class} CurlyQuotesPlugin class
 */
export default function createCurlyQuotesPlugin(CKEditor) {
  const { Plugin } = CKEditor;
  const { createDropdown, addListToDropdown } = CKEditor;
  const { Collection } = CKEditor;

  class CurlyQuotesPlugin extends Plugin {
    static get pluginName() {
      return 'CurlyQuotes';
    }

    init() {
      const editor = this.editor;

      const quotes = [
        { label: 'Single Open Quote (‘)', character: '‘' },
        { label: 'Single Close Quote (’)', character: '’' },
        { label: 'Double Open Quote (“)', character: '“' },
        { label: 'Double Close Quote (”)', character: '”' },
      ];

      editor.ui.componentFactory.add('curlyQuotes', locale => {
        const dropdownView = createDropdown(locale);

        dropdownView.buttonView.set({
          label: 'Curly Quotes',
          icon: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z" fill="currentColor"/></svg>',
          tooltip: true,
          withText: false
        });

        const items = new Collection();

        quotes.forEach(quote => {
          items.add({
            type: 'button',
            model: {
              label: quote.label,
              withText: true,
              character: quote.character
            }
          });
        });

        addListToDropdown(dropdownView, items);

        // Hide the search bar (filter) if it exists
        dropdownView.on('change:isOpen', () => {
          if (dropdownView.isOpen && dropdownView.listView && dropdownView.listView.filterView) {
            dropdownView.listView.filterView.element.style.display = 'none';
          }
        });

        dropdownView.on('execute', evt => {
          const { character } = evt.source;
          if (character) {
            editor.model.change(writer => {
              const selection = editor.model.document.selection;
              // Insert text with Kokila font and 14pt size
              writer.insertText(character, {
                fontFamily: 'Kokila',
                fontSize: '14pt'
              }, selection.getFirstPosition());
            });
            editor.editing.view.focus();
          }
        });

        return dropdownView;
      });
    }
  }

  return CurlyQuotesPlugin;
}
