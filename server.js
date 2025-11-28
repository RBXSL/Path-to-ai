import express from "express";
import dotenv from "dotenv";
import { Client, GatewayIntentBits } from "discord.js";
import fs from "fs";
import path from "path";
import fetch from "node-fetch"; // For REST API calls

dotenv.config();

// ==== EXPRESS KEEPALIVE ====
const app = express();
app.get("/", (req, res) => res.send("Hybrid AI Discord Bot is running!"));
app.listen(process.env.PORT || 3000, () => {
  console.log("Web service active on port", process.env.PORT || 3000);
});

// ==== DISCORD CLIENT ====
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

client.once("ready", () => console.log(`Bot logged in as ${client.user.tag}`));

// ==== MEMORY ====
const MEMORY_FILE = "./memory.json";
let memory = fs.existsSync(MEMORY_FILE) ? JSON.parse(fs.readFileSync(MEMORY_FILE, "utf8")) : {};
const saveMemory = () => fs.writeFileSync(MEMORY_FILE, JSON.stringify(memory, null, 2), "utf8");

// ==== HELPER FUNCTIONS FOR AI CALLS ====

// Claude (Anthropic)
async function callClaude(prompt) {
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20240620",
        temperature: 0.7,
        max_tokens_to_sample: 1500,
        messages: [{ role: "user", content: prompt }]
      })
    });
    const data = await res.json();
    return { source: "Claude", text: data.content[0].text, confidence: 0.9 };
  } catch (err) {
    return { source: "Claude", text: "[Claude failed]", confidence: 0 };
  }
}

// Qwen 3 (coding)
async function callQwen(prompt) {
  if (!process.env.QWEN_API_KEY) return { source: "Qwen", text: "[Qwen API missing]", confidence: 0 };
  try {
    const res = await fetch("https://api.qwen.ai/v1/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.QWEN_API_KEY}`
      },
      body: JSON.stringify({
        model: "qwen-7b-coding",
        prompt,
        max_tokens: 1000
      })
    });
    const data = await res.json();
    return { source: "Qwen", text: data.choices[0].text, confidence: 0.95 };
  } catch (err) {
    return { source: "Qwen", text: "[Qwen failed]", confidence: 0 };
  }
}

// Mistral (reasoning)
async function callMistral(prompt) {
  if (!process.env.MISTRAL_API_KEY) return { source: "Mistral", text: "[Mistral API missing]", confidence: 0 };
  try {
    const res = await fetch("https://api.mistral.ai/v1/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.MISTRAL_API_KEY}`
      },
      body: JSON.stringify({
        model: "mistral-7b",
        input: prompt,
        max_new_tokens: 1500
      })
    });
    const data = await res.json();
    return { source: "Mistral", text: data.output_text || data.text, confidence: 0.9 };
  } catch (err) {
    return { source: "Mistral", text: "[Mistral failed]", confidence: 0 };
  }
}

// DeepSeek (memory)
async function callDeepSeek(prompt, history) {
  if (!process.env.DEEPSEEK_API_KEY) return { source: "DeepSeek", text: "[DeepSeek API missing]", confidence: 0 };
  try {
    const res = await fetch("https://api.deepseek.ai/v1/query", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({ prompt, history })
    });
    const data = await res.json();
    return { source: "DeepSeek", text: data.response_text, confidence: 0.85 };
  } catch (err) {
    return { source: "DeepSeek", text: "[DeepSeek failed]", confidence: 0 };
  }
}

// ==== HYBRID AI DISPATCHER ====
async function hybridAI(prompt, userId) {
  const history = memory[userId] || [];
  const fullPrompt = history.concat([prompt]).join("\n");

  // Task detection
  const tasks = {
    coding: /code|script|function|lua|js|roblox/i.test(fullPrompt),
    reasoning: /explain|logic|think|strategy/i.test(fullPrompt),
    memory: /remember|history|past/i.test(fullPrompt)
  };

  // Parallel AI calls
  const promises = [callClaude(fullPrompt)];

  if (tasks.coding) promises.push(callQwen(fullPrompt));
  if (tasks.reasoning) promises.push(callMistral(fullPrompt));
  if (tasks.memory) promises.push(callDeepSeek(fullPrompt, history));

  const results = await Promise.all(promises);

  // Confidence-based merging
  results.sort((a, b) => b.confidence - a.confidence);
  const merged = results.map(r => `${r.source}:\n${r.text}`).join("\n\n---\n\n");

  // Save memory
  if (!memory[userId]) memory[userId] = [];
  memory[userId].push(prompt);
  if (memory[userId].length > 20) memory[userId].shift();
  saveMemory();

  return merged;
}

// ==== DISCORD MESSAGE HANDLER ====
client.on("messageCreate", async msg => {
  if (msg.author.bot) return;
  if (!msg.content.startsWith("!ask")) return;

  const prompt = msg.content.replace("!ask", "").trim();
  await msg.channel.send("⏳ Thinking...");

  try {
    const responseText = await hybridAI(prompt, msg.author.id);

    if (responseText.length > 1900) {
      const filePath = path.join("./", "hybrid_response.txt");
      fs.writeFileSync(filePath, responseText, "utf8");
      await msg.channel.send({ content: "📄 Response too long, saved as a text file:", files: [filePath] });
      fs.unlinkSync(filePath);
    } else {
      await msg.channel.send(responseText);
    }
  } catch (err) {
    console.error("Hybrid AI error:", err);
    await msg.channel.send("❌ Error processing your request.");
  }
});

// ==== LOGIN ====
client.login(process.env.DISCORD_TOKEN);
