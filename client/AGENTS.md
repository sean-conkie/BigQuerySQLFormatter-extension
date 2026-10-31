# VS Code Client

Follow the root `AGENTS.md` first.

## Scope

Own extension activation/deactivation, editor integration, command and configuration wiring, language-client lifecycle, and user-facing VS Code behaviour. Inspect the current source and contribution manifest before choosing implementation files.

## Rules

- Use VS Code APIs in the extension host, not in SQL analysis code.
- Keep registration and disposal of commands, subscriptions, listeners and language clients paired; avoid duplicate registrations on restart.
- Preserve existing command IDs, configuration keys, language selectors and activation behaviour unless intentionally migrating them.
- Handle unavailable server, failed startup, workspace changes and shutdown without leaving stale UI state.
- Avoid blocking extension activation or editor interactions with unnecessary synchronous work.
- Validate configuration and avoid leaking document text, workspace paths or credentials in output channels.
- For user-visible changes, verify command availability, settings defaults, language activation and failure messaging in an Extension Development Host where feasible.

## Verification

Run relevant client scripts discovered from `client/package.json`, plus root checks when affected. For integration behaviour, use the repository's existing VS Code test harness if present. Record manual Extension Development Host checks separately from automated tests.
