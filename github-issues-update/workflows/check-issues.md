# Check-In Workflow

Main workflow for `/github-issues-update`. Executed when tracker file exists.

**Prerequisites loaded by router:** `$TRACKER_DATA` (parsed JSON from `parse-tracker`),
`$SKILL_DIR` (skill directory path), `$TRACKER_PATH` (tracker file path).

Read `references/gh-cli-patterns.md` and `references/tracker-schema.md` before starting.

Uses one subagent per tracked issue for thorough, parallel reviews. Results are written
to a temp directory on disk — NOT held in context memory.

---

<step name="init_temp" priority="first">

## Step 1: Initialize Temp Directory

Create the temp directory for subagent results:

```bash
TEMP_DIR=$(node "$SKILL_DIR/bin/tracker-tools.cjs" init-temp)
echo "Temp dir: $TEMP_DIR"
```

Store `$TEMP_DIR` for all subsequent steps.

Extract from `$TRACKER_DATA`:
- `username` — GitHub username
- `active_issues` — array of active issue objects
- `closed_issues` — array of closed issue objects
- `all_tracked_numbers` — list of all tracked issue keys (owner/repo#N)
- `oldest_check_date` — earliest "Status as of" date across all issues

**acceptance_criteria:** `$TEMP_DIR` exists and is writable. `$TRACKER_DATA` has `username` and at least one issue.

</step>

<step name="spawn_agents">

## Step 2: Gather Data (Subagents)

### 2a. One subagent per active issue

**Spawn one Agent per active issue**, all in parallel. Each agent performs a thorough
review of a single issue AND writes its result to a file in `$TEMP_DIR`.

**CRITICAL:** Each agent's prompt MUST include the instruction to write results to a
specific file path. The agent MUST write the file — this is not optional.

For each active issue in `$TRACKER_DATA.active_issues`, include in the agent prompt:
OWNER, REPO, NUMBER, TITLE, ROLE, LAST_CHECK_DATE, USERNAME, known duplicate/related
issue numbers, and upstream issue (if any).

Agent prompt template:

> You are doing a thorough review of GitHub issue OWNER/REPO#NUMBER ("TITLE").
> The user's role is ROLE. Last checked: LAST_CHECK_DATE. GitHub username: USERNAME.
>
> **Step 1 — Fetch data (run all in parallel):**
>
> 1. Current metadata:
>    `gh api repos/OWNER/REPO/issues/NUMBER --jq '{state: .state, labels: [.labels[].name], comments: .comments, updated: .updated_at, created: .created_at}'`
>
> 2. Comments since last check (FULL — do not truncate):
>    `gh api repos/OWNER/REPO/issues/NUMBER/comments --jq '[.[] | select(.created_at > "LAST_CHECK_DATE")] | .[] | {author: .user.login, date: (.created_at | split("T")[0]), body: .body}'`
>    If no new comments, also fetch last 2 for context:
>    `gh api repos/OWNER/REPO/issues/NUMBER/comments --jq '.[-2:] | .[] | {author: .user.login, date: (.created_at | split("T")[0]), body: .body}'`
>
> 3. Issue body (FULL — do not truncate):
>    `gh api repos/OWNER/REPO/issues/NUMBER --jq '{title: .title, body: .body, author: .user.login}'`
>
> 4. **Known duplicates/related** (if any — these are the issue numbers: KNOWN_DUPES):
>    For each, fetch state and last 2 comments:
>    `gh api repos/DUPE_OWNER/DUPE_REPO/issues/DUPE_NUMBER --jq '{state: .state, updated: .updated_at}'`
>    `gh api repos/DUPE_OWNER/DUPE_REPO/issues/DUPE_NUMBER/comments --jq '.[-2:] | .[] | {author: .user.login, date: (.created_at | split("T")[0]), body: .body[0:1500]}'`
>
> 5. **Upstream issue** (if any — UPSTREAM_OWNER/UPSTREAM_REPO#UPSTREAM_NUMBER):
>    `gh api repos/UPSTREAM_OWNER/UPSTREAM_REPO/issues/UPSTREAM_NUMBER --jq '{state: .state, labels: [.labels[].name], updated: .updated_at}'`
>    `gh api repos/UPSTREAM_OWNER/UPSTREAM_REPO/issues/UPSTREAM_NUMBER/comments --jq '.[-2:] | .[] | {author: .user.login, date: (.created_at | split("T")[0]), body: .body[0:1500]}'`
>
> 6. **Search for NEW duplicates/related:**
>    Run 2-3 keyword searches based on the issue title and topic:
>    `gh api "search/issues?q=repo:OWNER/REPO+is:open+created:>LAST_CHECK_DATE+KEYWORD1+KEYWORD2&per_page=10" --jq '.items[] | "#\(.number) — \(.title) [\(.created_at | split("T")[0])] @\(.user.login)"'`
>    Use different keyword variations to catch different phrasings.
>    Exclude these already-known issue numbers: [list of all tracked + known dupe numbers].
>
> **Step 2 — Analyze:**
>
> IMPORTANT — Extract specifics, don't paraphrase. Pull exact technical data from the
> body and comments: error codes, memory addresses, stack traces, test counts, file
> counts, competing approaches/PRs, version numbers, config values, semantic details
> (e.g., what a PR changes and why it supersedes another). Quote or reproduce concrete
> data — don't write "3 crash instances documented" when you can list the actual
> addresses/sizes. Don't write "supersedes #X" without capturing WHY.
>
> Compare fetched data against the last check date (LAST_CHECK_DATE):
> - New comments since last check? Report who said what WITH specifics.
> - Label changes? State changes (open → closed or vice versa)?
> - Any comments from repo maintainers or Anthropic employees? (Highest priority signals.)
> - Any new activity on known duplicates/related?
> - Any new duplicate/related issues found?
> - Upstream status changes?
>
> **Step 3 — MANDATORY: Write result file to disk.**
>
> You MUST write your analysis to this exact file path:
> `TEMP_DIR/issue-OWNER-REPO-NUMBER.md`
>
> Use this exact format:
>
> ```markdown
> ---
> type: issue
> owner: OWNER
> repo: REPO
> number: NUMBER
> title: "TITLE"
> state: open_or_closed
> state_changed: true_or_false
> labels: label1, label2
> has_activity: true_or_false
> role: ROLE
> last_check_date: LAST_CHECK_DATE
> last_commenter: "@username"
> last_comment_date: YYYY-MM-DD
> comment_count: N
> ---
>
> ## Activity
> - @username (YYYY-MM-DD): What they said WITH specifics.
> [Or: "No new activity since LAST_CHECK_DATE."]
>
> ## Duplicates & Related
> ### Known — updates
> [Activity on known dupes, or "No changes."]
>
> ### New finds
> [New dupes found, or "None found."]
>
> ## Upstream
> [Upstream status, or "N/A"]
>
> ## Next Steps
> - [ ] Action description (target: owner/repo#NUMBER)
> [Or: "None — no action needed."]
>
> ## Watch For
> - Signal to watch for
>
> ## Tracker Updates
> status_summary: Open/Closed. Labels: ... . Summary. N comments total.
> what_to_check: Updated signal to watch for.
> [Optional: new_duplicate: #NUMBER — @author, "Title" (date). Why related.]
> ```
>
> **DO NOT skip writing the file. This is the primary output of your work.**
> After writing, confirm: "Result written to TEMP_DIR/issue-OWNER-REPO-NUMBER.md"

### 2b. General check subagent

**Spawn one additional Agent** (in parallel with the per-issue agents) for general checks.
Include USERNAME, oldest_check_date, all_tracked_numbers, and closed_issues.

Agent prompt:

> Run these general GitHub checks for user USERNAME. Last check date: OLDEST_CHECK_DATE.
>
> **Fetch in parallel:**
>
> 1. Recent activity involving the user (issues not already in the tracker):
>    `gh api "search/issues?q=involves:USERNAME+updated:>OLDEST_CHECK_DATE+is:open" --jq '.items[] | "#\(.number) \(.repository_url | split("/") | .[-2:] | join("/")) — \(.title) [updated: \(.updated_at)]"'`
>    Filter out these already-tracked issue keys: [ALL_TRACKED_NUMBERS].
>
> 2. Check closed issues for reopens (run each in parallel):
>    For each closed issue: [CLOSED_ISSUE_LIST]
>    `gh api repos/OWNER/REPO/issues/NUMBER --jq '.state'`
>    Flag any that are no longer "closed".
>
> **MANDATORY: Write result file to disk.**
>
> You MUST write your analysis to this exact file path:
> `TEMP_DIR/general-check.md`
>
> Use this exact format:
>
> ```markdown
> ---
> type: general
> ---
>
> ## New Issues
> | Issue | Repo | Role | Recommendation |
> |-------|------|------|----------------|
> | #NUMBER — Title | owner/repo | role | Track / Ignore (why) |
> [Or: "None"]
>
> ## Reopened
> [List reopened issues, or "None"]
>
> ## Closed Status
> All N closed issues confirmed still closed.
> [Or list surprises]
>
> ## New Issues to Add
> [For issues recommended to track, provide full tracker entries here.
>  Or: "None" if no issues recommended for tracking.]
> ```
>
> **DO NOT skip writing the file. This is the primary output of your work.**
> After writing, confirm: "Result written to TEMP_DIR/general-check.md"

### 2c. Wait and verify

Wait for ALL agents to complete. Then verify result files exist:

```bash
ls "$TEMP_DIR"/*.md | wc -l
```

Expected: one file per active issue + one general-check.md.

If any result files are missing, report which agents failed to write their output.
DO NOT proceed to compile if critical files are missing — re-run failed agents.

**acceptance_criteria:** `$TEMP_DIR` contains one `issue-*.md` per active issue AND `general-check.md`.

</step>

<step name="compile_report" priority="must-execute">

## Step 3: Compile and Present Report

**MANDATORY — DO NOT SKIP THIS STEP.**
This is the primary output of the check-in. Proceeding to actions or tracker updates
without showing the overview to the user is a workflow violation.

Run the compile-report script:

```bash
node "$SKILL_DIR/bin/tracker-tools.cjs" compile-report --temp-dir "$TEMP_DIR" --date "$(date +%Y-%m-%d)"
```

The script reads all result files from `$TEMP_DIR`, compiles the overview report, and
outputs it to stdout. It also writes it to `$TEMP_DIR/_compiled-report.md`.

**Show the FULL report output to the user.** Do not summarize, truncate, or paraphrase.
The user needs to see the complete overview to make decisions in the next step.

**acceptance_criteria:** Report shown to user containing "GitHub Issues Check-In" header.
`$TEMP_DIR/_compiled-report.md` exists.

</step>

<step name="confirm_actions">

## Step 4: Confirm and Execute Actions

**If there are "Next steps" items in the report:**

Use AskUserQuestion:
- header: "Execute?"
- question: "Found N actions to take. How should we proceed?"
- options:
  - "Draft comments for my review, then post after approval"
  - "Show me the list, I'll pick which ones"
  - "Skip — no actions this time"

If the user wants drafts:
1. Draft ALL comments. For each draft, include:
   - Target issue number and title
   - The full comment text
   - Why we're posting it (context)
2. Present all drafts together in a numbered list.
3. Wait for approval. The user may:
   - Approve all ("send" / "go" / "approved")
   - Request edits to specific drafts ("change #3 to ...")
   - Remove specific drafts ("skip #2")
4. After final approval, post ALL approved comments in parallel via `gh issue comment`.
5. Report back with a link table:

```
| Issue | Comment Link |
|-------|-------------|
| #NUMBER | [link](url) |
```

**Before drafting any comment about a duplicate/related issue:**
- Read the target issue's FULL body first (not just the title)
- Verify your claims are accurate — don't misattribute root causes
- Match the tone of the target repo's community

**acceptance_criteria:** Actions either executed with confirmation or explicitly skipped by user.

</step>

<step name="update_tracker">

## Step 5: Update Tracker

Use AskUserQuestion:
- header: "Update file?"
- question: "Want me to update the tracker file with today's findings?"
- options:
  - "Yes, update it"
  - "No, leave it as-is"

If confirmed, run the update-tracker script:

```bash
node "$SKILL_DIR/bin/tracker-tools.cjs" update-tracker --tracker "$TRACKER_PATH" --temp-dir "$TEMP_DIR" --date "$(date +%Y-%m-%d)"
```

The script returns JSON with `updated` (bool) and `changes` (array of descriptions).

Report what changed to the user.

**acceptance_criteria:** Tracker either updated (with changes reported) or explicitly skipped by user.

</step>

<step name="validate_and_cleanup" priority="last">

## Step 6: Validate and Cleanup

Run validation to confirm all workflow outputs were produced:

```bash
node "$SKILL_DIR/bin/tracker-tools.cjs" validate --temp-dir "$TEMP_DIR" --tracker "$TRACKER_PATH" --expected ACTIVE_ISSUE_COUNT --date "$(date +%Y-%m-%d)"
```

If validation fails, report which checks did not pass.

Then clean up the temp directory:

```bash
rm -rf "$TEMP_DIR"
```

**acceptance_criteria:** Validation passes. Temp directory removed.

</step>
