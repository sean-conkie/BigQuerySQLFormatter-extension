---
name: release-extension
description: Prepare and verify a VS Code extension release without publishing or tagging automatically.
---

# Release Extension

1. Inspect the root and module package versions, manifests, changelog/release conventions and CI workflows.
2. Review command IDs, settings, activation events, language contributions and extension compatibility.
3. Run relevant lint, build, test and packaging checks using verified repository commands.
4. Inspect the package file list for required runtime assets, unwanted files and secrets.
5. Produce a concise release readiness summary with blockers and verification results.
6. Obtain explicit approval before version changes, tags, GitHub releases or marketplace publication.
