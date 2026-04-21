import { Client, GatewayIntentBits } from 'discord.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once('ready', () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
});

client.on('messageCreate', (message) => {
  if (message.author.bot) return;
  // Bot logic will be implemented by AI
  if (message.content === '!ping') {
    message.reply('Pong! 🥤');
  }
});

// Load token from environment variable
const token = process.env.DISCORD_BOT_TOKEN;
if (!token) {
  console.error('❌ DISCORD_BOT_TOKEN not set. Create a .env file or set the environment variable.');
  process.exit(1);
}

client.login(token);
