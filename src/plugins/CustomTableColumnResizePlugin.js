/**
 * Custom Table Column Resize Plugin
 *
 * Replaces CKEditor's TableColumnResize to allow unlimited column resizing
 * without minimum width constraints.
 *
 * @param {Object} CKEditor - CKEditor instance from CDN
 * @returns {Class} CustomTableColumnResizePlugin class
 */
export default function createCustomTableColumnResizePlugin(CKEditor) {
  const { Plugin } = CKEditor;

  const OVERLAY_ID = 'custom-table-resize-overlay-shared';
  let globalListenersSetup = false;

  class CustomTableColumnResizePlugin extends Plugin {
    static get pluginName() {
      return 'CustomTableColumnResize';
    }

    init() {
      const editor = this.editor;

      this._resizeState = null;
      this._initialized = false;

      this._onMouseDown = this._onMouseDown.bind(this);
      this._onMouseMove = this._onMouseMove.bind(this);
      this._onMouseUp = this._onMouseUp.bind(this);
      this._updateOverlay = this._updateOverlay.bind(this);
      this._onDoubleClick = this._onDoubleClick.bind(this);

      this._registerConverters();

      editor.on('ready', () => {
        this._ensureOverlayContainer();
        this._setupGlobalListeners();
        this._initialized = true;
        setTimeout(() => this._updateOverlay(), 200);
      });

      editor.editing.view.document.on('layoutChanged', () => {
        if (this._initialized) {
          setTimeout(() => this._updateOverlay(), 100);
        }
      });

      editor.model.document.on('change:data', () => {
        if (this._initialized) {
          setTimeout(() => this._updateOverlay(), 150);
        }
      });
    }

    destroy() {
      this._removeGlobalListeners();
      super.destroy();
    }

    _ensureOverlayContainer() {
      let container = document.getElementById(OVERLAY_ID);

      if (!container) {
        container = document.createElement('div');
        container.id = OVERLAY_ID;
        container.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          z-index: 99999;
        `;
        document.body.appendChild(container);
      }

      this._overlayContainer = container;
    }

    _setupGlobalListeners() {
      if (!globalListenersSetup) {
        window.addEventListener('scroll', () => this._updateOverlay(), true);
        window.addEventListener('resize', () => this._updateOverlay());
        globalListenersSetup = true;
      }

      document.addEventListener('mousemove', this._onMouseMove);
      document.addEventListener('mouseup', this._onMouseUp);
    }

    _removeGlobalListeners() {
      document.removeEventListener('mousemove', this._onMouseMove);
      document.removeEventListener('mouseup', this._onMouseUp);
    }

    _updateOverlay() {
      if (!this._overlayContainer) return;

      // Don't update during resize operation - prevents focus issues
      if (this._resizeState) return;

      // Don't update during input popover interaction
      if (this._inputPopover) return;

      this._overlayContainer.innerHTML = '';
      const processedTables = new Set();

      const editables = document.querySelectorAll('.ck-editor__editable');
      editables.forEach(editable => {
        const tables = editable.querySelectorAll('table');
        tables.forEach(table => {
          if (!table.dataset.resizeId) {
            table.dataset.resizeId = 'table-' + Math.random().toString(36).substr(2, 9);
          }

          if (processedTables.has(table.dataset.resizeId)) return;
          processedTables.add(table.dataset.resizeId);

          this._createHandlesForTable(table);
        });
      });
    }

    _createHandlesForTable(table) {
      const tableRect = table.getBoundingClientRect();
      if (tableRect.width === 0) return;

      let colgroup = table.querySelector('colgroup');

      if (colgroup) {
        // Table has colgroup - use col widths to position handles
        const cols = colgroup.querySelectorAll('col');
        if (cols.length <= 1) return;

        let accumulatedPercent = 0;
        for (let i = 0; i < cols.length - 1; i++) {
          const col = cols[i];
          let colWidth = parseFloat(col.style.width) || (100 / cols.length);
          accumulatedPercent += colWidth;

          const handleLeft = tableRect.left + (tableRect.width * accumulatedPercent / 100);
          this._createHandle(table, i, handleLeft, tableRect);
        }
      } else {
        // No colgroup - use cell positions from first row
        // DON'T create colgroup here (causes CKEditor event loops)
        const firstRow = table.querySelector('tr');
        if (!firstRow) return;

        const cells = Array.from(firstRow.children).filter(c => c.tagName === 'TD' || c.tagName === 'TH');
        if (cells.length <= 1) return;

        // Create handles at cell boundaries (except the last one)
        for (let i = 0; i < cells.length - 1; i++) {
          const cellRect = cells[i].getBoundingClientRect();
          const handleLeft = cellRect.right;
          this._createHandle(table, i, handleLeft, tableRect);
        }
      }
    }

    _createHandle(table, columnIndex, handleLeft, tableRect) {
      const handle = document.createElement('div');
      handle.className = 'custom-table-resize-handle';
      handle.dataset.columnIndex = columnIndex;
      handle.dataset.tableId = table.dataset.resizeId;

      handle.style.cssText = `
        position: fixed;
        top: ${tableRect.top}px;
        left: ${handleLeft - 5}px;
        width: 10px;
        height: ${tableRect.height}px;
        cursor: col-resize;
        background: transparent;
        pointer-events: auto;
        z-index: 99999;
      `;

      handle.addEventListener('mousedown', this._onMouseDown);
      handle.addEventListener('dblclick', this._onDoubleClick);
      this._overlayContainer.appendChild(handle);
    }

    _onMouseDown(event) {
      event.preventDefault();
      event.stopPropagation();

      const handle = event.target;
      const tableId = handle.dataset.tableId;
      const table = document.querySelector(`table[data-resize-id="${tableId}"]`);

      if (!table) return;

      const columnIndex = parseInt(handle.dataset.columnIndex, 10);
      const tableRect = table.getBoundingClientRect();

      // Remove duplicate colgroups
      const allColgroups = table.querySelectorAll('colgroup');
      if (allColgroups.length > 1) {
        for (let i = 1; i < allColgroups.length; i++) {
          allColgroups[i].remove();
        }
      }

      let colgroup = table.querySelector('colgroup');
      if (!colgroup) {
        colgroup = this._createColgroup(table);
      }

      const cols = colgroup.querySelectorAll('col');

      const initialWidths = Array.from(cols).map(col => {
        const width = col.style.width;
        if (width && width.endsWith('%')) return parseFloat(width);
        return 100 / cols.length;
      });

      this._resizeState = {
        handle,
        table,
        cols: Array.from(cols),
        columnIndex,
        startX: event.clientX,
        tableWidth: tableRect.width,
        initialWidths
      };

      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      // Show percentage tooltip with all column widths
      this._showResizeTooltip(event.clientX, event.clientY, initialWidths);
    }

    _onMouseMove(event) {
      if (!this._resizeState) return;

      const { cols, columnIndex, startX, tableWidth, initialWidths } = this._resizeState;

      const deltaX = event.clientX - startX;
      const deltaPercent = (deltaX / tableWidth) * 100;
      const minWidth = 0.5;

      const leftColIndex = columnIndex;
      const rightColIndex = columnIndex + 1;

      if (rightColIndex >= cols.length) return;

      let newLeftWidth = initialWidths[leftColIndex] + deltaPercent;
      let newRightWidth = initialWidths[rightColIndex] - deltaPercent;

      // Snap to 0.1% increments
      newLeftWidth = Math.round(newLeftWidth * 10) / 10;
      newRightWidth = Math.round(newRightWidth * 10) / 10;

      if (newLeftWidth < minWidth) {
        newRightWidth += (newLeftWidth - minWidth);
        newLeftWidth = minWidth;
      }
      if (newRightWidth < minWidth) {
        newLeftWidth += (newRightWidth - minWidth);
        newRightWidth = minWidth;
      }

      cols[leftColIndex].style.width = `${newLeftWidth.toFixed(2)}%`;
      cols[rightColIndex].style.width = `${newRightWidth.toFixed(2)}%`;

      // Update tooltip with all current widths
      const allWidths = cols.map(col => parseFloat(col.style.width) || 0);
      this._updateResizeTooltip(event.clientX, event.clientY, allWidths);
    }

    _onMouseUp() {
      if (!this._resizeState) return;

      const { table, cols } = this._resizeState;

      document.body.style.cursor = '';
      document.body.style.userSelect = '';

      // Hide tooltip
      this._hideResizeTooltip();

      const finalWidths = cols.map(col => col.style.width);

      if (table && finalWidths.length > 0) {
        this._updateModel(table, finalWidths);
      }

      this._resizeState = null;
      setTimeout(() => this._updateOverlay(), 50);
    }

    _showResizeTooltip(x, y, widths) {
      if (!this._tooltip) {
        this._tooltip = document.createElement('div');
        this._tooltip.style.cssText = `
          position: fixed;
          background: rgba(0, 0, 0, 0.8);
          color: white;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-family: monospace;
          pointer-events: none;
          z-index: 100000;
          white-space: nowrap;
        `;
        document.body.appendChild(this._tooltip);
      }
      this._updateResizeTooltip(x, y, widths);
      this._tooltip.style.display = 'block';
    }

    _updateResizeTooltip(x, y, widths) {
      if (!this._tooltip) return;
      this._tooltip.textContent = widths.map(w => `${w.toFixed(1)}%`).join(' | ');
      this._tooltip.style.left = `${x + 10}px`;
      this._tooltip.style.top = `${y - 30}px`;
    }

    _hideResizeTooltip() {
      if (this._tooltip) {
        this._tooltip.style.display = 'none';
      }
    }

    _onDoubleClick(event) {
      event.preventDefault();
      event.stopPropagation();

      const handle = event.target;
      const tableId = handle.dataset.tableId;
      const table = document.querySelector(`table[data-resize-id="${tableId}"]`);

      if (!table) return;

      // Create colgroup if it doesn't exist (only on user interaction)
      let colgroup = table.querySelector('colgroup');
      if (!colgroup) {
        colgroup = this._createColgroup(table);
        if (!colgroup) return;
      }

      const cols = colgroup.querySelectorAll('col');
      const widths = Array.from(cols).map(col => {
        const width = col.style.width;
        if (width && width.endsWith('%')) return parseFloat(width);
        return 100 / cols.length;
      });

      this._showInputPopover(event.clientX, event.clientY, table, widths);
    }

    _showInputPopover(x, y, table, widths) {
      // Remove existing popover
      this._hideInputPopover();

      const popover = document.createElement('div');
      popover.id = 'column-width-popover';
      popover.style.cssText = `
        position: fixed;
        left: ${x}px;
        top: ${y}px;
        background: white;
        border: 1px solid #ccc;
        border-radius: 6px;
        padding: 12px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 100001;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 13px;
        min-width: 180px;
      `;

      let html = '<div style="font-weight: 600; margin-bottom: 10px; color: #333;">Column Widths</div>';

      widths.forEach((width, i) => {
        html += `
          <div style="display: flex; align-items: center; margin-bottom: 8px;">
            <label style="flex: 0 0 50px; color: #666;">Col ${i + 1}:</label>
            <input type="number"
                   class="col-width-input"
                   data-col-index="${i}"
                   value="${width.toFixed(1)}"
                   step="0.1"
                   min="0.5"
                   style="flex: 1; width: 60px; padding: 4px 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px;">
            <span style="margin-left: 4px; color: #666;">%</span>
          </div>
        `;
      });

      html += `
        <div id="total-display" style="margin: 10px 0; padding-top: 8px; border-top: 1px solid #eee; color: #666;">
          Total: <span id="total-value">${widths.reduce((a, b) => a + b, 0).toFixed(1)}</span>%
        </div>
        <div style="display: flex; gap: 8px; margin-top: 10px;">
          <button id="apply-widths" style="flex: 1; padding: 6px 12px; background: #0066cc; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 13px;">Apply</button>
          <button id="cancel-widths" style="flex: 1; padding: 6px 12px; background: #f0f0f0; color: #333; border: 1px solid #ddd; border-radius: 4px; cursor: pointer; font-size: 13px;">Cancel</button>
        </div>
      `;

      popover.innerHTML = html;
      document.body.appendChild(popover);

      // Keep popover in viewport
      const rect = popover.getBoundingClientRect();
      if (rect.right > window.innerWidth) {
        popover.style.left = `${window.innerWidth - rect.width - 10}px`;
      }
      if (rect.bottom > window.innerHeight) {
        popover.style.top = `${window.innerHeight - rect.height - 10}px`;
      }

      // Update total on input change
      const inputs = popover.querySelectorAll('.col-width-input');
      const totalSpan = popover.querySelector('#total-value');

      inputs.forEach(input => {
        input.addEventListener('input', () => {
          let total = 0;
          inputs.forEach(inp => {
            total += parseFloat(inp.value) || 0;
          });
          totalSpan.textContent = total.toFixed(1);
          totalSpan.style.color = Math.abs(total - 100) < 0.1 ? '#22c55e' : '#ef4444';
        });
      });

      // Apply button
      popover.querySelector('#apply-widths').addEventListener('click', () => {
        const newWidths = [];
        inputs.forEach(input => {
          newWidths.push(parseFloat(input.value) || 0);
        });
        this._applyWidths(table, newWidths);
        this._hideInputPopover();
      });

      // Cancel button
      popover.querySelector('#cancel-widths').addEventListener('click', () => {
        this._hideInputPopover();
      });

      // Click outside to close
      setTimeout(() => {
        document.addEventListener('mousedown', this._handleOutsideClick = (e) => {
          if (!popover.contains(e.target)) {
            this._hideInputPopover();
          }
        });
      }, 100);

      this._inputPopover = popover;
    }

    _hideInputPopover() {
      if (this._inputPopover) {
        this._inputPopover.remove();
        this._inputPopover = null;
      }
      if (this._handleOutsideClick) {
        document.removeEventListener('mousedown', this._handleOutsideClick);
        this._handleOutsideClick = null;
      }
    }

    _applyWidths(table, widths) {
      const colgroup = table.querySelector('colgroup');
      if (!colgroup) return;

      const cols = colgroup.querySelectorAll('col');

      // Apply to DOM
      widths.forEach((width, i) => {
        if (cols[i]) {
          cols[i].style.width = `${width.toFixed(2)}%`;
        }
      });

      // Update model
      const widthStrings = widths.map(w => `${w.toFixed(2)}%`);
      this._updateModel(table, widthStrings);

      setTimeout(() => this._updateOverlay(), 50);
    }

    _updateModel(domTable, widths) {
      const editor = this.editor;
      const widthString = widths.join(',');

      try {
        // Try direct DOM -> View -> Model mapping
        let viewTable = editor.editing.view.domConverter.domToView(domTable);
        if (!viewTable) {
          viewTable = editor.editing.view.domConverter.mapDomToView(domTable);
        }

        let modelTable = null;
        if (viewTable) {
          modelTable = editor.editing.mapper.toModelElement(viewTable);
        }

        // Fallback: find by table position within root
        if (!modelTable) {
          const roots = editor.model.document.getRootNames();
          for (const rootName of roots) {
            const root = editor.model.document.getRoot(rootName);
            const rootEditable = editor.editing.view.document.getRoot(rootName);

            if (!rootEditable) continue;

            const domRoot = editor.editing.view.domConverter.mapViewToDom(rootEditable);
            if (!domRoot || !domRoot.contains(domTable)) continue;

            // Find table index in DOM
            const domTablesInRoot = domRoot.querySelectorAll('table');
            let tableIndexInRoot = -1;
            domTablesInRoot.forEach((t, i) => {
              if (t === domTable || t.dataset.resizeId === domTable.dataset.resizeId) {
                tableIndexInRoot = i;
              }
            });

            if (tableIndexInRoot < 0) continue;

            // Find all model tables in root
            const modelTables = [];
            const findAllTables = (el) => {
              if (!el) return;
              if (el.name === 'table') modelTables.push(el);
              if (el.getChildren) {
                for (const child of el.getChildren()) {
                  findAllTables(child);
                }
              }
            };
            findAllTables(root);

            if (tableIndexInRoot < modelTables.length) {
              modelTable = modelTables[tableIndexInRoot];
              break;
            }
          }
        }

        if (!modelTable) return;

        editor.model.change(writer => {
          writer.setAttribute('columnWidths', widthString, modelTable);
        });
      } catch (e) {
        console.error('[CustomTableColumnResize] Model update error:', e);
      }
    }

    _registerConverters() {
      const editor = this.editor;

      // Ensure columnWidths attribute is allowed
      if (!editor.model.schema.checkAttribute('table', 'columnWidths')) {
        editor.model.schema.extend('table', {
          allowAttributes: ['columnWidths']
        });
      }

      // Editing downcast: update view when model changes
      editor.conversion.for('editingDowncast').add(dispatcher => {
        dispatcher.on('attribute:columnWidths:table', (evt, data, conversionApi) => {
          const columnWidths = data.attributeNewValue;
          if (!columnWidths) return;

          let viewElement = conversionApi.mapper.toViewElement(data.item);
          if (!viewElement) return;

          // If viewElement is a figure, find the actual table inside
          let viewTable = viewElement;
          if (viewElement.name === 'figure') {
            for (const child of viewElement.getChildren()) {
              if (child.name === 'table') {
                viewTable = child;
                break;
              }
            }
          }

          const viewWriter = conversionApi.writer;
          const widths = columnWidths.split(',');

          // Find existing colgroup in the actual table
          let existingColgroup = null;
          for (const child of viewTable.getChildren()) {
            if (child.name === 'colgroup') {
              existingColgroup = child;
            }
          }

          // Also check if there's a misplaced colgroup in the figure (and remove it)
          if (viewElement.name === 'figure') {
            for (const child of viewElement.getChildren()) {
              if (child.name === 'colgroup') {
                viewWriter.remove(child);
              }
            }
          }

          if (existingColgroup) {
            // Update existing colgroup
            const cols = Array.from(existingColgroup.getChildren());
            if (cols.length === widths.length) {
              // Same number of cols - just update widths
              widths.forEach((width, i) => {
                if (cols[i]) {
                  viewWriter.setAttribute('style', `width:${width};`, cols[i]);
                  viewWriter.setAttribute('width', width, cols[i]);
                }
              });
            } else {
              // Different number of cols - recreate colgroup
              viewWriter.remove(existingColgroup);
              const colgroup = viewWriter.createContainerElement('colgroup');
              widths.forEach(width => {
                const col = viewWriter.createEmptyElement('col');
                viewWriter.setAttribute('style', `width:${width};`, col);
                viewWriter.setAttribute('width', width, col);
                viewWriter.insert(viewWriter.createPositionAt(colgroup, 'end'), col);
              });
              viewWriter.insert(viewWriter.createPositionAt(viewTable, 0), colgroup);
            }
          } else {
            // No colgroup in view - create one
            const colgroup = viewWriter.createContainerElement('colgroup');
            widths.forEach(width => {
              const col = viewWriter.createEmptyElement('col');
              viewWriter.setAttribute('style', `width:${width};`, col);
              viewWriter.setAttribute('width', width, col);
              viewWriter.insert(viewWriter.createPositionAt(colgroup, 'end'), col);
            });
            viewWriter.insert(viewWriter.createPositionAt(viewTable, 0), colgroup);
          }

          // Ensure table has the resized class for proper CSS
          viewWriter.addClass('ck-table-resized', viewTable);

          // Also ensure table-layout: fixed is set on the table itself
          const currentStyle = viewTable.getAttribute('style') || '';
          if (!currentStyle.includes('table-layout')) {
            const newStyle = currentStyle + (currentStyle ? ';' : '') + 'table-layout:fixed;';
            viewWriter.setAttribute('style', newStyle, viewTable);
          }
        }, { priority: 'highest' });
      });

      // Data downcast: generate HTML output
      editor.conversion.for('dataDowncast').add(dispatcher => {
        dispatcher.on('attribute:columnWidths:table', (evt, data, conversionApi) => {
          const columnWidths = data.attributeNewValue;
          if (!columnWidths) return;

          let viewElement = conversionApi.mapper.toViewElement(data.item);
          if (!viewElement) return;

          // If viewElement is a figure, find the actual table inside
          let viewTable = viewElement;
          if (viewElement.name === 'figure') {
            for (const child of viewElement.getChildren()) {
              if (child.name === 'table') {
                viewTable = child;
                break;
              }
            }
          }

          const viewWriter = conversionApi.writer;
          const widths = columnWidths.split(',');

          // Remove existing colgroups from table
          const existingColgroups = [];
          for (const child of viewTable.getChildren()) {
            if (child.name === 'colgroup') {
              existingColgroups.push(child);
            }
          }
          existingColgroups.forEach(cg => viewWriter.remove(cg));

          // Also remove any misplaced colgroups from figure
          if (viewElement.name === 'figure') {
            const figColgroups = [];
            for (const child of viewElement.getChildren()) {
              if (child.name === 'colgroup') {
                figColgroups.push(child);
              }
            }
            figColgroups.forEach(cg => viewWriter.remove(cg));
          }

          // Create new colgroup inside the table
          const colgroup = viewWriter.createContainerElement('colgroup');
          widths.forEach(width => {
            const col = viewWriter.createEmptyElement('col');
            viewWriter.setAttribute('style', `width:${width};`, col);
            viewWriter.insert(viewWriter.createPositionAt(colgroup, 'end'), col);
          });
          viewWriter.insert(viewWriter.createPositionAt(viewTable, 0), colgroup);

          evt.stop();
        }, { priority: 'highest' });
      });

      // Post-process to remove duplicate colgroups
      const originalToData = editor.data.processor.toData.bind(editor.data.processor);
      editor.data.processor.toData = (viewFragment) => {
        let html = originalToData(viewFragment);

        html = html.replace(/(<table[^>]*>)(\s*<colgroup>.*?<\/colgroup>)+/gs, (match, tableTag) => {
          const colgroupMatches = match.match(/<colgroup>.*?<\/colgroup>/gs);
          if (colgroupMatches && colgroupMatches.length > 1) {
            return tableTag + colgroupMatches[0];
          }
          return match;
        });

        return html;
      };
    }

    _createColgroup(table) {
      const firstRow = table.querySelector('tr');
      if (!firstRow) return null;

      const cells = Array.from(firstRow.querySelectorAll('td, th'));
      if (cells.length === 0) return null;

      const tableRect = table.getBoundingClientRect();
      if (tableRect.width === 0) return null;

      const colgroup = document.createElement('colgroup');

      // Calculate widths based on actual cell positions to preserve layout
      cells.forEach(cell => {
        const cellRect = cell.getBoundingClientRect();
        const colspan = parseInt(cell.getAttribute('colspan') || '1', 10);
        const cellWidthPercent = (cellRect.width / tableRect.width) * 100;
        const singleColWidth = cellWidthPercent / colspan;

        for (let k = 0; k < colspan; k++) {
          const col = document.createElement('col');
          col.style.width = `${singleColWidth.toFixed(2)}%`;
          colgroup.appendChild(col);
        }
      });

      table.insertBefore(colgroup, table.firstChild);

      // Add class for proper CSS (table-layout: fixed)
      table.classList.add('ck-table-resized');

      return colgroup;
    }
  }

  return CustomTableColumnResizePlugin;
}
