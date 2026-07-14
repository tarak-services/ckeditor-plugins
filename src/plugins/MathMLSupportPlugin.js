export default function createMathMLSupportPlugin(CKEditor) {
  const { Plugin } = CKEditor;

  class MathMLSupportPlugin extends Plugin {
    static get pluginName() {
      return 'MathMLSupportPlugin';
    }

    init() {
      const editor = this.editor;
      if (!editor.plugins.has('DataSchema') || !editor.plugins.has('DataFilter')) {
        return;
      }

      const dataSchema = editor.plugins.get('DataSchema');
      const dataFilter = editor.plugins.get('DataFilter');

      const mathElements = ['math', 'semantics', 'mrow', 'mi', 'mo', 'mn', 'annotation', 'msup', 'msub', 'msubsup', 'mfrac', 'msqrt', 'mroot', 'mfenced', 'mtable', 'mtr', 'mtd', 'mspace', 'mtext', 'mpadded', 'mphantom', 'menclose', 'merror', 'mstyle', 'mover', 'munder', 'munderover', 'maligngroup', 'malignmark'];

      mathElements.forEach(el => {
        dataSchema.registerInlineElement({
          view: el,
          model: `html_${el}`
        });
        
        dataFilter.allowElement(el);
        dataFilter.allowAttributes({
          name: el,
          attributes: true,
          classes: true,
          styles: true
        });
      });
    }
  }

  return MathMLSupportPlugin;
}
