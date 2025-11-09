import { conversationHistory } from './chat.js';

export default {
  name: 'aiclear',
  aliases: ['clearai', 'resetai'],
  category: 'ai',
  description: 'Clear AI conversation history',
  usage: 'aiclear',
  
  async execute(message, args, client) {
    const channelId = message.channel.id;
    
    conversationHistory.delete(channelId);

    let response = '```js\n';
    response += '╭─[ HISTORY CLEARED ]─╮\n\n';
    response += '  Conversation history cleared!\n';
    response += '  Starting fresh conversation.\n';
    response += '\n╰──────────────────────────────────╯\n```';

    await message.channel.send(response);
  }
};
