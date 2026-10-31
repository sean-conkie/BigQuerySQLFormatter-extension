# BigQuery SQL Formatter: agent guide

A VS Code extension that lints and formats GoogleSQL (BigQuery). It has a VS
Code language client (`client/`) and an LSP language server (`server/`),
bundled into `dist/`. GoogleSQL is the only supported dialect.

## Start here

1. Before changing code, read the component map and **Invariants** in
   [docs/architecture.md](docs/architecture.md), then the closest module guide:
   [client/AGENTS.md](client/AGENTS.md) or [server/AGENTS.md](server/AGENTS.md).
2. Declare one route in a single sentence, `Skill: <name>` or `Skill: none`,
   using the routing table below.
3. Make the smallest coherent change, verify it with the evidence listed in
   [docs/testing.md](docs/testing.md), and report actual results.

## Skill routing

Skills live in `.agents/skills/`. Specific skills take precedence over
`delivery`.

| Task | Skill |
| --- | --- |
| Preparing or checking a release (changelog, version, release readiness) | `release-extension` |
| Activation, client/server startup, end-to-end or CI failures | `debug-extension` |
| Rules, diagnostics, parsing, formatting, fixes, completions, LSP handlers | `language-server-change` |
| Drafting, creating or updating a pull request | `git-pr-authoring` |
| Any other implementation or review (client, settings, BigQuery integration, tooling, docs) | `delivery` |
| Questions, or trivial edits needing no verification beyond a lint | `none` |

## Non-negotiables

Each has caused a bug or an issue before. Details:
[Invariants](docs/architecture.md#invariants).

- Never re-case dataset, table or user-defined function names: BigQuery treats
  them as case-sensitive.
- Formatting and Fix All must converge and be idempotent;
  `formattingCorpus.test.ts` checks every default rule.
- Rules ignore strings, comments and quoted identifiers. Fixes keep the
  document's line endings and never edit inside skipped query blocks.
- The server is offline: no network access or credentials in `server/`.
  BigQuery code stays in `client/src/bigquery/` and uses the auth client's
  `request()`, never global `fetch`.
- `bigquerySQLFormatter.bigquery.*` settings are never read from
  `.bqsqlformatter.json`. BigQuery features need opt-in, consent and a trusted
  workspace.
- VS Code 1.91 (Node 20.9 in the extension host) is the minimum: no newer VS Code
  APIs or dependencies needing a newer Node. `google-auth-library` stays on 10.
- Rules run on pipe syntax only if listed in `pipeQueryRules`, and inside
  unsupported blocks only if listed in `extendedQuerySafeRules`.
- Regenerate `functions.json`, `keywords.json` and the grammar's function scopes;
  never hand-edit them.
- Rule codes follow SQLFluff; codes 90-99 in each group are project-specific.

## Ownership

| Path | Owns |
| --- | --- |
| `client/` | VS Code integration: activation, language client, commands, settings UI, BigQuery runtime |
| `server/` | SQL analysis: parsing, rules, diagnostics, fixes, formatting, completions, LSP handlers |
| `package.json`, `language-configuration.json` | Manifest: contributions, settings schema, workspace trust, scripts |
| `scripts/` | esbuild build, package check, duplication check, completion and keyword generators |
| `.github/` | CI workflows, linters, issue templates, Dependabot |
| `docs/` | Agent guides (`docs/*.md`) and Sphinx user documentation (`docs/source/`) |

## Commands

All npm scripts are in the root `package.json`; `client/` and `server/` have
none. The full table is in [docs/testing.md](docs/testing.md#commands).

```sh
npm ci                                              # rerun after any lockfile change
npx tsc -b                                          # type-check and emit out/ for tests
npx --no-install mocha server/out/tests/<path>.test.js  # one test file
npm run lint                                        # Biome
npm run coverage                                    # all unit tests, 80% branch gate
```

## Working rules

- Source, tests and the root `package.json` are authoritative. If guidance here
  or in `docs/` is stale, fix it in the same change.
- Keep editor integration in the client and SQL analysis in the server; don't
  duplicate logic across the boundary.
- Preserve command IDs, setting keys, the `googlesql` language ID, rule codes,
  rule options and LSP messages unless the change is intentional; record
  intentional changes under "Notable changes" in `CHANGELOG.md`.
- Treat SQL as untrusted input and never execute it. Only the opt-in BigQuery
  features send SQL or metadata to Google, from the client, after consent, in a
  trusted workspace (#434, #15, #340).
- Reproduce reported bugs first, and add the smallest stable regression test.
- Add user-visible changes to `CHANGELOG.md` under `## Unreleased`.
- Report each check as passed, failed or not run, with reasons. Never imply an
  unexecuted check passed.
- Avoid unrelated refactors, generated-file churn and permanent review reports.

## Documentation map

| File | Purpose |
| --- | --- |
| `README.md` | Marketplace page: user-facing features and configuration only; link to repo docs with absolute URLs |
| `CONTRIBUTING.md` | Contributor detail, including [Adding a rule](CONTRIBUTING.md#adding-a-rule) |
| `CHANGELOG.md` | Release notes; `## Unreleased` collects changes until release |
| `docs/source/` | Sphinx user docs, one page per rule (`docs/rule_template.rst`) |
| `docs/architecture.md`, `docs/testing.md`, `docs/local-development.md` | Agent guides |
| `AGENTS.md` files, `.agents/skills/` | Agent routing, rules and workflows |

Keep transient notes in issues and pull requests, not in permanent documents.

## Safety

- Don't publish, create GitHub releases, push tags or change package versions
  without explicit approval. Creating a GitHub release publishes to the
  Marketplace.
- Don't run destructive Git operations or push without approval.
- Never put credentials, tokens, real project IDs, account details or user SQL
  in logs, tests, commits, issues or pull requests. Tests use the BigQuery mock
  server, never real Google services.
