# CLAUDE.md

@AGENTS.md

## Claude Code CLI Adapter

- Target runtime: Claude Code CLI in the VS Code integrated terminal on WSL.
- Primary workflow comes from global `~/.claude/CLAUDE.md` and the `orchestration-bridge` plugin.
- For medium/complex, risky, docs-sensitive, delegated, file-changing, or handoff-prone work, use `orchestration-bridge:orchestrator-stage`.
- Do not use `template-bridge` for new orchestration.
- Use Docs L1/L2: `@neuledge/context` first with lockfile-routed package/version; Context7 MCP or first-party docs only when L1 is missing, stale, or insufficient.
- Use Beads when available for file-changing, delegated, long, or handoff-prone work.
- Remote push, PR creation, merge, deploy, force-push, and production mutation require repo contract support and current user authorization.

## Preserved Project Notes

## Project Conventions

**File Organization**:
- Agents: `.claude/agents/{domain}/{orchestrators|workers}/`
- Commands: `.claude/commands/`
- Skills: `.claude/skills/{skill-name}/SKILL.md`
- Temporary: `.tmp/current/` (git ignored)
- Reports: `docs/reports/{domain}/{YYYY-MM}/`

**Code Standards**:
- Build & Type-check must pass before commit (use `pnpm type-check` and `pnpm build`)
- No hardcoded credentials
- Use `pnpm` as the primary package manager

**Deployment & CI/CD**:
- **Strategy**: Atomic Symlink Deployment (Zero-Downtime).
- **Automation**: GitHub Actions via `.github/workflows/deploy.yml`.
- **Infrastructure**: Web root points to `/var/www/symancy/current` which is a symlink to latest release in `releases/`.
- **Notifications**: Telegram bot sends SUCCESS/FAILED alerts for all production deploys.

**Critical Project Fixes**:
- **React Deduplication**: We use `pnpm.overrides` in `package.json` to force a single React instance. This is required to fix hook errors in the YooKassa widget.
- **TypeScript Strictness**: `skipLibCheck: true` and `// @ts-nocheck` are used in specific components (Admin, Payment) to bypass library type conflicts with React 19.

**Supabase Operations**:
- Use Supabase MCP when `.mcp.json` includes supabase server
- **Brand / product name**: **Symancy** (домен `symancy.ru`). Использовать ТОЛЬКО это название в коде, документации, сообщениях пользователю и любых внешних коммуникациях.
- **Supabase project ref**: `johspxgvkbrysxhilmbg`. В Supabase dashboard организация отображается как `MegaCampusAI` — это **legacy техническое имя** (так был создан проект до ребрендинга), **НЕ бренд** и **НЕ имя продукта**. Не использовать.
- Redirect URLs: Must include `http://localhost:5173/**` and `https://symancy.ru/**` for auth to work.

**MCP Configuration**:
- BASE (`.mcp.base.json`): context7 + sequential-thinking (~600 tokens)
- FULL (`.mcp.full.json`): + supabase + playwright + n8n + shadcn (~5000 tokens)
- Switch: `./switch-mcp.sh`

---

## Subagent Selection

| Domain              | Subagent                        | When                          |
| ------------------- | ------------------------------- | ----------------------------- |
| DB/migrations       | `database-architect`            | Schema changes, RLS policies  |
| UI components       | `react-vite-specialist`         | New pages, components         |
| Backend (Telegram)  | `telegram-handler-specialist`   | grammY handlers, bot logic    |
| Backend (Node)      | `node-backend-specialist`       | Server setup, webhooks        |
| Edge Functions      | `supabase-edge-functions-specialist` | Supabase Edge Functions  |
| Tests               | `test-writer`                   | Unit/integration tests        |
| Bugs from report    | `bug-fixer`                     | Fix bug-hunting-report        |
| Code exploration    | `Explore`                       | Find files, understand code   |
| TypeScript types    | `typescript-types-specialist`   | Complex types, generics       |
| Security            | `vulnerability-fixer`           | Security fixes                |
| Prompts             | `prompt-engineer`               | LLM prompts, system prompts   |
| Code review         | `code-reviewer`                 | Post-implementation review    |

**Rule**: For complex tasks, ALWAYS consider delegation. Verify result yourself.

---

## Reference Docs

- **Project Architecture**: `docs/ARCHITECTURE.md` - Full system architecture
- **Tariffs & Credits**: `docs/TARIFFS.md` - Pricing tiers, credit costs, free tier rules
- Agent orchestration: `docs/Agents Ecosystem/AGENT-ORCHESTRATION.md`
- Agents Architecture: `docs/Agents Ecosystem/ARCHITECTURE.md`
- Quality gates: `docs/Agents Ecosystem/QUALITY-GATES-SPECIFICATION.md`
- Report templates: `docs/Agents Ecosystem/REPORT-TEMPLATE-STANDARD.md`
- **i18n Guide**: `docs/I18N_GUIDE.md` - Translation patterns for 3 languages
- **Admin Panel Spec**: `docs/ADMIN_PANEL_SPEC.md` - Admin panel implementation
- **Server access**: `.claude/local.md` (gitignored, IP: `91.132.59.194`, user: `deploy`)

## Active Technologies
- TypeScript 5.8.3, React 19.2.0, pnpm 10.x.
- @supabase/supabase-js 2.84.0, Refine (Dashboard), YooMoney Checkout Widget.
- Supabase PostgreSQL:
  - **Legacy Tables**: `profiles`, `purchases`, `user_credits`, `analysis_history`
  - **Omnichannel Tables**: `unified_users`, `conversations`, `messages`, `message_deliveries`, `link_tokens`, `unified_user_credits`
- **Omnichannel Auth**: Telegram Login Widget + Custom JWT for Telegram users, Supabase Auth for web users

## UI/UX Requirements
- **Languages**: 3 (`ru`, `en`, `zh`) - Russian, English, Chinese. See `docs/I18N_GUIDE.md`
  - ALWAYS add translations to ALL 3 locales in `src/lib/i18n.ts`
  - NO hardcoded user-visible text in components
- **Themes**: 2 (light, dark) - always support both themes with CSS variables

## Project Structure
- **Frontend**: `src/` directory (React 19 + Vite)
  - `src/components/` - UI components organized by feature
  - `src/config/` - Configuration files (chat.ts)
  - `src/lib/` - Utilities (i18n.ts, supabaseClient.ts)
  - `src/pages/` - Route pages
  - `src/services/` - API services
- **Backend**: `symancy-backend/` (Node.js + grammY Telegram bot)
- **Docs**: `docs/` - Technical documentation

## Recent Changes
- 004-omnichannel-chat: Unified chat system (Telegram + Web), Telegram Login Widget, WebApp auth, real-time messaging via Supabase Realtime, account linking (/link command), proactive messaging
- 002-pre-mvp-payments: Added TypeScript 5.8.2, React 19.1.1 + @supabase/supabase-js 2.45.0, YooMoney Checkout Widget (CDN), react-yoomoneycheckoutwidget (wrapper)
