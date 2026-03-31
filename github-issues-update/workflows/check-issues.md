# Check-In Workflow

Main workflow for `/github-issues-update`. Executed when tracker file exists.
Read `references/gh-cli-patterns.md` and `references/tracker-schema.md` before starting.

---

## Phase 1: Gather Data

Run as many of these as possible in parallel using separate Bash tool calls.
Maximize parallelism — steps 1a-1f have no dependencies on each other.

### 1a. Check all active issues for updates

For EACH issue in the "Active Issues" section of the tracker, fetch in parallel:

- **Metadata:** `gh api repos/OWNER/REPO/issues/NUMBER` — extract state, labels, comment count, updated_at
- **Recent comments:** `gh api repos/OWNER/REPO/issues/NUMBER/comments` — last 3 comments with author, date, and body (truncate to 300 chars)

Compare against the tracker's recorded state:
- New comments since last "Status as of" date?
- Label changes?
- State changes (open → closed, or vice versa)?
- Any comments from repo maintainers or Anthropic employees? (These are highest priority signals.)

### 1b. Check previously identified duplicates/related issues

For each issue listed under "Duplicates found," "Adjacent issues found," or "Related" in the tracker:
- Fetch current state and last 2 comments
- Note any new activity — especially responses to comments we posted

### 1c. Search for NEW duplicates and related issues

**Skip this step if `--skip-dupes` flag is active.**

For each active issue, search for recently created issues overlapping its topic:
- Use `gh api search/issues` with 2-3 keyword variations from the issue title/topic
- Filter to `created:>LAST_CHECK_DATE` (extract from "Status as of" dates in tracker)
- Exclude issues already in the tracker (check issue numbers against all tracked + known duplicates)
- Use multiple search queries per issue to catch different phrasings

### 1d. Search for recent activity involving the user

```bash
gh api "search/issues?q=involves:USERNAME+updated:>LAST_CHECK_DATE+is:open" \
  --jq '.items[] | "#\(.number) \(.repository_url | split("/") | .[-2:] | join("/")) — \(.title) [updated: \(.updated_at)]"'
```

Flag any issues not already in the tracker — these are candidates for adding.

### 1e. Check closed issues for unexpected reopens

For each issue in "Closed / Resolved":
- Quick state check via `gh api repos/OWNER/REPO/issues/NUMBER --jq '.state'`
- Flag if reopened

### 1f. Check upstream issues

For any issues with an "Upstream" field:
- Fetch current state, labels, and recent comments
- Note if upstream was fixed/closed (may affect our downstream issue)

---

## Phase 2: Analyze and Report

Present a structured report in chat. Order issues by activity level (most active first).

**For issues WITH new activity, use this format:**

```
### owner/repo#NUMBER — Title
- **Status:** [Open/Closed] [state changes since last check]
- **Labels:** [current labels]
- **Activity since last check:** [new comments summary — who said what, highlight maintainer/Anthropic responses]
- **Known duplicates — updates:** [any new activity on previously identified dupes]
- **New duplicates/related found:** [new ones: #number — @author, "title" (date), why related]
- **Next steps (now):** [immediate actions — comment on duplicate, respond to question, etc.]
- **Future:** [things to monitor, low-priority actions]
```

**For issues with NO new activity**, group them in a brief summary:

```
### No Activity
- owner/repo#NUMBER — Title (last activity: DATE)
- owner/repo#NUMBER — Title (last activity: DATE)
```

**After all active issues, add these sections:**

```
### New Issues Not in Tracker
[Issues found in 1d not already tracked. For each: #number, title, repo, role, recommendation (track/ignore)]

### Closed Issues Status
[Confirm all closed issues still closed. Flag any surprises.]

### Upstream Status
[Status of any upstream dependencies. Flag if fixed upstream but not downstream.]
```

---

## Phase 3: Confirm and Execute

**If `--dry-run` flag is active, STOP here.** Tell the user: "Dry run complete. No actions taken."

**If there are "Next steps (now)" items:**

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

---

## Phase 4: Update Tracker

Use AskUserQuestion:
- header: "Update file?"
- question: "Want me to update the tracker file with today's findings?"
- options:
  - "Yes, update it"
  - "No, leave it as-is"

If confirmed, update `github-tracker.md` following the schema in `references/tracker-schema.md`:

- Update all "Status as of" dates to today's date
- Update comment counts, labels, state descriptions
- Add newly discovered duplicates/related issues under their parent issue
- Add new issues to Active or Closed sections as appropriate
- Move any newly closed issues from Active to Closed
- Clear completed "Next steps (now)" items
- Add new "Future" items identified this check-in
- Preserve any content the user added manually (don't overwrite custom notes)

After updating, tell the user what changed:
> Tracker updated. Changed: [brief summary of what was modified].
