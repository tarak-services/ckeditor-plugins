import { useState, useEffect, useRef } from 'react';

const FALLBACK_FONTS = [
  'Arial',
  'Helvetica',
  'Times New Roman',
  'Courier New'
];

// Quote names with spaces for CSS, and put the default family first.
const formatFontOptions = (fonts, defaultFontFamily) => {
  const formattedFonts = fonts.map(font => (font.includes(' ') ? `"${font}"` : font));
  if (!defaultFontFamily) return formattedFonts;
  const formattedDefault = defaultFontFamily.includes(' ')
    ? `"${defaultFontFamily}"`
    : defaultFontFamily;
  const filteredFonts = formattedFonts.filter(
    f => f !== formattedDefault &&
         f !== `"${formattedDefault}"` &&
         f !== formattedDefault.replace(/"/g, '')
  );
  return [formattedDefault, ...filteredFonts];
};

/**
 * Custom hook to load and format CKEditor fonts
 * Handles default font family prioritization
 *
 * @param {string|null} defaultFontFamily - Font to prioritize at the top of the list
 * @param {Function|null} fontLoader - Optional async function that returns an array of font names
 *                                     If not provided, uses fallback fonts
 * @param {string[]|null} initialFonts - Optional font names already loaded by the caller. Starting
 *                                       with the same list the loader returns keeps the option count
 *                                       stable, so editors keyed on it are not built twice.
 */
export const useCKEditorFonts = (defaultFontFamily = null, fontLoader = null, initialFonts = null) => {
  const [fontFamilyOptions, setFontFamilyOptions] = useState(() => (
    initialFonts?.length ? formatFontOptions(initialFonts, defaultFontFamily) : FALLBACK_FONTS
  ));

  // Track if component is mounted to avoid state updates after unmount
  const isMountedRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;

    const loadFonts = async () => {
      try {
        // Use provided fontLoader or skip if not provided
        if (!fontLoader) {
          // No fontLoader provided, just set default font if provided
          if (defaultFontFamily) {
            const formattedDefault = defaultFontFamily.includes(' ')
              ? `"${defaultFontFamily}"`
              : defaultFontFamily;
            setFontFamilyOptions([formattedDefault, ...FALLBACK_FONTS]);
          }
          return;
        }

        const fonts = await fontLoader();

        // Only update state if component is still mounted
        if (!isMountedRef.current) return;

        if (fonts && fonts.length > 0) {
          setFontFamilyOptions(formatFontOptions(fonts, defaultFontFamily));
        } else {
          // If no fonts from loader, use default font family if provided
          if (defaultFontFamily) {
            const formattedDefault = defaultFontFamily.includes(' ')
              ? `"${defaultFontFamily}"`
              : defaultFontFamily;
            setFontFamilyOptions([formattedDefault, ...FALLBACK_FONTS]);
          }
        }
      } catch (error) {
        // Only update state if component is still mounted
        if (!isMountedRef.current) return;

        console.error('Failed to load fonts:', error);
        // On error, still set default font if provided
        if (defaultFontFamily) {
          const formattedDefault = defaultFontFamily.includes(' ')
            ? `"${defaultFontFamily}"`
            : defaultFontFamily;
          setFontFamilyOptions([formattedDefault, ...FALLBACK_FONTS]);
        }
      }
    };

    loadFonts();

    return () => {
      isMountedRef.current = false;
    };
  }, [defaultFontFamily, fontLoader]);

  return fontFamilyOptions;
};
