## Skill Authoring

### Auto-run commands

Use `` ```! `` (triple backtick + `!`) code blocks in SKILL.md to run shell commands automatically when the skill is loaded. The output is presented to the model before it processes the rest of the skill.

Use this for setup tasks, environment checks, or gathering context that the skill needs upfront.

**Examples:**
- `skills/estack-repo-search/SKILL.md` — clones and indexes a repo on load
- `.claude/skills/publish-e-stack/SKILL.md` — runs pre-flight diagnostics on load
