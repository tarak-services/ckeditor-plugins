/**
 * Plugin to show current font family and font size values in toolbar dropdown buttons.
 * CKEditor's built-in font dropdowns don't support withText by default.
 * This plugin enables it so users can see the currently applied font/size at a glance.
 *
 * @param {Object} CKEditor - CKEditor instance from CDN
 * @returns {Class} FontDropdownLabelsPlugin class
 */
export default function createFontDropdownLabelsPlugin(CKEditor) {
  const { Plugin } = CKEditor;

  class FontDropdownLabelsPlugin extends Plugin {
    static get pluginName() {
      return 'FontDropdownLabels';
    }

    init() {
      const editor = this.editor;

      // Wait for UI to be ready, then set up the labels
      editor.ui.once('ready', () => {
        // Small delay to ensure toolbar is fully rendered
        setTimeout(() => {
          this._setupAllDropdowns();
        }, 300);
      });
    }

    /**
     * Setup all font-related dropdowns
     */
    _setupAllDropdowns() {
      const editor = this.editor;
      const toolbar = editor.ui.view.toolbar;

      if (!toolbar?.items) {
        console.warn('FontDropdownLabelsPlugin: toolbar or items not found');
        return;
      }

      const fontFamilyCommand = editor.commands.get('fontFamily');
      const fontSizeCommand = editor.commands.get('fontSize');

      // Get default values from editor config (passed from React component props)
      const fontDefaults = editor.config.get('fontDefaults') || {};
      const defaultFontFamily = fontDefaults.fontFamily;
      const defaultFontSize = fontDefaults.fontSize;

      // Convert items to array for easier iteration
      const items = Array.from(toolbar.items);

      let fontFamilyButton = null;
      let fontSizeButton = null;

      // Find dropdowns by checking tooltip and label (case-insensitive)
      for (const item of items) {
        // Must be a dropdown (has isOpen property and buttonView)
        if (item.isOpen === undefined || !item.buttonView) continue;

        // Get tooltip - it could be a string or boolean
        let tooltipText = '';
        if (typeof item.buttonView.tooltip === 'string') {
          tooltipText = item.buttonView.tooltip.toLowerCase();
        }

        const buttonLabel = (item.buttonView.label || '').toLowerCase();

        // Also check aria-label on the element
        const ariaLabel = (item.buttonView.element?.getAttribute('aria-label') || '').toLowerCase();

        // Check for font family
        if (!fontFamilyButton && fontFamilyCommand) {
          if (tooltipText.includes('font family') ||
              buttonLabel.includes('font family') ||
              ariaLabel.includes('font family')) {
            fontFamilyButton = item.buttonView;
          }
        }

        // Check for font size
        if (!fontSizeButton && fontSizeCommand) {
          if (tooltipText.includes('font size') ||
              buttonLabel.includes('font size') ||
              ariaLabel.includes('font size') ||
              tooltipText === 'size') {
            fontSizeButton = item.buttonView;
          }
        }
      }

      // Setup the labels with default values and add custom classes for CSS targeting
      if (fontFamilyButton) {
        this._setupLabelUpdates(fontFamilyButton, fontFamilyCommand, 'fontFamily', defaultFontFamily);
        // Add class to parent dropdown for CSS targeting
        const fontFamilyDropdown = fontFamilyButton.element?.closest('.ck-dropdown');
        if (fontFamilyDropdown) {
          fontFamilyDropdown.classList.add('ck-font-family-dropdown');
        }
      }

      if (fontSizeButton) {
        this._setupLabelUpdates(fontSizeButton, fontSizeCommand, 'fontSize', defaultFontSize);
        // Add class to parent dropdown for CSS targeting
        const fontSizeDropdown = fontSizeButton.element?.closest('.ck-dropdown');
        if (fontSizeDropdown) {
          fontSizeDropdown.classList.add('ck-font-size-dropdown');
        }
      }
    }

    /**
     * Setup label updates using command change listeners
     */
    _setupLabelUpdates(buttonView, command, type, defaultValue) {
      // Enable text display on the button
      buttonView.set('withText', true);

      // Helper to format the label
      const formatLabel = (value) => {
        // Use explicit value if set, otherwise use the default
        const displayValue = value || defaultValue;

        if (!displayValue) {
          return type === 'fontFamily' ? 'Font Family' : 'Font Size';
        }

        if (type === 'fontFamily') {
          // Clean up font name: remove quotes, take first font from stack
          let fontName = String(displayValue).replace(/['"]/g, '').split(',')[0].trim();
          // Truncate if too long
          if (fontName.length > 20) {
            fontName = fontName.substring(0, 18) + '...';
          }
          return fontName;
        } else {
          // Font size - ensure it has 'pt' suffix
          const sizeStr = String(displayValue);
          return sizeStr.endsWith('pt') ? sizeStr : `${sizeStr}pt`;
        }
      };

      // Set initial label
      buttonView.set('label', formatLabel(command.value));

      // Listen for command value changes
      command.on('change:value', (evt, name, value) => {
        buttonView.set('label', formatLabel(value));
      });
    }
  }

  return FontDropdownLabelsPlugin;
}
