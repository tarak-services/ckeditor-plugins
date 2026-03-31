/**
 * Factory function to create MarginBottomPlugin with CKEditor from CDN
 *
 * This plugin adds a margin-bottom adjustment input that works on any selected
 * or cursor-focused element (image, table, span, row, cell, paragraph, etc.).
 *
 * @param {Object} CKEditor - CKEditor instance from CDN
 * @returns {Class} MarginBottomPlugin class
 */
export default function createMarginBottomPlugin(CKEditor) {
  const { Plugin, Command, View } = CKEditor;

  class MarginBottomCommand extends Command {
    refresh() {
      const model = this.editor.model;
      const selection = model.document.selection;

      const element = this._getTargetElement(selection);

      this.isEnabled = !!element && model.schema.checkAttribute(element, 'marginBottom');

      if (element) {
        this.value = element.getAttribute('marginBottom') || '';
      } else {
        this.value = '';
      }
    }

    execute(options = {}) {
      const model = this.editor.model;
      const selection = model.document.selection;
      const value = options.value;

      const element = this._getTargetElement(selection);

      if (!element) return;

      model.change(writer => {
        if (value && value.trim()) {
          writer.setAttribute('marginBottom', value.trim(), element);
        } else {
          writer.removeAttribute('marginBottom', element);
        }
      });
    }

    /**
     * Find the target element to apply margin-bottom to
     * Priority: selected element > ancestor block/widget
     */
    _getTargetElement(selection) {
      const selectedElement = selection.getSelectedElement();
      if (selectedElement) {
        return selectedElement;
      }

      const blocks = Array.from(selection.getSelectedBlocks());
      if (blocks.length > 0) {
        return blocks[0];
      }

      return null;
    }
  }

  class MarginBottomInputView extends View {
    constructor(locale, command, editor) {
      super(locale);

      this.command = command;
      this.editor = editor;
      this._inputElement = null;
      this._isUpdating = false;

      this.set('value', '');
      this.set('isEnabled', true);

      this.setTemplate({
        tag: 'div',
        attributes: {
          class: ['ck', 'ck-margin-bottom-input'],
          style: 'display: flex; align-items: center; gap: 2px; padding: 0 4px;'
        },
        children: [
          {
            tag: 'label',
            attributes: {
              style: 'font-size: 11px; white-space: nowrap;'
            },
            children: ['↕ Mb:']
          },
          {
            tag: 'input',
            attributes: {
              type: 'number',
              step: '0.5',
              class: ['ck', 'ck-input'],
              placeholder: '0',
              title: 'Margin Bottom (px)'
            }
          }
        ]
      });

      this.on('change:value', (evt, name, newValue) => {
        if (this._inputElement && !this._isUpdating) {
          const numericValue = parseFloat(newValue) || '';
          this._inputElement.value = numericValue;
        }
      });
    }

    render() {
      super.render();

      this._inputElement = this.element.querySelector('input');

      this._inputElement.style.cssText = 'width: 48px !important; min-width: 48px !important; max-width: 48px !important; padding: 1px 2px; font-size: 11px; text-align: center;';

      this._inputElement.addEventListener('keydown', (evt) => {
        if (evt.key === 'ArrowUp' || evt.key === 'ArrowDown') {
          evt.stopPropagation();
        }
      });

      this._inputElement.addEventListener('input', () => {
        this._applyValue(this._inputElement.value);
      });

      this._inputElement.removeAttribute('min');
    }

    _applyValue(rawValue) {
      this._isUpdating = true;

      const numValue = parseFloat(rawValue);
      let value = '';

      if (!isNaN(numValue) && numValue !== 0) {
        value = numValue + 'px';
      }

      if (value !== (this.command.value || '')) {
        this.command.execute({ value });
      }

      this._isUpdating = false;
    }

    focus() {
      if (this._inputElement) {
        this._inputElement.focus();
      }
    }
  }

  return class MarginBottomPlugin extends Plugin {
    static get pluginName() {
      return 'MarginBottom';
    }

    init() {
      const editor = this.editor;

      editor.model.schema.extend('$block', {
        allowAttributes: 'marginBottom'
      });

      const additionalElements = ['imageInline', 'imageBlock', 'table', 'tableRow', 'tableCell'];
      for (const elementName of additionalElements) {
        if (editor.model.schema.isRegistered(elementName)) {
          editor.model.schema.extend(elementName, {
            allowAttributes: 'marginBottom'
          });
        }
      }

      editor.conversion.for('downcast').add(dispatcher => {
        dispatcher.on('attribute:marginBottom', (evt, data, conversionApi) => {
          if (!conversionApi.consumable.consume(data.item, evt.name)) {
            return;
          }

          const viewElement = conversionApi.mapper.toViewElement(data.item);
          if (!viewElement) {
            return;
          }

          const writer = conversionApi.writer;

          let targetElement = viewElement;
          const modelName = data.item.name;
          if (modelName === 'imageBlock' && viewElement.is('element', 'figure')) {
            for (const child of viewElement.getChildren()) {
              if (child.is('element', 'img')) {
                targetElement = child;
                break;
              }
            }
          }

          if (data.attributeNewValue) {
            writer.setStyle('margin-bottom', data.attributeNewValue, targetElement);
          } else {
            writer.removeStyle('margin-bottom', targetElement);
          }
        }, { priority: 'low' });
      });

      editor.conversion.for('upcast').attributeToAttribute({
        view: {
          styles: {
            'margin-bottom': /.*/
          }
        },
        model: {
          key: 'marginBottom',
          value: viewElement => viewElement.getStyle('margin-bottom')
        }
      });

      editor.commands.add('marginBottom', new MarginBottomCommand(editor));

      editor.ui.componentFactory.add('marginBottom', locale => {
        const command = editor.commands.get('marginBottom');
        const inputView = new MarginBottomInputView(locale, command, editor);

        inputView.bind('value').to(command, 'value');
        inputView.bind('isEnabled').to(command, 'isEnabled');

        return inputView;
      });
    }
  };
}
