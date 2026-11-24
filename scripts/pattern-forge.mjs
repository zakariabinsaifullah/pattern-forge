#!/usr/bin/env node
/**
 * Pattern Forge — WordPress block markup validator.
 *
 * Dependency-free (Node 18+). Reads files locally, never touches the network.
 *
 *   node pattern-forge.mjs validate <file|dir>... [--json] [--theme <dir>]
 *   node pattern-forge.mjs validate --stdin [--theme <dir>]
 *   node pattern-forge.mjs tokens [<theme-dir>] [--json]
 *   node pattern-forge.mjs hook        (PostToolUse hook: reads hook JSON on stdin)
 *
 * Exit codes: 0 = no errors, 1 = errors found, 2 = usage problem.
 */

import fs from 'node:fs';
import path from 'node:path';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VOID_TAGS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta',
  'source', 'track', 'wbr',
]);

const CORE_PALETTE = [
  'black', 'cyan-bluish-gray', 'white', 'pale-pink', 'vivid-red',
  'luminous-vivid-orange', 'luminous-vivid-amber', 'light-green-cyan',
  'vivid-green-cyan', 'pale-cyan-blue', 'vivid-cyan-blue', 'vivid-purple',
];
const CORE_GRADIENTS = [
  'vivid-cyan-blue-to-vivid-purple', 'light-green-cyan-to-vivid-green-cyan',
  'luminous-vivid-amber-to-luminous-vivid-orange',
  'luminous-vivid-orange-to-vivid-red', 'very-light-gray-to-cyan-bluish-gray',
  'cool-to-warm-spectrum', 'blush-light-purple', 'blush-bordeaux',
  'luminous-dusk', 'pale-ocean', 'electric-grass', 'midnight',
];
const CORE_FONT_SIZES = ['small', 'medium', 'large', 'x-large', 'xx-large'];
const CORE_SHADOWS = ['natural', 'deep', 'sharp', 'outlined', 'crisp'];

const CORE_PATTERN_CATEGORIES = new Set([
  'about', 'banner', 'buttons', 'call-to-action', 'columns', 'contact',
  'featured', 'footer', 'gallery', 'header', 'media', 'portfolio', 'posts',
  'services', 'team', 'testimonials', 'text', 'videos', 'query',
]);

// Blocks whose save() returns null (server-rendered) or only inner blocks.
// They must not contain HTML of their own in saved markup.
const NO_OWN_HTML = new Set([
  'core/site-title', 'core/site-logo', 'core/site-tagline', 'core/navigation',
  'core/navigation-link', 'core/navigation-submenu', 'core/home-link',
  'core/page-list', 'core/post-title', 'core/post-content', 'core/post-date',
  'core/post-excerpt', 'core/post-featured-image', 'core/post-terms',
  'core/post-author', 'core/post-author-name', 'core/post-navigation-link',
  'core/post-template', 'core/query-title', 'core/query-pagination',
  'core/query-pagination-next', 'core/query-pagination-previous',
  'core/query-pagination-numbers', 'core/query-no-results', 'core/template-part',
  'core/pattern', 'core/block', 'core/social-link', 'core/loginout',
  'core/search', 'core/latest-posts', 'core/archives', 'core/categories',
  'core/tag-cloud', 'core/read-more', 'core/avatar', 'core/comments-title',
  'core/comment-template', 'core/comment-author-name', 'core/comment-content',
  'core/comment-date', 'core/comment-edit-link', 'core/comment-reply-link',
  'core/comments-pagination', 'core/post-comments-form', 'core/footnotes',
  'core/term-description', 'core/calendar', 'core/rss', 'core/shortcode',
]);

/**
 * Per-block expectations for saved markup.
 *  tag      wrapper element (string or fn(attrs))
 *  cls      classes the wrapper must carry
 *  strict   wrapper-only, exact check: every class/style derived from attributes
 *           must be present, and no attribute-derived class/style may appear
 *           without its attribute
 *  lenient  only check tag + base class (complex blocks like cover)
 *  parent   required parent block
 *  textAlignAttr  attribute name that maps to has-text-align-*
 */
const SPECS = {
  'core/paragraph': { tag: 'p', strict: true, textAlignAttr: 'align' },
  'core/heading': {
    tag: (a) => `h${a.level ?? 2}`, softCls: ['wp-block-heading'], strict: true,
    textAlignAttr: 'textAlign',
  },
  'core/group': { tag: (a) => a.tagName || 'div', cls: ['wp-block-group'], strict: true },
  'core/columns': { tag: 'div', cls: ['wp-block-columns'], strict: true },
  'core/column': { tag: 'div', cls: ['wp-block-column'], strict: true, parent: 'core/columns' },
  'core/buttons': { tag: 'div', cls: ['wp-block-buttons'], strict: true },
  'core/button': {
    tag: 'div', cls: ['wp-block-button'], parent: 'core/buttons',
    inner: { match: (el) => el.classes.has('wp-block-button__link'), name: 'a.wp-block-button__link',
      mustHave: ['wp-element-button'] },
    textAlignAttr: 'textAlign',
  },
  'core/image': {
    tag: 'figure', cls: ['wp-block-image'],
    inner: { match: (el) => el.tag === 'img', name: 'img' },
  },
  'core/spacer': { tag: 'div', cls: ['wp-block-spacer'], strict: true },
  'core/separator': { tag: 'hr', cls: ['wp-block-separator'], lenient: true },
  'core/list': { tag: (a) => (a.ordered ? 'ol' : 'ul'), softCls: ['wp-block-list'], strict: true },
  'core/list-item': { tag: 'li', strict: true, parent: 'core/list' },
  'core/quote': { tag: 'blockquote', cls: ['wp-block-quote'], strict: true },
  'core/pullquote': { tag: 'figure', cls: ['wp-block-pullquote'], lenient: true },
  'core/cover': { tag: (a) => a.tagName || 'div', cls: ['wp-block-cover'], lenient: true },
  'core/media-text': { tag: 'div', cls: ['wp-block-media-text'], lenient: true },
  'core/gallery': { tag: 'figure', cls: ['wp-block-gallery'], lenient: true },
  'core/table': { tag: 'figure', cls: ['wp-block-table'], lenient: true },
  'core/code': { tag: 'pre', cls: ['wp-block-code'], lenient: true },
  'core/preformatted': { tag: 'pre', cls: ['wp-block-preformatted'], lenient: true },
  'core/details': { tag: 'details', cls: ['wp-block-details'], lenient: true },
  'core/embed': { tag: 'figure', cls: ['wp-block-embed'], lenient: true },
  'core/video': { tag: 'figure', cls: ['wp-block-video'], lenient: true },
  'core/audio': { tag: 'figure', cls: ['wp-block-audio'], lenient: true },
  'core/file': { tag: 'div', cls: ['wp-block-file'], lenient: true },
  'core/social-links': { tag: 'ul', cls: ['wp-block-social-links'], lenient: true },
  'core/query': { tag: (a) => a.tagName || 'div', cls: ['wp-block-query'], lenient: true },
  'core/comments': { tag: (a) => a.tagName || 'div', cls: ['wp-block-comments'], lenient: true },
  'core/html': { skip: true },
  'core/freeform': { skip: true },
};

