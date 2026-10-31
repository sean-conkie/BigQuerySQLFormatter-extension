---
name: delivery
description: >-
  Implement or review a bounded change that no more specific skill covers:
  client features, settings, BigQuery integration, tooling, CI or
  documentation. Use language-server-change, debug-extension or
  release-extension instead when they apply.
---

# Delivery

## Choose a mode

- `quick`: mechanical changes (typos, renames, doc tweaks, dependency pins).
  Run the single most relevant check: lint, markdownlint or one test file.
- `standard`: a bounded fix or feature in one boundary (client or server).
  Write a failing test first, then run the focused tests, `npm run lint` and
  `npm run coverage`.
- `complex`: changes across boundaries (client and server, LSP messages,
  settings plus manifest, packaging). Run the `standard` checks plus the package
  check and end-to-end tests, with Restricted Mode or VS Code 1.91 runs where
  relevant.
- `review`: assessment without editing. Report findings by severity with
  `path:line`, and run cheap checks to confirm claims.

## Steps

1. State the goal, the affected boundary, the compatibility surfaces involved
   (commands, settings, rule codes, LSP messages) and the mode.
2. Read the closest `AGENTS.md`, the relevant part of
   [docs/architecture.md](../../../docs/architecture.md) and the code involved.
3. For behaviour changes, write a failing test or a minimal reproduction first.
4. Make the smallest coherent change. No speculative refactors.
5. Verify using the mode's checks and the evidence table in
   [docs/testing.md](../../../docs/testing.md#evidence-by-change).
6. For user-visible changes, add an entry under `## Unreleased` in
   `CHANGELOG.md`; behaviour changes go under "Notable changes".
7. Summarise the files changed, the checks run (passed, failed or not run) and
   any remaining risks.
