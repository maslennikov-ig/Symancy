# Plan: sym-tks — Mood Diary: UI + Backend

## Context

**Beads task**: sym-tks (P2, feature)
**Blocks**: sym-1mw (Mood visualization & charts)

Symancy — Telegram Mini App для гадания на кофейной гуще. Дневник настроения обогащает пользовательские данные: оценка настроения, эмоции и заметки используются AI-интерпретатором для персонализации гаданий, ежедневных инсайтов и рекомендаций. Это повышает вовлечённость и ценность продукта.

---

## Scope

### Включено в задачу
1. Database: таблица `mood_entries` + RLS + RPC
2. Frontend: страница `/mood` (форма ввода + календарь)
3. Frontend: MoodPromptCard на Home-странице
4. Frontend: сервис `moodService.ts` + хук `useMoodEntry.ts`
5. Backend: команда `/mood` в Telegram-боте (grammY inline keyboard)
6. i18n: все ключи на 3 языка (ru, en, zh)

### Не включено (будет в sym-1mw)
- Графики трендов (Recharts)
- Корреляция настроение/символы
- Timeline активности

---

## Implementation Plan

### Task 1: Database Migration

**File**: `supabase/migrations/20260217000001_create_mood_entries.sql`

**Таблица `mood_entries`**:
- `id` UUID PK
- `unified_user_id` UUID NOT NULL FK → unified_users(id) ON DELETE CASCADE
- `date` DATE NOT NULL DEFAULT CURRENT_DATE
- `score` SMALLINT NOT NULL CHECK (1-10)
- `emotions` TEXT[] NOT NULL DEFAULT '{}'
- `note` TEXT CHECK (char_length <= 500)
- `source` TEXT NOT NULL DEFAULT 'mini_app' CHECK IN ('telegram', 'web', 'mini_app')
- `created_at`, `updated_at` TIMESTAMPTZ
- UNIQUE(unified_user_id, date) — enables UPSERT

**Indexes**:
- `idx_mood_entries_user_date ON (unified_user_id, date DESC)` — calendar queries
- `idx_mood_entries_score ON (score)` — AI correlation queries

**Trigger**: reuse `update_updated_at_column()` function

**RLS Policies** (pattern from `daily_insights`):
- Supabase Auth: `FOR ALL USING/WITH CHECK (unified_user_id IN (SELECT id FROM unified_users WHERE auth_id = (SELECT auth.uid())))`
- Telegram JWT: `FOR ALL USING/WITH CHECK (unified_user_id IN (SELECT id FROM unified_users WHERE telegram_id = ((SELECT auth.jwt()) ->> 'telegram_user_id')::bigint))`
- Service role: `FOR ALL USING ((SELECT auth.role()) = 'service_role')`

**RPC function `upsert_mood_entry`** (SECURITY DEFINER) — resolves `unified_user_id` from auth context (auth.uid() или JWT telegram_user_id), выполняет UPSERT. Нужен потому что фронтенд-клиент не знает свой `unified_user_id`.

**Subagent**: `database-architect`

### Task 2: TypeScript Types + Frontend Service

**New file**: `src/types/mood.ts`
```
EmotionTag type (union of 12 string literals)
MoodEntry interface
MoodEntryInput interface
```

**New file**: `src/services/moodService.ts`
- Pattern: `historyService.ts` — uses `getStoredToken()` + `createSupabaseWithToken()` for Telegram JWT
- `saveTodayMood(input)` — calls RPC `upsert_mood_entry`
- `getTodayMood()` — .from('mood_entries').select().eq('date', today).maybeSingle()
- `getMoodHistory(startDate?, endDate?)` — date range query for calendar
- `getMoodStats(days)` — avg score + top emotions for period

**New file**: `src/hooks/useMoodEntry.ts`
- Returns `{ todayEntry, isLoading, save, error, refetch }`
- Fetches today's entry on mount, provides save function

**Subagent**: `react-vite-specialist`

