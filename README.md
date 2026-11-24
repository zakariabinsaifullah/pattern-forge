# Pattern Forge

Pattern Forge helps Claude build WordPress block patterns that open cleanly in the block editor. Give it a
screenshot, a mockup or a written brief and Claude rebuilds the section with core blocks, maps colors, font sizes
and spacing onto your theme's `theme.json` presets, saves a registered pattern file, and validates the markup
before you ever see "This block contains unexpected or invalid content".

It also converts page-builder sections and copied HTML into native blocks, and audits existing patterns,
templates and template parts.

## Install

Install Pattern Forge from the Claude plugin directory. To try a local copy in Claude Code:

```bash
claude --plugin-dir ./pattern-forge
```

## What's included

| Component | What it does |
| --- | --- |
| `build-pattern` skill | Screenshot or brief → `patterns/<name>.php` with header, translations and theme presets. |
| `convert-to-blocks` skill | Elementor / Divi / WPBakery / third-party blocks / raw HTML → core blocks. |
| `validate-patterns` skill | Audits a theme's patterns, templates and parts, explains each problem, and fixes it. |
| `block-markup` skill | Reference Claude follows for exact block serialization (canonical markup for core blocks). |
| `theme-tokens` skill | How Claude reads `theme.json` and maps design values onto presets. |
| Validation hook | After Claude writes or edits a file in `patterns/`, `templates/` or `parts/`, runs the validator and sends any errors back to Claude to fix. |
| `scripts/pattern-forge.mjs` | Dependency-free Node validator and token reader used by the skills and the hook. |

## Usage

Ask in plain language, or call a skill directly:

```
/pattern-forge:build-pattern  [attach a screenshot] a full-width hero for my theme
/pattern-forge:convert-to-blocks  ./exports/elementor-pricing.json
/pattern-forge:validate-patterns  wp-content/themes/my-theme
```

You can also run the validator yourself:

```bash
node scripts/pattern-forge.mjs validate wp-content/themes/my-theme      # scan patterns/, templates/, parts/
node scripts/pattern-forge.mjs validate patterns/hero.php --json         # machine-readable output
node scripts/pattern-forge.mjs validate --stdin --kind pattern-php < draft.php
node scripts/pattern-forge.mjs tokens wp-content/themes/my-theme         # list palette, sizes, spacing
```

## What the validator checks

- Block comment grammar: delimiters, JSON attributes, nesting and closers.
- Wrapper element, base classes and single root element for common core blocks.
- Classes and inline styles derived from attributes (colors, font sizes, alignment, spacing, typography, borders,
  dimensions), in both directions: missing and orphaned.
- Runtime-only classes saved by mistake (`is-layout-*`, `wp-container-*`).
- Parent/child rules (`columns` → `column`, `buttons` → `button`, `list` → `list-item`).
- Dynamic blocks saved with HTML, and static blocks saved self-closing.
- Preset slugs that don't exist in the theme, plus warnings for hard-coded colors, spacing and font sizes.
- Pattern headers (Title, Slug, Categories), duplicate slugs, text-domain mismatches, hot-linked images, and PHP
  inside `.html` templates.

Third-party blocks and complex core blocks (cover, media-text, gallery, table, embed) get structure checks only.

## Requirements

- Node.js 18 or newer on the machine running Claude (the hook and validator use only Node's standard library).
- A block theme with `theme.json` for preset checks. Without one, everything except preset checks still runs.
- The hook runs in Claude Code. In other Claude surfaces the skills still run the validator directly.

## Privacy and network use

Pattern Forge makes no network requests and sends no data anywhere. The hook reads only the file Claude just
wrote or edited and, if found, the nearest `theme.json` and `style.css` above it. It runs only for `.php` and
`.html` files inside `patterns/`, `templates/` or `parts/` folders and ignores everything else. Nothing is stored.

## Development

```bash
node tests/run.mjs                      # run the test suite
claude plugin validate .                # check the plugin structure
```

## License

MIT — see [LICENSE](LICENSE).
