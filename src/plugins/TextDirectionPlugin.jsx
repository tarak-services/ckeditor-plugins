/**
 * Factory function to create TextDirectionPlugin with CKEditor from CDN
 * @param {Object} CKEditor - CKEditor instance from CDN
 * @returns {Class} TextDirectionPlugin class
 */
export default function createTextDirectionPlugin(CKEditor) {
  const { Plugin, Command } = CKEditor;
  const { ButtonView } = CKEditor;

  /**
   * Custom Text Direction plugin for CKEditor
   * Adds buttons to set text direction to LTR or RTL
   */
  class TextDirectionPlugin extends Plugin {
    static get pluginName() {
      return 'TextDirection';
    }

    init() {
      const editor = this.editor;

      // Define the text direction command
      editor.commands.add('textDirection', new TextDirectionCommand(editor));

      // Register LTR button
      editor.ui.componentFactory.add('textDirectionLTR', locale => {
        const buttonView = new ButtonView(locale);
        const command = editor.commands.get('textDirection');

        buttonView.set({
          label: 'LTR',
          tooltip: 'Left-to-Right',
          withText: true,
          icon: ltrIcon
        });

        buttonView.bind('isEnabled').to(command, 'isEnabled');
        buttonView.bind('isOn').to(command, 'value', value => value === 'ltr');

        this.listenTo(buttonView, 'execute', () => {
          editor.execute('textDirection', { value: 'ltr' });
          editor.editing.view.focus();
        });

        return buttonView;
      });

      // Register RTL button
      editor.ui.componentFactory.add('textDirectionRTL', locale => {
        const buttonView = new ButtonView(locale);
        const command = editor.commands.get('textDirection');

        buttonView.set({
          label: 'RTL',
          tooltip: 'Right-to-Left',
          withText: true,
          icon: rtlIcon
        });

        buttonView.bind('isEnabled').to(command, 'isEnabled');
        buttonView.bind('isOn').to(command, 'value', value => value === 'rtl');

        this.listenTo(buttonView, 'execute', () => {
          editor.execute('textDirection', { value: 'rtl' });
          editor.editing.view.focus();
        });

        return buttonView;
      });

      // Allow direction attribute in the schema
      editor.model.schema.extend('$text', { allowAttributes: 'textDirection' });
      editor.model.schema.setAttributeProperties('textDirection', {
        isFormatting: true,
        copyOnEnter: true
      });

      // Also allow direction on block elements
      editor.model.schema.extend('$block', { allowAttributes: 'textDirection' });

      // Conversion from model to view for inline text (editing and data)
      editor.conversion.for('downcast').attributeToElement({
        model: 'textDirection',
        view: (direction, { writer }) => {
          if (!direction) return;
          return writer.createAttributeElement('span', {
            dir: direction,
            style: `direction: ${direction};`
          }, { priority: 7 });
        }
      });

      // Conversion from view to model (data)
      editor.conversion.for('upcast').elementToAttribute({
        view: {
          name: 'span',
          attributes: {
            dir: /.*/
          }
        },
        model: {
          key: 'textDirection',
          value: viewElement => {
            const dir = viewElement.getAttribute('dir');
            return dir === 'ltr' || dir === 'rtl' ? dir : null;
          }
        }
      });

      // Also support dir attribute from inline styles
      editor.conversion.for('upcast').elementToAttribute({
        view: {
          name: 'span',
          styles: {
            'direction': /.*/
          }
        },
        model: {
          key: 'textDirection',
          value: viewElement => {
            const direction = viewElement.getStyle('direction');
            return direction === 'ltr' || direction === 'rtl' ? direction : null;
          }
        }
      });
    }
  }

  /**
   * Text Direction Command
   */
  class TextDirectionCommand extends Command {
    refresh() {
      const model = this.editor.model;
      const selection = model.document.selection;

      this.isEnabled = model.schema.checkAttributeInSelection(selection, 'textDirection');
      this.value = selection.getAttribute('textDirection');
    }

    execute(options = {}) {
      const model = this.editor.model;
      const selection = model.document.selection;
      const value = options.value;

      model.change(writer => {
        if (selection.isCollapsed) {
          if (value) {
            writer.setSelectionAttribute('textDirection', value);
          } else {
            writer.removeSelectionAttribute('textDirection');
          }
        } else {
          const ranges = model.schema.getValidRanges(selection.getRanges(), 'textDirection');

          for (const range of ranges) {
            if (value) {
              writer.setAttribute('textDirection', value, range);
            } else {
              writer.removeAttribute('textDirection', range);
            }
          }
        }
      });
    }
  }

  // LTR icon (arrow pointing left to right)
  const ltrIcon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M2 5h16v2H2V5zm0 4h10v2H2V9zm0 4h16v2H2v-2z"/><path d="M14 11l4 3-4 3v-6z" fill="currentColor"/></svg>';

  // RTL icon (arrow pointing right to left)
  const rtlIcon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M2 5h16v2H2V5zm8 4h8v2h-8V9zm-8 4h16v2H2v-2z"/><path d="M6 11l-4 3 4 3v-6z" fill="currentColor"/></svg>';

  return TextDirectionPlugin;
}
