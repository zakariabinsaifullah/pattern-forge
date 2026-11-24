---
name: block-markup
description: >
  This skill should be used whenever Claude writes, edits or reviews WordPress block markup
  (Gutenberg "<!-- wp:... -->" comments) — block patterns, block theme templates and template
  parts, post content, or "serialized blocks". Also use it when the user mentions "This block
  contains unexpected or invalid content", "attempt block recovery", block validation errors,
  core blocks, or asks to "write Gutenberg markup" or "make this a block pattern".
---

# Writing valid WordPress block markup

The block editor re-runs each block's `save()` on load and compares the result with the saved HTML.
When they differ, one of three things happens:

- **Invalid** — wrong wrapper tag, wrong heading level, extra root elements, HTML inside a dynamic block, or a
  missing structural part: the editor shows "This block contains unexpected or invalid content".
- **Silently changed** — a missing class or inline style that an attribute needs: an older block version
  (deprecation) accepts the markup and the attribute is quietly dropped (for example padding, `aspectRatio`, a
  `buttons` font size), or the content gets garbled.
- **Absorbed** — an extra `has-*` or runtime class with no attribute behind it is moved into `className`. The block
  loads, but the class no longer follows the block's settings.

Only the first is visible to the user, so write markup that exactly matches what `save()` produces for the
given attributes.

## The core rule

**Attributes are the source of truth; the HTML is derived from them.** Decide the attributes first, then
write the HTML those attributes produce — never style HTML directly.

- Every `has-*` class, `align*` class and inline `style=""` declaration must come from an attribute.
- Every attribute that serializes must appear in the HTML.
- Layout (`"layout":{...}`), `blockGap`, flex child sizing and sticky position are applied at render time:
  they live in the JSON only and add **no** classes or styles to the saved HTML. Never write
  `is-layout-*`, `wp-container-*`, `is-content-justification-*` or `is-nowrap` in saved markup.

## Delimiter grammar

```
<!-- wp:name {"json":"attrs"} -->   HTML   <!-- /wp:name -->
<!-- wp:name {"json":"attrs"} /-->            (self-closing: dynamic blocks only)
<!-- wp:namespace/name -->                    (non-core blocks keep their namespace)
```

- Exactly one space after `<!--` and before `-->` / `/-->`. `<!-- wp:paragraph-->` is plain HTML.
- Attributes are a single JSON object on the opening comment. Omit attributes equal to their defaults.
- Never put `--` inside JSON; WordPress escapes it as `--`.
- Every opener has a matching closer, properly nested.
- Each static block saves exactly one root element. Inner blocks sit inside that element.
- Text or HTML outside any block becomes a Classic block — wrap everything in blocks.

## Attribute → markup mapping (summary)

| Attribute | Saved HTML |
| --- | --- |
| `backgroundColor:"x"` | `has-x-background-color has-background` |
| `textColor:"x"` | `has-x-color has-text-color` |
| `gradient:"x"` | `has-x-gradient-background has-background` |
| `fontSize:"x"` | `has-x-font-size` |
| `fontFamily:"x"` | `has-x-font-family` |
| `borderColor:"x"` | `has-x-border-color has-border-color` |
| `align:"wide"` (non-paragraph) | `alignwide` |
| `textAlign:"center"` (heading; paragraph uses `align`) | `has-text-align-center` |
| `className:"is-style-outline"` | that class, verbatim |
| `style.spacing.padding.top:"var:preset\|spacing\|50"` | `style="padding-top:var(--wp--preset--spacing--50)"` |
| `style.color.text:"#hex"` | `style="color:#hex"` + `has-text-color` |
| `style.elements.link.color.text` | `has-link-color` (CSS is generated at render) |
| `style.typography.lineHeight:"1.2"` | `style="line-height:1.2"` |
| `style.border.radius:"8px"` | `style="border-radius:8px"` |

Preset references inside `style` use `var:preset|<type>|<slug>` in JSON and
`var(--wp--preset--<type>--<slug>)` in CSS. Full rules, block-specific quirks (button colors on the
link, image borders on the `<img>`, spacer height, column width) are in
`references/serialization-rules.md`.

## Workflow

1. Pick blocks from `references/core-blocks.md`, which has canonical markup for every common core block.
   Start from those snippets instead of writing markup from memory.
2. Prefer theme presets (palette, font sizes, spacing) over raw values — see the `theme-tokens` skill.
3. Validate before handing work back:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/pattern-forge.mjs" validate <file-or-dir>
   ```
   The script lives at `scripts/pattern-forge.mjs` in this plugin's root (two folders above this skill).
   To check markup that isn't saved yet, pipe it in: `... validate --stdin --kind pattern-php < draft.php`.
   Fix every **error** (the editor rejects the block or loses settings). Fix warnings too unless there is a reason
   not to, and say what it is: they mark markup that loads but gets rewritten on save or doesn't follow the
   block's settings.
4. When a hook reports errors after a save, fix them immediately and save again.

## Scope

- Prefer core blocks. Third-party blocks (`kadence/*`, `generateblocks/*`, …) can only be checked for
  structure, not for exact serialization; say so when using them.
- For complex blocks (cover, media-text, gallery, table, embed) the validator checks structure only.
  Follow the snippets exactly and, when in doubt, tell the user to open the pattern in the editor once to confirm.
- See `references/common-mistakes.md` before reviewing AI-written or hand-written markup.
