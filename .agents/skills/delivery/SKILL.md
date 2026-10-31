---
name: delivery
description: Implement or review a bounded change in the VS Code extension with proportionate verification.
---

# Delivery

Choose `quick` for mechanical changes, `standard` for a bounded feature/fix, `complex` for multi-boundary work, or `review` for assessment without implementation.

1. State goal, affected ownership, compatibility surfaces and selected mode.
2. Inspect closest `AGENTS.md`, actual code and scripts; read only relevant references.
3. For behaviour changes, identify a failing test or minimal reproduction where practical.
4. Implement the smallest coherent change; avoid speculative refactors.
5. Verify focused behaviour and impacted client/server integration proportionately.
6. Summarise files changed, tests run, remaining risks and unverified checks.
