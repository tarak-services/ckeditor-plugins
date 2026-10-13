import './TableCellBorderPlugin.css';

/**
 * Factory function to create TableCellBorderPlugin
 *
 * Excel / Google Sheets style border picker for the selected table cells.
 * Pick a line style (always black), then a position (all, inner, horizontal,
 * vertical, outer, left, top, right, bottom, clear). Positions are resolved
 * against the bounding box of the selection, so "outer" draws a box around
 * the whole selected range and "inner" draws the grid lines inside it.
 *
 * Borders are stored in the built-in TableCellProperties attributes
 * (`tableCellBorderStyle|Width|Color`) as per-side `{ top, right, bottom, left }`
 * objects, so they round-trip as plain inline `border-*` styles and stay in
 * sync with the "Cell properties" balloon.
 *
 * Clicking a position whose borders already match the chosen line toggles them off.
 *
 * @param {Object} CKEditor - CKEditor namespace (ckeditor5 + premium features)
 * @returns {Class} TableCellBorderPlugin class
 */
export default function createTableCellBorderPlugin(CKEditor) {
  const {
    Plugin,
    Command,
    View,
    ButtonView,
    FocusTracker,
    FocusCycler,
    KeystrokeHandler,
    StylesMap,
    TableWalker,
    createDropdown
  } = CKEditor;

  const SIDES = ['top', 'right', 'bottom', 'left'];
  const OPPOSITE_SIDE = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' };
  const BORDER_ATTRIBUTES = {
    style: 'tableCellBorderStyle',
    width: 'tableCellBorderWidth',
    color: 'tableCellBorderColor'
  };
  // Keys the legacy TableStyle plugin (TableBorderPlugin.jsx) mirrors into `customCellStyle`.
  const LEGACY_BORDER_KEYS = [
    'border', 'border-top', 'border-right', 'border-bottom', 'border-left',
    'border-width', 'border-style', 'border-color'
  ];

  const POSITIONS = [
    { name: 'all', label: 'All borders', lines: ['top', 'right', 'bottom', 'left', 'horizontal', 'vertical'] },
    { name: 'inner', label: 'Inner borders', lines: ['horizontal', 'vertical'] },
    { name: 'horizontal', label: 'Inner horizontal borders', lines: ['horizontal'] },
    { name: 'vertical', label: 'Inner vertical borders', lines: ['vertical'] },
    { name: 'outer', label: 'Outer borders', lines: ['top', 'right', 'bottom', 'left'] },
    { name: 'left', label: 'Left border', lines: ['left'] },
    { name: 'top', label: 'Top border', lines: ['top'] },
    { name: 'right', label: 'Right border', lines: ['right'] },
    { name: 'bottom', label: 'Bottom border', lines: ['bottom'] },
    { name: 'none', label: 'Clear borders', lines: [] }
  ];

  const LINE_STYLES = [
    { name: 'thin', label: 'Thin', style: 'solid', width: '1px' },
    { name: 'medium', label: 'Medium', style: 'solid', width: '2px' },
    { name: 'thick', label: 'Thick', style: 'solid', width: '3px' },
    { name: 'double', label: 'Double', style: 'double', width: '3px' },
    { name: 'dashed', label: 'Dashed', style: 'dashed', width: '1px' },
    { name: 'thickDashed', label: 'Thick dashed', style: 'dashed', width: '2px' },
    { name: 'dotted', label: 'Dotted', style: 'dotted', width: '1px' },
    { name: 'thickDotted', label: 'Thick dotted', style: 'dotted', width: '2px' }
  ];

  const BORDER_COLOR = '#000000';

  const ICON_LINES = {
    top: [3, 3, 17, 3],
    bottom: [3, 17, 17, 17],
    left: [3, 3, 3, 17],
    right: [17, 3, 17, 17],
    horizontal: [3, 10, 17, 10],
    vertical: [10, 3, 10, 17]
  };

  const positionIcon = strongLines => {
    const line = ([x1, y1, x2, y2], attrs) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="currentColor" ${attrs}/>`;
    const faint = Object.entries(ICON_LINES)
      .filter(([name]) => !strongLines.includes(name))
      .map(([, coords]) => line(coords, 'stroke-width="1" stroke-dasharray="1 1.5" opacity=".45"'));
    const strong = strongLines.map(name => line(ICON_LINES[name], 'stroke-width="2" stroke-linecap="square"'));
    return `<svg viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" fill="none">${faint.join('')}${strong.join('')}</svg>`;
  };

  const lineStyleIcon = ({ style, width }) => {
    const strokeWidth = parseFloat(width);
    const base = 'x1="2" x2="46" stroke="currentColor"';
    if (style === 'double') {
      return `<svg viewBox="0 0 48 12" xmlns="http://www.w3.org/2000/svg" fill="none"><line ${base} y1="4" y2="4" stroke-width="1"/><line ${base} y1="8" y2="8" stroke-width="1"/></svg>`;
    }
    const dash = style === 'dashed' ? `stroke-dasharray="${strokeWidth * 4} ${strokeWidth * 2}"` :
      style === 'dotted' ? `stroke-dasharray="${strokeWidth} ${strokeWidth * 1.5}"` : '';
    return `<svg viewBox="0 0 48 12" xmlns="http://www.w3.org/2000/svg" fill="none"><line ${base} y1="6" y2="6" stroke-width="${strokeWidth}" ${dash}/></svg>`;
  };

  const readSides = (cell, attribute) => {
    const value = cell.getAttribute(attribute);
    if (!value) return {};
    if (typeof value === 'string') return { top: value, right: value, bottom: value, left: value };
    return { ...value };
  };

  // Mirrors CKEditor's own reduceBoxSidesValue(): a single string when all four sides match.
  const compactSides = sides => {
    const defined = SIDES.filter(side => sides[side]);
    if (!defined.length) return null;
    if (defined.length === 4 && SIDES.every(side => sides[side] === sides.top)) return sides.top;
    return Object.fromEntries(defined.map(side => [side, sides[side]]));
  };

  /**
   * Maps every cell of the table to its grid span and every grid slot to its cell.
   */
  const mapTable = table => {
    const grid = [];
    const spans = new Map();
    for (const { cell, row, column, cellWidth, cellHeight, isAnchor } of new TableWalker(table, { includeAllSlots: true })) {
      (grid[row] ||= [])[column] = cell;
      if (isAnchor) {
        spans.set(cell, { row, column, lastRow: row + cellHeight - 1, lastColumn: column + cellWidth - 1 });
      }
    }
    return { grid, spans };
  };

  const appliesToSide = (position, side, isOuter) => {
    if (position === 'all' || position === 'none') return true;
    if (isOuter) return position === 'outer' || position === side;
    if (position === 'inner') return true;
    return position === (side === 'top' || side === 'bottom' ? 'horizontal' : 'vertical');
  };

  class TableCellBordersCommand extends Command {
    refresh() {
      this.isEnabled = this._getSelectedCells().length > 0;
    }

    /**
     * @param {Object} options
     * @param {string} options.position One of POSITIONS[].name
     * @param {{ style: string, width: string, color: string }} [options.border] Required unless position is 'none'
     */
    execute({ position, border } = {}) {
      const editor = this.editor;
      const cells = this._getSelectedCells();
      if (!cells.length || !position) return;

      const table = cells[0].findAncestor('table');
      const isLayoutTable = table.getAttribute('tableType') === 'layout';
      const { grid, spans } = mapTable(table);

      const rect = { top: Infinity, left: Infinity, bottom: -Infinity, right: -Infinity };
      for (const cell of cells) {
        const span = spans.get(cell);
        rect.top = Math.min(rect.top, span.row);
        rect.left = Math.min(rect.left, span.column);
        rect.bottom = Math.max(rect.bottom, span.lastRow);
        rect.right = Math.max(rect.right, span.lastColumn);
      }

      const targets = [];
      for (const cell of cells) {
        const span = spans.get(cell);
        const isOuter = {
          top: span.row === rect.top,
          bottom: span.lastRow === rect.bottom,
          left: span.column === rect.left,
          right: span.lastColumn === rect.right
        };
        for (const side of SIDES) {
          if (!appliesToSide(position, side, isOuter[side])) continue;
          targets.push({ cell, side, isSelected: true });
          // With border-collapse the cell across the edge shares this line, so mirror the change onto it.
          if (isOuter[side]) {
            for (const neighbor of this._getNeighborsAcross(span, side, grid, spans, rect)) {
              targets.push({ cell: neighbor, side: OPPOSITE_SIDE[side], isSelected: false });
            }
          }
        }
      }

      const touchedCells = new Set(targets.map(target => target.cell));
      const sidesByCell = new Map();
      for (const cell of touchedCells) {
        sidesByCell.set(cell, this._readBorderSides(cell));
      }

      const isAlreadyApplied = position !== 'none' && targets
        .filter(target => target.isSelected)
        .every(({ cell, side }) => {
          const sides = sidesByCell.get(cell);
          return sides.style[side] === border.style && sides.width[side] === border.width && sides.color[side] === border.color;
        });
      const shouldClear = position === 'none' || isAlreadyApplied;
      // Content tables get a default border from CSS, so clearing must be explicit there.
      const clearedStyle = isLayoutTable ? undefined : 'none';

      for (const { cell, side } of targets) {
        const sides = sidesByCell.get(cell);
        sides.style[side] = shouldClear ? clearedStyle : border.style;
        sides.width[side] = shouldClear ? undefined : border.width;
        sides.color[side] = shouldClear ? undefined : border.color;
      }

      const model = editor.model;
      model.change(writer => {
        // The legacy `customCellStyle` downcast removes every border style it owned from the view,
        // so strip it (and the built-in attributes) in their own change block, then write the new
        // borders in a second block of the same batch. Converting both in one block would let the
        // legacy removal run last and wipe the new styles from the editing view.
        for (const cell of touchedCells) {
          if (this._stripLegacyBorderStyles(writer, cell)) {
            Object.values(BORDER_ATTRIBUTES).forEach(attribute => writer.removeAttribute(attribute, cell));
          }
        }

        model.enqueueChange(writer.batch, writer => {
          for (const cell of touchedCells) {
            const sides = sidesByCell.get(cell);
            for (const [key, attribute] of Object.entries(BORDER_ATTRIBUTES)) {
              const value = compactSides(sides[key]);
              if (value) {
                writer.setAttribute(attribute, value, cell);
              } else {
                writer.removeAttribute(attribute, cell);
              }
            }
          }
        });
      });
    }

    _getSelectedCells() {
      const tableUtils = this.editor.plugins.get('TableUtils');
      return tableUtils.getSelectionAffectedTableCells(this.editor.model.document.selection);
    }

    /**
     * Cells on the other side of `side`, limited to ones that don't extend past
     * the selection (a merged neighbor sticking out would otherwise get a border
     * along its whole edge).
     */
    _getNeighborsAcross(span, side, grid, spans, rect) {
      const slots = [];
      if (side === 'top' || side === 'bottom') {
        const row = side === 'top' ? span.row - 1 : span.lastRow + 1;
        for (let column = span.column; column <= span.lastColumn; column++) slots.push(grid[row]?.[column]);
      } else {
        const column = side === 'left' ? span.column - 1 : span.lastColumn + 1;
        for (let row = span.row; row <= span.lastRow; row++) slots.push(grid[row]?.[column]);
      }
      return [...new Set(slots.filter(Boolean))].filter(cell => {
        const neighborSpan = spans.get(cell);
        return side === 'top' || side === 'bottom' ?
          neighborSpan.column >= rect.left && neighborSpan.lastColumn <= rect.right :
          neighborSpan.row >= rect.top && neighborSpan.lastRow <= rect.bottom;
      });
    }

    /**
     * Current per-side border values, filling gaps from legacy `customCellStyle`
     * borders written by TableBorderPlugin in this session (not yet round-tripped
     * into the built-in attributes).
     */
    _readBorderSides(cell) {
      const sides = {
        style: readSides(cell, BORDER_ATTRIBUTES.style),
        width: readSides(cell, BORDER_ATTRIBUTES.width),
        color: readSides(cell, BORDER_ATTRIBUTES.color)
      };
      const legacy = cell.getAttribute('customCellStyle');
      const legacyKeys = legacy ? LEGACY_BORDER_KEYS.filter(key => legacy[key]) : [];
      if (!legacyKeys.length) return sides;

      const styles = new StylesMap(this.editor.data.stylesProcessor);
      for (const key of legacyKeys) styles.set(key, legacy[key]);
      const normalized = styles.getNormalized('border') || {};
      for (const key of Object.keys(sides)) {
        for (const side of SIDES) {
          sides[key][side] ||= normalized[key]?.[side];
        }
      }
      return sides;
    }

    _stripLegacyBorderStyles(writer, cell) {
      const legacy = cell.getAttribute('customCellStyle');
      if (!legacy || !LEGACY_BORDER_KEYS.some(key => legacy[key])) return false;

      const remaining = { ...legacy };
      LEGACY_BORDER_KEYS.forEach(key => delete remaining[key]);
      if (Object.keys(remaining).length) {
        writer.setAttribute('customCellStyle', remaining, cell);
      } else {
        writer.removeAttribute('customCellStyle', cell);
      }
      return true;
    }
  }

  /**
   * Dropdown panel: position grid and line style picker.
   * The line style is sticky between uses, like Excel's pen.
   */
  class CellBordersPanelView extends View {
    constructor(locale) {
      super(locale);

      this.set('lineStyle', LINE_STYLES[0].name);

      this.focusTracker = new FocusTracker();
      this.keystrokes = new KeystrokeHandler();
      this.focusables = this.createCollection();

      this.positionButtons = this.createCollection(POSITIONS.map(position => {
        const button = new ButtonView(locale);
        button.set({ label: position.label, icon: positionIcon(position.lines), tooltip: true });
        button.on('execute', () => this.fire('applyPosition', position.name));
        return button;
      }));

      this.lineStyleButtons = this.createCollection(LINE_STYLES.map(lineStyle => {
        const button = new ButtonView(locale);
        button.set({ label: lineStyle.label, icon: lineStyleIcon(lineStyle), tooltip: true, isToggleable: true });
        button.bind('isOn').to(this, 'lineStyle', value => value === lineStyle.name);
        button.on('execute', () => { this.lineStyle = lineStyle.name; });
        return button;
      }));

      this.focusCycler = new FocusCycler({
        focusables: this.focusables,
        focusTracker: this.focusTracker,
        keystrokeHandler: this.keystrokes,
        actions: { focusPrevious: 'shift+tab', focusNext: 'tab' }
      });

      const label = text => ({
        tag: 'div',
        attributes: { class: ['ck', 'ck-cell-borders__label'] },
        children: [text]
      });

      this.setTemplate({
        tag: 'div',
        attributes: { class: ['ck', 'ck-cell-borders'], tabindex: '-1' },
        children: [
          { tag: 'div', attributes: { class: ['ck', 'ck-cell-borders__positions'] }, children: this.positionButtons },
          label('Line style'),
          { tag: 'div', attributes: { class: ['ck', 'ck-cell-borders__styles'] }, children: this.lineStyleButtons }
        ]
      });
    }

    get border() {
      const { style, width } = LINE_STYLES.find(lineStyle => lineStyle.name === this.lineStyle);
      return { style, width, color: BORDER_COLOR };
    }

    render() {
      super.render();
      for (const view of [...this.positionButtons, ...this.lineStyleButtons]) {
        this.focusables.add(view);
        this.focusTracker.add(view.element);
      }
      this.keystrokes.listenTo(this.element);
    }

    focus() {
      this.focusCycler.focusFirst();
    }

    destroy() {
      super.destroy();
      this.focusTracker.destroy();
      this.keystrokes.destroy();
    }
  }

  class TableCellBorderPlugin extends Plugin {
    static get pluginName() {
      return 'TableCellBorder';
    }

    static get requires() {
      return ['TableUtils', 'TableCellPropertiesEditing'];
    }

    init() {
      const editor = this.editor;
      editor.commands.add('tableCellBorders', new TableCellBordersCommand(editor));

      editor.ui.componentFactory.add('tableCellBorders', locale => {
        const command = editor.commands.get('tableCellBorders');
        const dropdownView = createDropdown(locale);

        dropdownView.buttonView.set({
          label: 'Cell borders',
          icon: positionIcon(['top', 'right', 'bottom', 'left']),
          tooltip: true
        });
        dropdownView.bind('isEnabled').to(command, 'isEnabled');
        dropdownView.class = 'ck-cell-borders-dropdown';

        // Build the panel lazily so toolbars with many editors stay cheap.
        dropdownView.once('change:isOpen', () => {
          const panelView = new CellBordersPanelView(locale);
          panelView.on('applyPosition', (evt, position) => {
            editor.execute('tableCellBorders', { position, border: panelView.border });
            dropdownView.isOpen = false;
            editor.editing.view.focus();
          });
          dropdownView.panelView.children.add(panelView);
        });

        return dropdownView;
      });
    }
  }

  return TableCellBorderPlugin;
}
