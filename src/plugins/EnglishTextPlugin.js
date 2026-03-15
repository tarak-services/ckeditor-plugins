/**
 * Factory function to create EnglishTextPlugin with CKEditor from CDN.
 * Wraps selected text in a <span class="english-text"> so it inherits
 * the English font/size/line-height settings regardless of the current
 * language editor context.
 *
 * Uses a fixed class name ("english-text") so it survives language
 * reordering in the language config.
 *
 * @param {Object} CKEditor - CKEditor instance from CDN
 * @returns {Class} EnglishTextPlugin class
 */
export default function createEnglishTextPlugin(CKEditor) {
  const { Plugin, Command } = CKEditor;

  const ENGLISH_TEXT_CLASS = 'english-text';

  class EnglishTextPlugin extends Plugin {
    static get pluginName() {
      return 'EnglishText';
    }

    init() {
      const editor = this.editor;

      editor.commands.add('englishText', new EnglishTextCommand(editor));

      editor.ui.componentFactory.add('englishText', locale => {
        const { ButtonView } = CKEditor;
        const button = new ButtonView(locale);
        const command = editor.commands.get('englishText');

        button.set({
          label: 'English Text',
          tooltip: true,
          withText: false,
          icon: englishTextIcon
        });

        button.bind('isOn').to(command, 'value');
        button.bind('isEnabled').to(command, 'isEnabled');

        button.on('execute', () => {
          editor.execute('englishText');
          editor.editing.view.focus();
        });

        return button;
      });

      editor.model.schema.extend('$text', { allowAttributes: 'englishText' });
      editor.model.schema.setAttributeProperties('englishText', {
        isFormatting: true,
        copyOnEnter: true
      });

      editor.conversion.for('downcast').attributeToElement({
        model: 'englishText',
        view: (value, { writer }) => {
          if (!value) return;
          return writer.createAttributeElement('span', {
            class: ENGLISH_TEXT_CLASS
          }, { priority: 7 });
        }
      });

      editor.conversion.for('upcast').elementToAttribute({
        view: {
          name: 'span',
          classes: [ENGLISH_TEXT_CLASS]
        },
        model: {
          key: 'englishText',
          value: true
        }
      });
    }
  }

  class EnglishTextCommand extends Command {
    refresh() {
      const model = this.editor.model;
      const selection = model.document.selection;
      this.isEnabled = model.schema.checkAttributeInSelection(selection, 'englishText');
      this.value = !!selection.getAttribute('englishText');
    }

    execute() {
      const model = this.editor.model;
      const selection = model.document.selection;
      const newValue = !this.value;

      model.change(writer => {
        if (selection.isCollapsed) {
          if (newValue) {
            writer.setSelectionAttribute('englishText', true);
          } else {
            writer.removeSelectionAttribute('englishText');
          }
        } else {
          const ranges = model.schema.getValidRanges(selection.getRanges(), 'englishText');
          for (const range of ranges) {
            if (newValue) {
              writer.setAttribute('englishText', true, range);
            } else {
              writer.removeAttribute('englishText', range);
            }
          }
        }
      });
    }
  }

  const englishTextIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
    <text x="3" y="15" font-size="14" font-weight="bold" font-family="serif" fill="currentColor">E</text>
    <text x="11" y="15" font-size="9" font-family="serif" fill="currentColor">n</text>
  </svg>`;

  return EnglishTextPlugin;
}
