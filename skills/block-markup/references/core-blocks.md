# Canonical core block markup (WordPress 6.5+)

Copy these shapes exactly. Replace the attributes, then regenerate the classes and styles from them
following `serialization-rules.md`. Blank lines between sibling blocks are optional but conventional.

## Text

### Paragraph
```html
<!-- wp:paragraph -->
<p>Text</p>
<!-- /wp:paragraph -->

<!-- wp:paragraph {"align":"center","textColor":"contrast","fontSize":"small"} -->
<p class="has-text-align-center has-contrast-color has-text-color has-small-font-size">Text</p>
<!-- /wp:paragraph -->
```
Paragraph text alignment uses the `align` attribute (not `textAlign`) and maps to `has-text-align-*`.

### Heading
```html
<!-- wp:heading -->
<h2 class="wp-block-heading">Default level is 2</h2>
<!-- /wp:heading -->

<!-- wp:heading {"textAlign":"center","level":1,"fontSize":"x-large"} -->
<h1 class="wp-block-heading has-text-align-center has-x-large-font-size">Title</h1>
<!-- /wp:heading -->
```
The tag must match `level` (omitted = 2). `wp-block-heading` is always present.

### List
```html
<!-- wp:list -->
<ul class="wp-block-list"><!-- wp:list-item -->
<li>One</li>
<!-- /wp:list-item -->

<!-- wp:list-item -->
<li>Two</li>
<!-- /wp:list-item --></ul>
<!-- /wp:list -->
```
`{"ordered":true}` → `<ol class="wp-block-list">`. A list may only contain `list-item` blocks; nest a
second `wp:list` inside an `<li>` for sub-lists.

### Quote
```html
<!-- wp:quote -->
<blockquote class="wp-block-quote"><!-- wp:paragraph -->
<p>Quoted text.</p>
<!-- /wp:paragraph --><cite>Author</cite></blockquote>
<!-- /wp:quote -->
```

## Layout

### Group (constrained, full width, with padding and background)
```html
<!-- wp:group {"align":"full","style":{"spacing":{"padding":{"top":"var:preset|spacing|60","bottom":"var:preset|spacing|60"}}},"backgroundColor":"base-2","layout":{"type":"constrained"}} -->
<div class="wp-block-group alignfull has-base-2-background-color has-background" style="padding-top:var(--wp--preset--spacing--60);padding-bottom:var(--wp--preset--spacing--60)"><!-- inner blocks --></div>
<!-- /wp:group -->
```
- Row: `"layout":{"type":"flex","flexWrap":"nowrap"}`. Stack: `"layout":{"type":"flex","orientation":"vertical"}`.
  Grid: `"layout":{"type":"grid","columnCount":3}`. None of these change the HTML.
- `"tagName":"section"` (or `main`, `header`, `footer`, `aside`, `article`) changes the wrapper tag.
- Gap between children: `"style":{"spacing":{"blockGap":"var:preset|spacing|40"}}` — JSON only.

### Columns
```html
<!-- wp:columns {"align":"wide"} -->
<div class="wp-block-columns alignwide"><!-- wp:column {"width":"33.33%"} -->
<div class="wp-block-column" style="flex-basis:33.33%"><!-- inner blocks --></div>
<!-- /wp:column -->

<!-- wp:column {"verticalAlignment":"center"} -->
<div class="wp-block-column is-vertically-aligned-center"><!-- inner blocks --></div>
<!-- /wp:column --></div>
<!-- /wp:columns -->
```
`{"isStackedOnMobile":false}` → `is-not-stacked-on-mobile`. `{"verticalAlignment":"center"}` on columns →
`are-vertically-aligned-center`. Columns may only contain column blocks.

### Spacer and separator
```html
<!-- wp:spacer {"height":"var:preset|spacing|50"} -->
<div style="height:var(--wp--preset--spacing--50)" aria-hidden="true" class="wp-block-spacer"></div>
<!-- /wp:spacer -->

<!-- wp:separator -->
<hr class="wp-block-separator has-alpha-channel-opacity"/>
<!-- /wp:separator -->
```
Spacer without `height` saves `height:100px`. Prefer group padding or `blockGap` to spacers.

