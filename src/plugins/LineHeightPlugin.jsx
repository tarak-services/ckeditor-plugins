import { addSearchToPanel, filterListItems, clearSearch, markPanel } from '../utils/dropdownSearchUtils.js';

/**
 * Factory function to create LineHeightPlugin with CKEditor from CDN
 * @param {Object} CKEditor - CKEditor instance from CDN
 * @returns {Class} LineHeightPlugin class
 */
export default function createLineHeightPlugin(CKEditor) {
  const { Plugin, Command } = CKEditor;
  const { Collection } = CKEditor;
  const { ViewModel, addListToDropdown, createDropdown } = CKEditor;

  /**
   * Custom Line Height plugin for CKEditor
   * Creates a dropdown to control line-height CSS property with built-in search
   */
  class LineHeightPlugin extends Plugin {
  static get pluginName() {
    return 'LineHeight';
  }

  init() {
    const editor = this.editor;

    const defaultOptions = [];
    for (let i = 12; i <= 30; i += 0.5) {
      defaultOptions.push(`${i}pt`);
    }
    const options = editor.config.get('lineHeight.options') || defaultOptions;

    // Define the line height command
    editor.commands.add('lineHeight', new LineHeightCommand(editor));

    // Register the toolbar UI component
    editor.ui.componentFactory.add('lineHeight', locale => {
      const dropdownView = createDropdown(locale);
      const command = editor.commands.get('lineHeight');

      // Setup dropdown button
      dropdownView.buttonView.set({
        label: 'Line Height',
        tooltip: true,
        withText: true,
        icon: lineHeightIcon
      });

      // Bind the dropdown button to the command
      dropdownView.bind('isEnabled').to(command, 'isEnabled');

      // Get default line height from config
      const fontDefaults = editor.config.get('fontDefaults') || {};
      const defaultLineHeight = fontDefaults.lineHeight;

      // Update button label to show current value or default
      dropdownView.buttonView.bind('label').to(command, 'value', value => {
        const displayValue = value || defaultLineHeight;
        if (!displayValue) {
          return 'Line Height';
        }
        // Ensure it has 'pt' suffix
        const sizeStr = String(displayValue);
        return sizeStr.endsWith('pt') ? sizeStr : `${sizeStr}pt`;
      });

      // Populate the dropdown with options
      addListToDropdown(dropdownView, this._getLineHeightOptions(options, command));

      // Execute the command when an item is selected
      this.listenTo(dropdownView, 'execute', evt => {
        editor.execute('lineHeight', { value: evt.source.commandParam });
        editor.editing.view.focus();
        dropdownView.isOpen = false;
      });

      // Add search functionality using helper
      this._setupSearchForDropdown(dropdownView);

      // Add custom class for CSS targeting - set it on the view so CKEditor adds it to the element
      dropdownView.set('class', 'ck-line-height-dropdown');

      return dropdownView;
    });

    // Allow line-height in the schema
    editor.model.schema.extend('$text', { allowAttributes: 'lineHeight' });
    editor.model.schema.setAttributeProperties('lineHeight', {
      isFormatting: true,
      copyOnEnter: true
    });

    // Conversion from model to view (editing)
    editor.conversion.for('downcast').attributeToElement({
      model: 'lineHeight',
      view: (lineHeight, { writer }) => {
        if (!lineHeight) return;
        return writer.createAttributeElement('span', {
          style: `line-height:${lineHeight}`
        }, { priority: 7 });
      }
    });

    // Conversion from view to model (data)
    editor.conversion.for('upcast').elementToAttribute({
      view: {
        name: 'span',
        styles: {
          'line-height': /.*/
        }
      },
      model: {
        key: 'lineHeight',
        value: viewElement => {
          const lineHeight = viewElement.getStyle('line-height');
          return lineHeight;
        }
      }
    });
  }

  _getLineHeightOptions(options, command) {
    const itemDefinitions = new Collection();

    for (const option of options) {
      const def = {
        type: 'button',
        model: new ViewModel({
          commandParam: option === 'default' ? null : option,
          label: option === 'default' ? 'Default' : option,
          class: 'ck-line-height-option',
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

  /**
   * Setup search functionality for the dropdown
   * Reuses common search patterns
   */
  _setupSearchForDropdown(dropdownView) {
    const searchConfig = {
      inputClass: 'ck-line-height-search-input',
      wrapperClass: 'ck-line-height-search-wrapper',
      panelClass: 'ck-line-height-with-search',
      placeholder: 'Search line heights...',
      maxHeight: '250px',
      searchBarHeight: '42px',
      autoFocus: true
    };

    // Mark and add search when it opens
    dropdownView.on('change:isOpen', (evt, data, isOpen) => {
      if (isOpen) {
        // Try immediately and with delays to ensure the panel is ready
        const tryAddSearch = () => {
          if (dropdownView.panelView?.element) {
            this._markAndAddSearch(dropdownView.panelView.element, searchConfig);
          }
        };

        tryAddSearch();
      } else {
        // Clear search when dropdown closes
        this._clearSearch(dropdownView.panelView?.element, searchConfig.inputClass);
      }
    });
  }

  _markAndAddSearch(panelElement, config) {
    // Mark as line-height dropdown to prevent other plugins from adding search
    markPanel(panelElement, 'data-ck-line-height-dropdown', 'ck-line-height-dropdown');

    // Add search input using shared utility
    addSearchToPanel(panelElement, config, (term) => {
      filterListItems(panelElement, term);
    });
  }

  _clearSearch(panelElement, inputClass) {
    clearSearch(panelElement, inputClass);
  }
  }

  /**
   * Line Height Command
   */
  class LineHeightCommand extends Command {
    refresh() {
      const model = this.editor.model;
      const selection = model.document.selection;

      this.isEnabled = model.schema.checkAttributeInSelection(selection, 'lineHeight');
      this.value = selection.getAttribute('lineHeight');
    }

    execute(options = {}) {
      const model = this.editor.model;
      const selection = model.document.selection;
      const value = options.value;

      model.change(writer => {
        if (selection.isCollapsed) {
          if (value) {
            writer.setSelectionAttribute('lineHeight', value);
          } else {
            writer.removeSelectionAttribute('lineHeight');
          }
        } else {
          const ranges = model.schema.getValidRanges(selection.getRanges(), 'lineHeight');

          for (const range of ranges) {
            if (value) {
              writer.setAttribute('lineHeight', value, range);
            } else {
              writer.removeAttribute('lineHeight', range);
            }
          }
        }
      });
    }
  }

  // Simple line height icon (three horizontal lines with spacing)
  const lineHeightIcon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M2 3h16v2H2V3zm0 6h16v2H2V9zm0 6h16v2H2v-2z"/><path d="M1 2h1v16H1V2z"/></svg>';

  return LineHeightPlugin;
}
