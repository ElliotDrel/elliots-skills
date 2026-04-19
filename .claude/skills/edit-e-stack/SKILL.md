---
name: edit-e-stack
description: >
  Use when making any changes to e-stack skills — editing SKILL.md files, updating
  supporting files, fixing frontmatter, or modifying scripts in the skills/ directory.
  Triggers: editing a skill, changing skill descriptions, updating skill content,
  fixing skill bugs, modifying e-stack repo files. Ensures proper diff review,
  validation, and install sequencing.
---

# Editing E-Stack Skills

Follow each phase in order. Do not skip phases.

## Phase 1: Pre-flight Diagnostics

Run automatically when the skill loads. Shows installed vs repo state, diffs, and frontmatter validation.

```!
bash "${CLAUDE_SKILL_DIR}/scripts/preflight.sh"
```

Present the diagnostics to the user. If there are frontmatter issues, fix them before continuing.

## Phase 2: Make Changes

Edit the skill files in `skills/estack-*/` as needed. Key rules:

- **Skill folders** must be prefixed with `estack-`
- **`name` field** in frontmatter must match the folder name (e.g. `estack-chris-voss`)
- **`description` field** must start with `(<skill-name-without-estack-prefix>)` — e.g. `(chris-voss) Applies...`
- **Do NOT manually bump `package.json` version**

## Phase 3: Review — APPROVAL GATE

After all edits are complete, show the user what will change:

1. Run the diff for each changed skill:
   ```bash
   diff -ru ~/.claude/skills/<name> skills/<name>
   ```
2. Re-run preflight to verify frontmatter is valid:
   ```bash
   bash "${CLAUDE_SKILL_DIR}/scripts/preflight.sh"
   ```
3. Ask: **"Ready to run the installer? This will overwrite your local skills in ~/.claude/skills/."**

Only after they confirm, run:
```bash
node bin/install.cjs
```

Then re-run preflight to verify everything installed correctly. If anything fails, stop and fix.

## Phase 4: Route to Publish

After successful install, ask: **"Want to publish to npm? I'll invoke /publish-e-stack."**

If they confirm, invoke the `publish-e-stack` skill.
