/**
 * Factory function to create SoftBreakVisibilityPlugin with CKEditor from CDN
 * This plugin makes <br> tags visible in the editor as deletable placeholder boxes
 * @param {Object} CKEditor - CKEditor instance from CDN
 * @returns {Class} SoftBreakVisibilityPlugin class
 */
export default function createSoftBreakVisibilityPlugin(CKEditor) {
  const { Plugin } = CKEditor;

  /**
   * SoftBreakVisibilityPlugin - Makes line breaks (<br>) visible in the editor
   * Users can see and delete them easily
   */
  class SoftBreakVisibilityPlugin extends Plugin {
    static get pluginName() {
      return 'SoftBreakVisibility';
    }

    init() {
      const editor = this.editor;

      // Override the editing downcast for softBreak to show a visible indicator
      // The softBreak element is CKEditor's internal representation of <br>
      editor.conversion.for('editingDowncast').elementToElement({
        model: 'softBreak',
        view: (modelElement, { writer }) => {
          // Create a container span that holds both the visual indicator and the actual br
          const container = writer.createContainerElement('span', {
            class: 'ck-soft-break-indicator'
          });

          // Create the actual br element (needed for proper line breaking)
          const brElement = writer.createEmptyElement('br');

          // Insert the br into the container
          writer.insert(writer.createPositionAt(container, 0), brElement);

          return container;
        },
        converterPriority: 'high'
      });

      // Keep the data downcast as regular <br> for output
      // This is already handled by CKEditor's default, but we ensure it
      editor.conversion.for('dataDowncast').elementToElement({
        model: 'softBreak',
        view: (modelElement, { writer }) => {
          return writer.createEmptyElement('br');
        },
        converterPriority: 'high'
      });
    }
  }

  return SoftBreakVisibilityPlugin;
}
