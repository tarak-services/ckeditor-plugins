/**
 * Plugin that adds text-align-last: justify to selected blocks.
 * This ensures the last line of a paragraph is also fully justified.
 */
export default function createTextAlignLastPlugin(CKEditor) {
  const { Plugin, Command, ButtonView } = CKEditor;

  class TextAlignLastCommand extends Command {
    refresh() {
      const model = this.editor.model;
      const selection = model.document.selection;
      const firstBlock = Array.from(selection.getSelectedBlocks())[0];

      this.isEnabled = !!firstBlock && model.schema.checkAttribute(firstBlock, 'textAlignLast');
      this.value = firstBlock ? firstBlock.getAttribute('textAlignLast') === 'justify' : false;
    }

    execute() {
      const model = this.editor.model;
      const selection = model.document.selection;
      const blocks = Array.from(selection.getSelectedBlocks());

      model.change(writer => {
        for (const block of blocks) {
          if (model.schema.checkAttribute(block, 'textAlignLast')) {
            const currentValue = block.getAttribute('textAlignLast');
            if (currentValue === 'justify') {
              writer.removeAttribute('textAlignLast', block);
            } else {
              writer.setAttribute('textAlignLast', 'justify', block);
            }
          }
        }
      });
    }
  }

  return class TextAlignLastPlugin extends Plugin {
    static get pluginName() {
      return 'TextAlignLastPlugin';
    }

    init() {
      const editor = this.editor;

      // Register the attribute in schema
      editor.model.schema.extend('$block', {
        allowAttributes: 'textAlignLast'
      });

      // Downcast: model -> view (add style and class to block element)
      editor.conversion.for('downcast').add(dispatcher => {
        dispatcher.on('attribute:textAlignLast', (evt, data, conversionApi) => {
          if (!conversionApi.consumable.consume(data.item, evt.name)) {
            return;
          }

          const viewElement = conversionApi.mapper.toViewElement(data.item);
          if (!viewElement) {
            return;
          }

          const writer = conversionApi.writer;

          if (data.attributeNewValue === 'justify') {
            writer.setStyle('text-align-last', 'justify', viewElement);
            writer.addClass('text-align-last-justify', viewElement);
          } else {
            writer.removeStyle('text-align-last', viewElement);
            writer.removeClass('text-align-last-justify', viewElement);
          }
        }, { priority: 'low' });
      });

      // Upcast: view -> model (from pasted/loaded content with inline style)
      editor.conversion.for('upcast').attributeToAttribute({
        view: {
          styles: {
            'text-align-last': 'justify'
          }
        },
        model: {
          key: 'textAlignLast',
          value: 'justify'
        }
      });

      // Also upcast from class
      editor.conversion.for('upcast').add(dispatcher => {
        dispatcher.on('element:p', (evt, data, conversionApi) => {
          const viewElement = data.viewItem;
          if (viewElement.hasClass('text-align-last-justify')) {
            const modelRange = data.modelRange;
            if (modelRange) {
              for (const item of modelRange.getItems()) {
                if (item.is('element') && conversionApi.schema.checkAttribute(item, 'textAlignLast')) {
                  conversionApi.writer.setAttribute('textAlignLast', 'justify', item);
                }
              }
            }
          }
        }, { priority: 'low' });
      });

      // Register the command
      editor.commands.add('textAlignLast', new TextAlignLastCommand(editor));

      // Add toolbar button
      editor.ui.componentFactory.add('textAlignLast', locale => {
        const button = new ButtonView(locale);
        const command = editor.commands.get('textAlignLast');

        button.set({
          label: 'Force Justify',
          tooltip: true,
          withText: false,
          icon: '<svg viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M2 4h16M2 8h16M2 12h16" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M2 16h16" stroke="currentColor" stroke-width="2.5" fill="none"/><path d="M4 14.5l-2 1.5 2 1.5M16 14.5l2 1.5-2 1.5" stroke="currentColor" stroke-width="1" fill="none"/></svg>'
        });

        button.bind('isOn').to(command, 'value');
        button.bind('isEnabled').to(command, 'isEnabled');

        button.on('execute', () => {
          editor.execute('textAlignLast');
          editor.editing.view.focus();
        });

        return button;
      });
    }
  };
}
