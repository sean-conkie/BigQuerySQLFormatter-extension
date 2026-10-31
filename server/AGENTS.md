# Language server

Follow the root [AGENTS.md](../AGENTS.md) first. Component map and invariants:
[docs/architecture.md](../docs/architecture.md).

## Scope

| Path | Owns |
| --- | --- |
| `src/server.ts` | LSP handlers: document sync, configuration, code actions, formatting, completion, hover |
| `src/validationScheduler.ts`, `src/validate.ts` | Debounced validation and per-document linters |
| `src/settings.ts`, `src/ruleOptions.ts` | Editor settings plus `.bqsqlformatter.json`; rule option schemas |
| `src/linter/` | `linter.ts`, parser, `scope.ts`, `joins.ts`, grammar (`syntaxes/`), `keywords.json` |
| `src/linter/rules/<group>/<CODE>.ts` | Rules; registered in the group's `rules.ts` and `rules/rules.ts` |
| `src/formatting.ts` | Format Document/Selection and Fix All |
| `src/completions/` | Function completion and hover from the generated `functions.json` |

## Rules

- No VS Code APIs, network access, credentials or SQL execution in the server.
- Preserve SQL meaning, comments, string literals, quoted identifiers and
  BigQuery syntax. Never re-case dataset, table or user-defined function names.
- Rules must not match inside strings, comments or quoted identifiers; use the
  token scopes and the source helpers in `rules/source.ts`.
- Diagnostics and edits use valid ranges and never overlap. Fixes keep the
  document's line endings. Fix All and formatting converge and are idempotent.
- Malformed or incomplete SQL must not throw. Honour cancellation and publish
  diagnostics only for the current document version.
- Rule codes, names, options and suppression forms are public. Test the affected
  forms: `-- noqa`, `-- noqa: ST01, LT02`, and the region directives
  `-- noqa: disable=CODE` / `-- noqa: enable=CODE` (including `all`).
- Rules run on pipe syntax only via `pipeQueryRules`
  (`src/linter/parser/queryBlocks.ts`) and inside unsupported blocks only via
  `extendedQuerySafeRules` (`src/linter/linter.ts`); add either only with
  corpus tests.
- Regenerate `functions.json`, `keywords.json` and grammar function scopes with
  `npm run generate:completions` / `npm run generate:keywords`; don't hand-edit.
- New rules follow [Adding a rule](../CONTRIBUTING.md#adding-a-rule): SQLFluff
  code and name (90-99 for project-specific rules), registry, option schema in
  both `ruleOptions.ts` and `package.json`, tests, docs page and changelog.

## Verification

```sh
npx tsc -b && npx --no-install mocha server/out/tests/<path>.test.js   # focused
npm run coverage                                                       # all unit tests, 80% gate
```

- Formatting or fix changes: also run `formatting.test.js` and
  `formattingCorpus.test.js`.
- LSP message or lifecycle changes: also run the client end-to-end tests.
- See [docs/testing.md](../docs/testing.md) for the evidence each change type needs.
