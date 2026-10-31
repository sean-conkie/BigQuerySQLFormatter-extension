# Language Server

Follow the root `AGENTS.md` first.

## Scope

Own SQL parsing, linting rules, diagnostics, formatting, fixes, and language-server protocol responses. Confirm actual responsibilities in the source before editing.

## Rules

- Keep SQL analysis independent of VS Code UI APIs; communicate through the existing client/server protocol.
- Do not execute SQL as part of linting or formatting. Preserve input meaning, comments, string literals, quoted identifiers and BigQuery-specific syntax.
- Treat rule identifiers and `noqa` suppression behaviour as public compatibility surfaces. Test `-- noqa` and rule-specific `-- noqa: ST01` when affected.
- Ensure diagnostics, edits and code actions use correct document coordinates, avoid overlapping invalid edits and handle malformed/incomplete SQL gracefully.
- Prefer deterministic, repeatable results. Test formatter idempotence and non-destructive fixes for affected syntax.
- Consider document updates, cancellation, performance and stale diagnostic publication where the current implementation supports them.
- Add focused positive, negative and regression SQL fixtures for changed rules. Avoid snapshot churn unrelated to the change.

## Verification

Use scripts and tests discovered in `server/package.json` and the actual test tree. Exercise changed SQL dialects, invalid input, suppressions, diagnostics and fix behaviour proportionately. For protocol changes, verify both client and server.
