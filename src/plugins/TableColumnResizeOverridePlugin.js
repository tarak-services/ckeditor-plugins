/**
 * Plugin to override CKEditor's default minimum column width constraint
 *
 * CKEditor's TableColumnResize plugin has hardcoded constants:
 * - COLUMN_MIN_WIDTH_IN_PIXELS = 40
 * - COLUMN_MIN_WIDTH_AS_PERCENTAGE = 5
 *
 * This plugin patches those to allow columns to be resized to any width.
 *
 * @param {Object} CKEditor - CKEditor instance from CDN
 * @returns {Class} TableColumnResizeOverridePlugin class
 */
export default function createTableColumnResizeOverridePlugin(CKEditor) {
  const { Plugin } = CKEditor;

  // Try to patch the constants on the CKEditor object itself
  // These constants are used by the TableColumnResize plugin
  try {
    // The constants might be exposed on the CKEditor namespace
    if (CKEditor.COLUMN_MIN_WIDTH_IN_PIXELS !== undefined) {
      CKEditor.COLUMN_MIN_WIDTH_IN_PIXELS = 1;
    }
    if (CKEditor.COLUMN_MIN_WIDTH_AS_PERCENTAGE !== undefined) {
      CKEditor.COLUMN_MIN_WIDTH_AS_PERCENTAGE = 0.1;
    }
  } catch (e) {
    console.debug('Could not patch CKEditor constants directly:', e);
  }

  class TableColumnResizeOverridePlugin extends Plugin {
    static get pluginName() {
      return 'TableColumnResizeOverride';
    }

    init() {
      const editor = this.editor;

      // Patch immediately
      this._patchResizeConstants();

      // Also patch when editor is ready
      editor.on('ready', () => {
        this._patchResizeConstants();
      });
    }

    _patchResizeConstants() {
      const editor = this.editor;

      try {
        // Try to access TableColumnResizeEditing plugin and patch its internals
        if (editor.plugins.has('TableColumnResizeEditing')) {
          const resizePlugin = editor.plugins.get('TableColumnResizeEditing');

          // Look for the constants module in the plugin's closure/scope
          // Try various ways the constants might be accessible
          this._patchObject(resizePlugin);
          this._patchObject(resizePlugin.constructor);

          // Check if there's a _resizer or similar property
          for (const key of Object.keys(resizePlugin)) {
            if (resizePlugin[key] && typeof resizePlugin[key] === 'object') {
              this._patchObject(resizePlugin[key]);
            }
          }
        }

        // Try to patch via the CKEditor global object
        this._patchCKEditorGlobals();

      } catch (e) {
        console.debug('TableColumnResizeOverride: Could not patch constants', e);
      }
    }

    _patchObject(obj) {
      if (!obj) return;

      const propsToOverride = {
        'COLUMN_MIN_WIDTH_IN_PIXELS': 1,
        'COLUMN_MIN_WIDTH_AS_PERCENTAGE': 0.1,
        '_minColumnWidth': 1,
        '_columnMinWidthInPixels': 1,
        'columnMinWidthInPixels': 1,
        'minColumnWidth': 1
      };

      for (const [prop, value] of Object.entries(propsToOverride)) {
        try {
          if (prop in obj) {
            // Try to override - might fail if property is not writable
            Object.defineProperty(obj, prop, {
              value: value,
              writable: true,
              configurable: true
            });
          }
        } catch (e) {
          // Property might be non-configurable
        }
      }
    }

    _patchCKEditorGlobals() {
      // Try to find and patch the constants in the global CKEditor namespace
      if (typeof window !== 'undefined' && window.CKEditor5) {
        this._deepPatchConstants(window.CKEditor5);
      }
    }

    _deepPatchConstants(obj, depth = 0) {
      if (depth > 3 || !obj || typeof obj !== 'object') return;

      try {
        // Look for the specific constant names
        if ('COLUMN_MIN_WIDTH_IN_PIXELS' in obj) {
          try {
            obj.COLUMN_MIN_WIDTH_IN_PIXELS = 1;
          } catch (e) {}
        }
        if ('COLUMN_MIN_WIDTH_AS_PERCENTAGE' in obj) {
          try {
            obj.COLUMN_MIN_WIDTH_AS_PERCENTAGE = 0.1;
          } catch (e) {}
        }

        // Recurse into sub-objects (but limit depth)
        for (const key of Object.keys(obj)) {
          if (key.toLowerCase().includes('table') || key.toLowerCase().includes('column')) {
            this._deepPatchConstants(obj[key], depth + 1);
          }
        }
      } catch (e) {
        // Ignore errors from non-enumerable properties
      }
    }
  }

  return TableColumnResizeOverridePlugin;
}
