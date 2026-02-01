/**
 * Factory function to create TableStylePlugin with CKEditor from CDN
 * Provides quick table styling options in a dropdown
 * @param {Object} CKEditor - CKEditor instance from CDN
 * @returns {Class} TableStylePlugin class
 */
export default function createTableBorderPlugin(CKEditor) {

  const { Plugin } = CKEditor;
  const { createDropdown } = CKEditor;
  const { ButtonView } = CKEditor;
  const { ListView, ListItemView } = CKEditor;

  class TableStylePlugin extends Plugin {
    static get pluginName() {
      return 'TableStyle';
    }

    init() {
      const editor = this.editor;
      const plugin = this;

      // Default border style for new table cells (only used when table already has borders)
      const defaultCellBorder = '1px dashed #000';

      // Register custom attributes on schema
      editor.model.schema.extend('table', {
        allowAttributes: ['customTableStyle']
      });
      editor.model.schema.extend('tableCell', {
        allowAttributes: ['customCellStyle']
      });

      // Helper function to check if a cell has any border style
      const cellHasBorder = (cell) => {
        const styles = cell.getAttribute('customCellStyle');
        if (!styles) return false;

        return !!(styles.border ||
                  styles['border-top'] ||
                  styles['border-bottom'] ||
                  styles['border-left'] ||
                  styles['border-right']);
      };

      // Helper function to check if a table has any cells with borders
      const tableHasBorders = (table) => {
        if (!table) return false;

        for (const row of table.getChildren()) {
          if (row.is('element', 'tableRow')) {
            for (const cell of row.getChildren()) {
              if (cell.is('element', 'tableCell') && cellHasBorder(cell)) {
                return true;
              }
            }
          }
        }
        return false;
      };

      // Add post-fixer to set default dashed border on new table cells
      // Only applies if the table already has borders on existing cells
      editor.model.document.registerPostFixer(writer => {
        const changes = editor.model.document.differ.getChanges();
        let wasFixed = false;

        for (const change of changes) {
          if (change.type === 'insert' && change.name === 'tableCell') {
            const position = change.position;
            const tableCell = position.nodeAfter;

            if (tableCell && tableCell.is('element', 'tableCell')) {
              // Only set if not already set
              if (!tableCell.hasAttribute('customCellStyle')) {
                // Find the parent table and check if it has borders
                const tableRow = tableCell.parent;
                const table = tableRow?.parent;

                // Only add default border if the table already has borders on other cells
                if (tableHasBorders(table)) {
                  writer.setAttribute('customCellStyle', { border: defaultCellBorder }, tableCell);
                  wasFixed = true;
                }
              }
            }
          }
        }

        return wasFixed;
      });

      // Add downcast converter for table style
      editor.conversion.for('downcast').add(dispatcher => {
        dispatcher.on('attribute:customTableStyle:table', (evt, data, conversionApi) => {
          if (!conversionApi.consumable.consume(data.item, evt.name)) {
            return;
          }
          const viewWriter = conversionApi.writer;
          const tableView = conversionApi.mapper.toViewElement(data.item);

          if (tableView) {
            // First, remove old styles if they exist
            if (data.attributeOldValue) {
              Object.keys(data.attributeOldValue).forEach(key => {
                viewWriter.removeStyle(key, tableView);
              });
            }
            // Then, apply new styles if they exist
            if (data.attributeNewValue) {
              Object.keys(data.attributeNewValue).forEach(key => {
                viewWriter.setStyle(key, data.attributeNewValue[key], tableView);
              });
            }
          }
        });
      });

      // Add downcast converter for cell style
      editor.conversion.for('downcast').add(dispatcher => {
        dispatcher.on('attribute:customCellStyle:tableCell', (evt, data, conversionApi) => {
          if (!conversionApi.consumable.consume(data.item, evt.name)) {
            return;
          }
          const viewWriter = conversionApi.writer;
          const cellView = conversionApi.mapper.toViewElement(data.item);

          if (cellView) {
            // First, remove old styles if they exist
            if (data.attributeOldValue) {
              Object.keys(data.attributeOldValue).forEach(key => {
                viewWriter.removeStyle(key, cellView);
              });
            }
            // Then, apply new styles if they exist
            if (data.attributeNewValue) {
              Object.keys(data.attributeNewValue).forEach(key => {
                viewWriter.setStyle(key, data.attributeNewValue[key], cellView);
              });
            }
          }
        });
      });

      // Add upcast converter for table style (to load from HTML)
      editor.conversion.for('upcast').add(dispatcher => {
        dispatcher.on('element:table', (evt, data, conversionApi) => {
          const viewTable = data.viewItem;
          const styles = {};

          // Capture all relevant styles to ensure round-trip consistency
          const styleProps = ['width', 'border', 'border-collapse'];
          styleProps.forEach(prop => {
            if (viewTable.hasStyle(prop)) {
              styles[prop] = viewTable.getStyle(prop);
            }
          });

          if (Object.keys(styles).length > 0 && data.modelRange) {
            const modelTable = data.modelRange.start.nodeAfter;
            if (modelTable) {
              conversionApi.writer.setAttribute('customTableStyle', styles, modelTable);
            }
          }
        }, { priority: 'low' });
      });

      // Add upcast converter for cell style (to load from HTML)
      editor.conversion.for('upcast').add(dispatcher => {
        dispatcher.on('element:td', (evt, data, conversionApi) => {
          this._upcastCellStyles(data, conversionApi);
        }, { priority: 'low' });

        dispatcher.on('element:th', (evt, data, conversionApi) => {
          this._upcastCellStyles(data, conversionApi);
        }, { priority: 'low' });
      });

      // Create a single dropdown with all table style options
      editor.ui.componentFactory.add('tableStyles', locale => {
        const dropdownView = createDropdown(locale);

        dropdownView.buttonView.set({
          label: 'Table Styles',
          icon: this._getTableIcon(),
          tooltip: true,
          withText: false
        });

        // Store the current table when dropdown opens
        let currentTable = null;
        dropdownView.on('change:isOpen', () => {
          if (dropdownView.isOpen) {
            console.log('Dropdown opened, capturing table reference');
            const selection = editor.model.document.selection;
            const tableCell = selection.getFirstPosition()?.findAncestor('tableCell');
            if (tableCell) {
              currentTable = tableCell.findAncestor('table');
              console.log('Table captured:', currentTable ? 'yes' : 'no');
            } else {
              currentTable = null;
              console.log('No table cell found');
            }
          }
        });

        // Create list view for dropdown panel
        const listView = new ListView(locale);

        // Define menu items
        const menuItems = [
          { label: '📏 Width: 100%', action: () => plugin._setTableStyleOnTable(currentTable, 'width', '100%') },
          { label: '📏 Width: 50%', action: () => plugin._setTableStyleOnTable(currentTable, 'width', '50%') },
          { label: '📏 Width: Auto', action: () => plugin._setTableStyleOnTable(currentTable, 'width', 'auto') },
          { label: '⬆️ Top Border', action: () => plugin._addRowBorderOnTable(currentTable, 'top') },
          { label: '⬇️ Bottom Border', action: () => plugin._addRowBorderOnTable(currentTable, 'bottom') },
          { label: '🔲 Border All Cells', action: () => plugin._addBorderAllCellsOnTable(currentTable) },
          { label: '🚫 Remove All Borders', action: () => plugin._removeAllBordersOnTable(currentTable) }
        ];

        // Create buttons for each menu item
        menuItems.forEach(item => {
          const listItemView = new ListItemView(locale);
          const buttonView = new ButtonView(locale);

          buttonView.set({
            label: item.label,
            withText: true
          });

          buttonView.on('execute', () => {
            if (currentTable) {
              item.action();
            } else {
              console.warn('No table available - click inside a table first');
            }
            dropdownView.isOpen = false;
          });

          listItemView.children.add(buttonView);
          listView.items.add(listItemView);
        });

        dropdownView.panelView.children.add(listView);

        return dropdownView;
      });

    }

    _setTableStyleOnTable(table, property, value) {
      const editor = this.editor;

      if (!table) {
        console.warn('No table provided');
        return;
      }

      console.log('Setting table style:', property, value);

      // Update model with custom attribute - this triggers the downcast converter
      editor.model.change(writer => {
        const currentStyles = table.getAttribute('customTableStyle') || {};
        const newStyles = { ...currentStyles };

        if (newStyles[property] === value) {
          // Toggle off
          delete newStyles[property];
          console.log('Removing style:', property);
        } else {
          // Set new value
          newStyles[property] = value;
          console.log('Setting style:', property, '=', value);
        }

        if (Object.keys(newStyles).length === 0) {
          writer.removeAttribute('customTableStyle', table);
        } else {
          writer.setAttribute('customTableStyle', newStyles, table);
        }

        console.log('Updated customTableStyle:', newStyles);
      });
    }

    _addRowBorderOnTable(table, position) {
      const editor = this.editor;

      if (!table) {
        console.warn('No table provided');
        return;
      }

      console.log('Adding border to', position, 'row');

      const rows = Array.from(table.getChildren());
      const targetRow = position === 'top' ? rows[0] : rows[rows.length - 1];

      if (!targetRow) {
        console.warn('Could not find target row');
        return;
      }

      const cells = Array.from(targetRow.getChildren());
      const borderProp = `border-${position}`;
      const borderValue = '1px solid #000';

      // Check if first cell has border
      const firstCellStyles = cells[0].getAttribute('customCellStyle') || {};
      const hasBorder = firstCellStyles[borderProp] === borderValue;

      console.log(`${hasBorder ? 'Removing' : 'Adding'} border on ${cells.length} cells`);

      // Update model - this triggers the downcast converter
      editor.model.change(writer => {
        cells.forEach(cell => {
          const currentStyles = cell.getAttribute('customCellStyle') || {};
          const newStyles = { ...currentStyles };

          if (hasBorder) {
            delete newStyles[borderProp];
          } else {
            newStyles[borderProp] = borderValue;
          }

          if (Object.keys(newStyles).length === 0) {
            writer.removeAttribute('customCellStyle', cell);
          } else {
            writer.setAttribute('customCellStyle', newStyles, cell);
          }
        });
      });
    }

    _addBorderAllCellsOnTable(table) {
      const editor = this.editor;

      if (!table) {
        console.warn('No table provided');
        return;
      }

      console.log('Adding borders to all cells');

      const rows = Array.from(table.getChildren());
      const borderValue = '1px solid #000';

      // Update model - this triggers the downcast converter
      editor.model.change(writer => {
        rows.forEach(row => {
          const cells = Array.from(row.getChildren());
          cells.forEach(cell => {
            const currentStyles = cell.getAttribute('customCellStyle') || {};
            const newStyles = {
              ...currentStyles,
              border: borderValue
            };
            writer.setAttribute('customCellStyle', newStyles, cell);
          });
        });

        console.log('Added borders to all cells in', rows.length, 'rows');
      });
    }

    _removeAllBordersOnTable(table) {
      const editor = this.editor;

      if (!table) {
        console.warn('No table provided');
        return;
      }

      console.log('Removing all borders from table');

      const rows = Array.from(table.getChildren());

      // Update model - this triggers the downcast converter
      editor.model.change(writer => {
        rows.forEach(row => {
          const cells = Array.from(row.getChildren());

          cells.forEach(cell => {
            const currentStyles = cell.getAttribute('customCellStyle') || {};
            const newStyles = { ...currentStyles };

            // Remove all border-related styles
            delete newStyles.border;
            delete newStyles['border-top'];
            delete newStyles['border-bottom'];
            delete newStyles['border-left'];
            delete newStyles['border-right'];

            if (Object.keys(newStyles).length === 0) {
              writer.removeAttribute('customCellStyle', cell);
            } else {
              writer.setAttribute('customCellStyle', newStyles, cell);
            }
          });
        });

        console.log('Removed borders from all cells');
      });
    }

    _upcastCellStyles(data, conversionApi) {
      const viewCell = data.viewItem;
      const styles = {};

      // Capture all border-related styles to ensure round-trip consistency
      const styleProps = [
        'border', 'border-top', 'border-bottom', 'border-left', 'border-right',
        'border-width', 'border-style', 'border-color',
        'padding', 'background-color', 'text-align', 'vertical-align'
      ];

      styleProps.forEach(prop => {
        if (viewCell.hasStyle(prop)) {
          styles[prop] = viewCell.getStyle(prop);
        }
      });

      if (Object.keys(styles).length > 0 && data.modelRange) {
        const modelCell = data.modelRange.start.nodeAfter;
        if (modelCell && modelCell.is('element', 'tableCell')) {
          conversionApi.writer.setAttribute('customCellStyle', styles, modelCell);
        }
      }
    }

    _getTableIcon() {
      return `<svg viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
        <rect x="2" y="2" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5"/>
        <line x1="2" y1="7" x2="18" y2="7" stroke="currentColor" stroke-width="1.5"/>
        <line x1="10" y1="2" x2="10" y2="18" stroke="currentColor" stroke-width="1.5"/>
      </svg>`;
    }
  }

  return TableStylePlugin;
}
