/**
 * Factory function to create ImageVerticalAlignPlugin with CKEditor from CDN
 *
 * This plugin adds vertical alignment options to inline images.
 * Options: top, middle, bottom, baseline
 * Also adds a top offset feature to nudge images down by a specified amount.
 *
 * @param {Object} CKEditor - CKEditor instance from CDN
 * @returns {Class} ImageVerticalAlignPlugin class
 */
export default function createImageVerticalAlignPlugin(CKEditor) {
  const { Plugin, Command, ButtonView, View } = CKEditor;
  const { createDropdown, addListToDropdown } = CKEditor;
  const { Collection } = CKEditor;

  // Icons for vertical alignment options
  const icons = {
    top: '<svg viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M2 2h16v1H2V2z"/><rect x="7" y="5" width="6" height="8" rx="1"/></svg>',
    middle: '<svg viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M2 10h4v1H2v-1zm12 0h4v1h-4v-1z"/><rect x="7" y="6" width="6" height="8" rx="1"/></svg>',
    bottom: '<svg viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M2 17h16v1H2v-1z"/><rect x="7" y="7" width="6" height="8" rx="1"/></svg>',
    baseline: '<svg viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M2 15h16v1H2v-1z"/><rect x="7" y="4" width="6" height="10" rx="1"/></svg>',
    verticalAlign: '<svg viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M2 2h16v1H2V2zm0 15h16v1H2v-1z"/><rect x="7" y="5" width="6" height="10" rx="1"/><path d="M10 3l2 2H8l2-2zm0 14l-2-2h4l-2 2z"/></svg>'
  };

  const ALIGNMENT_VALUES = ['top', 'middle', 'bottom', 'baseline'];

  /**
   * Command to set image vertical alignment
   */
  class ImageVerticalAlignCommand extends Command {
    constructor(editor, alignment) {
      super(editor);
      this.alignment = alignment;
    }

    refresh() {
      const editor = this.editor;
      const selection = editor.model.document.selection;
      const selectedElement = selection.getSelectedElement();

      const isImageSelected = selectedElement &&
        (selectedElement.name === 'imageInline' || selectedElement.name === 'imageBlock');

      this.isEnabled = isImageSelected;

      if (isImageSelected) {
        const currentAlign = selectedElement.getAttribute('imageVerticalAlign') || '';
        this.value = currentAlign === this.alignment;
      } else {
        this.value = false;
      }
    }

    execute() {
      const editor = this.editor;
      const model = editor.model;
      const selection = model.document.selection;
      const selectedElement = selection.getSelectedElement();

      if (!selectedElement) return;

      model.change(writer => {
        const currentValue = selectedElement.getAttribute('imageVerticalAlign');

        if (currentValue === this.alignment) {
          writer.removeAttribute('imageVerticalAlign', selectedElement);
        } else {
          writer.setAttribute('imageVerticalAlign', this.alignment, selectedElement);
        }
      });
    }
  }

  /**
   * Command to set image top offset
   */
  class ImageTopOffsetCommand extends Command {
    refresh() {
      const editor = this.editor;
      const selection = editor.model.document.selection;
      const selectedElement = selection.getSelectedElement();

      const isImageSelected = selectedElement &&
        (selectedElement.name === 'imageInline' || selectedElement.name === 'imageBlock');

      this.isEnabled = isImageSelected;

      if (isImageSelected) {
        this.value = selectedElement.getAttribute('imageTopOffset') || '';
      } else {
        this.value = '';
      }
    }

    execute(options = {}) {
      const editor = this.editor;
      const model = editor.model;
      const selection = model.document.selection;
      const selectedElement = selection.getSelectedElement();

      if (!selectedElement) return;

      model.change(writer => {
        if (options.value && options.value.trim()) {
          writer.setAttribute('imageTopOffset', options.value.trim(), selectedElement);
        } else {
          writer.removeAttribute('imageTopOffset', selectedElement);
        }
      });
    }
  }

  /**
   * Simple input view for top offset
   */
  class TopOffsetInputView extends View {
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
          class: ['ck', 'ck-image-top-offset'],
          style: 'display: flex; align-items: center; gap: 2px; padding: 0 4px;'
        },
        children: [
          {
            tag: 'label',
            attributes: {
              style: 'font-size: 11px; white-space: nowrap;'
            },
            children: ['Top:']
          },
          {
            tag: 'input',
            attributes: {
              type: 'number',
              step: '0.1',
              class: ['ck', 'ck-input'],
              placeholder: '0'
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
   * Plugin to add vertical alignment and top offset to images
   */
  class ImageVerticalAlignPlugin extends Plugin {
    static get pluginName() {
      return 'ImageVerticalAlign';
    }

    init() {
      const editor = this.editor;

      this._extendSchema();
      this._defineConverters();

      // Register vertical alignment commands
      for (const alignment of ALIGNMENT_VALUES) {
        editor.commands.add(`imageVerticalAlign:${alignment}`, new ImageVerticalAlignCommand(editor, alignment));
      }

      // Register top offset command
      editor.commands.add('imageTopOffset', new ImageTopOffsetCommand(editor));

      this._addDropdown();
      this._addToolbarButtons();
      this._addTopOffsetInput();
    }

    _extendSchema() {
      const editor = this.editor;
      const schema = editor.model.schema;

      schema.extend('imageInline', {
        allowAttributes: ['imageVerticalAlign', 'imageTopOffset']
      });

      if (schema.isRegistered('imageBlock')) {
        schema.extend('imageBlock', {
          allowAttributes: ['imageVerticalAlign', 'imageTopOffset']
        });
      }
    }

    _defineConverters() {
      const editor = this.editor;
      const conversion = editor.conversion;

      // VERTICAL ALIGNMENT CONVERTERS
      for (const alignment of ALIGNMENT_VALUES) {
        conversion.for('upcast').attributeToAttribute({
          view: {
            name: 'img',
            styles: {
              'vertical-align': alignment
            }
          },
          model: {
            key: 'imageVerticalAlign',
            value: alignment
          }
        });
      }

      conversion.for('downcast').attributeToAttribute({
        model: {
          name: 'imageInline',
          key: 'imageVerticalAlign',
          values: ALIGNMENT_VALUES
        },
        view: ALIGNMENT_VALUES.reduce((result, alignment) => {
          result[alignment] = {
            key: 'style',
            value: {
              'vertical-align': alignment
            }
          };
          return result;
        }, {})
      });

      conversion.for('downcast').add(dispatcher => {
        dispatcher.on('attribute:imageVerticalAlign:imageBlock', (evt, data, conversionApi) => {
          if (!conversionApi.consumable.consume(data.item, evt.name)) {
            return;
          }

          const viewWriter = conversionApi.writer;
          const figure = conversionApi.mapper.toViewElement(data.item);
          const img = figure.getChild(0);

          if (img && img.is('element', 'img')) {
            if (data.attributeNewValue) {
              viewWriter.setStyle('vertical-align', data.attributeNewValue, img);
            } else {
              viewWriter.removeStyle('vertical-align', img);
            }
          }
        });
      });

      // TOP OFFSET CONVERTERS
      // Upcast: HTML -> Model (read top style from img)
      conversion.for('upcast').add(dispatcher => {
        dispatcher.on('element:img', (evt, data, conversionApi) => {
          const viewElement = data.viewItem;
          const topValue = viewElement.getStyle('top');

          if (topValue && data.modelRange) {
            const modelElement = data.modelRange.start.nodeAfter;
            if (modelElement) {
              conversionApi.writer.setAttribute('imageTopOffset', topValue, modelElement);
            }
          }
        }, { priority: 'low' });
      });

      // Downcast: Model -> HTML for imageInline
      conversion.for('downcast').add(dispatcher => {
        dispatcher.on('attribute:imageTopOffset:imageInline', (evt, data, conversionApi) => {
          if (!conversionApi.consumable.consume(data.item, evt.name)) {
            return;
          }

          const viewWriter = conversionApi.writer;
          const img = conversionApi.mapper.toViewElement(data.item);

          if (img) {
            if (data.attributeNewValue) {
              viewWriter.setStyle('position', 'relative', img);
              viewWriter.setStyle('top', data.attributeNewValue, img);
            } else {
              viewWriter.removeStyle('position', img);
              viewWriter.removeStyle('top', img);
            }
          }
        });
      });

      // Downcast: Model -> HTML for imageBlock
      conversion.for('downcast').add(dispatcher => {
        dispatcher.on('attribute:imageTopOffset:imageBlock', (evt, data, conversionApi) => {
          if (!conversionApi.consumable.consume(data.item, evt.name)) {
            return;
          }

          const viewWriter = conversionApi.writer;
          const figure = conversionApi.mapper.toViewElement(data.item);
          const img = figure.getChild(0);

          if (img && img.is('element', 'img')) {
            if (data.attributeNewValue) {
              viewWriter.setStyle('position', 'relative', img);
              viewWriter.setStyle('top', data.attributeNewValue, img);
            } else {
              viewWriter.removeStyle('position', img);
              viewWriter.removeStyle('top', img);
            }
          }
        });
      });
    }

    _addDropdown() {
      const editor = this.editor;

      editor.ui.componentFactory.add('imageVerticalAlign', locale => {
        const dropdownView = createDropdown(locale);
        const items = new Collection();

        for (const alignment of ALIGNMENT_VALUES) {
          items.add({
            type: 'button',
            model: {
              commandName: `imageVerticalAlign:${alignment}`,
              label: alignment.charAt(0).toUpperCase() + alignment.slice(1),
              icon: icons[alignment],
              withText: true,
              role: 'menuitemradio'
            }
          });
        }

        addListToDropdown(dropdownView, items, {
          ariaLabel: 'Image vertical alignment',
          role: 'menu'
        });

        dropdownView.buttonView.set({
          label: 'Vertical Align',
          icon: icons.verticalAlign,
          tooltip: true
        });

        dropdownView.bind('isEnabled').toMany(
          ALIGNMENT_VALUES.map(a => editor.commands.get(`imageVerticalAlign:${a}`)),
          'isEnabled',
          (...enabledStates) => enabledStates.some(isEnabled => isEnabled)
        );

        this.listenTo(dropdownView, 'execute', evt => {
          const commandName = evt.source.commandName;
          if (commandName) {
            editor.execute(commandName);
            editor.editing.view.focus();
          }
        });

        return dropdownView;
      });
    }

    _addToolbarButtons() {
      const editor = this.editor;

      for (const alignment of ALIGNMENT_VALUES) {
        const componentName = `imageVerticalAlign:${alignment}`;

        editor.ui.componentFactory.add(componentName, locale => {
          const command = editor.commands.get(componentName);
          const buttonView = new ButtonView(locale);

          buttonView.set({
            label: `Align ${alignment}`,
            icon: icons[alignment],
            tooltip: true,
            isToggleable: true
          });

          buttonView.bind('isOn').to(command, 'value');
          buttonView.bind('isEnabled').to(command, 'isEnabled');

          this.listenTo(buttonView, 'execute', () => {
            editor.execute(componentName);
            editor.editing.view.focus();
          });

          return buttonView;
        });
      }
    }

    _addTopOffsetInput() {
      const editor = this.editor;

      editor.ui.componentFactory.add('imageTopOffset', locale => {
        const command = editor.commands.get('imageTopOffset');
        const inputView = new TopOffsetInputView(locale, command, editor);

        // Update input value when command value changes
        inputView.bind('value').to(command, 'value');
        inputView.bind('isEnabled').to(command, 'isEnabled');

        return inputView;
      });
    }
  }

  return ImageVerticalAlignPlugin;
}
