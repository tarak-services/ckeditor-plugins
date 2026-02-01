/**
 * Factory function to create editor configuration with CKEditor from CDN
 * @param {Object} CKEditor - CKEditor instance from CDN
 * @param {Object} customPlugins - Object containing custom plugin classes
 * @param {Array} mentionFeeds - Optional array of mention feeds (only for makesets/subject pages)
 * @param {string} licenseKey - CKEditor license key (required)
 * @returns {Object} { sharedPlugins, sharedDefaultConfig }
 */
export function createEditorConfig(CKEditor, customPlugins = {}, mentionFeeds = null, licenseKey = null) {
  // Extract all needed CKEditor components
  const {
    Essentials,
    Bold,
    Italic,
    Underline,
    Strikethrough,
    Superscript,
    Subscript,
    Font,
    FontFamily,
    FontSize,
    Link,
    List,
    Paragraph,
    Typing,
    Heading,
    Alignment,
    RemoveFormat,
    Widget,
    Mention,
    Table,
    TableToolbar,
    TableProperties,
    TableCellProperties,
    TableCaption,
    TableLayout, // Premium feature for layout tables
    PlainTableOutput, // Removes figure wrapper from tables
    ImageInline,
    ImageInsert,
    ImageToolbar,
    ImageResize, // Main resize plugin (includes buttons)
    ImageResizeEditing,
    ImageResizeHandles,
    ImageUpload,
    Base64UploadAdapter,
    SourceEditing,
    GeneralHtmlSupport
  } = CKEditor;

  // Shared plugins configuration
  const sharedPlugins = [
    Essentials,
    Bold,
    Italic,
    Underline,
    Strikethrough,
    Superscript,
    Subscript,
    Font,
    FontFamily,
    FontSize,
    List,
    Paragraph,
    Typing,
    Heading,
    Alignment,
    RemoveFormat,
    Widget,
    Mention,
    PlainTableOutput, // MUST come before Table to remove figure wrapper
    Table,
    TableToolbar,
    TableProperties,
    TableCellProperties,
    TableCaption,
    TableLayout, // Premium feature for layout tables
    ImageInline,
    ImageInsert,
    ImageToolbar,
    ImageResize,
    ImageResizeEditing,
    ImageResizeHandles,
    ImageUpload,
    Base64UploadAdapter,
    SourceEditing,
    GeneralHtmlSupport,
    // Add custom plugins
    ...(customPlugins.MathLivePlugin ? [customPlugins.MathLivePlugin] : []),
    ...(customPlugins.TableBorderPlugin ? [customPlugins.TableBorderPlugin] : []),
    ...(customPlugins.QRCodePlugin ? [customPlugins.QRCodePlugin] : []),
    ...(customPlugins.FontFamilySearchPlugin ? [customPlugins.FontFamilySearchPlugin] : []),
    ...(customPlugins.FontSizeSearchPlugin ? [customPlugins.FontSizeSearchPlugin] : []),
    ...(customPlugins.LineHeightPlugin ? [customPlugins.LineHeightPlugin] : []),
    ...(customPlugins.MathSymbolsPlugin ? [customPlugins.MathSymbolsPlugin] : []),
    ...(customPlugins.TextDirectionPlugin ? [customPlugins.TextDirectionPlugin] : []),
    ...(customPlugins.AlignmentDefaultPlugin ? [customPlugins.AlignmentDefaultPlugin] : []),
    ...(customPlugins.TextAlignLastPlugin ? [customPlugins.TextAlignLastPlugin] : []),
    ...(customPlugins.ImageDPIScalePlugin ? [customPlugins.ImageDPIScalePlugin] : []),
    ...(customPlugins.ImageVerticalAlignPlugin ? [customPlugins.ImageVerticalAlignPlugin] : []),
    ...(customPlugins.TableCellBaselinePlugin ? [customPlugins.TableCellBaselinePlugin] : []),
    ...(customPlugins.FontSymbolSelectorPlugin ? [customPlugins.FontSymbolSelectorPlugin] : []),
    ...(customPlugins.UnderlineOffsetPlugin ? [customPlugins.UnderlineOffsetPlugin] : []),
    ...(customPlugins.TableColumnResizeOverridePlugin ? [customPlugins.TableColumnResizeOverridePlugin] : []),
    ...(customPlugins.CustomTableColumnResizePlugin ? [customPlugins.CustomTableColumnResizePlugin] : []),
    ...(customPlugins.SoftBreakVisibilityPlugin ? [customPlugins.SoftBreakVisibilityPlugin] : []),
    ...(customPlugins.CurlyQuotesPlugin ? [customPlugins.CurlyQuotesPlugin] : []),
    ...(customPlugins.FontDropdownLabelsPlugin ? [customPlugins.FontDropdownLabelsPlugin] : []),
    ...(customPlugins.MarginTopPlugin ? [customPlugins.MarginTopPlugin] : [])
  ];

  // Shared default configuration
  const sharedDefaultConfig = {
    licenseKey: licenseKey,
    // Force all paste operations to be plain text (Ctrl+V = plain text)
    clipboard: {
      pasteAsPlainText: true
    },
    toolbar: {
      items: [
        'fontFamily', 'fontSize', 'lineHeight', '|',
        'bold', 'italic', 'underlineOffset', 'strikethrough', 'superscript', 'subscript', '|',
        'alignment', 'textAlignLast', 'textDirectionLTR', 'textDirectionRTL', '|',
        'bulletedList', 'numberedList', '|',
        'insertTableLayout', 'tableStyles', '|',
        'MathLive', 'mathSymbols', 'FontSymbolSelector', 'curlyQuotes', '|',
        'imageUpload', 'insertQRCode', '|',
        'sourceEditing', '|',
        'marginTop', '|',
        'removeFormat'
      ],
      shouldNotGroupWhenFull: true
    },
    // Only include mention configuration if mentionFeeds is provided (for makesets/subject pages)
    ...(mentionFeeds && {
      mention: {
        feeds: mentionFeeds
      }
    }),
    table: {
      contentToolbar: [
        'tableColumn',
        'tableRow',
        'mergeTableCells',
        'tableProperties',
        'tableCellProperties',
        'tableCellVerticalAlignmentBaseline',
        'toggleTableCaption',
        'marginTop'
      ],
      tableCellProperties: {
        defaultProperties: {
          horizontalAlignment: 'left',
          padding: '0'
        }
      },
      tableLayout: {
        preferredExternalTableType: 'layout' // Default to layout tables (no borders/padding)
      },
      // Allow columns to be resized to very small widths (remove default 40px minimum)
      tableColumnResize: {
        minColumnWidth: '1px'
      },
      // Disable figure wrapper for tables
      tableWidget: {
        tableToolbar: ['tableColumn', 'tableRow', 'mergeTableCells']
      }
    },
    image: {
      insert: {
        type: 'inline'
      },
      toolbar: [
        'imageTextAlternative',
        '|',
        'imageResize',
        '|',
        'imageVerticalAlign:top',
        'imageVerticalAlign:middle',
        'imageVerticalAlign:bottom',
        'imageVerticalAlign:baseline',
        '|',
        'imageTopOffset',
        '|',
        'marginTop',
        '|',
        'imageDPIScale'
      ]
    },
    htmlSupport: {
      allow: [
        {
          name: /.*/,
          attributes: true,
          classes: true,
          styles: true
        }
      ],
      disallow: []
    },
    alignment: {
      options: [
        { name: 'left', className: 'text-align-left' },
        { name: 'center', className: 'text-align-center' },
        { name: 'right', className: 'text-align-right' },
        { name: 'justify', className: 'text-align-justify' }
      ]
    }
  };

  return { sharedPlugins, sharedDefaultConfig };
}