### Task 3: Mood Entry Page UI

**New files**:
- `src/pages/Mood/index.tsx` — page controller with tabs (Entry / Calendar)
- `src/pages/Mood/MoodEntryForm.tsx` — score picker + emotions + note
- `src/components/features/mood/MoodScorePicker.tsx` — row of 10 circular buttons (red→green gradient)
- `src/components/features/mood/EmotionTagGrid.tsx` — 3-column grid of toggle pills (emoji + label)

**Telegram integration**:
- `useMainButton` (`src/hooks/useMainButton.ts`) — "Save" / "Update" button, show/hide based on changes
- `useBackButton` (`src/hooks/useBackButton.ts`) — navigate back to `/`
- `hapticFeedback.selection()` on score/emotion toggle
- `hapticFeedback.notification('success')` on save

**Route in App.tsx**:
```tsx
const Mood = lazy(() => import('./pages/Mood'));
// ...
<Route path="/mood" element={withAppLayout(<Mood language={language} t={t} />)} />
```

**12 Emotions (6 positive + 6 negative)**:

| ID | Emoji | RU | EN | ZH |
|---|---|---|---|---|
| happy | (smile) | Радость | Happy | 快乐 |
| calm | (relieved) | Спокойствие | Calm | 平静 |
| grateful | (pray) | Благодарность | Grateful | 感恩 |
| energetic | (lightning) | Энергия | Energetic | 精力充沛 |
| loved | (heart) | Любовь | Loved | 被爱 |
| hopeful | (rainbow) | Надежда | Hopeful | 充满希望 |
| anxious | (worried) | Тревога | Anxious | 焦虑 |
| sad | (pensive) | Грусть | Sad | 悲伤 |
| angry | (angry) | Злость | Angry | 生气 |
| tired | (weary) | Усталость | Tired | 疲惫 |
| stressed | (exploding) | Стресс | Stressed | 有压力 |
| lonely | (person) | Одиночество | Lonely | 孤独 |

**Subagent**: `react-vite-specialist`

### Task 4: Mood Calendar View

**New files**:
- `src/pages/Mood/MoodCalendar.tsx` — monthly grid with month navigation
- `src/pages/Mood/MoodDayDetail.tsx` — card/overlay for tapped day
- `src/pages/Mood/MoodStats.tsx` — weekly avg, monthly avg, streak, top emotion
- `src/components/features/mood/CalendarGrid.tsx` — pure calendar UI
- `src/components/features/mood/MoodDot.tsx` — colored dot (score→color)

**Calendar design**:
- Month nav: `< February 2026 >`
- Localized day headers (Mo-Su)
- Colored dots: score 1-3 red, 4-6 yellow, 7-10 green
- Today ring highlight
- Tap day → MoodDayDetail
- Mini stats below calendar

**Subagent**: `react-vite-specialist`

### Task 5: Home Page Integration

**New file**: `src/components/features/mood/MoodPromptCard.tsx`
- Pattern: `DailyInsightCard` (gradient card, React.memo)
- Not logged today → "How are you feeling?" + navigate to `/mood`
- Already logged → "Today: 8/10" + emotion pills + "View Diary" link
- Uses `useMoodEntry` hook
- Gradient: purple-violet (distinct from brown DailyInsightCard)

**Modify**: `src/pages/Home.tsx`
- Import MoodPromptCard
- Place between DailyInsightCard and QuickActions

**Modify**: `src/components/features/home/QuickActions.tsx`
- Add 3rd button "Log Mood" → navigate to `/mood`
- Keep `grid-cols-2`, add row with full-width mood button below OR switch to 3-column

**Subagent**: `react-vite-specialist`

### Task 6: Telegram Bot /mood Command

**New files**:
- `symancy-backend/src/modules/mood/handler.ts` — command + callback handlers
- `symancy-backend/src/modules/mood/keyboards.ts` — inline keyboard builders

