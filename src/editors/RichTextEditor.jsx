import React, { useState, useRef, useEffect } from 'react';
import { CKEditor, useCKEditorCloud } from '@ckeditor/ckeditor5-react';
import { createEditorConfig } from './editorConfig.js';
import createMathSymbolsPlugin from '../plugins/MathSymbolsPlugin.jsx';
import createMathLivePlugin from '../plugins/MathLivePlugin.jsx';
import createTableBorderPlugin from '../plugins/TableBorderPlugin.jsx';
import createQRCodePlugin from '../plugins/QRCodePlugin.jsx';
import createLineHeightPlugin from '../plugins/LineHeightPlugin.jsx';
import createFontFamilySearchPlugin from '../plugins/FontFamilySearchPlugin.js';
import createFontSizeSearchPlugin from '../plugins/FontSizeSearchPlugin.js';
import createTextDirectionPlugin from '../plugins/TextDirectionPlugin.jsx';
import createAlignmentDefaultPlugin from '../plugins/AlignmentDefaultPlugin.js';
import createTextAlignLastPlugin from '../plugins/TextAlignLastPlugin.js';
import createImageDPIScalePlugin from '../plugins/ImageDPIScalePlugin.js';
import createImageVerticalAlignPlugin from '../plugins/ImageVerticalAlignPlugin.js';
import createTableCellBaselinePlugin from '../plugins/TableCellBaselinePlugin.js';
import createFontSymbolSelectorPlugin from '../plugins/FontSymbolSelectorPlugin.jsx';
import createUnderlineOffsetPlugin from '../plugins/UnderlineOffsetPlugin.js';
import createTableColumnResizeOverridePlugin from '../plugins/TableColumnResizeOverridePlugin.js';
import createCustomTableColumnResizePlugin from '../plugins/CustomTableColumnResizePlugin.js';
import createSoftBreakVisibilityPlugin from '../plugins/SoftBreakVisibilityPlugin.js';
import createCurlyQuotesPlugin from '../plugins/CurlyQuotesPlugin.js';
import createFontDropdownLabelsPlugin from '../plugins/FontDropdownLabelsPlugin.js';
import createMarginTopPlugin from '../plugins/MarginTopPlugin.js';

import { useCKEditorFonts } from '../hooks/useCKEditorFonts.js';
import { buildEditorStyles, buildEditorConfig as buildUtilConfig } from '../utils/ckeditorUtils.js';
import '../styles/MathLiveEditor.css';
import '../styles/RichTextEditor.css';


// Slim toolbar for compact spaces (single row, essential formatting only)
const SLIM_TOOLBAR = {
  items: [
    'bold', 'italic', 'underlineOffset', 'strikethrough', '|',
    'superscript', 'subscript', '|',
    'bulletedList', 'numberedList', '|',
    'MathLive', 'mathSymbols', '|',
    'sourceEditing'
  ],
  shouldNotGroupWhenFull: false
};

