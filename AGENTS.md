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

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd sync
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
