# Changelog

## Unreleased

### Added

- Add typed per-rule options with defaults, validation, editor schema completion,
  and field-by-field project overrides. Invalid options report errors and reset
  only that rule's options to defaults; changes apply without reloading.
- Add CP04 `capitalisation_policy`: `lower` (default), `upper`, or `consistent`,
  backed by a reusable token-scope capitalisation rule base with quick fixes,
  Fix All, and formatting.

### Fixed

- Detect mixed-case boolean/null literals such as `True` and `Null` in CP04,
  without matching identifier substrings, quoted identifiers, strings or comments.

## 0.4.0 - 2026-10-25

### Breaking changes

- Require Visual Studio Code 1.91 or newer.
- Move UNION modifier checks from CV12 to the new AM02 rule. Update rule
  configuration and `noqa` suppressions that refer to CV12 for UNION. CV12 still
  checks EXCEPT and INTERSECT.
- Report all style and best-practice rules as warnings by default. AL01, AL02,
  AL04, AL05, AL06, AL08, AM01, AM04, CP04, LT04, LT09, LT10, LT11, LT12, LT13,
  LT15, ST01 and ST08 previously reported errors. Set a rule's `severity` to
  `error` to restore the previous behaviour.

### Added

- Configure rules per resource with `bigquerySQLFormatter.rules`: enable or
  disable rules, set severity (`error`, `warning`, `information`, `hint`, `off`),
  exclude rules, and toggle rule groups. Disabled rules produce no diagnostics
  or fixes.
- Share project settings in `.bqsqlformatter.json`. The nearest file in the
  workspace folder overrides editor settings field by field, changes are applied
  without reloading, and invalid files are reported.
- Suppress rules for a file or region with `-- noqa: disable=CODE` and
  `-- noqa: enable=CODE`, including `all`.
- Support Format Document, Format Selection, and format-on-save for GoogleSQL by
  repeating enabled rule fixes until stable while preserving line endings.
- Add AM02 for explicit UNION modifiers.
- Add AM05 with quick fixes for explicit INNER JOIN clauses.
- Add AM06 for consistent named or positional GROUP BY/ORDER BY references.
- Add AM07 to compare statically known column counts across set-query branches.
- Add CV06 with fixes for attached statement terminators and newlines.
- Add LT07 with fixes for multiline CTE closing-bracket layout.
- Add LT08 with fixes for empty lines between CTEs and the main query.

### Changed

- Combine Fix All into one document-wide action
  (`source.fixAll.bigquerySQLFormatter`) with conflict-free edits, and keep
  individual quick fixes. The generic `source.fixAll` setting still applies it.
- Validate 250 ms after the latest edit and cancel superseded work, keeping the
  editor responsive in large files.
- Upgrade to version 10 of the Visual Studio Code language client and server.
- Focus the Marketplace readme on users; contributor guidance is now in
  [CONTRIBUTING.md](https://github.com/sean-conkie/BigQuerySQLFormatter-extension/blob/main/CONTRIBUTING.md).

### Fixed

- Prevent indentation fixes from deleting SQL tokens misidentified as whitespace.
- Publish diagnostics only for the current document version, so rapid edits no
  longer leave stale diagnostics.

## 0.3.0 - 2026-10-23

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
- Correct incremental parsing after multiline edits and normalize CRLF diagnostic
  positions while preserving line endings in quick fixes.
- Update `brace-expansion` to fix a high-severity vulnerability.
- Update dependencies and CI tooling.

Earlier releases are listed on the
[GitHub releases page](https://github.com/sean-conkie/BigQuerySQLFormatter-extension/releases).
