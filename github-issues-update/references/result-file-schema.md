# Result File Schema

> This format is consumed by both `compile-report` and `build-tracker` commands.
> Agent analysis writes this format to temp dir. The script commands read it.

One unified format for **both** setup deep-dives and check-in reviews. The only
differences are noted inline with `(setup)`, `(check-in)`, or `(both)`.

---

## Filename Convention

- Setup: `issue-OWNER-REPO-NUMBER.md`
- Check-in: `issue-OWNER-REPO-NUMBER.md`
- Raw data (written by `fetch-issues`): `raw-OWNER-REPO-NUMBER.json`

---

## Frontmatter (REQUIRED)

All fields are required unless marked optional.

```yaml
---
type: issue                    # (both) Always "issue"
owner: OWNER                   # (both) Repository owner
repo: REPO                     # (both) Repository name
number: NUMBER                 # (both) Issue number
title: "TITLE"                 # (both) Issue title, quoted
state: open                    # (both) "open" or "closed"
state_changed: false           # (check-in) true if state changed since last check; always false for setup
labels: label1, label2         # (both) Comma-separated labels
has_activity: false            # (check-in) true if new comments since last check; always false for setup
role: "SEE GUIDANCE BELOW"     # (both) CRITICAL — must describe what the user DID
filed: YYYY-MM-DD              # (both) Date issue was created
last_check_date: null          # (check-in) Date of previous check; null for setup
last_commenter: "@username"    # (both) Most recent commenter
last_comment_date: YYYY-MM-DD  # (both) Date of most recent comment
comment_count: N               # (both) Total comment count
---
```

### Role Field Guidance (CRITICAL)

The role field MUST describe what the user **DID**, not just a label. This is
the single most important quality signal in the result file.

**BAD examples (DO NOT write these):**
- `"Author"`
- `"Commenter"`
- `"Mentioned"`

**GOOD examples (write like these):**
- `"Author (filed with 3 crash instances, upstream tracking in bun#28175, posted workaround)"`
- `"Commenter (confirmed bug + posted workaround with exact callbackPort: 3118 fix)"`
- `"Author (proposed configurable keybindings, shared skill implementation + reported 64KB bug)"`
- `"Commenter (provided memory profiling data showing 1.2GB peak at 45min mark)"`

---

## Body Sections

All sections are **REQUIRED** unless explicitly marked optional. Write them in this order.

### ## Status Summary
**(both) REQUIRED**

2-3 sentences with specific technical details. Not generic descriptions.

**BAD:** "Issue is about a bug that causes crashes."
**GOOD:** "Open since 2026-01-15, reports JSONL title write crash when renaming MCP servers. Three separate crash instances documented with distinct memory addresses. Upstream Bun issue bun#28175 tracks the root GC cause."

---

### ## Key Technical Data
**(both) REQUIRED — not optional**

Concrete data points from body and comments. This section contains the raw facts
someone would need to discuss this issue knowledgeably.

Include: error codes, memory addresses, API parameters, config paths, version numbers,
stack traces, test counts, file lists, verbatim error messages, exact commands.

**BAD:** "Memory leak reported"
**GOOD:** "@kolkov's mimalloc analysis: ~1GB/h growth, traced to arena retention in bun's GC cycle. Peak RSS 2.4GB after 90min session. `MIMALLOC_SHOW_STATS=1` shows 847 abandoned segments."

---

### ## External Links
**(both) REQUIRED**

All URLs found in body and comments: fork repos, PR links, workaround documentation,
tool links, upstream references.

If none found, write: "None found."

---

### ## Activity
**(both) REQUIRED**

- **(check-in):** New comments since last_check_date, with author, date, and specifics.
- **(setup):** "Initial review" — summarize the full comment history.

Format for check-in:
```
- @username (YYYY-MM-DD): What they said WITH specifics.
```

---

### ## Duplicates and Related
**(both) REQUIRED**

Two subsections:

#### ### Known — updates
Status of previously known duplicates/adjacent issues. Or "No changes."

#### ### New finds
Newly discovered duplicates or related issues. Or "None found."

For EACH duplicate or related issue, explain whether it shares a **ROOT CAUSE**
or just **SYMPTOMS**. Use labels:
- **"duplicate"** — same root cause
- **"adjacent"** — related area, different problem

**BAD examples:**
- `"#40693 — related rename issue"`
- `"#1234 — similar bug"`

**GOOD examples:**
- `"#40693 — VS Code UI blocking during rename. Shares symptoms (rename fails) but root cause is different: UI thread blocking vs JSONL write. Adjacent, not duplicate."`
- `"#1189 — Same callbackPort: 0 crash on Windows. Identical stack trace through net.Server.listen. Duplicate (same root cause)."`

---

### ## Competing PRs
**(both) Optional — include when multiple PRs exist for the same issue**

Compare approaches: which supersedes, what semantic differences exist, downstream effects.

---

### ## Upstream
**(both) REQUIRED**

Upstream dependency status. Write "N/A" if no upstream dependency.

---

### ## Cross-References
**(both) REQUIRED**

ALL issue numbers (`#NUMBER`, `owner/repo#NUMBER`) mentioned in body and comments,
even if not tracked. These may reveal related issues not yet in the tracker.

The `fetch-issues` command extracts these into the raw JSON `cross_references` array.
Copy them here and note which (if any) are already tracked.

---

### ## Next Steps
**(both) REQUIRED**

MUST be specific, not generic.

**BAD examples:**
- `"Monitor for maintainer engagement"`
- `"Follow up"`
- `"Keep watching"`

**GOOD examples:**
- `"Respond to @maintainer's request for memory profiling data from session replay"`
- `"Post memory profiling data from session replay showing 1.2GB peak at 45min mark"`
- `"Test fix in PR #4521 against reproduction case from comment on 2026-03-15"`

---

### ## Watch For
**(both) REQUIRED**

MUST name specific signals.

**BAD examples:**
- `"Watch for updates"`
- `"Monitor for changes"`

**GOOD examples:**
- `"PRs modifying renameSession or custom-title handling; JSONL title write logic changes"`
- `"Bun releases mentioning mimalloc or GC arena fixes; bun#28175 state change"`

---

### ## Tracker Updates
**(both) REQUIRED**

Lines consumed by `update-tracker` and `build-tracker` commands:

```
status_summary: Open. Labels: bug, p1. JSONL crash on rename with 3 instances. 12 comments total.
what_to_check: PRs modifying renameSession or custom-title handling; JSONL title write logic changes.
```

Optional lines:
```
new_duplicate: #NUMBER — @author, "Title" (date). Why related. [duplicate|adjacent]
```

---

### ## Key Context
**(both) REQUIRED**

Workarounds (EXACT commands, not paraphrases), severity signals, competing PRs.

**BAD examples:**
- `"Use different server names"`
- `"There's a workaround"`

**GOOD examples:**
- `"Name servers differently (slack-buildpurdue, slack-keel) at user scope via claude mcp add-json"`
- `"Workaround: set MIMALLOC_ARENA_EAGER_COMMIT=0 before starting. Reduces peak RSS from 2.4GB to 1.1GB but does not eliminate growth."`
