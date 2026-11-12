# Repository Guidelines

## Project Structure & Module Organization
Symancy is a Vite-based React 19 SPA. Core UI and business logic sit in `src/` with `components/` for shared UI, `pages/` for marketing/public routes, `admin/` for the control panel, `services/` for Supabase and Gemini clients, `contexts/` for global React providers, and `types/` for DTOs. Use the `@/` alias for imports that point into `src/`. Workspace contracts live in `packages/shared-types`, while serverless code and SQL migrations live in `supabase/functions` and `supabase/migrations`. Specs and product briefs in `specs/00x-*` explain why features exist—skim them before starting scope-heavy work.

## Build, Test & Development Commands
- `pnpm install` — install workspace dependencies (run whenever package manifests change).
- `pnpm dev` — run the Vite dev server with Playwright-friendly ports.
- `pnpm build` / `pnpm preview` — produce and inspect production bundles; use `pnpm build:all` if workspace packages also need compiling.
- `pnpm type-check` — run TypeScript in no-emit mode; `pnpm type-check:all` recurses through workspaces.
- `pnpm test:e2e`, `pnpm test:e2e:ui`, `pnpm test:e2e:headed` — execute Playwright suites headless, with inspector UI, or headed.

## Coding Style & Naming Conventions
Write modern TypeScript/React with functional components, React hooks, and Suspense when splitting routes. Follow the workspace path alias `@/feature/...` and keep side-effect imports near the top to preserve treeshaking. Styles should rely on Tailwind tokens defined in `tailwind.config.js`; prefer the shadcn-derived primitives in `src/components/ui/`. Use camelCase for functions, PascalCase for components, and SCREAMING_SNAKE_CASE for environment variables. Keep files focused: one component per file, with colocated hooks under `src/hooks/featureName`.

## Testing Guidelines
E2E tests live in `e2e/` and target Chromium via Playwright. Tests automatically boot `pnpm dev`, so reserve ports 3000/4173 before running. Name specs `<feature>.spec.ts` and keep fixtures lean; attach traces only on retries to keep artifacts readable. Rely on type tests plus runtime guards—if a change affects shared contracts, add or extend fixtures in `packages/shared-types/src/`. Aim for meaningful coverage on flows that affect payments, Supabase auth, and credit accounting.

## Commit & Pull Request Guidelines
Follow Conventional Commits (`feat`, `fix`, `chore`, etc.) with a scope that matches the folder being touched, mirroring existing history. Keep commits focused and ensure the changelog automation can summarize them. Pull requests must describe the problem, the solution, the relevant spec link, and include screenshots or video for UX work. Reference Supabase migrations or new environment requirements explicitly so deploys are safe.

## Security & Configuration Tips
Never commit secrets. Local runs require `.env.local` entries for `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_GEMINI_API_KEY`. For payment flows, sync YooKassa secret storage with the Supabase project before testing. Keep browser-side logging scrubbed—errors should bubble through shared toasts instead of `console.log`.

## Landing the Plane (Session Completion)

**When ending a work session**, follow the repo delivery contract and current user authorization. Remote pushes are not automatic.

**WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run final acceptance** - one risk-selected set after implementation; full
   suite only at epic/release
3. **Update issue status** - Close finished work, update in-progress items
4. **Deliver when authorized** - after final acceptance passes:
   ```bash
   git fetch                 # stop if the remote is ahead or diverged
   # If the local Beads DB looks empty or broken after clone/upgrade:
   bd bootstrap --yes
   # If .beads/issues.jsonl has data but the local DB is empty:
   bd import
   # If this repo commits .beads/issues.jsonl, refresh it before push:
   bd export -o .beads/issues.jsonl
   git push                  # ordinary non-force push to the tracking branch only
   ```
5. **Preserve unrelated state** - do not clear stashes or prune branches without
   explicit current authorization
6. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Stage files explicitly by path; never `git add -A` over unrelated working-tree changes.
- Ordinary commits and ordinary push are allowed after final acceptance when the repo contract or current user request authorizes delivery. Before push, fetch and stop if the remote is ahead/diverged, the branch/protected target is unclear, or uncommitted scope is unsafe.
- Leaving work committed but unpushed is a valid outcome. Report it instead of forcing delivery.
- Ask before force-push, remote branch deletion, PR creation or merge, deploy, and production/live mutation.
- Use `bd bootstrap`, `bd import`, and `bd export` only when the local workspace state requires them. Install Beads git hooks only when this repo's current contract explicitly authorizes them.
