# @dil/ckeditor-plugins

Custom CKEditor 5 plugins and components for rich text editing.

## Installation

### From Git URL

```bash
npm install git+https://github.com/yourorg/ckeditor-plugins.git#main
```

Or in `package.json`:

```json
{
  "dependencies": {
    "@dil/ckeditor-plugins": "git+https://github.com/yourorg/ckeditor-plugins.git#main"
  }
}
```

### Peer Dependencies

Make sure you have these installed in your project:

```bash
npm install react react-dom @ckeditor/ckeditor5-react
```

## Usage

### Quick Start with RichTextEditor Component

```jsx
import { RichTextEditor } from '@dil/ckeditor-plugins';
import '@dil/ckeditor-plugins/src/styles/RichTextEditor.css';
import '@dil/ckeditor-plugins/src/styles/MathLiveEditor.css';

function MyEditor() {
  const [content, setContent] = useState('');

  return (
    <RichTextEditor
      value={content}
      onChange={setContent}
      placeholder="Enter content..."
      defaultFontFamily="Arial"
      defaultFontSize="12pt"
    />
  );
}
```

### With Custom Font Loader

```jsx
import { RichTextEditor } from '@dil/ckeditor-plugins';

// Your custom function to fetch fonts from your API
const loadFonts = async () => {
  const response = await fetch('/api/fonts');
  const data = await response.json();
  return data.map(font => font.name); // Return array of font names
};

function MyEditor() {
  return (
    <RichTextEditor
      value={content}
      onChange={setContent}
      fontLoader={loadFonts}
    />
  );
}
```

### Using Individual Plugins

```jsx
import { useCKEditorCloud } from '@ckeditor/ckeditor5-react';
import {
  createMathLivePlugin,
  createLineHeightPlugin,
  createEditorConfig,
  createAllPlugins
} from '@dil/ckeditor-plugins';

function CustomEditor() {
  const cloud = useCKEditorCloud({ version: '47.2.0', premium: true });

  if (cloud.status !== 'success') return <div>Loading...</div>;

  // Option 1: Create specific plugins
  const customPlugins = {
    MathLivePlugin: createMathLivePlugin(cloud.CKEditor),
    LineHeightPlugin: createLineHeightPlugin(cloud.CKEditor),
  };

  // Option 2: Create all plugins at once
  const allPlugins = createAllPlugins(cloud.CKEditor);

  const { sharedPlugins, sharedDefaultConfig } = createEditorConfig(
    cloud.CKEditor,
    customPlugins // or allPlugins
  );

  // ... use with CKEditor
}
```

## Available Plugins

| Plugin | Description |
|--------|-------------|
| `MathLivePlugin` | LaTeX math equation editor with MathLive |
| `MathSymbolsPlugin` | Symbol picker for math symbols |
| `LineHeightPlugin` | Line height control dropdown |
| `TableBorderPlugin` | Table border style controls |
| `QRCodePlugin` | QR code generator |
| `FontFamilySearchPlugin` | Searchable font family dropdown |
| `FontSizeSearchPlugin` | Searchable font size dropdown |
| `TextDirectionPlugin` | LTR/RTL text direction controls |
| `AlignmentDefaultPlugin` | Default alignment settings |
| `TextAlignLastPlugin` | Text-align-last CSS property |
| `ImageDPIScalePlugin` | Image DPI scaling controls |
| `ImageVerticalAlignPlugin` | Vertical alignment for inline images |
| `TableCellBaselinePlugin` | Baseline alignment for table cells |
| `FontSymbolSelectorPlugin` | Special character/symbol picker |
| `UnderlineOffsetPlugin` | Custom underline with offset |
| `TableColumnResizeOverridePlugin` | Custom table column resize behavior |
| `CustomTableColumnResizePlugin` | Enhanced table column resize |
| `SoftBreakVisibilityPlugin` | Shows soft breaks (BR) visually |
| `CurlyQuotesPlugin` | Smart curly quotes insertion |
| `FontDropdownLabelsPlugin` | Font dropdown label formatting |
| `MarginTopPlugin` | Margin top controls |

## Configuration

### RichTextEditor Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | string | `''` | HTML content |
| `onChange` | function | - | Called with new HTML when content changes |
| `placeholder` | string | `'Enter content...'` | Placeholder text |
| `variables` | array | `[]` | Mention variables (prefixed with @) |
| `minHeight` | string | `'200px'` | Minimum editor height |
| `maxWidth` | number | `null` | Maximum editor width in pixels |
| `defaultFontFamily` | string | `null` | Default font family |
| `defaultFontSize` | string | `null` | Default font size (e.g., '12pt') |
| `defaultLineHeight` | string | `null` | Default line height (e.g., '18pt') |
| `defaultTextAlignment` | string | `null` | Default text alignment |
| `variant` | string | `'full'` | `'full'` or `'slim'` toolbar |
| `disabled` | boolean | `false` | Read-only mode |
| `fontLoader` | function | `null` | Async function returning font names array |

## License

This package requires a CKEditor license. Each project using this package needs:
1. A valid CKEditor license key (set via `VITE_CKEDITOR_LICENSE_KEY` env var)
2. Domain authorization in your CKEditor dashboard

## Updating

```bash
# Force reinstall latest from git
npm install @dil/ckeditor-plugins@git+https://github.com/yourorg/ckeditor-plugins.git#main --force

# Or pin to a specific tag
npm install @dil/ckeditor-plugins@git+https://github.com/yourorg/ckeditor-plugins.git#v1.0.0
```
