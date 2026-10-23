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
- Support for Multiple SQL Dialects: While aimed at BigQuery use, the extension supports various SQL dialects, including
  standard SQL and GoogleSQL, ensuring compatibility with different BigQuery environments.
- Best Practices Enforcement: Encourages the use of best practices in SQL query writing, such as preferring LEFT JOIN
  over RIGHT JOIN for better readability and maintainability.

This extension is particularly useful for developers and data analysts who frequently write and maintain BigQuery SQL
queries, providing them with tools to improve code quality and productivity.

Multi-line comments and strings are tracked across lines during initial parsing
and editing. Incremental edits re-tokenize from the first changed line through
the end of the document using the preceding line's TextMate state, so subsequent
diagnostics reflect the current document without reopening it.

Closing a document clears its diagnostics and evicts its token and settings caches.
Reopening it parses the current contents afresh.

LF, CRLF, and CR line endings are normalized internally for consistent diagnostics
and edit ranges. Generated quick fixes use the document's original line-ending
style; opening or linting a document does not rewrite its line endings.

## Development and CI

Use Node.js 22 and install the locked root, client and server dependencies with `npm ci`.
The following checks run on pull requests and pushes to `main`:

```sh
npm run lint
npm run compile
npm run coverage
npx --no-install vsce package --no-yarn
npm run citest
```

`npm test` runs the server unit tests after compilation. `npm run coverage` also
generates `coverage/lcov.info`, which CI uploads to Codecov using `CODECOV_TOKEN`.
Fork pull requests use Codecov's public-repository tokenless uploads; configure the
token as a Dependabot secret as well to enable uploads from Dependabot PRs.

Packaging compiles the extension through the VSCE prepublish hook. `npm run citest`
runs server tests followed by client end-to-end tests, which download and launch Visual Studio Code
and require a display; on headless Linux use
`xvfb-run -a npm run citest`. Packaging and end-to-end tests run on Linux, macOS and Windows.
Release publishing uses Node.js 22 and the locked local `@vscode/vsce` dependency,
with `VSCE_PAT` supplied by the repository secret.

Code linting uses ESLint and formatting checks use Prettier; conflicting Biome
defaults are disabled. A separate JSCPD step checks changed pull request files
against the 5% limit, matching the other changed-file lint checks, and ignores
comments so repeated API documentation is not counted as duplicated logic.
Actions are pinned to commit hashes, and lint results appear in the workflow
summary without requiring permission to post pull request comments.

## Configuration

### Fix on save

Add the following to your `settings.json`.

```json
  "[googlesql]": {
    "editor.codeActionsOnSave": {
      "source.fixAll": "explicit"
    }
  },
```

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
