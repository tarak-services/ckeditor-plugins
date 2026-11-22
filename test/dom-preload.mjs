import { register } from 'node:module';
import { JSDOM } from 'jsdom';

class NativeResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost/',
  pretendToBeVisual: true
});
const { window } = dom;
window.ResizeObserver = NativeResizeObserver;

const assign = (key, value) => {
  Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
};

assign('window', window);
assign('document', window.document);
assign('navigator', window.navigator);
assign('getComputedStyle', window.getComputedStyle.bind(window));
assign('requestAnimationFrame', (cb) => setTimeout(() => cb(Date.now()), 16));
assign('cancelAnimationFrame', (id) => clearTimeout(id));

for (const key of Object.getOwnPropertyNames(window)) {
  if (/^(HTML|SVG|DOM|Node|Element|Document|Range|Event|Keyboard|Mouse|Input|UI|Mutation|File|Blob|Data|Selection|Text|Comment|Attr|Named|CSS|Custom|Pointer|Focus|Wheel|Clipboard|Drag)/.test(key)) {
    try {
      assign(key, window[key]);
    } catch {
      // Some host globals are read-only and unused by the editor.
    }
  }
}

const pending = register(new URL('./module-hook.mjs', import.meta.url));
if (pending && typeof pending.then === 'function') {
  await pending;
}
