/**
 * Utility functions for CKEditor configuration and styling
 */

/**
 * Format font family for CSS (wrap in quotes if it contains spaces)
 */
export const formatFontForCSS = (fontFamily) => {
  if (!fontFamily) return null;

  return fontFamily.includes(' ') && !fontFamily.startsWith('"')
    ? `"${fontFamily}"`
    : fontFamily;
};

/**
 * Format font size for CSS (ensure it has 'pt' unit)
 */
export const formatFontSizeForCSS = (fontSize) => {
  if (!fontSize) return null;

  return typeof fontSize === 'number' ? `${fontSize}pt` : fontSize;
};

/**
 * Format line height for CSS (ensure it has 'pt' unit)
 */
export const formatLineHeightForCSS = (lineHeight) => {
  if (!lineHeight) return null;

  return typeof lineHeight === 'number' ? `${lineHeight}pt` : lineHeight;
};

/**
 * Build inline styles with CSS variables for CKEditor
 */
export const buildEditorStyles = ({
  defaultFontFamily = null,
  defaultFontSize = null,
  defaultLineHeight = null,
  defaultFontWeight = null,
  maxWidth = null,
  defaultTextAlignment = null
} = {}) => {
  const inlineStyles = {};

  const formattedFont = formatFontForCSS(defaultFontFamily);
  if (formattedFont) {
    inlineStyles['--default-font-family'] = formattedFont;
  }

  const formattedFontSize = formatFontSizeForCSS(defaultFontSize);
  if (formattedFontSize) {
    inlineStyles['--default-font-size'] = formattedFontSize;
  }

  const formattedLineHeight = formatLineHeightForCSS(defaultLineHeight);
  if (formattedLineHeight) {
    inlineStyles['--default-line-height'] = formattedLineHeight;
  }

  if (defaultFontWeight) {
    inlineStyles['--default-font-weight'] = defaultFontWeight;
  }

  if (maxWidth) {
    inlineStyles['--editor-max-width'] = `${maxWidth}px`;
  }

  if (defaultTextAlignment) {
    inlineStyles['--default-text-alignment'] = defaultTextAlignment;
  }

  return inlineStyles;
};

/**
 * Build CKEditor configuration object
 */
export const buildEditorConfig = ({
  fontFamilyOptions = [],
  placeholder = '',
  variables = []
} = {}) => {
  return {
    placeholder,
    variables,
    fontFamily: {
      options: fontFamilyOptions,
      supportAllValues: true
    },
    fontSize: {
      options: [
        { title: '8pt', model: '8pt' },
        { title: '8.5pt', model: '8.5pt' },
        { title: '9pt', model: '9pt' },
        { title: '9.5pt', model: '9.5pt' },
        { title: '10pt', model: '10pt' },
        { title: '10.5pt', model: '10.5pt' },
        { title: '11pt', model: '11pt' },
        { title: '11.5pt', model: '11.5pt' },
        { title: '12pt', model: '12pt' },
        { title: '12.5pt', model: '12.5pt' },
        { title: '13pt', model: '13pt' },
        { title: '13.5pt', model: '13.5pt' },
        { title: '14pt', model: '14pt' },
        { title: '14.5pt', model: '14.5pt' },
        { title: '15pt', model: '15pt' },
        { title: '15.5pt', model: '15.5pt' },
        { title: '16pt', model: '16pt' },
        { title: '16.5pt', model: '16.5pt' },
        { title: '17pt', model: '17pt' },
        { title: '17.5pt', model: '17.5pt' },
        { title: '18pt', model: '18pt' },
        { title: '18.5pt', model: '18.5pt' },
        { title: '19pt', model: '19pt' },
        { title: '19.5pt', model: '19.5pt' },
        { title: '20pt', model: '20pt' },
        { title: '20.5pt', model: '20.5pt' },
        { title: '21pt', model: '21pt' },
        { title: '21.5pt', model: '21.5pt' },
        { title: '22pt', model: '22pt' },
        { title: '22.5pt', model: '22.5pt' },
        { title: '23pt', model: '23pt' },
        { title: '23.5pt', model: '23.5pt' },
        { title: '24pt', model: '24pt' },
        { title: '24.5pt', model: '24.5pt' },
        { title: '25pt', model: '25pt' },
        { title: '25.5pt', model: '25.5pt' },
        { title: '26pt', model: '26pt' },
        { title: '26.5pt', model: '26.5pt' },
        { title: '27pt', model: '27pt' },
        { title: '27.5pt', model: '27.5pt' },
        { title: '28pt', model: '28pt' },
        { title: '28.5pt', model: '28.5pt' },
        { title: '29pt', model: '29pt' },
        { title: '29.5pt', model: '29.5pt' },
        { title: '30pt', model: '30pt' },
        { title: '30.5pt', model: '30.5pt' },
        { title: '31pt', model: '31pt' },
        { title: '31.5pt', model: '31.5pt' },
        { title: '32pt', model: '32pt' },
        { title: '32.5pt', model: '32.5pt' },
        { title: '33pt', model: '33pt' },
        { title: '33.5pt', model: '33.5pt' },
        { title: '34pt', model: '34pt' },
        { title: '34.5pt', model: '34.5pt' },
        { title: '35pt', model: '35pt' },
      ],
      supportAllValues: true
    }
  };
};
