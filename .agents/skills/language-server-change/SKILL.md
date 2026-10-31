---
name: language-server-change
description: >-
  Add or change SQL rules, diagnostics, parsing, formatting, fixes,
  completions or language-server handlers in server/. Use for any change to
  how SQL is analysed or rewritten.
---

# Language server change

## Steps

1. Locate the code from the map in [server/AGENTS.md](../../../server/AGENTS.md).
   For a new rule, follow [Adding a rule](../../../CONTRIBUTING.md#adding-a-rule).
2. Write down the expected behaviour as SQL examples: compliant, noncompliant,
   comments and literals, nested queries, CTEs, pipe syntax and malformed input.
3. Add tests under `server/src/tests/` (rules: `linter/rules/<group>/<CODE>.test.ts`)
   and confirm they fail:

   ```sh
   npx tsc -b && npx --no-install mocha server/out/tests/<path>.test.js
   ```

4. Implement in the server. Change the client only for a new LSP message or a
   user-facing need, and then run the end-to-end tests too.
5. Check the invariants:
   - exact diagnostic ranges; strings, comments and quoted identifiers ignored
   - dataset, table and user-defined function names never re-cased
   - fixes keep line endings (LF, CRLF, CR) and don't overlap
   - Fix All and formatting converge and are idempotent
   - `-- noqa`, rule-specific and `disable=` / `enable=` suppression
   - pipe syntax: opt in through `pipeQueryRules` only with corpus tests;
     otherwise confirm the rule is skipped there
6. For rule options, update `server/src/ruleOptions.ts` (`ruleOptionSchemas`)
   and the matching explicit rule schema in `package.json`; the settings tests
   check they match.
7. For new rules, add a docs page from `docs/rule_template.rst` to
   `docs/source/rules/` and the rules index, plus a `CHANGELOG.md` entry
   (enabled-by-default rules go under "Notable changes").
8. Run the evidence for the change type in
   [docs/testing.md](../../../docs/testing.md#evidence-by-change). Always include
   `npm run lint` and `npm run coverage`; for formatting or fixes, also
   `formatting.test.js` and `formattingCorpus.test.js`.
9. Report the commands run and their results.
