# Authentication Components

This directory contains authentication-related components for the Symancy application.

## Components

### TelegramLoginButton

A React component that integrates the official Telegram Login Widget for seamless user authentication via Telegram.

#### Features

- **Script Injection**: Dynamically loads the official Telegram widget script
- **Loading State**: Shows loading indicator while script loads
- **Error Handling**: Displays error messages if script fails to load or bot is misconfigured
- **TypeScript**: Full type safety with proper TypeScript types
- **Cleanup**: Properly cleans up global callbacks and DOM elements on unmount
- **Customizable**: Supports custom sizing, styling, and border radius
- **i18n Ready**: Can be integrated with the app's i18n system

#### Usage

```tsx
import { TelegramLoginButton } from './components/features/auth/TelegramLoginButton';
import type { TelegramAuthData } from './types/omnichannel';

function LoginPage() {
  const handleTelegramAuth = async (user: TelegramAuthData) => {
    // Verify with backend
    const response = await fetch('/api/auth/telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user),
    });

    const { token, user: userData } = await response.json();

    // Store token and redirect
    localStorage.setItem('symancy_token', token);
    window.location.href = '/';
  };

  return (
    <div>
      <h1>Login</h1>
      <TelegramLoginButton
        onAuth={handleTelegramAuth}
        size="large"
        radius={8}
      />
    </div>
  );
}
```

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `onAuth` | `(user: TelegramAuthData) => void` | **Required** | Callback invoked when user authenticates |
| `className` | `string` | `''` | Optional CSS class name for styling |
| `size` | `'small' \| 'medium' \| 'large'` | `'large'` | Widget button size |
| `radius` | `number` | `8` | Border radius in pixels |
| `requestAccess` | `boolean` | `true` | Whether to request write access |

#### Environment Variables

The component requires the following environment variable:

```bash
VITE_TELEGRAM_BOT_NAME=your_bot_username
```

This should be set in your `.env` file. Get your bot username from [@BotFather](https://t.me/BotFather).

#### Backend Verification

**IMPORTANT**: Always verify the Telegram auth data on your backend before trusting it.

Example backend verification (Node.js):

```typescript
import crypto from 'crypto';

function verifyTelegramAuth(data: TelegramAuthData): boolean {
  const { hash, ...authData } = data;

  // Check auth_date (not older than 24 hours)
  if (Date.now() - authData.auth_date * 1000 > 86400000) {
    return false;
  }

  // Create data-check-string
  const checkString = Object.keys(authData)
    .sort()
    .map((key) => `${key}=${authData[key as keyof typeof authData]}`)
    .join('\n');

  // Secret key = SHA256(bot_token)
  const secretKey = crypto
    .createHash('sha256')
    .update(process.env.TELEGRAM_BOT_TOKEN!)
    .digest();

  // Calculate HMAC-SHA256
  const calculatedHash = crypto
    .createHmac('sha256', secretKey)
    .update(checkString)
    .digest('hex');

  return calculatedHash === hash;
}
```

#### Telegram Setup

1. Create a bot via [@BotFather](https://t.me/BotFather)
2. Get the bot username (e.g., `symancy_bot`)
3. Set domain via BotFather:
   - Send `/mybots` → Select your bot
   - Bot Settings → Domain → Add `symancy.ru`

**Note**: The Telegram Login Widget does NOT work on localhost. For local development:
- Use [ngrok](https://ngrok.com/) to expose your local server
- Or use Telegram WebApp (which works on localhost)

#### Security Considerations

1. **Always verify** the hash on your backend
2. **Check auth_date** to prevent replay attacks (max 24 hours)
3. **Use HTTPS** in production
4. **Store tokens securely** (HttpOnly cookies recommended)
5. **Implement CSRF protection**

#### TypeScript Types

The component uses the `TelegramAuthData` type from `src/types/omnichannel.ts`:

```typescript
export interface TelegramAuthData {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}
```

#### Error States

The component handles the following errors:

1. **Missing Bot Name**: If `VITE_TELEGRAM_BOT_NAME` is not set
2. **Script Load Failure**: If Telegram widget script fails to load
3. **Auth Callback Error**: If the `onAuth` callback throws an error

#### Loading States

The component shows a loading spinner while:
- The Telegram widget script is being loaded
- The widget is initializing

#### Examples

See `TelegramLoginButton.example.tsx` for detailed usage examples including:
- Basic usage
- Custom styling
- Error handling
- i18n integration

#### Related Documentation

- [Telegram Login Widget Official Docs](https://core.telegram.org/widgets/login)
- [Omnichannel Architecture](../../../../specs/004-omnichannel-chat/spec.md)
- [Quickstart Guide](../../../../specs/004-omnichannel-chat/quickstart.md)

#### Troubleshooting

**Problem**: Widget doesn't appear

**Solution**:
- Check `VITE_TELEGRAM_BOT_NAME` is set correctly
- Verify domain is registered with @BotFather
- Check browser console for errors
- Ensure you're on a registered domain (not localhost)

**Problem**: "Invalid signature" error on backend

**Solution**:
- Verify `TELEGRAM_BOT_TOKEN` matches the bot
- Check backend verification logic
- Ensure `auth_date` is not older than 24 hours

**Problem**: Component shows error immediately

**Solution**:
- Check environment variables are loaded
- Verify bot username is correct (no `@` prefix)
- Check network connectivity
