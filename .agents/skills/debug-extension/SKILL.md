---
name: debug-extension
description: Diagnose extension activation, editor integration, language-client startup or server communication failures.
---

# Debug Extension

1. Reproduce in the existing extension test harness or Extension Development Host.
2. Classify the failure: activation, contribution/selector, command, configuration, client startup, transport, server startup or response.
3. Inspect existing logs and error paths; redact SQL, paths, tokens and credentials.
4. Isolate the failing boundary before changing code.
5. Add a regression test when stable and practical; check restart, disposal and recovery.
6. Report the root cause, actual evidence and verification performed.
