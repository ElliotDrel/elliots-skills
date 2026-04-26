# Publish E-Stack to npm

Follow each phase in order. There is one approval gate.

## Phase 1: Pre-publish Checks

Verify the repo is ready to publish:

1. Run `git status --short` and `git diff --stat` to see what will be committed
2. Check for uncommitted changes that should be included or excluded
3. Do NOT commit unrelated files (e.g. `Untitled-1.md`)

## Phase 2: Commit and Push — APPROVAL GATE

Key rules:
- **Pull before committing** — CI commits a version bump after each publish, so local is always behind. Run `git pull --rebase origin main` first (stash if needed).
- **Include `[publish]` in the commit message** — this triggers the GitHub Actions workflow. Without it, nothing publishes.
- **Do NOT manually bump `package.json` version** — the workflow does this automatically.

Show the user the proposed commit message and ask: **"Ready to commit and push with [publish]?"**

Only after they confirm, commit and push.

## Phase 3: Post-publish Verification

After pushing, verify both GitHub Actions and npm:

1. **GitHub Actions** — check `gh run list` for the run. Watch with `gh run watch <id> --exit-status`. If it failed, read logs with `gh run view <id> --log-failed`.
2. **npm** — check `npm view elliot-stack version` bumped correctly.

Report the final status: GitHub Actions pass/fail and the new npm version number.

## Troubleshooting

If a publish fails or you need to debug the workflow, auth setup, or OIDC configuration, read `docs/publishing.md` — it has the full details including known gotchas and past learnings.
