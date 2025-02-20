import express, { Request, Response } from "express";
import axios from "axios";
import dotenv from "dotenv";
import { Client, GatewayIntentBits, TextChannel } from "discord.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;

if (!DISCORD_BOT_TOKEN || !DISCORD_CHANNEL_ID) {
  console.error("Please set DISCORD_BOT_TOKEN and DISCORD_CHANNEL_ID in .env file");
  process.exit(1);
}

// Initialize Discord Bot Client
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

// Bot Event: When the bot is ready
client.once("ready", () => {
  console.log(`✅ Bot is online as ${client.user?.tag}`);
});

// Bot Event: When a new message is sent in the server
client.on("messageCreate", async (message) => {
  if (message.author.bot) return; // Ignore bot messages

  if (message.content.toLowerCase() === "hello bot") {
    await message.reply("Hello! How can I assist you today?");
  }
});

// Start the bot
client.login(DISCORD_BOT_TOKEN);

// API Endpoint to send a message to the Discord channel
app.post(
  "/send-message",
  async (req: any, res: any): Promise<any> => {
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ error: "Message content is required" });
    }

    try {
      const response = await axios.post(
        `https://discord.com/api/v9/channels/${DISCORD_CHANNEL_ID}/messages`,
        { content },
        {
          headers: {
            Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
            "Content-Type": "application/json",
          },
        }
      );

      return res.json({ status: "Message sent!", discordResponse: response.data });
    } catch (error: any) {
      console.error("Error sending message:", error.response?.data || error.message);
      return res.status(500).json({ error: "Failed to send message", details: error.response?.data });
    }
  }
);

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
