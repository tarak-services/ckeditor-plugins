// Plugins - Factory functions that create CKEditor plugins
import createAlignmentDefaultPlugin from './plugins/AlignmentDefaultPlugin.js';
import createBarcodePlugin from './plugins/BarcodePlugin.jsx';
import createCurlyQuotesPlugin from './plugins/CurlyQuotesPlugin.js';
import createCustomTableColumnResizePlugin from './plugins/CustomTableColumnResizePlugin.js';
import createFontDropdownLabelsPlugin from './plugins/FontDropdownLabelsPlugin.js';
import createFontFamilySearchPlugin from './plugins/FontFamilySearchPlugin.js';
import createFontSizeSearchPlugin from './plugins/FontSizeSearchPlugin.js';
import createFontSymbolSelectorPlugin from './plugins/FontSymbolSelectorPlugin.jsx';
import createImageDPIScalePlugin from './plugins/ImageDPIScalePlugin.js';
import createImageVerticalAlignPlugin from './plugins/ImageVerticalAlignPlugin.js';
import createLineHeightPlugin from './plugins/LineHeightPlugin.jsx';
import createMarginTopPlugin from './plugins/MarginTopPlugin.js';
import createMathLivePlugin from './plugins/MathLivePlugin.jsx';
import createMathSymbolsPlugin, { setGlobalMathSymbols, getGlobalMathSymbols } from './plugins/MathSymbolsPlugin.jsx';
import createQRCodePlugin from './plugins/QRCodePlugin.jsx';
import createSearchableDropdownPlugin from './plugins/SearchableDropdownPlugin.js';
import createSoftBreakVisibilityPlugin from './plugins/SoftBreakVisibilityPlugin.js';
import createTableBorderPlugin from './plugins/TableBorderPlugin.jsx';
import createTableCellBaselinePlugin from './plugins/TableCellBaselinePlugin.js';
import createTableColumnResizeOverridePlugin from './plugins/TableColumnResizeOverridePlugin.js';
import createTextAlignLastPlugin from './plugins/TextAlignLastPlugin.js';
import createTextDirectionPlugin from './plugins/TextDirectionPlugin.jsx';
import createUnderlineOffsetPlugin from './plugins/UnderlineOffsetPlugin.js';

// Re-export all plugins
export {
  createAlignmentDefaultPlugin,
  createBarcodePlugin,
  createCurlyQuotesPlugin,
  createCustomTableColumnResizePlugin,
  createFontDropdownLabelsPlugin,
  createFontFamilySearchPlugin,
  createFontSizeSearchPlugin,
  createFontSymbolSelectorPlugin,
  createImageDPIScalePlugin,
  createImageVerticalAlignPlugin,
  createLineHeightPlugin,
  createMarginTopPlugin,
  createMathLivePlugin,
  createMathSymbolsPlugin,
  setGlobalMathSymbols,
  getGlobalMathSymbols,
  createQRCodePlugin,
  createSearchableDropdownPlugin,
  createSoftBreakVisibilityPlugin,
  createTableBorderPlugin,
  createTableCellBaselinePlugin,
  createTableColumnResizeOverridePlugin,
  createTextAlignLastPlugin,
  createTextDirectionPlugin,
  createUnderlineOffsetPlugin
};

// Editor components
export { default as RichTextEditor } from './editors/RichTextEditor.jsx';
export { createEditorConfig } from './editors/editorConfig.js';

// Hooks
export { useCKEditorFonts } from './hooks/useCKEditorFonts.js';

// Utilities
export * from './utils/ckeditorUtils.js';
export * from './utils/dropdownSearchUtils.js';

// Helper to create all plugins at once
// Options:
//   - getAvailableFonts: Function to fetch available fonts (for FontSymbolSelectorPlugin)
//   - getFontSupportedGlyphs: Function to fetch font glyphs (for FontSymbolSelectorPlugin)
export function createAllPlugins(CKEditor, options = {}) {
  const { getAvailableFonts, getFontSupportedGlyphs } = options;

  return {
    AlignmentDefaultPlugin: createAlignmentDefaultPlugin(CKEditor),
    BarcodePlugin: createBarcodePlugin(CKEditor),
    CurlyQuotesPlugin: createCurlyQuotesPlugin(CKEditor),
    CustomTableColumnResizePlugin: createCustomTableColumnResizePlugin(CKEditor),
    FontDropdownLabelsPlugin: createFontDropdownLabelsPlugin(CKEditor),
    FontFamilySearchPlugin: createFontFamilySearchPlugin(CKEditor),
    FontSizeSearchPlugin: createFontSizeSearchPlugin(CKEditor),
    FontSymbolSelectorPlugin: createFontSymbolSelectorPlugin(CKEditor, { getAvailableFonts, getFontSupportedGlyphs }),
    ImageDPIScalePlugin: createImageDPIScalePlugin(CKEditor),
    ImageVerticalAlignPlugin: createImageVerticalAlignPlugin(CKEditor),
    LineHeightPlugin: createLineHeightPlugin(CKEditor),
    MarginTopPlugin: createMarginTopPlugin(CKEditor),
    MathLivePlugin: createMathLivePlugin(CKEditor),
    MathSymbolsPlugin: createMathSymbolsPlugin(CKEditor),
    QRCodePlugin: createQRCodePlugin(CKEditor),
    SoftBreakVisibilityPlugin: createSoftBreakVisibilityPlugin(CKEditor),
    TableBorderPlugin: createTableBorderPlugin(CKEditor),
    TableCellBaselinePlugin: createTableCellBaselinePlugin(CKEditor),
    TableColumnResizeOverridePlugin: createTableColumnResizeOverridePlugin(CKEditor),
    TextAlignLastPlugin: createTextAlignLastPlugin(CKEditor),
    TextDirectionPlugin: createTextDirectionPlugin(CKEditor),
    UnderlineOffsetPlugin: createUnderlineOffsetPlugin(CKEditor),
  };
}