// Classes that WordPress derives from attributes. If one is in the markup
// without the matching attribute, the editor keeps the block valid by moving
// the class into "className" — so it still renders, but it is no longer tied
// to the attribute and the block's color/size/alignment controls won't show it.
const DERIVED_CLASS = [
  /^has-[a-z0-9-]+-(background-color|border-color|font-size|font-family|gradient-background)$/,
  /^has-(background|text-color|link-color|border-color)$/,
  /^has-[a-z0-9-]+-color$/,
  /^has-text-align-(left|center|right|justify)$/,
  /^align(wide|full|left|right|center)$/,
  /^is-vertically-aligned-(top|center|bottom)$/,
  /^are-vertically-aligned-(top|center|bottom)$/,
  /^is-not-stacked-on-mobile$/,
];
const RUNTIME_CLASS = /^(is-layout-[a-z-]+|wp-container-[a-z0-9-]+|wp-block-[a-z-]+-is-layout-[a-z-]+|is-content-justification-[a-z-]+|is-nowrap)$/;

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** var:preset|spacing|50 -> var(--wp--preset--spacing--50) */
function cssValue(v) {
  if (typeof v === 'number') return String(v);
  if (typeof v !== 'string') return '';
  const m = v.match(/^var:(preset|custom)\|(.+)$/);
  if (m) return `var(--wp--${m[1]}--${m[2].split('|').join('--')})`;
  return v.trim();
}

function kebab(s) {
  return s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

function lineIndex(src) {
  const starts = [0];
  for (let i = 0; i < src.length; i++) if (src[i] === '\n') starts.push(i + 1);
  return (pos) => {
    let lo = 0, hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid] <= pos) lo = mid; else hi = mid - 1;
    }
    return lo + 1;
  };
}

function parseStyle(str) {
  const map = new Map();
  if (!str) return map;
  // Split on ; that are not inside parentheses.
  let depth = 0, cur = '';
  const parts = [];
  for (const ch of str) {
    if (ch === '(') depth++;
    if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === ';' && depth === 0) { parts.push(cur); cur = ''; } else cur += ch;
  }
  parts.push(cur);
  for (const p of parts) {
    const i = p.indexOf(':');
    if (i === -1) continue;
    const prop = p.slice(0, i).trim().toLowerCase();
    const val = p.slice(i + 1).trim();
    if (prop) map.set(prop, val);
  }
  return map;
}

