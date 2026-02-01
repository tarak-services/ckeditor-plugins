/**
 * Factory function to create UnderlineOffsetPlugin with CKEditor from CDN
 * @param {Object} CKEditor - CKEditor instance from CDN
 * @returns {Class} UnderlineOffsetPlugin class
 */
export default function createUnderlineOffsetPlugin(CKEditor) {
  const { Plugin, Command } = CKEditor;
  const { Collection } = CKEditor;
  const { ViewModel, addListToDropdown, createDropdown } = CKEditor;

  /**
   * Custom Underline Offset plugin for CKEditor
   * Creates a dropdown to control text-underline-offset CSS property
   * Values range from 1 to 10 with step 0.5
   */
  class UnderlineOffsetPlugin extends Plugin {
    static get pluginName() {
      return 'UnderlineOffset';
    }

    init() {
      const editor = this.editor;

      // Generate underline offset options from 1 to 10 with step 0.5
      const defaultOptions = ['default'];
      for (let i = 1; i <= 10; i += 0.5) {
        defaultOptions.push(`${i}px`);
      }
      const options = editor.config.get('underlineOffset.options') || defaultOptions;

      // Define the underline offset command
      editor.commands.add('underlineOffset', new UnderlineOffsetCommand(editor));

      // Register the toolbar UI component
      editor.ui.componentFactory.add('underlineOffset', locale => {
        const dropdownView = createDropdown(locale);
        const command = editor.commands.get('underlineOffset');

        // Setup dropdown button - icon only
        dropdownView.buttonView.set({
          label: 'Underline Offset',
          tooltip: true,
          withText: false,
          icon: underlineOffsetIcon
        });

        // Bind the dropdown button to the command
        dropdownView.bind('isEnabled').to(command, 'isEnabled');

        // Populate the dropdown with options
        addListToDropdown(dropdownView, this._getUnderlineOffsetOptions(options, command));

        // Execute the command when an item is selected
        this.listenTo(dropdownView, 'execute', evt => {
          editor.execute('underlineOffset', { value: evt.source.commandParam });
          editor.editing.view.focus();
          dropdownView.isOpen = false;
        });

        return dropdownView;
      });

      // Allow underlineOffset in the schema
      editor.model.schema.extend('$text', { allowAttributes: 'underlineOffset' });
      editor.model.schema.setAttributeProperties('underlineOffset', {
        isFormatting: true,
        copyOnEnter: true
      });

      // Conversion from model to view (editing)
      editor.conversion.for('downcast').attributeToElement({
        model: 'underlineOffset',
        view: (underlineOffset, { writer }) => {
          if (!underlineOffset) return;
          return writer.createAttributeElement('span', {
            style: `text-underline-offset:${underlineOffset}`
          }, { priority: 7 });
        }
      });

      // Conversion from view to model (data)
      editor.conversion.for('upcast').elementToAttribute({
        view: {
          name: 'span',
          styles: {
            'text-underline-offset': /.*/
          }
        },
        model: {
          key: 'underlineOffset',
          value: viewElement => {
            const underlineOffset = viewElement.getStyle('text-underline-offset');
            return underlineOffset;
          }
        }
      });
    }

    _getUnderlineOffsetOptions(options, command) {
      const itemDefinitions = new Collection();

      for (const option of options) {
        const def = {
          type: 'button',
          model: new ViewModel({
            commandParam: option === 'default' ? null : option,
            label: option === 'default' ? 'Default' : option,
            class: 'ck-underline-offset-option',
            withText: true
          })
        };

        if (option !== 'default') {
          def.model.bind('isOn').to(command, 'value', value => value === option);
        }

        itemDefinitions.add(def);
      }

      return itemDefinitions;
    }
  }

  /**
   * Underline Offset Command
   */
  class UnderlineOffsetCommand extends Command {
    refresh() {
      const model = this.editor.model;
      const selection = model.document.selection;

      this.isEnabled = model.schema.checkAttributeInSelection(selection, 'underlineOffset');
      this.value = selection.getAttribute('underlineOffset');
    }

    execute(options = {}) {
      const model = this.editor.model;
      const selection = model.document.selection;
      const value = options.value;

      model.change(writer => {
        if (selection.isCollapsed) {
          if (value) {
            writer.setSelectionAttribute('underlineOffset', value);
            // Also add underline if not already present
            if (!selection.hasAttribute('underline')) {
              writer.setSelectionAttribute('underline', true);
            }
          } else {
            writer.removeSelectionAttribute('underlineOffset');
          }
        } else {
          const ranges = model.schema.getValidRanges(selection.getRanges(), 'underlineOffset');

          for (const range of ranges) {
            if (value) {
              writer.setAttribute('underlineOffset', value, range);
              // Also add underline if not already present
              writer.setAttribute('underline', true, range);
            } else {
              writer.removeAttribute('underlineOffset', range);
            }
          }
        }
      });
    }
  }

  // Underline offset icon - clean U with offset indicator
  const underlineOffsetIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
    <path d="M5 2.5v7c0 2.5 2 4.5 5 4.5s5-2 5-4.5v-7h-2v7c0 1.4-1.3 2.5-3 2.5s-3-1.1-3-2.5v-7H5z"/>
    <path d="M3 18.5h14" stroke="currentColor" stroke-width="1.5" fill="none"/>
    <path d="M10 14.5v2" stroke="currentColor" stroke-width="1" stroke-dasharray="1,1" fill="none" opacity="0.6"/>
  </svg>`;

  return UnderlineOffsetPlugin;
}
