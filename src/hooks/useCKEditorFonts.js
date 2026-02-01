import { useState, useEffect, useRef } from 'react';

/**
 * Custom hook to load and format CKEditor fonts
 * Handles default font family prioritization
 *
 * @param {string|null} defaultFontFamily - Font to prioritize at the top of the list
 * @param {Function|null} fontLoader - Optional async function that returns an array of font names
 *                                     If not provided, uses fallback fonts
 */
export const useCKEditorFonts = (defaultFontFamily = null, fontLoader = null) => {
  const [fontFamilyOptions, setFontFamilyOptions] = useState([
    'Arial',
    'Helvetica',
    'Times New Roman',
    'Courier New'
  ]);

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
            setFontFamilyOptions([
              formattedDefault,
              'Arial',
              'Helvetica',
              'Times New Roman',
              'Courier New'
            ]);
          }
          return;
        }

        const fonts = await fontLoader();

        // Only update state if component is still mounted
        if (!isMountedRef.current) return;

        if (fonts && fonts.length > 0) {
          // Format fonts for CKEditor - ensure they're valid font-family values
          const formattedFonts = fonts.map(font => {
            // If font name contains spaces, wrap it in quotes for CSS
            if (font.includes(' ')) {
              return `"${font}"`;
            }
            return font;
          });

          // If a default font family is provided, put it first in the list
          if (defaultFontFamily) {
            const formattedDefault = defaultFontFamily.includes(' ')
              ? `"${defaultFontFamily}"`
              : defaultFontFamily;
            // Remove the default font if it already exists in the list, then add it at the front
            const filteredFonts = formattedFonts.filter(
              f => f !== formattedDefault &&
                   f !== `"${formattedDefault}"` &&
                   f !== formattedDefault.replace(/"/g, '')
            );
            setFontFamilyOptions([formattedDefault, ...filteredFonts]);
          } else {
            setFontFamilyOptions(formattedFonts);
          }
        } else {
          // If no fonts from loader, use default font family if provided
          if (defaultFontFamily) {
            const formattedDefault = defaultFontFamily.includes(' ')
              ? `"${defaultFontFamily}"`
              : defaultFontFamily;
            setFontFamilyOptions([
              formattedDefault,
              'Arial',
              'Helvetica',
              'Times New Roman',
              'Courier New'
            ]);
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
          setFontFamilyOptions([
            formattedDefault,
            'Arial',
            'Helvetica',
            'Times New Roman',
            'Courier New'
          ]);
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
