import { joinVoiceChannel } from '@discordjs/voice';

function createIdentifier(query) {
  return /^(https?:\/\/|www\.)/i.test(query) ? query : `ytmsearch:${query}`;
}

export default {
  name: 'play',
  aliases: ['p'],
  category: 'music',
  description: 'Play a song from YouTube or search query',
  usage: 'play <song name or URL>',
  async execute(message, args, client) {
    if (!message.guild) {
      await message.channel.send('``````');
      return;
    }

    const vc = message.member?.voice?.channel;
    if (!vc) {
      await message.channel.send('error');
      return;
    }

    if (!args.length) {
      await message.channel.send('error');
      return;
    }

    try {
      // Join voice channel
      joinVoiceChannel({
        channelId: vc.id,
        guildId: vc.guild.id,
        adapterCreator: vc.guild.voiceAdapterCreator,
        selfDeaf: false,
      });

      // Wait for voice state updates
      await new Promise(resolve => setTimeout(resolve, 1000));

      const voiceState = client.voiceStates[message.guild.id];
      if (!voiceState?.token || !voiceState?.sessionId || !voiceState?.endpoint) {
        await message.channel.send('``````');
        return;
      }

      const identifier = createIdentifier(args.join(' '));
      const result = await client.lavalink.loadTracks(identifier);

      if (result.loadType === 'empty') {
        await message.channel.send('emppty');
        return;
      }

      if (result.loadType === 'error') {
        await message.channel.send(`\`\`\`js\n❌ Error: ${result.data.message}\n\`\`\``);
        return;
      }

      let track;
      if (result.loadType === 'track') track = result.data;
      else if (result.loadType === 'playlist') track = result.data.tracks[0];
      else if (result.loadType === 'search') track = result.data[0];

      if (!track) {
        await message.channel.send('``````');
        return;
      }

      let queue = client.queueManager.get(message.guild.id);
      if (!queue) {
        queue = client.queueManager.create(message.guild.id);
        queue.textChannel = message.channel;
      }

      if (queue.nowPlaying) {
        client.queueManager.addSong(message.guild.id, track);
        
        let response = '```\n';
        response += `  Title: ${track.info.title}\n`;
        response += `  Artist: ${track.info.author}\n`;
        response += `  Position: ${queue.songs.length}\n`;
        response += '\n╰──────────────────────────────────╯\n```';
        
        await message.channel.send(response);
      } else {
        queue.nowPlaying = track;
        await client.lavalink.updatePlayer(
          message.guild.id, 
          track, 
          voiceState, 
          { volume: queue.volume, filters: queue.filters }
        );

        let response = '```\n';
        response += `  🎵 ${track.info.title}\n`;
        response += `  👤 ${track.info.author}\n`;
        response += `  ⏱️ ${formatDuration(track.info.length)}\n`;
        response += '\n╰──────────────────────────────────╯\n```';
        
        await message.channel.send(response);
      }

      if (message.deletable) {
        await message.delete().catch(() => {});
      }
    } catch (err) {
      console.error('[Play Error]:', err);
      await message.channel.send(`\`\`\`js\n❌ Error: ${err.message}\n\`\`\``);
    }
  },
};

function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}:${String(minutes % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  }
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}
