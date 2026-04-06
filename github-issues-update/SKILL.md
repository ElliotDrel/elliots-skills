---
name: github-issues-update
description: >
  GitHub issue tracker management. Checks all open issues the user is involved in,
  finds related/duplicate issues, reports what changed, and recommends next steps.
  Run anytime for a check-in — works the same whether it's the first run or a daily habit.
  The tracker file acts as a cache to make repeat runs faster.
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
Give the user a complete, actionable update on every GitHub issue they're involved in.
One flow, every time — no modes, no flags. The only thing that changes between runs is
depth: more work when the tracker is empty or stale, less when it was just checked yesterday.
</objective>

<execution_context>
Resolve `$SKILL_DIR` from this file's location FIRST.

**Script:** `bin/tracker-tools.cjs` — handles all GitHub API calls, tracker parsing,
report compilation, and tracker updates. Invoke via:

```bash
node "$SKILL_DIR/bin/tracker-tools.cjs" <command> [options]
```

Every script command returns a `today` field like `today's date is **2026-04-05**, ignore earlier dates`.
Extract the date from this string. If you see multiple `today` values in your context
(from earlier commands), always use the most recent one.

**Tracker file:** `$HOME/OneDrive/Documents/github-tracker.md`
This is a cache + context store. It makes the agent's job faster by preserving:

