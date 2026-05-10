/**
 * Factory function to create KeyboardShortcutsPlugin with CKEditor from CDN.
 *
 * Provides MS Word–style keyboard shortcuts for inserting common special
 * characters (NBSP, em dash, ellipsis, ©, ®, ™, …) at the caret, plus a
 * toolbar dropdown that lists every shortcut so users can discover and
 * remember them.
 *
 * `Ctrl+...` keystrokes are automatically interpreted as `Cmd+...` on macOS by
 * CKEditor's keystroke handler, and the dropdown shows the platform-correct
 * keystroke text (e.g. `⌘⇧Space` on macOS, `Ctrl+Shift+Space` elsewhere).
 *
 * NOTE: A few shortcuts (e.g. `Ctrl+Alt+C/R/T` on macOS) may collide with
 * browser shortcuts. Clicking the menu item still works in those cases.
 *
 * To add a new entry, append to CHARACTER_SHORTCUTS below. Every entry MUST
 * have a keystroke — this dropdown is a shortcut reference, not a symbol
 * picker.
 *
 * @param {Object} CKEditor - CKEditor instance from CDN
 * @returns {Class} KeyboardShortcutsPlugin class
 */
export default function createKeyboardShortcutsPlugin(CKEditor) {
  const { Plugin, Collection, ViewModel, createDropdown, addListToDropdown } = CKEditor;

  // Grouped list of character-insertion shortcuts.
  // - group:     section header used to insert a separator between groups
  // - label:     human-readable name shown in the dropdown
  // - text:      the literal string inserted at the caret
  // - keystroke: CKEditor keystroke string (Ctrl == Cmd on macOS)
  const CHARACTER_SHORTCUTS = [
    {
      group: 'Spacing & hyphens',
      label: 'Non-breaking space',
      text: '\u00A0',
      keystroke: 'Ctrl+Shift+Space'
    },
    {
      group: 'Spacing & hyphens',
      label: 'Zero-width space',
      text: '\u200B',
      keystroke: 'Ctrl+Alt+Z'
    },
    {
      group: 'Spacing & hyphens',
      label: 'Em space',
      text: '\u2003',
      keystroke: 'Ctrl+Alt+M'
    },
    {
      group: 'Spacing & hyphens',
      label: 'En space',
      text: '\u2002',
      keystroke: 'Ctrl+Alt+N'
    },
    {
      group: 'Spacing & hyphens',
      label: 'Thin space',
      text: '\u2009',
      keystroke: 'Ctrl+Alt+H'
    },
    {
      group: 'Spacing & hyphens',
      label: 'Figure space',
      text: '\u2007',
      keystroke: 'Ctrl+Alt+F'
    },
    {
      group: 'Spacing & hyphens',
      label: 'Zero-width joiner (ZWJ)',
      text: '\u200D',
      keystroke: 'Ctrl+Alt+J'
    },
    {
      group: 'Spacing & hyphens',
      label: 'Zero-width non-joiner (ZWNJ)',
      text: '\u200C',
      keystroke: 'Ctrl+Alt+X'
    },
    {
      group: 'Spacing & hyphens',
      label: 'Non-breaking hyphen',
      text: '\u2011',
      keystroke: 'Ctrl+Shift+-'
    },
    {
      group: 'Spacing & hyphens',
      label: 'Em dash',
      text: '\u2014',
      keystroke: 'Ctrl+Alt+-'
    },
    {
      group: 'Punctuation',
      label: 'Ellipsis',
      text: '\u2026',
      keystroke: 'Ctrl+Alt+.'
    },
    {
      group: 'Symbols',
      label: 'Copyright',
      text: '\u00A9',
      keystroke: 'Ctrl+Alt+C'
    },
    {
      group: 'Symbols',
      label: 'Registered',
      text: '\u00AE',
      keystroke: 'Ctrl+Alt+R'
    },
    {
      group: 'Symbols',
      label: 'Trademark',
      text: '\u2122',
      keystroke: 'Ctrl+Alt+T'
    }
  ];

  // Inline SVG: a small keyboard icon to signal "shortcuts".
  const TOOLBAR_ICON = '<svg viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M2 5h16a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm.5 1.5v7h15v-7h-15zM4 8h2v2H4V8zm3 0h2v2H7V8zm3 0h2v2h-2V8zm3 0h2v2h-2V8zM4 11h2v1.5H4V11zm3 0h6v1.5H7V11zm7 0h2v1.5h-2V11z"/></svg>';

  class KeyboardShortcutsPlugin extends Plugin {
    static get pluginName() {
      return 'KeyboardShortcuts';
    }

    init() {
      this._bindKeystrokes();
      this._registerToolbarDropdown();
    }

    /** Bind every shortcut to the editor's keystroke handler. */
    _bindKeystrokes() {
      const editor = this.editor;

      CHARACTER_SHORTCUTS.forEach(({ keystroke, text }) => {
        editor.keystrokes.set(
          keystroke,
          (evt, cancel) => {
            this._insertText(text);
            cancel();
          },
          // High priority so we win over the editor's default Space handler.
          { priority: 'high' }
        );
      });
    }

    /** Register a toolbar dropdown that lists every shortcut. */
    _registerToolbarDropdown() {
      const editor = this.editor;

      editor.ui.componentFactory.add('keyboardShortcuts', locale => {
        const dropdownView = createDropdown(locale);

        dropdownView.buttonView.set({
          label: 'Keyboard shortcuts',
          icon: TOOLBAR_ICON,
          tooltip: 'Character shortcuts',
          withText: false
        });

        dropdownView.panelPosition = 'sw';

        const items = new Collection();
        let lastGroup = null;

        CHARACTER_SHORTCUTS.forEach(shortcut => {
          if (shortcut.group && shortcut.group !== lastGroup) {
            if (lastGroup !== null) {
              items.add({ type: 'separator' });
            }
            lastGroup = shortcut.group;
          }

          // Prefix the visible character so users can preview what will be
          // inserted; CKEditor renders the keystroke on the right via
          // `withKeystroke`.
          const labelText = `${shortcut.text}\u2003${shortcut.label}`;

          const itemModel = new ViewModel({
            label: labelText,
            withText: true,
            withKeystroke: true,
            keystroke: shortcut.keystroke,
            // Stash the text on the model so the execute handler can read it.
            insertText: shortcut.text
          });

          items.add({ type: 'button', model: itemModel });
        });

        addListToDropdown(dropdownView, items);

        // Hide the auto-injected filter input — the list is short and grouped.
        dropdownView.on('change:isOpen', () => {
          if (dropdownView.isOpen && dropdownView.listView && dropdownView.listView.filterView) {
            dropdownView.listView.filterView.element.style.display = 'none';
          }
        });

        dropdownView.on('execute', evt => {
          const text = evt.source.insertText;
          if (text) {
            this._insertText(text);
            editor.editing.view.focus();
          }
        });

        dropdownView.set('class', 'ck-keyboard-shortcuts-dropdown');

        return dropdownView;
      });
    }

    /**
     * Insert text at the current caret, preserving the selection's text
     * attributes (font, size, bold, ...). Prefers the `insertText` command
     * (Typing plugin) for native attribute inheritance and undo grouping;
     * falls back to a direct model write if the command is unavailable.
     */
    _insertText(text) {
      const editor = this.editor;

      if (editor.isReadOnly) return;

      const insertTextCommand = editor.commands.get('insertText');
      if (insertTextCommand && insertTextCommand.isEnabled) {
        editor.execute('insertText', { text });
        return;
      }

      editor.model.change(writer => {
        const selection = editor.model.document.selection;
        const attributes = Object.fromEntries(selection.getAttributes());

        if (!selection.isCollapsed) {
          editor.model.deleteContent(selection);
        }

        const position = selection.getFirstPosition();
        if (position) {
          writer.insertText(text, attributes, position);
        }
      });
    }
  }

  return KeyboardShortcutsPlugin;
}
