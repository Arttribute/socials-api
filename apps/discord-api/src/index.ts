import express, { Request, Response } from "express";
import axios from "axios";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import CryptoJS from "crypto-js";

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("🚨 Missing Supabase environment variables!");
  console.error("SUPABASE_URL:", supabaseUrl);
  console.error("SUPABASE_SERVICE_ROLE_KEY:", supabaseKey);
  throw new Error("Supabase URL and Service Role Key must be set in .env!");
}

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json());

// Supabase Client
const supabase = createClient(supabaseUrl, supabaseKey);
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY!;

// Function to encrypt data using AES
const encrypt = (data: string): string => {
  return CryptoJS.AES.encrypt(data, ENCRYPTION_KEY).toString();
};

// Function to decrypt data using AES
const decrypt = (cipherText: string): string => {
  const bytes = CryptoJS.AES.decrypt(cipherText, ENCRYPTION_KEY);
  return bytes.toString(CryptoJS.enc.Utf8);
};

// Route to store Discord bot credentials securely
app.post("/store-discord-account", async (req: any, res: any) => {
  const { bot_token, channel_id, user_id } = req.body;

  if (!bot_token || !channel_id || !user_id) {
    return res.status(400).json({ error: "Missing bot_token, channel_id, or user_id" });
  }

  try {
    // Encrypt the bot token before storing it
    const encryptedToken = encrypt(bot_token);

    // Insert into Supabase
    const { data, error } = await supabase
      .from("discord_accounts")
      .insert([
        {
          user_id,
          encrypted_token: encryptedToken,
          channel_id
        }
      ]);

    if (error) throw error;

    return res.json({ success: true, message: "Bot credentials stored securely!" });
  } catch (error: any) {
    console.error("Error storing bot credentials:", error.message);
    return res.status(500).json({ error: "Failed to store bot credentials" });
  }
});

app.post("/send-message/:user_id", async (req: any, res: any) => {
  const { user_id } = req.params;
  const { content } = req.body;

  if (!content) {
    return res.status(400).json({ error: "Message content is required" });
  }

  try {
    // Fetch the bot's credentials from Supabase
    const { data, error } = await supabase
      .from("discord_accounts")
      .select("encrypted_token, channel_id")
      .eq("user_id", user_id)
      .single();

    if (error) {
      console.error("Error fetching bot credentials:", error.message);
      return res.status(404).json({ error: "Bot credentials not found" });
    }

    // Decrypt the bot token
    const botToken = decrypt(data.encrypted_token);

    // Send message using the bot
    const response = await axios.post(
      `https://discord.com/api/v9/channels/${data.channel_id}/messages`,
      { content },
      {
        headers: {
          Authorization: `Bot ${botToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    return res.json({ success: true, message: "Message sent!", discordResponse: response.data });
  } catch (error: any) {
    console.error("Error sending message:", error.response?.data || error.message);
    return res.status(500).json({ error: "Failed to send message", details: error.response?.data });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
