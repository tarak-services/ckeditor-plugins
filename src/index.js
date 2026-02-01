// Plugins - Factory functions that create CKEditor plugins
export { default as createAlignmentDefaultPlugin } from './plugins/AlignmentDefaultPlugin.js';
export { default as createCurlyQuotesPlugin } from './plugins/CurlyQuotesPlugin.js';
export { default as createCustomTableColumnResizePlugin } from './plugins/CustomTableColumnResizePlugin.js';
export { default as createFontDropdownLabelsPlugin } from './plugins/FontDropdownLabelsPlugin.js';
export { default as createFontFamilySearchPlugin } from './plugins/FontFamilySearchPlugin.js';
export { default as createFontSizeSearchPlugin } from './plugins/FontSizeSearchPlugin.js';
export { default as createFontSymbolSelectorPlugin } from './plugins/FontSymbolSelectorPlugin.jsx';
export { default as createImageDPIScalePlugin } from './plugins/ImageDPIScalePlugin.js';
export { default as createImageVerticalAlignPlugin } from './plugins/ImageVerticalAlignPlugin.js';
export { default as createLineHeightPlugin } from './plugins/LineHeightPlugin.jsx';
export { default as createMarginTopPlugin } from './plugins/MarginTopPlugin.js';
export { default as createMathLivePlugin } from './plugins/MathLivePlugin.jsx';
export { default as createMathSymbolsPlugin } from './plugins/MathSymbolsPlugin.jsx';
export { default as createQRCodePlugin } from './plugins/QRCodePlugin.jsx';
export { default as createSearchableDropdownPlugin } from './plugins/SearchableDropdownPlugin.js';
export { default as createSoftBreakVisibilityPlugin } from './plugins/SoftBreakVisibilityPlugin.js';
export { default as createTableBorderPlugin } from './plugins/TableBorderPlugin.jsx';
export { default as createTableCellBaselinePlugin } from './plugins/TableCellBaselinePlugin.js';
export { default as createTableColumnResizeOverridePlugin } from './plugins/TableColumnResizeOverridePlugin.js';
export { default as createTextAlignLastPlugin } from './plugins/TextAlignLastPlugin.js';
export { default as createTextDirectionPlugin } from './plugins/TextDirectionPlugin.jsx';
export { default as createUnderlineOffsetPlugin } from './plugins/UnderlineOffsetPlugin.js';

// Editor components
export { default as RichTextEditor } from './editors/RichTextEditor.jsx';
export { createEditorConfig } from './editors/editorConfig.js';

// Hooks
export { useCKEditorFonts } from './hooks/useCKEditorFonts.js';

// Utilities
export * from './utils/ckeditorUtils.js';
export * from './utils/dropdownSearchUtils.js';

// Helper to create all plugins at once
export function createAllPlugins(CKEditor) {
  return {
    AlignmentDefaultPlugin: createAlignmentDefaultPlugin(CKEditor),
    CurlyQuotesPlugin: createCurlyQuotesPlugin(CKEditor),
    CustomTableColumnResizePlugin: createCustomTableColumnResizePlugin(CKEditor),
    FontDropdownLabelsPlugin: createFontDropdownLabelsPlugin(CKEditor),
    FontFamilySearchPlugin: createFontFamilySearchPlugin(CKEditor),
    FontSizeSearchPlugin: createFontSizeSearchPlugin(CKEditor),
    FontSymbolSelectorPlugin: createFontSymbolSelectorPlugin(CKEditor),
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
