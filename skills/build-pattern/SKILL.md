---
name: build-pattern
description: >
  This skill should be used when the user asks to turn a screenshot, mockup, Figma frame, URL description or
  written brief into a WordPress block pattern — "build this section as a pattern", "make a pattern from this
  image", "recreate this design in Gutenberg", "create a hero/pricing/testimonial/footer pattern for my theme".
argument-hint: "<screenshot or description> [slug]"
---

# Build a block pattern from a design

Turn the design in `$ARGUMENTS` (an attached image, a description, or both) into a registered, validated block
pattern made of core blocks. Load the `block-markup` and `theme-tokens` skills first; they hold the markup rules.

## Steps

1. **Find the theme.** Look for `theme.json` in the working folder or the path the user gave. Read its tokens with
   `node "${CLAUDE_PLUGIN_ROOT}/scripts/pattern-forge.mjs" tokens <theme-dir>`. Note the text domain and existing
   files in `patterns/`. If there's no theme, ask whether to write a standalone `.html` snippet (paste-in markup) or
   a theme pattern file, and default to the snippet when no one answers.

2. **Read the design.** Break it into sections, top to bottom. For each, note layout (stack, row, grid, columns and
   their ratios), content (headings with their level, text, images, buttons, icons, lists), colors, font sizes,
   spacing, alignment, and width (content, wide, full). Write this outline down briefly before any markup.

3. **Choose blocks.** Prefer the simplest core block that reproduces the layout:
   - Section band → `group` (`align:"full"`, constrained layout, padding).
   - Side by side with set ratios → `columns`/`column`; equal cards → `group` with `"layout":{"type":"grid"}`.
   - Inline items (logo + nav, icon + text) → `group` with flex layout.
   - Image with text over it → `cover`. Image beside text → `columns` (or `media-text` if the user wants it).
   - Call to action → `buttons`/`button`. Icons → `image` with an SVG asset, or `social-links` for social icons.
   - Use `spacer` only when padding or `blockGap` can't produce the gap.

4. **Map to presets** following `theme-tokens`, and show the user the value → preset table.

5. **Write the pattern.** For a theme, create `patterns/<name>.php`:
   ```php
   <?php
   /**
    * Title: Hero with image
    * Slug: <text-domain>/hero-with-image
    * Categories: banner, call-to-action
    * Keywords: hero, header, intro
    * Viewport Width: 1400
    */
   ?>
   <!-- block markup -->
   ```
   - Wrap visible text in `<?php esc_html_e( 'Text', '<text-domain>' ); ?>` and attribute text (alt, URLs) in
     `esc_attr_e` / `esc_url`.
   - Reference bundled images with `<?php echo esc_url( get_theme_file_uri( 'assets/images/<file>' ) ); ?>`.
     If the design has photos, use placeholders in `assets/images/` and tell the user which files to replace.
   - Use realistic copy taken from the design; never lorem ipsum unless the design shows it.
   - Add `Block Types: core/template-part/header` (or `/footer`, or `core/post-content`) when the pattern is a
     header, footer or page starter.
   - Use a `Categories:` value from the core list (about, banner, buttons, call-to-action, columns, contact,
     featured, footer, gallery, header, media, portfolio, posts, services, team, testimonials, text, videos).

6. **Validate and fix.** Run
   `node "${CLAUDE_PLUGIN_ROOT}/scripts/pattern-forge.mjs" validate patterns/<name>.php`
   and fix every error. The plugin's hook also checks pattern files automatically after each save; treat its
   report the same way. Repeat until clean.

7. **Hand off.** Give the user: the file path, the outline of blocks used, the preset mapping, anything that
   couldn't be matched exactly (custom fonts, effects core blocks can't do, such as complex animations or overlapping
   elements), and placeholder images to replace. Suggest opening the pattern once in the editor to confirm.

## Fidelity rules

- Reproduce structure and hierarchy faithfully; approximate effects that core blocks can't express and say so.
- Keep headings in a logical order (one `h1` only in page-level patterns; section patterns start at `h2`).
- Give every meaningful image real `alt` text; decorative images get `alt=""`.
- Buttons link to `#` unless the design shows a destination.
- Don't add custom CSS. If the design truly needs it, propose a block style (`register_block_style`) or a
  `theme.json` style instead, and ask first.
