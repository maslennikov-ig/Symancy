# Plan: Базовый мониторинг и алерты (sym-l4e)

## Context

По ТЗ (TZ_EXTENDED_MVP) предусмотрен мониторинг: "Posthog (analytics) + Sentry (errors) + Uptime Robot". Пользователь выбрал уровень "базовый" -- uptime + алерты + логи. Сейчас в проекте уже есть: health check endpoint, structured logging (Pino), Telegram-алерты на ошибки (admin-alerts.ts), deploy-уведомления в Telegram. Нет: Sentry (error tracking), uptime-мониторинга (внешний сервис), виджета здоровья системы в admin-панели.

## Что будет сделано

1. Sentry для backend (Node.js)
2. Sentry для frontend (React)
3. Виджет здоровья системы в admin-панели
4. Инструкция по настройке UptimeRobot (внешний сервис, без кода)

---

## 1. Backend Sentry

### 1.1 Установка
```bash
cd symancy-backend && pnpm add @sentry/node
```

### 1.2 Новый файл: `symancy-backend/src/core/sentry.ts`
- `initSentry()` -- lazy init с проверкой `SENTRY_DSN`
- `captureException(error, context?)` -- обёртка
- `captureMessage(message, level?)` -- обёртка
- Graceful degradation когда DSN не задан

### 1.3 Env-переменная
**Файл:** `symancy-backend/src/config/env.ts`
- Добавить `SENTRY_DSN: z.string().url().optional()` в `EnvSchema`

### 1.4 Инициализация
**Файл:** `symancy-backend/src/app.ts`
- Вызвать `initSentry()` в `main()` сразу после `setupProcessErrorHandlers()` (строка ~286)
- Добавить `Sentry.close(2000)` в `shutdown()` перед `process.exit`

### 1.5 Интеграция с существующими обработчиками
**Файл:** `symancy-backend/src/core/logger.ts`
- В `setupProcessErrorHandlers()` добавить `captureException` для `uncaughtException` и `unhandledRejection`

**Файл:** `symancy-backend/src/utils/admin-alerts.ts`
- В `sendErrorAlert()` добавить `captureException(error, context)` -- дублирование ошибок в Sentry

---

## 2. Frontend Sentry

### 2.1 Установка
```bash
pnpm add @sentry/react   # в корне проекта
```

### 2.2 Новый файл: `src/lib/sentry.ts`
- `initSentry()` -- init с `VITE_SENTRY_DSN`, `browserTracingIntegration`
- `captureException(error, context?)` -- обёртка

### 2.3 Инициализация
**Файл:** `src/main.tsx`
- Вызвать `initSentry()` перед `initTelegramWebApp()`

### 2.4 ErrorBoundary
**Файл:** `src/components/ErrorBoundary.tsx`
- Заменить TODO на строке 39 вызовом `captureException(error, { componentStack })`

### 2.5 TypeScript типы
**Файл:** `src/vite-env.d.ts`
- Добавить `readonly VITE_SENTRY_DSN?: string` в `ImportMetaEnv`

### 2.6 CI/CD
**Файл:** `.github/workflows/deploy.yml`
- Добавить `VITE_SENTRY_DSN: ${{ secrets.VITE_SENTRY_DSN }}` в env шага build

---

## 3. Admin Dashboard: виджет здоровья

### 3.1 Новый компонент: `src/admin/components/SystemHealthWidget.tsx`
- Fetch `${VITE_API_URL}/health` (паттерн: `import.meta.env.VITE_API_URL || ''`)
- Отображает: общий статус (ok/degraded/error) с цветным Badge
- Чеки: database, queue, webhook -- каждый со своим индикатором
- Uptime из `/version`
- Авто-обновление каждые 30 сек
- Использует существующие компоненты: `Card`, `Badge`, `CardHeader`, `CardContent` из shadcn/ui

### 3.2 Расширение DashboardPage
**Файл:** `src/admin/pages/DashboardPage.tsx`
- Добавить `SystemHealthWidget` между stats grid и `PaymentCancellationStats`
- Добавить stat-карточку "Ошибки за 24ч" -- запрос `analysis_history` с `status='failed'`

