/**
 * Bot Configuration Script
 * Configures all Telegram bot settings via API
 *
 * Usage: pnpm setup:bot
 */
import { Bot } from "grammy";

// Bot token from environment
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

if (!BOT_TOKEN) {
  console.error("Error: TELEGRAM_BOT_TOKEN environment variable is required");
  process.exit(1);
}

const bot = new Bot(BOT_TOKEN);

/**
 * Bot Names (shown in chat header and search)
 */
const BOT_NAMES = {
  ru: "Symancy | Гадания AI",
  en: "Symancy | AI Fortune Teller",
};

/**
 * Bot Descriptions (shown when user opens chat for first time)
 * Max 512 characters
 */
const BOT_DESCRIPTIONS = {
  ru: `Привет! Я Symancy - твой персональный AI-помощник в мире гаданий и предсказаний.

Что я умею:
- Анализировать кофейную гущу по фото
- Толковать расклады Таро
- Отвечать на вопросы о судьбе
- Давать персональные советы

Просто отправь мне фото кофейной чашки или задай вопрос!

Нажми /start чтобы начать`,
  en: `Hi! I'm Symancy - your personal AI assistant for fortune telling and predictions.

What I can do:
- Analyze coffee grounds from photos
- Interpret Tarot spreads
- Answer questions about destiny
- Give personalized advice

Just send me a photo of your coffee cup or ask a question!

Press /start to begin`,
};

/**
 * Short Descriptions (shown in bot profile and share preview)
 * Max 120 characters
 */
const SHORT_DESCRIPTIONS = {
  ru: "AI-гадалка: толкование кофейной гущи, Таро, предсказания и персональные советы",
  en: "AI Fortune Teller: coffee grounds reading, Tarot, predictions & personalized advice",
};

/**
 * Bot Commands
 */
const BOT_COMMANDS = {
  ru: [
    { command: "start", description: "Начать общение с ботом" },
    { command: "help", description: "Помощь и инструкции" },
    { command: "fortune", description: "Получить предсказание дня" },
    { command: "credits", description: "Проверить баланс кредитов" },
    { command: "premium", description: "Премиум персона Кассандра" },
  ],
  en: [
    { command: "start", description: "Start chatting with the bot" },
    { command: "help", description: "Help and instructions" },
    { command: "fortune", description: "Get your daily fortune" },
    { command: "credits", description: "Check your credit balance" },
    { command: "premium", description: "Premium persona Cassandra" },
  ],
};

/**
 * Configure bot name for specific language
 */
async function setName(languageCode: string, name: string): Promise<void> {
  try {
    await bot.api.setMyName(name, { language_code: languageCode });
    console.log(`  Name set for ${languageCode}: "${name}"`);
  } catch (error) {
    console.error(`  Failed to set name for ${languageCode}:`, error);
  }
}

/**
 * Configure bot description for specific language
 */
async function setDescription(languageCode: string, description: string): Promise<void> {
  try {
    await bot.api.setMyDescription(description, { language_code: languageCode });
    console.log(`  Description set for ${languageCode} (${description.length} chars)`);
  } catch (error) {
    console.error(`  Failed to set description for ${languageCode}:`, error);
  }
}

/**
 * Configure short description for specific language
 */
async function setShortDescription(languageCode: string, description: string): Promise<void> {
  try {
    await bot.api.setMyShortDescription(description, { language_code: languageCode });
    console.log(`  Short description set for ${languageCode} (${description.length} chars)`);
  } catch (error) {
    console.error(`  Failed to set short description for ${languageCode}:`, error);
  }
}

/**
 * Configure bot commands for specific language
 */
async function setCommands(
  languageCode: string,
  commands: Array<{ command: string; description: string }>
): Promise<void> {
  try {
    await bot.api.setMyCommands(commands, { language_code: languageCode });
    console.log(`  Commands set for ${languageCode}: ${commands.map((c) => "/" + c.command).join(", ")}`);
  } catch (error) {
    console.error(`  Failed to set commands for ${languageCode}:`, error);
  }
}

/**
 * Configure menu button
 */
async function setMenuButton(): Promise<void> {
  try {
    // Set default menu button to open web app or show commands
    await bot.api.setChatMenuButton({
      menu_button: {
        type: "commands",
      },
    });
    console.log("  Menu button set to show commands");
  } catch (error) {
    console.error("  Failed to set menu button:", error);
  }
}

/**
 * Main setup function
 */
async function main(): Promise<void> {
  console.log("=== Symancy Bot Configuration ===\n");

  // Verify bot connection
  console.log("1. Verifying bot connection...");
  try {
    const me = await bot.api.getMe();
    console.log(`  Connected as @${me.username} (ID: ${me.id})\n`);
  } catch (error) {
    console.error("  Failed to connect to bot:", error);
    process.exit(1);
  }

  // Set names
  console.log("2. Setting bot names...");
  await setName("ru", BOT_NAMES.ru);
  await setName("en", BOT_NAMES.en);
  // Set default (no language code) to English
  await setName("", BOT_NAMES.en);
  console.log();

  // Set descriptions
  console.log("3. Setting bot descriptions...");
  await setDescription("ru", BOT_DESCRIPTIONS.ru);
  await setDescription("en", BOT_DESCRIPTIONS.en);
  await setDescription("", BOT_DESCRIPTIONS.en);
  console.log();

  // Set short descriptions
  console.log("4. Setting short descriptions...");
  await setShortDescription("ru", SHORT_DESCRIPTIONS.ru);
  await setShortDescription("en", SHORT_DESCRIPTIONS.en);
  await setShortDescription("", SHORT_DESCRIPTIONS.en);
  console.log();

  // Set commands
  console.log("5. Setting bot commands...");
  await setCommands("ru", BOT_COMMANDS.ru);
  await setCommands("en", BOT_COMMANDS.en);
  await setCommands("", BOT_COMMANDS.en);
  console.log();

  // Set menu button
  console.log("6. Setting menu button...");
  await setMenuButton();
  console.log();

  console.log("=== Configuration Complete ===");
  console.log("\nNote: Some settings require BotFather:");
  console.log("  - Bot avatar/profile picture");
  console.log("  - Inline mode settings");
  console.log("  - Payment provider settings");
  console.log("\nSee BOTFATHER-SETUP.md for manual configuration instructions.");
}

main().catch((error) => {
  console.error("Setup failed:", error);
  process.exit(1);
});
