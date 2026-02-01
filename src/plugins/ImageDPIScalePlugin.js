/**
 * Factory function to create ImageDPIScalePlugin with CKEditor from CDN
 *
 * This plugin adds a toolbar button to scale images from print DPI (293) to
 * screen DPI (96). Click the button when an image is selected to apply scaling.
 *
 * Scale factor: 96/293 = 0.328
 * Example: A 744px wide image at 293 DPI displays at 244px (96 DPI)
 *
 * @param {Object} CKEditor - CKEditor instance from CDN
 * @returns {Class} ImageDPIScalePlugin class
 */
export default function createImageDPIScalePlugin(CKEditor) {
  const { Plugin, ButtonView } = CKEditor;

  // DPI configuration
  const SOURCE_DPI = 293;  // Images are uploaded at this DPI
  const TARGET_DPI = 96;   // Screen displays at this DPI
  const SCALE_FACTOR = TARGET_DPI / SOURCE_DPI;

  class ImageDPIScalePlugin extends Plugin {
    static get pluginName() {
      return 'ImageDPIScale';
    }

    init() {
      const editor = this.editor;

      // Register the button in the UI
      editor.ui.componentFactory.add('imageDPIScale', locale => {
        const button = new ButtonView(locale);

        button.set({
          label: 'Scale for Print DPI',
          tooltip: 'Scale image from 293 DPI to 96 DPI for correct screen display',
          withText: true,
          class: 'ck-button-dpi-scale'
        });

        // Execute scaling when button is clicked
        button.on('execute', () => {
          this._scaleSelectedImage();
        });

        return button;
      });
    }

    /**
     * Scale the currently selected image
     */
    _scaleSelectedImage() {
      const editor = this.editor;
      const selection = editor.model.document.selection;
      const selectedElement = selection.getSelectedElement();

      // Check if an image is selected
      if (!selectedElement ||
          (selectedElement.name !== 'imageInline' && selectedElement.name !== 'imageBlock')) {
        return;
      }

      // Skip QR code images
      const alt = selectedElement.getAttribute('alt') || '';
      if (alt.startsWith('QR Code:')) {
        return;
      }

      // Get the image source
      const src = selectedElement.getAttribute('src');
      if (!src) {
        return;
      }

      // Load the image to get its natural dimensions
      this._getImageDimensions(src).then(dimensions => {
        if (!dimensions) return;

        // Check if editor is still valid
        if (!editor || editor.state === 'destroyed') {
          return;
        }

        const { naturalWidth } = dimensions;

        // Calculate scaled width for 96 DPI display
        const scaledWidth = Math.round(naturalWidth * SCALE_FACTOR);

        // Apply the scaled width to the image
        try {
          editor.model.change(writer => {
            // Check if the element still exists in the model
            if (selectedElement.parent) {
              writer.setAttribute('resizedWidth', `${scaledWidth}px`, selectedElement);
            }
          });
        } catch (error) {
          console.error('Error scaling image:', error);
        }
      });
    }

    /**
     * Get natural dimensions of an image from its source
     */
    _getImageDimensions(src) {
      return new Promise((resolve) => {
        const img = new Image();

        img.onload = () => {
          resolve({
            naturalWidth: img.naturalWidth,
            naturalHeight: img.naturalHeight
          });
        };

        img.onerror = () => {
          resolve(null);
        };

        img.src = src;
      });
    }
  }

  return ImageDPIScalePlugin;
}
