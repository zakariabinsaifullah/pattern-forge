# Serialization rules

How block-support attributes turn into saved HTML. Class order and style declaration order don't
matter to the editor; presence and exact values do.

## Colors

| Attribute | Classes | Inline style |
| --- | --- | --- |
| `backgroundColor:"x"` | `has-x-background-color` `has-background` | — |
| `style.color.background:"#123"` | `has-background` | `background-color:#123` |
| `gradient:"x"` | `has-x-gradient-background` `has-background` | — |
| `style.color.gradient:"linear-gradient(…)"` | `has-background` | `background:linear-gradient(…)` |
| `textColor:"x"` | `has-x-color` `has-text-color` | — |
| `style.color.text:"#123"` | `has-text-color` | `color:#123` |
| `style.elements.link.color.text:"…"` | `has-link-color` | — (generated at render) |
| `borderColor:"x"` | `has-x-border-color` `has-border-color` | — |
| `style.border.color:"#123"` | `has-border-color` | `border-color:#123` |

Preset value in `style`: `"var:preset|color|primary"` → `var(--wp--preset--color--primary)`.

## Spacing

- `style.spacing.padding` as an object → one declaration per side present:
  `{"top":"var:preset|spacing|50","left":"2rem"}` → `padding-top:var(--wp--preset--spacing--50);padding-left:2rem`.
- As a string → shorthand: `"padding":"2rem"` → `padding:2rem`.
- `style.spacing.margin` works the same way with `margin-*`.
- `style.spacing.blockGap` is **not** saved in HTML (layout styles are generated at render).

## Typography

- `fontSize:"x"` → class `has-x-font-size`. `style.typography.fontSize:"2rem"` → `font-size:2rem`, no class.
- `fontFamily:"x"` → class `has-x-font-family`.
- `style.typography.<prop>` → kebab-case CSS: `lineHeight` → `line-height`, `letterSpacing` →
  `letter-spacing`, `fontWeight` → `font-weight`, `fontStyle`, `textTransform`, `textDecoration`, `writingMode`.

## Borders, dimensions, shadow

- `style.border.radius:"8px"` → `border-radius:8px`. Object `{"topLeft":"8px"}` → `border-top-left-radius:8px`.
- `style.border.width` / `style` → `border-width` / `border-style`. Per side: `style.border.top.width` →
  `border-top-width`.
- `style.dimensions.minHeight:"50vh"` → `min-height:50vh`.
- `style.shadow:"var:preset|shadow|natural"` → `box-shadow:var(--wp--preset--shadow--natural)`.

## Alignment

- `align:"wide" | "full" | "left" | "right" | "center"` → `alignwide` etc. on the wrapper (not on paragraph).
- Heading `textAlign` and paragraph `align` → `has-text-align-left|center|right`.
- WordPress 7.1 stores text alignment as `style.typography.textAlign`: it also saves `has-text-align-*` and no inline
  `text-align`. Write `textAlign` / paragraph `align` for markup that must load on 6.x; 7.1 converts it.
- Heading `align:"left|center|right"` is a legacy text-alignment form; it loads, but use `textAlign`.

## Block-specific placement

| Block | Where supports serialize |
| --- | --- |
| `core/button` | Colors, gradient, padding, border, shadow and font size (`has-x-font-size has-custom-font-size`) → the `<a class="wp-block-button__link …">`. `className` and `width` (`has-custom-width wp-block-button__width-N`) → wrapper `<div>`. |
| `core/buttons` | `fontSize:"x"` → `has-custom-font-size has-x-font-size` on the wrapper. |
| `core/image` | `sizeSlug` → `size-x`, `align`, `className`, `has-custom-border` (when any border is set), `is-resized` (when width/height) → `<figure>`. Border styles, `width`, `height`, `aspect-ratio`, `object-fit`, `wp-image-<id>` → `<img>`. |
| `core/column` | `width:"40%"` → `flex-basis:40%`. `verticalAlignment` → `is-vertically-aligned-x`. |
| `core/columns` | `verticalAlignment` → `are-vertically-aligned-x`; `isStackedOnMobile:false` → `is-not-stacked-on-mobile`. |
| `core/spacer` | `height` (default `"100px"`) → `height:…`; numbers become `px`. With `style.layout.selfStretch` `"fit"` or `"fill"` no height or width is saved. |
| `core/group` | `tagName` sets the wrapper element. Layout is JSON only. |
| `core/list` | `ordered:true` → `<ol>`. Class `wp-block-list`. |
| `core/separator` | `backgroundColor` → `has-x-background-color has-background` **and** `has-x-color has-text-color` on the `<hr>`; default class `has-alpha-channel-opacity`. |
| `core/cover` | Children in order: background `<img>`/`<video>`, then the overlay `<span class="wp-block-cover__background">`, then the inner container. Overlay color goes on the `<span>`, not the wrapper. `minHeight` + `minHeightUnit` → wrapper `min-height`. |

## Dynamic blocks

Server-rendered blocks (`site-title`, `navigation`, `post-*`, `query-*` except `query` itself,
`template-part`, `pattern`, `search`, `social-link`, …) save no HTML. Write them self-closing. Blocks
that only hold inner blocks (`post-template`, `navigation` with links) contain only child block comments.
