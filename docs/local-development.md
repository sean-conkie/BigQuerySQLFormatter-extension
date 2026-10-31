# Local development

How to install, build and run the extension locally. Commands here are verified
against `package.json` and the CI workflow (`.github/workflows/node.js.yml`); if
one is wrong, fix this page in the same change.

See also [architecture](architecture.md) and [testing](testing.md).

## Prerequisites

- Node.js 22 (CI uses 22.x; 22.12 or newer). The extension itself must still
  run on VS Code 1.91's Node 20.9 runtime.
- VS Code 1.91 or newer, only for manual testing; end-to-end tests download
  their own copies.
- Python 3.13 or newer, only for building the Sphinx docs.

## Install and build

```sh
npm ci              # root install; postinstall runs npm ci in client/ and server/
npm run compile     # tsc -b (type-check, emits client/out and server/out) + esbuild bundles in dist/
```

- Run `npm ci` again after pulling changes to any `package-lock.json`. Stale
  dependencies show up as `TS2307: Cannot find module` errors from `tsc -b`.
- `npx tsc -b` alone is enough before running unit tests; `dist/` is only
  needed for packaging and end-to-end tests.
- `npm run watch` rebuilds the TypeScript types and bundles on change.
- Build outputs (`out/`, `dist/`, `coverage/`, `.nyc_output/`, `.vscode-test/`,
  `*.vsix`) are git-ignored; never commit them.

## Running the extension

There's no committed launch configuration (`.vscode/` is git-ignored). To try
the extension by hand, create an Extension Development Host launch configuration
pointing `--extensionDevelopmentPath` at the checkout, then open a `.bqsql` file.
Generic `.sql` files are only handled through explicit GoogleSQL file
associations.

Agents usually can't drive the VS Code UI. Use the automated end-to-end runner
instead (see [testing](testing.md)), and don't claim a manual Extension
Development Host check unless one was actually done.

Diagnostics output:

- **BigQuery Server** output channel: language-server log. Set
  `bigquerySQLFormatter.trace.server` to trace LSP messages.
- **BigQuery SQL Formatter: BigQuery** output channel: BigQuery request
  metadata only.
- The server launches with the same IPC options in run and debug mode; no
  `--inspect` port is configured.

## Generated data

Regenerate rather than hand-edit. Both generators need network access; builds
and tests only use the committed output.

| Data | Command | Details |
| --- | --- | --- |
| Function catalog and grammar function scopes | `npm run generate:completions` | [Refreshing function completions](../CONTRIBUTING.md#refreshing-function-completions) |
| Reserved and non-reserved keywords | `npm run generate:keywords` | [Refreshing keyword data](../CONTRIBUTING.md#refreshing-keyword-data) |

Commit generated output together with the change that needed it.

## BigQuery integration

The BigQuery features are opt-in and run only in the client. Tests use a local
mock server (`client/src/test/bigquery/mockServer.ts`) selected with
`BQSQL_TEST_BIGQUERY_ENDPOINT`; never use real Google credentials or projects in
automated tests. If a manual check against BigQuery is needed, ask the
maintainer first, use only public data or made-up names, and redact project IDs,
account details, query text and tokens from anything you report. See
[BigQuery foundation tests](../CONTRIBUTING.md#bigquery-foundation-tests).

## Docs and releases

- Sphinx docs: see [Documentation](../CONTRIBUTING.md#documentation) (`make docs`).
- Don't bump versions, tag or publish unless asked. Releases update
  `CHANGELOG.md` and use `make version <x.y.z>`, which keeps the root, client and
  server versions in step; see
  [Packaging and release](../CONTRIBUTING.md#packaging-and-release).
