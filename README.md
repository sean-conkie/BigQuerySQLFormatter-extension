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

Install
[BigQuery SQL Formatter](https://marketplace.visualstudio.com/items?itemName=sean-conkie.bigquerysqlformatter)
from the Visual Studio Code Marketplace.
Requires Visual Studio Code 1.91 or newer. Open a BigQuery-specific file or
select **GoogleSQL** as the document language to start linting.

## BigQuery integration

BigQuery access is **off by default**. This release provides the shared
authentication, REST, consent and status foundation; automatic dry-run checks
([#15](https://github.com/sean-conkie/BigQuerySQLFormatter-extension/issues/15))
and schema-aware completions
([#340](https://github.com/sean-conkie/BigQuerySQLFormatter-extension/issues/340))
are separate, forthcoming features. Enabling their settings currently initializes
the foundation and status UI, but does not automatically send requests.
Ordinary linting, formatting and built-in function completions remain offline.

### Settings and sign-in

Use VS Code user, workspace or workspace-folder settings, never
`.bqsqlformatter.json`. BigQuery keys in that file are ignored with a warning;
offline rule settings still apply.

| `bigquerySQLFormatter.bigquery.*` setting | Default | Purpose |
| --- | --- | --- |
| `projectId` | ADC/gcloud default | Billing project for API calls |
| `quotaProjectId` | Unset | Optional API/quota project; no quota header by default |
| `location` | Unset | Let BigQuery determine the location |
| `defaultDataset` | Unset | Resolve unqualified table names |
| `timeoutMs` | `10000` | Authentication and request deadline, including retries |
| `dryRun.enabled` | `false` | Opt in to the dry-run feature |
| `dryRun.trigger` | `onSave` | `onSave` or `onDemand`; used by the forthcoming feature |
| `dryRun.costPerTiB` | Unset | Optional estimated price; no hard-coded prices |
| `schema.enabled` | `false` | Opt in to schema lookups |
| `schema.cacheTtlMinutes` | `60` | In-memory TTL; used by the forthcoming feature |

Sign in using **Application Default Credentials (ADC)**:

```sh
gcloud auth application-default login
```

Alternatively, set `GOOGLE_APPLICATION_CREDENTIALS` in the extension host's
environment to your ADC/service-account or workload-identity configuration.
The Node-only client uses `google-auth-library` with the BigQuery OAuth scope.
Version 10 is retained for VS Code 1.91's Node 20 runtime; major dependency
updates are blocked until the compatibility work is completed.
The extension never writes credentials or tokens to settings, workspace state,
project files or logs; the authentication library manages tokens in memory.
If your ADC has no default project, set `bigquerySQLFormatter.bigquery.projectId`.
In SSH, containers and other remote workspaces, configure credentials and
environment variables where the extension host runs.

Enabling a feature checks credentials once in the background and caches the
result. Missing or expired credentials produce one sign-in notification. After fixing
the problem, run **BigQuery SQL: Retry BigQuery Connection** to allow another
notification/consent attempt on the next request.

### Consent, trust and privacy

Before the first BigQuery API call, a modal names the project and location
(including when location is automatic). Cross-project schema lookups also name
the billing project, and an optional quota project is also named. It explains the data sent:

- **Dry runs:** query text, sent to `jobs.insert` with `dryRun: true`; queries
  are not executed by this foundation.
- **Schema completions:** dataset, table and column metadata lookups through
  `datasets.list`, `tables.list` and `tables.get`; no billed metadata queries.

Consent is stored only in VS Code workspace state and is isolated by workspace
folder. The modal appears again when the project or location changes, including
changes supplied by a trusted repository's VS Code settings. Run
**BigQuery SQL: Reset BigQuery Consent** to withdraw it and cancel active requests.
Changing `quotaProjectId` also requires renewed consent.

**Restricted Mode now supports offline linting and formatting.** All BigQuery
access is disabled in untrusted workspaces, even if a user setting enables it.
The BigQuery settings are declared restricted configurations.

When either feature is enabled, the status bar shows sign-in state, the active
project and results supplied by the feature. Click it for retry, reset consent,
output and settings actions. **BigQuery SQL Formatter: BigQuery** logs only
operation, project, location, duration and status. It never logs query text,
schema content, API error bodies or tokens.

### Permissions and proxies

Grant only the permissions your features need:

- Dry runs: `bigquery.jobs.create` on the billing project and
  `bigquery.tables.getData` on referenced data, plus permissions required by
  referenced views/routines. `roles/bigquery.jobUser` and appropriately scoped
  `roles/bigquery.dataViewer` are common starting points, not mandatory roles.
- Metadata lookups: `bigquery.datasets.get`, `bigquery.tables.list` and
  `bigquery.tables.get` on the relevant datasets/tables, commonly granted through
  `roles/bigquery.metadataViewer`.
- An explicit quota project (or some impersonated-service-account setups):
  `serviceusage.services.use`, commonly granted through
  `roles/serviceusage.serviceUsageConsumer`, on that project. This role is not
  required merely because a billing project is configured.

Leave `quotaProjectId` unset unless you need a separate API/quota project.
The foundation sends `x-goog-user-project` only when it is explicitly set.
For `accessNotConfigured`, enable the BigQuery API in the credential's project
or configure an API-enabled quota project with the required service-usage
permission. A quota-project permission error names the missing role.
When a configured location produces BigQuery's misleading access-denied
response, the notification includes a location-mismatch hint.

Configure `http.proxy` and `http.proxyStrictSSL` in VS Code when needed.
All API calls use the auth client's `request()` (gaxios, node-fetch and Node
HTTPS), not global `fetch`. The
[integration spike](https://github.com/sean-conkie/BigQuerySQLFormatter-extension/issues/433)
verified VS Code proxy routing for API and ADC token calls on 1.91 and 1.144.
The underlying libraries can also use standard proxy environment variables.
Keep certificate verification enabled. TLS-intercepting corporate proxies,
including `http.proxyStrictSSL: false`, remain a documented manual check.

The BigQuery runtime is bundled separately and loaded only when a feature is
enabled. It is not imported by the language server. Dependency licenses are
generated into the packaged `dist/ThirdPartyNotices.txt`.

## Rules

See the [rule reference](https://bigquerysqlformatter.readthedocs.io/en/latest/rules/)
for all aliasing, ambiguous, capitalisation, convention, layout, references, and structure rules.
The `references` (RF) group checks identifier naming and usage. RF02 requires
source-qualified columns in multi-source queries, including STRUCT field paths.
Its `ignore_words` and `subqueries_ignore_external_references` options apply in
editor and project settings. RF03 enforces STRUCT-aware single-source consistency
with quick fixes, Fix All and formatting; `single_table_references` accepts
`consistent` (default), `qualified` or `unqualified`. RF04 is enabled by default
and warns about keywords used as unquoted aliases. Quoted names are accepted by
default; identifier policies and `ignore_words` are configurable.
RF05 checks quoted identifiers for special characters, with exceptions for
dashed project IDs and INFORMATION_SCHEMA region qualifiers. RF06 removes
unnecessary backticks from columns, aliases and CTE names. Both are enabled by
default; RF06 leaves table paths quoted unless `check_table_paths` is enabled.
The 0.4.0 rules add explicit UNION modifiers and INNER JOINs, consistent
GROUP BY/ORDER BY references, matching set-query column counts, statement
terminators, and CTE layout.

UNION modifier checks now use **AM02** instead of **CV12**. Move any UNION-specific
CV12 settings and `noqa` suppressions to AM02. CV12 continues checking EXCEPT and INTERSECT.

### Pipe and temporal queries

Pipe queries (including FROM-only inputs) and `FOR SYSTEM_TIME AS OF` support
RF01-RF06, AL01, AL02, AL04, AL05, AL06, AL08, AL09, AM04, AM05, AM06 and AM07.
Checks follow each stage's visible table aliases, output aliases and JOIN USING
columns. RF01 remains disabled by default. Quick fixes, Fix All and formatting
preserve pipe placement and line endings.

`MATCH_RECOGNIZE`, `GRAPH_TABLE` and unmodelled pipe operators (such as pipe WITH)
still skip structural checks in their own block and descendants; enclosing
queries and sibling blocks continue to be checked. CP01-CP05, CV01, CV02, CV04,
CV05, CV13, LT01, LT12 and LT13 remain active throughout. Other layout and
structure rules do not yet apply inside pipe queries.

## Rule configuration

Formatting and Fix All retry without rules whose fixes cycle, grow text for ten
consecutive passes, or exceed 100 passes, preserving the fixes from the remaining rules. A warning and the
language server output list the skipped rule codes; this does not change your
rule configuration or suppress their diagnostics. Cycles skip all participating
rules; growth/pass limits skip rules repeatedly applying fixes in the last ten passes.

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

Rules default to enabled with `warning` severity unless documented otherwise.
An opt-in rule with a disabled default requires an explicit `"enabled": true`;
setting a severity, options, or enabling its group is not sufficient. RF01 is
**Disabled by default** because schema-free checking cannot distinguish unknown
table qualifiers from STRUCT field access. Enable it with `"RF01": { "enabled": true }`.
Supported severities are
`error`, `warning`, `information`, `hint`, and `off`. Disabling a rule removes
its diagnostics and fixes, including fix-on-save. Exclusions, disabled groups,
and `off` take precedence over an individual `enabled: true` setting.
Group names are `aliasing`, `ambiguous`, `capitalisation`, `convention`, `layout`,
`references`, and `structure`. Use uppercase rule codes in configuration,
including the `RF` prefix for references rules.

Rules with declared style options accept an `options` object. For example:

```json
{
  "bigquerySQLFormatter.rules": {
    "CP04": { "options": { "capitalisation_policy": "upper" } }
  }
}
```

CP01 (keywords), CP02 (unquoted identifiers), CP03 (functions), CP04 (literals),
and CP05 (data types) accept
`lower` (the default), `upper`, or
`consistent`. `consistent` follows
the first matching token in the file; a mixed-case first token selects
lowercase. Strings, quoted identifiers, and comments are ignored. Group settings
remain boolean toggles, not shared option defaults.

Option declarations also support lists of strings, including RF04's
case-insensitive `ignore_words`. Lists must contain only strings; an empty list is valid. Project
lists replace the corresponding editor list rather than being concatenated.

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
automatically. Options use the same `rules.CODE.options` shape in project files,
and project values override individual option fields, retaining omitted editor
values. Invalid configuration produces a visible error. Unknown options or
invalid option values reset that rule's entire options object to its declared
defaults, without disabling other settings or rules.

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
Formatting uses the rules' existing styles and configured capitalisation policies;
custom indentation and comma-position options are not yet supported. Cycling fixes or more than
100 passes report an error without applying partial formatting.

### Fix All and fix on save

**Fix All** combines fixes across the whole document into one action, even when
only some diagnostics are visible. Like formatting, it repeats safe,
non-overlapping fixes until stable, including issues exposed by earlier fixes.
Individual quick fixes remain available.

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
