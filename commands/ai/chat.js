import Groq from 'groq-sdk';
import { HfInference } from '@huggingface/inference';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize AI clients
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const hf = new HfInference(process.env.HUGGINGFACE_API_KEY);

// Storage paths
const STORAGE_PATH = path.join(__dirname, '..', '..', 'database');
const AI_CONFIG_FILE = path.join(STORAGE_PATH, 'ai_config.json');
const PERSONALITY_FILE = path.join(STORAGE_PATH, 'personality.txt');
const ALLOWED_USERS_FILE = path.join(STORAGE_PATH, 'allowedUsers.json');

// Ensure storage directory exists
if (!fs.existsSync(STORAGE_PATH)) {
    fs.mkdirSync(STORAGE_PATH, { recursive: true });
}

// Create default personality file if not exists
if (!fs.existsSync(PERSONALITY_FILE)) {
    const defaultPersonality = `You are a helpful, friendly, and knowledgeable AI assistant. You provide clear, concise, and accurate responses. You are respectful and professional in all interactions.`;
    fs.writeFileSync(PERSONALITY_FILE, defaultPersonality);
}

// Load AI configurations
function loadAIConfig() {
    try {
        if (fs.existsSync(AI_CONFIG_FILE)) {
            return JSON.parse(fs.readFileSync(AI_CONFIG_FILE, 'utf8'));
        }
    } catch (error) {
        console.error('[AI] Error loading config:', error);
    }
    return {};
}

