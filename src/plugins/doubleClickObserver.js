const observerByBase = new WeakMap();

/**
 * One dblclick observer class per CKEditor build. view.addObserver() dedupes by
 * class, so plugins that each defined their own class registered two observers
 * and every double-click fired twice (two edit dialogs stacked on top of each other).
 */
export function getDoubleClickObserver(CKEditor) {
  const { DomEventObserver } = CKEditor;
  let Observer = observerByBase.get(DomEventObserver);
  if (!Observer) {
    Observer = class DoubleClickObserver extends DomEventObserver {
      constructor(view) {
        super(view);
        this.domEventType = 'dblclick';
      }

      onDomEvent(domEvent) {
        this.fire(domEvent.type, domEvent);
      }
    };
    observerByBase.set(DomEventObserver, Observer);
  }
  return Observer;
}