const RichTextEditor = ({
  value = '',
  onChange,
  placeholder = 'Enter content...',
  variables = [],
  minHeight = '200px',
  maxWidth = null,
  defaultFontFamily = null,
  defaultFontSize = null,
  defaultLineHeight = null,
  defaultFontWeight = null,
  defaultTextAlignment = null,
  variant = 'full', // 'full' | 'slim'
  disabled = false,
  fontLoader = null, // Optional async function that returns array of font names
  licenseKey = null, // CKEditor license key (required)
  getAvailableFonts = null, // Optional function for FontSymbolSelector
  getFontSupportedGlyphs = null // Optional function for FontSymbolSelector
}) => {
  const [editorValue, setEditorValue] = useState(value);
  const editorRef = useRef(null);
  const initialValueRef = useRef(value);
  const isInitializedRef = useRef(false);

  // Load CKEditor from CDN
  const cloud = useCKEditorCloud({
    version: '47.2.0',
    premium: true // Enable premium features
  });

  // Load fonts using custom hook
  const fontFamilyOptions = useCKEditorFonts(defaultFontFamily, fontLoader);

  // Update internal state when external value changes
  useEffect(() => {
    setEditorValue(value);
    initialValueRef.current = value;
  }, [value]);

  const handleChange = (event, editor) => {
    const data = editor.getData();
    setEditorValue(data);

    // Only call onChange if the data has actually changed from the initial value
    if (isInitializedRef.current && data !== initialValueRef.current) {
      onChange(data);
    }
  };

  const handleReady = (editor) => {
    editorRef.current = editor;
    const editable = editor.editing.view.document.getRoot();
    if (editable) {
      editor.editing.view.change((writer) => {
        writer.setStyle('min-height', minHeight, editable);
      });
    }

    if (disabled) {
      editor.enableReadOnlyMode('disabled');
    }

    // Mark as initialized after a short delay
    setTimeout(() => {
      isInitializedRef.current = true;
    }, 100);
  };

  // Show loading state
  if (cloud.status === 'loading') {
    return (
      <div className="rich-text-editor">
        <div className="editor-loading">Loading editor...</div>
      </div>
    );
  }

  // Show error state
  if (cloud.status === 'error') {
    console.error('CKEditor loading error:', cloud.error);
    return (
      <div className="rich-text-editor">
        <div className="editor-error">Error loading editor. Please refresh the page.</div>
      </div>
    );
  }

  // CKEditor loaded successfully
  const { ClassicEditor } = cloud.CKEditor;

  // Create custom plugins with CDN CKEditor (pass the full CKEditor object)
  const customPlugins = {
    MathSymbolsPlugin: createMathSymbolsPlugin(cloud.CKEditor),
    MathLivePlugin: createMathLivePlugin(cloud.CKEditor),
    TableBorderPlugin: createTableBorderPlugin(cloud.CKEditor),
    QRCodePlugin: createQRCodePlugin(cloud.CKEditor),
    LineHeightPlugin: createLineHeightPlugin(cloud.CKEditor),
    FontFamilySearchPlugin: createFontFamilySearchPlugin(cloud.CKEditor),
    FontSizeSearchPlugin: createFontSizeSearchPlugin(cloud.CKEditor),
    TextDirectionPlugin: createTextDirectionPlugin(cloud.CKEditor),
    AlignmentDefaultPlugin: createAlignmentDefaultPlugin(cloud.CKEditor),
    TextAlignLastPlugin: createTextAlignLastPlugin(cloud.CKEditor),
    ImageDPIScalePlugin: createImageDPIScalePlugin(cloud.CKEditor),
    ImageVerticalAlignPlugin: createImageVerticalAlignPlugin(cloud.CKEditor),
    TableCellBaselinePlugin: createTableCellBaselinePlugin(cloud.CKEditor),
    FontSymbolSelectorPlugin: createFontSymbolSelectorPlugin(cloud.CKEditor, { getAvailableFonts, getFontSupportedGlyphs }),
    UnderlineOffsetPlugin: createUnderlineOffsetPlugin(cloud.CKEditor),
    TableColumnResizeOverridePlugin: createTableColumnResizeOverridePlugin(cloud.CKEditor),
    CustomTableColumnResizePlugin: createCustomTableColumnResizePlugin(cloud.CKEditor),
    SoftBreakVisibilityPlugin: createSoftBreakVisibilityPlugin(cloud.CKEditor),
    CurlyQuotesPlugin: createCurlyQuotesPlugin(cloud.CKEditor),
    FontDropdownLabelsPlugin: createFontDropdownLabelsPlugin(cloud.CKEditor),
    MarginTopPlugin: createMarginTopPlugin(cloud.CKEditor)
  };

  // Get editor configuration from factory
  const { sharedPlugins, sharedDefaultConfig } = createEditorConfig(
    cloud.CKEditor,
    customPlugins,
    null, // mentionFeeds
    licenseKey
  );

  // Build additional config from utilities
  const utilConfig = buildUtilConfig({
    fontFamilyOptions,
    placeholder,
    variables
  });

  // Build mention config from variables if provided
  const mentionConfig = variables.length > 0 ? {
    mention: {
      feeds: [{
        marker: '@',
        feed: variables.map(v => `@${v}`),
        minimumCharacters: 0
      }]
    }
  } : {};

  // Merge configurations
  const finalConfig = {
    ...sharedDefaultConfig,
    ...utilConfig,
    ...mentionConfig,
    plugins: sharedPlugins,
    // Use slim toolbar for compact variant
    ...(variant === 'slim' && { toolbar: SLIM_TOOLBAR }),
    // Pass default alignment to the AlignmentDefaultPlugin
    alignment: {
      ...sharedDefaultConfig.alignment,
      defaultAlignment: defaultTextAlignment || 'left'
    },
    // Pass defaults for FontDropdownLabelsPlugin and LineHeightPlugin
    fontDefaults: {
      fontFamily: defaultFontFamily,
      fontSize: defaultFontSize,
      lineHeight: defaultLineHeight
    }
  };

  // Build inline styles
  const inlineStyles = buildEditorStyles({
    defaultFontFamily,
    defaultFontSize,
    defaultLineHeight,
    maxWidth,
    defaultTextAlignment
  });

  const classNames = [
    'rich-text-editor',
    variant === 'slim' && 'rich-text-editor--slim',
    disabled && 'rich-text-editor--disabled'
  ].filter(Boolean).join(' ');

  return (
    <div
      className={classNames}
      style={inlineStyles}
    >
      <div className="editor-content">
        <CKEditor
          editor={ClassicEditor}
          data={editorValue}
          onChange={handleChange}
          onReady={handleReady}
          config={finalConfig}
          disabled={disabled}
          key={`editor-${fontFamilyOptions.length}`}
        />
      </div>
    </div>
  );
};

export default RichTextEditor;
