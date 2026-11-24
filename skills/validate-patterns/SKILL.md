---
name: validate-patterns
description: >
  This skill should be used when the user asks to check, lint, audit or fix WordPress block markup — "validate my
  patterns", "why does this block say invalid content", "check my theme's templates", "fix block recovery errors",
  "lint the patterns folder" — or after Claude edits patterns, templates or template parts in bulk.
argument-hint: "[file or folder, defaults to the current theme]"
---

# Validate block patterns, templates and parts

Check the files in `$ARGUMENTS` (default: the theme in the working folder) for markup that WordPress will flag as
invalid, then fix it.

## Steps

1. **Run the validator.**
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/pattern-forge.mjs" validate <path>
   ```
   A folder is scanned for `patterns/*.php`, `templates/*.html` and `parts/*.html`. A single file of any type is
   checked directly. Add `--json` for machine-readable output, or `--theme <dir>` when the theme.json isn't in a
   parent folder. Exit code 1 means errors were found.

2. **Explain the results** in plain terms, grouped by file: how many errors and warnings, and the handful of root
   causes behind them (one bad attribute often produces several findings). Use `block-markup` →
   `references/common-mistakes.md` to explain each rule.

3. **Fix, if the user asked for fixes** (or ask once if it's unclear). For each error:
   - Treat attributes as the source of truth when they look intentional; regenerate the HTML from them.
   - When the HTML looks intentional and the attribute is missing (for example a hand-written `style="padding:…"`),
     add the attribute instead — that preserves the design.
   - Replace unknown presets with the closest real slug from `tokens`, and mention each swap.
   - Never delete user content to make a block validate.

4. **Re-run** until there are no errors, then summarize what changed per file. Leave warnings that reflect a
   deliberate choice and say why.

## Limits to mention when relevant

- Third-party blocks (any namespace other than `core/`) get structure checks only.
- Cover, media-text, gallery, table, embed and other complex core blocks get structure checks only.
- The validator mirrors WordPress' own comparison rules for common core blocks but isn't the editor itself; for
  critical files suggest a final check in the editor (or WordPress Playground).
