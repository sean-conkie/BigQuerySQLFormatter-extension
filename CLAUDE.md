# Claude Code guidance

@AGENTS.md

When working in `client/` or `server/`, also follow that module's `AGENTS.md`;
the `CLAUDE.md` files there import it. Skills are in `.agents/skills/`, exposed
to Claude Code through the `.claude/skills` symlink.
On Windows, enable Git symlinks (`core.symlinks`) when cloning, or the
symlink is checked out as a plain file and Claude Code won't find the skills.
