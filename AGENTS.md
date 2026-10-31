# BigQuery SQL Formatter

Use the closest `AGENTS.md` to the code being changed. Root guidance sets repository-wide rules; `client/` and `server/` guidance owns the respective implementation boundaries.

## Start Here

1. Identify whether the change belongs to the VS Code client, language server, or shared extension metadata.
2. Read the nearest `AGENTS.md`, relevant `package.json` scripts, and `Makefile` before editing.
3. Declare exactly one route before implementation: `Skill: delivery (quick|standard|complex|review)`, `Skill: debug-extension`, `Skill: language-server-change`, `Skill: release-extension`, or `Skill: none`; explain the choice in one sentence.
4. Read only task-relevant references and skill files.
5. Make the smallest coherent change, test the affected boundary, and report actual results.

## Ownership

| Location | Responsibility |
| --- | --- |
| `client/` | VS Code extension host integration, activation, commands, settings, language client and editor-facing behaviour |
| `server/` | Language-server behaviour, SQL analysis, formatting, rules, diagnostics and fixes |
| `package.json`, `language-configuration.json` | Extension contributions, language metadata, scripts and packaging |
| `.github/` | CI, automation and repository checks |
| `docs/` | Durable architecture, development and testing guidance |

Verify the actual ownership in source before changing behaviour; do not assume an API exists from this map alone.

## Task References

- Extension activation, commands, settings or editor behaviour: `client/AGENTS.md`.
- SQL diagnostics, rules, formatting, parsing or LSP behaviour: `server/AGENTS.md`.
- Client/server contract or lifecycle: `docs/architecture.md`.
- Tests and verification: `docs/testing.md`.
- Local execution or debugging: `docs/local-development.md`.
- Repeatable workflows: the relevant `SKILL.md` under `.agents/skills/`.

## Working Rules

- Source, tests, package scripts and the Makefile are authoritative. Update stale guidance when discovered.
- Keep editor integration in the client and SQL analysis in the server. Avoid duplicate business logic across the boundary.
- Preserve existing VS Code commands, settings, language IDs, contribution points and LSP contracts unless changing them intentionally.
- Treat SQL text as untrusted input. Never execute user queries or transmit SQL to an external service without an explicit, documented feature requirement.
- Preserve existing GoogleSQL/BigQuery behaviour and other supported dialects. Add focused fixtures for syntax variants and edge cases.
- Keep formatting deterministic and ideally idempotent; avoid changing SQL semantics. Ensure fixes and diagnostics refer to valid document ranges.
- Keep editor operations responsive; respect cancellation, document versions and resource disposal where supported by the current architecture.
- Reproduce reported bugs when practical and add the smallest stable regression test.
- Run focused checks before broader suites. Read actual npm scripts; do not invent commands.
- For documentation-only changes, run documentation checks rather than unnecessary extension integration suites.
- Report checks as passed, failed or not run, with reasons. Never imply an unexecuted test passed.
- Avoid unrelated refactors, generated-file churn and permanent review reports.

## Documentation Ownership

- `README.md`: product features, installation and user configuration.
- `AGENTS.md`: agent execution rules and navigation.
- `docs/architecture.md`: stable client/server boundaries and contracts.
- `docs/testing.md`: test strategy and verification matrix.
- `docs/local-development.md`: setup and debugging workflow.
- Keep transient implementation notes in issues and pull requests, not permanent documents.

## Safety and Releases

- Do not publish to the VS Code Marketplace, create releases, push tags or change package versions without explicit approval.
- Do not run destructive Git operations without approval.
- Do not expose credentials, tokens, user SQL or local file contents in logs, test snapshots or committed artifacts.
- Inspect package contents and extension contribution changes before proposing a release.
