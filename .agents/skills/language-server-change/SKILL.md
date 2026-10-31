---
name: language-server-change
description: Modify SQL rules, diagnostics, formatting, fixes or language-server contracts safely.
---

# Language Server Change

1. Identify the current server entrypoint, rule/parser implementation and test fixture conventions.
2. Record expected SQL behaviour and compatibility constraints, including dialect and suppression handling.
3. Add focused valid, invalid and edge-case fixtures; reproduce failures where possible.
4. Implement the smallest server-side change; change the client only for a genuine contract or UX need.
5. Check diagnostic ranges, malformed SQL, fix overlap, formatting idempotence and semantic preservation as applicable.
6. Run affected server tests and client/server integration checks for protocol changes; report results.