- Which issues are being tracked and their last-known state
- What to watch for on each issue (user's intent/goals)
- History of actions taken and events observed
- Known duplicates and related issues (so we don't re-search)

**References:**

- `references/tracker-schema.md` — tracker file format
- `references/result-file-schema.md` — per-issue analysis format (agents write these)
- `references/gh-cli-patterns.md` — gh CLI command templates
- `tracker-template.md` — blank tracker for first run
</execution_context>

<flow>

The skill runs the same four steps every time. The tracker determines depth — an empty
tracker means everything is new and needs deep analysis. A fresh tracker means most
issues just need a quick diff check.

## Step 0: Startup

1. Set `$TRACKER_PATH` to `$HOME/OneDrive/Documents/github-tracker.md`.
2. Run startup:
   ```bash
   node "$SKILL_DIR/bin/tracker-tools.cjs" startup --tracker "$TRACKER_PATH"
   ```
3. Store the full response as `$STARTUP`. The script handles auth checking and temp dir
   creation. If `auth` is false, show the user the `error` message from the output and STOP.
4. Extract `$TODAY` (the YYYY-MM-DD date) from the `$STARTUP.today` string — use this as today's date for everything.
5. Extract `$TEMP_DIR` from `$STARTUP.temp_dir`.

---

## Step 1: Discover

**Goal:** Build the complete list of issues to analyze this run.

Sources (all from `$STARTUP`):

- `tracker_data.active_issues` — issues already tracked
- `new_issues` — open issues involving the user that aren't in the tracker yet
- `reopened_issues` — issues previously closed that are now open again
- `recently_closed` — issues closed since last check

**If tracker doesn't exist or has no issues** (first run):

- Present `new_issues` grouped by repo. Ask user which to track (all, pick specific, none).

**If tracker exists with issues:**

- Active issues are automatically included.
- If `new_issues` is non-empty, tell the user what was found and add them to the
  analysis list. These are issues the user is involved in but wasn't tracking yet.
- If `reopened_issues` is non-empty, add them back to the active analysis list and
  note in your report that they were reopened (state changed from closed to open).

Write the final issue list to `$TEMP_DIR/issues-to-fetch.json` for the fetch command.
Each entry needs: `owner`, `repo`, `number`, `title`, `role`, `last_check_date`
(null for new issues), `known_dupes` (from tracker or empty), `upstream` (from tracker or null).

---

## Step 2: Connect

**Goal:** Fetch current data for every issue and find related/duplicate issues.

### 2a: Fetch all issue data

```bash
node "$SKILL_DIR/bin/tracker-tools.cjs" fetch-issues --temp-dir "$TEMP_DIR" --issues "$TEMP_DIR/issues-to-fetch.json"
```

This fetches metadata, body, comments, dupe states, upstream state, cross-references,
and URLs for every issue in parallel. One `raw-OWNER-REPO-NUMBER.json` per issue.

### 2b: Analyze issues in batches

Read `references/result-file-schema.md` and `references/gh-cli-patterns.md` from `$SKILL_DIR`.

Group issues into batches of ~5. Spawn **one Agent per batch**. Each agent:

1. Reads the raw JSON files for its batch issues.
2. Searches for duplicates/related issues using `gh api` search queries.
3. Writes one result file per issue to `$TEMP_DIR/issue-OWNER-REPO-NUMBER.md` following
   the format in `references/result-file-schema.md`.

**Depth control based on `last_check_date`:**

The duplicate/related search always runs, but the scope changes:

- **`null` (new issue):** Deep analysis. Read full comment history. Search broadly for
  duplicates by symptoms, error messages, and keywords.
- **Checked within the last 7 days:** Shallow pass. Only read new comments since last check.
  Only check the state of already-known duplicates/related issues. Only search for new
  duplicates among issues created since the last check date.
- **Checked more than 7 days ago:** Medium depth. Read comments since last check. Re-scan
  for new duplicates across a wider window. Check state of known duplicates.

Each agent prompt must include:

- Raw data file paths for its batch
- `owner`, `repo`, `number`, `title`, `role`, `last_check_date`, `username`
- `cross_references` and `urls` from raw JSON
- All tracked issue numbers (to filter dupe search results)
- `$TODAY` as today's date (for history entries)
- Instruction to read `$SKILL_DIR/references/result-file-schema.md` for format and quality guidance

After all agents finish, verify file count:

```bash
ls "$TEMP_DIR"/issue-*.md 2>/dev/null | wc -l
```

---

## Step 3: Advise

**Goal:** Identify concrete next steps for each issue before presenting the report.

Read through all result files in `$TEMP_DIR/issue-*.md`. For each issue, determine:

- What action would move this issue toward resolution (accepted or denied)?
- Are there related issues where commenting with a link to the user's issue would help?
- Are there duplicates the user should reference or link to?
- Is there a PR fixing the issue that needs testing or review?

Collect all next steps. These get included in the report output.

---

## Step 4: Report and Act

**Goal:** Show the user what's going on and help them take action.

### 4a: Compile and present report

```bash
node "$SKILL_DIR/bin/tracker-tools.cjs" compile-report --temp-dir "$TEMP_DIR" --date "$TODAY"
```

The script reads all result files and outputs the report to stdout (also saves to
`$TEMP_DIR/_compiled-report.md`).

After running compile-report:

- If there are `new_issues` or `reopened_issues` from startup, append them to the report.
- Append the next steps identified in Step 3 as a clear action list per issue.
- **Show the FULL report to the user as text in your response.** The user cannot see
  bash output — you MUST copy the report into your message. Do not summarize or truncate.

### 4b: Act on next steps

After showing the report, present the actionable items:

- If there are comments to post, issues to link, or other actions: ask the user
  "Want me to act on these next steps?" and list what you'd do.
- If the user approves, execute the actions (post comments via `gh issue comment`, etc.)
  and record them in the result files as history entries.
- If no actions needed, just say so.

### 4c: Update tracker

Ask: "Want me to update the tracker with today's findings?"

If yes and this is the first run (no tracker existed), use build-tracker:

```bash
node "$SKILL_DIR/bin/tracker-tools.cjs" build-tracker --temp-dir "$TEMP_DIR" --template "$SKILL_DIR/tracker-template.md" --username "$USERNAME" --tracker "$TRACKER_PATH"
```

If yes and the tracker already exists, use update-tracker:

```bash
node "$SKILL_DIR/bin/tracker-tools.cjs" update-tracker --tracker "$TRACKER_PATH" --temp-dir "$TEMP_DIR" --date "$TODAY"
```

Report what changed.

### 4d: Cleanup

```bash
rm -rf "$TEMP_DIR"
```

</flow>

<context>
$ARGUMENTS
</context>
