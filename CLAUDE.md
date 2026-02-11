# Agent Orchestration Rules

> **IMPORTANT**: This file overrides default Claude Code behavior. Follow these rules strictly.

## Main Pattern: You Are The Orchestrator

This is the DEFAULT pattern used in 95% of cases for feature development, bug fixes, refactoring, and general coding tasks.

### Core Rules

**1. GATHER FULL CONTEXT FIRST (MANDATORY)**

Before delegating or implementing any task:
- Read existing code in related files
- Search codebase for similar patterns
- Review relevant documentation (specs, design docs, ADRs)
- Check recent commits in related areas
- Understand dependencies and integration points

NEVER delegate or implement blindly.

**2. DELEGATE TO SUBAGENTS**

Before delegation:
- Provide complete context (code snippets, file paths, patterns, docs)
- Specify exact expected output and validation criteria

After delegation (CRITICAL):
- ALWAYS verify results (read modified files, run type-check)
- NEVER skip verification
- If incorrect: re-delegate with corrections and errors
- If TypeScript errors: re-delegate to same agent OR typescript-types-specialist

**3. EXECUTE DIRECTLY (MINIMAL ONLY)**

Direct execution only for:
- Single dependency install
- Single-line fixes (typos, obvious bugs)
- Simple imports
- Minimal config changes

Everything else: delegate.

**4. TRACK PROGRESS**

- Create todos at task start
- Mark in_progress BEFORE starting
- Mark completed AFTER verification only

**5. COMMIT STRATEGY**

Run `/push patch` after EACH completed task:
- Mark task [X] in tasks.md
- Add artifacts: `→ Artifacts: [file1](path), [file2](path)`
- Update TodoWrite to completed
- Then `/push patch`

**6. EXECUTION PATTERN**

```
FOR EACH TASK:
1. Read task description
2. GATHER FULL CONTEXT (code + docs + patterns + history)
3. Delegate to subagent OR execute directly (trivial only)
4. VERIFY results (read files + run type-check) - NEVER skip
5. Accept/reject loop (re-delegate if needed)
6. Update TodoWrite to completed
7. Mark task [X] in tasks.md + add artifacts
8. Run /push patch
9. Move to next task
```

**7. HANDLING CONTRADICTIONS**

If contradictions occur:
- Gather context, analyze project patterns
- If truly ambiguous: ask user with specific options
- Only ask when unable to determine best practice (rare, ~10%)

**8. TYPESCRIPT ERRORS** — Re-delegate to same agent OR `typescript-types-specialist`

**9. /push — NEVER DISCARD CHANGES**

- **FORBIDDEN**: `git reset`, `git checkout --`, `git stash` during `/push`
- **ALWAYS** commit all uncommitted changes or ASK user first

### Planning Phase (ALWAYS First)

Before implementing tasks:
- Analyze execution model (parallel/sequential)
- Assign executors: MAIN for trivial, existing if 100% match, FUTURE otherwise
- Create FUTURE agents: launch N meta-agent-v3 calls in single message, ask restart
- Resolve research (simple: solve now, complex: deepresearch prompt)
- Atomicity: 1 task = 1 agent call
- Parallel: launch N calls in single message (not sequentially)

See speckit.implement.md for details.

---

## Task Management with Beads

> All work MUST be tracked in Beads. Prefix: `sym`.

### Session Workflow

```bash
# SESSION START (auto via hooks)
# bd prime runs automatically → injects context

# FIND WORK
bd ready                          # Available tasks (no blockers)
bd list --unlocked                # Tasks not locked by other terminals
bd show <id>                      # Task details

# WORK
bd update <id> --status in_progress   # Acquires exclusive lock
# ... do the work ...
bd close <id> --reason "Done"         # Releases lock

# SESSION END (MANDATORY CHECKLIST)
# [ ] git status
# [ ] git add <files>
# [ ] bd sync
# [ ] git commit -m "..."
# [ ] bd sync
# [ ] git push
```

### Multi-Terminal Work

- Each terminal acquires **exclusive lock** via `bd update --status in_progress`
- Lock auto-releases after 30min inactivity
- **Rule**: Each terminal works on DIFFERENT issues
- Find unlocked: `bd list --unlocked`

### How User Gives Me Tasks

1. **From Beads**: "Работай над sym-xxx" or `bd ready` output
2. **New task**: Create beads task FIRST, then work
3. **Discussion**: If clarifying/researching, no task needed yet

### Task Types

| Work Type       | Tool  | Command                                         |
| --------------- | ----- | ----------------------------------------------- |
| Feature         | Beads | `bd create -t feature --files path/to/file.tsx` |
| Bug fix         | Beads | `bd create -t bug`                              |
| Tech debt/chore | Beads | `bd create -t chore`                            |
| Documentation   | Beads | `bd create -t docs`                             |
| Epic            | Beads | `bd create -t epic`                             |

### Automation

- **Daemon auto-sync**: Enabled (auto-commit, auto-push, auto-pull for beads)
- **Hooks**: SessionStart/PreCompact → `bd prime`, Stop → `bd sync`
- **Exclusive Lock**: Prevents conflicts in multi-terminal work
- **Emergent work**: `bd create "Issue" -t bug --deps discovered-from:<current-id>`

---

## External Documentation (Context7)

**Before implementing** with external libraries, query Context7 for latest docs:

```
mcp__context7__resolve-library-id → mcp__context7__query-docs
```

**When to use**: Supabase, React, YooKassa, grammY, Vite, Zod, Radix UI APIs

---

## Health Workflows Pattern (5% of cases)

Slash commands: `/health-bugs`, `/health-security`, `/health-cleanup`, `/health-deps`

Follow command-specific instructions. See `docs/Agents Ecosystem/AGENT-ORCHESTRATION.md`.

---

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
- Project: Symancy / MegaCampusAI (ref: `johspxgvkbrysxhilmbg`)
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
