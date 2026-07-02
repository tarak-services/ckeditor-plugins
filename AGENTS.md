# CKEditor Plugins (@tarak/ckeditor-plugins)

Shared CKEditor 5 plugins (math, barcode, QR, fonts, tables, layout) consumed by setmaker and packer frontends.

**Source-only ESM package: no build step, no npm scripts, no dist/.** Consumers bundle `src/` directly via Vite `file:../../ckeditor-plugins` dependencies, so this repo must sit as a sibling of setmaker/packer.

## Dev Workflow

Develop through a consumer app — Vite HMR picks up `src/` changes live:

```bash
cd ../setmaker/web && npm run dev      # port 3000
cd ../packer/frontend && npm run dev   # port 4000
```

Consumers need `VITE_CKEDITOR_LICENSE_KEY` in their `.env`. CKEditor comes from npm (`ckeditor5` + `ckeditor5-premium-features`); the README's CDN/`useCKEditorCloud` note is outdated.

## Layout

- `src/index.js` — main entry: re-exports plugins, `createAllPlugins(CKEditor, options)`, `createEditorConfig(CKEditor, customPlugins, mentionFeeds?, licenseKey?)`, `RichTextEditor`, hooks, utils
- `src/plugins/` — 27 plugin factories. Notable: `MathLivePlugin.jsx` (LaTeX via mathlive), `BarcodePlugin.jsx` (jsbarcode), `QRCodePlugin.jsx`, `FontSymbolSelectorPlugin.jsx`, table plugins, margin/alignment plugins
- `src/editors/RichTextEditor.jsx` — drop-in React editor (bundles most plugins; no Barcode)
- `src/editors/editorConfig.js` — shared plugin list, toolbar, htmlSupport config
- `src/styles/` — `RichTextEditor.css`, `MathLiveEditor.css`, `content-output.css` (preview/PDF output); consumers import these explicitly
- `src/utils/`, `src/hooks/` — math/format helpers, `useCKEditorFonts`

## Plugin Pattern

Each plugin is a factory `createXxxPlugin(CKEditor, options?)` that destructures primitives (`Plugin`, `ButtonView`, `Widget`, `Command`, ...) from the passed-in CKEditor namespace and returns a `Plugin` subclass. Use `.jsx` only when the plugin renders React UI (dialogs). Complex plugins use Widget + schema + upcast/downcast converters; toolbar buttons register via `editor.ui.componentFactory.add(...)`.

## Consumer Integration

- Setmaker simple editor: `setmaker/web/src/components/editors/RichTextEditorWrapper.jsx` (wraps `RichTextEditor`)
- Setmaker multi-root: `MultiRootRichTextEditor.jsx` via `createAllPlugins` + `createEditorConfig`
- Packer: `packer/frontend/src/components/LabelContentEditor.jsx` and `RichTextEditor.jsx` (same factory pattern)
- Both consumers set Vite `resolve.dedupe` for `ckeditor5`, `mathlive`, `react`, etc. — required to avoid the `ckeditor-duplicated-modules` runtime error. Keep new deps deduped there too.

Production builds clone this repo in CI and `COPY` it into consumer Docker images.
