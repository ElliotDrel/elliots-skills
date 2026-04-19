## Publishing to npm

Including `[publish]` in a commit message on `main` triggers a GitHub Actions workflow that auto-bumps the patch version and publishes to npm via OIDC. Regular commits without `[publish]` are safe to push — no publish happens. Do NOT manually bump `package.json` version; the workflow handles it.

`docs/publishing.md` contains auth setup details, OIDC configuration, and YAML gotchas from initial setup. Read it if you need to debug a failed publish or modify the workflow.

## Repo layout

This repo contains Claude Code skills distributed as **e-stack**. Each skill is a subfolder inside `skills/`, with a `SKILL.md` and optional supporting files.

**Distribution:** `npx elliot-stack@latest` → copies skills to `~/.claude/skills/`

Skills live under `skills/<skill-name>/` in this repo (e.g. `skills/better-title/`, `skills/chris-voss/`).

## After making changes

Follow this process for each skill you changed:

1. **Show the diff** between the repo version and the live version:
   ```bash
   diff -ru ~/.claude/skills/<skill-name> skills/<skill-name>
   ```
   Show the output to the user so they can see exactly what will change.

2. **Ask for confirmation** using `AskUserQuestion` before syncing. List which skill(s) will be overwritten.

3. **Run the installer** only after the user confirms:
   ```bash
   node bin/install.cjs
   ```

**Do NOT manually bump `package.json` version** — the publish workflow handles this automatically on push to main.

## Adding a new skill

When creating a new skill in this repo:

1. Create the skill folder with a `SKILL.md` (e.g. `skills/my-skill/SKILL.md`)
2. Run `node bin/install.cjs` to copy it to the live location
3. Commit and push to `main` when ready — npm publish happens automatically

## Skill auto-run commands

Use ` ```! ` (triple backtick + `!`) code blocks in SKILL.md to run shell commands automatically when the skill is loaded. The output is presented to the model before it processes the rest of the skill. Use this for setup tasks, environment checks, or gathering context that the skill needs upfront. See `skills/estack-repo-search/SKILL.md` and `.claude/skills/publish-e-stack/SKILL.md` for examples.
