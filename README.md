# elliot-stack

[![npm version](https://img.shields.io/npm/v/elliot-stack)](https://www.npmjs.com/package/elliot-stack)
[![license](https://img.shields.io/npm/l/elliot-stack)](LICENSE)

A curated set of Claude Code skills by Elliot Drel. One command installs them all.

## Install

```bash
npx elliot-stack@latest
```

This copies skills to `~/.claude/skills/` and registers a `SessionStart` hook so your skills stay up to date automatically.

## Skills

| Skill | Command | Description |
|-------|---------|-------------|
| **Better Title** | `/estack:better-title` | Renames Claude Code chat sessions with descriptive titles |
| **Chris Voss** | `/estack:chris-voss` | Applies negotiation principles from *Never Split the Difference* |
| **GitHub Issue Tracker** | `/estack:github-issue-tracker` | Tracks and manages GitHub issues across repos |
| **Repo Search** | `/estack:repo-search` | Clones and searches external GitHub repos to answer questions about their code |

## How it works

- Skills install to `~/.claude/skills/estack/`
- A `SessionStart` hook auto-updates skills each time you open Claude Code
- If you've made local edits to a skill, the installer detects the conflict and lets you choose: overwrite, skip, or merge

## Updating

Skills update automatically on session start. To force an update manually:

```bash
npx elliot-stack@latest
```

## Requirements

- [Claude Code](https://claude.ai/code) CLI installed
- Node.js 18+

## License

MIT
