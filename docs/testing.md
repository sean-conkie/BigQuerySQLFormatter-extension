# Testing and verification

Which checks to run for a change, and how. CI runs everything in
`.github/workflows/node.js.yml` on every pull request and push to `main`; run
the relevant subset locally before opening a pull request.

See also [architecture](architecture.md) and [local development](local-development.md).

## Commands

Build first: `npx tsc -b` for unit tests, `npm run compile` for anything that
needs `dist/`.

| Purpose | Command | Notes |
| --- | --- | --- |
| One test file | `npx --no-install mocha server/out/tests/<path>.test.js` | Fast inner loop (about a second) |
| Unit tests | `npm test` | Generator tests, server tests and BigQuery client unit tests |
| Coverage gate | `npm run coverage` | Fails below 80% branch coverage (CI gate) |
| Lint and format | `npm run lint` | Biome; `npm run lint:fix` applies safe fixes |
| Markdown | `make check` | Needs `markdownlint` on `PATH`; otherwise see below |
| Package | `npx --no-install vsce package --no-yarn --out extension.vsix` | Then `npm run package:check` |
| End-to-end | `npm run citest` | Unit tests, then VS Code end-to-end tests |
| End-to-end only | `node client/out/test/runTest` | Needs `npm run compile` first |
| Restricted Mode | `BQSQL_TEST_UNTRUSTED=1 node client/out/test/runTest` | Linting works; BigQuery features stay off |
| Generators | `node --test scripts/generate-completions.test.cjs scripts/generate-keywords.test.cjs` | Offline |
| Sphinx docs | `make docs` | See [Documentation](../CONTRIBUTING.md#documentation) |

Without a global `markdownlint`, lint Markdown with the repository config:

```sh
npx --yes markdownlint-cli -c .github/linters/.markdown-lint.yml <files>
```

End-to-end tests download VS Code into `.vscode-test/` and need a display; on
headless Linux prefix the command with `xvfb-run -a`. Delete any `extension.vsix`
you package locally. Useful variables:

- `BQSQL_TEST_VSCODE_VERSION=1.91.0`: test against the minimum supported VS Code.
- `BQSQL_TEST_VSIX=/absolute/path/extension.vsix`: test the packaged extension.
- `BQSQL_TEST_TIMEOUT_MS`, `BQSQL_TEST_COLD_START_TIMEOUT_MS`: diagnostic wait limits.
- `BQSQL_TEST_LOG_DIR`: keep VS Code and language-server logs on failure.

## Where tests live

- `server/src/tests/`: server unit tests. Rules are in
  `linter/rules/<group>/<CODE>.test.ts`; parser and syntax tests are in
  `linter/` (`parser/`, `querySyntax.test.ts`, `pipe.test.ts`, `crlf.test.ts`);
  formatting and Fix All are in `formatting.test.ts` and
  `formattingCorpus.test.ts` (every default rule must converge); settings are in
  `settings.test.ts` and `projectSettings.test.ts`; LSP lifecycle is in
  `server*.test.ts`, `validationScheduler.test.ts` and `cancellation.test.ts`.
- `client/src/test/`: end-to-end tests (`diagnostics.test.ts`,
  `bigquery.test.ts`) and BigQuery client unit tests
  (`bigquery/unit.test.ts`, against `bigquery/mockServer.ts`).
- `scripts/*.test.cjs`: generator tests, with fixtures in `scripts/fixtures/`.

## Evidence by change

| Change | Minimum evidence |
| --- | --- |
| Docs only | Markdown lint; `make docs` if `docs/source/` changed |
| New or changed rule | Compliant and noncompliant SQL, exact ranges, strings and comments, `noqa`, settings |
| Rule fix | Above, plus fix application, idempotence, CRLF/CR line endings, Fix All and formatting interplay |
| Rule on pipe or extended syntax | Corpus tests before adding it to `pipeQueryRules` or `extendedQuerySafeRules` |
| Formatting or Fix All | `formatting.test.ts`, `formattingCorpus.test.ts`; selection formatting; idempotence |
| Parser or grammar | Parser and query-syntax tests, incremental edits; keyword generator tests if scopes change |
| Setting or rule option | Settings tests, including `.bqsqlformatter.json` precedence and manifest schema alignment |
| LSP lifecycle or protocol | Server lifecycle tests and `node client/out/test/runTest` |
| BigQuery integration | Client unit tests against the mock server, end-to-end tests, and the Restricted Mode run |
| Packaging or manifest | Package plus `npm run package:check` |
| Any code change | `npm run lint` and `npm run coverage` |

## Rules for tests

- Never call Google services or use real credentials in tests; use the mock server.
- Don't add fixed sleeps or automatic retries to end-to-end tests. Wait on the
  extension's `ready()` API and on diagnostics (see the helpers in
  `client/src/test/helper.ts`).
- For timing-sensitive end-to-end changes, ask the maintainer to run the
  **Node.js Test** workflow with **macos-stability** enabled (20 sequential macOS
  runs); see [BigQuery foundation tests](../CONTRIBUTING.md#bigquery-foundation-tests).
- Keep branch coverage at or above 80%.

## Reporting

Report the exact commands you ran and their results, including checks you
skipped and why. Don't claim a check (for example, a manual Extension
Development Host test) unless you ran it.
