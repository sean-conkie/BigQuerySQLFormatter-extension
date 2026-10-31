# Testing and Verification

Choose checks based on changed behaviour; discover exact commands from `package.json`, `client/package.json`, `server/package.json`, the root `Makefile` and CI workflows.

| Change | Minimum evidence |
| --- | --- |
| Docs/metadata | Markdown or manifest validation as applicable |
| Client command/configuration | Focused test plus activation/settings check |
| Language-server diagnostics | Positive/negative SQL fixtures and diagnostic range assertions |
| SQL formatting or fixes | Fixture comparison, semantic preservation and idempotence checks |
| Rule suppression | Plain `noqa` and rule-specific suppression cases |
| LSP contract/lifecycle | Both sides, startup/shutdown and stale-document behaviour |
| Packaging/release | Build/package verification, manifest and artifact inspection |

Run focused tests first, then affected suites, then root checks for cross-cutting changes. The root Makefile currently exposes `make check` (Markdown lint plus npm lint); check the current file before relying on it. An Extension Development Host smoke test is useful for user-visible behaviour, but do not claim it was run unless it was.

Report exact commands and outcomes, including skipped checks and limitations.
