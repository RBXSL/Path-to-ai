// ==== IMPORTS ====
import express from "express";
import dotenv from "dotenv";
import { Client, GatewayIntentBits } from "discord.js";
import fs from "fs";
import path from "path";

// AI SDKs
import Anthropic from "@anthropic-ai/sdk";
// Placeholder imports for other models (Mistral, Qwen, DeepSeek R1)
// Replace with actual SDKs or APIs you choose
// import Mistral from "mistral-sdk";
// import Qwen from "qwen-sdk";
// import DeepSeek from "deepseek-sdk";

dotenv.config();

// ==== EXPRESS KEEPALIVE FOR RENDER ====
const app = express();
app.get("/", (req, res) => res.send("Hybrid AI Discord Bot is running!"));
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

// ==== AI CLIENTS ====
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Placeholder: Initialize Mistral, Qwen, DeepSeek clients here
// const mistral = new Mistral({ apiKey: process.env.MISTRAL_API_KEY });
// const qwen = new Qwen({ apiKey: process.env.QWEN_API_KEY });
// const deepseek = new DeepSeek({ apiKey: process.env.DEEPSEEK_API_KEY });

// ==== MEMORY STORAGE ====
const MEMORY_FILE = "./memory.json";

// Load memory
let memory = {};
if (fs.existsSync(MEMORY_FILE)) {
  memory = JSON.parse(fs.readFileSync(MEMORY_FILE, "utf8"));
}

// Save memory function
function saveMemory() {
  fs.writeFileSync(MEMORY_FILE, JSON.stringify(memory, null, 2), "utf8");
}

// ==== CENTRAL AI DISPATCHER ====
async function hybridAI(prompt, userId) {
  // Retrieve user history from memory
  const history = memory[userId] || [];

  // Combine prompt + context
  const fullPrompt = history.concat([prompt]).join("\n");

  // ==== AI TASK ANALYSIS ====
  // Example: decide which AI contributes based on keywords
  const tasks = {
    coding: /code|script|function|lua|js|roblox/i.test(fullPrompt),
    reasoning: /explain|logic|think|strategy/i.test(fullPrompt),
    memory: /remember|history|past/i.test(fullPrompt)
  };

  let results = [];

  try {
    // ==== Claude for general reasoning / explanations ====
    const claudeResp = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20240620",
      temperature: 0.7,
      max_tokens: 1500,
      messages: [{ role: "user", content: fullPrompt }]
    });
    results.push(claudeResp.content[0].text);
  } catch (err) {
    results.push("[Claude API failed]");
    console.error("Claude API error:", err);
  }

  // ==== Placeholder for other AI calls ====
  if (tasks.coding) {
    // const qwenResp = await qwen.generateCode(fullPrompt);
    // results.push(qwenResp.text);
    results.push("[Qwen generated code placeholder]");
  }
  if (tasks.reasoning) {
    // const mistralResp = await mistral.reason(fullPrompt);
    // results.push(mistralResp.text);
    results.push("[Mistral reasoning placeholder]");
  }
  if (tasks.memory) {
    // const deepseekResp = await deepseek.query(fullPrompt, history);
    // results.push(deepseekResp.text);
    results.push("[DeepSeek memory placeholder]");
  }

  // ==== MERGE RESULTS ====
  const merged = results.join("\n\n---\n\n");

  // Save prompt to user memory
  if (!memory[userId]) memory[userId] = [];
  memory[userId].push(prompt);
  // Limit memory length
  if (memory[userId].length > 10) memory[userId].shift();
  saveMemory();

  return merged;
}

// ==== DISCORD MESSAGE HANDLER ====
client.on("messageCreate", async (msg) => {
  if (msg.author.bot) return;

  if (!msg.content.startsWith("!ask")) return;

  const prompt = msg.content.replace("!ask", "").trim();

  await msg.channel.send("⏳ Thinking...");

  try {
    const responseText = await hybridAI(prompt, msg.author.id);

    // Discord message limit ~2000 chars
    if (responseText.length > 1900) {
      const filePath = path.join("./", "hybrid_response.txt");
      fs.writeFileSync(filePath, responseText, "utf8");

      await msg.channel.send({
        content: "📄 Response too long, saved as a text file:",
        files: [filePath]
      });

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
