# Common mistakes in generated block markup

Check for each of these when reviewing markup. The validator rule name is in brackets.

1. **Styling the HTML instead of the attributes** — `style="padding:40px"` with no `style.spacing.padding`
   in the JSON. Move the value into the attribute and regenerate. [orphan-style]
2. **Saving runtime layout classes** — `is-layout-flex`, `is-layout-constrained`, `wp-container-core-group-is-layout-1`,
   `is-content-justification-center`. These come from copying front-end HTML. The editor keeps them as custom
   classes forever, where they can clash with the generated layout styles. Delete them. [runtime-class]
3. **Heading tag vs. level** — `<h3>` with no `"level":3`. [wrong-tag]
4. **Missing base classes** — `wp-block-group`, `wp-block-button__link wp-element-button` (error);
   `wp-block-heading`, `wp-block-list` (warning: older markup that WordPress upgrades on save). [missing-class]
5. **Attribute without class or style** — `backgroundColor` set but no `has-…-background-color`, padding in the
   JSON but not in `style=""`, `aspectRatio` on an image without `aspect-ratio` on the `<img>`, a `buttons` font
   size without `has-custom-font-size`. The editor either rejects the block or quietly drops the attribute. [missing-class] [missing-style]
6. **Class without attribute** — `has-primary-color` with no `textColor:"primary"`. The block still loads: the editor
   moves the class into `className`, so it renders but the color picker doesn't know about it. Add the attribute
   or remove the class. [orphan-class]
7. **Values that don't match** — attribute says `#ff0000`, style says `#f00`. Values must match character for
   character after whitespace is ignored. When they don't, the editor can garble the content while recovering. [style-mismatch]
8. **Broken delimiters** — `<!--wp:paragraph-->`, missing closers, mismatched closers, trailing commas in JSON. [malformed-delimiter] [invalid-json] [mismatched-closer]
9. **Wrong nesting** — `column` outside `columns`, `button` outside `buttons`, paragraphs directly inside `list`. The
   editor loads it, but users can't insert or move blocks like that, so editing gets awkward. [wrong-parent] [wrong-child]
10. **HTML in dynamic blocks** — writing `<p>Site name</p>` inside `wp:site-title`. Make it self-closing. [dynamic-has-html]
11. **Self-closing static blocks** — `<!-- wp:paragraph /-->`. Static blocks always save HTML. [self-closing-static]
12. **Two root elements** — `<p>a</p><p>b</p>` in one paragraph block. Split into two blocks. [multiple-roots]
13. **Presets that don't exist** — `"backgroundColor":"accent"` when the theme palette has no `accent`. The block
    validates but renders unstyled. Use `tokens` to see real slugs. [unknown-preset]
14. **Loose HTML between blocks** — becomes a Classic block. [freeform-content]
15. **Hot-linked images in theme patterns** — bundle images and use `get_theme_file_uri()`. [external-image]
16. **PHP in .html templates** — it never runs. Put dynamic content in a PHP pattern and reference it with
    `<!-- wp:pattern {"slug":"…"} /-->`. [php-in-template]
17. **Outdated shapes that still load** — button font size on the wrapper `<div>` instead of the `<a>`
    [class-placement], cover overlay `<span>` before the background `<img>` [cover-structure], raw `<li>` items
    instead of `list-item` blocks [legacy-list], heading `align` used for text alignment [legacy-attribute]. WordPress
    converts these on save, so the pattern changes the first time someone edits it. Use the current shape from
    `core-blocks.md`.
