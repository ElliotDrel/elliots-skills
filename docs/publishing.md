## Publishing

e-stack publishes to npm via GitHub Actions when a commit message contains `[publish]` (`.github/workflows/publish.yml`).

### How it works

1. Push to `main` with `[publish]` in the commit message triggers the workflow
2. Workflow auto-bumps the patch version (e.g. `1.0.5` → `1.0.6`)
3. Commits the version bump with `[skip ci]` to prevent a loop
4. Publishes to npm using OIDC Trusted Publishing (no tokens/secrets needed)

Regular commits to `main` without `[publish]` do NOT trigger a publish.

### What this means for development

- **Include `[publish]` in your commit message when you want to release** (e.g. `add repo-search skill [publish]`)
- **DO NOT manually bump `package.json` version.** The workflow handles this automatically.
- The version bump commit from the workflow will appear in git history with `[skip ci]` in the message.

### Auth setup (already configured, for reference)

- **npm**: Trusted Publisher configured for `ElliotDrel/e-stack` → `publish.yml` (OIDC, no token needed)
- **npm publishing access**: "Require two-factor authentication and disallow tokens"
- **GitHub Actions**: Uses `actions/setup-node@v6` with Node 24 and `id-token: write` permission

### Learnings (from initial setup)

- npm OIDC Trusted Publishing requires `actions/setup-node@v6` and Node 24+. Older versions (v4, Node 20) silently fail with E404 because the npm CLI doesn't properly handle the OIDC token exchange.
- npm's "Trusted Publishing" handles both auth AND provenance — no `--provenance` flag or `NODE_AUTH_TOKEN` env var needed.
- YAML values containing colons (e.g. `"chore: bump"`) must be quoted or they break GitHub Actions parsing. The workflow will show 0 jobs and "workflow file issue" with no useful error.
- The `!` operator in GitHub Actions `if:` conditions is a YAML tag indicator — use `== false` instead.
