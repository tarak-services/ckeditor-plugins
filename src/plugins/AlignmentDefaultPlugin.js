/**
 * Custom plugin that forces CKEditor to output alignment classes for ALL alignments,
 * including "left" which is normally considered the default and omitted.
 *
 * Reads the default alignment from editor config: `alignment.defaultAlignment`
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

      // Get the default alignment from config (fallback to 'left' if not set)
      const defaultAlignment = editor.config.get('alignment.defaultAlignment') || 'left';

      // Setup downcast conversion for alignment classes
      const alignmentConfig = editor.config.get('alignment.options') || [];
      const alignmentClassMap = {};

      for (const option of alignmentConfig) {
        if (typeof option === 'object' && option.name && option.className) {
          alignmentClassMap[option.name] = option.className;
        }
      }

      // Override downcast conversion to always output the class
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

          // Remove all alignment classes first
          for (const className of Object.values(alignmentClassMap)) {
            if (viewElement.hasClass(className)) {
              writer.removeClass(className, viewElement);
            }
          }

          // Add the new alignment class
          const alignment = data.attributeNewValue;
          if (alignment && alignmentClassMap[alignment]) {
            writer.addClass(alignmentClassMap[alignment], viewElement);
          }
        }, { priority: 'lowest' });
      });

      // Add a post-fixer to ensure all blocks (especially in tables) have explicit alignment
      editor.model.document.registerPostFixer(writer => {
        const changes = editor.model.document.differ.getChanges();
        let wasFixed = false;

        for (const change of changes) {
          if (change.type === 'insert') {
            const item = change.position.nodeAfter;
            if (item) {
              // Check the item itself and all its descendants
              const itemsToCheck = [item];
              if (item.is('element')) {
                for (const descendant of item.getChildren()) {
                  itemsToCheck.push(descendant);
                  if (descendant.is && descendant.is('element')) {
                    for (const child of descendant.getChildren()) {
                      itemsToCheck.push(child);
                    }
                  }
                }
              }

              for (const node of itemsToCheck) {
                if (node.is && node.is('element') &&
                    editor.model.schema.checkAttribute(node, 'alignment') &&
                    !node.hasAttribute('alignment')) {
                  writer.setAttribute('alignment', defaultAlignment, node);
                  wasFixed = true;
                }
              }
            }
          }
        }

        return wasFixed;
      });
    }

    afterInit() {
      const editor = this.editor;
      const alignmentCommand = editor.commands.get('alignment');

      if (!alignmentCommand) {
        console.warn('AlignmentDefaultPlugin: alignment command not found');
        return;
      }

      // Get the default alignment from config (fallback to 'left' if not set)
      const defaultAlignment = editor.config.get('alignment.defaultAlignment') || 'left';

      // Override execute to force explicit "left" alignment when left is clicked
      const originalExecute = alignmentCommand.execute.bind(alignmentCommand);
      alignmentCommand.execute = (options = {}) => {
        const { value } = options;
        originalExecute(options);

        // If alignment was set to left (or removed), explicitly set it
        if (value === 'left' || !value) {
          editor.model.change(writer => {
            const selection = editor.model.document.selection;
            const blocks = Array.from(selection.getSelectedBlocks());

            for (const block of blocks) {
              if (editor.model.schema.checkAttribute(block, 'alignment')) {
                writer.setAttribute('alignment', 'left', block);
              }
            }
          });
        }
      };
    }
  };
}
