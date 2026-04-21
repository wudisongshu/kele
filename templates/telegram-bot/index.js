import TelegramBot from 'node-telegram-bot-api';

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error('❌ TELEGRAM_BOT_TOKEN not set. Create a .env file or set the environment variable.');
  process.exit(1);
}

// Create bot in polling mode (for local dev)
// For production, use webhook mode
const bot = new TelegramBot(token, { polling: true });

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, 'Welcome! 🥤 I am a bot created by kele.');
});

bot.onText(/\/help/, (msg) => {
  bot.sendMessage(msg.chat.id, 'Available commands: /start, /help');
});

// Bot logic will be implemented by AI
console.log('🤖 Telegram bot is running...');