function parseAttrs(str) {
  const attrs = {};
  const re = /([^\s"'>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let m;
  while ((m = re.exec(str))) attrs[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? '';
  return attrs;
}

/** Tokenize HTML into open/close tags; ignores comments. */
function tokenizeTags(html, offset = 0) {
  const tokens = [];
  const re = /<!--[\s\S]*?-->|<(\/)?([a-zA-Z][a-zA-Z0-9-]*)((?:\s+[^\s"'>\/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*(\/)?>/g;
  let m;
  while ((m = re.exec(html))) {
    if (m[0].startsWith('<!--')) continue;
    const tag = m[2].toLowerCase();
    const attrs = parseAttrs(m[3] || '');
    tokens.push({
      close: !!m[1], tag, attrs, selfClose: !!m[4] || VOID_TAGS.has(tag),
      start: m.index + offset, end: m.index + m[0].length + offset,
      classes: new Set((attrs.class || '').split(/\s+/).filter(Boolean)),
      style: parseStyle(attrs.style),
    });
  }
  return tokens;
}

// ---------------------------------------------------------------------------
// Block grammar parser (mirrors WordPress' block-serialization-default-parser)
// ---------------------------------------------------------------------------

const DELIM = /^<!--\s+(\/)?wp:([a-z][a-z0-9_-]*\/)?([a-z][a-z0-9_-]*)\s+(\{[\s\S]*\}\s+)?(\/)?-->$/;

function parseBlocks(src, report, lineOf) {
  const root = { name: '#root', children: [], innerStart: 0, innerEnd: src.length, depth: -1 };
  const stack = [root];
  const commentRe = /<!--[\s\S]*?-->/g;
  let m;
  while ((m = commentRe.exec(src))) {
    const text = m[0];
    const body = text.slice(4).trimStart();
    if (!/^\/?wp:/.test(body)) continue;
    const d = text.match(DELIM);
    if (!d) {
      report('error', m.index, 'malformed-delimiter',
        `Malformed block comment ${JSON.stringify(text.slice(0, 60))}. WordPress needs a space after "<!--", a space before "-->" (or "/-->"), and valid JSON attributes; otherwise the comment is treated as plain HTML.`);
      continue;
    }
    const [, closer, ns, nm, json, selfClose] = d;
    const name = `${ns ? ns.slice(0, -1) : 'core'}/${nm}`;
    if (closer) {
      if (json || selfClose) {
        report('error', m.index, 'malformed-delimiter', `Closing comment for ${name} must not have attributes or "/".`);
      }
      const top = stack[stack.length - 1];
      if (top === root || !stack.some((b) => b.name === name)) {
        report('error', m.index, 'unmatched-closer', `Closing comment <!-- /wp:${nm} --> has no matching opener.`);
        continue;
      }
      if (top.name !== name) {
        report('error', m.index, 'mismatched-closer',
          `Expected <!-- /wp:${top.name.replace(/^core\//, '')} --> (opened on line ${lineOf(top.start)}) but found <!-- /wp:${nm} -->.`);
        // Try to recover: pop until we find it.
        const idx = stack.findLastIndex((b) => b.name === name);
        if (idx <= 0) continue;
        while (stack.length - 1 > idx) {
          const lost = stack.pop();
          lost.innerEnd = m.index; lost.end = m.index; lost.broken = true;
        }
      }
      const blk = stack.pop();
      blk.innerEnd = m.index;
      blk.end = m.index + text.length;
      continue;
    }
    let attrs = {};
    if (json) {
      try {
        attrs = JSON.parse(json.trim());
        if (!isObj(attrs)) {
          report('error', m.index, 'invalid-json', `Attributes for ${name} must be a JSON object.`);
          attrs = {};
        }
      } catch (e) {
        report('error', m.index, 'invalid-json', `Attributes for ${name} are not valid JSON: ${e.message}`);
      }
      if (/--/.test(json.replace(/\\u002d/gi, ''))) {
        report('warning', m.index, 'json-double-dash', `Attributes for ${name} contain "--". WordPress escapes it as \\u002d\\u002d so the comment cannot end early.`);
      }
    }
    const parent = stack[stack.length - 1];
    const blk = {
      name, attrs, start: m.index, innerStart: m.index + text.length,
      selfClosing: !!selfClose, children: [], parent, depth: stack.length - 1,
    };
    parent.children.push(blk);
    if (selfClose) { blk.innerEnd = blk.innerStart; blk.end = blk.innerStart; } else stack.push(blk);
  }
  while (stack.length > 1) {
    const blk = stack.pop();
    blk.innerEnd = src.length; blk.end = src.length; blk.broken = true;
    report('error', blk.start, 'unclosed-block', `${blk.name} is never closed. Add <!-- /wp:${blk.name.replace(/^core\//, '')} -->.`);
  }
  return root;
}

/** HTML belonging to the block itself, with child blocks blanked out (positions kept). */
function ownHtml(src, blk) {
  let out = '';
  let pos = blk.innerStart;
  for (const c of blk.children) {
    out += src.slice(pos, c.start) + ' '.repeat(Math.max(0, c.end - c.start));
    pos = c.end;
  }
  out += src.slice(pos, blk.innerEnd);
  return out;
}

// ---------------------------------------------------------------------------
// Expected classes/styles derived from block attributes
// ---------------------------------------------------------------------------

function boxStyles(prefix, val, out) {
  if (typeof val === 'string' || typeof val === 'number') { out.set(prefix, cssValue(val)); return; }
  if (!isObj(val)) return;
  for (const side of ['top', 'right', 'bottom', 'left']) {
    if (val[side] !== undefined && val[side] !== '') out.set(`${prefix}-${side}`, cssValue(val[side]));
  }
}

function expectedFromAttrs(name, a, spec) {
  const cls = new Set();
  const sty = new Map();
  const s = isObj(a.style) ? a.style : {};

  if (a.backgroundColor) { cls.add(`has-${a.backgroundColor}-background-color`); cls.add('has-background'); }
  if (a.gradient) { cls.add(`has-${a.gradient}-gradient-background`); cls.add('has-background'); }
  if (a.textColor) { cls.add(`has-${a.textColor}-color`); cls.add('has-text-color'); }
  if (a.borderColor) { cls.add(`has-${a.borderColor}-border-color`); cls.add('has-border-color'); }
  if (a.fontSize) cls.add(`has-${a.fontSize}-font-size`);
  if (a.fontFamily) cls.add(`has-${a.fontFamily}-font-family`);

  const color = isObj(s.color) ? s.color : {};
  if (color.background) { sty.set('background-color', cssValue(color.background)); cls.add('has-background'); }
  if (color.gradient) { sty.set('background', cssValue(color.gradient)); cls.add('has-background'); }
  if (color.text) { sty.set('color', cssValue(color.text)); cls.add('has-text-color'); }
  if (isObj(s.elements?.link?.color) && Object.keys(s.elements.link.color).length) cls.add('has-link-color');

  const t = isObj(s.typography) ? s.typography : {};
  const taAttr = spec.textAlignAttr;
  if (taAttr && a[taAttr]) cls.add(`has-text-align-${a[taAttr]}`);
  // WordPress 7.1+ stores text alignment as style.typography.textAlign; it saves a class, not an inline style.
  if (t.textAlign) cls.add(`has-text-align-${t.textAlign}`);
  // Legacy headings used "align" for text alignment; a deprecation still loads them.
  if (name === 'core/heading' && ['left', 'center', 'right'].includes(a.align)) cls.add(`has-text-align-${a.align}`);
  else if (a.align && taAttr !== 'align') cls.add(`align${a.align}`);

  if (typeof a.className === 'string') a.className.split(/\s+/).filter(Boolean).forEach((c) => cls.add(c));

  const spacing = isObj(s.spacing) ? s.spacing : {};
  if (spacing.padding !== undefined) boxStyles('padding', spacing.padding, sty);
  if (spacing.margin !== undefined) boxStyles('margin', spacing.margin, sty);

  for (const [k, v] of Object.entries(t)) {
    if (v === undefined || v === '' || isObj(v) || k === 'textAlign') continue;
    sty.set(kebab(k), cssValue(v));
  }

  const b = isObj(s.border) ? s.border : {};
  if (b.radius !== undefined) {
    if (isObj(b.radius)) {
      for (const [k, v] of Object.entries(b.radius)) sty.set(`border-${kebab(k)}-radius`, cssValue(v));
    } else sty.set('border-radius', cssValue(b.radius));
  }
  if (b.width) sty.set('border-width', cssValue(b.width));
  if (b.style) sty.set('border-style', cssValue(b.style));
  if (b.color) { sty.set('border-color', cssValue(b.color)); cls.add('has-border-color'); }
  for (const side of ['top', 'right', 'bottom', 'left']) {
    if (!isObj(b[side])) continue;
    for (const [k, v] of Object.entries(b[side])) if (v) sty.set(`border-${side}-${k}`, cssValue(v));
  }

  if (isObj(s.dimensions) && s.dimensions.minHeight) sty.set('min-height', cssValue(s.dimensions.minHeight));
  if (s.shadow) sty.set('box-shadow', cssValue(s.shadow));

  // Block-specific serialization.
  switch (name) {
    case 'core/columns':
      if (a.isStackedOnMobile === false) cls.add('is-not-stacked-on-mobile');
      if (a.verticalAlignment) cls.add(`are-vertically-aligned-${a.verticalAlignment}`);
      break;
    case 'core/column':
      if (a.verticalAlignment) cls.add(`is-vertically-aligned-${a.verticalAlignment}`);
      if (a.width) sty.set('flex-basis', cssValue(a.width));
      break;
    case 'core/spacer': {
      // Inside a flex parent, "fit"/"fill" sizing replaces the fixed height and width.
      const stretch = isObj(s.layout) ? s.layout.selfStretch : undefined;
      if (stretch === 'fit' || stretch === 'fill') break;
      const h = a.height ?? '100px';
      sty.set('height', typeof h === 'number' ? `${h}px` : cssValue(h));
      if (a.width) sty.set('width', typeof a.width === 'number' ? `${a.width}px` : cssValue(a.width));
      break;
    }
    case 'core/buttons':
    case 'core/button':
      if (a.width) { cls.add('has-custom-width'); cls.add(`wp-block-button__width-${a.width}`); }
      if (a.fontSize || t.fontSize) cls.add('has-custom-font-size');
      break;
    case 'core/image':
      if (a.sizeSlug) cls.add(`size-${a.sizeSlug}`);
      if (a.width || a.height) cls.add('is-resized');
      if (a.id) cls.add(`wp-image-${a.id}`);
      if (Object.keys(b).length || a.borderColor) cls.add('has-custom-border');
      if (a.width) sty.set('width', cssValue(a.width));
      if (a.height) sty.set('height', cssValue(a.height));
      if (a.aspectRatio) sty.set('aspect-ratio', cssValue(a.aspectRatio));
      if (a.scale) sty.set('object-fit', cssValue(a.scale));
      break;
    default:
  }
  return { cls, sty };
}

// ---------------------------------------------------------------------------
// Theme tokens (theme.json + style.css)
// ---------------------------------------------------------------------------

function findThemeDir(start) {
  let dir = path.resolve(start);
  try { if (fs.statSync(dir).isFile()) dir = path.dirname(dir); } catch { /* ignore */ }
  for (let i = 0; i < 8; i++) {
    if (fs.existsSync(path.join(dir, 'theme.json'))) return dir;
    const up = path.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return null;
}

function spacingScaleSlugs(scale) {
  const steps = scale?.steps ?? 7;
  if (!steps) return [];
  const below = Math.floor(steps / 2);
  const above = steps - below - 1;
  const slugs = ['50'];
  for (let i = 1; i <= below; i++) if (50 - i * 10 > 0) slugs.push(String(50 - i * 10));
  for (let i = 1; i <= above; i++) slugs.push(String(50 + i * 10));
  return slugs;
}

function loadTheme(dir) {
  if (!dir) return null;
  let json;
  try {
    json = JSON.parse(fs.readFileSync(path.join(dir, 'theme.json'), 'utf8'));
  } catch (e) {
    return { dir, error: `theme.json could not be parsed: ${e.message}` };
  }
  const st = json.settings || {};
  const list = (arr) => (Array.isArray(arr) ? arr.filter((x) => x && x.slug) : []);
  const palette = list(st.color?.palette);
  const gradients = list(st.color?.gradients);
  const fontSizes = list(st.typography?.fontSizes);
  const fontFamilies = list(st.typography?.fontFamilies);
  const spacingSizes = list(st.spacing?.spacingSizes);
  const shadows = list(st.shadow?.presets);

  const tokens = {
    color: new Map(palette.map((p) => [p.slug, p.color])),
    gradient: new Map(gradients.map((p) => [p.slug, p.gradient])),
    'font-size': new Map(fontSizes.map((p) => [p.slug, p.size])),
    'font-family': new Map(fontFamilies.map((p) => [p.slug, p.fontFamily])),
    spacing: new Map(spacingSizes.map((p) => [p.slug, p.size])),
    shadow: new Map(shadows.map((p) => [p.slug, p.shadow])),
  };
  if (st.color?.defaultPalette !== false) CORE_PALETTE.forEach((s) => tokens.color.has(s) || tokens.color.set(s, '(core default)'));
  if (st.color?.defaultGradients !== false) CORE_GRADIENTS.forEach((s) => tokens.gradient.has(s) || tokens.gradient.set(s, '(core default)'));
  if (st.typography?.defaultFontSizes !== false) CORE_FONT_SIZES.forEach((s) => tokens['font-size'].has(s) || tokens['font-size'].set(s, '(core default)'));
  if (st.spacing?.defaultSpacingSizes !== false || st.spacing?.spacingScale) {
    spacingScaleSlugs(st.spacing?.spacingScale).forEach((s) => tokens.spacing.has(s) || tokens.spacing.set(s, '(generated scale)'));
  }
  if (st.shadow?.defaultPresets !== false) CORE_SHADOWS.forEach((s) => tokens.shadow.has(s) || tokens.shadow.set(s, '(core default)'));

  let themeName = null, textDomain = null;
  try {
    const css = fs.readFileSync(path.join(dir, 'style.css'), 'utf8').slice(0, 4000);
    themeName = css.match(/^[ \t\/*#@]*Theme Name:\s*(.+)$/mi)?.[1]?.trim() || null;
    textDomain = css.match(/^[ \t\/*#@]*Text Domain:\s*(.+)$/mi)?.[1]?.trim() || null;
  } catch { /* no style.css */ }

  return {
    dir, themeName, textDomain, tokens,
    themeHasPalette: palette.length > 0,
    themeHasSpacing: spacingSizes.length > 0 || !!st.spacing?.spacingScale,
    themeHasFontSizes: fontSizes.length > 0,
    layout: st.layout || {},
  };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function collectPresetRefs(a) {
  const refs = [];
  if (a.backgroundColor) refs.push(['color', a.backgroundColor]);
  if (a.textColor) refs.push(['color', a.textColor]);
  if (a.borderColor) refs.push(['color', a.borderColor]);
  if (a.overlayColor) refs.push(['color', a.overlayColor]);
  if (a.gradient) refs.push(['gradient', a.gradient]);
  if (a.fontSize) refs.push(['font-size', a.fontSize]);
  if (a.fontFamily) refs.push(['font-family', a.fontFamily]);
  const walk = (v) => {
    if (typeof v === 'string') {
      const m = v.match(/^var:preset\|([a-z-]+)\|(.+)$/);
      if (m) refs.push([m[1], m[2]]);
    } else if (Array.isArray(v)) v.forEach(walk);
    else if (isObj(v)) Object.values(v).forEach(walk);
  };
  walk(a.style);
  if (typeof a.height === 'string') walk(a.height);
  return refs;
}

function hardcodedWarnings(blk, theme, report) {
  if (!theme || theme.error) return;
  const s = isObj(blk.attrs.style) ? blk.attrs.style : {};
  const isRaw = (v) => typeof v === 'string' && v !== '' && !v.startsWith('var:');
  if (theme.themeHasPalette) {
    for (const k of ['text', 'background']) {
      if (isRaw(s.color?.[k])) {
        report('warning', blk.start, 'hardcoded-color',
          `${blk.name}: custom ${k} color ${s.color[k]}. Use a palette slug (${[...theme.tokens.color.keys()].slice(0, 6).join(', ')}…) so it follows global styles.`);
      }
    }
  }
  if (theme.themeHasSpacing) {
    // Zero is a reset, not a design value; there is no preset for it.
    const isRawSpacing = (x) => isRaw(x) && !/^0(px|r?em|%|vh|vw)?$/.test(x.trim());
    const vals = [];
    for (const k of ['padding', 'margin']) {
      const v = s.spacing?.[k];
      if (isObj(v)) Object.values(v).forEach((x) => isRawSpacing(x) && vals.push(x));
      else if (isRawSpacing(v)) vals.push(v);
    }
    if (vals.length) {
      report('warning', blk.start, 'hardcoded-spacing',
        `${blk.name}: hard-coded spacing (${[...new Set(vals)].join(', ')}). Prefer "var:preset|spacing|<slug>" from theme.json.`);
    }
  }
  if (theme.themeHasFontSizes && isRaw(s.typography?.fontSize)) {
    report('warning', blk.start, 'hardcoded-font-size',
      `${blk.name}: custom font size ${s.typography.fontSize}. Prefer the "fontSize" attribute with a theme preset.`);
  }
}

function checkBlock(src, blk, ctx) {
  const { report, theme } = ctx;
  const a = blk.attrs;
  const name = blk.name;
  ctx.stats.blocks++;
  if (!name.startsWith('core/')) ctx.stats.thirdParty.add(name);

  // Preset references
  if (theme && !theme.error) {
    for (const [kind, slug] of collectPresetRefs(a)) {
      const map = theme.tokens[kind];
      if (map && !map.has(slug)) {
        report('error', blk.start, 'unknown-preset',
          `${name}: ${kind} preset "${slug}" is not defined in theme.json${map.size ? ` (available: ${[...map.keys()].slice(0, 10).join(', ')})` : ''}.`);
      }
    }
    hardcodedWarnings(blk, theme, report);
  }

  // Runtime classes should never be saved.
  const allClasses = typeof a.className === 'string' ? a.className.split(/\s+/) : [];
  for (const c of allClasses) {
    if (RUNTIME_CLASS.test(c)) {
      report('warning', blk.start, 'runtime-class', `${name}: className contains "${c}", which WordPress adds at render time. Saved, it sticks to the block permanently and can clash with the generated layout styles. Remove it.`);
    }
  }

  // The editor loads blocks in the wrong place, but its inserter and drag-and-drop won't let users recreate or move them.
  const spec = SPECS[name];
  if (spec?.parent && blk.parent?.name !== spec.parent) {
    report('warning', blk.start, 'wrong-parent', `${name} should sit directly inside ${spec.parent}; the editor loads it, but users can't add or move blocks like it there.`);
  }
  if (['core/columns', 'core/buttons', 'core/list'].includes(name)) {
    const allowed = { 'core/columns': 'core/column', 'core/buttons': 'core/button', 'core/list': 'core/list-item' }[name];
    for (const c of blk.children) {
      if (c.name !== allowed) report('warning', c.start, 'wrong-child', `${name} should only contain ${allowed} blocks, found ${c.name}; the editor loads it, but users can't add or move blocks like it there.`);
    }
  }

  if (blk.selfClosing) {
    if (spec && !spec.skip && !NO_OWN_HTML.has(name) && !spec.lenient && name.startsWith('core/')) {
      report('error', blk.start, 'self-closing-static', `${name} is a static block and needs saved HTML, not a self-closing comment.`);
    }
    return;
  }
  if (spec?.skip) return;

  const html = ownHtml(src, blk);
  const tokens = tokenizeTags(html, blk.innerStart);
  const stripped = html.replace(/<!--[\s\S]*?-->/g, '').trim();

  if (NO_OWN_HTML.has(name)) {
    if (/<[a-z]/i.test(stripped) || stripped.replace(/\s/g, '').length) {
      report('error', blk.innerStart, 'dynamic-has-html',
        `${name} is rendered by the server and saves no HTML. Use a self-closing comment (<!-- wp:${name.replace(/^core\//, '')} /-->) or only inner blocks.`);
    }
    return;
  }

  // Tag balance, plus a single root element.
  const stack = [];
  let rootClosed = false;
  let multiRoot = null;
  for (const t of tokens) {
    if (!t.close && rootClosed && !multiRoot) multiRoot = t;
    if (t.selfClose && !t.close) { if (!stack.length) rootClosed = true; continue; }
    if (!t.close) { stack.push(t); continue; }
    if (VOID_TAGS.has(t.tag)) continue;
    if (stack.length === 1 && stack[0].tag === t.tag) rootClosed = true;
    if (VOID_TAGS.has(t.tag)) continue;
    const top = stack[stack.length - 1];
    if (!top) { report('error', t.start, 'html-unbalanced', `${name}: stray closing </${t.tag}>.`); continue; }
    if (top.tag !== t.tag) {
      report('error', t.start, 'html-unbalanced', `${name}: </${t.tag}> closes <${top.tag}> opened on line ${ctx.lineOf(top.start)}.`);
      const idx = stack.map((x) => x.tag).lastIndexOf(t.tag);
      if (idx >= 0) stack.length = idx;
      continue;
    }
    stack.pop();
  }
  for (const t of stack) report('error', t.start, 'html-unbalanced', `${name}: <${t.tag}> is never closed.`);
  if (multiRoot && spec && !spec.skip) {
    report('error', multiRoot.start, 'multiple-roots', `${name}: <${multiRoot.tag}> sits outside the block's wrapper element. A block saves exactly one root element.`);
  }

  if (!name.startsWith('core/') || !spec) return; // structure-only for other blocks

  // Wrapper
  const first = tokens[0];
  if (!first || first.close) {
    report('error', blk.innerStart, 'missing-wrapper', `${name}: no wrapper element found.`);
    return;
  }
  const lead = html.slice(0, first.start - blk.innerStart).replace(/<!--[\s\S]*?-->/g, '').trim();
  if (lead) report('error', blk.innerStart, 'text-outside-wrapper', `${name}: text before the wrapper element ("${lead.slice(0, 30)}").`);
  const last = tokens[tokens.length - 1];
  const trail = html.slice(last.end - blk.innerStart).replace(/<!--[\s\S]*?-->/g, '').trim();
  if (trail) report('error', last.end, 'text-outside-wrapper', `${name}: content after the wrapper closes ("${trail.slice(0, 30)}").`);

  const expectedTag = typeof spec.tag === 'function' ? spec.tag(a) : spec.tag;
  if (expectedTag && first.tag !== expectedTag) {
    const hint = name === 'core/heading' ? ` Set {"level":${first.tag.replace(/^h/, '') || 2}} or change the tag.` : '';
    report('error', first.start, 'wrong-tag', `${name}: wrapper is <${first.tag}> but WordPress saves <${expectedTag}>.${hint}`);
  }
  for (const c of spec.cls || []) {
    if (!first.classes.has(c)) report('error', first.start, 'missing-class', `${name}: wrapper is missing class "${c}".`);
  }
  for (const c of spec.softCls || []) {
    if (!first.classes.has(c)) report('warning', first.start, 'missing-class', `${name}: wrapper is missing class "${c}" (current WordPress saves it; older markup still loads through a deprecation).`);
  }
  for (const c of first.classes) {
    if (RUNTIME_CLASS.test(c) && !allClasses.includes(c)) {
      report('warning', first.start, 'runtime-class', `${name}: class "${c}" is added by WordPress at render time. Saved, it sticks to the block permanently and can clash with the generated layout styles. Remove it.`);
    }
  }

  if (name === 'core/list' && !blk.children.length && tokens.some((t) => !t.close && t.tag === 'li')) {
    report('warning', first.start, 'legacy-list',
      'core/list: items are raw <li> elements. Current WordPress stores each item as a <!-- wp:list-item --> block and converts this older format on load.');
  }

  if (spec.lenient) {
    if (name === 'core/cover') {
      if (!tokens.some((t) => t.classes.has('wp-block-cover__inner-container'))) {
        report('error', first.start, 'cover-structure', 'core/cover: missing <div class="wp-block-cover__inner-container">.');
      }
      const overlay = tokens.findIndex((t) => t.classes.has('wp-block-cover__background'));
      const image = tokens.findIndex((t) => t.classes.has('wp-block-cover__image-background') || t.classes.has('wp-block-cover__video-background'));
      if (overlay === -1) {
        report('warning', first.start, 'cover-structure', 'core/cover: missing <span aria-hidden="true" class="wp-block-cover__background …"> overlay.');
      } else if (image > overlay) {
        report('warning', tokens[overlay].start, 'cover-structure',
          'core/cover: WordPress saves the background <img>/<video> before the overlay <span>. This order still loads through a deprecation, but the editor rewrites it on save.');
      }
    }
    return;
  }

  // Compare attribute-derived classes and styles.
  const { cls: expCls, sty: expSty } = expectedFromAttrs(name, a, spec);
  let targets = [first];
  if (spec.inner) {
    const innerEl = tokens.find((t) => !t.close && spec.inner.match(t));
    if (!innerEl) {
      report('error', first.start, 'missing-inner', `${name}: missing ${spec.inner.name} inside the wrapper.`);
    } else {
      targets = [first, innerEl];
      for (const c of spec.inner.mustHave || []) {
        if (!innerEl.classes.has(c)) report('error', innerEl.start, 'missing-class', `${name}: ${spec.inner.name} is missing class "${c}".`);
      }
    }
  }
  const haveCls = new Set(targets.flatMap((t) => [...t.classes]));
  const haveSty = new Map(targets.flatMap((t) => [...t.style]));

  if (name === 'core/heading' && ['left', 'center', 'right'].includes(a.align)) {
    report('warning', blk.start, 'legacy-attribute',
      `core/heading: "align":"${a.align}" is the old way to align heading text. It still loads, but WordPress converts it on save; use "textAlign":"${a.align}".`);
  }
  // Since WordPress 6.x the button's font-size classes are saved on the link, not the wrapper.
  if (name === 'core/button' && targets.length > 1) {
    const misplaced = [...first.classes].filter((c) => c === 'has-custom-font-size' || /^has-[a-z0-9-]+-font-size$/.test(c));
    if (misplaced.length) {
      report('warning', first.start, 'class-placement',
        `core/button: ${misplaced.map((c) => `"${c}"`).join(' and ')} belong on the <a class="wp-block-button__link">, not the wrapper <div>. The old placement still loads, but WordPress rewrites it on save.`);
    }
  }

  // A missing class or style means WordPress either rejects the block ("unexpected or invalid content") or
  // recovers it through a deprecation that silently drops the attribute.
  for (const c of expCls) {
    if (!haveCls.has(c)) report('error', first.start, 'missing-class', `${name}: attributes require class "${c}" but the HTML doesn't have it. WordPress will flag the block as invalid or drop the attribute.`);
  }
  const baseCls = new Set([...(spec.cls || []), ...(spec.softCls || [])]);
  for (const c of haveCls) {
    if (expCls.has(c) || baseCls.has(c)) continue;
    if (DERIVED_CLASS.some((re) => re.test(c))) {
      report('warning', first.start, 'orphan-class',
        `${name}: class "${c}" has no matching block attribute. The editor keeps it as a custom class, so it renders but the block's settings won't show or change it. Add the attribute, or remove the class.`);
    }
  }
  for (const [prop, val] of expSty) {
    if (!haveSty.has(prop)) {
      report('error', first.start, 'missing-style', `${name}: attributes require inline style "${prop}:${val}". WordPress will flag the block as invalid or drop the attribute.`);
    } else if (haveSty.get(prop).replace(/\s+/g, '') !== val.replace(/\s+/g, '')) {
      report('error', first.start, 'style-mismatch', `${name}: inline "${prop}" is "${haveSty.get(prop)}" but attributes produce "${val}". WordPress will flag the block as invalid or garble it while recovering.`);
    }
  }
  if (spec.strict) {
    for (const [prop, val] of first.style) {
      if (!expSty.has(prop)) {
        report('error', first.start, 'orphan-style',
          `${name}: inline style "${prop}:${val}" has no matching block attribute. Move it into the block's "style" attribute (e.g. style.spacing / style.color / style.typography).`);
      }
    }
  }
}

function walkBlocks(src, node, ctx) {
  for (const c of node.children) {
    checkBlock(src, c, ctx);
    walkBlocks(src, c, ctx);
  }
}

// ---------------------------------------------------------------------------
// File-level checks
// ---------------------------------------------------------------------------

function prepareSource(raw, kind, report) {
  // Replace PHP with neutral placeholders (keeping newlines) so the markup parses.
  let header = null;
  let src = raw;
  if (kind === 'pattern-php') {
    const m = raw.match(/^\s*<\?php\s*\/\*\*([\s\S]*?)\*\/\s*\?>/);
    if (m) {
      header = m[1];
      src = m[0].replace(/[^\n]/g, ' ') + raw.slice(m[0].length);
    }
  }
  const php = [];
  // Same-length replacement keeps every offset (and line number) identical to the original.
  src = src.replace(/<\?php[\s\S]*?(\?>|$)/g, (m, _e, off) => {
    php.push({ code: m, off });
    return 'PHPX' + m.slice(4).replace(/[^\n]/g, ' ');
  });
  if (kind === 'template' && php.length) {
    report('error', php[0].off, 'php-in-template', 'PHP does not run in block templates or template parts (.html). Move dynamic parts into a PHP pattern and reference it with <!-- wp:pattern {"slug":"…"} /-->.');
  }
  return { src, header, php };
}

function checkHeader(header, file, ctx) {
  const { report } = ctx;
  if (header === null) {
    report('error', 0, 'pattern-header', 'Pattern file needs a header comment (<?php /** Title: … Slug: … */ ?>) or WordPress will not register it.');
    return;
  }
  const field = (k) => header.match(new RegExp(`^[\\s*]*${k}:\\s*(.+)$`, 'mi'))?.[1]?.trim();
  const title = field('Title');
  const slug = field('Slug');
  const cats = field('Categories');
  if (!title) report('error', 0, 'pattern-header', 'Pattern header is missing "Title:".');
  if (!slug) report('error', 0, 'pattern-header', 'Pattern header is missing "Slug:".');
  else {
    if (!/^[a-z0-9-]+\/[a-z0-9-]+$/.test(slug)) {
      report('warning', 0, 'pattern-slug', `Slug "${slug}" should be "namespace/pattern-name" in lowercase with hyphens.`);
    }
    const ns = slug.split('/')[0];
    if (ctx.theme?.textDomain && ns !== ctx.theme.textDomain) {
      report('warning', 0, 'pattern-slug', `Slug namespace "${ns}" differs from the theme text domain "${ctx.theme.textDomain}".`);
    }
    if (ctx.seenSlugs.has(slug)) report('error', 0, 'duplicate-slug', `Slug "${slug}" is also used by ${ctx.seenSlugs.get(slug)}.`);
    else ctx.seenSlugs.set(slug, file);
  }
  if (!cats) report('warning', 0, 'pattern-categories', 'No "Categories:" — the pattern will be hard to find in the inserter.');
  else {
    for (const c of cats.split(',').map((x) => x.trim()).filter(Boolean)) {
      if (!CORE_PATTERN_CATEGORIES.has(c)) {
        report('warning', 0, 'pattern-categories', `Category "${c}" isn't a core category; make sure the theme registers it with register_block_pattern_category().`);
      }
    }
  }
}

/** Top-level arguments of the call whose "(" is at `open`, respecting quotes and nesting. */
function callArgs(code, open) {
  const args = [];
  let depth = 0, cur = '', quote = null;
  for (let i = open; i < code.length; i++) {
    const ch = code[i];
    if (quote) {
      cur += ch;
      if (ch === '\\') { cur += code[++i] ?? ''; continue; }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") { quote = ch; cur += ch; continue; }
    if (ch === '(' || ch === '[') { if (depth++ > 0) cur += ch; continue; }
    if (ch === ')' || ch === ']') {
      if (--depth === 0) { args.push(cur.trim()); return args; }
      cur += ch; continue;
    }
    if (ch === ',' && depth === 1) { args.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  return null;
}

// Position of the text domain argument for each translation function.
const I18N_DOMAIN_ARG = {
  __: 1, _e: 1, esc_html__: 1, esc_html_e: 1, esc_attr__: 1, esc_attr_e: 1,
  _x: 2, _ex: 2, esc_html_x: 2, esc_attr_x: 2, _n: 3, _nx: 4,
};

function checkI18n(php, ctx) {
  const domain = ctx.theme?.textDomain;
  if (!domain) return;
  const re = /\b(esc_html_e|esc_html__|esc_attr_e|esc_attr__|esc_html_x|esc_attr_x|_nx|_ex|_e|__|_x|_n)\s*\(/g;
  for (const p of php) {
    let m;
    while ((m = re.exec(p.code))) {
      const args = callArgs(p.code, m.index + m[0].length - 1);
      const arg = args?.[I18N_DOMAIN_ARG[m[1]]];
      const lit = arg?.match(/^(['"])((?:\\.|(?!\1).)*)\1$/);
      if (lit && lit[2] !== domain) {
        ctx.report('warning', p.off, 'text-domain', `${m[1]}() uses text domain "${lit[2]}" but the theme's is "${domain}".`);
      }
    }
  }
}

function classify(file) {
  const norm = file.split(path.sep).join('/');
  if (/\/patterns\/[^/]+\.php$/.test(norm)) return 'pattern-php';
  if (/\/patterns\/[^/]+\.html$/.test(norm)) return 'pattern-html';
  if (/\/(templates|parts)\/[^/]+\.html$/.test(norm)) return 'template';
  if (/\.(html|php)$/.test(norm)) return 'markup';
  return null;
}

export function validateSource(raw, { file = '<stdin>', kind = 'markup', theme = null, seenSlugs = new Map() } = {}) {
  const findings = [];
  const lineOf = lineIndex(raw);
  const seen = new Set();
  const report = (severity, pos, rule, message) => {
    const line = lineOf(pos);
    const key = `${line}\0${rule}\0${message}`;
    if (seen.has(key)) return; // e.g. the same unknown preset used for top and bottom padding
    seen.add(key);
    findings.push({ severity, line, rule, message });
  };
  const { src, header, php } = prepareSource(raw, kind, report);
  const ctx = { report, theme, lineOf, seenSlugs, stats: { blocks: 0, thirdParty: new Set() } };

  if (theme?.error) report('warning', 0, 'theme-json', theme.error);
  if (kind === 'pattern-php') { checkHeader(header, file, ctx); checkI18n(php, ctx); }
  if (kind === 'pattern-html') {
    report('warning', 0, 'pattern-html', 'WordPress only auto-registers .php files in /patterns. Rename to .php and add a header comment.');
  }

  const tree = parseBlocks(src, report, lineOf);

  // Content outside any block becomes a Classic block.
  let pos = 0;
  for (const c of tree.children) {
    const gap = src.slice(pos, c.start).replace(/<!--[\s\S]*?-->/g, '').replace(/PHPX/g, '').trim();
    if (gap) report('warning', pos, 'freeform-content', `HTML outside any block ("${gap.slice(0, 40)}…") will load as a Classic block. Wrap it in a block.`);
    pos = c.end;
  }
  const tail = src.slice(pos).replace(/<!--[\s\S]*?-->/g, '').replace(/PHPX/g, '').trim();
  if (tail) report('warning', pos, 'freeform-content', `HTML outside any block ("${tail.slice(0, 40)}…") will load as a Classic block.`);
  if (!tree.children.length && kind !== 'markup') report('warning', 0, 'no-blocks', 'No blocks found.');

  walkBlocks(src, tree, ctx);

  // External images in theme patterns.
  if (kind === 'pattern-php' || kind === 'template') {
    const re = /\bsrc="(https?:\/\/[^"]+)"/g;
    let m;
    while ((m = re.exec(raw))) {
      let host = m[1];
      try { host = new URL(m[1]).host; } catch { /* keep raw */ }
      report('warning', m.index, 'external-image',
        `Image loads from ${host}. Bundle it in the theme and use <?php echo esc_url( get_theme_file_uri( 'assets/images/…' ) ); ?>.`);
    }
  }

  findings.sort((x, y) => x.line - y.line);
  return { file, findings, blocks: ctx.stats.blocks, thirdParty: [...ctx.stats.thirdParty] };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function listFiles(target) {
  const st = fs.statSync(target);
  if (st.isFile()) return [target];
  const out = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (classify(p) && classify(p) !== 'markup') out.push(p);
    }
  };
  walk(target);
  return out.sort();
}

function formatResults(results) {
  const lines = [];
  let errors = 0, warnings = 0;
  for (const r of results) {
    errors += r.findings.filter((f) => f.severity === 'error').length;
    warnings += r.findings.filter((f) => f.severity === 'warning').length;
    if (!r.findings.length) { lines.push(`✔ ${r.file} (${r.blocks} blocks)`); continue; }
    lines.push(`${r.file}`);
    for (const f of r.findings) {
      lines.push(`  ${String(f.line).padStart(4)}  ${f.severity.padEnd(7)}  ${f.message}  [${f.rule}]`);
    }
    if (r.thirdParty.length) lines.push(`        note     Structure-only check for: ${r.thirdParty.join(', ')}`);
  }
  lines.push('');
  lines.push(errors || warnings
    ? `${errors ? '✖' : '⚠'} ${errors} error${errors === 1 ? '' : 's'}, ${warnings} warning${warnings === 1 ? '' : 's'} in ${results.length} file${results.length === 1 ? '' : 's'}`
    : `✔ ${results.length} file${results.length === 1 ? '' : 's'} valid`);
  return { text: lines.join('\n'), errors, warnings };
}

function readStdin() {
  try { return fs.readFileSync(0, 'utf8'); } catch { return ''; }
}

function argValue(args, flag) {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
}

function cmdValidate(args) {
  const json = args.includes('--json');
  const themeArg = argValue(args, '--theme');
  const targets = args.filter((x, i) => !x.startsWith('--') && args[i - 1] !== '--theme');
  const results = [];
  const seenSlugs = new Map();
  const themeCache = new Map();
  const themeFor = (p) => {
    const dir = themeArg ? path.resolve(themeArg) : findThemeDir(p);
    if (!dir) return null;
    if (!themeCache.has(dir)) themeCache.set(dir, loadTheme(dir));
    return themeCache.get(dir);
  };

  if (args.includes('--stdin')) {
    const raw = readStdin();
    results.push(validateSource(raw, { theme: themeFor(process.cwd()), kind: argValue(args, '--kind') || 'markup', seenSlugs }));
  } else {
    if (!targets.length) {
      console.error('Usage: pattern-forge.mjs validate <file|dir>... [--json] [--theme <dir>]');
      return 2;
    }
    for (const t of targets) {
      if (!fs.existsSync(t)) { console.error(`Not found: ${t}`); return 2; }
      for (const f of listFiles(t)) {
        const raw = fs.readFileSync(f, 'utf8');
        results.push(validateSource(raw, { file: f, kind: classify(f) || 'markup', theme: themeFor(f), seenSlugs }));
      }
    }
    if (!results.length) { console.log('No pattern, template or part files found.'); return 0; }
  }
  const { text, errors } = formatResults(results);
  console.log(json ? JSON.stringify(results, null, 2) : text);
  return errors ? 1 : 0;
}

function cmdTokens(args) {
  const json = args.includes('--json');
  const dirArg = args.find((x) => !x.startsWith('--')) || process.cwd();
  const dir = findThemeDir(dirArg);
  if (!dir) { console.error(`No theme.json found in ${path.resolve(dirArg)} or its parents.`); return 1; }
  const t = loadTheme(dir);
  if (t.error) { console.error(t.error); return 1; }
  const obj = {
    themeDir: t.dir, themeName: t.themeName, textDomain: t.textDomain,
    layout: { contentSize: t.layout.contentSize, wideSize: t.layout.wideSize },
    ...Object.fromEntries(Object.entries(t.tokens).map(([k, m]) => [k, Object.fromEntries(m)])),
  };
  if (json) { console.log(JSON.stringify(obj, null, 2)); return 0; }
  const out = [`Theme: ${t.themeName || '(unknown)'}  text domain: ${t.textDomain || '(none)'}  dir: ${t.dir}`,
    `Layout: contentSize ${t.layout.contentSize || '-'}, wideSize ${t.layout.wideSize || '-'}`];
  for (const [k, m] of Object.entries(t.tokens)) {
    if (!m.size) continue;
    out.push(`\n${k}:`);
    for (const [slug, v] of m) out.push(`  ${slug.padEnd(28)} ${typeof v === 'string' ? v : JSON.stringify(v)}`);
  }
  console.log(out.join('\n'));
  return 0;
}

function cmdHook() {
  let input;
  try { input = JSON.parse(readStdin() || '{}'); } catch { return 0; }
  const file = input?.tool_input?.file_path;
  if (!file || !fs.existsSync(file)) return 0;
  const kind = classify(file);
  if (!kind || kind === 'markup') return 0;
  const raw = fs.readFileSync(file, 'utf8');
  if (!raw.includes('<!-- wp:') && kind !== 'pattern-php') return 0;
  const theme = (() => { const d = findThemeDir(file); return d ? loadTheme(d) : null; })();
  const res = validateSource(raw, { file, kind, theme });
  const errors = res.findings.filter((f) => f.severity === 'error');
  if (!errors.length) return 0;
  const { text } = formatResults([res]);
  process.stdout.write(JSON.stringify({
    decision: 'block',
    reason: `Pattern Forge found block markup in ${path.basename(file)} that the editor will reject as invalid or load with lost settings. Fix these and save again:\n${text}`,
  }));
  return 0;
}

function main() {
  const [cmd, ...args] = process.argv.slice(2);
  switch (cmd) {
    case 'validate': return cmdValidate(args);
    case 'tokens': return cmdTokens(args);
    case 'hook': return cmdHook();
    default:
      console.log('Pattern Forge\n  validate <file|dir>... [--json] [--theme <dir>]\n  validate --stdin [--kind pattern-php|template|markup]\n  tokens [<theme-dir>] [--json]\n  hook');
      return cmd ? 2 : 0;
  }
}

const isMain = import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('pattern-forge.mjs');
if (isMain) process.exitCode = main();
