import { findNbspEdits } from '../utils/nbspCleanup.js';

const OBJECT_PLACEHOLDER = '\ufffc';

const ICON = '<svg viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">'
  + '<path d="M2.5 10.5v3.5h15v-3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>'
  + '<path d="M7.5 3l5 5m0-5l-5 5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>'
  + '</svg>';

/**
 * Factory function to create RemoveNbspPlugin with CKEditor from CDN.
 *
 * Adds a ``removeNbsp`` toolbar button that collapses ``&nbsp;`` padding (as
 * produced by OCR / pasted layouts) into normal spaces. With a selection it
 * cleans the selected blocks; otherwise every block in the current root.
 * @param {Object} CKEditor - CKEditor instance from CDN
 * @returns {Class} RemoveNbspPlugin class
 */
export default function createRemoveNbspPlugin(CKEditor) {
  const { Plugin, Command, ButtonView } = CKEditor;

  const blockText = (block) => {
    let text = '';
    for (const child of block.getChildren()) {
      text += child.is('$text') ? child.data : OBJECT_PLACEHOLDER;
    }
    return text;
  };

  class RemoveNbspCommand extends Command {
    refresh() {
      this.isEnabled = true;
    }

    execute() {
      const { model } = this.editor;
      const selection = model.document.selection;

      model.change((writer) => {
        for (const block of this._targetBlocks(selection)) {
          const edits = findNbspEdits(blockText(block));
          for (let i = edits.length - 1; i >= 0; i -= 1) {
            const { start, end, replacement } = edits[i];
            const attrs = replacement ? block.getChild(block.offsetToIndex(start)).getAttributes() : null;
            writer.remove(writer.createRange(
              writer.createPositionAt(block, start),
              writer.createPositionAt(block, end),
            ));
            if (replacement) {
              writer.insertText(replacement, attrs, writer.createPositionAt(block, start));
            }
          }
        }
      });
    }

    _targetBlocks(selection) {
      const { model } = this.editor;
      if (!selection.isCollapsed) {
        return [...selection.getSelectedBlocks()];
      }
      const position = selection.getFirstPosition();
      const root = position ? position.root : model.document.getRoot();
      const blocks = [];
      for (const { item } of model.createRangeIn(root)) {
        if (item.is('element') && model.schema.checkChild(item, '$text')) {
          blocks.push(item);
        }
      }
      return blocks;
    }
  }

  class RemoveNbspPlugin extends Plugin {
    static get pluginName() {
      return 'RemoveNbsp';
    }

    init() {
      const editor = this.editor;
      editor.commands.add('removeNbsp', new RemoveNbspCommand(editor));

      editor.ui.componentFactory.add('removeNbsp', (locale) => {
        const command = editor.commands.get('removeNbsp');
        const button = new ButtonView(locale);
        button.set({
          label: 'Remove extra spaces (&nbsp;) — selection, or the whole box',
          icon: ICON,
          tooltip: true,
        });
        button.bind('isEnabled').to(command, 'isEnabled');
        this.listenTo(button, 'execute', () => {
          editor.execute('removeNbsp');
          editor.editing.view.focus();
        });
        return button;
      });
    }
  }

  return RemoveNbspPlugin;
}
