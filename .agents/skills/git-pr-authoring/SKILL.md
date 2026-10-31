---
name: git-pr-authoring
description: >-
  Draft, create or update a GitHub pull request from the final diff and current
  verification evidence: title, body, linked issues and labels. Drafts only
  unless the user explicitly asks to create or update the PR.
---

# Git PR authoring

Start with `Skill: git-pr-authoring - <draft|create|update>: <brief reason>.`

## Workflow

1. Inspect the branch, the final diff against its base, and verification
   evidence from **the current revision**. Never infer that checks passed from
   older runs. There's no PR template in this repository.
2. **Title:** `<scope>: <short imperative description>`, matching recent merged
   PRs (for example `rules: add ST03 unused CTE diagnostics`). Common scopes:
   `rules`, `parser`, `completions`, `settings`, `client`, `ci`, `docs`,
   `packaging`, `dependencies`.
3. **Body:**
   - `## Summary`: observable changes, then `Closes #N` only if the PR fully
     completes that issue's acceptance criteria. Use `Part of #N` for partial
     work; `Closes` on a partial PR closes the issue too early.
   - `## Validation`: exact commands with passed, failed or not run, and why.
   - `## Risks / follow-ups`: real residual risks or `None.`
   - For stacked PRs, add a `## Stack` section listing the layers.
   - Don't add untouched checklists or boilerplate. Leave the Read the Docs
     preview block that the bot appends.
4. **Labels.** Release notes are generated from PR labels
   (`.github/release.yaml`), so choose them carefully:

   | Label | Release-notes section | Use for |
   | --- | --- | --- |
   | `breaking change` | Breaking changes | Removed or changed settings, rule codes, defaults users rely on |
   | `rule` | New and changed rules | New or changed lint rules |
   | `feature` | Exciting new features | Other user-visible features |
   | `bug` | Bug fixes | Fixes |
   | `dependencies` | Dependencies | Dependency updates |
   | `documentation`, `chore`, `refactor`, `test`, `security` | Other changes | Everything else |
   | `ignore for release notes` | Excluded | Changes users never see |

   - There's no `enhancement` label and there are no area labels (`client`,
     `server`); don't invent them. `priority: P0`-`P3` labels are for issues.
   - Verify labels exist before applying them
     (`GH_PAGER=cat gh label list --limit 100 --json name`). If lookup fails,
     omit them and report it.
5. Draft only unless the user explicitly asks to create or update. Don't push
   branches, change reviewers, merge or edit unrelated PR metadata without
   permission.
6. **Create:** write the body to a temporary file, then from the repository root
   run `gh pr create --title <title> --body-file <file> --label <name>...`. If
   a PR already exists for the branch, report its URL and ask before updating
   it.
7. **Update:** identify the PR from the user or the current branch
   (`GH_PAGER=cat gh pr view --json number,url,title,body,labels`). Ask if
   it's ambiguous. Use `gh pr edit <number> --body-file <file>` and
   `--add-label`; keep existing labels unless asked to remove them.
8. If `gh` isn't installed or authenticated, stop at a draft and say so.
9. Report the PR URL, the labels applied, and any checks or label operations
   that failed or were skipped.

## Quality and safety

- Keep the body reviewer-focused and proportional to the diff.
- Never put secrets, tokens, real project IDs, account details, user SQL or
  sensitive logs in a PR.
- Always set `GH_PAGER=cat` for `gh pr list` and `gh pr view`, and never pass a
  local filesystem path to `gh -R`.
