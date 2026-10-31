---
name: release-extension
description: >-
  Prepare and verify a release: milestone and CI readiness, changelog,
  version bump and release checklist. Never publishes, tags or bumps versions
  without explicit approval.
---

# Release extension

Creating a GitHub release **publishes to the Marketplace**: `publish.yml` runs
on the `released` event and passes the tag to `vsce publish`. Every step that
changes versions, pushes, tags or creates a release needs explicit approval.

## Readiness

1. The milestone's issues are closed and their acceptance criteria are met.
   Spot-check risky behaviour on a fresh `npm run compile`.
2. CI on `main` is green: unit tests and all six end-to-end jobs (Linux, macOS,
   Windows × VS Code 1.91.0 and stable). A single macOS end-to-end failure that
   passes on re-run is a flake, not a regression; record it.
3. Locally:

   ```sh
   npm ci && npm run lint && npm run coverage
   npx --no-install vsce package --no-yarn --out extension.vsix && npm run package:check
   ```

   Inspect the packaged file list, then delete the VSIX.

## Changelog

1. Rename `## Unreleased` to `## x.y.z - YYYY-MM-DD`, using the planned release
   date. Use the sections "Notable changes" (behaviour changes users will
   notice, with how to opt out), "Added" and "Fixed". Write for users, not
   implementers, and check option names and defaults against `package.json`.

## Version and release (approval required)

1. `make version x.y.z`: needs a clean working tree; bumps the root, client and
   server versions and commits `Version x.y.z`.
2. Push, then create the GitHub release with tag `x.y.z`. Don't use a `v`
   prefix: the tag must equal the `package.json` version, and earlier
   duplicate `v` tags produced wrong auto-generated release notes. Check the
   notes compare against the previous release's tag.
3. After publishing, close the milestone and move any leftovers.

## Report

Summarise the blockers, the checks run with their results, and the approvals
still needed.
