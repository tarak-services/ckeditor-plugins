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

    init() {
      const editor = this.editor;

      const alignmentConfig = editor.config.get('alignment.options') || [];
      const alignmentClassMap = {};

      for (const option of alignmentConfig) {
        if (typeof option === 'object' && option.name && option.className) {
          alignmentClassMap[option.name] = option.className;
        }
      }

      editor.conversion.for('downcast').add(dispatcher => {
        dispatcher.on('attribute:alignment', (evt, data, conversionApi) => {
          if (!conversionApi.consumable.test(data.item, evt.name)) {
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
        }, { priority: 'lowest' });
      });
    }

    afterInit() {
      const editor = this.editor;
      const defaultAlignment = editor.config.get('alignment.defaultAlignment') || 'left';
      const alignmentCommand = editor.commands.get('alignment');

      if (!alignmentCommand) return;

      const originalRefresh = alignmentCommand.refresh.bind(alignmentCommand);
      alignmentCommand.refresh = function () {
        originalRefresh();
        if (!this.isEnabled) return;

        const firstBlock = editor.model.document.selection.getSelectedBlocks().next().value;
        if (firstBlock && !firstBlock.hasAttribute('alignment')) {
          this.value = defaultAlignment;
        }
      };

      alignmentCommand.execute = function (options = {}) {
        const { value } = options;

        editor.model.change(writer => {
          const blocks = Array.from(editor.model.document.selection.getSelectedBlocks())
            .filter(block => editor.model.schema.checkAttribute(block, 'alignment'));
          if (!blocks.length) return;

          const currentAlignment = blocks[0].getAttribute('alignment');
          const shouldRemove = value === defaultAlignment || currentAlignment === value || !value;

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
