# elliot-stack

Skills for Claude Code by Elliot Drel.

## Install

```bash
npx elliot-stack@latest
```

This copies skills to `~/.claude/skills/` and sets up auto-updates so you always have the latest version.

## Skills

| Skill | Command | Description |
|-------|---------|-------------|
| **Better Title** | `/estack:better-title` | Renames Claude Code chat sessions with descriptive titles |
| **Chris Voss** | `/estack:chris-voss` | Applies negotiation principles from *Never Split the Difference* |
| **GitHub Issue Tracker** | `/estack:github-issue-tracker` | Tracks and manages GitHub issues across repos |

## How it works

- On first run, skills are installed to `~/.claude/skills/`
- A `SessionStart` hook is added so skills auto-update when you start Claude Code
- If you've made local changes to a skill, the installer detects them and gives you the choice to overwrite, skip, or merge

## Updating

Skills update automatically on session start. To manually update:

```bash
npx elliot-stack@latest
```
