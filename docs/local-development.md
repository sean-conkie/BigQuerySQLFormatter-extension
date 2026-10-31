# Local Development

1. Read the root `README.md`, root `Makefile`, and package scripts at root and in the owning module.
2. Install dependencies using the repository-supported lockfile workflow; do not assume a single root install covers both modules.
3. Identify the current build/watch commands and VS Code launch configuration or test harness.
4. For client changes, launch an Extension Development Host and verify activation and disposal.
5. For server changes, run focused SQL fixtures and verify diagnostic/formatting behaviour through the language client when relevant.
6. For integration failures, inspect client/server startup and protocol errors without logging sensitive SQL content.

Do not invent `npm` commands or launch configurations. If a documented command is stale, fix the documentation alongside the change.