### 3.3 i18n ключи
**Файл:** `src/lib/i18n.ts`
- Добавить во все 3 локали (en, ru, zh):
  - `admin.monitoring.systemHealth` / `admin.monitoring.status` / `admin.monitoring.uptime`
  - `admin.monitoring.database` / `admin.monitoring.queue` / `admin.monitoring.webhook`
  - `admin.monitoring.statusOk` / `admin.monitoring.statusDegraded` / `admin.monitoring.statusError`
  - `admin.monitoring.errorsToday` / `admin.monitoring.autoRefresh`

---

## 4. UptimeRobot (без кода)

Внешний сервис, free tier (50 мониторов, 5 мин интервал). Настройка:

| Монитор | URL | Тип | Интервал |
|---------|-----|-----|----------|
| Frontend | `https://symancy.ru` | HTTP(s) | 5 мин |
| Backend Health | Backend URL + `/health` | Keyword: `"status":"ok"` | 5 мин |

Алерты: Telegram contact через UptimeRobot Telegram бот.
Это конфигурация в веб-интерфейсе UptimeRobot, без изменений в коде.

---

## Порядок выполнения

1. Backend Sentry (разделы 1.1-1.5)
2. Frontend Sentry (разделы 2.1-2.6) -- параллельно с п.1
3. Admin Dashboard виджет (разделы 3.1-3.3) -- после п.1-2
4. UptimeRobot -- ручная настройка, без кода

## Файлы (сводка)

| Файл | Действие |
|------|----------|
| `symancy-backend/package.json` | +`@sentry/node` |
| `symancy-backend/src/core/sentry.ts` | **NEW** |
| `symancy-backend/src/config/env.ts` | +`SENTRY_DSN` |
| `symancy-backend/src/app.ts` | init + shutdown flush |
| `symancy-backend/src/core/logger.ts` | +captureException |
| `symancy-backend/src/utils/admin-alerts.ts` | +captureException |
| `package.json` (root) | +`@sentry/react` |
| `src/lib/sentry.ts` | **NEW** |
| `src/main.tsx` | +initSentry() |
| `src/components/ErrorBoundary.tsx` | replace TODO |
| `src/vite-env.d.ts` | +VITE_SENTRY_DSN |
| `.github/workflows/deploy.yml` | +VITE_SENTRY_DSN env |
| `src/admin/components/SystemHealthWidget.tsx` | **NEW** |
| `src/admin/pages/DashboardPage.tsx` | +widget +error stat |
| `src/lib/i18n.ts` | +monitoring keys x3 |

## Существующий код для повторного использования

- `sendErrorAlert()` / `sendAdminAlert()` -- `symancy-backend/src/utils/admin-alerts.ts`
- `getEnv()` / env validation -- `symancy-backend/src/config/env.ts`
- `getLogger()` / `setupProcessErrorHandlers()` -- `symancy-backend/src/core/logger.ts`
- `PaymentCancellationStats` как паттерн виджета -- `src/admin/components/PaymentCancellationStats.tsx`
- `VITE_API_URL` -- уже используется в `src/services/authService.ts`, `src/pages/Chat.tsx`
- `useAdminTranslations()` -- `src/admin/hooks/useAdminTranslations.ts`
- `StatsCard`, `ChartCard` -- `src/admin/components/`

## Верификация

1. `cd symancy-backend && pnpm type-check && pnpm build` -- backend компилируется
2. `pnpm type-check && pnpm build` -- frontend компилируется
3. Без `SENTRY_DSN` -- приложение стартует нормально, в логах: "Sentry disabled"
4. С `SENTRY_DSN` -- тестовая ошибка видна в Sentry dashboard
5. Admin-панель `/admin` -- виджет здоровья отображает статус, автообновляется
6. `ErrorBoundary` -- при ошибке React-компонента ошибка попадает в Sentry

## Env-переменные для настройки

После реализации нужно:
1. Создать Sentry проекты (frontend + backend) на sentry.io (free tier)
2. Добавить `SENTRY_DSN` в `/var/www/symancy-backend/shared/.env`
3. Добавить `VITE_SENTRY_DSN` в GitHub Secrets
4. Зарегистрироваться на uptimerobot.com и добавить мониторы
