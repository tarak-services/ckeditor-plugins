/**
 * Custom plugin that outputs alignment classes only for explicit user overrides.
 * The default alignment is handled purely via CSS (--default-text-alignment variable
 * in-editor, and base CSS rules for PDF/preview output), so paragraphs without
 * an alignment class inherit the contextual default.
 *
 * Existing content with explicit alignment classes (e.g. text-align-justify from
 * older editor behavior) is preserved and continues to render correctly.
 */
export default function createAlignmentDefaultPlugin(CKEditor) {
  const { Plugin } = CKEditor;

  return class AlignmentDefaultPlugin extends Plugin {
    static get pluginName() {
      return 'AlignmentDefaultPlugin';
    }

    static get requires() {
      return ['Alignment'];
    }

    _isInsideTableCell(block) {
      let parent = block.parent;
      while (parent) {
        if (parent.name === 'tableCell') return true;
        parent = parent.parent;
      }
      return false;
    }

    init() {
      const editor = this.editor;
      const locale = editor.locale;
      const ckeditorDefault = locale.contentLanguageDirection === 'rtl' ? 'right' : 'left';
      this._ckeditorDefault = ckeditorDefault;

      const alignmentConfig = editor.config.get('alignment.options') || [];
      const alignmentClassMap = {};

      for (const option of alignmentConfig) {
        if (typeof option === 'object' && option.name && option.className) {
          alignmentClassMap[option.name] = option.className;
        }
      }

      const defaultOption = alignmentConfig.find(
        o => typeof o === 'object' && o.name === ckeditorDefault && o.className
      );
      if (defaultOption) {
        editor.conversion.for('upcast').attributeToAttribute({
          view: { key: 'class', value: defaultOption.className },
          model: { key: 'alignment', value: ckeditorDefault }
        });
      }

      editor.conversion.for('downcast').add(dispatcher => {
        dispatcher.on('attribute:alignment', (evt, data, conversionApi) => {
          if (!conversionApi.consumable.consume(data.item, evt.name)) {
            return;
          }

          const viewElement = conversionApi.mapper.toViewElement(data.item);
          if (!viewElement) {
            return;
          }

          const writer = conversionApi.writer;

          for (const className of Object.values(alignmentClassMap)) {
            if (viewElement.hasClass(className)) {
              writer.removeClass(className, viewElement);
            }
          }

          const alignment = data.attributeNewValue;
          if (alignment && alignmentClassMap[alignment]) {
            writer.addClass(alignmentClassMap[alignment], viewElement);
          }
        }, { priority: 'high' });
      });
    }

    afterInit() {
      const editor = this.editor;
      const defaultAlignment = editor.config.get('alignment.defaultAlignment') || 'left';
      const ckeditorDefault = this._ckeditorDefault;
      const plugin = this;
      const alignmentCommand = editor.commands.get('alignment');

      if (!alignmentCommand) return;

      const originalRefresh = alignmentCommand.refresh.bind(alignmentCommand);
      alignmentCommand.refresh = function () {
        originalRefresh();
        if (!this.isEnabled) return;

        const firstBlock = editor.model.document.selection.getSelectedBlocks().next().value;
        if (firstBlock && !firstBlock.hasAttribute('alignment')) {
          this.value = plugin._isInsideTableCell(firstBlock) ? ckeditorDefault : defaultAlignment;
        }
      };

      alignmentCommand.execute = function (options = {}) {
        const { value } = options;

        editor.model.change(writer => {
          const blocks = Array.from(editor.model.document.selection.getSelectedBlocks())
            .filter(block => editor.model.schema.checkAttribute(block, 'alignment'));
          if (!blocks.length) return;

          const currentAlignment = blocks[0].getAttribute('alignment');
          const effectiveDefault = plugin._isInsideTableCell(blocks[0]) ? ckeditorDefault : defaultAlignment;
          const shouldRemove = value === effectiveDefault || currentAlignment === value || !value;

          for (const block of blocks) {
            if (shouldRemove) {
              writer.removeAttribute('alignment', block);
            } else {
              writer.setAttribute('alignment', value, block);
            }
          }
        });
      };
    }
  };
}
