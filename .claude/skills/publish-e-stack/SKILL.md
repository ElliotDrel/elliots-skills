---
name: publish-e-stack
description: >
  Publish e-stack skills to npm. Use this skill whenever the user wants to
  publish, release, ship, or push a new version of e-stack to npm. Also use when the user says
  "publish", "release it", "ship it", "push to npm", "we're ready to publish", or asks to
  verify a publish went through. Covers the full flow: local install test, commit, push,
  and post-publish verification. Do not use for regular git commits that don't involve
  npm publishing.
---

# Publish E-Stack

Follow each phase in order. Do not skip phases. There are two approval gates — use `AskUserQuestion` for each to get explicit confirmation before proceeding.

## Phase 1: Pre-flight Diagnostics

Read-only checks that run automatically when the skill loads.

```!
bash "${CLAUDE_SKILL_DIR}/scripts/preflight.sh"
```

Present the diagnostics to the user. If there are frontmatter issues, fix them before continuing.

## Phase 2: Install — APPROVAL GATE 1

Show the user what will change (from the diffs above) and ask: **"Ready to run the installer? This will overwrite your local skills in ~/.claude/skills/."**

Only after they confirm, run `node bin/install.cjs`, then re-run `bash "${CLAUDE_SKILL_DIR}/scripts/preflight.sh"` to verify everything installed correctly. If anything fails, stop and fix before proceeding.

## Phase 3: Publish — APPROVAL GATE 2

Key rules:
- **Pull before committing** — CI commits a version bump after each publish, so local is always behind. Run `git pull --rebase origin main` first.
- **Include `[publish]` in the commit message** — this triggers the GitHub Actions workflow. Without it, nothing publishes.
- **Do NOT manually bump `package.json` version** — the workflow does this automatically.
- **Do NOT commit unrelated files** (e.g. `Untitled-1.md`).

Show the user the proposed commit message and ask: **"Ready to commit and push with [publish]?"**

Only after they confirm, commit and push.

## Phase 4: Post-publish Verification

After pushing, verify both GitHub Actions and npm:

1. **GitHub Actions** — check `gh run list` for the run. If it failed, read logs with `gh run view <id> --log-failed`.
2. **npm** — check `npm view elliot-stack version` bumped correctly.

Report the final status: GitHub Actions pass/fail and the new npm version number.

## Troubleshooting

- **OIDC token failures** → needs `actions/setup-node@v6` with Node 24
- **Version conflict** → someone else published; pull and retry
- **npm version unchanged** → workflow may still be running, or commit message missing `[publish]`
- **YAML parsing errors** → unquoted colons in commit messages break GitHub Actions
- **Push rejected** → pull/rebase first, then push again
