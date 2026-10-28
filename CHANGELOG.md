# Changelog

## Unreleased

### Notable changes

- Pipe queries and `FOR SYSTEM_TIME AS OF` now support RF01-RF06, AL01, AL02,
  AL04, AL05, AL06, AL08, AL09, AM04, AM05, AM06 and AM07. Existing pipe SQL may
  report new warnings and receive alias, INNER JOIN and reference fixes through
  quick fixes, Fix All and formatting. RF01 remains disabled by default.
- Model typed pipe clauses and stage-local name visibility, including nested
  pipelines, output aliases, JOIN USING columns and temporal source aliases.
  MATCH_RECOGNIZE, GRAPH_TABLE and unmodelled pipe operators remain protected,
  without suppressing checks in enclosing queries or sibling blocks.
- Preserve pipe placement and LF/CRLF/CR line endings. Other layout and structure
  rules remain gated pending pipe-specific formatting support.

## 0.6.0 - 2026-10-28

### Notable changes

- Five new reference rules are enabled by default, so existing SQL may report
  new warnings:

  - RF02 flags unqualified columns in queries that read from more than one source.
  - RF03 flags inconsistently qualified columns in single-source queries.
  - RF04 flags keywords used as unquoted aliases.
  - RF05 flags spaces and special characters in backtick-quoted identifiers.
  - RF06 flags unnecessary backticks.

  RF03 and RF06 also apply through Fix All, format-on-save and Format Document.
  To opt out, disable individual rules or turn the group off with
  `"groups": { "references": false }`.

- Rules now skip only the query block that contains pipe syntax,
  `MATCH_RECOGNIZE`, `GRAPH_TABLE` or `FOR SYSTEM_TIME AS OF`, rather than the
  whole statement. The surrounding query, sibling CTEs and subqueries are linted,
  fixed and formatted again, so these statements may report new warnings.

### Added

- Add the `references` rule group and `RF` rule codes to editor settings and
  `.bqsqlformatter.json`.
- Support rules that are disabled by default and need an explicit
  `"enabled": true`. Exclusions, disabled groups and severity `off` still take
  precedence.
- Add RF01 (`references.from`) for qualifiers that don't match any table, alias,
  CTE, `UNNEST`/`WITH OFFSET` alias, table-valued function, DML target or outer
  query source. **Disabled by default**, because STRUCT field access such as
  `address.city` can look like an unknown qualifier. No automatic fix.
- Add RF02 (`references.qualification`) for unqualified columns in multi-source
  queries. STRUCT paths, `USING` columns, select-list aliases and `UNNEST`/
  `WITH OFFSET` values are handled. Options: `ignore_words` and
  `subqueries_ignore_external_references`. No automatic fix.
- Add RF03 (`references.consistent`) for consistent qualification in
  single-source queries, treating dotted references as STRUCT field access unless
  the first part is the source alias. Option `single_table_references`:
  `consistent` (default), `qualified` or `unqualified`. Quick fixes add or remove
  the qualifier, preserving table path spelling and line endings. Correlated and
  ambiguous references, wildcards and `UNNEST` value tables are left unchanged.
- Add RF04 (`references.keywords`) for keywords used as identifiers. Options:
  `unquoted_identifiers_policy` (default `aliases`), `quoted_identifiers_policy`
  (default `none`) and case-insensitive `ignore_words`. No automatic rename.
- Add RF05 (`references.special_chars`) for spaces and symbols in backtick-quoted
  identifiers. Dashed project IDs and `INFORMATION_SCHEMA` region qualifiers are
  allowed. Options: `quoted_identifiers_policy`, `allow_space_in_identifier`,
  `additional_allowed_characters` and `ignore_words`.
- Add RF06 (`references.quoting`) to remove unnecessary backticks from columns,
  field references, aliases and CTE names. Reserved words, leading digits and
  special characters keep their backticks. Table paths are skipped unless
  `check_table_paths` is enabled. Option: `ignore_words`.

### Fixed

- Fix All now repeats safe fixes until the result is stable, like formatting,
  so removing backticks (RF06) and re-casing the unquoted name (CP02) complete in
  one run.
- Keep quick fixes, Fix All and formatting out of skipped query blocks,
  including nested queries and after incremental edits.
- Don't add indentation for a missing `ON` clause on joins that use `USING`.

## 0.5.0 - 2026-10-27

### Notable changes

- Four new capitalisation rules (CP01, CP02, CP03, CP05) are enabled by default
  with the `lower` policy. Upper- or mixed-case SQL now reports warnings, and
  Format Document, format-on-save and Fix All lowercase keywords, identifiers,
  built-in function names and data types. Case-sensitive dataset, table and
  user-defined function names are preserved. To keep existing casing, set the rule's
  `capitalisation_policy` to `upper` or `consistent`, or turn the group off with
  `"groups": { "capitalisation": false }`.
- Rules that depend on SELECT clause structure skip statements that contain pipe
  syntax, `MATCH_RECOGNIZE`, `GRAPH_TABLE` or `FOR SYSTEM_TIME AS OF`, including
  an enclosing query when the new syntax is inside a CTE or subquery.
  CP01–CP05, CV01, CV02, CV04, CV05, CV13, LT01, LT12 and LT13 still check these
  statements.

### Added

- Configure rule behaviour with typed per-rule `options` in settings and
  `.bqsqlformatter.json`, with completion and validation in the editor. Project
  options override editor options field by field, and changes apply without
  reloading. Invalid options are reported and only that rule falls back to its
  defaults.
- Add a `capitalisation_policy` option to CP01–CP05: `lower` (default), `upper`
  or `consistent` (follow the first matching token in the file).
- Add CP01 for keyword capitalisation, including multi-word keywords and pipe
  operators.
- Add CP02 for unquoted identifier capitalisation: columns, field references,
  aliases and CTE names, including references to visible CTEs. Project, dataset
  and table names and quoted identifiers are left unchanged.
- Add CP03 for built-in function name capitalisation, including namespaced and
  `SAFE.`-prefixed built-ins from the generated catalog. User-defined functions
  and unknown calls are left unchanged.
- Add CP05 for data type capitalisation, including parameterised and nested
  types such as `numeric(10, 2)` and `array<struct<a int64>>`.
- Support GoogleSQL pipe syntax (`|>`), `MATCH_RECOGNIZE`, `GRAPH_TABLE` and
  `FOR SYSTEM_TIME AS OF` in highlighting and parsing, including nested pipe
  queries. Formatting and Fix All preserve these queries.
- Generate function completions and hover documentation for 492 functions from
  the BigQuery reference, including AI/ML, vector search and newer array and JSON
  functions. Completion is also triggered after a dot.

### Fixed

- Preserve case-sensitive dataset, table and user-defined function names in
  CP02/CP03 quick fixes, Fix All and formatting under every casing policy.
- Flag mixed-case boolean and null literals such as `True` and `Null` in CP04.
- Stop CP04 and CV05 fixes from changing `NULLIF` and identifiers that start
  with `NULL`.
- Split statements only at real terminators, not semicolons inside comments,
  strings or quoted identifiers, and handle several statements on one line.
- Keep highlighting correct inside nested constructs after zero-length
  whitespace matches.
- Match function completions and hover case-insensitively, and complete
  qualified names without duplicating the namespace.

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
