# Architecture

A map of the codebase for coding agents. Detailed design notes live in
[CONTRIBUTING.md](../CONTRIBUTING.md); this page tells you where things are, how
they connect, and which invariants a change must not break. If code and this
page disagree, the code wins: fix this page in the same change.

See also [local development](local-development.md) and [testing](testing.md).

## Components

The extension is a Visual Studio Code language client (`client/`) and an LSP language
server (`server/`), bundled with esbuild into `dist/`.

<!-- prettier-ignore -->
| Path | Responsibility |
| --- | --- |
| `client/src/extension.ts` | Activation; starts `dist/server.js` (IPC); watches `.bqsqlformatter.json`; `ready()` |
| `client/src/bigquery/` | Opt-in BigQuery runtime (auth, REST, settings, consent, status bar); `dist/bigquery.js` |
| `server/src/server.ts` | LSP handlers: document sync, configuration, code actions, formatting, completion, hover |
| `server/src/validationScheduler.ts`, `validate.ts` | Debounced validation (250 ms) and per-document linter instances |
| `server/src/settings.ts`, `ruleOptions.ts` | Editor settings plus nearest `.bqsqlformatter.json`; rule options |
| `server/src/linter/linter.ts` | Runs rules, applies `noqa` directives, builds code actions |
| `server/src/linter/parser/` | TextMate tokenization, incremental token cache, statement AST, query blocks |
| `server/src/linter/scope.ts`, `joins.ts` | Query scopes (sources, aliases, CTEs, pipe stages) and the JOIN ON model |
| `server/src/linter/rules/<group>/<CODE>.ts` | Rules, registered in the group's `rules.ts` and in `rules/rules.ts` |
| `server/src/formatting.ts` | Format Document/Selection and Fix All (repeat fixes until stable, with recovery) |
| `server/src/completions/` | Function catalog and client-supplied schema metadata for completion and hover |
| `server/src/linter/syntaxes/` | GoogleSQL TextMate grammar; Oniguruma Wasm is copied into `dist/` |
| `scripts/` | esbuild build, package check, duplication check, completion and keyword generators |
| `package.json` | Manifest: settings schema (including rule-option schemas), `capabilities.untrustedWorkspaces` |

Documentation: `README.md` is the Marketplace page (user-facing only),
`CONTRIBUTING.md` holds contributor detail, `docs/source/` is the Sphinx user
documentation (one page per rule), and `docs/*.md` are these agent guides,
alongside the `AGENTS.md` files and the workflows in `.agents/skills/`.

## Runtime flow

1. The client activates for `.bqsql`, `.bqddl` and `.bqdml` files (or explicit
   GoogleSQL file associations) and launches the server over IPC.
2. The server loads the grammar and Oniguruma Wasm, then sends the custom
   `bigquerySQLFormatter/ready` notification, which resolves the client's `ready()`.
3. Opening a document validates it immediately. Edits update the document
   snapshot at once and validate 250 ms after the last change; superseded work is
   cancelled and only current-version diagnostics are published.
4. Settings changes and `.bqsqlformatter.json` changes (forwarded by the client's
   file watcher) revalidate open documents. Closing a document clears its
   diagnostics and caches.

Custom LSP messages include `bigquerySQLFormatter/ready`,
`bigquerySQLFormatter/sourceTokens` for client dry-run analysis, and
`bigquerySQLFormatter/schema` for client-supplied schema metadata. BigQuery
authentication and REST calls run entirely in the client; the server makes no
network calls.

## Invariants

Changes must preserve these; most have dedicated tests.

- **Offline server.** No network access or credentials in `server/`. BigQuery
  code stays in `client/src/bigquery/`, uses the auth client's `request()` (never
  global `fetch`, which bypasses Visual Studio Code's proxy on 1.91), and is lazy loaded.
- **Minimum runtime.** Visual Studio Code 1.91 runs Node 20.9 in the extension host. Don't
  use newer Visual Studio Code APIs (`@types/vscode` is pinned to 1.91.0) or dependencies
  that need a newer Node; `google-auth-library` stays on major 10 (#435).
- **Settings trust.** `bigquerySQLFormatter.bigquery.*` settings are never read
  from `.bqsqlformatter.json` and are listed in `restrictedConfigurations`.
- **Case-sensitive names.** Never re-case dataset, table or user-defined function
  names (BigQuery treats them as case-sensitive).
- **Text safety.** Rules ignore strings, quoted identifiers and comments. Fixes
  preserve the document's line endings. Formatting and Fix All are idempotent and
  never edit inside a skipped query block.
- **Extended syntax.** Rules run on pipe syntax and `FOR SYSTEM_TIME AS OF` only
  if listed in `pipeQueryRules` (`server/src/linter/parser/queryBlocks.ts`), and
  inside unsupported blocks (`MATCH_RECOGNIZE`, `GRAPH_TABLE`) only if listed in
  `extendedQuerySafeRules` (`server/src/linter/linter.ts`). Add a rule to either
  list only with corpus tests. See
  [Extended query coverage](../CONTRIBUTING.md#extended-query-coverage).
- **Rule codes.** Use SQLFluff-compatible codes and names; codes 90-99 in each
  group are project-specific. See [Rule codes](../CONTRIBUTING.md#rule-codes).
- **Generated data.** Don't hand-edit `server/src/completions/functions.json`,
  `server/src/linter/keywords.json` or the grammar's `generatedFunctions` entry;
  regenerate them (see [local development](local-development.md#generated-data)).
- **Packaging.** `.vscodeignore` is an allow-list; the VSIX ships only `dist/`
  and the manifest files checked by `npm run package:check`.

## Where a change goes

<!-- prettier-ignore -->
| Change | Touch |
| --- | --- |
| New or changed rule | Rule file and group `rules.ts`; tests; `docs/source/rules/` page and index; `CHANGELOG.md` |
| Rule option | `ruleOptions.ts` and `ruleOptionSchemas`; matching explicit rule schema in `package.json` |
| Editor setting | `package.json` schema; `server/src/settings.ts` (or `client/src/bigquery/settings.ts`); `README.md` |
| Parser or grammar | `server/src/linter/parser/`, `syntaxes/`; regenerate keywords if keyword scopes change |
| Formatting or Fix All | `server/src/formatting.ts`; rule fix code |
| BigQuery integration | `client/src/bigquery/`; mock server tests; `README.md` "BigQuery integration" section |
| New LSP message | Both `client/src/extension.ts` and `server/src/server.ts`; end-to-end test |
| Packaging | `scripts/build.cjs`, `.vscodeignore`, `scripts/check-package.cjs` |

The step-by-step checklist for rules is in
[Adding a rule](../CONTRIBUTING.md#adding-a-rule).
