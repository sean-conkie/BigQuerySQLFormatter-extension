# Changelog

## Unreleased - 0.4.0

- Add AM07 to compare statically known column counts across set-query branches.

- Add AM06 for consistent named or positional GROUP BY/ORDER BY references.

- Add AM05 with quick fixes for explicit INNER JOIN clauses.

- Add AM02 for explicit UNION modifiers. UNION checks move from CV12 to AM02;
  update rule configuration and suppressions accordingly. CV12 retains EXCEPT
  and INTERSECT checks.

## Unreleased - 0.3.0

- Combine Fix All into one document-wide action with conflict-free edits and
  retain individual quick fixes.
- Support Format Document, Format Selection, and format-on-save for GoogleSQL,
  repeating enabled rule fixes until stable while preserving line endings.
- Prevent indentation fixes from deleting SQL tokens misidentified as whitespace.
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
- Enforce at least 80% branch coverage and expand directive and code-action tests.
- Modernize dependency checks, linting, packaging, and cross-platform Visual Studio Code tests.

## 0.2.3 - 2026-10-22

- Fix CV05 quick fixes for NULL inequality comparisons.
- Update dependencies and CI tooling.

Earlier releases are listed on the
[GitHub releases page](https://github.com/sean-conkie/BigQuerySQLFormatter-extension/releases).