**Flow**:
1. User sends `/mood` → bot shows score keyboard (2 rows: 1-5, 6-10 with emoji)
2. User taps score → `mood:score:{n}` callback → bot shows emotion picker (toggle grid)
3. User selects emotions → taps "Done" or "Skip" → `mood:emo:confirm`/`mood:emo:skip`
4. Bot saves to DB via service_role Supabase client (resolve unified_user via telegram_id)
5. Bot confirms: "Mood saved! Score: 7/10, Emotions: calm, grateful"

**Modify**: `symancy-backend/src/modules/router/index.ts`
- Import mood handlers
- Add `bot.command("mood", ...)` (after /link, ~line 276)
- Add `mood:` callback routing in `callback_query:data` handler (~line 355)
- Add to bot commands menu: `{ command: "mood", description: "Записать настроение" }`

**In-memory flow state** (Map<telegramUserId, {score, emotions[]}>):
- Acceptable — mood flow takes seconds, restart loses only active flow
- Auto-cleanup after save/confirm

**Subagent**: `node-backend-specialist`

### Task 7: i18n Keys

**Modify**: `src/lib/i18n.ts`
- ~40 new keys across all 3 languages (ru, en, zh)
- Categories: navigation, mood entry, emotions (12), calendar, stats, errors
- Type-safe: all keys in `en` section, mirrored to `ru` and `zh`

**Subagent**: direct execution (or part of react-vite-specialist tasks)

---

## Existing Code to Reuse

| What | File | Why |
|---|---|---|
| RLS policy pattern | `supabase/migrations/20260104000000_create_daily_insights.sql` | Exact pattern for USING/WITH CHECK with unified_users |
| Supabase client + Telegram JWT | `src/lib/supabaseClient.ts` (createSupabaseWithToken) | Auth-aware client |
| Service pattern | `src/services/historyService.ts` | getStoredToken + createSupabaseWithToken pattern |
| MainButton hook | `src/hooks/useMainButton.ts` | Declarative MainButton control with cleanup |
| BackButton hook | `src/hooks/useBackButton.ts` | Back navigation |
| Telegram haptics | `src/hooks/useTelegramWebApp.ts` | hapticFeedback.selection/impact/notification |
| Card UI pattern | `src/components/features/home/DailyInsightCard.tsx` | Gradient card with memo |
| QuickActions pattern | `src/components/features/home/QuickActions.tsx` | Button grid + haptics |
| AppLayout wrapper | `src/components/layout/AppLayout.tsx` | withAppLayout for routes |
| Router callback pattern | `symancy-backend/src/modules/router/index.ts` | prefix-based callback routing |
| Keyboard pattern | `symancy-backend/src/modules/photo-analysis/` | InlineKeyboard builder |

---

## Execution Order

```
Task 1: DB Migration           ← database-architect
Task 2: Types + Service + Hook ← react-vite-specialist
Task 3: Mood Entry Page UI     ← react-vite-specialist (depends on T2)
Task 4: Calendar View          ← react-vite-specialist (depends on T2)
Task 5: Home Integration       ← react-vite-specialist (depends on T2)
Task 6: Bot /mood command      ← node-backend-specialist (depends on T1)
Task 7: i18n keys              ← integrated into T3-T5

T1 and T2 can run in parallel.
T3, T4, T5 depend on T2, can run in parallel after T2.
T6 depends on T1 (table must exist).
```

---

## Verification

1. **DB**: Apply migration via Supabase MCP → verify table exists, RLS policies, RPC function
2. **Type-check**: `pnpm type-check` — all new files compile
3. **Build**: `pnpm build` — no build errors
4. **Frontend manual**: Open Mini App → Home → MoodPromptCard visible → tap → /mood page → enter score + emotions + note → save via MainButton → see entry in calendar
5. **Bot**: Send `/mood` to bot → score keyboard → select → emotion picker → confirm → entry saved → verify in DB
6. **Calendar**: Navigate to Calendar tab → see colored dots → tap day → see detail
7. **i18n**: Switch to en/zh → all mood UI translated