// Save AI configurations
function saveAIConfig(data) {
    try {
        fs.writeFileSync(AI_CONFIG_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('[AI] Error saving config:', error);
    }
}

// Load personality
function loadPersonality() {
    try {
        if (fs.existsSync(PERSONALITY_FILE)) {
            return fs.readFileSync(PERSONALITY_FILE, 'utf8');
        }
    } catch (error) {
        console.error('[AI] Error loading personality:', error);
    }
    return 'You are a helpful AI assistant.';
}

let aiConfig = loadAIConfig();
let aiListenerRegistered = false;

// Conversation history storage (per channel)
const conversationHistory = new Map();

export default {
  name: 'chat',
  aliases: ['ask'],
  category: 'ai',
  description: 'Chat with AI assistant',
  usage: 'chat <message>',
  
  async execute(message, args, client) {
    if (!args.length) {
      let response = '```js/n';
      response += '╭─[ AI CHAT ]─╮\n\n';
      response += '  Usage:\n';
      response += '    chat <message>\n\n';
      response += '  Or mention the bot:\n';
      response += '    @bot <message>\n\n';
      response += '  Example:\n';
      response += '    chat Hello, how are you?\n';
      response += '\n╰──────────────────────────────────╯\n```';
      await message.channel.send(response);
      return;
    }

    const userMessage = args.join(' ');
    const channelId = message.channel.id;
    const guildId = message.guild?.id;

    try {
      // Show typing indicator
      await message.channel.sendTyping();

      // Reload config to get latest provider setting
      aiConfig = loadAIConfig();
      const config = aiConfig[guildId] || { provider: 'groq' };
      
      console.log(`[AI] Using provider: ${config.provider}`);
      
      // Generate AI response
      const aiResponse = await generateAIResponse(
        userMessage, 
        channelId, 
        config.provider
      );

      // Split message if too long
      const messageParts = splitMessage(aiResponse);

      // Send response(s)
      for (const part of messageParts) {
        await message.reply(part);
      }

      console.log(`[AI] Responded to ${message.author.tag} using ${config.provider}`);

    } catch (error) {
      console.error('[AI] Error:', error);
      await message.reply('``````');
    }
  }
};

// Generate AI response
async function generateAIResponse(userMessage, channelId, provider = 'groq') {
  const personality = loadPersonality();
  
  // Get or create conversation history for this channel
  if (!conversationHistory.has(channelId)) {
    conversationHistory.set(channelId, [
      {
        role: 'system',
        content: personality
      }
    ]);
  }

  const history = conversationHistory.get(channelId);
  
  // Add user message to history
  history.push({
    role: 'user',
    content: userMessage
  });

  // Keep only last 20 messages to avoid token limits
  if (history.length > 21) {
    history.splice(1, history.length - 21);
  }

  let aiResponse;

  try {
    if (provider === 'huggingface' || provider === 'hf') {
      // Use HuggingFace
      aiResponse = await generateHuggingFaceResponse(history);
    } else {
      // Use Groq (default)
      aiResponse = await generateGroqResponse(history);
    }
  } catch (error) {
    console.error(`[AI] ${provider} error:`, error);
    // Fallback to other provider
    if (provider === 'huggingface' || provider === 'hf') {
      console.log('[AI] Falling back to Groq');
      aiResponse = await generateGroqResponse(history);
    } else {
      throw error;
    }
  }

  // Add AI response to history
  history.push({
    role: 'assistant',
    content: aiResponse
  });

  conversationHistory.set(channelId, history);

  return aiResponse;
}

// Generate response using Groq
async function generateGroqResponse(history) {
  const chatCompletion = await groq.chat.completions.create({
    messages: history,
    model: 'llama-3.3-70b-versatile',
    temperature: 0.7,
    max_tokens: 1024,
    top_p: 1,
    stream: false
  });

  return chatCompletion.choices[0]?.message?.content || 'I apologize, but I could not generate a response.';
}

// Generate response using HuggingFace (Chat Completion)
async function generateHuggingFaceResponse(history) {
  try {
    // Use chat completion API for proper conversation support
    const response = await hf.chatCompletion({
      model: 'google/gemma-2-2b-it',
      messages: history,
      max_tokens: 1024,
      temperature: 0.7,
    });

    return response.choices[0]?.message?.content || 'I apologize, but I could not generate a response.';
  } catch (error) {
    console.error('[AI] HuggingFace chat completion error:', error);
    
    // Fallback to text generation with formatted prompt
    let prompt = '';
    
    for (const msg of history) {
      if (msg.role === 'system') {
        prompt += `[SYSTEM] ${msg.content}\n\n`;
      } else if (msg.role === 'user') {
        prompt += `[USER] ${msg.content}\n`;
      } else if (msg.role === 'assistant') {
        prompt += `[ASSISTANT] ${msg.content}\n`;
      }
    }
    
    prompt += '[ASSISTANT]';

    const response = await hf.textGeneration({
      model: 'meta-llama/Llama-3.2-3B-Instruct',
      inputs: prompt,
      parameters: {
        max_new_tokens: 1024,
        temperature: 0.7,
        top_p: 0.95,
        return_full_text: false
      }
    });

    return response.generated_text.trim() || 'I apologize, but I could not generate a response.';
  }
}

// Split long messages
function splitMessage(text, maxLength = 2000) {
  if (text.length <= maxLength) return [text];
  
  const messages = [];
  let currentMessage = '';
  
  const lines = text.split('\n');
  
  for (const line of lines) {
    if ((currentMessage + line + '\n').length > maxLength) {
      if (currentMessage) {
        messages.push(currentMessage.trim());
        currentMessage = '';
      }
      
      if (line.length > maxLength) {
        for (let i = 0; i < line.length; i += maxLength) {
          messages.push(line.substring(i, i + maxLength));
        }
      } else {
        currentMessage = line + '\n';
      }
    } else {
      currentMessage += line + '\n';
    }
  }
  
  if (currentMessage) {
    messages.push(currentMessage.trim());
  }
  
  return messages;
}

// Check if user is allowed
function isUserAllowed(userId) {
  if (userId === process.env.OWNER_ID) return true;

  try {
    if (fs.existsSync(ALLOWED_USERS_FILE)) {
      const data = JSON.parse(fs.readFileSync(ALLOWED_USERS_FILE, 'utf8'));
      if (data.allowedUsers && data.allowedUsers.includes(userId)) {
        return true;
      }
    }
  } catch (error) {
    console.error('[AI] Error checking allowed users:', error);
  }

  return false;
}

// Check if user is blocked
function isUserBlocked(userId, guildId, blockedUsers) {
  if (!blockedUsers[guildId]) return false;
  return blockedUsers[guildId].includes(userId);
}

// Register AI listener
export function registerAIListener(client, blockedUsers) {
  console.log('[AI] Listener registered');

  client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    const guildId = message.guild.id;
    const channelId = message.channel.id;

    // Reload config to get latest settings
    aiConfig = loadAIConfig();

    if (!aiConfig[guildId] || !aiConfig[guildId].enabled) return;
    if (!aiConfig[guildId].channels.includes(channelId)) return;
    if (!message.mentions.has(client.user.id)) return;

    // Check if user is blocked
    if (isUserBlocked(message.author.id, guildId, blockedUsers)) {
      await message.reply('``````');
      return;
    }

    // Check respondToAll mode
    const config = aiConfig[guildId];
    const respondToAll = config.respondToAll !== undefined ? config.respondToAll : false;

    // If respondToAll is OFF, only allow owner and allowed users
    if (!respondToAll && !isUserAllowed(message.author.id)) {
      return;
    }

    let userMessage = message.content.replace(/<@!?\d+>/g, '').trim();

    if (!userMessage) {
      await message.reply('``````');
      return;
    }

    try {
      await message.channel.sendTyping();

      console.log(`[AI] Using provider: ${config.provider || 'groq'}`);

      const aiResponse = await generateAIResponse(userMessage, channelId, config.provider || 'groq');
      const messageParts = splitMessage(aiResponse);

      for (const part of messageParts) {
        await message.reply(part);
      }

      console.log(`[AI] Responded to ${message.author.tag} in ${message.guild.name}`);

    } catch (error) {
      console.error('[AI] Error in conversation:', error);
      await message.reply('[AI] Error in conversation:');
    }
  });
}

// Initialize AI system
export async function initializeAI(client) {
  console.log('[AI] Initializing AI chat system...');
  aiConfig = loadAIConfig();

  const enabledGuilds = Object.values(aiConfig).filter(c => c.enabled).length;

  if (enabledGuilds > 0) {
    const blockedUsersPath = path.join(STORAGE_PATH, 'ai_blocked.json');
    let blockedUsers = {};
    try {
      if (fs.existsSync(blockedUsersPath)) {
        blockedUsers = JSON.parse(fs.readFileSync(blockedUsersPath, 'utf8'));
      }
    } catch (error) {
      console.error('[AI] Error loading blocked users:', error);
    }

    registerAIListener(client, blockedUsers);
    aiListenerRegistered = true;
    console.log(`[AI] Loaded ${enabledGuilds} enabled guild configs`);
  } else {
    console.log('[AI] No enabled configs found');
  }
}

// Export for other commands
export { conversationHistory };
