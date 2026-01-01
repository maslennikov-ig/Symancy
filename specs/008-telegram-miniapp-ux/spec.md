# Telegram Mini App UX Specification

> **Status**: Draft
> **Version**: 0.2.0
> **Author**: Claude Code
> **Created**: 2025-12-31
> **Updated**: 2025-12-31

---

## 0. Current State Analysis

### 0.1 What Already Exists

#### Pages & Routes
| Route | Component | Status | Description |
|-------|-----------|--------|-------------|
| `/` | App.tsx | ✅ Done | Image uploader, analysis results, history, pricing |
| `/chat` | Chat.tsx | ✅ Done | Full-screen omnichannel chat |
| `/pricing` | Pricing.tsx | ✅ Done | Tariff display |
| `/payment-success` | PaymentSuccess.tsx | ✅ Done | Payment confirmation |
| `/payment-result` | PaymentResult.tsx | ✅ Done | Payment result handler |
| `/terms` | Terms.tsx | ✅ Done | Legal terms |
| `/contacts` | Contacts.tsx | ✅ Done | Contact info |
| `/link/*` | Link/* | ✅ Done | Account linking flow (5 states) |
| `/admin/*` | Admin/* | ✅ Done | Admin panel (8 pages) |

#### Telegram Integration (useTelegramWebApp.ts)
| Feature | Status | Notes |
|---------|--------|-------|
| WebApp initialization | ✅ Done | Early init in main.tsx |
| Theme params binding | ✅ Done | CSS variables sync |
| Safe area insets | ✅ Done | Bot API 8.0+ |
| Viewport tracking | ✅ Done | Stable + dynamic height |
| Haptic feedback | ✅ Done | impact, notification, selection |
| MainButton | ✅ Done | Basic support |
| BackButton | ✅ Done | Basic support |
| Popup/Alert/Confirm | ✅ Done | Native dialogs |
| User data extraction | ✅ Done | id, name, language, premium |
| Color scheme | ✅ Done | Light/dark detection |

#### Authentication
| Method | Status | Notes |
|--------|--------|-------|
| Telegram WebApp initData | ✅ Done | Auto-login |
| Telegram Login Widget | ✅ Done | Web fallback |
| Supabase OAuth | ✅ Done | Google, etc. |
| Account linking | ✅ Done | Web ↔ Telegram |

#### Components Library
- **UI (shadcn/ui)**: Button, Card, Input, Dialog, Dropdown, Avatar, Badge, Tabs, Table, etc.
- **Chat**: ChatWindow, MessageBubble, ChannelIndicator
- **Analysis**: ImageUploader, ResultDisplay, ChatOnboarding
- **Payment**: PaymentWidget (YooMoney), TariffSelector, CreditBalance
- **History**: HistoryDisplay with skeletons

#### Services
| Service | Status | Description |
|---------|--------|-------------|
| authService | ✅ Done | Telegram + Supabase auth |
| analysisService | ✅ Done | Coffee cup AI analysis |
| paymentService | ✅ Done | YooMoney integration |
| creditService | ✅ Done | Credit balance management |
| historyService | ✅ Done | Analysis history |

#### i18n
- **Languages**: 3 (ru, en, zh)
- **Keys**: 70+ translations
- **Coverage**: ~90% of UI

### 0.2 What's Missing (This Spec Addresses)

| Feature | Priority | Description |
|---------|----------|-------------|
| Bottom Navigation | P0 | Tab bar for main sections |
| Home Dashboard | P0 | Overview with quick actions |
| Profile Screen | P0 | User settings, account management |
| Photo Analysis Flow | P0 | Dedicated upload → preview → result flow |
| Onboarding | P1 | First-time user experience |
| Daily Insights | P1 | Engagement feature |
| Statistics | P2 | User analytics |
| Advanced Telegram Features | P1 | See Section 3 |

---

## 1. Executive Summary

Текущая реализация Mini App содержит базовый чат-интерфейс и анализ фото. Этот документ определяет полноценный UX для Telegram Mini App "Coffee Cup Psychologist" с учётом:
- Особенностей платформы Telegram Mini Apps
- Пользовательского пути от первого входа до постоянного использования
- Монетизации через кредитную систему
- Вовлечённости через геймификацию и персонализацию

---

## 3. Telegram Mini App Features (Bot API 8.0+)

### 3.1 Feature Matrix — All Available Capabilities

Полный список возможностей Telegram Mini Apps с указанием приоритета для Coffee Cup Psychologist:

#### Core UI Controls

| Feature | Bot API | Status | Priority | Use Case |
|---------|---------|--------|----------|----------|
| **MainButton** | 6.0+ | ✅ Implemented | P0 | Primary CTA на каждом экране |
| **SecondaryButton** | 7.10+ | ❌ Not used | P1 | Вторичное действие (напр. "Пропустить") |
| **BackButton** | 6.0+ | ✅ Implemented | P0 | Навигация назад |
| **SettingsButton** | 7.0+ | ❌ Not used | P1 | Быстрый доступ к настройкам |
| **BottomBar colors** | 7.10+ | ❌ Not used | P1 | Цвет области кнопок |

```typescript
// MainButton with shine effect (Bot API 7.10+)
mainButton.setParams({
  text: 'Начать анализ',
  backgroundColor: '#8B4513',
  textColor: '#FFFFFF',
  hasShineEffect: true,  // Привлекает внимание
  isEnabled: true,
  isVisible: true
});

// SecondaryButton (Bot API 7.10+)
secondaryButton.setParams({
  text: 'Пропустить',
  position: 'bottom',  // 'left' | 'right' | 'top' | 'bottom'
  isVisible: true
});

// SettingsButton
settingsButton.show();
settingsButton.onClick(() => navigate('/profile/settings'));
```

#### Haptic Feedback

| Feature | Bot API | Status | Priority | Use Case |
|---------|---------|--------|----------|----------|
| **impactOccurred** | 6.1+ | ✅ Implemented | P0 | Tap feedback |
| **notificationOccurred** | 6.1+ | ✅ Implemented | P0 | Success/error/warning |
| **selectionChanged** | 6.1+ | ✅ Implemented | P0 | Tab/option change |

```typescript
// Тактильная обратная связь для всех действий
hapticFeedback.impactOccurred('light');    // Легкий тап
hapticFeedback.impactOccurred('medium');   // Нажатие кнопки
hapticFeedback.impactOccurred('heavy');    // Важное действие
hapticFeedback.impactOccurred('rigid');    // Жесткий feedback
hapticFeedback.impactOccurred('soft');     // Мягкий feedback

hapticFeedback.notificationOccurred('success'); // Покупка успешна
hapticFeedback.notificationOccurred('error');   // Ошибка
hapticFeedback.notificationOccurred('warning'); // Предупреждение

hapticFeedback.selectionChanged();  // Смена таба
```

#### Biometric Authentication (Bot API 7.2+)

| Feature | Bot API | Status | Priority | Use Case |
|---------|---------|--------|----------|----------|
| **BiometricManager** | 7.2+ | ❌ Not used | P1 | Защита аккаунта, подтверждение покупок |
| **requestAccess** | 7.2+ | ❌ Not used | P1 | Запрос доступа к биометрии |
| **authenticate** | 7.2+ | ❌ Not used | P1 | Аутентификация пользователя |
| **updateToken** | 7.2+ | ❌ Not used | P2 | Хранение токена в Secure Enclave |

```typescript
// Использование биометрии для подтверждения покупки
import { biometry } from '@telegram-apps/sdk';

// 1. Запрос доступа (один раз)
if (biometry.requestAccess.isAvailable()) {
  const granted = await biometry.requestAccess({
    reason: 'Для защиты ваших покупок'
  });
}

// 2. Аутентификация перед покупкой
if (biometry.authenticate.isAvailable()) {
  const authenticated = await biometry.authenticate({
    reason: 'Подтвердите покупку 500 ₽'
  });
  if (authenticated) {
    await processPayment();
  }
}

// 3. Хранение секретного токена (Secure Enclave)
await biometry.updateToken('user_secret_key_here');
```

**Use Cases для Coffee Cup Psychologist:**
- Подтверждение покупки кредитов (вместо popup)
- Защита приватных данных в истории
- Premium-фича для VIP пользователей

#### Cloud Storage (Bot API 6.9+)

| Feature | Bot API | Status | Priority | Use Case |
|---------|---------|--------|----------|----------|
| **CloudStorage** | 6.9+ | ❌ Not used | P0 | Сохранение настроек, preferences |
| **set/get/delete** | 6.9+ | ❌ Not used | P0 | CRUD операции |
| **getKeys** | 6.9+ | ❌ Not used | P1 | Получение всех ключей |

```typescript
import { cloudStorage } from '@telegram-apps/sdk';

// Сохранение настроек пользователя (синхронизируются между устройствами!)
await cloudStorage.set('user_preferences', JSON.stringify({
  language: 'ru',
  persona: 'arina',
  theme: 'dark',
  notifications: true,
  dailyInsightTime: '09:00'
}));

// Сохранение прогресса онбординга
await cloudStorage.set('onboarding_step', '3');
await cloudStorage.set('onboarding_completed', 'true');

// Получение данных
const prefs = JSON.parse(await cloudStorage.get('user_preferences'));

// Кэширование последнего инсайта
await cloudStorage.set('daily_insight', JSON.stringify({
  date: '2025-12-31',
  text: 'Сегодня благоприятный день...',
  persona: 'arina'
}));
```

**Преимущества Cloud Storage:**
- Синхронизация между устройствами
- Работает offline
- Не требует backend для простых данных
- До 1024 символов на ключ, неограниченное количество ключей

#### QR Scanner (Bot API 6.4+)

| Feature | Bot API | Status | Priority | Use Case |
|---------|---------|--------|----------|----------|
| **QR Scanner** | 6.4+ | ❌ Not used | P2 | Сканирование QR-кодов |

```typescript
import { qrScanner } from '@telegram-apps/sdk';

// Открытие сканера с обработкой результата
const result = await qrScanner.open({
  text: 'Наведите камеру на QR-код'
});

// Или с callback для множественного сканирования
qrScanner.open({
  text: 'Сканируйте QR-код',
  onCapture(qrData) {
    if (qrData.startsWith('coffeecup://')) {
      // Обработка нашего QR
      qrScanner.close();
      handleDeepLink(qrData);
    }
  }
});
```

**Use Cases:**
- QR-код для быстрого добавления друга
- QR-код на физической чашке кофе (партнерства с кофейнями)
- Промо-коды

#### Device Sensors (Bot API 8.0+)

| Feature | Bot API | Status | Priority | Use Case |
|---------|---------|--------|----------|----------|
| **Accelerometer** | 8.0+ | ❌ Not used | P3 | Shake-to-action |
| **Gyroscope** | 8.0+ | ❌ Not used | P3 | 3D effects |
| **DeviceOrientation** | 8.0+ | ❌ Not used | P3 | AR-подобные эффекты |
| **lockOrientation** | 8.0+ | ❌ Not used | P2 | Фиксация ориентации |

```typescript
import { accelerometer, gyroscope, deviceOrientation } from '@telegram-apps/sdk';

// Shake-to-reveal: потрясите телефон для получения инсайта
accelerometer.start({ refreshRate: 30 });
accelerometer.onChange(({ x, y, z }) => {
  const shake = Math.sqrt(x*x + y*y + z*z);
  if (shake > 20) {
    revealDailyInsight();
    hapticFeedback.notificationOccurred('success');
  }
});

// AR-эффект для кофейной чашки (наклон телефона)
deviceOrientation.start();
deviceOrientation.onChange(({ alpha, beta, gamma }) => {
  // 3D поворот виртуальной чашки
  setCupRotation({ x: beta, y: gamma, z: alpha });
});

// Фиксация ориентации при анализе фото
lockOrientation('portrait');
```

#### Full-Screen Mode (Bot API 8.0+)

| Feature | Bot API | Status | Priority | Use Case |
|---------|---------|--------|----------|----------|
| **requestFullscreen** | 8.0+ | ❌ Not used | P1 | Immersive experience |
| **exitFullscreen** | 8.0+ | ❌ Not used | P1 | Выход из fullscreen |
| **safeAreaInset** | 8.0+ | ✅ Implemented | P0 | Отступы для notch |
| **contentSafeAreaInset** | 8.0+ | ✅ Implemented | P0 | Отступы контента |

```typescript
import { requestFullscreen, exitFullscreen } from '@telegram-apps/sdk';

// Fullscreen для иммерсивного анализа
const startImmersiveAnalysis = async () => {
  await requestFullscreen();
  lockOrientation('portrait');
  // ... показать красивую анимацию анализа
};

// Выход из fullscreen
const finishAnalysis = async () => {
  await exitFullscreen();
  unlockOrientation();
};
```

#### Home Screen (Bot API 8.0+)

| Feature | Bot API | Status | Priority | Use Case |
|---------|---------|--------|----------|----------|
| **addToHomeScreen** | 8.0+ | ❌ Not used | P1 | Добавление на рабочий стол |
| **checkHomeScreenStatus** | 8.0+ | ❌ Not used | P1 | Проверка статуса |

```typescript
import { addToHomeScreen, checkHomeScreenStatus } from '@telegram-apps/sdk';

// Проверить, можно ли добавить на рабочий стол
const status = await checkHomeScreenStatus();
// status: 'unsupported' | 'unknown' | 'added' | 'missed'

if (status === 'missed') {
  // Показать промо для добавления
  showAddToHomeScreenPrompt();
}

// Добавить на рабочий стол
await addToHomeScreen();
```

**UX Flow:**
1. После 3-го использования показать popup
2. "Добавьте Coffee Cup на рабочий стол для быстрого доступа"
3. При успехе — бонус +1 кредит

#### Sharing Features

| Feature | Bot API | Status | Priority | Use Case |
|---------|---------|--------|----------|----------|
| **shareToStory** | 7.8+ | ❌ Not used | P1 | Поделиться в Stories |
| **shareMessage** | 8.0+ | ❌ Not used | P2 | Поделиться сообщением |
| **switchInlineQuery** | 6.7+ | ❌ Not used | P2 | Inline режим бота |

```typescript
import { shareToStory } from '@telegram-apps/sdk';

// Поделиться результатом анализа в Stories
const shareAnalysisToStory = async (analysisId: string, imageUrl: string) => {
  await shareToStory(imageUrl, {
    text: '☕ Мой кофейный анализ от @CoffeePsychologistBot',
    widget_link: {
      url: `https://t.me/CoffeePsychologistBot/app?startapp=analysis_${analysisId}`,
      name: 'Попробовать'
    }
  });
};
```

#### Emoji Status (Bot API 8.0+)

| Feature | Bot API | Status | Priority | Use Case |
|---------|---------|--------|----------|----------|
| **setEmojiStatus** | 8.0+ | ❌ Not used | P2 | Установка emoji статуса |
| **requestEmojiStatusAccess** | 8.0+ | ❌ Not used | P2 | Запрос доступа |

```typescript
import { setEmojiStatus, requestEmojiStatusAccess } from '@telegram-apps/sdk';

// После позитивного анализа предложить установить emoji
const suggestEmojiStatus = async () => {
  const access = await requestEmojiStatusAccess();
  if (access) {
    await setEmojiStatus('☕', { duration: 3600 }); // На 1 час
  }
};
```

#### Payments & Invoices

| Feature | Bot API | Status | Priority | Use Case |
|---------|---------|--------|----------|----------|
| **openInvoice** | 6.1+ | ❌ Not used | P0 | Telegram Payments |

```typescript
import { openInvoice } from '@telegram-apps/sdk';

// Открыть платежную форму Telegram (вместо YooMoney)
const purchaseCredits = async (invoiceUrl: string) => {
  const status = await openInvoice(invoiceUrl);
  // status: 'paid' | 'cancelled' | 'failed' | 'pending'

  if (status === 'paid') {
    hapticFeedback.notificationOccurred('success');
    await refreshCredits();
  }
};
```

**Преимущества Telegram Payments:**
- Native UX (Apple Pay, Google Pay)
- Не нужно покидать приложение
- Выше конверсия (до 30% по сравнению с redirect)
- Комиссия 0% для цифровых товаров

#### Privacy & Permissions

| Feature | Bot API | Status | Priority | Use Case |
|---------|---------|--------|----------|----------|
| **requestWriteAccess** | 6.9+ | ❌ Not used | P1 | Разрешение на сообщения |
| **requestContact** | 6.9+ | ❌ Not used | P3 | Запрос номера телефона |

```typescript
import { requestWriteAccess, requestContact } from '@telegram-apps/sdk';

// Запросить разрешение на отправку сообщений (для daily insights)
const enableNotifications = async () => {
  const status = await requestWriteAccess();
  if (status === 'allowed') {
    await cloudStorage.set('notifications_enabled', 'true');
  }
};

// Запрос контакта (опционально, для premium)
const requestUserContact = async () => {
  const shared = await requestContact();
  if (shared) {
    // Получили номер телефона пользователя
  }
};
```

#### Location (Bot API 8.0+)

| Feature | Bot API | Status | Priority | Use Case |
|---------|---------|--------|----------|----------|
| **LocationManager** | 8.0+ | ❌ Not used | P3 | Геолокация |

```typescript
import { locationManager } from '@telegram-apps/sdk';

// Получить локацию для timezone-aware инсайтов
const getUserLocation = async () => {
  await locationManager.init();
  if (locationManager.isInited()) {
    const location = await locationManager.getLocation();
    // { latitude, longitude, altitude, course, speed, ... }
  }
};
```

#### Closing & Navigation Control

| Feature | Bot API | Status | Priority | Use Case |
|---------|---------|--------|----------|----------|
| **enableClosingConfirmation** | 6.2+ | ❌ Not used | P1 | Предупреждение при закрытии |
| **disableVerticalSwipes** | 7.7+ | ❌ Not used | P1 | Отключить swipe-to-close |
| **expand** | 6.0+ | ✅ Implemented | P0 | Развернуть на весь экран |
| **close** | 6.0+ | ✅ Implemented | P0 | Закрыть Mini App |

```typescript
import {
  enableClosingConfirmation,
  disableVerticalSwipes
} from '@telegram-apps/sdk';

// Во время анализа — предупреждать о закрытии
const startAnalysis = () => {
  enableClosingConfirmation();
  disableVerticalSwipes(); // Отключить swipe down to close
};

const finishAnalysis = () => {
  disableClosingConfirmation();
  enableVerticalSwipes();
};
```

#### Links & External Resources

| Feature | Bot API | Status | Priority | Use Case |
|---------|---------|--------|----------|----------|
| **openLink** | 6.1+ | ❌ Not used | P1 | Внешняя ссылка |
| **openTelegramLink** | 6.1+ | ❌ Not used | P1 | Telegram ссылка |
| **readTextFromClipboard** | 6.4+ | ❌ Not used | P3 | Чтение буфера обмена |

```typescript
import { openLink, openTelegramLink } from '@telegram-apps/sdk';

// Открыть ссылку на помощь
openLink('https://coffeecup.help/faq', { tryInstantView: true });

// Открыть канал в Telegram
openTelegramLink('https://t.me/CoffeePsychologistChannel');
```

### 3.2 Recommended Implementation Priority

```
Phase 1 (MVP Enhancement) — Week 1-2
├── CloudStorage — настройки, прогресс
├── SecondaryButton — вторичные действия
├── SettingsButton — быстрый доступ
├── enableClosingConfirmation — защита данных
└── disableVerticalSwipes — UX improvement

Phase 2 (Engagement) — Week 3-4
├── shareToStory — виральность
├── addToHomeScreen — retention
├── requestWriteAccess — notifications
├── Fullscreen mode — immersive analysis
└── Telegram Payments — конверсия

Phase 3 (Premium Features) — Week 5-6
├── BiometricManager — security
├── QR Scanner — partnerships
├── Emoji Status — fun feature
└── Device Sensors — wow-эффекты

Phase 4 (Advanced) — Future
├── Accelerometer — shake gestures
├── Gyroscope — AR effects
├── LocationManager — timezone
└── readTextFromClipboard — promo codes
```

### 3.3 WOW-Features для презентации заказчику

1. **Shake-to-Reveal** — потрясите телефон для получения daily insight
2. **Share to Story** — красивые карточки для Stories с deep link
3. **Biometric Purchase** — Face ID/Touch ID для покупок
4. **Home Screen Shortcut** — иконка на рабочем столе как native app
5. **Cloud Sync** — настройки синхронизируются между устройствами
6. **Fullscreen Analysis** — immersive experience при анализе
7. **Telegram Payments** — Apple Pay/Google Pay одним тапом

---

## 2. User Personas

### 2.1 Новый пользователь (First-timer)
- Пришёл по рекомендации или из бота
- Не знает, как пользоваться приложением
- Нужен онбординг и бесплатный кредит для пробы

### 2.2 Активный пользователь (Regular)
- Регулярно делает анализы кофейной гущи
- Ведёт диалоги с Ариной/Кассандрой
- Покупает кредиты

### 2.3 VIP пользователь (Power User)
- Использует премиум-функции (Cassandra)
- Активно взаимодействует с историей
- Делится результатами

---

## 3. Information Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    TELEGRAM MINI APP                     │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐    │
│  │  Home   │  │  Chat   │  │ History │  │ Profile │    │
│  │ (Main)  │  │         │  │         │  │         │    │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘    │
│       │            │            │            │          │
│       ▼            ▼            ▼            ▼          │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐    │
│  │ Balance │  │ Persona │  │Readings │  │Settings │    │
│  │ Quick   │  │ Select  │  │  List   │  │Language │    │
│  │ Actions │  │ Photo   │  │ Search  │  │ Theme   │    │
│  │ Daily   │  │ Upload  │  │ Filters │  │ Notify  │    │
│  │ Insight │  │ Message │  │ Detail  │  │ Credits │    │
│  └─────────┘  └─────────┘  └─────────┘  │ Account │    │
│                                         │ Link TG │    │
│                                         └─────────┘    │
│                                                          │
├─────────────────────────────────────────────────────────┤
│              [ Bottom Navigation Bar ]                   │
│         🏠 Home   💬 Chat   📜 History   👤 Profile     │
└─────────────────────────────────────────────────────────┘
```

---

## 4. Screen Specifications

### 4.1 Home Screen (Главный экран)

**Назначение**: Точка входа, обзор состояния, быстрые действия

**Layout**:
```
┌─────────────────────────────────────┐
│ ☕ Coffee Cup Psychologist          │
│                            🔔 [3]   │
├─────────────────────────────────────┤
│                                     │
│  ┌─────────────────────────────┐   │
│  │     💰 Ваш баланс           │   │
│  │                              │   │
│  │   ⭐ 5 Basic  💎 2 Pro      │   │
│  │                              │   │
│  │   [  Пополнить баланс  ]    │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │  🌟 Инсайт дня              │   │
│  │                              │   │
│  │  "Сегодня благоприятный     │   │
│  │   день для новых начинаний" │   │
│  │                              │   │
│  │  [Узнать больше →]          │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌──────────┐  ┌──────────┐        │
│  │ 📷       │  │ 💬       │        │
│  │ Новый    │  │ Начать   │        │
│  │ анализ   │  │ чат      │        │
│  └──────────┘  └──────────┘        │
│                                     │
│  ┌─────────────────────────────┐   │
│  │  📜 Последний анализ        │   │
│  │  2 часа назад • Arina       │   │
│  │  "Вижу интересные символы..." │   │
│  │  [Открыть →]                │   │
│  └─────────────────────────────┘   │
│                                     │
├─────────────────────────────────────┤
│  🏠      💬      📜      👤        │
└─────────────────────────────────────┘
```

**Компоненты**:

| Компонент | Описание | Действие |
|-----------|----------|----------|
| Balance Card | Текущий баланс кредитов по типам | Tap → Credits Screen |
| Daily Insight | Персонализированный "гороскоп" | Tap → Chat with insight context |
| Quick Actions | Новый анализ / Начать чат | Tap → Photo Upload / Chat |
| Recent Activity | Последний анализ или чат | Tap → History Detail |
| Notifications Badge | Непрочитанные уведомления | Tap → Notifications |

**Данные**:
- `unified_user_credits` - баланс
- `analysis_history` - последний анализ
- `conversations` - последняя активность
- Daily insight - генерируется ежедневно (можно кэшировать)

---

### 4.2 Chat Screen (Чат)

**Назначение**: Основной интерфейс общения с AI-персоной

**Layout**:
```
┌─────────────────────────────────────┐
│ ← Назад     Arina ☕     ⚙️ Persona │
├─────────────────────────────────────┤
│                                     │
│  ┌─────────────────────────────┐   │
│  │ 👤 Привет! Как дела?        │   │
│  └─────────────────────────────┘   │
│                                     │
│         ┌─────────────────────────┐ │
│         │ ☕ Здравствуй! Рада     │ │
│         │ тебя видеть. Чем могу  │ │
│         │ помочь сегодня?        │ │
│         └─────────────────────────┘ │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ 👤 Хочу узнать про карьеру  │   │
│  └─────────────────────────────┘   │
│                                     │
│         ┌─────────────────────────┐ │
│         │ ☕ Конечно! Давай       │ │
│         │ посмотрим на символы   │ │
│         │ в твоей чашке...       │ │
│         │ [Typing...]            │ │
│         └─────────────────────────┘ │
│                                     │
├─────────────────────────────────────┤
│ [📷] [   Введите сообщение...  ] ➤ │
└─────────────────────────────────────┘
```

**Компоненты**:

| Компонент | Описание | Действие |
|-----------|----------|----------|
| Header | Имя персоны, кнопка смены | Tap persona → Persona Selector |
| Message List | История сообщений | Scroll, Long press → Copy |
| Photo Button | Прикрепить фото | Tap → Camera/Gallery |
| Input Field | Ввод текста | Type + Send |
| Typing Indicator | AI печатает | - |

**Особенности**:
- Realtime через Supabase subscriptions
- Оптимистичные обновления
- Поддержка Markdown в ответах
- Haptic feedback при отправке

**Persona Selector (Bottom Sheet)**:
```
┌─────────────────────────────────────┐
│         Выберите персону            │
├─────────────────────────────────────┤
│  ┌─────────────────────────────┐   │
│  │ ☕ Arina                     │   │
│  │ Тёплая и дружелюбная        │   │
│  │ ⭐ Basic credits            │   │
│  │                    [✓]      │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ 🔮 Cassandra                 │   │
│  │ Мистическая и загадочная    │   │
│  │ 💎 Cassandra credits        │   │
│  │                    [ ]      │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

---

### 4.3 Photo Analysis Flow

**Назначение**: Загрузка фото кофейной чашки для анализа

**Step 1: Photo Capture**
```
┌─────────────────────────────────────┐
│ ← Назад      Новый анализ           │
├─────────────────────────────────────┤
│                                     │
│  ┌─────────────────────────────┐   │
│  │                              │   │
│  │      📷                     │   │
│  │                              │   │
│  │   Сфотографируйте вашу      │   │
│  │   кофейную чашку            │   │
│  │                              │   │
│  │   Переверните чашку на      │   │
│  │   блюдце и подождите        │   │
│  │   несколько минут           │   │
│  │                              │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌──────────────────────────────┐  │
│  │     [ 📷 Сделать фото ]     │  │
│  └──────────────────────────────┘  │
│                                     │
│  ┌──────────────────────────────┐  │
│  │     [ 🖼️ Из галереи ]       │  │
│  └──────────────────────────────┘  │
│                                     │
│  💡 Совет: Хорошее освещение      │
│     улучшает качество анализа      │
│                                     │
└─────────────────────────────────────┘
```

**Step 2: Photo Preview & Persona Selection**
```
┌─────────────────────────────────────┐
│ ← Назад      Предпросмотр           │
├─────────────────────────────────────┤
│                                     │
│  ┌─────────────────────────────┐   │
│  │                              │   │
│  │    [   Photo Preview   ]    │   │
│  │                              │   │
│  │                              │   │
│  └─────────────────────────────┘   │
│              [🔄 Переснять]         │
│                                     │
│  ─────────────────────────────────  │
│                                     │
│  Выберите персону для анализа:     │
│                                     │
│  ┌──────────┐  ┌──────────┐        │
│  │ ☕ Arina  │  │ 🔮 Cass- │        │
│  │          │  │  andra   │        │
│  │  ⭐ 1    │  │  💎 1    │        │
│  │  [✓]     │  │  [ ]     │        │
│  └──────────┘  └──────────┘        │
│                                     │
│  Ваш баланс: ⭐ 5  💎 2            │
│                                     │
├─────────────────────────────────────┤
│       [ ✨ Начать анализ ]          │
└─────────────────────────────────────┘
```

**Step 3: Analysis in Progress**
```
┌─────────────────────────────────────┐
│            Анализ...                │
├─────────────────────────────────────┤
│                                     │
│                                     │
│           ☕                        │
│          ╱  ╲                       │
│         ╱    ╲                      │
│        ╱      ╲                     │
│       ▔▔▔▔▔▔▔▔▔▔                    │
│                                     │
│      ✨ Arina изучает               │
│         вашу чашку...               │
│                                     │
│      ━━━━━━━━━━━━━━━━  75%         │
│                                     │
│      Распознаю символы...          │
│                                     │
│                                     │
└─────────────────────────────────────┘
```

**Step 4: Result**
→ Переход в Chat с результатом анализа

---

### 4.4 History Screen (История)

**Назначение**: Просмотр прошлых анализов и разговоров

**Layout**:
```
┌─────────────────────────────────────┐
│         История                     │
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │ 🔍 Поиск...                     │ │
│ └─────────────────────────────────┘ │
│                                     │
│ [Все] [Анализы] [Чаты]             │
│                                     │
│ ─────────── Сегодня ──────────────  │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ 📷 Анализ кофейной гущи        │ │
│ │ ☕ Arina • 2 часа назад         │ │
│ │ "Вижу символ птицы, который..." │ │
│ │                           [→]  │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ 💬 Разговор с Ариной           │ │
│ │ ☕ Arina • 5 часов назад        │ │
│ │ "Спасибо за совет!"            │ │
│ │                           [→]  │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ─────────── Вчера ────────────────  │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ 📷 Анализ кофейной гущи        │ │
│ │ 🔮 Cassandra • вчера            │ │
│ │ "Древние символы говорят..."   │ │
│ │                           [→]  │ │
│ └─────────────────────────────────┘ │
│                                     │
├─────────────────────────────────────┤
│  🏠      💬      📜      👤        │
└─────────────────────────────────────┘
```

**History Detail (Analysis)**:
```
┌─────────────────────────────────────┐
│ ← Назад      Анализ                 │
├─────────────────────────────────────┤
│                                     │
│  ┌─────────────────────────────┐   │
│  │    [   Coffee Photo   ]     │   │
│  └─────────────────────────────┘   │
│                                     │
│  ☕ Arina • 15 декабря 2025        │
│                                     │
│  ─────────────────────────────────  │
│                                     │
│  🔮 Интерпретация:                 │
│                                     │
│  В вашей чашке я вижу символ       │
│  птицы, который говорит о          │
│  предстоящих переменах и новых     │
│  возможностях в карьере...         │
│                                     │
│  Также заметен символ дороги,      │
│  что может означать путешествие    │
│  или важное решение...             │
│                                     │
│  ─────────────────────────────────  │
│                                     │
│  [💬 Обсудить с Ариной]            │
│  [📤 Поделиться]                   │
│                                     │
└─────────────────────────────────────┘
```

---

### 4.5 Profile Screen (Профиль)

**Назначение**: Настройки пользователя, управление аккаунтом

**Layout**:
```
┌─────────────────────────────────────┐
│         Профиль                     │
├─────────────────────────────────────┤
│                                     │
│         ┌───────┐                   │
│         │  👤   │                   │
│         │ Avatar│                   │
│         └───────┘                   │
│         Иван Иванов                 │
│         @username                   │
│                                     │
│  ═══════════════════════════════   │
│                                     │
│  💰 Баланс                    [→]  │
│     ⭐ 5 Basic  💎 2 Pro           │
│                                     │
│  ─────────────────────────────────  │
│                                     │
│  📊 Статистика                [→]  │
│     12 анализов • 45 сообщений     │
│                                     │
│  ─────────────────────────────────  │
│                                     │
│  ⚙️ Настройки                       │
│                                     │
│     🌐 Язык                   [RU] │
│     🎨 Тема               [Авто]  │
│     🔔 Уведомления           [✓]  │
│                                     │
│  ─────────────────────────────────  │
│                                     │
│  🔗 Привязка аккаунтов              │
│                                     │
│     Telegram              [✓]      │
│     Email                 [+]      │
│                                     │
│  ─────────────────────────────────  │
│                                     │
│  ❓ Помощь                    [→]  │
│  📜 О приложении              [→]  │
│                                     │
├─────────────────────────────────────┤
│  🏠      💬      📜      👤        │
└─────────────────────────────────────┘
```

---

### 4.6 Credits Screen (Баланс и покупки)

**Назначение**: Управление кредитами, покупка пакетов

**Layout**:
```
┌─────────────────────────────────────┐
│ ← Назад      Баланс                 │
├─────────────────────────────────────┤
│                                     │
│  ┌─────────────────────────────┐   │
│  │      💰 Ваш баланс          │   │
│  │                              │   │
│  │  ⭐ 5         💎 2          │   │
│  │  Basic       Cassandra      │   │
│  │  credits     credits        │   │
│  └─────────────────────────────┘   │
│                                     │
│  ═══════════════════════════════   │
│                                     │
│  Пополнить баланс:                 │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ ⭐ 1 Basic анализ           │   │
│  │ Один анализ с Ариной        │   │
│  │                     100 ₽   │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ ⭐ 5 Basic анализов   🔥    │   │
│  │ Пакет из 5 анализов         │   │
│  │ Экономия 100 ₽      400 ₽   │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ 💎 1 Cassandra анализ       │   │
│  │ Мистический анализ          │   │
│  │                     500 ₽   │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ 💎 3 Cassandra анализа 🔥   │   │
│  │ Пакет мистических анализов  │   │
│  │ Экономия 500 ₽     1000 ₽   │   │
│  └─────────────────────────────┘   │
│                                     │
│  ─────────────────────────────────  │
│                                     │
│  📜 История покупок           [→]  │
│                                     │
└─────────────────────────────────────┘
```

---

### 4.7 Onboarding Flow (Первый вход)

**Назначение**: Знакомство нового пользователя с приложением

**Step 1: Welcome**
```
┌─────────────────────────────────────┐
│                                     │
│                                     │
│              ☕                     │
│                                     │
│     Coffee Cup Psychologist         │
│                                     │
│     Узнайте своё будущее           │
│     по кофейной гуще               │
│                                     │
│                                     │
│                                     │
│        ● ○ ○ ○                      │
│                                     │
│     [    Начать    ]               │
│                                     │
└─────────────────────────────────────┘
```

**Step 2: Language Selection**
```
┌─────────────────────────────────────┐
│                                     │
│                                     │
│           🌐                        │
│                                     │
│     Выберите язык                  │
│     Choose language                 │
│     选择语言                        │
│                                     │
│     ┌─────────────────────┐        │
│     │   🇷🇺 Русский       │        │
│     └─────────────────────┘        │
│     ┌─────────────────────┐        │
│     │   🇬🇧 English       │        │
│     └─────────────────────┘        │
│     ┌─────────────────────┐        │
│     │   🇨🇳 中文          │        │
│     └─────────────────────┘        │
│                                     │
│        ○ ● ○ ○                      │
│                                     │
└─────────────────────────────────────┘
```

**Step 3: How It Works**
```
┌─────────────────────────────────────┐
│                                     │
│         ┌─────────────────┐        │
│         │   📷 → ☕ → 🔮  │        │
│         └─────────────────┘        │
│                                     │
│     Как это работает:              │
│                                     │
│     1. Сфотографируйте вашу        │
│        кофейную чашку              │
│                                     │
│     2. AI-персона проанализирует   │
│        символы в гуще              │
│                                     │
│     3. Получите персональную       │
│        интерпретацию               │
│                                     │
│                                     │
│        ○ ○ ● ○                      │
│                                     │
│     [   Продолжить   ]             │
│                                     │
└─────────────────────────────────────┘
```

**Step 4: Free Credit Gift**
```
┌─────────────────────────────────────┐
│                                     │
│                                     │
│              🎁                     │
│                                     │
│     Подарок для вас!               │
│                                     │
│     ┌─────────────────────┐        │
│     │       ⭐ +1          │        │
│     │   Бесплатный анализ  │        │
│     └─────────────────────┘        │
│                                     │
│     Мы дарим вам один              │
│     бесплатный анализ,             │
│     чтобы вы могли попробовать     │
│                                     │
│                                     │
│        ○ ○ ○ ●                      │
│                                     │
│     [   Получить подарок   ]       │
│                                     │
└─────────────────────────────────────┘
```

---

## 5. Navigation Architecture

### 5.1 Bottom Navigation

```typescript
interface NavigationItem {
  id: 'home' | 'chat' | 'history' | 'profile';
  icon: ReactNode;
  label: string;
  route: string;
  badge?: number; // для уведомлений
}

const navigationItems: NavigationItem[] = [
  { id: 'home', icon: '🏠', label: 'Главная', route: '/' },
  { id: 'chat', icon: '💬', label: 'Чат', route: '/chat' },
  { id: 'history', icon: '📜', label: 'История', route: '/history' },
  { id: 'profile', icon: '👤', label: 'Профиль', route: '/profile' },
];
```

### 5.2 Telegram Integration

| Telegram Feature | Usage |
|-----------------|-------|
| `MainButton` | Primary CTA на каждом экране |
| `BackButton` | Навигация назад (кроме Home) |
| `HapticFeedback` | Тактильный отклик на действия |
| `themeParams` | Цвета из темы Telegram |
| `showPopup` | Подтверждения, alerts |
| `showConfirm` | Диалоги подтверждения |
| `openInvoice` | Оплата через Telegram |

### 5.3 Deep Links

```
https://t.me/CoffeePsychologistBot/app?startapp=chat
https://t.me/CoffeePsychologistBot/app?startapp=analysis
https://t.me/CoffeePsychologistBot/app?startapp=history_<id>
https://t.me/CoffeePsychologistBot/app?startapp=credits
```

---

## 6. State Management

### 6.1 Global State

```typescript
interface AppState {
  // Auth
  user: UnifiedUser | null;
  isAuthenticated: boolean;

  // Credits
  credits: {
    basic: number;
    pro: number;
    cassandra: number;
  };

  // Preferences
  language: 'ru' | 'en' | 'zh';
  theme: 'light' | 'dark' | 'auto';
  notificationsEnabled: boolean;

  // Active conversation
  activeConversationId: string | null;
  activePersona: 'arina' | 'cassandra';

  // Onboarding
  onboardingCompleted: boolean;
  freeCreditsGranted: boolean;
}
```

### 6.2 Data Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Supabase   │────▶│   Context   │────▶│ Components  │
│  Realtime   │     │   Providers │     │             │
└─────────────┘     └─────────────┘     └─────────────┘
       ▲                   │
       │                   ▼
┌─────────────┐     ┌─────────────┐
│   Backend   │◀────│   Actions   │
│    API      │     │  (Hooks)    │
└─────────────┘     └─────────────┘
```

---

## 7. API Endpoints Required

### 7.1 New Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/daily-insight` | Инсайт дня для пользователя |
| GET | `/api/stats` | Статистика пользователя |
| POST | `/api/analysis/start` | Начать новый анализ (с фото) |
| GET | `/api/analysis/:id` | Получить результат анализа |
| GET | `/api/history` | История анализов и чатов |
| POST | `/api/onboarding/complete` | Завершить онбординг |
| POST | `/api/credits/grant-free` | Выдать бесплатный кредит |

### 7.2 Existing Endpoints (Keep)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/webapp` | Telegram WebApp auth |
| GET | `/api/auth/me` | Текущий пользователь |
| POST | `/api/conversations` | Создать беседу |
| POST | `/api/messages` | Отправить сообщение |

---

## 8. Component Library

### 8.1 Base Components

```
src/components/
├── ui/                      # shadcn/ui components
│   ├── button.tsx
│   ├── card.tsx
│   ├── input.tsx
│   ├── badge.tsx
│   ├── tabs.tsx
│   ├── bottom-sheet.tsx
│   └── ...
├── layout/
│   ├── BottomNav.tsx        # Bottom navigation
│   ├── Header.tsx           # Screen headers
│   └── SafeArea.tsx         # Telegram safe areas
├── features/
│   ├── chat/                # Chat components
│   ├── analysis/            # Photo analysis flow
│   ├── credits/             # Credits display/purchase
│   ├── history/             # History list/detail
│   └── onboarding/          # Onboarding flow
└── shared/
    ├── CreditBadge.tsx      # Credit balance display
    ├── PersonaSelector.tsx  # Arina/Cassandra picker
    ├── InsightCard.tsx      # Daily insight card
    └── LoadingSpinner.tsx   # Loading states
```

### 8.2 Page Components

```
src/pages/
├── Home.tsx                 # Main dashboard
├── Chat.tsx                 # Chat interface
├── History/
│   ├── index.tsx           # History list
│   └── [id].tsx            # History detail
├── Profile/
│   ├── index.tsx           # Profile main
│   ├── Credits.tsx         # Credits & purchase
│   ├── Settings.tsx        # Settings page
│   └── Stats.tsx           # User statistics
├── Analysis/
│   ├── Capture.tsx         # Photo capture
│   ├── Preview.tsx         # Photo preview
│   └── Processing.tsx      # Analysis in progress
└── Onboarding/
    ├── Welcome.tsx
    ├── Language.tsx
    ├── HowItWorks.tsx
    └── FreeCredit.tsx
```

---

## 9. Design Tokens

### 9.1 Colors (from Telegram Theme)

```css
:root {
  /* Primary - from Telegram */
  --tg-theme-bg-color: var(--tg-bg-color);
  --tg-theme-text-color: var(--tg-text-color);
  --tg-theme-hint-color: var(--tg-hint-color);
  --tg-theme-link-color: var(--tg-link-color);
  --tg-theme-button-color: var(--tg-button-color);
  --tg-theme-button-text-color: var(--tg-button-text-color);
  --tg-theme-secondary-bg-color: var(--tg-secondary-bg-color);

  /* Custom - brand */
  --coffee-primary: #8B4513;    /* Saddle Brown */
  --coffee-secondary: #D2691E;  /* Chocolate */
  --coffee-accent: #FFD700;     /* Gold */
  --cassandra-purple: #6B5B95;  /* Mystical Purple */
}
```

### 9.2 Typography

```css
:root {
  --font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;

  --font-size-xs: 12px;
  --font-size-sm: 14px;
  --font-size-md: 16px;
  --font-size-lg: 18px;
  --font-size-xl: 24px;
  --font-size-2xl: 32px;

  --font-weight-normal: 400;
  --font-weight-medium: 500;
  --font-weight-bold: 600;
}
```

### 9.3 Spacing

```css
:root {
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 32px;
  --spacing-2xl: 48px;
}
```

---

## 10. Animations & Micro-interactions

### 10.1 Transitions

| Element | Animation | Duration |
|---------|-----------|----------|
| Page transitions | Slide left/right | 300ms |
| Bottom sheet | Slide up | 250ms |
| Cards | Fade in + scale | 200ms |
| Buttons | Scale on press | 100ms |
| Loading spinner | Rotate | infinite |

### 10.2 Haptic Feedback

| Action | Haptic Type |
|--------|-------------|
| Button tap | `impactOccurred('light')` |
| Send message | `impactOccurred('medium')` |
| Error | `notificationOccurred('error')` |
| Success (credit purchase) | `notificationOccurred('success')` |
| Tab switch | `selectionChanged()` |

---

## 11. Error Handling

### 11.1 Error States

```typescript
interface ErrorState {
  type: 'network' | 'auth' | 'credits' | 'validation' | 'server';
  message: string;
  action?: {
    label: string;
    handler: () => void;
  };
}
```

### 11.2 Error UI

```
┌─────────────────────────────────────┐
│                                     │
│              ⚠️                     │
│                                     │
│     Что-то пошло не так            │
│                                     │
│     Не удалось загрузить данные.   │
│     Проверьте подключение к        │
│     интернету.                     │
│                                     │
│     [   Попробовать снова   ]      │
│                                     │
└─────────────────────────────────────┘
```

---

## 12. Performance Requirements

| Metric | Target |
|--------|--------|
| First Contentful Paint | < 1.5s |
| Time to Interactive | < 3s |
| Bundle size (gzipped) | < 200KB |
| Image optimization | WebP, lazy loading |
| API response time | < 500ms |

---

## 13. Accessibility (a11y)

- Все интерактивные элементы доступны с клавиатуры
- ARIA labels для иконок и изображений
- Минимальный контраст текста 4.5:1
- Touch targets минимум 44x44px
- Поддержка screen readers

---

## 14. Localization

### 14.1 Supported Languages

| Code | Language | Status |
|------|----------|--------|
| ru | Русский | Primary |
| en | English | Secondary |
| zh | 中文 | Secondary |

### 14.2 i18n Keys Structure

```typescript
// src/lib/i18n.ts
const translations = {
  ru: {
    // Navigation
    'nav.home': 'Главная',
    'nav.chat': 'Чат',
    'nav.history': 'История',
    'nav.profile': 'Профиль',

    // Home
    'home.balance': 'Ваш баланс',
    'home.dailyInsight': 'Инсайт дня',
    'home.newAnalysis': 'Новый анализ',
    'home.startChat': 'Начать чат',

    // ... etc
  },
  en: { /* ... */ },
  zh: { /* ... */ },
};
```

---

## 15. Analytics Events

| Event | Parameters | When |
|-------|------------|------|
| `app_open` | `source`, `user_id` | App opened |
| `onboarding_started` | - | Onboarding begins |
| `onboarding_completed` | `language` | Onboarding finished |
| `analysis_started` | `persona` | Photo uploaded |
| `analysis_completed` | `persona`, `duration` | Analysis done |
| `chat_message_sent` | `persona` | Message sent |
| `credits_purchased` | `product`, `amount` | Purchase completed |
| `share_clicked` | `content_type` | Share button tapped |

---

## 16. Security Considerations

1. **Authentication**: Только через Telegram initData
2. **Authorization**: Проверка владения ресурсами
3. **Rate Limiting**: Ограничение запросов
4. **Input Validation**: Zod schemas на backend
5. **Image Upload**: Проверка MIME type, размера
6. **XSS Prevention**: DOMPurify для user content

---

## 17. Future Enhancements (v2+)

1. **Subscription Model** - Ежемесячная подписка с безлимитом
2. **Social Features** - Поделиться результатами
3. **Achievements** - Геймификация (значки, streak)
4. **Push Notifications** - Daily reminders
5. **Voice Messages** - Голосовой ввод
6. **AR Features** - AR-сканирование чашки
7. **Community** - Форум/чат между пользователями

---

## 18. Implementation Priority

### Phase 1 (MVP Enhancement)
1. Bottom Navigation
2. Home Screen (dashboard)
3. Profile Screen (basic)
4. Onboarding Flow

### Phase 2 (Core Features)
5. Photo Analysis Flow
6. History Screen
7. Credits Screen
8. Persona Selector

### Phase 3 (Polish)
9. Daily Insights
10. Statistics
11. Settings
12. Animations & Haptics

### Phase 4 (Growth)
13. Share functionality
14. Push notifications
15. Analytics dashboard
16. A/B testing framework

---

## 19. Open Questions

1. **Daily Insight**: Как генерировать? LLM call ежедневно или предзаготовленные?
2. **Photo Storage**: S3/Supabase Storage? Сколько хранить?
3. **Offline Mode**: Нужна ли поддержка offline?
4. **Telegram Payments**: Использовать Telegram Invoice или YooKassa?
5. **Analytics Provider**: Amplitude? Mixpanel? Custom?

---

## 20. Appendix

### A. Wireframes
См. ASCII-диаграммы в секциях 4.1-4.7

### B. User Flow Diagrams
```
[Open App] → [Auth Check] → [Onboarding?] → [Home]
                                ↓
                         [Yes: Onboarding Flow]
                                ↓
                         [Grant Free Credit]
                                ↓
                              [Home]
```

### C. Related Documents
- `docs/TARIFFS.md` - Тарифная сетка
- `docs/OMNICHANNEL_ARCHITECTURE.md` - Архитектура
- `docs/I18N_GUIDE.md` - Локализация
