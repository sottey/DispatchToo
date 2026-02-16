# Markdown Support Matrix

Validation target:
- File: `/Users/seanottey/Downloads/markdown-test-file.md`
- Renderer stack: `react-markdown` + `remark-gfm` + `rehype-raw` + `rehype-sanitize` + `rehype-highlight`

## Supported

| Feature | Status | Notes |
| --- | --- | --- |
| Headings | Supported | `#` through `#####` rendered as heading elements. |
| Emphasis | Supported | Italic, bold, bold+italic rendered correctly. |
| Blockquotes | Supported | Standard and nested blockquotes render. |
| Ordered/unordered lists | Supported | Nested list structures render correctly. |
| Task lists | Supported | GFM checkboxes render as checkbox inputs. |
| Tables | Supported | GFM table syntax renders with `table/thead/tbody`. |
| Strikethrough | Supported | `~~text~~` renders as `<del>`. |
| Links/autolinks/email links | Supported | Inline, reference, URL autolinks, and mailto links render. |
| Footnotes | Supported | Footnotes render with footnote section output. |
| Fenced code blocks | Supported | Triple-backtick blocks render as `<pre><code>`. |
| Syntax highlighting | Supported | Language classes and `hljs` token output present. |
| Images | Supported | Markdown image syntax renders image tags. |
| Image title text | Supported | Image title attribute is preserved. |

## Partially Supported

| Feature | Status | Notes |
| --- | --- | --- |
| Image attribute extensions | Partial | Custom reference attributes like `height=... width=...` are not preserved by current sanitize config. |

## Unsupported / Not Enabled

| Feature | Status | Notes |
| --- | --- | --- |
| `{{TOC}}` placeholder | Unsupported | Renders as literal text. |
| Definition lists | Unsupported | `term` + `: definition` does not produce `<dl>`. |
| CriticMarkup | Unsupported | Syntax remains literal text. |
| Subscript (`H~2~O`) | Unsupported | No subscript transform configured. |
| Superscript (`X^2^`) | Unsupported | No superscript transform configured. |
| Highlight (`==text==`) | Unsupported | No `<mark>` transform configured. |
| Mermaid diagrams | Unsupported | Mermaid blocks remain code blocks; no diagram runtime/rendering configured. |
| Math/LaTeX rendering | Unsupported | No KaTeX/MathJax pipeline configured. |

## Sanitized/Stripped by Current HTML Policy

| Input | Result |
| --- | --- |
| Raw `<div>...</div>` wrappers in markdown | Stripped by sanitize stage. |
| Inline `<style>...</style>` | Stripped by sanitize stage. |

