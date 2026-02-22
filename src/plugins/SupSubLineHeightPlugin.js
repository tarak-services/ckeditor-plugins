/**
 * Factory function to create SupSubLineHeightPlugin with CKEditor from CDN
 * Toggle button that sets line-height: 0em directly on <sup>/<sub> elements.
 * This prevents superscript/subscript from increasing the line height of the parent line.
 * @param {Object} CKEditor - CKEditor instance from CDN
 * @returns {Class} SupSubLineHeightPlugin class
 */
export default function createSupSubLineHeightPlugin(CKEditor) {
  const { Plugin, Command } = CKEditor;
  const { ButtonView } = CKEditor;

  class SupSubLineHeightPlugin extends Plugin {
    static get pluginName() {
      return 'SupSubLineHeight';
    }

    init() {
      const editor = this.editor;

      editor.commands.add('supSubLineHeight', new SupSubLineHeightCommand(editor));

      editor.ui.componentFactory.add('supSubLineHeight', locale => {
        const view = new ButtonView(locale);
        const command = editor.commands.get('supSubLineHeight');

        view.set({
          label: 'Zero Line Height',
          icon: zeroLineHeightIcon,
          tooltip: true,
          isToggleable: true
        });

        view.bind('isOn').to(command, 'value');
        view.bind('isEnabled').to(command, 'isEnabled');

        view.on('execute', () => {
          editor.execute('supSubLineHeight');
          editor.editing.view.focus();
        });

        return view;
      });

      editor.model.schema.extend('$text', { allowAttributes: 'supSubLineHeight' });
      editor.model.schema.setAttributeProperties('supSubLineHeight', {
        isFormatting: true,
        copyOnEnter: true
      });

      this._setupDowncast();
      this._setupUpcast();
    }

    _setupDowncast() {
      const editor = this.editor;

      // Override the default superscript/subscript downcast converters so
      // they include style="line-height:0em" when our attribute is present.
      editor.conversion.for('downcast').add(dispatcher => {
        dispatcher.on('attribute:superscript:$text', (evt, data, conversionApi) => {
          if (!conversionApi.consumable.consume(data.item, evt.name)) return;

          const viewWriter = conversionApi.writer;
          const viewRange = conversionApi.mapper.toViewRange(data.range);

          if (data.attributeNewValue) {
            const hasZeroLH = data.item.hasAttribute('supSubLineHeight');
            const element = viewWriter.createAttributeElement('sup',
              hasZeroLH ? { style: 'line-height:0em' } : {}
            );
            viewWriter.wrap(viewRange, element);
          } else {
            viewWriter.unwrap(viewRange, viewWriter.createAttributeElement('sup'));
          }
        }, { priority: 'high' });

        dispatcher.on('attribute:subscript:$text', (evt, data, conversionApi) => {
          if (!conversionApi.consumable.consume(data.item, evt.name)) return;

          const viewWriter = conversionApi.writer;
          const viewRange = conversionApi.mapper.toViewRange(data.range);

          if (data.attributeNewValue) {
            const hasZeroLH = data.item.hasAttribute('supSubLineHeight');
            const element = viewWriter.createAttributeElement('sub',
              hasZeroLH ? { style: 'line-height:0em' } : {}
            );
            viewWriter.wrap(viewRange, element);
          } else {
            viewWriter.unwrap(viewRange, viewWriter.createAttributeElement('sub'));
          }
        }, { priority: 'high' });
      });

      // When supSubLineHeight toggles on text that already has sup/sub,
      // unwrap the existing element and rewrap with the correct variant.
      editor.conversion.for('downcast').add(dispatcher => {
        dispatcher.on('attribute:supSubLineHeight:$text', (evt, data, conversionApi) => {
          if (!conversionApi.consumable.consume(data.item, evt.name)) return;

          const isSup = data.item.hasAttribute('superscript');
          const isSub = data.item.hasAttribute('subscript');
          if (!isSup && !isSub) return;

          const viewWriter = conversionApi.writer;
          const viewRange = conversionApi.mapper.toViewRange(data.range);
          const tagName = isSup ? 'sup' : 'sub';

          viewWriter.unwrap(viewRange, viewWriter.createAttributeElement(tagName));

          const attrs = data.attributeNewValue ? { style: 'line-height:0em' } : {};
          viewWriter.wrap(viewRange, viewWriter.createAttributeElement(tagName, attrs));
        });
      });
    }

    _setupUpcast() {
      const editor = this.editor;

      // Detect line-height: 0em on <sup> and <sub> during upcast.
      // Runs after the Superscript/Subscript plugin upcast.
      editor.conversion.for('upcast').add(dispatcher => {
        const handler = (evt, data, conversionApi) => {
          const viewElement = data.viewItem;
          const lineHeight = viewElement.getStyle('line-height');

          if (!lineHeight || !/^0(em|px)?$/.test(lineHeight)) return;
          if (!conversionApi.consumable.consume(viewElement, { styles: ['line-height'] })) return;

          if (data.modelRange) {
            for (const item of data.modelRange.getItems()) {
              if (conversionApi.schema.checkAttribute(item, 'supSubLineHeight')) {
                conversionApi.writer.setAttribute('supSubLineHeight', true, item);
              }
            }
          }
        };

        dispatcher.on('element:sup', handler, { priority: 'low' });
        dispatcher.on('element:sub', handler, { priority: 'low' });
      });
    }
  }

  class SupSubLineHeightCommand extends Command {
    refresh() {
      const model = this.editor.model;
      const selection = model.document.selection;

      this.isEnabled = model.schema.checkAttributeInSelection(selection, 'supSubLineHeight');
      this.value = !!selection.getAttribute('supSubLineHeight');
    }

    execute() {
      const model = this.editor.model;
      const selection = model.document.selection;
      const newValue = !this.value;

      model.change(writer => {
        if (selection.isCollapsed) {
          if (newValue) {
            writer.setSelectionAttribute('supSubLineHeight', true);
          } else {
            writer.removeSelectionAttribute('supSubLineHeight');
          }
        } else {
          const ranges = model.schema.getValidRanges(selection.getRanges(), 'supSubLineHeight');

          for (const range of ranges) {
            if (newValue) {
              writer.setAttribute('supSubLineHeight', true, range);
            } else {
              writer.removeAttribute('supSubLineHeight', range);
            }
          }
        }
      });
    }
  }

  const zeroLineHeightIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
    <text x="2" y="14" font-size="9" font-family="Arial, sans-serif" font-weight="bold" fill="currentColor">LH</text>
    <text x="13" y="8" font-size="6" font-family="Arial, sans-serif" font-weight="bold" fill="currentColor">0</text>
  </svg>`;

  return SupSubLineHeightPlugin;
}
