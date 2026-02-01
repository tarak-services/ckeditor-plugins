import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import styles from './FontSymbolSelectorPlugin.module.css';

const FontSymbolSelectorDialog = ({ isOpen, onClose, onInsert, getAvailableFonts, getFontSupportedGlyphs }) => {
  const [fonts, setFonts] = useState([]);
  const [selectedFont, setSelectedFont] = useState('');
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingGlyphs, setLoadingGlyphs] = useState(false);

  // Fetch available fonts (only those with font files in fonts directory)
  useEffect(() => {
    let isMounted = true;

    const fetchFonts = async () => {
      try {
        const allFonts = await getAvailableFonts();
        // Filter to only fonts that have a path (i.e., actual font files in fonts dir)
        const fontsWithFiles = allFonts
          .filter(font => font.path && font.path.length > 0)
          .map(font => ({ value: font.name, label: font.name }));

        if (isMounted && fontsWithFiles.length > 0) {
          setFonts(fontsWithFiles);
          setSelectedFont(fontsWithFiles[0].value);
        } else if (isMounted) {
          setFonts([]);
        }
      } catch (error) {
        console.error('Error fetching fonts:', error);
        if (isMounted) setFonts([]);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchFonts();

    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch supported glyphs when font changes and generate characters
  useEffect(() => {
    let isMounted = true;
    if (!selectedFont) return;

    const fetchGlyphs = async () => {
      setLoadingGlyphs(true);
      try {
        const glyphs = await getFontSupportedGlyphs(selectedFont);
        if (isMounted && glyphs) {
          // Convert Set of char codes to sorted array of characters
          const chars = Array.from(glyphs)
            .sort((a, b) => a - b)
            .map(code => String.fromCharCode(code));
          setCharacters(chars);
        } else if (isMounted) {
          setCharacters([]);
        }
      } catch (e) {
        if (isMounted) setCharacters([]);
      } finally {
        if (isMounted) setLoadingGlyphs(false);
      }
    };

    fetchGlyphs();

    return () => { isMounted = false; };
  }, [selectedFont]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div className={styles.overlay} onClick={(e) => {
      if (e.target === e.currentTarget) onClose();
    }}>
      <div className={styles.dialog}>
        <div className={styles.header}>
          <h3 className={styles.headerTitle}>Symbol Selector</h3>
          <button className={styles.closeButton} onClick={onClose} title="Close">
            &times;
          </button>
        </div>

        <div className={styles.content}>
          <div className={styles.controlsRow}>
            <div className={styles.controlGroup}>
              <label htmlFor="font-selector" className={styles.controlLabel}>Font:</label>
              <select
                id="font-selector"
                className={styles.controlSelect}
                value={selectedFont}
                onChange={(e) => setSelectedFont(e.target.value)}
                disabled={loading || fonts.length === 0}
              >
                {fonts.length > 0 ? (
                  fonts.map(font => (
                    <option key={font.value} value={font.value}>
                      {font.label}
                    </option>
                  ))
                ) : (
                  <option value="">No fonts available</option>
                )}
              </select>
            </div>
            {characters.length > 0 && (
              <span className={styles.charCount}>{characters.length} characters</span>
            )}
          </div>

          <div className={styles.gridContainer}>
            {loadingGlyphs ? (
              <div style={{textAlign: 'center', padding: '40px', color: '#666'}}>
                Loading characters...
              </div>
            ) : (
              <div className={styles.characterGrid}>
                {characters.map((char, index) => (
                  <button
                    key={index}
                    className={styles.charButton}
                    style={{ fontFamily: selectedFont }}
                    onClick={() => onInsert(char, selectedFont)}
                    title={`Insert ${char} (U+${char.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')})`}
                  >
                    {char}
                  </button>
                ))}
                {characters.length === 0 && (
                  <div style={{gridColumn: '1/-1', textAlign: 'center', padding: '20px', color: '#666'}}>
                    No characters available for the selected font.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className={styles.footer}>
          <button className={styles.cancelButton} onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default FontSymbolSelectorDialog;
