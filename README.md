# CKEditor Plugins — Local Development

Shared CKEditor 5 plugin package (`@tarak/ckeditor-plugins`) providing math (MathLive), barcode (JsBarcode), QR code, and rich text editing plugins.

## Prerequisites

- Node.js 18+
- A consumer app to run the plugins (setmaker or packer)

## Setup

```bash
cd ckeditor-plugins
npm install
```

This package has **no build step or dev server** — it is consumed as source by apps that bundle it via Vite.

## How It Works

Consumer apps reference this package as a file dependency:

```json
"@tarak/ckeditor-plugins": "file:../../ckeditor-plugins"
```

CKEditor itself is loaded from CDN (v47.2.0, premium) via `useCKEditorCloud` — no local CKEditor build is needed.

## Developing Plugins

Since there's no standalone dev server, work on plugins by running a consumer app:

### With SetMaker

```bash
cd setmaker/web
npm install        # links ckeditor-plugins via file:
npm run dev        # Vite dev server on port 3000
```

### With Packer

```bash
cd packer/frontend
npm install        # links ckeditor-plugins via file:
npm run dev        # Vite dev server on port 4000
```

Changes to files in `ckeditor-plugins/src/` are picked up by Vite's HMR in the consumer app.

## Environment Variables

Consumer apps must set:

| Variable | Description |
|----------|-------------|
| `VITE_CKEDITOR_LICENSE_KEY` | CKEditor premium license key (set in the consumer app's `.env`) |

## Package Exports

The package exports from `src/index.js`:

- `RichTextEditor` — drop-in React component with all plugins wired up
- `createAllPlugins()` — returns array of all custom CKEditor plugins
- `createEditorConfig()` — returns a full CKEditor config with toolbar, plugins, and defaults
- Individual plugins from `@tarak/ckeditor-plugins/plugins/*`
- Editor components from `@tarak/ckeditor-plugins/editors/*`

## Plugins

| Plugin | Library | Description |
|--------|---------|-------------|
| MathLive | `mathlive` | LaTeX math input and rendering |
| Barcode | `jsbarcode` | Barcode generation (canvas → PNG) |
| QR Code | `qrcode` | QR code insertion |
| Table Layout | — | Enhanced table support |
| Font Symbol | — | Special character/symbol picker |
| Line Height | — | Line height control |
| Margins | — | Top/bottom margin adjustment |
| Underline Offset | — | Customizable underline |
| Text Direction | — | LTR/RTL toggle |
| Curly Quotes | — | Smart quote insertion |

## Deployment

In production, consumer apps pull this package from GitHub instead of the local `file:` dependency. Docker is not used for local development.
