<?php
/**
 * Title: Broken example
 * Slug: forgetest/broken
 * Categories: text
 */
?>
<!-- wp:group {"backgroundColor":"accent","layout":{"type":"constrained"}} -->
<div class="wp-block-group is-layout-constrained has-accent-background-color has-background" style="padding:40px"><!-- wp:heading -->
<h3 class="wp-block-heading">Wrong level</h3>
<!-- /wp:heading -->

<!-- wp:paragraph {"textColor":"contrast"} -->
<p class="has-primary-color has-text-color">Class does not match attribute</p>
<!-- /wp:paragraph -->

<!-- wp:paragraph-->
<p>Malformed delimiter</p>
<!-- /wp:paragraph -->

<!-- wp:column -->
<div class="wp-block-column"><p>Column outside columns</p></div>
<!-- /wp:column -->

<!-- wp:buttons -->
<div class="wp-block-buttons"><!-- wp:button -->
<div class="wp-block-button"><a class="wp-block-button__link" href="#">No element class</a></div>
<!-- /wp:button --></div>
<!-- /wp:buttons -->

<!-- wp:site-title -->
<p class="wp-block-site-title">Site</p>
<!-- /wp:site-title -->

<!-- wp:paragraph {"style":{"color":{"text":"#ff0000"}}} -->
<p class="has-text-color" style="color:#00ff00">Style mismatch</p>
<!-- /wp:paragraph -->

<!-- wp:quote -->
<blockquote class="wp-block-quote"><p>Unclosed div<div></blockquote>
<!-- /wp:quote --></div>
<!-- /wp:group -->

<!-- wp:paragraph {"textColor":"contrast" -->
<p>Bad json</p>
<!-- /wp:paragraph -->
