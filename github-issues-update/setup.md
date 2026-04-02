# First-Time Setup: GitHub Issue Tracker

Run this workflow when no tracker file exists. Creates a tracker from scratch by
discovering all open issues the user is involved in.

**Prerequisites loaded by router:** `$SKILL_DIR` (skill directory path),
`$TRACKER_PATH` (tracker file path, will be created).

Uses subagents to parallelize discovery and per-issue deep dives.

---

<step name="prereqs" priority="first">

## Step 1: Prerequisites

Verify `gh` CLI is authenticated before proceeding:
```bash
gh auth status
```
If not authenticated, tell the user to run `! gh auth login` in their terminal and **STOP**.

**acceptance_criteria:** `gh auth status` exits 0.

</step>

<step name="get_username">

## Step 2: Get GitHub Username

Ask the user for their GitHub username. Verify it exists:
```bash
gh api users/USERNAME --jq '.login'
```
If invalid, ask again. Do not guess.

**acceptance_criteria:** Valid GitHub username confirmed via API.

</step>

<step name="discover_issues">

## Step 3: Discover Active Issues (Subagent)

Create a temp directory for results:
```bash
TEMP_DIR=$(node "$SKILL_DIR/bin/tracker-tools.cjs" init-temp)
```

**Spawn a single Agent** (general-purpose) to run all discovery searches in parallel and
write results to `$TEMP_DIR/discovery-results.md`.

The agent's prompt must include the USERNAME and these instructions:

> You are discovering all open GitHub issues involving a user. Run ALL of the following
> searches in parallel using separate Bash calls, then combine results into a single
> deduplicated list. For each issue, include: number, owner/repo, title, role, updated date.
>
> **Searches to run (all in parallel):**
>
> 1. Issues authored:
>    `gh api "search/issues?q=author:USERNAME+is:open&per_page=100&sort=updated" --jq '.items[] | "#\(.number) \(.repository_url | split("/") | .[-2:] | join("/")) — \(.title) [role: author] [updated: \(.updated_at | split("T")[0])]"'`
>
> 2. Issues commented on (excluding authored):
>    `gh api "search/issues?q=commenter:USERNAME+is:open+-author:USERNAME&per_page=100&sort=updated" --jq '.items[] | "#\(.number) \(.repository_url | split("/") | .[-2:] | join("/")) — \(.title) [role: commenter] [updated: \(.updated_at | split("T")[0])]"'`
>
> 3. Issues mentioned in (excluding authored/commented):
>    `gh api "search/issues?q=mentions:USERNAME+is:open+-author:USERNAME+-commenter:USERNAME&per_page=100&sort=updated" --jq '.items[] | "#\(.number) \(.repository_url | split("/") | .[-2:] | join("/")) — \(.title) [role: mentioned] [updated: \(.updated_at | split("T")[0])]"'`
>
> 4. Open PRs authored:
>    `gh api "search/issues?q=author:USERNAME+is:open+type:pr&per_page=100&sort=updated" --jq '.items[] | "#\(.number) \(.repository_url | split("/") | .[-2:] | join("/")) — \(.title) [role: PR author] [updated: \(.updated_at | split("T")[0])]"'`
>
> 5. Recently closed issues (last 30 days):
>    `gh api "search/issues?q=involves:USERNAME+is:closed+closed:>THIRTY_DAYS_AGO&per_page=50&sort=updated" --jq '.items[] | "#\(.number) \(.repository_url | split("/") | .[-2:] | join("/")) — \(.title) [closed: \(.closed_at | split("T")[0])]"'`
>    (Calculate the date 30 days ago using: `python3 -c "import datetime; print((datetime.datetime.now()-datetime.timedelta(days=30)).strftime('%Y-%m-%d'))"`)
>
> **MANDATORY: Write results to disk.**
>
> Write your deduplicated results to: `TEMP_DIR/discovery-results.md`
>
> Format as two sections — "Open Issues" and "Recently Closed" — each grouped by repo.
> Deduplicate across searches (same issue may appear in multiple results). Preserve the role
> from whichever search found it first (priority: author > PR author > commenter > mentioned).
>
> **DO NOT skip writing the file. This is the primary output of your work.**

Verify the file was written:
```bash
test -f "$TEMP_DIR/discovery-results.md" && echo "OK" || echo "MISSING"
```

**acceptance_criteria:** `$TEMP_DIR/discovery-results.md` exists with discovered issues.

</step>

<step name="select_issues">

## Step 4: Present Findings and Select

Read `$TEMP_DIR/discovery-results.md` and show all discovered issues grouped by repo:

```
Found N open issues involving @USERNAME:

### repo-owner/repo-name
- #123 — Title [role: author] [updated: 2026-03-30]
- #456 — Title [role: commenter] [updated: 2026-03-28]
```

