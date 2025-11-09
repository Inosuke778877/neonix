import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STORAGE_PATH = path.join(__dirname, '..', '..', 'database');
const AI_CONFIG_FILE = path.join(STORAGE_PATH, 'ai_config.json');

function loadAIConfig() {
  try {
    if (fs.existsSync(AI_CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(AI_CONFIG_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('[AI Config] Error loading:', e);
  }
  return {};
}

function saveAIConfig(data) {
  try {
    fs.writeFileSync(AI_CONFIG_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('[AI Config] Error saving:', e);
  }
}

export default {
  name: 'ai',
  aliases: ['aiconfig', 'aic'],
  category: 'ai',
  description: 'Configure AI settings',
  usage: 'ai <on/off/respondtoall/provider/status>',

  async execute(message, args, client) {
    if (!message.guild) return message.channel.send('```\nUse this command in a server.\n```');
    const guildId = message.guild.id;
    const channelId = message.channel.id;
    const sub = args[0]?.toLowerCase();
    let config = loadAIConfig();

    if (!config[guildId]) {
      config[guildId] = { enabled: false, channels: [], respondToAll: false, provider: 'groq' };
    }

    if (!sub) {
      const txt = [
        '```',
        '╭─[ AI CONFIG HELP ]─╮\n',
        '  ai on - Enable AI in this channel',
        '  ai off - Disable AI in this channel',
        '  ai respondtoall <on/off>',
        '  ai provider <groq/hf>',
        '  ai status - Show current config',
        '\n╰──────────────────────╯',
        '```'
      ].join('\n');
      return message.channel.send(txt);
    }

    if (['on', 'enable'].includes(sub)) {
      if (!config[guildId].channels.includes(channelId)) config[guildId].channels.push(channelId);
      config[guildId].enabled = true;
      saveAIConfig(config);
      const txt = [
        '```',
        '╭─[ AI ENABLED ]─╮\n',
        `  Channel: #${message.channel.name}`,
        '  Status: Active ✅',
        `  Provider: ${config[guildId].provider}`,
        `  Respond To All: ${config[guildId].respondToAll ? 'Yes' : 'No'}`,
        '\n╰──────────────────────╯',
        '```'
      ].join('\n');
      return message.channel.send(txt);
    }

    if (['off', 'disable'].includes(sub)) {
      config[guildId].channels = config[guildId].channels.filter(id => id !== channelId);
      if (config[guildId].channels.length === 0) config[guildId].enabled = false;
      saveAIConfig(config);
      return message.channel.send('```\nAI disabled in this channel.\n```');
    }

    if (sub === 'respondtoall') {
      const mode = args[1]?.toLowerCase();
      if (!['on', 'off'].includes(mode)) return message.channel.send('```\nUsage: ai respondtoall <on/off>\n```');
      config[guildId].respondToAll = mode === 'on';
      saveAIConfig(config);
      const txt = [
        '```',
        '╭─[ RESPOND TO ALL ]─╮\n',
        `  Status: ${config[guildId].respondToAll ? 'Enabled ✅' : 'Disabled ❌'}`,
        config[guildId].respondToAll
          ? '\n  AI will respond to everyone.'
          : '\n  AI will only respond to owner and allowed users.',
        '\n╰──────────────────────╯',
        '```'
      ].join('\n');
      return message.channel.send(txt);
    }

    if (sub === 'provider') {
      const provider = args[1]?.toLowerCase();
      if (!provider || !['groq', 'hf', 'huggingface'].includes(provider))
        return message.channel.send('```\nUsage: ai provider <groq/hf>\n```');
      config[guildId].provider = provider === 'hf' ? 'huggingface' : provider;
      saveAIConfig(config);
      const txt = [
        '```',
        '╭─[ PROVIDER SET ]─╮\n',
        `  Provider: ${config[guildId].provider}`,
        '\n╰──────────────────────╯',
        '```'
      ].join('\n');
      return message.channel.send(txt);
    }

    if (sub === 'status') {
      const c = config[guildId];
      const txt = [
        '```',
        '╭─[ AI STATUS ]─╮\n',
        `  Status: ${c.enabled ? 'Enabled ✅' : 'Disabled ❌'}`,
        `  Provider: ${c.provider}`,
        `  Channels: ${c.channels.length}`,
        `  Respond To All: ${c.respondToAll ? 'Yes ✅' : 'No ❌'}`,
        '\n╰──────────────────────╯',
        '```'
      ].join('\n');
      return message.channel.send(txt);
    }

    return message.channel.send('```\nUnknown subcommand.\n```');
  }
};
