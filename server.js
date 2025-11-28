import { Client, GatewayIntentBits } from "discord.js";
import fetch from "node-fetch";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const MODEL = "claude-3-5-sonnet-2024";

// Ask Claude API
async function askClaude(prompt) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }]
    })
  });

  const data = await res.json();
  return data.content?.[0]?.text || "(No response)";
}

client.on("messageCreate", async (msg) => {
  if (msg.author.bot) return;

  msg.channel.sendTyping();

  const reply = await askClaude(msg.content);

  msg.reply(reply);
});

client.login(process.env.DISCORD_TOKEN);
