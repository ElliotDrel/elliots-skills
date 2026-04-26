---
name: manage-e-stack
description: "MUST USE for any work on the e-stack repo — adding, editing, or publishing skills. Triggers: 'add a skill to e-stack', 'edit an estack skill', 'publish e-stack', 'release to npm', 'put this in e-stack', 'fix this skill', 'ship it', or any change to files under skills/ or package.json in this repo. Routes to the right step file based on intent."
---

# Working on E-Stack

This skill is the entry point for all e-stack work. Pick the route that matches the user's intent, then follow the matching step file exactly.

## Routes

| Intent | Step file |
|---|---|
| Add a new skill, migrate an existing skill into the repo | `steps/add.md` |
| Edit a skill that already exists in `skills/` (SKILL.md, scripts, references) | `steps/edit.md` |
| Publish to npm — push a release, ship it, verify a publish | `steps/publish.md` |

If the user's intent spans more than one route (e.g. "add a skill and publish"), run them in order: add → edit (if needed) → publish. Each step file has its own approval gates — do not skip them.

## Universal Conventions

These apply to every route. Violating them breaks the install or publish.

- **Skill folders** in `skills/` MUST be prefixed with `estack-` (e.g. `skills/estack-chris-voss/`)
- **`name` field** in frontmatter MUST match the folder name exactly
- **`description` field** MUST start with `(<short-name>)` where short-name is the folder name without the `estack-` prefix — e.g. `(chris-voss) Applies...`
- **NEVER manually bump `package.json` version** — the GitHub Actions workflow does this on every publish
- **`[publish]` in a commit message on `main`** triggers npm publish via CI. Commits without it are safe.
- **Live install location:** `~/.claude/skills/estack-*/` (the installer copies from `skills/` here)
- **Installer:** `node bin/install.cjs` from repo root

## Skill Map

```
SKILL.md              # You are here — router + universal conventions
steps/
  add.md              # New skill / migrate an existing skill into the repo
  edit.md             # Edit an existing skill (uses scripts/preflight.sh)
  publish.md          # Push a release to npm with [publish]
scripts/
  preflight.sh        # Read-only diagnostics — installed vs repo state, frontmatter check
```

Now read the matching step file and follow it.
