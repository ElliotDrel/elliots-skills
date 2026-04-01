# Save Issues to Tracker

Adds issues from the current conversation to the tracker file. Designed to be run
in a chat where the user has been creating or discussing GitHub issues.

---

## Phase 1: Understand the Tracker

The tracker file has already been read by the router. Use it to:
- Learn the existing entry format (match it exactly for new entries)
- Extract the GitHub username from the header
- Identify which issues are already tracked (to avoid duplicates)

## Phase 2: Identify Issues from Conversation

Scan the conversation history for GitHub issues the user created or discussed. Look for:
- `gh issue create` commands and their output (issue URLs/numbers)
- Issue URLs pasted by the user (e.g., `github.com/owner/repo/issues/123`)
- Issue numbers mentioned in context with a repo (e.g., "opened #45 on owner/repo")
- Issues discussed in detail that the user would want to track

For each issue found, extract what you can from the conversation:
- Owner/repo and issue number
- Title
- The user's role (usually Author if they just created it)
- Key context: why they filed it, what they're watching for, any workarounds

## Phase 3: Fetch Missing Data

For each issue, fetch current metadata to fill gaps the conversation didn't cover:

```bash
gh api repos/OWNER/REPO/issues/NUMBER --jq '{title: .title, state: .state, labels: [.labels[].name], comments: .comments, created: (.created_at | split("T")[0])}'
```

Run all fetches in parallel.

## Phase 4: Confirm and Write

1. Build new tracker entries following the format in `references/tracker-schema.md`.
   Match the style of existing entries in the tracker exactly.
2. Show the user the entries that will be added.
3. Ask for confirmation via AskUserQuestion:
   - header: "Add to tracker?"
   - question: "Add these N issues to the tracker?"
   - options:
     - "Yes, add them"
     - "Let me edit first"
     - "Cancel"
4. If confirmed, append the new entries to the `## Active Issues (watching for updates)` section.
5. Report what was added.
