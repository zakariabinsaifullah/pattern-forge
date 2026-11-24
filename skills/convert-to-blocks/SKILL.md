---
name: convert-to-blocks
description: >
  This skill should be used when the user wants existing HTML, a classic-theme template, a page-builder section
  (Elementor, Divi, WPBakery, Beaver Builder, Kadence, GenerateBlocks, Spectra) or a front-end page they copied
  converted into native WordPress core blocks — "convert this to Gutenberg", "migrate this Elementor section",
  "turn this HTML into blocks", "get rid of the page builder".
argument-hint: "<file, pasted HTML or builder export>"
---

# Convert HTML or page-builder content to core blocks

Rebuild the content in `$ARGUMENTS` as clean core-block markup. Load `block-markup` and `theme-tokens` first.

## Steps

1. **Identify the source.**
   - Front-end HTML copied from a browser: strip `is-layout-*`, `wp-container-*` and other runtime classes, plus
     builder wrapper `<div>`s, `data-*` attributes and inline styles that the theme already provides.
   - Elementor / Divi / WPBakery JSON or shortcodes: read the widget tree (section → column → widget) and the
     settings that matter (text, links, image URLs, colors, spacing, alignment).
   - Third-party block markup (`kadence/rowlayout`, `generateblocks/container`, `uagb/*`): read the block attributes
     to recover layout and colors.

2. **Map structure to core blocks.**
   | Source | Core block |
   | --- | --- |
   | Section / row / container | `group` (`align:"full"` + constrained layout) |
   | Columns / inner section | `columns` + `column` (keep width ratios) |
   | Equal-card grids | `group` with `"layout":{"type":"grid","columnCount":N}` |
   | Heading widget | `heading` with the same level |
   | Text editor widget | `paragraph`, `list`, `quote` as appropriate |
   | Button(s) | `buttons` + `button` |
   | Image / image box | `image`, or `group` holding `image` + `heading` + `paragraph` |
   | Background image section | `cover` |
   | Spacer / divider | group padding or `blockGap`; `separator` for visible lines |
   | Icon list | `list`, or flex `group`s with small `image` blocks |
   | Shortcodes | keep as `<!-- wp:shortcode -->…<!-- /wp:shortcode -->` and list them for the user |

3. **Map values to presets** following `theme-tokens`. Drop values equal to the theme defaults.

4. **Preserve content exactly** — text, links, alt text, heading levels. Flag anything that can't be reproduced
   with core blocks (sliders, tabs, animations, forms, popups) and suggest a core alternative or a dedicated
   plugin; don't silently drop it.

5. **Write and validate.** Save as a pattern (`patterns/<name>.php`, see `build-pattern` for the header) or as
   paste-in markup, whichever the user asked for, then run
   `node "${CLAUDE_PLUGIN_ROOT}/scripts/pattern-forge.mjs" validate <file>` and fix all errors.

6. **Report** what was converted, what was approximated, and what needs manual follow-up.
