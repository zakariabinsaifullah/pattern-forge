# Common mistakes in generated block markup

Check for each of these when reviewing markup. The validator rule name is in brackets.

1. **Styling the HTML instead of the attributes** — `style="padding:40px"` with no `style.spacing.padding`
   in the JSON. Move the value into the attribute and regenerate. [orphan-style]
2. **Saving runtime layout classes** — `is-layout-flex`, `is-layout-constrained`, `wp-container-core-group-is-layout-1`,
   `is-content-justification-center`. These come from copying front-end HTML. Delete them. [runtime-class]
3. **Heading tag vs. level** — `<h3>` with no `"level":3`. [wrong-tag]
4. **Missing base classes** — `wp-block-heading`, `wp-block-group`, `wp-block-button__link wp-element-button`. [missing-class]
5. **Class without attribute / attribute without class** — `has-primary-color` without `textColor:"primary"`,
   or `backgroundColor` set but no `has-…-background-color`. [orphan-class] [missing-class]
6. **Values that don't match** — attribute says `#ff0000`, style says `#f00`. Values must match character for
   character after whitespace is ignored. [style-mismatch]
7. **Broken delimiters** — `<!--wp:paragraph-->`, missing closers, mismatched closers, trailing commas in JSON. [malformed-delimiter] [invalid-json] [mismatched-closer]
8. **Wrong nesting** — `column` outside `columns`, `button` outside `buttons`, paragraphs directly inside `list`. [wrong-parent] [wrong-child]
9. **HTML in dynamic blocks** — writing `<p>Site name</p>` inside `wp:site-title`. Make it self-closing. [dynamic-has-html]
10. **Self-closing static blocks** — `<!-- wp:paragraph /-->`. Static blocks always save HTML. [self-closing-static]
11. **Two root elements** — `<p>a</p><p>b</p>` in one paragraph block. Split into two blocks. [multiple-roots]
12. **Presets that don't exist** — `"backgroundColor":"accent"` when the theme palette has no `accent`. The block
    validates but renders unstyled. Use `tokens` to see real slugs. [unknown-preset]
13. **Loose HTML between blocks** — becomes a Classic block. [freeform-content]
14. **Hot-linked images in theme patterns** — bundle images and use `get_theme_file_uri()`. [external-image]
15. **PHP in .html templates** — it never runs. Put dynamic content in a PHP pattern and reference it with
    `<!-- wp:pattern {"slug":"…"} /-->`. [php-in-template]
