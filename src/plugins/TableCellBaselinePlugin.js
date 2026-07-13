/**
 * Factory function to create TableCellBaselinePlugin with CKEditor from CDN
 *
 * This plugin adds a "baseline" vertical alignment option to the table cell
 * properties, which is not available in CKEditor's default options.
 *
 * @param {Object} CKEditor - CKEditor instance from CDN
 * @returns {Class} TableCellBaselinePlugin class
 */
export default function createTableCellBaselinePlugin(CKEditor) {
  const { Plugin, Command, ButtonView } = CKEditor;

  // Baseline icon SVG
  const baselineIcon = '<svg viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M3 17h14v1H3v-1z"/><path d="M5 3h2v11H5V3zm8 4h2v7h-2V7z"/></svg>';

  /**
   * Command to set vertical alignment to baseline
   */
  class TableCellBaselineCommand extends Command {
    refresh() {
      const editor = this.editor;
      const selection = editor.model.document.selection;
      const tableUtils = editor.plugins.get('TableUtils');

      // Get selected table cells
      const selectedCells = tableUtils ? tableUtils.getSelectionAffectedTableCells(selection) : [];

      this.isEnabled = selectedCells.length > 0;

      // Check if all selected cells have baseline alignment
      if (selectedCells.length > 0) {
        this.value = selectedCells.every(cell => {
          const verticalAlignment = cell.getAttribute('tableCellVerticalAlignment');
          return verticalAlignment === 'baseline';
        });
      } else {
        this.value = false;
      }
    }

    execute() {
      const editor = this.editor;
      const model = editor.model;
      const selection = model.document.selection;
      const tableUtils = editor.plugins.get('TableUtils');

      const selectedCells = tableUtils ? tableUtils.getSelectionAffectedTableCells(selection) : [];

      model.change(writer => {
        for (const cell of selectedCells) {
          const currentValue = cell.getAttribute('tableCellVerticalAlignment');

          if (currentValue === 'baseline') {
            // If already baseline, remove the attribute (toggle off)
            writer.removeAttribute('tableCellVerticalAlignment', cell);
          } else {
            // Set to baseline
            writer.setAttribute('tableCellVerticalAlignment', 'baseline', cell);
          }
        }
      });
    }
  }

  /**
   * Plugin to add baseline vertical alignment to table cells
   */
  class TableCellBaselinePlugin extends Plugin {
    static get pluginName() {
      return 'TableCellBaseline';
    }

    static get requires() {
      return ['TableCellPropertiesEditing'];
    }

    init() {
      const editor = this.editor;

      // Register the command
      editor.commands.add('tableCellVerticalAlignmentBaseline', new TableCellBaselineCommand(editor));

      // Add conversion for baseline
      this._defineConverters();

      // Override the built-in tableCellVerticalAlignment command to handle baseline
      this._extendVerticalAlignmentCommand();

      // Add the button to the UI
      editor.ui.componentFactory.add('tableCellVerticalAlignmentBaseline', locale => {
        const command = editor.commands.get('tableCellVerticalAlignmentBaseline');
        const buttonView = new ButtonView(locale);

        buttonView.set({
          label: 'Align cell text to baseline',
          icon: baselineIcon,
          tooltip: true,
          isToggleable: true
        });

        // Bind button state to command
        buttonView.bind('isOn').to(command, 'value');
        buttonView.bind('isEnabled').to(command, 'isEnabled');

        // Execute command on click
        this.listenTo(buttonView, 'execute', () => {
          editor.execute('tableCellVerticalAlignmentBaseline');
          editor.editing.view.focus();
        });

        return buttonView;
      });
    }

    /**
     * Extend the built-in tableCellVerticalAlignment command so that an
     * explicitly chosen alignment is ALWAYS serialized to the output HTML —
     * including 'middle', and including the 'baseline' -> other transitions.
     *
     * Why this is needed: CKEditor's built-in command drops any value that
     * equals the cell's internal default (see `_getValueToSet` -> removeAttribute
     * when value === defaultValue). For LAYOUT tables the hardcoded vertical
     * default is 'middle', so choosing "Align cell text to the middle" removes
     * the model attribute and NO `vertical-align` style is emitted in the data.
     * Downstream label styling then applies `table.layout-table td { vertical-align: top }`
     * (in both content-output.css for the preview and the print CSS for the PDF),
     * so a middle cell renders top-aligned. By writing the attribute directly we
     * force the downcast converter to emit `vertical-align: middle` as an inline
     * style, which overrides that class rule consistently in the editor, the
     * on-screen preview, and the exported PDF.
     */
    _extendVerticalAlignmentCommand() {
      const editor = this.editor;
      const verticalAlignmentCommand = editor.commands.get('tableCellVerticalAlignment');

      if (!verticalAlignmentCommand) {
        return;
      }

      // Store the original execute method
      const originalExecute = verticalAlignmentCommand.execute.bind(verticalAlignmentCommand);

      verticalAlignmentCommand.execute = function(options = {}) {
        const model = editor.model;
        const tableUtils = editor.plugins.get('TableUtils');
        const selection = model.document.selection;
        const selectedCells = tableUtils ? tableUtils.getSelectionAffectedTableCells(selection) : [];

        // Any explicit alignment ('top' | 'middle' | 'bottom' | 'baseline') is
        // written to every selected cell so it is never stripped as a default.
        // This also subsumes the previous 'baseline' -> value transition fix.
        if (options.value && selectedCells.length > 0) {
          model.change(writer => {
            for (const cell of selectedCells) {
              writer.setAttribute('tableCellVerticalAlignment', options.value, cell);
            }
          });
          return;
        }

        // No explicit value (reset/clear) — defer to the original behavior,
        // which removes the attribute.
        originalExecute(options);
      };
    }

    _defineConverters() {
      const editor = this.editor;
      const conversion = editor.conversion;

      // Upcast: HTML -> Model (reading from HTML)
      conversion.for('upcast').attributeToAttribute({
        view: {
          name: /^(td|th)$/,
          styles: {
            'vertical-align': 'baseline'
          }
        },
        model: {
          key: 'tableCellVerticalAlignment',
          value: 'baseline'
        }
      });

      // Downcast: Model -> HTML (writing to HTML)
      conversion.for('downcast').attributeToAttribute({
        model: {
          name: 'tableCell',
          key: 'tableCellVerticalAlignment',
          values: ['baseline']
        },
        view: {
          baseline: {
            key: 'style',
            value: {
              'vertical-align': 'baseline'
            }
          }
        }
      });
    }
  }

  return TableCellBaselinePlugin;
}