## Actions

### Buttons
```html
<!-- wp:buttons {"layout":{"type":"flex","justifyContent":"center"}} -->
<div class="wp-block-buttons"><!-- wp:button {"backgroundColor":"primary","textColor":"base"} -->
<div class="wp-block-button"><a class="wp-block-button__link has-base-color has-primary-background-color has-text-color has-background wp-element-button" href="#">Primary</a></div>
<!-- /wp:button -->

<!-- wp:button {"className":"is-style-outline"} -->
<div class="wp-block-button is-style-outline"><a class="wp-block-button__link wp-element-button" href="#">Secondary</a></div>
<!-- /wp:button --></div>
<!-- /wp:buttons -->
```
Colors, padding and border go on the `<a>`; `className`, `width` (`has-custom-width wp-block-button__width-50`)
and font size (`has-custom-font-size has-small-font-size`) go on the wrapper `<div>`.

## Media

### Image
```html
<!-- wp:image {"sizeSlug":"large","linkDestination":"none"} -->
<figure class="wp-block-image size-large"><img src="<?php echo esc_url( get_theme_file_uri( 'assets/images/photo.jpg' ) ); ?>" alt=""/></figure>
<!-- /wp:image -->

<!-- wp:image {"id":42,"aspectRatio":"16/9","scale":"cover","sizeSlug":"full","linkDestination":"none","style":{"border":{"radius":"12px"}}} -->
<figure class="wp-block-image size-full has-custom-border"><img src="photo.jpg" alt="Describe it" class="wp-image-42" style="border-radius:12px;aspect-ratio:16/9;object-fit:cover"/></figure>
<!-- /wp:image -->
```
Only include `id` when the image is a real Media Library attachment; theme patterns usually omit it.
`width`/`height` add `is-resized` to the figure and `width:`/`height:` to the `<img>` style.

### Cover (structure checked only — follow exactly)
```html
<!-- wp:cover {"url":"photo.jpg","dimRatio":50,"overlayColor":"contrast","isUserOverlayColor":true,"minHeight":480,"minHeightUnit":"px","layout":{"type":"constrained"}} -->
<div class="wp-block-cover" style="min-height:480px"><span aria-hidden="true" class="wp-block-cover__background has-contrast-background-color has-background-dim"></span><img class="wp-block-cover__image-background" alt="" src="photo.jpg" data-object-fit="cover"/><div class="wp-block-cover__inner-container"><!-- inner blocks --></div></div>
<!-- /wp:cover -->
```
`dimRatio` 50 → `has-background-dim`; any other multiple of 10 → `has-background-dim-<n> has-background-dim`;
0 → `has-background-dim-0 has-background-dim`.

## Dynamic blocks (self-closing, no HTML)
```html
<!-- wp:site-title {"level":0} /-->
<!-- wp:site-logo {"width":48} /-->
<!-- wp:navigation {"layout":{"type":"flex","justifyContent":"right"}} /-->
<!-- wp:post-title {"isLink":true} /-->
<!-- wp:post-featured-image {"aspectRatio":"3/2"} /-->
<!-- wp:template-part {"slug":"header","tagName":"header"} /-->
<!-- wp:pattern {"slug":"mytheme/hero"} /-->
<!-- wp:search {"label":"Search","buttonText":"Search"} /-->
```
Query loops save a wrapper but `post-template` does not:
```html
<!-- wp:query {"queryId":0,"query":{"perPage":3,"postType":"post","inherit":false}} -->
<div class="wp-block-query"><!-- wp:post-template -->
<!-- wp:post-title {"isLink":true} /-->
<!-- /wp:post-template --></div>
<!-- /wp:query -->
```

## Social icons
```html
<!-- wp:social-links {"className":"is-style-logos-only"} -->
<ul class="wp-block-social-links is-style-logos-only"><!-- wp:social-link {"url":"https://x.com/example","service":"x"} /-->

<!-- wp:social-link {"url":"https://github.com/example","service":"github"} /--></ul>
<!-- /wp:social-links -->
```
