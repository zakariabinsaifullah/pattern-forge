---
name: theme-tokens
description: >
  This skill should be used when Claude needs to match a design's colors, fonts, font sizes or spacing to a
  WordPress block theme's presets — reading theme.json, choosing palette slugs, "use the theme's colors",
  "match the design to my theme", "which spacing preset", or before writing any block pattern for a theme.
---

# Mapping a design onto theme.json presets

Patterns that use presets follow the theme's global styles, adapt to style variations and stay editable from the Site Editor.
Hard-coded values don't. Prefer presets for every color, font size, font family and spacing value.

## 1. Read the tokens

Run from the theme folder (the one containing `theme.json`), or pass its path:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/pattern-forge.mjs" tokens <theme-dir>
node "${CLAUDE_PLUGIN_ROOT}/scripts/pattern-forge.mjs" tokens <theme-dir> --json
```

It prints the theme name, text domain, `contentSize`/`wideSize`, and every available preset — the theme's own plus
any core defaults the theme hasn't disabled (`defaultPalette`, `defaultFontSizes`, `defaultSpacingSizes`). If no
`theme.json` exists (classic theme or no theme supplied), say so and fall back to core defaults: spacing `20`–`80`,
font sizes `small`–`xx-large`, and the core palette, while flagging that raw colors may be needed.

## 2. Match design values to presets

- **Colors** — map each design color to the nearest palette entry by perceived difference (compare in RGB, weight
  green higher; a difference under ~10% per channel is a match). Background surfaces → `backgroundColor`, text →
  `textColor`, button fills → the button's `backgroundColor`. If a design color has no close match, list it for the
  user and suggest adding it to the palette instead of hard-coding it.
- **Font sizes** — map to the closest `fontSize` slug. Fluid sizes (`clamp()`) match by their max value.
- **Font families** — match by family name; use `fontFamily` only when it differs from what the element inherits.
- **Spacing** — section padding usually maps to the larger steps (`50`–`70`), gaps between items to `30`–`40`.
  Use `var:preset|spacing|<slug>` in `style.spacing`.
- **Widths** — content-width sections use `"layout":{"type":"constrained"}` (inherits `contentSize`); wide rows use
  `"align":"wide"`; edge-to-edge bands use `"align":"full"`.

## 3. Report the mapping

Before writing markup, give the user a short table: design value → preset slug, marking anything left
hard-coded and why. Keep it to the values that were actually used.

## Rules

- Never invent a slug. Use only slugs printed by `tokens`; the validator reports unknown presets as errors.
- Don't override typography or colors that the element already inherits from global styles (for example heading
  font family) unless the design differs.
- In a PHP pattern, the slug namespace (`mytheme/hero`) and translation text domain should match the theme's text domain.
