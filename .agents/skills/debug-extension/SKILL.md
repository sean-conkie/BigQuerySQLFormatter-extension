---
name: debug-extension
description: >-
  Diagnose extension activation, language-client or server startup,
  diagnostics not appearing, end-to-end test failures or CI failures.
---

# Debug extension

## Steps

1. Reproduce with the smallest harness that shows the problem: one server test
   file, then `node client/out/test/runTest`, then an Extension Development Host
   if needed (report that one as manual).
2. Classify the failure and start in the matching place:

   - `TS2307: Cannot find module` from `tsc -b`: stale dependencies after a
     lockfile change; run `npm ci`.
   - Extension doesn't activate: check the file extension (`.bqsql`, `.bqddl`,
     `.bqdml`) or GoogleSQL file association, and `package.json` contributions.
   - No diagnostics: check the **BigQuery Server** output channel, set
     `bigquerySQLFormatter.trace.server` to `messages`, and check whether the
     rule is enabled or suppressed by `noqa`.
   - Server never ready: check the `bigquerySQLFormatter/ready` notification
     (grammar and Oniguruma Wasm loading) and the `dist/` contents.
   - Formatting or Fix All fails: the warning names non-converging rules;
     reproduce with `formatting.test.ts`.
   - BigQuery feature fails: check the **BigQuery SQL Formatter: BigQuery**
     output channel, consent, workspace trust, and quota-project or location
     errors.
   - End-to-end failure: logs are in `.vscode-test/logs` (or
     `BQSQL_TEST_LOG_DIR`); in CI, in the `e2e-logs-*` artifact.
   - Fails once on macOS but passes on Linux and Windows: re-run the job first;
     for timing changes, use the **macos-stability** workflow input.

3. Redact SQL, workspace paths, project IDs, tokens and credentials from
   anything you quote.
4. Isolate the failing boundary (client, transport or server) before changing
   code. Don't add sleeps or retries to tests; wait on `ready()` and on
   diagnostics.
5. Add a regression test when it can be made stable, and check restart, disposal
   and recovery.
6. Report the root cause, the evidence and the verification performed.
