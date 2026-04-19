# E-STACK RESOLVER

**E-stack** (`elliot-stack` on npm) is an open-source collection of Claude Code skills by Elliot Drel. It's a curated skill pack — users run `npx elliot-stack@latest` to install all skills to `~/.claude/skills/`. Skills cover negotiation (Chris Voss), customer discovery, GitHub issue tracking, and repo search. The repo is the source of truth; npm is the distribution channel.

**Before acting, match your task to the routing below. Follow the referenced path — do not invent workflows.**

---

## 1. Task Routing

| Task | Action |
|---|---|
| **Editing a skill** | Show diff (`diff -ru ~/.claude/skills/<name> skills/<name>`), confirm with user, then run `node bin/install.cjs` |
| **Adding a new skill** | Invoke `add-skill-to-e-stack` skill |
| **Publishing to npm** | Invoke `publish-e-stack` skill |
| **Debugging a failed publish** | Read `docs/publishing.md` |
| **Skill auto-run commands** | Use `` ```! `` code blocks in SKILL.md — see `skills/estack-repo-search/SKILL.md` for example |

## 2. Repo Structure

- **Skills:** `skills/<skill-name>/SKILL.md` — each skill is a subfolder with a `SKILL.md` and optional supporting files
- **Distribution:** `npx elliot-stack@latest` copies skills to `~/.claude/skills/`
- **Installer:** `node bin/install.cjs` syncs repo skills to the live location

## 3. Hard Rules

- **Never manually bump `package.json` version** — the publish workflow handles this on push to main
- **`[publish]` in a commit message** triggers npm publish via GitHub Actions. Commits without it are safe to push.
- **Always show diff and confirm** before syncing changed skills to the live location
