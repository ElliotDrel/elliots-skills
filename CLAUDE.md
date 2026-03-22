## Repo layout

This repo contains Claude Code skills. Each skill is a subfolder with a `SKILL.md` and optional supporting files.

The live install location is `~/.claude/skills/`. This repo is the source of truth — after making changes here, skills must be synced to the live location.

## After making changes

Follow this process for each skill you changed:

1. **Show the diff** between the repo version and the live version:
   ```bash
   diff -ru ~/.claude/skills/<skill-name> <skill-name>
   ```
   Show the output to the user so they can see exactly what will change.

2. **Ask for confirmation** using `AskUserQuestion` before syncing. List which skill(s) will be overwritten.

3. **Run the sync** only after the user confirms:
   ```bash
   bash sync.sh <skill-name>
   ```

## Adding a new skill

When creating a new skill in this repo:

1. Create the skill folder with a `SKILL.md` (e.g. `my-skill/SKILL.md`)
2. Add the skill name to the `REGISTERED_SKILLS` array in `sync.sh`
3. Run `bash sync.sh my-skill` to copy it to the live location

**Both steps 1 and 2 are required.** The sync script will refuse to sync any skill that isn't registered.
