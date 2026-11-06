import { addSearchToPanel, filterListItems, clearSearch, markPanel } from '../utils/dropdownSearchUtils.js';

/**
 * Factory function to create LineHeightPlugin with CKEditor from CDN
 * @param {Object} CKEditor - CKEditor instance from CDN
 * @returns {Class} LineHeightPlugin class
 */
export default function createLineHeightPlugin(CKEditor) {
  const { Plugin, Command } = CKEditor;
  const { Collection, priorities } = CKEditor;
  const { ViewModel, addListToDropdown, createDropdown } = CKEditor;

  const BLOCK_ATTR = 'blockLineHeight';
  const MARKER_CLASS = 'custom-line-height';

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

    // Line height lives on the block: a span's line-height cannot shrink the
    // line box below the parent <p>'s, so a span-only value can only grow lines.
    // The marker class lets setmaker tell these apart from pasted (Word) p
    // line-heights, which it strips before rendering.
    editor.model.schema.extend('$block', { allowAttributes: BLOCK_ATTR });
    editor.model.schema.setAttributeProperties(BLOCK_ATTR, { isFormatting: true });

    editor.conversion.for('downcast').add(dispatcher => {
      dispatcher.on(`attribute:${BLOCK_ATTR}`, (evt, data, conversionApi) => {
        if (!conversionApi.consumable.consume(data.item, evt.name)) return;
        const viewElement = conversionApi.mapper.toViewElement(data.item);
        if (!viewElement) return;
        const { writer } = conversionApi;
        if (data.attributeNewValue) {
          writer.setStyle('line-height', data.attributeNewValue, viewElement);
          writer.addClass(MARKER_CLASS, viewElement);
        } else {
          writer.removeStyle('line-height', viewElement);
          writer.removeClass(MARKER_CLASS, viewElement);
        }
      });
    });

    // Must run before GeneralHtmlSupport (also 'low'), which would otherwise
    // consume the style and class into htmlPAttributes.
    editor.conversion.for('upcast').attributeToAttribute({
      view: {
        classes: MARKER_CLASS,
        styles: { 'line-height': /[\s\S]+/ }
      },
      model: {
        key: BLOCK_ATTR,
        value: viewElement => viewElement.getStyle('line-height')
      },
      converterPriority: priorities.low + 1
    });

    // Legacy: older content stores line height on <span>s. Keep round-tripping
    // it; the command clears it from blocks it touches.
    editor.model.schema.extend('$text', { allowAttributes: 'lineHeight' });
    editor.model.schema.setAttributeProperties('lineHeight', {
      isFormatting: true,
      copyOnEnter: true
    });

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
      const blocks = this._getBlocks();
      this.isEnabled = blocks.length > 0;
      this.value = blocks.length ? blocks[0].getAttribute(BLOCK_ATTR) : undefined;
    }

    execute(options = {}) {
      const model = this.editor.model;
      const value = options.value;

      model.change(writer => {
        writer.removeSelectionAttribute('lineHeight');

        for (const block of this._getBlocks()) {
          if (value) {
            writer.setAttribute(BLOCK_ATTR, value, block);
          } else {
            writer.removeAttribute(BLOCK_ATTR, block);
          }
          writer.removeAttribute('lineHeight', writer.createRangeIn(block));
          removeGhsLineHeight(writer, block);
        }
      });
    }

    _getBlocks() {
      const model = this.editor.model;
      return Array.from(model.document.selection.getSelectedBlocks())
        .filter(block => model.schema.checkAttribute(block, BLOCK_ATTR));
    }
  }

  // Pasted content can carry its own line-height in GHS attributes
  // (e.g. htmlPAttributes.styles), which would fight ours in the downcast.
  function removeGhsLineHeight(writer, block) {
    for (const [key, attrValue] of block.getAttributes()) {
      if (!/^html.*Attributes$/.test(key) || !attrValue?.styles?.['line-height']) continue;

      const { 'line-height': _removed, ...styles } = attrValue.styles;
      const next = { ...attrValue };
      if (Object.keys(styles).length) {
        next.styles = styles;
      } else {
        delete next.styles;
      }

      if (Object.keys(next).length) {
        writer.setAttribute(key, next, block);
      } else {
        writer.removeAttribute(key, block);
      }
    }
  }

  // Simple line height icon (three horizontal lines with spacing)
  const lineHeightIcon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M2 3h16v2H2V3zm0 6h16v2H2V9zm0 6h16v2H2v-2z"/><path d="M1 2h1v16H1V2z"/></svg>';

  return LineHeightPlugin;
}
