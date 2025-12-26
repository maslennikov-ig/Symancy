# BotFather Manual Configuration Guide

This guide covers Telegram bot settings that cannot be configured via API and must be set manually through [@BotFather](https://t.me/BotFather).

## Prerequisites

1. Open Telegram and start chat with [@BotFather](https://t.me/BotFather)
2. Send `/mybots` and select your bot (@SymancyBot or your bot username)

---

## 1. Bot Profile Picture (Avatar)

The bot avatar is the first thing users see. Make it memorable!

### Steps:
1. In BotFather, select your bot
2. Click **Bot Settings** > **Edit Bot Picture**
3. Send a square image (recommended: 512x512 px)

### Design Guidelines:
- Use a mystical/fortune-telling theme
- Include crystal ball, tarot cards, or coffee cup imagery
- Make it recognizable at small sizes
- Use consistent brand colors (purple, gold, deep blue)

### Suggested Design:
```
A circular avatar with:
- Deep purple gradient background
- Golden crystal ball or tarot card in center
- Subtle mystical symbols (stars, moons)
- "S" monogram for Symancy (optional)
```

---

## 2. Inline Mode (Optional)

Enable if you want users to use the bot inline in any chat (`@SymancyBot query`).

### Steps:
1. In BotFather, select your bot
2. Click **Bot Settings** > **Inline Mode**
3. Click **Turn on** to enable
4. Set **Inline Placeholder**: `Ask about your fortune...`

### Note:
Inline mode requires additional backend implementation. Only enable if your code supports it.

---

## 3. Group Privacy Settings

Configure whether the bot receives all messages in groups or only commands.

### Steps:
1. In BotFather, select your bot
2. Click **Bot Settings** > **Group Privacy**
3. Choose:
   - **Enabled** (default) - Bot only sees commands (/start, etc.)
   - **Disabled** - Bot sees all messages in groups

### Recommendation:
Keep **Enabled** unless you need the bot to respond to non-command messages in groups.

---

## 4. Allow Groups

Configure whether the bot can be added to groups.

### Steps:
1. In BotFather, select your bot
2. Click **Bot Settings** > **Allow Groups**
3. Choose **Turn off** to disable group invites (recommended for personal bots)

### Recommendation:
For a fortune-telling bot focused on personal readings, consider disabling groups.

---

## 5. Payment Provider (If Using Payments)

Connect payment providers for in-bot purchases.

### Steps:
1. In BotFather, select your bot
2. Click **Payments**
3. Choose a provider:
   - **Stripe** (recommended for international)
   - **YooKassa** (for Russia)
   - **Other providers** as needed

### For YooKassa:
1. Select **YooKassa**
2. Enter your YooKassa Shop ID
3. Enter your Secret Key
4. Complete verification

### Note:
Payment integration requires additional backend code. See payment documentation.

---

## 6. Domain Verification (For Web Apps)

If using Telegram Web Apps, verify your domain.

### Steps:
1. In BotFather, select your bot
2. Click **Bot Settings** > **Menu Button**
3. Configure Web App URL if needed
4. Verify domain ownership

---

## 7. Bot Token Regeneration (Security)

If your token is compromised, regenerate it immediately.

### Steps:
1. In BotFather, select your bot
2. Click **API Token**
3. Click **Revoke current token**
4. Update `TELEGRAM_BOT_TOKEN` in your `.env` file
5. Redeploy your application

### Warning:
This will immediately disconnect your bot until you update the token everywhere.

---

## Quick Reference Commands

| Command | Description |
|---------|-------------|
| `/mybots` | List your bots |
| `/setname` | Change bot display name |
| `/setdescription` | Change bot description |
| `/setabouttext` | Change "About" text |
| `/setuserpic` | Change bot avatar |
| `/setcommands` | Set command list |
| `/deletebot` | Delete a bot |
| `/token` | Get/revoke API token |
| `/setinline` | Configure inline mode |
| `/setprivacy` | Group privacy settings |
| `/setjoingroups` | Allow/disallow groups |

---

## Automated vs Manual Settings

### Automated (via API):
- Bot name (multilingual)
- Description (multilingual)
- Short description (multilingual)
- Commands (multilingual)
- Menu button

### Manual (via BotFather):
- Profile picture
- Inline mode toggle
- Group privacy
- Allow groups
- Payment providers
- Domain verification
- Token management

---

## After Configuration

Run the automated setup script:

```bash
cd symancy-backend
pnpm setup:bot
```

This will configure all API-accessible settings with proper localization.

---

## Checklist

- [ ] Set bot profile picture
- [ ] Configure group settings (if needed)
- [ ] Set up payment provider (if using payments)
- [ ] Run `pnpm setup:bot` for API settings
- [ ] Test bot by sending /start

---

*Last updated: December 2025*
