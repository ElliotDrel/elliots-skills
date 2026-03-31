# First-Time Setup: GitHub Issue Tracker

Run this workflow when no tracker file exists. Creates a tracker from scratch by
discovering all open issues the user is involved in.

## Prerequisites

Verify `gh` CLI is authenticated before proceeding:
```bash
gh auth status
```
If not authenticated, tell the user to run `! gh auth login` in their terminal and STOP.

## Phase 1: Get GitHub Username

Ask the user for their GitHub username. Verify it exists:
```bash
gh api users/USERNAME --jq '.login'
```
If invalid, ask again. Do not guess.

## Phase 2: Discover Active Issues

Run ALL of these searches in parallel:

### 2a. Issues authored by the user
```bash
gh api "search/issues?q=author:USERNAME+is:open&per_page=100&sort=updated" \
  --jq '.items[] | "#\(.number) \(.repository_url | split("/") | .[-2:] | join("/")) — \(.title) [role: author] [updated: \(.updated_at | split("T")[0])]"'
```

### 2b. Issues the user has commented on (excluding authored)
```bash
gh api "search/issues?q=commenter:USERNAME+is:open+-author:USERNAME&per_page=100&sort=updated" \
  --jq '.items[] | "#\(.number) \(.repository_url | split("/") | .[-2:] | join("/")) — \(.title) [role: commenter] [updated: \(.updated_at | split("T")[0])]"'
```

### 2c. Issues where the user is mentioned (excluding authored/commented)
```bash
gh api "search/issues?q=mentions:USERNAME+is:open+-author:USERNAME+-commenter:USERNAME&per_page=100&sort=updated" \
  --jq '.items[] | "#\(.number) \(.repository_url | split("/") | .[-2:] | join("/")) — \(.title) [role: mentioned] [updated: \(.updated_at | split("T")[0])]"'
```

### 2d. Open PRs authored by the user
```bash
gh api "search/issues?q=author:USERNAME+is:open+type:pr&per_page=100&sort=updated" \
  --jq '.items[] | "#\(.number) \(.repository_url | split("/") | .[-2:] | join("/")) — \(.title) [role: PR author] [updated: \(.updated_at | split("T")[0])]"'
```

## Phase 3: Present Findings

Show all discovered issues grouped by repo:

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

## Phase 4: Gather Details on Selected Issues

For each selected issue, fetch in parallel:
- Full metadata: `gh api repos/OWNER/REPO/issues/NUMBER` (state, labels, comments count, created_at)
- Last 3 comments: `gh api repos/OWNER/REPO/issues/NUMBER/comments --jq '.[-3:]'`

From this, determine for each issue:
- Role (author/commenter/mentioned)
- Current status summary
- Who commented last (are we waiting for a response?)
- Any cross-references to other issues in the comments

## Phase 5: Check Recently Closed Issues

Search for recently closed issues involving the user:
```bash
gh api "search/issues?q=involves:USERNAME+is:closed+closed:>$(date -d '30 days ago' +%Y-%m-%d)&per_page=50&sort=updated" \
  --jq '.items[] | "#\(.number) \(.repository_url | split("/") | .[-2:] | join("/")) — \(.title) [closed: \(.closed_at | split("T")[0])]"'
```

Ask if any should be added to "Closed / Resolved" for historical tracking.

## Phase 6: Build the Tracker

1. Read `tracker-template.md` from the skill directory.
2. Replace `USERNAME_HERE` with the actual GitHub username.
3. For each selected issue, create an entry under "Active Issues" following the schema in `references/tracker-schema.md`.
4. Add any selected closed issues to "Closed / Resolved".
5. Show the complete tracker content to the user for confirmation.
6. After confirmation, write to: `$HOME/.claude/github-tracker.md`

Tell the user:
> Tracker created. Run `/github-issues-update` anytime to check for updates.
