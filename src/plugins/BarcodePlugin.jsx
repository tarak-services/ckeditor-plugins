import JsBarcode from 'jsbarcode';

/**
 * Utility to dispatch custom alert events that can be caught by AlertContext
 */
const dispatchAlert = (message, type = 'error') => {
  window.dispatchEvent(new CustomEvent('showAlert', {
    detail: { message, type }
  }));
};

/**
 * Generate barcode as data URL
 */
function generateBarcodeDataUrl(text, options = {}) {
  const {
    format = 'CODE128',
    width = 2,
    height = 50,
    displayValue = true,
    fontSize = 12,
    margin = 5
  } = options;

  // Create a canvas element
  const canvas = document.createElement('canvas');

  try {
    JsBarcode(canvas, text, {
      format,
      width,
      height,
      displayValue,
      fontSize,
      margin,
      textMargin: 2
    });

    return canvas.toDataURL('image/png');
  } catch (error) {
    console.error('Error generating barcode:', error);
    throw error;
  }
}

/**
 * Factory function to create BarcodePlugin with CKEditor from CDN
 * @param {Object} CKEditor - CKEditor instance from CDN
 * @returns {Class} BarcodePlugin class
 */
export default function createBarcodePlugin(CKEditor) {
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

  class BarcodePlugin extends Plugin {
    static get pluginName() {
      return 'Barcode';
    }

    static get requires() {
      return [];
    }

    init() {
      const editor = this.editor;

      // Configure schema to allow custom barcode attributes on images
      const schema = editor.model.schema;

      // Allow barcode attributes on imageInline
      schema.extend('imageInline', {
        allowAttributes: ['data-barcode-value', 'data-barcode-format', 'data-barcode-height', 'data-barcode-showtext']
      });

      // Also allow on imageBlock if it exists
      if (schema.isRegistered('imageBlock')) {
        schema.extend('imageBlock', {
          allowAttributes: ['data-barcode-value', 'data-barcode-format', 'data-barcode-height', 'data-barcode-showtext']
        });
      }

      // Set up converters to preserve these attributes in the HTML output
      const conversion = editor.conversion;

      const barcodeAttributes = ['data-barcode-value', 'data-barcode-format', 'data-barcode-height', 'data-barcode-showtext'];

      // Downcast (model -> view): Add attributes to the img element
      conversion.for('downcast').add(dispatcher => {
        for (const attrName of barcodeAttributes) {
          dispatcher.on(`attribute:${attrName}:imageInline`, (evt, data, conversionApi) => {
            if (!conversionApi.consumable.consume(data.item, evt.name)) {
              return;
            }
            const viewWriter = conversionApi.writer;
            const img = conversionApi.mapper.toViewElement(data.item);
            if (img) {
              if (data.attributeNewValue) {
                viewWriter.setAttribute(attrName, data.attributeNewValue, img);
              } else {
                viewWriter.removeAttribute(attrName, img);
              }
            }
          });
        }
      });

      // Upcast (view -> model): Read attributes from the img element
      conversion.for('upcast').add(dispatcher => {
        dispatcher.on('element:img', (evt, data, conversionApi) => {
          const viewItem = data.viewItem;
          const modelRange = data.modelRange;

          if (!modelRange) return;

          const modelElement = modelRange.start.nodeAfter;
          if (!modelElement) return;

          for (const attrName of barcodeAttributes) {
            const attrValue = viewItem.getAttribute(attrName);
            if (attrValue) {
              conversionApi.writer.setAttribute(attrName, attrValue, modelElement);
            }
          }
        }, { priority: 'low' });
      });

      // Add barcode button to toolbar
      editor.ui.componentFactory.add('insertBarcode', locale => {
        const view = new ButtonView(locale);

        view.set({
          label: 'Insert Barcode',
          icon: this._getBarcodeIcon(),
          tooltip: true
        });

        view.on('execute', () => {
          this._showBarcodeDialog(editor);
        });

        return view;
      });
    }

    afterInit() {
      const editor = this.editor;
      const editingView = editor.editing.view;

      // Register the DoubleClickObserver if not already registered
      editingView.addObserver(DoubleClickObserver);

      // Listen for double-click events on barcode images
      this.listenTo(editingView.document, 'dblclick', (evt, data) => {
        try {
          const domTarget = data.domTarget;

          if (!domTarget || domTarget.tagName !== 'IMG') {
            return;
          }

          // Check alt attribute first - this is always set when we insert a barcode
          const alt = domTarget.getAttribute('alt') || '';

          // Also check for data attributes on the DOM element
          const domBarcodeValue = domTarget.getAttribute('data-barcode-value');

          // If this isn't a barcode image, return early
          if (!alt.startsWith('Barcode: ') && !domBarcodeValue) {
            return;
          }

          // Get the view element from the DOM element
          const viewElement = editingView.domConverter.domToView(domTarget);

          // Try to get the model element
          let modelElement = null;

          if (viewElement) {
            try {
              modelElement = editor.editing.mapper.toModelElement(viewElement);
            } catch (e) {
              // Ignore mapping errors
            }
          }

          // Fallback: get from selection
          if (!modelElement) {
            const selection = editor.model.document.selection;
            const selectedElement = selection.getSelectedElement();
            if (selectedElement && selectedElement.name === 'imageInline') {
              modelElement = selectedElement;
            }
          }

          // Another fallback: find nearby image
          if (!modelElement) {
            const selection = editor.model.document.selection;
            const position = selection.getFirstPosition();
            if (position) {
              const nodeBefore = position.nodeBefore;
              const nodeAfter = position.nodeAfter;
              if (nodeBefore && nodeBefore.name === 'imageInline') {
                modelElement = nodeBefore;
              } else if (nodeAfter && nodeAfter.name === 'imageInline') {
                modelElement = nodeAfter;
              }
            }
          }

          // Extract barcode values
          let barcodeValue = domBarcodeValue;
          let barcodeFormat = domTarget.getAttribute('data-barcode-format');
          let barcodeHeight = domTarget.getAttribute('data-barcode-height');
          let barcodeShowText = domTarget.getAttribute('data-barcode-showtext');

          // Try model attributes if DOM doesn't have them
          if (modelElement) {
            if (!barcodeValue) {
              barcodeValue = modelElement.getAttribute('data-barcode-value');
            }
            if (!barcodeFormat) {
              barcodeFormat = modelElement.getAttribute('data-barcode-format');
            }
            if (!barcodeHeight) {
              barcodeHeight = modelElement.getAttribute('data-barcode-height');
            }
            if (barcodeShowText === null || barcodeShowText === undefined) {
              barcodeShowText = modelElement.getAttribute('data-barcode-showtext');
            }
          }

          // Extract from alt as last resort
          if (!barcodeValue && alt.startsWith('Barcode: ')) {
            barcodeValue = alt.substring('Barcode: '.length);
          }

          if (barcodeValue) {
            evt.stop();

            // Select the image element if we have it
            if (modelElement) {
              editor.model.change(writer => {
                const range = writer.createRangeOn(modelElement);
                writer.setSelection(range);
              });
            }

            this._showBarcodeDialog(editor, {
              text: barcodeValue,
              format: barcodeFormat || 'CODE128',
              height: parseInt(barcodeHeight, 10) || 50,
              showText: barcodeShowText !== 'false',
              imageElement: modelElement
            });
          }
        } catch (error) {
          console.error('Error handling barcode double-click:', error);
        }
      }, { priority: 'high' });
    }

    _getBarcodeIcon() {
      return '<svg viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="3" width="2" height="14" fill="currentColor"/><rect x="4" y="3" width="1" height="14" fill="currentColor"/><rect x="6" y="3" width="3" height="14" fill="currentColor"/><rect x="10" y="3" width="1" height="14" fill="currentColor"/><rect x="12" y="3" width="2" height="14" fill="currentColor"/><rect x="15" y="3" width="1" height="14" fill="currentColor"/><rect x="17" y="3" width="2" height="14" fill="currentColor"/></svg>';
    }

    _showBarcodeDialog(editor, editOptions = null) {
      const isEditing = editOptions !== null;
      const initialText = editOptions?.text || '';
      const initialFormat = editOptions?.format || 'CODE128';
      const initialHeight = editOptions?.height || 50;
      const initialShowText = editOptions?.showText !== false;

      // Get variables from editor config
      const barcodeVariables = editor.config.get('qrCodeVariables') || [];

      // Escape HTML to prevent XSS
      const escapeHtml = (text) => {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
      };

      // Create modal dialog
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
        min-width: 450px;
        max-width: 550px;
      `;

      const hasVariables = barcodeVariables.length > 0;

      dialog.innerHTML = `
        <h2 style="margin: 0 0 20px 0; font-size: 20px; font-weight: 600;">${isEditing ? 'Edit Barcode' : 'Insert Barcode'}</h2>

        <div style="margin-bottom: 16px;">
          <label style="display: block; margin-bottom: 8px; font-weight: 500;">Barcode Type:</label>
          <select id="barcode-format" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; box-sizing: border-box;">
            <option value="CODE128" ${initialFormat === 'CODE128' ? 'selected' : ''}>Code 128 (alphanumeric)</option>
            <option value="CODE39" ${initialFormat === 'CODE39' ? 'selected' : ''}>Code 39 (alphanumeric, uppercase)</option>
          </select>
        </div>

        <div style="margin-bottom: 16px; position: relative;">
          <label style="display: block; margin-bottom: 8px; font-weight: 500;">Value:${hasVariables ? ' <span style="font-weight: normal; color: #666; font-size: 12px;">(Type @ to insert variables)</span>' : ''}</label>
          <input type="text" id="barcode-text" placeholder="${hasVariables ? 'Type @ to insert variables' : 'Enter barcode value...'}"
                 value="${escapeHtml(initialText)}"
                 style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; box-sizing: border-box;" autocomplete="off" />
          <div id="barcode-dropdown" style="display: none; position: absolute; top: 100%; left: 0; right: 0; max-height: 200px; overflow-y: auto; background: white; border: 1px solid #ddd; border-top: none; border-radius: 0 0 4px 4px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); z-index: 10001;"></div>
        </div>

        <div style="margin-bottom: 16px;">
          <label style="display: block; margin-bottom: 8px; font-weight: 500;">Height (pixels):</label>
          <input type="number" id="barcode-height" value="${initialHeight}" min="20" max="200" step="5"
                 style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; box-sizing: border-box;" />
        </div>

        <div style="margin-bottom: 20px;">
          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
            <input type="checkbox" id="barcode-showtext" ${initialShowText ? 'checked' : ''} style="width: 16px; height: 16px;" />
            <span style="font-weight: 500;">Show text below barcode</span>
          </label>
        </div>

        <div style="display: flex; gap: 10px; justify-content: flex-end;">
          <button id="barcode-cancel" style="padding: 8px 16px; border: 1px solid #ddd; background: white; color: black; border-radius: 4px; cursor: pointer; font-size: 14px;">Cancel</button>
          <button id="barcode-insert" style="padding: 8px 16px; border: none; background: #007bff; color: white; border-radius: 4px; cursor: pointer; font-size: 14px;">${isEditing ? 'Update' : 'Insert'}</button>
        </div>
      `;

      modal.appendChild(dialog);
      document.body.appendChild(modal);

      const textInput = dialog.querySelector('#barcode-text');
      const formatSelect = dialog.querySelector('#barcode-format');
      const heightInput = dialog.querySelector('#barcode-height');
      const showTextCheckbox = dialog.querySelector('#barcode-showtext');
      const cancelBtn = dialog.querySelector('#barcode-cancel');
      const insertBtn = dialog.querySelector('#barcode-insert');
      const dropdown = dialog.querySelector('#barcode-dropdown');

      // Variable autocomplete state
      let selectedIndex = -1;
      let filteredVariables = [];
      let mentionStartPos = -1;

      const showDropdown = (variables) => {
        filteredVariables = variables;
        selectedIndex = variables.length > 0 ? 0 : -1;

        if (variables.length === 0) {
          dropdown.style.display = 'none';
          return;
        }

        dropdown.innerHTML = variables.map((v, idx) => `
          <div class="barcode-var-item" data-index="${idx}" style="padding: 8px 12px; cursor: pointer; border-bottom: 1px solid #eee; ${idx === selectedIndex ? 'background: #e6f4ff;' : ''}">
            <div style="font-weight: 500; color: #1677ff;">@${escapeHtml(v.key)}</div>
            <div style="font-size: 11px; color: #666;">${escapeHtml(v.label || v.key)}</div>
          </div>
        `).join('');
        dropdown.style.display = 'block';

        dropdown.querySelectorAll('.barcode-var-item').forEach(item => {
          item.addEventListener('click', () => {
            const idx = parseInt(item.dataset.index, 10);
            selectVariable(filteredVariables[idx]);
          });
          item.addEventListener('mouseenter', () => {
            selectedIndex = parseInt(item.dataset.index, 10);
            updateDropdownHighlight();
          });
        });
      };

      const hideDropdown = () => {
        dropdown.style.display = 'none';
        filteredVariables = [];
        selectedIndex = -1;
        mentionStartPos = -1;
      };

      const updateDropdownHighlight = () => {
        dropdown.querySelectorAll('.barcode-var-item').forEach((item, idx) => {
          item.style.background = idx === selectedIndex ? '#e6f4ff' : '';
        });
      };

      const selectVariable = (variable) => {
        if (!variable) return;

        const value = textInput.value;
        const beforeMention = value.substring(0, mentionStartPos);
        const afterCursor = value.substring(textInput.selectionStart);

        textInput.value = beforeMention + '@' + variable.key + afterCursor;
        const newPos = beforeMention.length + variable.key.length + 1;
        textInput.setSelectionRange(newPos, newPos);
        textInput.focus();
        hideDropdown();
      };

      // Handle input for @ mentions
      const handleInput = () => {
        if (!hasVariables) return;

        const value = textInput.value;
        const cursorPos = textInput.selectionStart;

        let atPos = -1;
        for (let i = cursorPos - 1; i >= 0; i--) {
          if (value[i] === '@') {
            atPos = i;
            break;
          }
          if (value[i] === ' ' || value[i] === '\n' || value[i] === '\t') {
            break;
          }
        }

        if (atPos === -1) {
          hideDropdown();
          return;
        }

        mentionStartPos = atPos;
        const searchText = value.substring(atPos + 1, cursorPos).toLowerCase();

        const matches = barcodeVariables.filter(v =>
          v.key.toLowerCase().includes(searchText) ||
          (v.label && v.label.toLowerCase().includes(searchText))
        );

        showDropdown(matches);
      };

      textInput.addEventListener('input', handleInput);

      textInput.addEventListener('keydown', (e) => {
        if (dropdown.style.display === 'none') {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            insertBarcode();
          }
          return;
        }

        if (e.key === 'ArrowDown') {
          e.preventDefault();
          selectedIndex = Math.min(selectedIndex + 1, filteredVariables.length - 1);
          updateDropdownHighlight();
          const item = dropdown.children[selectedIndex];
          if (item) item.scrollIntoView({ block: 'nearest' });
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          selectedIndex = Math.max(selectedIndex - 1, 0);
          updateDropdownHighlight();
          const item = dropdown.children[selectedIndex];
          if (item) item.scrollIntoView({ block: 'nearest' });
        } else if (e.key === 'Enter' || e.key === 'Tab') {
          if (selectedIndex >= 0 && filteredVariables[selectedIndex]) {
            e.preventDefault();
            selectVariable(filteredVariables[selectedIndex]);
          }
        } else if (e.key === 'Escape') {
          hideDropdown();
        }
      });

      textInput.addEventListener('blur', () => {
        setTimeout(() => {
          if (!dropdown.contains(document.activeElement)) {
            hideDropdown();
          }
        }, 150);
      });

      textInput.focus();
      if (isEditing) {
        textInput.select();
      }

      const closeModal = () => {
        document.body.removeChild(modal);
      };

      const insertBarcode = async () => {
        const text = textInput.value.trim();
        const format = formatSelect.value;
        const height = parseInt(heightInput.value, 10);
        const showText = showTextCheckbox.checked;

        if (!text) {
          dispatchAlert('Please enter a value for the barcode.', 'warning');
          return;
        }

        if (isNaN(height) || height < 20 || height > 200) {
          dispatchAlert('Please enter a valid height between 20 and 200 pixels.', 'warning');
          return;
        }

        // For Code 39, validate characters (uppercase letters, numbers, and some special chars)
        if (format === 'CODE39') {
          const hasVars = text.includes('@');
          if (!hasVars && !/^[A-Z0-9\-. $/+%@]*$/i.test(text)) {
            dispatchAlert('Code 39 only supports: A-Z, 0-9, -, ., space, $, /, +, %', 'warning');
            return;
          }
        }

        try {
          // For preview, generate placeholder if there are variables
          const hasVars = text.includes('@');
          const previewText = hasVars ? 'PLACEHOLDER' : text;

          const dataUrl = generateBarcodeDataUrl(previewText, {
            format,
            height,
            displayValue: showText
          });

          editor.model.change(writer => {
            const imageAttrs = {
              src: dataUrl,
              alt: `Barcode: ${text}`,
              'data-barcode-value': text,
              'data-barcode-format': format,
              'data-barcode-height': height.toString(),
              'data-barcode-showtext': showText.toString()
            };

            if (isEditing) {
              const selection = editor.model.document.selection;
              let elementToReplace = selection.getSelectedElement();

              if (!elementToReplace || !elementToReplace.is('element', 'imageInline')) {
                const position = selection.getFirstPosition();
                elementToReplace = position.nodeBefore || position.nodeAfter;
              }

              const imageElement = writer.createElement('imageInline', imageAttrs);

              if (elementToReplace && elementToReplace.is('element', 'imageInline')) {
                const position = writer.createPositionBefore(elementToReplace);
                writer.remove(elementToReplace);
                editor.model.insertContent(imageElement, position);
              } else {
                editor.model.insertContent(imageElement, selection.getFirstPosition());
              }
            } else {
              const imageElement = writer.createElement('imageInline', imageAttrs);
              editor.model.insertContent(imageElement, editor.model.document.selection.getFirstPosition());
            }
          });

          closeModal();
        } catch (error) {
          dispatchAlert(`Error generating barcode: ${error.message}`, 'error');
        }
      };

      cancelBtn.addEventListener('click', closeModal);
      insertBtn.addEventListener('click', insertBarcode);

      const handleEscape = (e) => {
        if (e.key === 'Escape') {
          if (dropdown.style.display !== 'none') {
            hideDropdown();
          } else {
            closeModal();
            document.removeEventListener('keydown', handleEscape);
          }
        }
      };
      document.addEventListener('keydown', handleEscape);

      let clickStartedInDialog = false;
      let preventModalClose = false;

      modal.addEventListener('mousedown', (e) => {
        clickStartedInDialog = dialog.contains(e.target) || e.target === dialog;
      });

      modal.addEventListener('mouseup', (e) => {
        if (clickStartedInDialog && e.target === modal) {
          preventModalClose = true;
        }
        clickStartedInDialog = false;
      });

      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          if (preventModalClose) {
            preventModalClose = false;
            return;
          }
          closeModal();
        }
      });

      dialog.addEventListener('click', (e) => {
        e.stopPropagation();
      });
    }
  }

  return BarcodePlugin;
}
