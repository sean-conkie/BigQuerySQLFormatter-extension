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

Edits update the server's document snapshot immediately and debounce validation
until 250 ms after the most recent change. Superseded or closed-document work is
cancelled, and diagnostics are published only for the current version. Parsing
yields between tokenization batches and during statement processing so incoming
edits and LSP request cancellations can be handled. Loaded grammars are shared,
and each open document reuses its parser and rule instances until it is closed.
Opening a document and changing configuration trigger immediate validation.

Regex-based diagnostics use TextMate token scopes to exclude matches inside
strings, quoted identifiers, and comments, on both open and edit. Matching uses
the original source text so diagnostic and quick-fix offsets stay unchanged.
Style and best-practice diagnostics default to Warning rather than Error.
Rules share a central registry and reusable regular expression/parser bases.
Regular expression ranges use explicit named target groups so contextual matches
do not alter fix ranges.

LF, CRLF, and CR line endings are normalized internally for consistent diagnostics
and edit ranges. Generated quick fixes use the document's original line-ending
style; opening or linting a document does not rewrite its line endings.

## Development and CI

The extension requires Visual Studio Code 1.91 or newer, matching the minimum
supported by LSP client/server 10. The Visual Studio Code API types are pinned to
1.91.0 so compilation cannot silently use newer APIs. End-to-end CI covers both
Visual Studio Code 1.91.0 and stable; set `BQSQL_TEST_VSCODE_VERSION=1.91.0` to run
the minimum-version tests locally.

Use Node.js 22.12 or newer in the Node.js 22 release line and install the locked
root, client and server dependencies with `npm ci`.
The following checks run on all pull requests (including stacked branches) and pushes to `main`:

```sh
npm run lint
npm run compile
npm run coverage
npx --no-install vsce package --no-yarn --out extension.vsix
npm run package:check
npm run citest
```

`npm test` runs the server unit tests after compilation. `npm run coverage` also
generates `coverage/lcov.info`, which CI uploads to Codecov using `CODECOV_TOKEN`.
It fails if overall branch coverage falls below 80%. Regression tests cover
multiline incremental edits and CRLF, directive edge cases, diagnostic limits,
and overlapping fix-all edits while preserving individual quick fixes.
Fork pull requests use Codecov's public-repository tokenless uploads; configure the
token as a Dependabot secret as well to enable uploads from Dependabot PRs.

Packaging type-checks and bundles the extension through the VSCE prepublish hook.
`npm run watch` watches both TypeScript types and the esbuild bundles.
`npm run citest`
runs server tests followed by client end-to-end tests, which download and launch Visual Studio Code
and require a display; on headless Linux use
`xvfb-run -a npm run citest`. Packaging and end-to-end tests run on Linux, macOS and Windows.
Set `BQSQL_TEST_VSIX` to the absolute path of a VSIX when running `npm run citest`
to install it into the isolated test profile and run diagnostics tests against
its packaged contents instead of the source checkout. CI uses this mode on all
three operating systems.

The VSIX excludes documentation, tests, CI files, development configuration,
local virtual environments, and root SQL scratch files. `npm run package:check`
checks the package file list for regressions and verifies that grammar JSON,
Oniguruma Wasm, extension entry points, and the Marketplace icon are preserved.
The client and server are bundled with esbuild into `dist/`; grammar JSON and
`onig.wasm` are copied alongside them. No `node_modules` directories are shipped.
Bundled dependency licenses and notices are retained in `dist/ThirdPartyNotices.txt`.

Release publishing uses Node.js 22 and the locked local `@vscode/vsce` dependency,
with `VSCE_PAT` supplied by the repository secret.

Run `npm audit --audit-level=high` in the root, `client`, and `server` directories
to check tooling and runtime dependencies. Dependabot monitors all three npm
manifests and GitHub Actions weekly, grouping minor and patch updates with a
seven-day cooldown.
Node types stay on 22.x; Chai and sinon-chai major upgrades are deferred until
the assertion test harness migrates to ESM. The unused `@vscode/test-cli`
dependency has been removed; end-to-end tests use `@vscode/test-electron` directly.
Server tests use Mocha 12; the client test runner uses Mocha 11 so it also works
with the older embedded Node.js in the minimum supported Visual Studio Code version.
Client-only Mocha overrides select patched `diff` and `serialize-javascript`
versions until the compatible runner incorporates those updates upstream.

Documentation uses Python 3.13 or newer and the stable Sphinx and theme versions
pinned in `docs/requirements.txt`.

TypeScript linting and formatting use pinned Biome 2.6.2 with two-space indentation,
single quotes, and semicolons. `npm run lint` checks both; `npm run lint:fix` applies
safe lint fixes and formatting, and `npm run format` only formats. CI uses `biome ci`
to reject lint and formatting violations. Super-linter's overlapping formatters
are disabled. Formatting-only commits are listed in `.git-blame-ignore-revs`;
use `git config blame.ignoreRevsFile .git-blame-ignore-revs` to skip them in blame.
A separate JSCPD step compares changed pull request files with the same files at
the PR base. It retains the 5% duplication target and rejects increases above an
existing higher baseline. Both snapshots are normalized with the same pinned
formatter before comparing token percentages, so quote styles and line wrapping
do not manufacture regressions. Comments and tests are excluded.
Generated npm lockfiles are excluded from duplication checks; their repeated
dependency metadata is not hand-written source code.
Actions are pinned to commit hashes, and lint results appear in the workflow
summary without requiring permission to post pull request comments.

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
