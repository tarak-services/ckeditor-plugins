/**
 * Factory function to create MarginTopPlugin with CKEditor from CDN
 *
 * This plugin adds a margin-top adjustment input that works on any selected
 * or cursor-focused element (image, table, span, row, cell, paragraph, etc.).
 *
 * @param {Object} CKEditor - CKEditor instance from CDN
 * @returns {Class} MarginTopPlugin class
 */
export default function createMarginTopPlugin(CKEditor) {
  const { Plugin, Command, View } = CKEditor;

  /**
   * Command to set margin-top on the current element
   */
  class MarginTopCommand extends Command {
    refresh() {
      const model = this.editor.model;
      const selection = model.document.selection;

      // Try to find a valid element to apply margin-top to
      const element = this._getTargetElement(selection);

      this.isEnabled = !!element && model.schema.checkAttribute(element, 'marginTop');

      if (element) {
        this.value = element.getAttribute('marginTop') || '';
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
          writer.setAttribute('marginTop', value.trim(), element);
        } else {
          writer.removeAttribute('marginTop', element);
        }
      });
    }

    /**
     * Find the target element to apply margin-top to
     * Priority: selected element > ancestor block/widget
     */
    _getTargetElement(selection) {
      // First, check if there's a selected element (like an image or table)
      const selectedElement = selection.getSelectedElement();
      if (selectedElement) {
        return selectedElement;
      }

      // Fallback: return the first block
      const blocks = Array.from(selection.getSelectedBlocks());
      if (blocks.length > 0) {
        return blocks[0];
      }

      return null;
    }
  }

  /**
   * Input view for margin-top value
   */
  class MarginTopInputView extends View {
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
          class: ['ck', 'ck-margin-top-input'],
          style: 'display: flex; align-items: center; gap: 2px; padding: 0 4px;'
        },
        children: [
          {
            tag: 'label',
            attributes: {
              style: 'font-size: 11px; white-space: nowrap;'
            },
            children: ['↕ Mt:']
          },
          {
            tag: 'input',
            attributes: {
              type: 'number',
              step: '0.5',
              class: ['ck', 'ck-input'],
              placeholder: '0',
              title: 'Margin Top (px)'
            }
          }
        ]
      });

      // Bind value changes to update input
      this.on('change:value', (evt, name, newValue) => {
        if (this._inputElement && !this._isUpdating) {
          // Extract numeric value from "Xpx" format
          const numericValue = parseFloat(newValue) || '';
          this._inputElement.value = numericValue;
        }
      });
    }

    render() {
      super.render();

      this._inputElement = this.element.querySelector('input');

      // Set width directly on element to override CKEditor styles
      this._inputElement.style.cssText = 'width: 48px !important; min-width: 48px !important; max-width: 48px !important; padding: 1px 2px; font-size: 11px; text-align: center;';

      // Stop arrow key events from propagating to the toolbar
      this._inputElement.addEventListener('keydown', (evt) => {
        if (evt.key === 'ArrowUp' || evt.key === 'ArrowDown') {
          evt.stopPropagation();
        }
      });

      // Apply instantly on input change (including up/down arrows)
      this._inputElement.addEventListener('input', () => {
        this._applyValue(this._inputElement.value);
      });

      // Allow negative values
      this._inputElement.removeAttribute('min');
    }

    _applyValue(rawValue) {
      this._isUpdating = true;

      const numValue = parseFloat(rawValue);
      let value = '';

      if (!isNaN(numValue) && numValue !== 0) {
        value = numValue + 'px';
      }

      // Only execute if value changed
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

  /**
   * Plugin to add margin-top adjustment to any element
   */
  return class MarginTopPlugin extends Plugin {
    static get pluginName() {
      return 'MarginTop';
    }

    init() {
      const editor = this.editor;

      // Register the attribute in schema for blocks and objects
      editor.model.schema.extend('$block', {
        allowAttributes: 'marginTop'
      });

      // Also extend specific elements that might not be $block
      const additionalElements = ['imageInline', 'imageBlock', 'table', 'tableRow', 'tableCell'];
      for (const elementName of additionalElements) {
        if (editor.model.schema.isRegistered(elementName)) {
          editor.model.schema.extend(elementName, {
            allowAttributes: 'marginTop'
          });
        }
      }

      // Downcast: model -> view (add style to element)
      editor.conversion.for('downcast').add(dispatcher => {
        dispatcher.on('attribute:marginTop', (evt, data, conversionApi) => {
          if (!conversionApi.consumable.consume(data.item, evt.name)) {
            return;
          }

          const viewElement = conversionApi.mapper.toViewElement(data.item);
          if (!viewElement) {
            return;
          }

          const writer = conversionApi.writer;

          // For images in figures, target the img element
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
            writer.setStyle('margin-top', data.attributeNewValue, targetElement);
          } else {
            writer.removeStyle('margin-top', targetElement);
          }
        }, { priority: 'low' });
      });

      // Upcast: view -> model (from pasted/loaded content with inline style)
      editor.conversion.for('upcast').attributeToAttribute({
        view: {
          styles: {
            'margin-top': /.*/
          }
        },
        model: {
          key: 'marginTop',
          value: viewElement => viewElement.getStyle('margin-top')
        }
      });

      // Register the command
      editor.commands.add('marginTop', new MarginTopCommand(editor));

      // Add the input to UI
      editor.ui.componentFactory.add('marginTop', locale => {
        const command = editor.commands.get('marginTop');
        const inputView = new MarginTopInputView(locale, command, editor);

        // Update input value when command value changes
        inputView.bind('value').to(command, 'value');
        inputView.bind('isEnabled').to(command, 'isEnabled');

        return inputView;
      });
    }
  };
}
