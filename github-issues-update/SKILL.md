---
name: github-issues-update
description: >
  GitHub issue tracker management. Run with no args for daily check-in (checks all
  active issues for updates, finds duplicates, identifies next steps). Run with `--save`
  to add issues from the current conversation to the tracker.
argument-hint: "[--save]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
  - AskUserQuestion
  - Agent
---

<objective>
Route to the correct workflow based on arguments and context. Two modes:
- **Check-in** (default): Check tracked issues for updates, discover duplicates, plan actions.
- **Save**: Add issues from the current conversation to the tracker.

This skill uses a Node script (`bin/tracker-tools.cjs`) as its data service layer.
All parsing, report compilation, tracker updates, and validation are handled by the script.
The agent orchestrates and calls the script — it does NOT parse or compile manually.
</objective>

<execution_context>
The skill directory containing workflows, references, and scripts is located at the same
path as this file. Resolve the skill directory path from this file's location FIRST.

**Script:** `bin/tracker-tools.cjs` — MUST be invoked via:
```bash
node "$SKILL_DIR/bin/tracker-tools.cjs" <command> [options]
```

**Workflows:**
- `setup.md` — First-time tracker creation (only if tracker file missing)
- `workflows/check-issues.md` — Main check-in workflow
- `workflows/save-issues.md` — Save issues from conversation to tracker

**References (agent reads these, NOT the script):**
- `references/tracker-schema.md` — Tracker file format and field definitions
- `references/gh-cli-patterns.md` — gh CLI command templates for ALL API calls
- `tracker-template.md` — Blank tracker template for new setup
</execution_context>

<process>

<step name="resolve_paths" priority="first">

1. Determine `$SKILL_DIR` from this file's location.
2. Verify the script exists:
   ```bash
   test -f "$SKILL_DIR/bin/tracker-tools.cjs" && echo "OK" || echo "MISSING"
   ```
   If MISSING, error: "tracker-tools.cjs not found at $SKILL_DIR/bin/. Skill may be corrupted."
3. Set `$TRACKER_PATH` to `$HOME/OneDrive/Documents/github-tracker.md`.

</step>

<step name="route">

Parse `$ARGUMENTS` for the mode:
- If arguments contain `--save` → **Save mode**
- Otherwise → **Check-in mode** (default)

### Save mode

1. Run: `node "$SKILL_DIR/bin/tracker-tools.cjs" parse-tracker "$TRACKER_PATH"`
2. If `exists` is false, tell the user to run `/github-issues-update` first, then **STOP**.
3. Read `workflows/save-issues.md` and `references/tracker-schema.md` from `$SKILL_DIR`.
4. Execute the save workflow, passing the parsed tracker JSON, `$SKILL_DIR`, and `$TRACKER_PATH`.

### Check-in mode

1. Run: `node "$SKILL_DIR/bin/tracker-tools.cjs" parse-tracker "$TRACKER_PATH"`
2. **If `exists` is false or `empty` is true:**
   - Tell the user: "No tracker file found. Let's set one up."
   - Read `setup.md` from `$SKILL_DIR`.
   - Follow setup instructions end-to-end to create the tracker.
   - After setup completes, proceed to step 3 to run the first check-in automatically.
3. **If the tracker exists and has content:**
   - Store the parsed JSON as `$TRACKER_DATA`.
   - Read `workflows/check-issues.md` from `$SKILL_DIR`.
   - Read `references/gh-cli-patterns.md` and `references/tracker-schema.md` from `$SKILL_DIR`.
   - Execute the check-in workflow, passing `$TRACKER_DATA`, `$SKILL_DIR`, and `$TRACKER_PATH`.

</step>

</process>

<context>
$ARGUMENTS
</context>
