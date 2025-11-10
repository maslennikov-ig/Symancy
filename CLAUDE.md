# Agent Orchestration Rules

> **IMPORTANT**: This file overrides default Claude Code behavior. Follow these rules strictly.

## Main Pattern: You Are The Orchestrator

This is the DEFAULT pattern used in 95% of cases for feature development, bug fixes, refactoring, and general coding tasks.

### Core Rules

**1. GATHER FULL CONTEXT FIRST (MANDATORY)**

Before delegating or implementing any task:
- Read existing code in related files
- Search codebase for similar patterns and implementations
- Review relevant documentation files (specs, design docs, ADRs)
- Check recent commits that touched related areas
- Understand dependencies and integration points

NEVER delegate or implement blindly. We often have prior research, implementations, or documentation that prevents duplicate work or conflicting approaches.

**2. DELEGATE TO SUBAGENTS**

- Provide complete context to subagent (code snippets, file paths, patterns, documentation references)
- Specify exact expected output and validation criteria
- After subagent completes, verify results yourself (read modified files, run type-check)
- If results incorrect, re-delegate with corrections and error context
- If TypeScript errors after changes, re-delegate to same subagent with type errors OR delegate to typescript-types-specialist for complex type issues

**3. EXECUTE DIRECTLY (MINIMAL CHANGES ONLY)**

Execute directly without subagent for trivial tasks:
- Single dependency installation (npm install)
- Single-line code fixes (typos, obvious bugs)
- Simple import additions
- Minimal configuration changes

For anything beyond minimal changes, delegate to appropriate subagent.

**4. TRACK PROGRESS WITH TODOWRITE**

- Create todos at task start
- Mark in_progress BEFORE starting each task
- Mark completed IMMEDIATELY after validation
- Determine task granularity yourself based on complexity

**5. COMMIT STRATEGY**

Run `/push patch` after EACH completed task (not batched):
- Mark task [X] in tasks.md
- Add artifacts to task description: `→ Artifacts: [file1](path), [file2](path)`
- Update TodoWrite to completed
- Then `/push patch`

Rationale: Atomic commits, detailed history, easy rollback, better review.

The `/push` command handles:
- Version bumping (patch/minor/major)
- Changelog generation
- Git operations (commit, tag, push)
- Proper commit message formatting

**6. EXECUTION PATTERN**

```
FOR EACH TASK:
1. Read task description
2. GATHER FULL CONTEXT (code + docs + patterns + history + research)
3. Delegate to subagent OR execute directly (trivial only)
4. Verify implementation (read files + run type-check)
5. Accept/reject loop (re-delegate if needed)
6. Update TodoWrite to completed
7. Mark task [X] in tasks.md + add artifacts
8. Run /push patch
9. Move to next task
```

**7. HANDLING CONTRADICTIONS**

If you encounter contradictions between rules, documentation, or best practices:
- First, gather all relevant context
- Analyze if you can resolve based on project patterns and conventions
- If truly ambiguous or critical decision, ask user with specific options
- Only ask when genuinely unable to determine best practice (rare, ~10% of cases)

### Planning Phase (ALWAYS First)

Before implementing any tasks:
- Analyze task execution model (parallel/sequential)
- Assign executors (existing subagents or meta-agent for creation)
- Resolve research questions (simple: solve now, complex: deepresearch prompt)
- Apply atomicity rule: 1 task = 1 agent invocation

See speckit.implement.md for detailed workflow.

---

## Health Workflows Pattern (5% of cases)

For automated health checks via slash commands:
- `/health-bugs` - Bug detection and fixing
- `/health-security` - Security vulnerability scanning
- `/health-cleanup` - Dead code removal
- `/health-deps` - Dependency management

These commands use agent-based orchestration with plan files and worker coordination. Follow command-specific instructions when invoked.

See `docs/Agents Ecosystem/AGENT-ORCHESTRATION.md` for detailed architecture.

---

## Project Conventions

**File Organization**:
- Agents: `.claude/agents/{domain}/{orchestrators|workers}/`
- Commands: `.claude/commands/`
- Skills: `.claude/skills/{skill-name}/SKILL.md`
- Temporary files: `.tmp/current/` (git ignored)
- Reports: `docs/reports/{domain}/{YYYY-MM}/`

**Code Standards**:
- Type-check must pass before commit
- Build must pass before commit
- No hardcoded credentials

**Agent Selection**:
- Use Worker when: Plan file specifies nextAgent (health workflows only)
- Use Skill when: Reusable utility function, no state needed, <100 lines

**Supabase Operations**:
- Use Supabase MCP when `.mcp.json` includes supabase server
- Project: MegaCampusAI (ref: `diqooqbuchsliypgwksu`)
- Migrations: `packages/course-gen-platform/supabase/migrations/`

**MCP Configuration**:
- BASE (`.mcp.base.json`): context7 + sequential-thinking (~600 tokens)
- FULL (`.mcp.full.json`): + supabase + playwright + n8n + shadcn (~5000 tokens)
- Switch with `./switch-mcp.sh`

---

## Reference Docs

- Agent-based orchestration details: `docs/Agents Ecosystem/AGENT-ORCHESTRATION.md`
- Architecture patterns: `docs/Agents Ecosystem/ARCHITECTURE.md`
- Quality gates: `docs/Agents Ecosystem/QUALITY-GATES-SPECIFICATION.md`
- Report templates: `docs/Agents Ecosystem/REPORT-TEMPLATE-STANDARD.md`

## Active Technologies
- File system - markdown documents in `specs/001-landing-n8n-improvements/` directory (001-landing-n8n-improvements)

## Recent Changes
- 001-landing-n8n-improvements: Added File system - markdown documents in `specs/001-landing-n8n-improvements/` directory
