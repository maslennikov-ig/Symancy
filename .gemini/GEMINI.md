# Symancy Project Memory

## Project Context
- **Name**: Symancy (Coffee Cup Psychologist)
- **Repo**: `maslennikov-ig/Symancy` (Public)
- **Stack**: React 19, Vite, pnpm, Supabase, Refine, YooKassa.

## Infrastructure & Deployment
- **Method**: Atomic Symlink Deployment (Zero-Downtime).
- **Path**: `/var/www/symancy` (current -> releases/TIMESTAMP).
- **Server**: `91.132.59.194` (User: `deploy` for app, `root` for admin).
- **CI/CD**: GitHub Actions `.github/workflows/deploy.yml`.
- **Notifications**: Telegram bot (SUCCESS/FAILED) integrated into CD.

## Critical Fixes & Decisions
- **React 19 Compatibility**: Use `pnpm.overrides` for `react` and `react-dom` to prevent duplicate instances and hook errors (e.g., in YooKassa widget).
- **Security Audit**: History cleaned using `git-filter-repo` (removed 8130... token). Old token revoked.
- **Type Safety**: `skipLibCheck` and `// @ts-nocheck` used selectively to bypass third-party library typing issues (refinedev, yoomoney widget).

## Environment Setup
- **Supabase**: Requires `http://localhost:5173/**` in Redirect URLs for local magic link testing.
- **Local Memory**: This file (`.gemini/GEMINI.md`) stores project-specific facts to supplement global user memory.

---
## Gemini Added Memories
- (Gemini will automatically append learned project facts here)