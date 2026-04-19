---
name: add-skill-to-e-stack
description: "MUST USE whenever adding, creating, migrating, importing, or publishing a skill to the e-stack repo. Triggers: adding a skill to e-stack, creating a new estack skill, moving a skill into e-stack, publishing a skill to npm via e-stack, migrating a local skill to e-stack, 'let's add this to e-stack', 'put this in e-stack', 'make this an estack skill'. If the task involves putting a skill into the skills/ directory of this repo, USE THIS SKILL — no exceptions."
---

# Adding a Skill to E-Stack

Follow these steps exactly. Do not manually bump `package.json` version.

## 1. Create the skill folder

```
skills/estack-<skill-name>/SKILL.md
```

The folder MUST be prefixed with `estack-`. The `SKILL.md` needs frontmatter with the name ALSO prefixed with `estack-`:

```markdown
---
name: estack-<skill-name>
description: (<skill-name>) <one-line description — this shows up in the skill list>
---
```

Both the folder and the `name` field use the `estack-` prefix. This ensures the skill is namespaced correctly when installed to `~/.claude/skills/`.

Add any supporting files (references, steps, etc.) in subfolders as needed.

## 2. Show the diff (if migrating from an existing skill)

If the skill already exists somewhere (e.g. `~/.claude/skills/`), diff it:

```bash
diff -ru ~/.claude/skills/<skill-name> skills/estack-<skill-name>
```

Show the output and ask for confirmation before proceeding.

## 3. Delete the old copy (if migrating)

```bash
rm -rf ~/.claude/skills/<old-skill-name>
```

## 4. Run the installer

```bash
node bin/install.cjs
```

This copies all skills from `skills/` to `~/.claude/skills/`. Confirm the new skill appears in the output.

## 5. Confirm with the user before committing

NEVER commit or push without explicit confirmation from the user. Before touching git:

1. Show the user a summary of all files that will be committed
2. Show the proposed commit message
3. Remind them that `[publish]` in the message triggers an npm publish
4. Ask for explicit confirmation (e.g. "Ready to commit and push?")
5. Only proceed after the user says yes

```bash
git add skills/estack-<skill-name>/
git commit -m "add <skill-name> skill [publish]"
git push
```

Do NOT manually bump `package.json` version — the GitHub Actions workflow handles it automatically.

## Quick reference

| What | Where |
|------|-------|
| Skills source | `skills/estack-*/` |
| Installer | `bin/install.cjs` |
| Live location | `~/.claude/skills/estack-*/` |
| Publish trigger | `[publish]` in commit message on `main` |
| Version bumps | Automatic via CI |
