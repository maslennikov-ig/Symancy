# Tasks: Phase 005 - Shared Types Package

**Input**: Technical debt from Phase 004 code review (MEDIUM-6)
**Goal**: Create `@symancy/shared-types` package to eliminate type drift between frontend and backend

## Summary

| Phase | Tasks | Description |
|-------|-------|-------------|
| Phase 1 | T001-T003 | Setup pnpm workspace |
| Phase 2 | T004-T007 | Create shared-types package |
| Phase 3 | T008-T012 | Migrate types and schemas |
| Phase 4 | T013-T016 | Update imports |
| Phase 5 | T017-T019 | Verification |

---

## Phase 1: Setup pnpm Workspace

- [x] T001 Create `pnpm-workspace.yaml` with packages/* pattern
  → Artifacts: [pnpm-workspace.yaml](../../pnpm-workspace.yaml)
- [x] T002 Update root `package.json` - add workspace scripts
  → Artifacts: [package.json](../../package.json)
- [x] T003 Verify workspace recognition with `pnpm list -r`

---

## Phase 2: Create Shared Types Package

- [x] T004 Create `packages/shared-types/package.json`
  → Artifacts: [package.json](../../packages/shared-types/package.json)
- [x] T005 Create `packages/shared-types/tsconfig.json`
  → Artifacts: [tsconfig.json](../../packages/shared-types/tsconfig.json)
- [x] T006 Create `packages/shared-types/src/index.ts` (main entry)
  → Artifacts: [index.ts](../../packages/shared-types/src/index.ts)
- [x] T007 Add `@symancy/shared-types` as workspace dependency to frontend and backend
  → Artifacts: [package.json](../../package.json), [symancy-backend/package.json](../../symancy-backend/package.json)

---

## Phase 3: Migrate Types and Schemas

- [x] T008 Move Zod schemas from `symancy-backend/src/types/omnichannel.ts` to `packages/shared-types/src/schemas/`
  → Artifacts: [enums.ts](../../packages/shared-types/src/schemas/enums.ts), [entities.ts](../../packages/shared-types/src/schemas/entities.ts), [requests.ts](../../packages/shared-types/src/schemas/requests.ts)
- [x] T009 Create pure TypeScript types export (inferred from Zod) for frontend compatibility
- [x] T010 Move type guards and helper functions to shared package
  → Artifacts: [guards/index.ts](../../packages/shared-types/src/guards/index.ts)
- [x] T011 Move error codes and constants to shared package
  → Artifacts: [constants/errors.ts](../../packages/shared-types/src/constants/errors.ts)
- [x] T012 Export both schemas (for validation) and types (for type-checking)

---

## Phase 4: Update Imports

- [x] T013 Update `symancy-backend/src/types/omnichannel.ts` to re-export from shared
  → Artifacts: [omnichannel.ts](../../symancy-backend/src/types/omnichannel.ts)
- [x] T014 Update all backend imports to use `@symancy/shared-types`
  → Note: Re-exports maintain backwards compatibility
- [x] T015 Update `src/types/omnichannel.ts` to re-export from shared
  → Artifacts: [omnichannel.ts](../../src/types/omnichannel.ts)
- [x] T016 Update all frontend imports (if any direct imports exist)
  → Note: Re-exports maintain backwards compatibility

---

## Phase 5: Verification

- [x] T017 Run `pnpm type-check` in root (all packages)
  → Result: PASSED (shared-types, symancy-backend)
- [x] T018 Run `pnpm build` in all packages
  → Result: PASSED (shared-types, symancy-backend, frontend)
- [x] T019 Verify no duplicate type definitions remain
  → Result: VERIFIED - frontend (12 lines) and backend (9 lines) now re-export from shared-types (501 lines)

---

## Package Structure

```
packages/
  shared-types/
    package.json
    tsconfig.json
    src/
      index.ts           # Main entry - exports everything
      schemas/
        enums.ts         # Zod enum schemas
        entities.ts      # Zod entity schemas
        requests.ts      # Zod request/response schemas
      types/
        index.ts         # Re-export inferred types
      guards/
        index.ts         # Type guard functions
      constants/
        errors.ts        # Error codes
```

## Dependencies

- `zod`: ^4.2.1 (same as backend)

## Exports Strategy

```typescript
// packages/shared-types/src/index.ts

// Zod Schemas (for runtime validation in backend)
export * from './schemas/enums';
export * from './schemas/entities';
export * from './schemas/requests';

// Pure Types (inferred from Zod, for type-checking)
export type { UnifiedUser, Message, Conversation, ... } from './schemas/entities';

// Type Guards (for runtime checks in both)
export * from './guards';

// Constants
export * from './constants/errors';
```

## Usage After Migration

```typescript
// Backend - uses Zod schemas for validation
import { UnifiedUserSchema, SendMessageRequestSchema } from '@symancy/shared-types';

const user = UnifiedUserSchema.parse(data);

// Frontend - uses pure types
import type { UnifiedUser, SendMessageRequest } from '@symancy/shared-types';

const user: UnifiedUser = await fetchUser();

// Both - uses type guards
import { isValidTelegramAuth } from '@symancy/shared-types';

if (isValidTelegramAuth(data)) {
  // data is TelegramAuthData
}
```
