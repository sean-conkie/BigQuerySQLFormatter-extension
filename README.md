# BigQuery SQL Formatter

[![Documentation Status](https://readthedocs.org/projects/bigquerysqlformatter/badge/?version=latest)](https://bigquerysqlformatter.readthedocs.io/en/latest/?badge=latest)
[![Lint Code Base](https://github.com/sean-conkie/BigQuerySQLFormatter-extension/actions/workflows/super-linter.yml/badge.svg)](https://github.com/sean-conkie/BigQuerySQLFormatter-extension/actions/workflows/super-linter.yml)
[![CodeQL](https://github.com/sean-conkie/BigQuerySQLFormatter-extension/actions/workflows/codeql.yml/badge.svg)](https://github.com/sean-conkie/BigQuerySQLFormatter-extension/actions/workflows/codeql.yml)
[![Node.js Test](https://github.com/sean-conkie/BigQuerySQLFormatter-extension/actions/workflows/node.js.yml/badge.svg)](https://github.com/sean-conkie/BigQuerySQLFormatter-extension/actions/workflows/node.js.yml)
[![codecov](https://codecov.io/gh/sean-conkie/BigQuerySQLFormatter-extension/graph/badge.svg?token=ZOM3PNJ2SL)](https://codecov.io/gh/sean-conkie/BigQuerySQLFormatter-extension)

## Visual Studio Code extension providing BigQuery SQL syntax checking

The BigQuery SQL Formatter extension for Visual Studio Code provides syntax checking and formatting for BigQuery SQL
queries. This extension aims to enhance the development experience for users working with BigQuery by offering features
such as:

- Syntax Checking: Automatically checks the syntax of BigQuery SQL queries to ensure they are correct and conform to
  best practices.
- Formatting: Provides tools to format SQL queries according to predefined styles, making the code more readable and
  maintainable.
- Language Server Integration: Utilizes a language server to offer real-time feedback and suggestions as users write SQL
  queries.
- GoogleSQL Support: Checks BigQuery's SQL dialect, including BigQuery-specific query features.
- Best Practices Enforcement: Encourages the use of best practices in SQL query writing, such as preferring LEFT JOIN
  over RIGHT JOIN for better readability and maintainability.

This extension is particularly useful for developers and data analysts who frequently write and maintain BigQuery SQL
queries, providing them with tools to improve code quality and productivity.

Diagnostics update as you type, including after edits to multiline strings and
comments. Rules ignore SQL-like text inside strings, quoted identifiers, and
comments. Style and best-practice diagnostics default to warnings. Quick fixes
and formatting preserve your file's line endings; linting does not rewrite files.

## Installation

Install [BigQuery SQL Formatter from the Visual Studio Code Marketplace](
https://marketplace.visualstudio.com/items?itemName=sean-conkie.bigquerysqlformatter).
Requires Visual Studio Code 1.91 or newer. Open a BigQuery-specific file or
select **GoogleSQL** as the document language to start linting.

## Rules

See the [rule reference](https://bigquerysqlformatter.readthedocs.io/en/latest/rules/)
for all aliasing, ambiguous, capitalisation, convention, layout, and structure rules.
The 0.4.0 rules add explicit UNION modifiers and INNER JOINs, consistent
GROUP BY/ORDER BY references, matching set-query column counts, statement
terminators, and CTE layout.

UNION modifier checks now use **AM02** instead of **CV12**. Move any UNION-specific
CV12 settings and `noqa` suppressions to AM02. CV12 continues checking EXCEPT and INTERSECT.

## Rule configuration

Configure rules in your Visual Studio Code user, workspace, or workspace-folder settings:

```json
{
  "bigquerySQLFormatter.rules": {
    "CV05": { "enabled": true, "severity": "error" },
    "LT02": { "enabled": false },
    "exclude": ["CV01"],
    "groups": { "capitalisation": false }
  }
}
```

Rules default to enabled with `warning` severity. Supported severities are
`error`, `warning`, `information`, `hint`, and `off`. Disabling a rule removes
its diagnostics and fixes, including fix-on-save. Exclusions, disabled groups,
and `off` take precedence over an individual `enabled: true` setting.
Group names are `aliasing`, `ambiguous`, `capitalisation`, `convention`, `layout`,
and `structure`. Use uppercase rule codes in configuration.

For shared project settings, create `.bqsqlformatter.json`:

```json
{
  "maxNumberOfProblems": 100,
  "rules": {
    "CV05": { "severity": "error" },
    "LT02": { "enabled": false }
  }
}
```

The nearest config between the SQL file and its workspace-folder root overrides
Visual Studio Code settings field by field. Only that config is used; parent project configs
are not merged. Exclusion arrays replace rather than extend the editor list.
Multi-root workspaces remain isolated. Without a workspace, only the SQL file's
directory is checked. Settings and project-file changes revalidate open documents
automatically. Invalid configuration produces a visible error.

SQL comments can suppress a line (`-- noqa` or `-- noqa: CV05, LT02`) or a
file/region (`-- noqa: disable=CV05, LT02` followed by `-- noqa: enable=CV05`).
Put a disable directive at the top for file-wide suppression; use `all` for all
rules. Enable directives cannot override configured-disabled rules.

See [Configuration](https://bigquerysqlformatter.readthedocs.io/en/latest/config/)
for precedence and examples.
Rule-specific style options and `.sqlfluff` compatibility are not yet supported.

## Configuration

### File associations

GoogleSQL activates automatically for `.bqsql`, `.bqddl`, and `.bqdml` files.
Generic `.sql`, `.ddl`, and `.dml` files are left to your other SQL extensions.
To enable BigQuery linting for them, select **GoogleSQL** from the language mode
picker or add explicit associations to your workspace's `.vscode/settings.json`:

```json
{
  "files.associations": {
    "*.sql": "googlesql",
    "*.ddl": "googlesql",
    "*.dml": "googlesql"
  }
}
```

Only documents in GoogleSQL language mode are linted. Existing associations to
the legacy `sql-bigquery` ID should be changed to `googlesql`.

`bigquerySQLFormatter.maxNumberOfProblems` defaults to 100 and limits published
diagnostics on both opening and editing a document, after `noqa` suppression.
Set it to 0 to hide diagnostics. Settings are resolved per document, including
for code actions, and changing configuration revalidates open documents.

### Format Document and Format Selection

Use **Format Document** or **Format Selection** in GoogleSQL language mode.
This extension is the default formatter for GoogleSQL unless you have chosen
another formatter. To enable formatting on save:

```json
{
  "[googlesql]": {
    "editor.defaultFormatter": "sean-conkie.bigquerysqlformatter",
    "editor.formatOnSave": true
  }
}
```

Formatting applies enabled, automatically fixable rules repeatedly until the
result is stable. It respects editor/project rule settings and `noqa` directives,
preserves line endings, and is not limited by `maxNumberOfProblems`.
Selection formatting only applies fixes wholly contained in the selection;
text outside it is unchanged. Rules without automatic fixes remain diagnostics.
Formatting uses the rules' existing styles; custom indentation, comma-position
and capitalisation options are not yet supported. Cycling fixes or more than
100 passes report an error without applying partial formatting.

### Fix All and fix on save

**Fix All** combines non-overlapping fixes across the whole document into one
action, even when only some diagnostics are visible. Individual quick fixes
remain available. Overlapping fixes may require another invocation; formatting
automatically repeats the fixes.

As an alternative to formatting on save, add this to your `settings.json`:

```json
{
  "[googlesql]": {
    "editor.codeActionsOnSave": {
      "source.fixAll.bigquerySQLFormatter": "explicit"
    }
  }
}
```

The generic `"source.fixAll": "explicit"` setting also includes this extension.

### Disable Rules

#### In-line directive

To disable all rules for a line add comment `-- noqa`.
Directives are case-insensitive and accept zero or more spaces after `--`
(for example `--NOQA` or `--  noqa`). Only actual line comments are directives,
not text inside strings or block comments.

```sql
select case when cc.enddate is null then 1 else null end as is_current -- noqa
  from dataset.table cc;

```

<img width="523" alt="image" src="https://github.com/user-attachments/assets/536963df-f8f5-42b8-8554-205dfaaf6c9a">

To disable specific rules for a line add comment `-- noqa` followed by a comma separated list of rules.
Rule codes are matched exactly, ignoring case: `-- noqa: LT01, CV05` disables
only those rules, while `-- noqa: LT0` does not disable `LT01`.

```sql
select case when cc.enddate is null then 1 else null end as is_current -- noqa: ST01
  from dataset.table cc;

```

<img width="757" alt="image" src="https://github.com/user-attachments/assets/0bd8c99a-a0ae-44de-9c56-f0d9623d3dcc">

## Contributing

For development, testing, adding rules, and release guidance, see
[Contributing](https://github.com/sean-conkie/BigQuerySQLFormatter-extension/blob/main/CONTRIBUTING.md).
