# Changelog

## Unreleased - 0.3.0

- Correct incremental parsing after multiline edits and normalize CRLF diagnostic
  positions while preserving line endings in quick fixes.
- Clear diagnostics and document caches on close.
- Parse `noqa` directives from actual line comments and match rule codes exactly.
- Respect resource-scoped settings and the configured diagnostic limit.
- Exclude strings, quoted identifiers, and comments from regular expression diagnostics.
- Replace Onigasm with the maintained Visual Studio Code Oniguruma engine.
- Correct diagnostic rule names and structure-rule documentation links.
- Limit default language registration to BigQuery-specific file extensions.
  Generic SQL files can opt in through explicit GoogleSQL file associations.
- Document the AL04 unique-table-alias rule.
- Bundle the client and server with esbuild and ship no `node_modules`.
- Modernize dependency checks, linting, packaging, and cross-platform Visual Studio Code tests.

## 0.2.3 - 2026-10-22

- Fix CV05 quick fixes for NULL inequality comparisons.
- Update dependencies and CI tooling.

Earlier releases are listed on the
[GitHub releases page](https://github.com/sean-conkie/BigQuerySQLFormatter-extension/releases).
