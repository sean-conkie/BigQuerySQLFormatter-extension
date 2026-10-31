# Architecture and Boundaries

The repository contains a VS Code extension client (`client/`) and language server (`server/`), with extension metadata and packaging configuration at the root.

## Responsibility Split

- **Client:** VS Code APIs, lifecycle, command/configuration integration and language-client transport.
- **Server:** SQL analysis, linting, formatting, diagnostics and fixes, exposed through the existing language-server integration.
- **Root:** extension manifest, language configuration, CI and packaging.

## Change Impact

A new setting or command may require both manifest and client updates. A new diagnostic or formatting capability typically starts in the server, with client changes only when the existing protocol cannot express it. Protocol changes require coordinated verification on both sides.

## Source-of-Truth Checks

Before implementation, locate actual entrypoints, server launch mechanism, protocol registrations, configuration flow, test fixtures and packaging entrypoints. This document intentionally does not assert unverified filenames or runtime internals.
