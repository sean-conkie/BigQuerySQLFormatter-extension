# VS Code client

Follow the root [AGENTS.md](../AGENTS.md) first. Component map and invariants:
[docs/architecture.md](../docs/architecture.md).

## Scope

- `src/extension.ts`: activation; `LanguageClient` over IPC to
  `dist/server.js`; `.bqsqlformatter.json` watcher; the exported `ready()` API.
- `src/bigquery/`: the opt-in BigQuery runtime (`loader.ts`, `service.ts`,
  `rest.ts`, `settings.ts`), lazy-loaded as `dist/bigquery.js`.
- `src/test/`: end-to-end tests and harness (`runTest.ts`, `helper.ts`), plus
  BigQuery unit tests and the mock server in `bigquery/`.

No SQL analysis belongs here; it lives in the server.

## Rules

- Use only VS Code 1.91 APIs (`@types/vscode` is pinned to 1.91.0). The
  extension host runs Node 20.9 on the minimum version.
- Register commands, listeners and clients through `context.subscriptions`, and
  pair every registration with disposal; restarts must not register twice.
- Preserve command IDs (`bigquerySQLFormatter.bigquery.*`), setting keys, the
  `googlesql` language ID and file extensions, and the exported `ready()` API,
  which the end-to-end tests depend on.
- Keep activation fast. The BigQuery bundle loads only when a BigQuery feature
  is enabled.
- BigQuery integration:
  - Make every request through the auth client's `request()`. Global `fetch`
    bypasses VS Code's proxy on 1.91, and a unit test forbids it.
  - Never read `bigquerySQLFormatter.bigquery.*` from `.bqsqlformatter.json`.
    Add each new BigQuery setting to `capabilities.untrustedWorkspaces.restrictedConfigurations`
    in `package.json`.
  - Calls need opt-in, consent naming the project and location, and a trusted
    workspace.
  - `google-auth-library` and `gaxios` stay on their current majors (#435).
- Output channels hold metadata only: never document text, query text, schema
  contents, workspace paths or tokens.
- Handle failed server startup, configuration changes and shutdown without
  leaving stale status bar items or diagnostics.

## Verification

```sh
npx tsc -b
npx --no-install mocha client/out/test/bigquery/unit.test.js   # BigQuery unit tests (mock server)
npm run compile && node client/out/test/runTest                # end-to-end tests
BQSQL_TEST_UNTRUSTED=1 node client/out/test/runTest            # Restricted Mode
```

- For API or compatibility changes, also run end-to-end tests with
  `BQSQL_TEST_VSCODE_VERSION=1.91.0`.
- For manifest changes, package and run `npm run package:check`.
- See [docs/testing.md](../docs/testing.md) for the rest. Report manual
  Extension Development Host checks separately from automated tests.
