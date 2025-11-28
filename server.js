// ==== IMPORTS ====
import express from "express";
import dotenv from "dotenv";
import { Client, GatewayIntentBits } from "discord.js";
import Anthropic from "@anthropic-ai/sdk";

dotenv.config();

// ==== EXPRESS KEEPALIVE FOR RENDER ====
const app = express();
app.get("/", (req, res) => res.send("Claude Discord Bot is running!"));
app.listen(process.env.PORT || 3000, () => {
  console.log("Web service active on port", process.env.PORT || 3000);
});

// ==== DISCORD CLIENT ====
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.once("ready", () => console.log(`Bot logged in as ${client.user.tag}`));

// ==== CLAUDE API ====
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ==== MESSAGE HANDLER ====
client.on("messageCreate", async (msg) => {
  if (msg.author.bot) return;

  // Bot triggers only when message starts with !ask
  if (!msg.content.startsWith("!ask")) return;

  const prompt = msg.content.replace("!ask", "").trim();

  try {
    await msg.channel.send("⏳ Thinking...");

    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20240620",
      temperature: 0.7,
      max_tokens: 600,
      messages: [
        { role: "user", content: prompt }
      ]
    });

    await msg.channel.send(response.content[0].text);
  } catch (err) {
    console.error(err);
    msg.channel.send("❌ Error talking to Claude.");
  }
});

// ==== LOGIN ====
client.login(process.env.DISCORD_TOKEN);
