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

See [Configuration](docs/source/config.rst) for precedence and examples.
Rule-specific style options and `.sqlfluff` compatibility are not yet supported.

## Development and CI

The extension requires Visual Studio Code 1.91 or newer, matching the minimum
supported by LSP client/server 10. The Visual Studio Code API types are pinned to
1.91.0 so compilation cannot silently use newer APIs. End-to-end CI covers both
Visual Studio Code 1.91.0 and stable; set `BQSQL_TEST_VSCODE_VERSION=1.91.0` to run
the minimum-version tests locally.

Use Node.js 22.12 or newer in the Node.js 22 release line and install the locked
root, client and server dependencies with `npm ci`.
The packaging tool's Azure Identity dependency temporarily overrides MSAL Node
to a patched release. Remove this override when Azure Identity supports the
patched version directly.
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
  "[googlesql]": {
    "editor.codeActionsOnSave": {
      "source.fixAll.bigquerySQLFormatter": "explicit"
    }
  },
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
