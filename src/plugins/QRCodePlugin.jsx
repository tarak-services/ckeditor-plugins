import QRCode from 'qrcode';

/**
 * Utility to dispatch custom alert events that can be caught by AlertContext
 */
const dispatchAlert = (message, type = 'error') => {
  // Dispatch a custom event that AlertProvider can listen to
  window.dispatchEvent(new CustomEvent('showAlert', {
    detail: { message, type }
  }));
};

/**
 * Factory function to create QRCodePlugin with CKEditor from CDN
 * @param {Object} CKEditor - CKEditor instance from CDN
 * @returns {Class} QRCodePlugin class
 */
export default function createQRCodePlugin(CKEditor) {
  const { Plugin } = CKEditor;
  const { ButtonView } = CKEditor;
  const { DomEventObserver } = CKEditor;

  // Observer for double-click events
  class DoubleClickObserver extends DomEventObserver {
    constructor(view) {
      super(view);
      this.domEventType = 'dblclick';
    }

    onDomEvent(domEvent) {
      this.fire(domEvent.type, domEvent);
    }
  }

  class QRCodePlugin extends Plugin {
  static get pluginName() {
    return 'QRCode';
  }

  static get requires() {
    return [];
  }

  init() {
    const editor = this.editor;

    // Add QR code button to toolbar
    editor.ui.componentFactory.add('insertQRCode', locale => {
      const view = new ButtonView(locale);

      view.set({
        label: 'Insert QR Code',
        icon: this._getQRCodeIcon(),
        tooltip: true
      });

      view.on('execute', () => {
        this._showQRCodeDialog(editor);
      });

      return view;
    });
  }

  afterInit() {
    const editor = this.editor;
    const editingView = editor.editing.view;

    // Register the DoubleClickObserver
    editingView.addObserver(DoubleClickObserver);

    // Listen for double-click events
    this.listenTo(editingView.document, 'dblclick', (evt, data) => {
      try {
        const domEvent = data.domEvent;
        const domTarget = data.domTarget;

        if (!domTarget || domTarget.tagName !== 'IMG') {
          return;
        }

        // Get the view element from the DOM element
        const viewElement = editingView.domConverter.domToView(domTarget);
        if (!viewElement) {
          return;
        }

        // Try different ways to get the model element
        let modelElement = null;

        // Method 1: Use editing.mapper
        try {
          modelElement = editor.editing.mapper.toModelElement(viewElement);
        } catch (e) {
          console.log('Method 1 failed:', e);
        }

        // Method 2: Use view.mapper if available
        if (!modelElement && editingView.mapper) {
          try {
            modelElement = editingView.mapper.toModelElement(viewElement);
          } catch (e) {
            console.log('Method 2 failed:', e);
          }
        }

        // Method 3: Get from selection if image is selected
        if (!modelElement) {
          const selection = editor.model.document.selection;
          const selectedElement = selection.getSelectedElement();
          if (selectedElement && selectedElement.name === 'imageInline') {
            modelElement = selectedElement;
          }
        }

        // Method 4: Find by traversing from view element's position
        if (!modelElement) {
          const viewPosition = editingView.createPositionAt(viewElement, 0);
          const modelPosition = editor.editing.mapper.toModelPosition(viewPosition);
          if (modelPosition) {
            const modelItem = modelPosition.parent;
            if (modelItem && modelItem.name === 'imageInline') {
              modelElement = modelItem;
            }
          }
        }

        if (!modelElement || modelElement.name !== 'imageInline') {
          return;
        }

        console.log('modelElement', modelElement);
        // Check if it's a QR code image - try model first, then DOM as fallback
        let qrCodeValue = modelElement.getAttribute('data-qrcode-value');
        let sizeAttr = modelElement.getAttribute('data-qrcode-size');
        let alt = modelElement.getAttribute('alt') || '';

        // Also check DOM attributes as fallback (always check for size even if qrCodeValue exists)
        if (!qrCodeValue) {
          qrCodeValue = domTarget.getAttribute('data-qrcode-value');
        }
        if (!sizeAttr) {
          sizeAttr = domTarget.getAttribute('data-qrcode-size');
        }
        if (!alt) {
          alt = domTarget.getAttribute('alt') || '';
        }

        // Also try to get size from width/height attributes if data-qrcode-size is not found
        if (!sizeAttr) {
          const width = modelElement.getAttribute('width') || domTarget.getAttribute('width');
          if (width) {
            sizeAttr = width;
          }
        }

        // Check alt attribute for QR code marker
        if (!qrCodeValue && alt && alt.startsWith('QR Code: ')) {
          qrCodeValue = alt.substring('QR Code: '.length);
        }

        // If we found a QR code value, open the dialog
        if (qrCodeValue) {
          const text = qrCodeValue;
          // Parse size, defaulting to 15 if not found or invalid
          let size = 15;
          if (sizeAttr) {
            const parsedSize = parseInt(sizeAttr, 10);
            if (!isNaN(parsedSize) && parsedSize > 0) {
              size = parsedSize;
            }
          }

          evt.stop();

          // Select the image element so we can find it later when updating
          editor.model.change(writer => {
            const range = writer.createRangeOn(modelElement);
            writer.setSelection(range);
          });

          this._showQRCodeDialog(editor, {
            text: text,
            size: size,
            imageElement: modelElement
          });
        }
      } catch (error) {
        console.error('Error handling QR code double-click:', error);
      }
    }, { priority: 'high' });
  }

  _getQRCodeIcon() {
    return '<svg viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="2" width="6" height="6" fill="currentColor"/><rect x="12" y="2" width="2" height="2" fill="currentColor"/><rect x="16" y="2" width="2" height="2" fill="currentColor"/><rect x="12" y="6" width="2" height="2" fill="currentColor"/><rect x="16" y="6" width="2" height="2" fill="currentColor"/><rect x="2" y="12" width="2" height="2" fill="currentColor"/><rect x="6" y="12" width="2" height="2" fill="currentColor"/><rect x="12" y="12" width="6" height="6" fill="currentColor"/><rect x="2" y="16" width="2" height="2" fill="currentColor"/><rect x="6" y="16" width="2" height="2" fill="currentColor"/></svg>';
  }

  _showQRCodeDialog(editor, editOptions = null) {
    const isEditing = editOptions !== null;
    const initialText = editOptions?.text || '';
    const initialSize = editOptions?.size || 15;
    const existingImageElement = editOptions?.imageElement || null;

    // Escape HTML to prevent XSS
    const escapeHtml = (text) => {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    };

    // Create a simple modal dialog
    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 10000;
    `;

    const dialog = document.createElement('div');
    dialog.style.cssText = `
      background: white;
      padding: 24px;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      min-width: 400px;
      max-width: 500px;
    `;

    dialog.innerHTML = `
      <h2 style="margin: 0 0 20px 0; font-size: 20px; font-weight: 600;">${isEditing ? 'Edit QR Code' : 'Insert QR Code'}</h2>
      <div style="margin-bottom: 16px;">
        <label style="display: block; margin-bottom: 8px; font-weight: 500;">Text/URL:</label>
        <input type="text" id="qrcode-text" placeholder="Enter text or URL..."
               value="${escapeHtml(initialText)}"
               style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; box-sizing: border-box;" />
      </div>
      <div style="margin-bottom: 20px;">
        <label style="display: block; margin-bottom: 8px; font-weight: 500;">Size (pixels):</label>
        <input type="number" id="qrcode-size" value="${initialSize}" min="1" max="1000" step="1"
               style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; box-sizing: border-box;" />
      </div>
      <div style="display: flex; gap: 10px; justify-content: flex-end;">
        <button id="qrcode-cancel" style="padding: 8px 16px; border: 1px solid #ddd; background: white; color: black; border-radius: 4px; cursor: pointer; font-size: 14px;">Cancel</button>
        <button id="qrcode-insert" style="padding: 8px 16px; border: none; background: #007bff; color: white; border-radius: 4px; cursor: pointer; font-size: 14px;">${isEditing ? 'Update' : 'Insert'}</button>
      </div>
    `;

    modal.appendChild(dialog);
    document.body.appendChild(modal);

    const textInput = dialog.querySelector('#qrcode-text');
    const sizeInput = dialog.querySelector('#qrcode-size');
    const cancelBtn = dialog.querySelector('#qrcode-cancel');
    const insertBtn = dialog.querySelector('#qrcode-insert');

    // Focus on text input and select all if editing
    textInput.focus();
    if (isEditing) {
      textInput.select();
    }

    const closeModal = () => {
      document.body.removeChild(modal);
    };

    const insertQRCode = async () => {
      const text = textInput.value.trim();
      const size = parseInt(sizeInput.value, 10);

      if (!text) {
        dispatchAlert('Please enter text or URL for the QR code.', 'warning');
        return;
      }

      if (isNaN(size) || size < 1 || size > 1000) {
        dispatchAlert('Please enter a valid size between 1 and 1000 pixels.', 'warning');
        return;
      }

      const dataUrl = await QRCode.toDataURL(text, {
        width: size,
        margin: 0,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });

      editor.model.change(writer => {
        if (isEditing) {
          const selection = editor.model.document.selection;
          let elementToReplace = null;

          // Try to find the image element to replace
          const selectedElement = selection.getSelectedElement();
          if (selectedElement && selectedElement.is && selectedElement.is('element', 'imageInline')) {
            elementToReplace = selectedElement;
          } else {
            // Check nodes near the selection
            const position = selection.getFirstPosition();
            const nodeBefore = position.nodeBefore;
            const nodeAfter = position.nodeAfter;

            if (nodeBefore && nodeBefore.is && nodeBefore.is('element', 'imageInline')) {
              elementToReplace = nodeBefore;
            } else if (nodeAfter && nodeAfter.is && nodeAfter.is('element', 'imageInline')) {
              elementToReplace = nodeAfter;
            }
          }

          // Create the new image element
          const imageElement = writer.createElement('imageInline', {
            src: dataUrl,
            alt: `QR Code: ${text}`,
            width: size.toString(),
            height: size.toString(),
            'data-qrcode-value': text,
            'data-qrcode-size': size.toString()
          });

          if (elementToReplace && elementToReplace.is && elementToReplace.is('element', 'imageInline')) {
            // Replace the existing image
            const position = writer.createPositionBefore(elementToReplace);
            writer.remove(elementToReplace);
            editor.model.insertContent(imageElement, position);
          } else {
            // If we can't find the element, just insert a new one
            const insertPosition = selection.getFirstPosition();
            editor.model.insertContent(imageElement, insertPosition);
          }
        } else {
          // Insert new image
          const imageElement = writer.createElement('imageInline', {
            src: dataUrl,
            alt: `QR Code: ${text}`,
            width: size.toString(),
            height: size.toString(),
            'data-qrcode-value': text,
            'data-qrcode-size': size.toString()
          });

          // Insert at the current selection position
          const selection = editor.model.document.selection;
          const insertPosition = selection.getFirstPosition();

          editor.model.insertContent(imageElement, insertPosition);
        }
      });

      closeModal();

    };

    cancelBtn.addEventListener('click', closeModal);
    insertBtn.addEventListener('click', insertQRCode);

    // Close on escape key
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        closeModal();
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);

    // Track where mousedown started to prevent closing when dragging from inside to outside
    let clickStartedInDialog = false;
    let preventModalClose = false;

    // Track mousedown - if it starts in dialog, mark it
    modal.addEventListener('mousedown', (e) => {
      // Check if mousedown started inside the dialog (not on modal background)
      clickStartedInDialog = dialog.contains(e.target) || e.target === dialog;
    });

    // Track mouseup - if mousedown was in dialog but mouseup is outside, prevent close
    modal.addEventListener('mouseup', (e) => {
      // If mousedown started in dialog but mouseup is on modal background, prevent close
      if (clickStartedInDialog && e.target === modal) {
        preventModalClose = true;
      }
      clickStartedInDialog = false; // Reset for next interaction
    });

    // Close on background click (but not on dialog content)
    modal.addEventListener('click', (e) => {
      // Only close if clicking directly on the modal background, not on dialog or its children
      if (e.target === modal) {
        // Check if we should prevent closing (due to drag from inside to outside)
        if (preventModalClose) {
          preventModalClose = false;
          return;
        }
        closeModal();
      }
    });

    // Prevent clicks inside dialog from closing the modal
    dialog.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    // Handle Enter key in text input
    textInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        insertQRCode();
      }
    });
  }
  }

  return QRCodePlugin;
}
