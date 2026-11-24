#!/usr/bin/env node
// Pattern Forge test suite. Run: node tests/run.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { validateSource } from '../scripts/pattern-forge.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const cli = path.join(here, '..', 'scripts', 'pattern-forge.mjs');
const themeDir = path.join(here, 'fixtures', 'theme');

let failed = 0;
let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  ✔ ${name}`); } catch (e) { failed++; console.log(`  ✖ ${name}\n      ${e.message}`); }
}
const rules = (res, sev = 'error') => res.findings.filter((f) => f.severity === sev).map((f) => f.rule);
function expectRules(src, expected, opts = {}) {
  const res = validateSource(src, opts);
  const got = rules(res);
  for (const r of expected) if (!got.includes(r)) throw new Error(`expected rule "${r}", got [${got.join(', ')}]`);
  if (!expected.length && got.length) throw new Error(`expected no errors, got [${got.join(', ')}]: ${res.findings.map((f) => f.message).join(' | ')}`);
  return res;
}

console.log('Fixtures');
test('valid hero pattern has no findings', () => {
  const f = path.join(themeDir, 'patterns', 'hero.php');
  const res = validateSource(fs.readFileSync(f, 'utf8'), { file: f, kind: 'pattern-php', theme: null });
  if (res.findings.length) throw new Error(res.findings.map((x) => x.message).join(' | '));
});
test('template with dynamic blocks is valid', () => {
  const f = path.join(themeDir, 'templates', 'index.html');
  expectRules(fs.readFileSync(f, 'utf8'), [], { kind: 'template' });
});
test('broken pattern reports every seeded mistake (CLI)', () => {
  const r = spawnSync(process.execPath, [cli, 'validate', path.join(themeDir, 'patterns', 'broken.php'), '--json'], { encoding: 'utf8' });
  if (r.status !== 1) throw new Error(`exit ${r.status}`);
  const got = JSON.parse(r.stdout)[0].findings.map((f) => f.rule);
  for (const rule of ['unknown-preset', 'runtime-class', 'orphan-style', 'wrong-tag', 'missing-class', 'orphan-class',
    'malformed-delimiter', 'wrong-parent', 'dynamic-has-html', 'style-mismatch', 'html-unbalanced', 'hardcoded-color']) {
    if (!got.includes(rule)) throw new Error(`missing ${rule}`);
  }
});

console.log('Grammar');
test('unclosed block', () => expectRules('<!-- wp:group -->\n<div class="wp-block-group"></div>', ['unclosed-block']));
test('invalid JSON attributes', () => expectRules('<!-- wp:paragraph {"a":1,} -->\n<p>x</p>\n<!-- /wp:paragraph -->', ['invalid-json']));
test('self-closing static block', () => expectRules('<!-- wp:paragraph /-->', ['self-closing-static']));
test('self-closing dynamic block is fine', () => expectRules('<!-- wp:site-title {"level":0} /-->', []));
test('third-party blocks get structure checks only', () => {
  const res = expectRules('<!-- wp:acme/card {"x":1} -->\n<div class="whatever has-red-color">x</div>\n<!-- /wp:acme/card -->', []);
  if (!res.thirdParty.includes('acme/card')) throw new Error('not reported as third-party');
});
test('freeform HTML between blocks warns', () => {
  const res = validateSource('<p>loose</p>\n<!-- wp:separator -->\n<hr class="wp-block-separator has-alpha-channel-opacity"/>\n<!-- /wp:separator -->');
  if (!rules(res, 'warning').includes('freeform-content')) throw new Error('no warning');
});

console.log('Serialization');
test('heading level matches tag', () => expectRules('<!-- wp:heading {"level":3} -->\n<h3 class="wp-block-heading">x</h3>\n<!-- /wp:heading -->', []));
test('heading missing wp-block-heading', () => expectRules('<!-- wp:heading -->\n<h2>x</h2>\n<!-- /wp:heading -->', ['missing-class']));
test('two root elements', () => expectRules('<!-- wp:paragraph -->\n<p>a</p><p>b</p>\n<!-- /wp:paragraph -->', ['multiple-roots']));
test('group padding object serializes per side', () => expectRules(
  '<!-- wp:group {"style":{"spacing":{"padding":{"top":"20px","left":"var:preset|spacing|30"}}}} -->\n<div class="wp-block-group" style="padding-top:20px;padding-left:var(--wp--preset--spacing--30)"></div>\n<!-- /wp:group -->', []));
test('missing inline style from attributes', () => expectRules(
  '<!-- wp:group {"style":{"spacing":{"padding":"20px"}}} -->\n<div class="wp-block-group"></div>\n<!-- /wp:group -->', ['missing-style']));
test('group tagName', () => expectRules('<!-- wp:group {"tagName":"section"} -->\n<div class="wp-block-group"></div>\n<!-- /wp:group -->', ['wrong-tag']));
test('button custom font size class', () => expectRules(
  '<!-- wp:buttons -->\n<div class="wp-block-buttons"><!-- wp:button {"fontSize":"small"} -->\n<div class="wp-block-button has-custom-font-size has-small-font-size"><a class="wp-block-button__link wp-element-button">Go</a></div>\n<!-- /wp:button --></div>\n<!-- /wp:buttons -->', []));
test('button outside buttons', () => expectRules('<!-- wp:button -->\n<div class="wp-block-button"><a class="wp-block-button__link wp-element-button">Go</a></div>\n<!-- /wp:button -->', ['wrong-parent']));
test('list may only contain list items', () => expectRules(
  '<!-- wp:list -->\n<ul class="wp-block-list"><!-- wp:paragraph -->\n<p>x</p>\n<!-- /wp:paragraph --></ul>\n<!-- /wp:list -->', ['wrong-child']));
test('ordered list uses ol', () => expectRules('<!-- wp:list {"ordered":true} -->\n<ul class="wp-block-list"></ul>\n<!-- /wp:list -->', ['wrong-tag']));
test('image needs img and id class', () => {
  expectRules('<!-- wp:image -->\n<figure class="wp-block-image"></figure>\n<!-- /wp:image -->', ['missing-inner']);
  expectRules('<!-- wp:image {"id":12,"sizeSlug":"full"} -->\n<figure class="wp-block-image size-full"><img src="a.jpg" alt=""/></figure>\n<!-- /wp:image -->', ['missing-class']);
});
test('spacer default height', () => expectRules('<!-- wp:spacer -->\n<div style="height:100px" aria-hidden="true" class="wp-block-spacer"></div>\n<!-- /wp:spacer -->', []));
test('cover needs inner container', () => expectRules('<!-- wp:cover -->\n<div class="wp-block-cover"><span aria-hidden="true" class="wp-block-cover__background has-background-dim"></span></div>\n<!-- /wp:cover -->', ['cover-structure']));
test('runtime class in className', () => expectRules('<!-- wp:group {"className":"wp-container-12"} -->\n<div class="wp-block-group wp-container-12"></div>\n<!-- /wp:group -->', ['runtime-class']));

console.log('Files');
test('pattern without header', () => expectRules('<!-- wp:separator -->\n<hr class="wp-block-separator"/>\n<!-- /wp:separator -->', ['pattern-header'], { kind: 'pattern-php' }));
test('duplicate slugs across files', () => {
  const seen = new Map();
  const src = '<?php\n/**\n * Title: A\n * Slug: t/a\n * Categories: text\n */\n?>\n<!-- wp:separator -->\n<hr class="wp-block-separator"/>\n<!-- /wp:separator -->';
  validateSource(src, { file: 'a.php', kind: 'pattern-php', seenSlugs: seen });
  expectRules(src, ['duplicate-slug'], { file: 'b.php', kind: 'pattern-php', seenSlugs: seen });
});
test('PHP in a template', () => expectRules('<!-- wp:paragraph -->\n<p><?php echo 1; ?></p>\n<!-- /wp:paragraph -->', ['php-in-template'], { kind: 'template' }));

console.log('Hook');
function runHook(filePath) {
  return spawnSync(process.execPath, [cli, 'hook'], {
    input: JSON.stringify({ hook_event_name: 'PostToolUse', tool_name: 'Write', tool_input: { file_path: filePath } }),
    encoding: 'utf8',
  });
}
test('hook blocks on broken pattern', () => {
  const r = runHook(path.join(themeDir, 'patterns', 'broken.php'));
  const out = JSON.parse(r.stdout);
  if (out.decision !== 'block' || !out.reason.includes('wrong-tag')) throw new Error(r.stdout);
});
test('hook is silent on valid pattern', () => {
  const r = runHook(path.join(themeDir, 'patterns', 'hero.php'));
  if (r.stdout.trim() || r.status !== 0) throw new Error(`stdout: ${r.stdout}`);
});
test('hook ignores unrelated files', () => {
  const r = runHook(path.join(here, 'run.mjs'));
  if (r.stdout.trim() || r.status !== 0) throw new Error(`stdout: ${r.stdout}`);
});
test('hook ignores bad input', () => {
  const r = spawnSync(process.execPath, [cli, 'hook'], { input: 'not json', encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`exit ${r.status}`);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