Then ask via AskUserQuestion:
- header: "Track which?"
- question: "Which issues do you want to track? Select an option or type specific numbers."
- options:
  - "All of them"
  - "Let me pick specific ones"
  - "None — I'll add manually later"

If "Let me pick," ask the user to list issue numbers.

For recently closed issues, ask if any should be added to "Closed / Resolved" for historical tracking.

**acceptance_criteria:** User has selected which issues to track.

</step>

<step name="deep_dive">

## Step 5: Deep Dive on Selected Issues (Subagents)

**Spawn one Agent per selected issue**, all in parallel. Each agent does a thorough review
of a single issue AND writes its result to `$TEMP_DIR/issue-OWNER-REPO-NUMBER.md`.

The agent's prompt must include the OWNER, REPO, NUMBER, and ROLE, plus:

> You are reviewing GitHub issue OWNER/REPO#NUMBER for initial tracker setup.
> The user's role is ROLE.
> Fetch ALL of the following in parallel, then write a structured result file.
>
> **Data to fetch (all in parallel):**
> 1. Full metadata: `gh api repos/OWNER/REPO/issues/NUMBER --jq '{state: .state, labels: [.labels[].name], comments: .comments, updated: .updated_at, created: .created_at}'`
> 2. Issue body (FULL — do not truncate): `gh api repos/OWNER/REPO/issues/NUMBER --jq '.body'`
> 3. Comments (FULL — do not truncate): `gh api repos/OWNER/REPO/issues/NUMBER/comments --jq '.[] | {author: .user.login, date: (.created_at | split("T")[0]), body: .body}'`
> 4. **Search for duplicates/related** (for authored issues only — skip if ROLE is not "author"):
>    Run 2-3 keyword searches based on the issue title and key terms from the body:
>    `gh api "search/issues?q=repo:OWNER/REPO+is:open+KEYWORD1+KEYWORD2&per_page=10" --jq '.items[] | "#\(.number) — \(.title) [\(.created_at | split("T")[0])] @\(.user.login)"'`
>    Exclude the issue itself. Use different keyword variations to catch different phrasings.
>
> **Analyze and extract specifics:**
>
> IMPORTANT — Extract specifics, don't paraphrase. For authored issues especially, pull
> exact technical data from the body and comments: error codes, memory addresses, stack
> traces, test counts, file counts, competing approaches, version numbers, config values,
> and any other concrete data points. Quote or reproduce them — don't summarize "3 crash
> instances documented" when you can list the actual addresses/sizes.
>
> **MANDATORY: Write result to disk.**
>
> Write to: `TEMP_DIR/issue-OWNER-REPO-NUMBER.md`
>
> Use this format:
>
> ```markdown
> ---
> type: issue
> owner: OWNER
> repo: REPO
> number: NUMBER
> title: "TITLE"
> state: open_or_closed
> labels: label1, label2
> role: ROLE
> filed: YYYY-MM-DD
> comment_count: N
> ---
>
> ## Status Summary
> 2-3 sentence summary with specific technical details.
>
> ## Key Technical Data
> [For authored issues] Concrete data points from body/comments.
>
> ## Last Commenter
> @username on YYYY-MM-DD
>
> ## Waiting On
> Who/what the issue is waiting on.
>
> ## Cross-references
> Other issue numbers mentioned.
>
> ## Duplicates/Related
> [List with #number, title, author, why related. Or "None found." or "Skipped — not authored."]
>
> ## What to Check
> Recommended signals to watch.
>
> ## Key Context
> Workarounds, upstream links, severity signals, competing PRs.
> ```
>
> **DO NOT skip writing the file. This is the primary output of your work.**

Wait for all agents to complete. Verify all result files exist:
```bash
ls "$TEMP_DIR"/issue-*.md | wc -l
```

**acceptance_criteria:** One result file per selected issue in `$TEMP_DIR`.

</step>

<step name="build_tracker" priority="must-execute">

## Step 6: Build the Tracker

**MANDATORY — DO NOT SKIP THIS STEP.**

1. Read `tracker-template.md` from `$SKILL_DIR`.
2. Replace `USERNAME_HERE` with the actual GitHub username.
3. For each selected issue, read its result file from `$TEMP_DIR` and create a tracker
   entry under "Active Issues" following the schema in `references/tracker-schema.md`.
   Use the per-issue agent results to populate all fields.
4. Add any selected closed issues to "Closed / Resolved".
5. Show the complete tracker content to the user for confirmation.
6. After confirmation, write to: `$TRACKER_PATH`

Tell the user:
> Tracker created. Running first check-in now.

Clean up temp directory:
```bash
rm -rf "$TEMP_DIR"
```

**acceptance_criteria:** Tracker file written to `$TRACKER_PATH` with all selected issues.

</step>

Setup is complete. Return control to the router (SKILL.md) which will proceed into the
check-in workflow automatically.
